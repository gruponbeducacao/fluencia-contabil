"""
Gera assinaturas.html (variante B do teste A/B) a partir de assinatura.html.

A variante B e' a MESMA pagina sem o preco na hero e no header — o preco
continua aparecendo na secao #oferta e no FAQ, depois do argumento de venda.
Como as duas paginas tem ~3.250 linhas quase identicas, manter a copia a mao
erraria em silencio: bastaria uma correcao de copy entrar so na LP A pra
contaminar o resultado do teste, ou o preco reaparecer na hero da B e matar o
teste sem ninguem perceber. Por isso a B e' DERIVADA, nunca editada a mao.

Edite sempre assinatura.html e regenere.

    python scripts/gen_variante_b.py            # (re)gera assinaturas.html
    python scripts/gen_variante_b.py --check    # nao escreve; falha se estiver desatualizado

Rode o --check antes de todo push: e' ele que transforma "editei a A e esqueci
de regenerar a B" de bug silencioso em falha explicita.

Todas as transformacoes sao ancoradas em ESTRUTURA (indentacao + tag), nunca em
conteudo: se o preco mudar de 84,27 pra outro valor, o script continua
funcionando. E toda transformacao exige um numero exato de ocorrencias — se a
pagina mudar de um jeito que o script nao entenda, ele ABORTA em vez de gerar
uma variante errada em silencio.
"""
import difflib
import re
import sys
from pathlib import Path

# Raiz do repo, deduzida da posicao deste arquivo — de proposito.
# Os outros scripts de scripts/ hardcodam o caminho de 'Versão 3', mas aquele
# checkout costuma ficar defasado em relacao a origin/main; gerar a variante a
# partir dele produziria uma B nascida de uma fonte velha.
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assinatura.html'
DST = ROOT / 'assinaturas.html'

NL = '\r\n'
BANNER = (
    '<!-- ============================================================ -->' + NL +
    '<!-- ARQUIVO GERADO - NAO EDITE A MAO.                            -->' + NL +
    '<!-- Fonte: assinatura.html | Gerador: scripts/gen_variante_b.py  -->' + NL +
    '<!-- Variante B do teste A/B: sem preco na hero e no header.      -->' + NL +
    '<!-- ============================================================ -->' + NL
)
BANNER_LINES = BANNER.count(NL)
LINHAS_REMOVIDAS = 9  # 4 (.sticky-oferta) + 4 (.hero-oferta-preco) + 1 (.hero-oferta-pgto)

# Blocos removidos. Lazy + tag de fechamento na indentacao exata; a assercao de
# "exatamente 1 match" cobre o risco de casar demais.
RE_STICKY = re.compile(r'^ {4}<span class="sticky-oferta">\r\n(?:.*\r\n)*? {4}</span>\r\n', re.M)
RE_PRECO = re.compile(r'^ {8}<div class="hero-oferta-preco">\r\n(?:.*\r\n)*? {8}</div>\r\n', re.M)
RE_PGTO = re.compile(r'^ {8}<p class="hero-oferta-pgto">.*?</p>\r\n', re.M)

ANCORA_OFERTA = '<section class="section oferta" id="oferta">'


def die(msg):
    print('ABORTADO - ' + msg, file=sys.stderr)
    sys.exit(2)


def read(path):
    # newline='' desliga a traducao universal de fim de linha. O arquivo e' CRLF;
    # sem isso o script gravaria LF e o git marcaria as 3.250 linhas como
    # alteradas, tornando o diff A x B ilegivel.
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, texto):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)


def swap(html, old, new, rotulo, vezes=1):
    achou = html.count(old)
    if achou != vezes:
        die('%s: esperava %d ocorrencia(s), achei %d -> %r' % (rotulo, vezes, achou, old[:80]))
    return html.replace(old, new, vezes)


def cut(html, padrao, rotulo):
    achados = list(padrao.finditer(html))
    if len(achados) != 1:
        die('%s: esperava 1 bloco, achei %d' % (rotulo, len(achados)))
    m = achados[0]
    return html[:m.start()] + html[m.end():], m.group(0)


def build(src):
    """Aplica as 8 transformacoes. Devolve (html_da_variante, blocos_removidos)."""
    out = src
    removidos = []

    if not out.startswith('<!DOCTYPE html>' + NL):
        die('banner: o arquivo nao comeca com <!DOCTYPE html> — abortando pra nao '
            'inserir comentario antes do doctype (dispara quirks mode)')
    out = out.replace('<!DOCTYPE html>' + NL, '<!DOCTYPE html>' + NL + BANNER, 1)

    out = swap(out, '<meta name="robots" content="index, follow">',
               '<meta name="robots" content="noindex, nofollow">', 'robots')

    # Canonical e og:url apontam pra propria variante (self-canonical).
    # noindex + canonical apontando pra LP A seriam sinais contraditorios, com
    # risco de o noindex propagar pela canonical e tirar a LP A do indice.
    out = swap(out,
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinatura.html">',
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html">',
               'canonical')
    out = swap(out,
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinatura.html">',
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinaturas.html">',
               'og:url')

    out = swap(out, 'src=lp-a', 'src=lp-b', 'src dos checkouts', vezes=4)
    out = swap(out, 'utm_content=lp-a', 'utm_content=lp-b', 'utm_content dos checkouts', vezes=4)
    out = swap(out, 'data-fc-lp="a"', 'data-fc-lp="b"', 'variante no botao de download')

    for padrao, rotulo in ((RE_STICKY, 'preco do header'),
                           (RE_PRECO, 'preco da hero'),
                           (RE_PGTO, 'nota de pagamento da hero')):
        out, bloco = cut(out, padrao, rotulo)
        removidos.append(bloco)

    return out, removidos


def bloco_style(html, rotulo):
    ini = html.find('<style>')
    fim = html.find('</style>')
    if ini < 0 or fim < 0:
        die('%s: nao achei o bloco <style>' % rotulo)
    return html[ini:fim]


def check(src, out, removidos):
    """Pos-condicoes. E' aqui que mora o valor do script."""
    erros = []

    # (a) O CSS das duas paginas tem que ser byte-identico. A variante nao poda
    # os seletores que ficaram orfaos justamente pra que esta comparacao sirva
    # de sentinela: qualquer divergencia de estilo entre A e B vira falha dura.
    if bloco_style(src, 'fonte') != bloco_style(out, 'variante'):
        erros.append('o bloco <style> da variante divergiu do da fonte')

    # (b) Nenhum preco acima da secao #oferta. Os valores saem dos PROPRIOS
    # blocos removidos, entao continua valendo se o preco mudar.
    precos = set(re.findall(r'R\$\s*([\d.]+,\d{2})', ''.join(removidos)))
    if not precos:
        erros.append('nao extrai nenhum preco dos blocos removidos (a checagem (b) ficaria vazia)')
    if ANCORA_OFERTA not in out:
        erros.append('nao achei a ancora da secao #oferta')
    else:
        acima = out.split(ANCORA_OFERTA, 1)[0]
        for p in sorted(precos):
            if p in acima:
                erros.append('o preco %s ainda aparece antes da secao #oferta' % p)

    # (c) Marcadores estruturais
    for marcador in ('class="sticky-oferta"', 'class="hero-oferta-preco"', 'class="hero-oferta-pgto"'):
        if marcador in out:
            erros.append('%s deveria ter sido removido' % marcador)
    if 'lp-a' in out:
        erros.append('sobrou lp-a na variante')
    for termo, vezes in (('src=lp-b', 4), ('utm_content=lp-b', 4)):
        if out.count(termo) != vezes:
            erros.append('esperava %d ocorrencias de %s, achei %d' % (vezes, termo, out.count(termo)))

    # (d) O que NAO pode ter sumido
    for marcador in ('data-fc-cta="amostra-aula01"', 'data-fc-lp="b"', 'aula-01-partidas-dobradas.pdf',
                     'class="hero-oferta-tag"', 'class="hero-oferta-list"', 'class="hero-oferta-count"',
                     'id="countdown"'):
        if marcador not in out:
            erros.append('%s sumiu da variante' % marcador)
    if out.count('cta-compra') != src.count('cta-compra'):
        erros.append('a variante perdeu ou ganhou CTAs')

    # (e) SEO
    for esperado in ('<meta name="robots" content="noindex, nofollow">',
                     'rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html"',
                     'og:url" content="https://fluenciacontabil.com.br/assinaturas.html"'):
        if esperado not in out:
            erros.append('faltou no <head>: %s' % esperado)

    # (f) Canario de contagem de linhas
    esperado = len(src.split(NL)) - LINHAS_REMOVIDAS + BANNER_LINES
    achado = len(out.split(NL))
    if achado != esperado:
        erros.append('contagem de linhas: esperava %d, achei %d' % (esperado, achado))

    return erros


def main():
    modo_check = '--check' in sys.argv[1:]

    if not SRC.exists():
        die('nao achei a fonte: %s' % SRC)

    src = read(SRC)
    out, removidos = build(src)

    erros = check(src, out, removidos)
    if erros:
        for e in erros:
            print('  FALHOU: ' + e, file=sys.stderr)
        die('%d pos-condicao(oes) violada(s) — assinaturas.html NAO foi escrito' % len(erros))

    if modo_check:
        if not DST.exists():
            print('FALHOU: %s nao existe. Rode sem --check.' % DST.name, file=sys.stderr)
            sys.exit(1)
        atual = read(DST)
        if atual != out:
            print('FALHOU: %s esta desatualizado em relacao a %s.' % (DST.name, SRC.name), file=sys.stderr)
            print('Rode: python scripts/gen_variante_b.py', file=sys.stderr)
            diff = difflib.unified_diff(
                atual.splitlines(), out.splitlines(),
                fromfile=DST.name + ' (commitado)', tofile=DST.name + ' (esperado)',
                lineterm='', n=1,
            )
            for linha in list(diff)[:60]:
                print(linha, file=sys.stderr)
            sys.exit(1)
        print('OK: %s esta em dia com %s.' % (DST.name, SRC.name))
        return

    write(DST, out)
    print('OK: %s gerado a partir de %s.' % (DST.name, SRC.name))
    print('  - preco removido do header sticky e da hero (%d linhas)' % LINHAS_REMOVIDAS)
    print('  - robots noindex,nofollow + canonical e og:url apontando pra propria variante')
    print('  - 4 checkouts com src=lp-b / utm_content=lp-b')
    print('  - botao de download preservado, com data-fc-lp="b"')
    print('  - <style> identico ao da fonte (checado)')
    print('  - %d linhas' % len(out.split(NL)))


if __name__ == '__main__':
    main()
