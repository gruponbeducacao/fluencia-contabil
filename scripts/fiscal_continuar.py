# -*- coding: utf-8 -*-
"""Fiscal da continuar.html, a página do comprador do Dicionário (15/09/2026).

A página abre por link com token pessoal (?c=). O token é credencial, então as regras
aqui protegem a URL antes do layout. Toda outra página do site tem GTM no <head>:
clonar o cabeçalho padrão para cá vazaria o token sem erro nenhum na tela. Por isso
a regra tem fiscal.

  1. noindex/nofollow e no-referrer, este antes de qualquer recurso;
  2. nenhum rastreador nem script externo (todo JS desta página é inline); nada de
     import(), eval, new Function, Worker ou document.write; nada de estilo inline ou
     por JS (.style.display, className, atributo class) que desfaça a trava;
  2b. vídeo (29/09/2026): só o player do Panda da nossa biblioteca, nascendo sem src,
      oculto e só no estado «aberta», com referrer só de origem; as duas únicas exceções
      de script são o assets/vsl-overlay.js e o assets/vsl-trava.js, injetados dentro de
      iniciarVsl() (depois de mostrar('aberta')), o overlay escrito antes — sem promessa
      de ordem de execução: são assíncronos e independentes —, cada um com o caminho
      exato e ?v=AAAAMMDD[letra]; createElement('script') contado sem diferenciar
      maiúsculas, e o único setAttribute('src') é o do iframe; o overlay é auditado aqui
      (sem rede, sem storage, sem dataLayer);
  2c. trava no vídeo (30/09/2026, para todos os compradores): o assets/vsl-trava.js tem
      auditoria PRÓPRIA — sem rede (nem postMessage ao player de terceiro) e com
      localStorage/sessionStorage só em chaves provadamente fc_vsl_ (toda chave nasce de
      um literal 'fc_vsl_…' declarado uma vez, direto ou pelo parâmetro de um embrulho
      cujas chamadas todas passam essas chaves: ler o fc_continuar_c do token reprova) e
      com valor gravado literal ou numérico; sem ler a página além do slot, do player e
      do aviso (nada de .href, document.URL, querySelector fora de [data-vsl-trava-…]: o
      href dos botões de compra carrega o token). O dataLayer é permitido nesse arquivo
      porque esta página não carrega GTM (o item 2 proíbe googletagmanager, gtag e
      dataLayer no HTML): o que ele empurra fica só na memória da aba. Ler location.search
      também (é o ?semtrava=1, e sem rede não sai daqui). Na página: #heroVsl com
      data-vsl-trava numérico em (0, duração] e data-vsl-version própria (a chave de
      "liberado" não é a da assinatura), aviso #vslTrava oculto dentro do slot, CSS da
      trava escondendo tudo de <main> fora o vídeo e o atendimento (planos inclusive; o
      atendimento, como o WhatsApp flutuante da assinatura, fica e só pode ter o WhatsApp
      1:1), os botões de compra, os links para os planos e o rodapé. O CSS é lido
      inteiro, @media inclusive: sob a trava só «display: none !important» ou o arranjo do
      palco (flex/min-height/fundo/padding/moldura) — nada que mostre de volta o que ela
      esconde nem que some com o palco (topo, h1, [data-campo], crédito, prazo, vídeo,
      aviso, atendimento) —, e fora dela nenhum display !important que não seja none. O
      palco não tem controle de oferta (só o WhatsApp 1:1). Aviso só na pausa. Pré-trava
      que devolve a página se o arquivo não travar (falha aberta), com prazo entre 5 e
      15 s, marcando FC_VSL_TRAVA ao desistir (arquivo atrasado não tranca de novo), e só
      depois de o vídeo estar ligado (depois dos return do vídeo desligado);
  3. nenhum endereço de checkout, nenhum preço fixo (os valores vêm só da API) e nada
     do nosso vocabulário interno no arquivo servido (nome do gateway, "bump");
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
Sai com código 1 se qualquer checagem reprovar. Roda no CI (.github/workflows/origem.yml),
com o python3 do ubuntu-latest: só biblioteca padrão, sem rede, só arquivos do repo.
"""
import os
import re
import sys
from html.parser import HTMLParser
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
PANDA = "https://player-vz-7867cfdb-be1.tv.pandavideo.com.br/embed/?v="
check(all(u.startswith(("https://fonts.googleapis.com", "https://fonts.gstatic.com", PANDA)) for u in externos),
      f"recurso externo fora das fontes e do player do Panda: {externos}")

# ── 2b. Vídeo ────────────────────────────────────────────────────────────
# O player é o único recurso de terceiro fora das fontes. Ele nasce sem requisição (data-src,
# nunca src), dentro de um slot oculto que só o estado «aberta» mostra — o vídeo fala do
# cashback, promessa que não vale nos outros estados — e manda ao Panda só a origem.
slot = re.search(r'<section\b[^>]*\bid="heroVsl"[^>]*>', limpo)
check(bool(slot) and 'data-estado="aberta"' in slot.group(0) and re.search(r"\shidden\b", slot.group(0)),
      "slot do vídeo sem data-estado=\"aberta\" ou sem nascer oculto")
iframes = re.findall(r"<iframe\b[^>]*>", limpo)
check(len(iframes) <= 1, f"mais de um iframe na página: {len(iframes)}")
for tag in iframes:
    check(not re.search(r"\ssrc\s*=", tag), "iframe com src no HTML: tem de nascer com data-src (sem requisição)")
    check(f'data-src="{PANDA}' in tag, "iframe fora do player do Panda da nossa biblioteca")
    check('referrerpolicy="origin"' in tag, "iframe sem referrerpolicy=\"origin\" (o Panda recebe só o domínio)")
    check("autoplay=" not in tag, "vídeo com autoplay na URL")
if iframes:
    # A CHAMADA, logo depois de mostrar('aberta'), numa linha própria — a declaração
    # «function iniciarVsl()» contém a mesma string.
    check(bool(re.search(r"^\s*mostrar\('aberta'\);\s*\n\s*iniciarVsl\(\);", limpo, re.M)),
          "o player não é ligado logo depois de mostrar('aberta')")
    check("indexOf('__PANDA_ID__') !== -1) { slot.hidden = true;" in limpo,
          "slot com id __PANDA_ID__ não fica oculto")
    check("'[data-estado]:not(.vsl-ov)'" in limpo, "mostrar() mexe no overlay do vídeo (data-estado do player)")
# Exceções de script: o overlay e a trava da assinatura, injetados pelo JS (não como <script>
# no HTML), dentro de iniciarVsl() — que só roda depois de mostrar('aberta'). A regra exige o
# overlay escrito antes da trava no código, mas não promete ordem de execução: scripts
# injetados são assíncronos, e os dois são independentes. Cada um com o caminho exato e
# ?v=AAAAMMDD[letra]; nenhum outro .src nem setAttribute('src') em lugar nenhum (o do iframe
# é o único, a partir do data-src).


def sem_comentarios_js(texto):
    texto = re.sub(r"/\*.*?\*/", lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto, flags=re.S)
    return re.sub(r"(^|\s)//.*$", r"\1", texto, flags=re.M)


js = sem_comentarios_js("\n".join(re.findall(r"<script\b[^>]*>(.*?)</script>", limpo, flags=re.S)))
# Carregar código por outro caminho que não o <script> injetado e auditado.
for rx, oque in ((r"\bimport\s*\(", "import() dinâmico"), (r"\beval\s*\(", "eval"), (r"\bnew\s+Function\b", "new Function"),
                 (r"\b(?:Shared)?Worker\s*\(", "Worker"), (r"document\.write", "document.write")):
    check(not re.search(rx, js), f"{oque} no JS da página: todo código daqui é inline ou um dos dois arquivos auditados")
# Desfazer a trava pelo estilo: estilo inline e mexidas de estilo por JS que sobrepõem a regra.
check(not re.search(r"\sstyle\s*=\s*\"[^\"]*(?:display|visibility|opacity|!important)", limpo, re.I),
      "estilo inline com display/visibility/opacity/!important: sobrepõe o CSS da trava")
check(not re.search(r"\.style\.(?:display|visibility|opacity|cssText|setProperty|height|maxHeight)\b", js),
      "JS mexe em display/visibility/opacity/altura por .style: sobrepõe o CSS da trava")
check(not re.search(r"\.className\s*=(?!=)|(?:set|remove|toggle)Attribute\(\s*['\"]class['\"]", js),
      "JS reescreve o atributo class: a classe da trava só entra e sai por classList")
INJETAVEIS = {"overlay": r"'assets/vsl-overlay\.js\?v=\d{8}[a-z]?'",
              "trava": r"'assets/vsl-trava\.js\?v=\d{8}[a-z]?'"}
injetados = re.findall(r"createElement\(\s*['\"]script['\"]\s*\)", limpo, re.I)
check(len(injetados) <= 2, f"mais de dois scripts injetados (só o overlay e a trava): {len(injetados)}")
declarados = re.findall(r"\bvar\s+([\w$]+)\s*=\s*document\.createElement\(\s*'script'\s*\);", js)
check(len(declarados) == len(injetados), "script injetado fora do padrão «var x = document.createElement('script');»")
fontes = {}  # overlay/trava -> nome da variável
for nome in declarados:
    srcs = [s.strip() for s in re.findall(rf"(?<![\w$.]){re.escape(nome)}\.src\s*=(?!=)\s*([^;\n]*);", js)]
    qual = next((k for k, rx in INJETAVEIS.items() if len(srcs) == 1 and re.fullmatch(rx, srcs[0])), None)
    check(qual is not None and not re.search(rf"(?<![\w$.]){re.escape(nome)}\.setAttribute\(", js),
          f"script injetado «{nome}» não é o overlay nem a trava (caminho exato, ?v=AAAAMMDD[letra], um .src literal): {srcs}")
    if qual:
        check(qual not in fontes, f"assets/vsl-{qual}.js injetado duas vezes")
        fontes.setdefault(qual, nome)
check(len(re.findall(r"\.src\s*=(?!=)", js)) == len(declarados),
      ".src atribuído fora dos scripts injetados (o iframe usa setAttribute a partir do data-src)")
m_corpo = re.search(r"function iniciarVsl\(\)\s*\{(.*?)\n  \}\n", js, re.S)
corpo = m_corpo.group(1) if m_corpo else ""
check(len(re.findall(r"createElement\(\s*['\"]script['\"]\s*\)", corpo, re.I)) == len(injetados),
      "script injetado fora de iniciarVsl() (tem de ser depois de mostrar('aberta'), com o slot visível)")
check(len(re.findall(r"setAttribute\(\s*['\"]src(?:set)?['\"]", js, re.I)) == 1
      and bool(re.search(r"(?<![\w$.])f\.setAttribute\('src', src\);", corpo))
      and "f = document.getElementById('heroVslFrame');" in corpo,
      "setAttribute('src') fora do único permitido: o do iframe do player, a partir do data-src, em iniciarVsl()")
if iframes:
    check(set(fontes) == {"overlay", "trava"}, f"com o vídeo no ar, a página injeta o overlay e a trava: {sorted(fontes)}")
if set(fontes) == {"overlay", "trava"}:
    pos = {k: re.search(rf"(?<![\w$.]){re.escape(v)}\.src\s*=", corpo) for k, v in fontes.items()}
    check(all(pos.values()) and pos["overlay"].start() < pos["trava"].start(), "a trava é injetada antes do overlay")
if injetados:
    # O arquivo é compartilhado com a assinatura.html: se um dia ganhar rede, storage ou
    # dataLayer, esta página passaria a expor o token. Comentários fora, código auditado.
    overlay = Path(os.environ.get("FISCAL_VSL_OVERLAY", RAIZ / "assets" / "vsl-overlay.js"))
    codigo = re.sub(r"/\*.*?\*/", " ", overlay.read_text(encoding="utf-8"), flags=re.S)
    codigo = re.sub(r"(^|\s)//.*$", " ", codigo, flags=re.M)
    for proibido in ("fetch(", "XMLHttpRequest", "sendBeacon", "sessionStorage", "localStorage", "dataLayer",
                     "document.cookie", "location.search", "new Image", "import(", "createElement", "WebSocket"):
        check(proibido not in codigo, f"assets/vsl-overlay.js passou a usar {proibido}: a continuar não pode carregá-lo")

# ── 2c. Trava no vídeo (assets/vsl-trava.js) ─────────────────────────────
# Decisão do Vinícius (30/09/2026): trava para TODOS os compradores; a oferta só aparece
# depois de a pessoa assistir até o pitch. O componente é o da assinatura.html, e o
# arquivo é auditado por conta própria — regras diferentes das do overlay:
#  - rede: nada. Nem postMessage (o player é de terceiro), nem navegar, nem criar
#    elemento que faça requisição;
#  - storage: permitido, mas SÓ em chaves fc_vsl_. A prova é estática: toda chave de
#    getItem/setItem/removeItem é um literal 'fc_vsl_…', uma variável declarada uma única
#    vez a partir de um literal 'fc_vsl_…' (chaveLiberada, chaveTempo), ou o parâmetro de
#    um embrulho (ler/gravar) cujas chamadas TODAS passam uma dessas. Nenhum outro acesso
#    a localStorage/sessionStorage/window[…]. Ler o fc_continuar_c (o token) reprova;
#  - dataLayer: permitido. Esta página não carrega GTM — o item 2 proíbe googletagmanager,
#    gtag e dataLayer no próprio HTML —, então o que o arquivo empurra fica na memória da
#    aba e não sai dela. location.search também: é o ?semtrava=1, e sem rede não vai longe.


def args_de(codigo, i):
    """Argumentos (texto) da chamada cujo '(' termina em codigo[i]; None se não fechar."""
    args, prof, ini, j, aspas = [], 0, i, i, None
    while j < len(codigo):
        c = codigo[j]
        if aspas:
            if c == "\\":
                j += 2
                continue
            if c == aspas:
                aspas = None
        elif c in "'\"`":
            aspas = c
        elif c in "([{":
            prof += 1
        elif c in ")]}":
            if prof == 0:
                args.append(codigo[ini:j].strip())
                return [] if args == [""] else args
            prof -= 1
        elif c == "," and prof == 0:
            args.append(codigo[ini:j].strip())
            ini = j + 1
        j += 1
    return None


def auditar_storage(codigo):
    """Falhas de storage no vsl-trava.js: toda chave tem de ser provadamente fc_vsl_."""
    falhas = []
    literal_ok = re.compile(r"'fc_vsl_[^'\\]*'")
    chaves = set()
    for m in re.finditer(r"\b(?:var|let|const)\s+([\w$]+)\s*=\s*('[^'\\]*')\s*(?:\+[^;,]*)?;", codigo):
        atribuicoes = re.findall(rf"(?<![\w$.]){re.escape(m.group(1))}\s*(?:=(?!=)|\+=|\+\+|--)", codigo)
        if literal_ok.fullmatch(m.group(2)) and len(atribuicoes) == 1:
            chaves.add(m.group(1))

    def chave_ok(expr):
        return bool(literal_ok.fullmatch(expr)) or expr in chaves

    def armazem_ok(expr):
        return expr in ("'localStorage'", "'sessionStorage'")

    def funcao_de(pos):
        defs = [m for m in re.finditer(r"\bfunction\s+([\w$]+)\s*\(([^)]*)\)", codigo) if m.start() < pos]
        if not defs:
            return None, []
        return defs[-1].group(1), [p.strip() for p in defs[-1].group(2).split(",") if p.strip()]

    def chamadas(nome):
        """Argumentos de cada chamada de nome(); None se o nome é usado de outro jeito (alias)."""
        lista = []
        for m in re.finditer(rf"(?<![\w$.]){re.escape(nome)}\b", codigo):
            if re.search(r"\bfunction\s+$", codigo[max(0, m.start() - 20):m.start()]):
                continue
            abre = re.match(r"\s*\(", codigo[m.end():])
            args = args_de(codigo, m.end() + abre.end()) if abre else None
            if args is None:
                return None
            lista.append(args)
        return lista

    def resolve(expr, pos, valida):
        if valida(expr):
            return True
        if not re.fullmatch(r"[\w$]+", expr):
            return False
        nome, params = funcao_de(pos)
        if not nome or expr not in params:
            return False
        k, lista = params.index(expr), chamadas(nome)
        return bool(lista) and all(len(a) > k and valida(a[k]) for a in lista)

    def valor_ok(expr):
        # O que se grava é um literal, um número ou String(Math.round(x)): nada de texto
        # tirado da página (o href do botão de compra leva o token).
        return bool(re.fullmatch(r"'[^'\\]*'|\d+(?:\.\d+)?|String\(Math\.round\([\w$]+\)\)", expr))

    usos = 0
    for m in re.finditer(r"\.\s*(getItem|setItem|removeItem)\s*\(", codigo):
        usos += 1
        args = args_de(codigo, m.end())
        if not args or not resolve(args[0], m.start(), chave_ok):
            falhas.append(f"{m.group(1)}({args[0] if args else '?'}) com chave que não é provadamente fc_vsl_")
        if m.group(1) == "setItem" and (not args or len(args) < 2 or not resolve(args[1], m.start(), valor_ok)):
            falhas.append(f"setItem com valor que não é literal nem número: {args[1] if args and len(args) > 1 else '?'}")
    sem_literal = re.sub(r"'(?:localStorage|sessionStorage)'", "''", codigo)
    for m in re.finditer(r"\b(localStorage|sessionStorage)\b", sem_literal):
        if not re.match(r"\s*\.\s*(?:getItem|setItem|removeItem)\s*\(", sem_literal[m.end():]):
            falhas.append(f"{m.group(1)} usado fora de getItem/setItem/removeItem")
    for m in re.finditer(r"\b(?:window|self|globalThis|top|parent|frames)\s*\[", codigo):
        alvo = re.match(r"\s*([\w$]+)\s*\]\s*\.\s*(?:getItem|setItem|removeItem)\s*\(", codigo[m.end():])
        if not alvo or not resolve(alvo.group(1), m.start(), armazem_ok):
            falhas.append("window[…] que não é localStorage/sessionStorage com getItem/setItem/removeItem")
    if re.search(r"\bStorage\b", codigo):
        falhas.append("Storage (protótipo) usado direto")
    if not usos:
        falhas.append("nenhum getItem/setItem: a auditoria de storage não achou o que auditar")
    return falhas


class Arvore(HTMLParser):
    """Cada elemento com os ancestrais (tag, atributos), e os filhos diretos de <main>."""
    VAZIOS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.pilha, self.elementos, self.filhos_main = [], [], []

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if self.pilha and self.pilha[-1][0] == "main":
            self.filhos_main.append((tag, a))
        self.elementos.append((tag, a, list(self.pilha)))
        if tag not in self.VAZIOS:
            self.pilha.append((tag, a))

    def handle_startendtag(self, tag, attrs):
        self.elementos.append((tag, dict(attrs), list(self.pilha)))

    def handle_endtag(self, tag):
        for i in range(len(self.pilha) - 1, -1, -1):
            if self.pilha[i][0] == tag:
                del self.pilha[i:]
                break


def ids(ancestrais):
    return [a.get("id") for _, a in ancestrais]


def classes(a):
    return set((a.get("class") or "").split())


def regras_css(css, contexto=""):
    """(seletores normalizados, declarações sem espaço, contexto @) de TODAS as regras de
    seletor, inclusive as de dentro de @media/@supports/@container/@layer — a trava pode ser
    desfeita (ou o palco escondido) só no celular. @keyframes e @font-face ficam de fora. CSS
    aninhado sai com o seletor '<aninhado>': o fiscal não sabe auditar e reprova."""
    css = re.sub(r"/\*.*?\*/", " ", css, flags=re.S)
    regras, i = [], 0
    while True:
        abre = css.find("{", i)
        if abre < 0:
            break
        prof, j = 1, abre + 1
        while prof and j < len(css):
            prof += {"{": 1, "}": -1}.get(css[j], 0)
            j += 1
        cabeca, corpo_css = css[i:abre].split(";")[-1].strip(), css[abre + 1:j - 1]
        i = j
        if cabeca.startswith("@"):
            if re.match(r"@(?:media|supports|container|layer|document)\b", cabeca, re.I):
                regras += regras_css(corpo_css, (contexto + " " + re.sub(r"\s+", " ", cabeca)).strip())
            continue
        seletores = [re.sub(r"\s*([>~+])\s*", r" \1 ", re.sub(r"\s+", " ", s)).strip() for s in cabeca.split(",")]
        regras.append((["<aninhado>"] if "{" in corpo_css else seletores, re.sub(r"\s+", "", corpo_css), contexto))
    return regras


def declaracoes(dec):
    return [tuple(d.split(":", 1)) for d in dec.split(";") if ":" in d]


if iframes:
    tag_slot = slot.group(0) if slot else ""

    def attr(nome):
        m = re.search(rf'\s{nome}="([^"]*)"', tag_slot)
        return m.group(1) if m else ""

    trava_s, dur_s, versao = attr("data-vsl-trava"), attr("data-vsl-duration"), attr("data-vsl-version")
    num = re.fullmatch(r"\d+(?:\.\d+)?", trava_s) and re.fullmatch(r"\d+(?:\.\d+)?", dur_s)
    check(bool(num) and 0 < float(trava_s) <= float(dur_s),
          f"#heroVsl sem data-vsl-trava numérico em (0, data-vsl-duration]: trava={trava_s!r} duração={dur_s!r}")
    check(bool(re.fullmatch(r"[\w.-]+", versao)),
          "#heroVsl sem data-vsl-version: sem ela o vsl-trava.js não trava (e a chave de «liberado» fica sem nome)")
    assinatura = RAIZ / "assinatura.html"
    if assinatura.exists():
        txt_ass = assinatura.read_text(encoding="utf-8")
        v_ass = re.search(r'<[^>]*\bid="heroVsl"[^>]*\bdata-vsl-version="([^"]*)"', txt_ass)
        check(not v_ass or v_ass.group(1) != versao,
              "data-vsl-version igual à da assinatura.html: liberar uma página liberaria a outra")
        c_ass = re.search(r"assets/vsl-trava\.js\?v=(\w+)", txt_ass)
        c_cont = re.search(r"assets/vsl-trava\.js\?v=(\w+)", js)
        check(not c_ass or (c_cont and c_ass.group(1) == c_cont.group(1)),
              "assets/vsl-trava.js com ?v= diferente do da assinatura.html (o arquivo é um só)")

    arvore = Arvore()
    arvore.feed(limpo)
    avisos = [(a, anc) for t, a, anc in arvore.elementos if a.get("id") == "vslTrava"]
    check(len(avisos) == 1 and "hidden" in avisos[0][0] and "heroVsl" in ids(avisos[0][1]),
          "aviso #vslTrava ausente, fora do slot do vídeo ou sem nascer hidden")
    for marca in ("data-vsl-trava-txt", "data-vsl-trava-barra"):
        check(any(marca in a and "vslTrava" in ids(anc) for _, a, anc in arvore.elementos),
              f"aviso #vslTrava sem [{marca}]")
    # O que fica visível na trava (o topo do estado «aberta», o slot do vídeo e o atendimento)
    # não tem controle de oferta: todo link/botão ali é o WhatsApp 1:1 ou algo que a trava
    # esconde por regra própria (compra, link para #planos, CTAs do vídeo).
    ESCONDIDOS_NA_TRAVA = {"vsl-cta", "vsl-ov-link", "vsl-ov-cta"}

    def no_palco(anc):
        topo_aberta = any(t == "header" for t, _ in anc) and any(x.get("data-estado") == "aberta" for _, x in anc)
        return topo_aberta or "heroVsl" in ids(anc) or any("ajuda-sec" in classes(x) for _, x in anc)

    def escondido_na_trava(tag, a, anc):
        return any(classes(x) & ESCONDIDOS_NA_TRAVA or "data-checkout" in x or (t == "a" and x.get("href") == "#planos")
                   for t, x in [(tag, a)] + list(anc))

    soltos = [f"<{t} {a.get('href') or a.get('class') or ''}>" for t, a, anc in arvore.elementos
              if t in ("a", "button", "form", "input", "select", "textarea", "iframe", "object", "embed") and no_palco(anc)
              and not (t == "iframe" and a.get("id") == "heroVslFrame")
              and not (t == "a" and (a.get("href") or "").startswith("https://wa.me/5521959042832"))
              and not escondido_na_trava(t, a, anc)]
    check(not soltos, f"controle visível na trava que não é o WhatsApp 1:1 (o palco não tem link de oferta): {soltos}")
    # Tudo o que é filho direto de <main> é <section>: a regra genérica da trava esconde
    # cada um, #planos inclusive, e só o vídeo fica.
    filhos = arvore.filhos_main
    check(bool(filhos) and all(t == "section" for t, _ in filhos),
          f"filho de <main> que não é <section> escapa da trava: {[t for t, _ in filhos if t != 'section']}")
    check(any(a.get("id") == "planos" for _, a in filhos) and any(a.get("id") == "heroVsl" for _, a in filhos),
          "#planos e #heroVsl têm de ser seções filhas diretas de <main> (é o que a trava esconde / preserva)")

    regras = [r for bloco in re.findall(r"<style\b[^>]*>(.*?)</style>", limpo, flags=re.S) for r in regras_css(bloco)]
    # As exigidas valem no nível de cima (dentro de um @media valeriam só às vezes).
    escondidos = {s for sels, dec, ctx in regras if not ctx and dec.rstrip(";") == "display:none!important" for s in sels}
    # A única seção de <main> que fica além do vídeo é o atendimento (como o WhatsApp
    # flutuante da assinatura): só com o link do WhatsApp 1:1, nada de compra nem de plano.
    ajuda = re.findall(r'<section\b[^>]*\bclass="ajuda-sec"[^>]*>(.*?)</section>', limpo, flags=re.S)
    links_ajuda = re.findall(r'<a\b[^>]*\bhref="([^"]*)"', ajuda[0]) if len(ajuda) == 1 else []
    check(len(ajuda) == 1 and links_ajuda and all(h.startswith("https://wa.me/5521959042832") for h in links_ajuda)
          and "data-checkout" not in ajuda[0],
          "a seção de atendimento, que fica visível na trava, tem de ter só o WhatsApp 1:1")
    EXIGIDOS = {
        "html.vsl-trava main > section:not(#heroVsl):not(.ajuda-sec)":
            "as seções de <main> fora o vídeo e o atendimento (planos inclusive)",
        "html.vsl-trava main ~ section": "seção depois de <main>",
        "html.vsl-trava main ~ footer": "o rodapé",
        "html.vsl-trava [data-checkout]": "os botões de compra",
        'html.vsl-trava a[href="#planos"]': "os links para os planos",
        "html.vsl-trava .vsl-cta": "o «Ver os dois planos» debaixo do vídeo",
        "html.vsl-trava .vsl-ov-link": "o link do overlay para os planos",
        "html.vsl-trava .vsl-ov-cta": "o botão do overlay no fim do vídeo",
    }
    for sel, oque in EXIGIDOS.items():
        check(sel in escondidos, f"a trava não esconde {oque}: falta «{sel} {{ display: none !important }}»")
    # Toda regra que depende da classe da trava — em qualquer @media — começa por
    # «html.vsl-trava » e só faz duas coisas: ESCONDER (display: none !important) ou arrumar o
    # palco (o flex/min-height/fundo do body, padding, fundo e a moldura). Nada que mostre de
    # volta o que a trava esconde (display: block em #planos ou num botão de compra), nem
    # opacity/altura/visibility que sumam com o vídeo por outro caminho.
    TRAVA_CLASSE = re.compile(r"\.vsl-trava(?![\w-])|\[class\b")
    MOLDURA = re.compile(r"min\(\d{3,4}px,(?:max\(\d{3,4}px,)?calc\(\(100s?vh-\d{1,3}px\)\*16/9\)\)?\)")
    PERMITIDO = {
        "display": lambda s, v: v == "none!important" or (s == "html.vsl-trava body" and v == "flex"),
        "min-height": lambda s, v: s == "html.vsl-trava body" and v in ("100vh", "100svh"),
        "flex-direction": lambda s, v: s == "html.vsl-trava body" and v == "column",
        "justify-content": lambda s, v: s == "html.vsl-trava body",
        "background": lambda s, v: True,
        "background-color": lambda s, v: True,
        "padding": lambda s, v: "-" not in v, "padding-top": lambda s, v: "-" not in v,
        "padding-bottom": lambda s, v: "-" not in v,
        "max-width": lambda s, v: bool(MOLDURA.fullmatch(v)),
    }
    # O palco nunca some: sem o topo não há o nome, o crédito e o prazo; sem o vídeo (ou o
    # aviso) a página não destrava; o atendimento fica como o WhatsApp da assinatura.
    PALCO = re.compile(r"(?:^|[\s>~+])(?:header|h1|iframe)(?![\w-])|\.topo\b|\[data-campo\b|\.credito-itens\b"
                       r"|#creditoItens\b|\.prazo\b|#prazo\b|#heroVsl\b|\.vsl-sec\b|\.container\b|\.vsl-moldura\b"
                       r"|\.vsl-frame\b|#heroVslFrame\b|\.vsl-ov(?![\w-])|#heroVslOverlay\b|#vslTrava\b|\.vsl-trava-"
                       r"|\.ajuda-")
    ESCONDIVEL = re.compile(r'\.vsl-cta|\.vsl-ov-link|\.vsl-ov-cta|\[data-checkout(?:=[^\]]*)?\]|a\[href="#planos"\]')
    fora_padrao, props_ruins, palco_escondido, desfaz, aninhado = [], [], [], [], []
    for sels, dec, ctx in regras:
        onde = f" (em {ctx})" if ctx else ""
        for s in sels:
            if s == "<aninhado>":
                aninhado.append(dec[:60])
                continue
            if not TRAVA_CLASSE.search(s):
                # Fora da trava, display com !important só para esconder: um «display: block
                # !important» num seletor mais específico venceria a regra da trava.
                if any(p == "display" and v.endswith("!important") and v != "none!important" for p, v in declaracoes(dec)):
                    desfaz.append(s + onde)
                continue
            if not s.startswith("html.vsl-trava "):
                fora_padrao.append(s + onde)
                continue
            for prop, val in declaracoes(dec):
                if not (PERMITIDO.get(prop) and PERMITIDO[prop](s, val)):
                    props_ruins.append(f"{s} {{ {prop}: {val} }}{onde}")
            if not any(p == "display" and v.startswith("none") for p, v in declaracoes(dec)) or (s in EXIGIDOS and not ctx):
                continue
            resto = re.sub(r":not\([^)]*\)", "", s[len("html.vsl-trava"):]).strip()
            alvo = re.split(r" [>~+] | ", resto)[-1]
            if re.fullmatch(r"[a-zA-Z*][\w-]*|\*|", alvo):
                palco_escondido.append(f"{s}{onde} (seletor largo demais: esconde qualquer «{alvo or '*'}»)")
            elif not ESCONDIVEL.fullmatch(alvo) and PALCO.search(resto):
                palco_escondido.append(s + onde)
    check(not aninhado, f"CSS aninhado: o fiscal não sabe auditar: {aninhado}")
    check(not fora_padrao, f"seletor que depende da trava fora do padrão «html.vsl-trava …»: {fora_padrao}")
    check(not props_ruins, "sob a trava só esconder (display: none !important) ou arrumar o palco "
                           f"(flex/min-height/fundo/padding/moldura): {props_ruins}")
    check(not palco_escondido, f"a trava esconde o palco (topo, vídeo, aviso ou atendimento): {palco_escondido}")
    check(not desfaz, f"display com !important que não é none: venceria o esconder da trava: {desfaz}")
    aviso_css = {s: dec for sels, dec, ctx in regras if not ctx for s in sels if s.startswith(".vsl-trava-aviso")}
    check(any("visibility:hidden" in d for s, d in aviso_css.items() if s == ".vsl-trava-aviso")
          and "visibility:visible" in aviso_css.get(".vsl-trava-aviso[data-pausa]", ""),
          "o aviso da trava não fica invisível fora da pausa (só [data-pausa] o mostra)")

    # Pré-trava: a classe entra antes do arquivo chegar (os planos não piscam) e sai se ele
    # não travar, não carregar ou não chegar a tempo. Só existe dentro de iniciarVsl(): fora
    # dali trancaria um estado sem vídeo, sem ter como destravar.
    check(len(re.findall(r"['\"]vsl-trava['\"]", js)) == len(re.findall(r"['\"]vsl-trava['\"]", corpo)) == 2,
          "a classe vsl-trava é mexida pela página fora da pré-trava de iniciarVsl()")
    if "trava" in fontes:
        tv = re.escape(fontes["trava"])
        # Ao desistir, a página marca FC_VSL_TRAVA: o vsl-trava.js começa por «if
        # (window.FC_VSL_TRAVA) return;», então um arquivo que chegue depois do prazo não
        # tranca por cima de quem já está vendo os planos.
        solta = re.search(r"function ([\w$]+)\(\)\s*\{\s*if \(window\.FC_VSL_TRAVA\) return;\s*"
                          r"window\.FC_VSL_TRAVA = '[\w-]+';\s*([\w$]+)\.classList\.remove\('vsl-trava'\);\s*\}", corpo)
        check(bool(solta) and bool(re.search(rf"var {re.escape(solta.group(2))} = document\.documentElement;", corpo)),
              "sem a função que devolve a página quando o vsl-trava.js não trava (e marca FC_VSL_TRAVA para ele não trancar depois)")
        f = re.escape(solta.group(1)) if solta else "#"
        check(bool(re.search(rf"(?<![\w$.]){tv}\.onload = {f};", corpo))
              and bool(re.search(rf"(?<![\w$.]){tv}\.onerror = {f};", corpo)),
              "a pré-trava não sai quando o vsl-trava.js carrega sem travar ou falha ao carregar")
        # Piso: com prazo curto os planos aparecem e somem (a pré-trava perde o sentido).
        prazo = re.search(rf"setTimeout\({f},\s*(\d+)\);", corpo)
        check(bool(prazo) and 5000 <= int(prazo.group(1)) <= 15000,
              "a pré-trava não tem prazo entre 5 e 15 s para abrir a página")
        # Só depois de o vídeo estar ligado: acima do setAttribute('src') ficam os return do
        # vídeo desligado (__PANDA_ID__), e a classe ali trancaria a página sem vídeo, para sempre.
        entra = re.search(r"\.classList\.add\('vsl-trava'\);", corpo)
        injeta = re.search(rf"appendChild\({tv}\);", corpo)
        liga = re.search(r"(?<![\w$.])f\.setAttribute\('src', src\);", corpo)
        check(bool(entra and injeta) and entra.start() < injeta.start(),
              "a pré-trava não entra antes de o vsl-trava.js ser injetado")
        sem_solta = corpo.replace(solta.group(0), "") if solta else corpo
        entra2 = re.search(r"\.classList\.add\('vsl-trava'\);", sem_solta)
        check(bool(entra2 and liga) and entra.start() > liga.start()
              and not re.search(r"\breturn\b", sem_solta[entra2.start():]),
              "a pré-trava entra antes de o vídeo estar ligado (f.setAttribute('src', src)) ou antes de um return de iniciarVsl()")

if injetados:
    trava_arq = Path(os.environ.get("FISCAL_VSL_TRAVA", RAIZ / "assets" / "vsl-trava.js"))
    codigo = sem_comentarios_js(trava_arq.read_text(encoding="utf-8").replace("\r\n", "\n"))
    for proibido in ("fetch(", "XMLHttpRequest", "sendBeacon", "WebSocket", "EventSource", "new Image", "import(",
                     "importScripts", "createElement", "document.cookie", "postMessage", "window.open",
                     "innerHTML", "outerHTML", "insertAdjacentHTML", "document.write"):
        check(proibido not in codigo, f"assets/vsl-trava.js passou a usar {proibido}: a continuar não pode carregá-lo")
    for rx, oque in ((r"\.(?:src|href|action|location)\s*=(?!=)", "atribui src/href/action/location (requisição ou navegação)"),
                     (r"setAttribute\(\s*['\"](?:src|srcset|href|action)['\"]", "setAttribute de src/href/action"),
                     (r"\.assign\(", "location.assign (navegação)")):
        check(not re.search(rx, codigo), f"assets/vsl-trava.js {oque}: a continuar não pode carregá-lo")
    # O arquivo não lê a página além do slot, do player e do aviso: o href dos botões de
    # compra (e a URL) carregam o token. A única leitura de URL permitida é a base para
    # resolver o endereço do player: new URL(src, window.location.href).
    le = codigo.replace("new URL(src, window.location.href)", "new URL(src, BASE)")
    for rx, oque in ((r"\.href\b", ".href"), (r"document\.(?:URL|baseURI|referrer|documentURI|body|links|forms|anchors|all)\b",
                                                "document.URL/baseURI/referrer/body/links/forms"),
                     (r"location\.toString|String\(\s*(?:window\.)?location\s*\)", "a URL inteira"),
                     (r"getElementsBy|\.closest\(|\.children\b|\.parentNode\b|\.parentElement\b|\.nextElementSibling\b",
                      "caminhos pela página (getElementsBy/closest/parent/children)"),
                     (r"\.(?:innerText|outerText)\b|\.textContent\b(?!\s*=[^=])", "leitura de texto da página")):
        check(not re.search(rx, le), f"assets/vsl-trava.js lê {oque}: a continuar não pode carregá-lo (o token mora na página)")
    seletores_js = re.findall(r"\.querySelector(?:All)?\(\s*([^)]*)\)", le)
    check(all(re.fullmatch(r"'\[data-vsl-trava-[\w-]+\]'", s.strip()) for s in seletores_js),
          f"assets/vsl-trava.js consulta a página fora do aviso ([data-vsl-trava-…]): {seletores_js}")
    ids_js = re.findall(r"getElementById\(\s*([^)]*)\)", le)
    check(bool(ids_js) and all(i.strip() in ("'heroVsl'", "'heroVslFrame'", "'vslTrava'") for i in ids_js),
          f"assets/vsl-trava.js pega elemento fora do slot, do player e do aviso: {ids_js}")
    falhas_storage = auditar_storage(codigo)
    check(not falhas_storage, "assets/vsl-trava.js: " + "; ".join(falhas_storage))

# ── 3. Checkout e preço ──────────────────────────────────────────────────
check("kiwify" not in html.lower(), "endereço do checkout no HTML (o clique tem de passar pela API)")
# Mesmo princípio do nome do gateway: vocabulário interno não entra no arquivo servido,
# nem em comentário — comentário sobrevive no "ver código-fonte" da página. O comprador
# não sabe o que é «bump»; entre nós (commit, PR, este fiscal) o termo técnico continua.
check("bump" not in html.lower(),
      "«bump» no HTML servido: usar o vocabulário do comprador (extras da compra)")
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
