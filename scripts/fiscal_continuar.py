# -*- coding: utf-8 -*-
"""Fiscal da continuar.html, a página do comprador do Dicionário (15/09/2026).

A página abre por link com token pessoal (?c=). O token é credencial, então as regras
aqui protegem a URL antes do layout. Toda outra página do site tem GTM no <head>:
clonar o cabeçalho padrão para cá vazaria o token sem erro nenhum na tela. Por isso
a regra tem fiscal.

  1. noindex/nofollow e no-referrer, este antes de qualquer recurso;
  2. nenhum rastreador nem script externo (todo JS desta página é inline);
  3. nenhum endereço de checkout e nenhum preço fixo (os valores vêm só da API);
  3b. crédito dos order bumps: nada de valor fixo na tela, e composição só quando a
      conta fecha (soma dos itens = credito.total = abatimento da oferta);
  3c. "o que continua seu" montado a partir de credito.itens, com o texto padrão de
      quem levou só o Dicionário preservado no HTML;
  4. base da API por hostname, sem credentials, token fora da barra;
  5. atendimento só pelo número 1:1, nunca o de disparo em massa;
  6. marca e honestidade (sem border-left decorativo, sem bordão, rodapé jurídico);
  7. os seis estados da página existem;
  8. HTML balanceado;
  9. fora do sitemap e de qualquer link das outras páginas (só no modo repo).

Uso:
  PY="C:/Users/vfnev/AppData/Local/Programs/Python/Python314/python.exe"
  "$PY" scripts/fiscal_continuar.py             # continuar.html do repo
  "$PY" scripts/fiscal_continuar.py <arquivo>   # outro arquivo (ex.: baixado do preview)
Sai com código 1 se qualquer checagem reprovar.
"""
import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
externo = len(sys.argv) > 1
arq = Path(sys.argv[1]) if externo else RAIZ / "continuar.html"
html = arq.read_text(encoding="utf-8").replace("\r\n", "\n")

# Comentário é guia de manutenção: neutralizado (não removido) para as posições baterem.
limpo = re.sub(r"<!--.*?-->", lambda m: re.sub(r"[^\n]", " ", m.group(0)), html, flags=re.S)
visivel = re.sub(r"<(script|style)\b[^>]*>.*?</\1>", " ", limpo, flags=re.S)
visivel = re.sub(r"<[^>]+>", " ", visivel)
falhas, ok = [], 0


def check(cond, msg):
    global ok
    if cond:
        ok += 1
    else:
        falhas.append(msg)


# ── 1. Índice e referrer ─────────────────────────────────────────────────
check('<meta name="robots" content="noindex, nofollow">' in limpo, "sem <meta robots noindex, nofollow>")
ref = limpo.find('<meta name="referrer" content="no-referrer">')
recursos = [m.start() for m in re.finditer(r"<(link|script|img|picture|source|iframe)\b", limpo)]
check(ref >= 0, "sem <meta referrer no-referrer>")
check(ref >= 0 and (not recursos or ref < min(recursos)), "no-referrer tem de vir antes do primeiro recurso")

# ── 2. Nada que leia a URL ───────────────────────────────────────────────
baixo = limpo.lower()
for proibido in ("googletagmanager", "gtag(", "fbq(", "facebook.net", "google-analytics", "datalayer",
                 "email-capture", "origem.js", "clarity.ms", "hotjar", "tiktok"):
    check(proibido not in baixo, f"rastreador ou script proibido: {proibido}")
check(not re.search(r"<script\b[^>]*\bsrc\s*=", limpo, re.I), "script externo: todo JS desta página é inline")
externos = re.findall(r'<(?:link|img|source|iframe)\b[^>]*(?:href|src|srcset)="(https?://[^"]+)"', limpo)
check(all(u.startswith(("https://fonts.googleapis.com", "https://fonts.gstatic.com")) for u in externos),
      f"recurso externo fora das fontes: {externos}")

# ── 3. Checkout e preço ──────────────────────────────────────────────────
check("kiwify" not in html.lower(), "endereço do checkout no HTML (o clique tem de passar pela API)")
check("/checkout?plano=" in limpo, "botão de compra não passa por /continuar/:token/checkout")
check(not re.search(r"R\$\s*(?:&nbsp;)?\s*\d", limpo), "preço fixo no HTML: os valores vêm só da API")
check(not re.search(r"\b\d{1,3},\d{2}\b", visivel), "valor com centavos fixo no texto")
check("124100" in limpo, "fator da parcela (24,1%, o mesmo da assinatura.html) não encontrado")

# ── 3b. Crédito somado dos order bumps ───────────────────────────────────
# Quem compra o Dicionário (47) pode levar o Guia (27) e o Simulado (19) no mesmo
# checkout: o crédito é 47, 66, 74 ou 93. Nenhum desses totais pode estar escrito na
# página — o número é o abatimento da própria oferta. O texto visível já sai sem
# <style> e sem <script>, então o rgba(27,42,74,…) do CSS não conta como valor.
check(not re.search(r"\b(?:47|66|74|93)\b", visivel), "valor de crédito fixo no texto da página")
check("function lerCredito" in limpo and "d.credito" in limpo, "a página não lê «credito» da resposta da API")
check("tri.de - tri.por" in limpo and "reais(creditoTri)" in limpo,
      "o crédito exibido não é derivado da oferta (de − por)")
check("creditoTri === creditoSem" in limpo, "abatimento não conferido nos dois planos")
# A composição só aparece quando a conta fecha dos dois lados, e com mais de um item.
check("c.total !== derivado" in limpo, "credito.total não é conferido contra o abatimento da oferta")
check("soma === c.total" in limpo, "a soma dos itens não é conferida contra credito.total")
check("itens.length > 1" in limpo, "a composição do crédito não exige mais de um item")
comp = re.search(r'<p[^>]*id="creditoItens"[^>]*>', limpo)
check(bool(comp) and "hidden" in comp.group(0), "linha da composição ausente ou não nasce oculta")
check("linha.textContent" in limpo and "linha.innerHTML" not in limpo,
      "composição por innerHTML: o nome do item vem da API e tem de entrar como texto")

# ── 3c. "O que continua seu" montado a partir de credito.itens ───────────
# Quem levou o Guia ou o Simulado vê os dois nomeados nessa seção — mas o nome vem da
# API, nunca do HTML, e a frase de quem levou só o Dicionário fica exatamente como era.
check(not re.search(r"Guia de Lançamentos|Simulado Fluência", limpo, re.I),
      "nome de order bump escrito na página: ele vem da API")
# Casa o ELEMENTO, não a string solta: o querySelector do JS repete o mesmo texto e
# deixaria passar um atributo renomeado no HTML.
check(bool(re.search(r"<h2[^>]*data-campo-fica=\"titulo\"", limpo))
      and bool(re.search(r"<p[^>]*data-campo-fica=\"texto\"", limpo)),
      "seção «o que continua seu» sem os campos de texto no HTML")
check("O Dicionário continua seu" in visivel and "125 páginas e mais de 400 verbetes" in visivel,
      "texto padrão da seção «o que continua seu» (um item só) ausente")
# A declaração «function renderFica(itens)» contém a mesma string da chamada: a regra
# tem de casar a CHAMADA, numa linha própria, senão apagá-la passa batido — foi o que
# a prova por mutação pegou.
check("function renderFica" in limpo and bool(re.search(r"^\s*renderFica\(itens\);", limpo, re.M)),
      "a seção «o que continua seu» não é montada a partir dos itens do crédito")
check("ficaPadrao" in limpo, "o texto padrão da seção não é preservado para o caso de um item só")
check("ficaTitulo.textContent" in limpo and "ficaTexto.textContent" in limpo,
      "os textos da seção «o que continua seu» não entram como texto")
check("ficaTitulo.innerHTML" not in limpo and "ficaTexto.innerHTML" not in limpo,
      "seção «o que continua seu» por innerHTML: o nome do item vem da API")
# A frase de quem levou order bump não pode prometer UM e-mail: o Dicionário é entregue
# por e-mail da plataforma e os bumps por e-mail da própria Kiwify — remetentes
# diferentes. O texto padrão (um item só) segue podendo falar do e-mail da compra,
# porque ali é um só mesmo.
frase = re.search(r"ficaTexto\.textContent = 'O que você levou na compra.*?';", limpo, re.S)
check(bool(frase) and "e-mail que você recebeu" not in frase.group(0),
      "a frase com order bump promete um único e-mail (as entregas vêm de remetentes diferentes)")

# ── 4. API e token ───────────────────────────────────────────────────────
check("'https://api.fluenciacontabil.com.br'" in limpo and "'https://api-dev.fluenciacontabil.com.br'" in limpo,
      "base da API decidida por hostname (produção × staging)")
check(not re.search(r"credentials\s*:\s*['\"]include", limpo), "fetch com credentials")
check("history.replaceState" in limpo and "sessionStorage" in limpo, "token não sai da barra ou não sobrevive a reload")
check("t.length >= 20 && t.length <= 200" in limpo, "validação do tamanho do token (20–200) antes de chamar a API")

# ── 5. Atendimento ───────────────────────────────────────────────────────
check("wa.me/5521959042832" in limpo, "WhatsApp de atendimento ausente")
check(not re.search(r"5239.?9211|1152399211", html), "número de disparo em massa na página")

# ── 6. Marca e honestidade ───────────────────────────────────────────────
check(not re.search(r"border-left\s*:", limpo, re.I), "border-left (sidebar colorida decorativa)")
check(not re.search(r"Pensa comigo|Macete Fluência|Macete Vinícius", visivel), "bordão proibido")
check(not re.search("[\U0001F300-\U0001FAFF]", visivel), "emoji no texto")
check(not re.search(r"5\.000", visivel), "número de alunos: o aprovado é 3.000+")
check("55.373.571/0001-63" in limpo and "Não há garantia de aprovação" in limpo, "rodapé jurídico ausente")

# ── 7. Estados ───────────────────────────────────────────────────────────
for estado in ("carregando", "aberta", "expirada", "ja_assinante", "publica", "falha"):
    check(f'data-estado="{estado}"' in limpo, f"estado «{estado}» sem bloco na página")
check('id="proximas-provas"' in limpo and "data-prova=" in limpo, "seletor de próxima prova ausente")
check("portal.fluenciacontabil.com.br/login" in limpo, "já assinante sem link para o login")

# ── 8. HTML são ──────────────────────────────────────────────────────────
for tag in ("section", "div", "p", "ul", "li", "a", "style", "script"):
    abre, fecha = len(re.findall(rf"<{tag}\b", limpo)), limpo.count(f"</{tag}>")
    check(abre == fecha, f"<{tag}> desbalanceado: {abre}/{fecha}")
check(all(b.count("{") == b.count("}") for b in re.findall(r"<style>(.*?)</style>", limpo, flags=re.S)),
      "chaves do CSS desbalanceadas")

# ── 9. Fora do sitemap e do menu ─────────────────────────────────────────
if not externo:
    check("continuar" not in (RAIZ / "sitemap.xml").read_text(encoding="utf-8"), "continuar.html no sitemap.xml")
    linkam = sorted(p.relative_to(RAIZ).as_posix() for p in RAIZ.rglob("*.html")
                    if p.name != "continuar.html" and "continuar.html" in p.read_text(encoding="utf-8", errors="replace"))
    check(not linkam, f"outras páginas linkam para continuar.html: {linkam}")

print(f"fiscal_continuar: {ok} ok, {len(falhas)} falhas — {arq.name}")
for f in falhas:
    print("  ✗", f)
sys.exit(1 if falhas else 0)
