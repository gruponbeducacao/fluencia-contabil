# -*- coding: utf-8 -*-
"""Fiscal das secoes de persuasao na LP de assinatura (assinatura.html).

Porte do _fiscal_persuasao.py da Transpetro para o repo do site, com ROOT deduzido
do proprio arquivo (como o gen_variante_b.py). Cobre as cinco armadilhas do
_MARKETING/Landing_Pages/_PROMPT_LEVAR_SECOES_PERSUASAO.md e as regras que a LP A
tem a mais: variante B gerada, preco com centavos so' a partir de #oferta, slot de
VSL oculto <-> id vazio, proximas provas com datas validas, captura da Aula 01.

Uso:  python scripts/fiscal_persuasao_assinatura.py [antes.html]
      (antes.html = `git show <base>:assinatura.html`; habilita o fiscal por PALAVRA
       e o balanceamento de tags por DIFERENCA)
Sai com codigo 1 se qualquer checagem falhar.
"""
import re
import sys
import unicodedata
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LP = ROOT / "assinatura.html"
s = LP.read_text(encoding="utf-8", newline="")
antes = Path(sys.argv[1]).read_text(encoding="utf-8", errors="replace", newline="") if len(sys.argv) > 1 else None
erros, oks = [], []


def ok(nome, cond, det=""):
    (oks if cond else erros).append(f"{nome}{(' -> ' + det) if det else ''}")


SECOES = ["dor-sec", "stack-sec", "anat-sec", "naoe-sec", "passo-sec",
          "contraste-sec", "selos-sec", "prova-sec", "degrau-sec"]

# ---------------------------------------------- A. as secoes estao la', uma vez cada
for c in SECOES:
    n = s.count(f'class="section {c}"')
    ok(f"seção «{c}» presente 1x", n == 1, f"{n}x")

# ------------------------------------- B. sistema de classes do ALVO (nao o do Dicionario)
for c in SECOES:
    i = s.find(f'class="section {c}"')
    if i < 0:
        continue
    bloco = s[i:s.index("</section>", i)]
    ok(f"[{c}] usa o esqueleto do alvo", 'class="container"' in bloco and "reveal" in bloco)
    ok(f"[{c}] sem classe do Dicionário",
       not re.search(r'class="[^"]*\b(inner|lbl|body-t|bar)\b', bloco))

# ---------------------------------------------- C. ordem das secoes
ordem = ['class="section dor-sec"', 'class="section dor"', 'class="section professor"',
         'class="section stack-sec"', 'id="oferta"', 'class="section garantia"',
         'class="section anat-sec"', 'class="section naoe-sec"',
         'class="section degrau-sec"', 'class="section prova-sec"', 'class="section depoimentos"',
         'class="section passo-sec"', 'class="section faq"', 'class="section contraste-sec"',
         'class="section cta-final"', "</main>", 'class="section selos-sec"', "<footer"]
pos = [s.find(x) for x in ordem]
ok("ordem das seções é a planejada", all(p >= 0 for p in pos) and pos == sorted(pos),
   " < ".join(f"{o[:18]}@{p}" for o, p in zip(ordem, pos)))

# ------------------------------------------------- D. CTA e tracking
for slug, local in (("4Qx0g3O", "trimestral"), ("DXvdSEu", "semestral"), ("pBSgGdf", "degrau")):
    m = re.search(r'<a href="https://pay\.kiwify\.com\.br/' + slug + r'\?([^"]+)" class="btn cta-compra" data-fc-local="([^"]+)"', s)
    ok(f"checkout {slug} tem cta-compra + data-fc-local={local} + src=lp-a",
       bool(m) and m.group(2) == local and "src=lp-a" in m.group(1),
       m.group(0)[:90] if m else "não casou")
locais = re.findall(r'data-fc-local="([^"]+)"', s)
dups = sorted({x for x in locais if locais.count(x) > 1})
if antes is not None:
    _a = re.findall(r'data-fc-local="([^"]+)"', antes)
    dups_antes = sorted({x for x in _a if _a.count(x) > 1})
    ok("não introduzi data-fc-local duplicado", set(dups) <= set(dups_antes),
       f"novos: {sorted(set(dups) - set(dups_antes))}")
else:
    ok("nenhum data-fc-local duplicado", not dups, str(dups))
ok("sem fbq inline novo (Meta só nasce no GTM / origem.js)",
   s.count("fbq(") == (antes.count("fbq(") if antes is not None else s.count("fbq(")),
   f"{s.count('fbq(')} ocorrências")
for ev in ("rolagem", "visualizou_oferta", "prova_escolhida", "download_aula01", "lead_capturado"):
    ok(f"dataLayer emite «{ev}»", f"event: '{ev}'" in s)

# -------------------------------- E. preco: centavos e checkout so' a partir de #oferta
i_oferta = s.index('<section class="section oferta" id="oferta">')
i_curso = s.index("<!-- ===== O CURSO ===== -->")
pre = s[i_curso:i_oferta]
ok("nenhum link Kiwify antes de #oferta", "pay.kiwify" not in pre)
RX_CENT = r"R\$\s?\d{1,3}(?:\.\d{3})*,\d{2}"
cent = re.findall(RX_CENT, pre)
if antes is not None:
    _a0 = antes[antes.index("<!-- ===== O CURSO ===== -->"):antes.index('<section class="section oferta" id="oferta">')]
    cent_antes = re.findall(RX_CENT, _a0)
    ok("nenhum preço com centavos NOVO entre O CURSO e #oferta (a demo já tinha R$ 0,00)",
       sorted(cent) == sorted(cent_antes), f"antes {cent_antes}, depois {cent}")
else:
    ok("preço com centavos entre O CURSO e #oferta só o da demo", set(cent) <= {"R$ 0,00"}, str(cent[:5]))
stack = s[s.index('class="section stack-sec"'):s.index("</section>", s.index('class="section stack-sec"'))]
ok("âncora do stack cita R$ 427, R$ 547 e R$ 237", all(x in stack for x in ("R$ 427", "R$ 547", "R$ 237")))
n_s = len(re.findall(r"<s\b", s))
ok("nenhum preço riscado novo (<s> igual à baseline)",
   n_s == (len(re.findall(r"<s\b", antes)) if antes is not None else 2), f"{n_s} <s>")
hd = re.findall(r'^ {6}<p class="hero-datas">', s, flags=re.M)
ok("<p class=\"hero-datas\"> 1x com 6 espaços (contrato do gen_variante_b)", len(hd) == 1, f"{len(hd)}x")

# --------------------------------------------- F. honestidade da casa
def visivel(t):
    t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", t, flags=re.S)
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t))
texto = visivel(s)
texto_antes = visivel(antes) if antes is not None else None
ok("CNPJ e razão social corretos", "55.373.571/0001-63" in s and "NEVES E BALHE EDUCAÇÃO LTDA" in s)
ok("ressalva de não-garantia presente", "Não há garantia de aprovação" in s)
ok("número de alunos é o aprovado", "3.000+" in s and not re.search(r"5\.000\+?\s*(alunos|estudantes)", texto))
ok("cobertura escopada à disciplina (sem '% do edital' novo)",
   texto.count("% do edital") == (texto_antes.count("% do edital") if antes is not None else texto.count("% do edital")))
ok("sem urgência falsa", not re.search(r"(só hoje|últimas vagas|oferta expira|vagas restantes|contagem regressiva de oferta\b(?! \.))", texto, re.I)
   or "não tem contagem regressiva de oferta" in texto)
ok("'vitalício' só aparece negado (na seção 'o que não é')",
   texto.count("vitalício") == 1 and "Não é assinatura recorrente nem acesso vitalício" in texto)
ok("sem bordões proibidos", not re.search(r"Pensa comigo|Macete Fluência|Macete Vinícius", texto))
ok("Beta sinalizado nas três ferramentas do stack", stack.count('class="stack-beta">Beta') == 3)
ok("sem 'método Chaves' em texto novo",
   texto.count("método Chaves") == (texto_antes.count("método Chaves") if antes is not None else 1))
ok("questões: número lido do banco (3.800+)", "Mais de 3.800 questões" in s and "3.697" not in s)
ok("Ransley: aguarda convocação — sem 'nomeado'", not re.search(r"nomeado", texto, re.I))
ok("Ransley atribuído como aluno do professor", "aluno do professor" in texto)
ok("degrau não promete crédito na assinatura",
   not re.search(r"vira crédito|crédito na assinatura", s[s.index('class="section degrau-sec"'):s.index('id="proximas-provas"')]))

# ------------------------------------------ G. proximas provas
prov = s[s.index('id="proximas-provas"'):]
prov = prov[:prov.index("</section>")]
datas = re.findall(r'data-prova="([^"]+)"', prov)
def iso_ok(d):
    try:
        date.fromisoformat(d); return True
    except ValueError:
        return False
ok("toda data-prova é ISO válida", datas and all(iso_ok(d) for d in datas), str(datas))
ok("ao menos uma prova no futuro", any(iso_ok(d) and date.fromisoformat(d) > date.today() for d in datas))
ok("seção de provas nasce oculta (hidden)", 'id="proximas-provas" hidden' in s)
ok("todo item tem data-org e botão de escolha",
   prov.count("data-org=") == len(datas) == prov.count('class="prova-escolher"'))
ok("anatomia com 3 cards (mobile: custo antes da oferta)", s.count('class="anat-card') == 3)
ok("cards da oferta têm data-plano", 'data-plano="trimestral"' in s and 'data-plano="semestral"' in s)

# ------------------------------------------ H. slot de VSL
ok("slot de VSL: hidden <-> __PANDA_ID__", ('id="heroVsl" hidden' in s) == ("__PANDA_ID__" in s))
ok("iframe do VSL sem src no HTML (só data-src)", not re.search(r'id="heroVslFrame"[^>]*\ssrc=', s))
ok("slot fica dentro da hero e antes de O CURSO", s.index('id="heroVsl"') < i_curso and s.index('id="heroVsl"') > s.index('<section class="hero">'))

# ------------------------------------------ I. captura da Aula 01
ok("botão da Aula 01 marcado com data-fc-capture", 'data-fc-capture="aula01"' in s)
ok("modal de captura presente e oculto", 'id="fcCapOverlay" hidden' in s)
ok("origem assinatura_aula01 no POST", "'origem', 'assinatura_aula01'" in s)
ok("fallback sem cadastro aponta para o mesmo PDF",
   s.count('href="aulas/aula-01-partidas-dobradas.pdf?v=20260813"') == 2)
ok("email-capture.js continua NÃO carregado", not re.search(r'<(script|link)[^>]+email-capture', s))

# ---------------------------------------------- J. estrutura e EOL
def conta(t, tag):
    return len(re.findall(rf"<{tag}\b", t)), t.count(f"</{tag}>")
for tag in ("section", "div", "li", "ul", "ol", "p", "style", "script", "figure", "form"):
    a, f = conta(s, tag)
    if antes is not None:
        a0, f0 = conta(antes, tag)
        ok(f"<{tag}> balanceado por diferença", (a - a0) == (f - f0), f"antes {a0}/{f0}, depois {a}/{f}")
    else:
        ok(f"<{tag}> balanceado", a == f, f"{a}/{f}")
ok("chaves do CSS balanceadas em todo <style>",
   all(b.count("{") == b.count("}") for b in re.findall(r"<style>(.*?)</style>", s, flags=re.S)))
lf = len(re.findall(r"(?<!\r)\n", s))
ok("EOL CRLF sem LF solto", lf == 0, f"{lf} LF soltos")

# ------------------------------- K. nada perdido (comparacao por PALAVRA)
if antes is not None:
    def palavras(t):
        t = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", t, flags=re.S)
        t = re.sub(r"<[^>]+>", " ", t)
        t = unicodedata.normalize("NFD", t.lower())
        t = "".join(c for c in t if unicodedata.category(c) != "Mn")
        return set(re.sub(r"[^a-z0-9]+", " ", t).split())
    a, d = palavras(antes), palavras(s)
    faltam = sorted(a - d)
    ok("nenhuma palavra do texto original se perdeu", not faltam, f"{len(faltam)} faltando: {faltam[:12]}")
    print(f"  (comparação por palavra: {len(a)} distintas antes, {len(d)} depois)")

print(f"\nFISCAL DA LP DE ASSINATURA: {len(oks)} OK, {len(erros)} FALHAS\n")
for e in erros:
    print("  FALHA:", e)
sys.exit(1 if erros else 0)
