# -*- coding: utf-8 -*-
"""Fiscal da cursos.html como página de venda (05/09/2026).

Cada regra aqui existe porque violá-la já custou algo real: parcela publicada sem o
à vista (juros do gateway viram reclamação), escopo do pacote sumindo do card (o botão
vai direto ao checkout), âncora legada apagada (e-mails e QR codes já disparados),
utm_content com dígito (o GTM trunca), e o gerador de catálogo que fatia esta página
por string literal.

Uso:
  PY="C:/Users/vfnev/AppData/Local/Python/pythoncore-3.14-64/python.exe"
  "$PY" scripts/fiscal_cursos_venda.py            # cursos.html do repo
  "$PY" scripts/fiscal_cursos_venda.py <arquivo>  # outro arquivo (ex.: baixado do ar)
Sai com código 1 se qualquer checagem reprovar.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
arq = Path(sys.argv[1]) if len(sys.argv) > 1 else RAIZ / "cursos.html"
html = arq.read_text(encoding="utf-8")
# Comentários HTML são guia de manutenção, não texto publicado: as regras de copy
# olham só o que o visitante vê.
visivel = re.sub(r"<!--.*?-->", "", html, flags=re.S)
falhas, ok = [], 0


def check(cond, msg):
    global ok
    if cond:
        ok += 1
    else:
        falhas.append(msg)


# ── 1. Parcela nunca sozinha ─────────────────────────────────────────────
# Toda ocorrência de "12× de R$ X" ou "11× de R$ X" tem de ter "à vista" a até 400
# caracteres depois (mesmo card / mesma frase).
for m in re.finditer(r"1[12]× (?:de )?R\$ \d{1,3},\d{2}", html):
    trecho = html[max(0, m.start() - 200): m.end() + 400]  # a caixa lateral põe o à vista ANTES da parcela
    check("à vista" in trecho, f"parcela sem à vista por perto: …{html[max(0,m.start()-60):m.end()+80]!r}")

# Os quatro pares publicados (valores da tela da Kiwify) — se um mudar, mudar aqui também.
PARES = [("44,16", "427"), ("56,57", "547"), ("24,51", "237"), ("5,22", "47"), ("35,89", "347"), ("15,20", "147")]
for parcela, avista in PARES:
    check(f"R$ {parcela}" in html and f"R$ {avista}" in html, f"par {parcela}/{avista} incompleto")

# ── 2. O que não pode sumir ──────────────────────────────────────────────
check('id="lista-espera"' in html, "âncora legada #lista-espera sumiu")
check('id="assinar"' in html and 'id="entradas"' in html, "âncoras #assinar/#entradas")
check(html.count('class="entrada-nao"') >= 3, "cards de pacote sem a linha do que NÃO cobrem (esperava ≥3)")
check("Não cobre Contabilidade Pública nem Auditoria Fiscal" in html, "escopo do SEFAZ AL sumiu")
check("Não cobre Análise de Balanços" in html, "escopo do Transpetro sumiu")
check("Não cobre CASP" in html, "escopo do SEFAZ SC sumiu")
check("Ver modalidades atuais" not in html or True, "")  # o plural mora na assinatura.html; aqui só não pode ser criado no singular
check("Ver modalidade atual" not in html, "'Ver modalidade atual' no singular — o plural é intencional")

# ── 3. utm_content só minúsculas (regex do GTM: utm_content=([a-z]+)) ────
for m in re.finditer(r"utm_content=([^\"&]+)(?=[\"&])", visivel):
    check(re.fullmatch(r"[a-z]+", m.group(1)) is not None, f"utm_content inválido: {m.group(1)}")

# ── 4. Checkouts: um por produto, todos com utm_medium=cursos ───────────
CHECKOUTS = {"4Qx0g3O": "trimestral", "DXvdSEu": "semestral", "ZtyEAiG": "sefazal",
             "pBSgGdf": "dicionario", "RKLuqqI": "transpetro", "ysIOuUp": "sefazsc"}
for slug, content in CHECKOUTS.items():
    links = re.findall(rf'href="https://pay\.kiwify\.com\.br/{slug}\?[^"]*"', html)
    check(len(links) == 1, f"checkout {slug}: {len(links)} links (esperava 1)")
    for l in links:
        check("utm_medium=cursos" in l and f"utm_content={content}" in l, f"checkout {slug} sem utm_medium=cursos/utm_content={content}")
check(len(re.findall(r'pay\.kiwify\.com\.br/([A-Za-z0-9]+)', html)) == len(CHECKOUTS), "há checkout fora da lista conhecida")

# ── 5. Contrato com o gerador de catálogo (fatia nav/footer por string) ──
check(len(re.findall(r'<link rel="stylesheet" href="assets/email-capture\.css\?v=\d+"', html)) == 1, "≠1 link de email-capture")
check(len(re.findall(r'<script src="assets/email-capture\.js\?v=\d+"[^>]*></script>', html)) == 1, "≠1 script de email-capture")
check('<div id="topbar">' in html and "</div>\n\n<section" in html, "âncora do nav para o gerador ('</div>\\n\\n<section')")
check("<script>\nvar nav=document.getElementById('mainNav')" in html, "script de scroll (fatiado pelo gerador) mudou")

# ── 6. Honestidade ───────────────────────────────────────────────────────
check("5.000" not in visivel, "'5.000' alunos — o número aprovado é 3.000+ em 40 turmas")
check("3.000" in html and "40 turmas" in html, "número de alunos aprovado ausente")
check(re.search(r"em breve", html, re.I) is None or html.lower().count("em breve") == html.count('class="fut-pill">Em breve'), "'em breve' fora dos cards do Roadmap")
check("nomeado" not in visivel.lower(), "Ransley aguarda convocação — não escrever 'nomeado'")
check("aprovado pela plataforma" not in visivel.lower(), "atribuição proibida: 'aprovado pela plataforma'")
check("Entre na lista" not in visivel, "fecho do Roadmap ainda manda para a lista de espera (que não existe)")
check("55.373.571/0001-63" in html, "CNPJ do rodapé jurídico ausente")
check("Não há garantia de aprovação" in html, "ressalva de aprovação ausente")
check("80% do edital" not in html, "cobertura tem de ser escopada à disciplina")

# ── 7. Estrutura de venda (as 10 ideias) ─────────────────────────────────
check('data-fc-local="hero"' in html, "hero sem CTA rastreado")
check('id="comprovRansley"' in html, "prova social sem comprovante")
check(html.count("btn-venda") >= 10, f"CTAs vermelhas: {html.count('btn-venda')} (esperava ≥10)")
check('id="cta-fixa"' in html, "barra fixa do mobile ausente")
check('id="proximas-provas"' in html and "?estado" in html, "próximas provas ausente")
check(html.count('class="pl-card') == 4, "plataforma: esperava 4 cards")
check(html.count('class="faq-item"') >= 10, "FAQ com menos de 10 perguntas")
check(html.count('class="passo-card') == 3, "depois de pagar: esperava 3 passos")
check(html.index('id="assinar"') < html.index('id="grade"'), "grade de módulos deve vir DEPOIS da oferta")
check(html.index('id="entradas"') < html.index('id="grade"'), "grade de módulos deve vir DEPOIS das entradas")
check("FC_EC_MODO_VENDA" in html, "flag que desliga exit-intent/sticky de newsletter ausente")
check(html.count('data-plano="trimestral"') == 1 and html.count('data-plano="semestral"') == 1, "cards da oferta sem data-plano")

# ── 8. Datas das provas: formato e futuro em relação a hoje (o JS esconde vencidas) ──
from datetime import date
datas = re.findall(r'data-prova="(\d{4}-\d{2}-\d{2})"', html)
check(len(datas) == 9, f"provas listadas: {len(datas)} (esperava 9)")
check(any(date.fromisoformat(d) >= date.today() for d in datas), "nenhuma prova futura — a seção ficaria oculta")

# ── 9. HTML são: style/script balanceados ────────────────────────────────
check(html.count("<style") == html.count("</style>"), "<style> desbalanceado")
check(html.count("<script") == html.count("</script>"), "<script> desbalanceado")
check(html.count("<section") == html.count("</section>"), "<section> desbalanceado")

print(f"fiscal_cursos_venda: {ok} ok, {len(falhas)} falhas — {arq.name}")
for f in falhas:
    print("  ✗", f)
sys.exit(1 if falhas else 0)
