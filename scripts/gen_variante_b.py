"""
Gera assinaturas.html a partir de assinatura.html.

As duas paginas sao a MESMA landing page. O teste A/B de hero foi encerrado em
17/08/2026 junto com a janela Aluno Fundador: /assinaturas deixou de ter uma hero
propria e passou a ser copia de /assinatura.

O que ainda diverge, e por que:

  robots            noindex, nofollow  — as paginas sao iguais; sem isso o Google
                                         veria conteudo duplicado e escolheria uma.
  canonical/og:url  self-canonical     — noindex somado a canonical apontando pra
                                         LP A seriam sinais contraditorios, com
                                         risco de o noindex propagar pela canonical
                                         e tirar a LP A do indice.
  src / utm_content lp-a -> lp-b       — continua dando pra medir por qual link a
                                         venda entrou.
  data-fc-lp        "a" -> "b"         — idem, no botao de download da amostra.

Nada mais pode divergir. A pos-condicao do check() e' literalmente essa frase:
tirando o banner, toda linha alterada tem que conter um dos marcadores acima.

O arquivo e' DERIVADO, nunca editado a mao. Edite assinatura.html e regenere:

    python scripts/gen_variante_b.py            # (re)gera assinaturas.html
    python scripts/gen_variante_b.py --check    # nao escreve; falha se desatualizado

Rode o --check antes de todo push: e' ele que transforma "editei a A e esqueci
de regenerar a B" de bug silencioso em falha explicita.
"""
import difflib
import sys
from pathlib import Path

# Raiz do repo, deduzida da posicao deste arquivo — de proposito.
# Os outros scripts de scripts/ hardcodam o caminho de 'Versão 3', mas aquele
# checkout costuma ficar defasado em relacao a origin/main; gerar a variante a
# partir dele produziria uma B nascida de uma fonte velha.
ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'assinatura.html'
DST = ROOT / 'assinaturas.html'

LINHAS_BANNER = 5

# Toda linha que o diff A x B acusar precisa conter um destes. E' a unica
# pos-condicao do script, e e' o que garante que as paginas sao iguais.
MARCADORES_PERMITIDOS = (
    'name="robots"',
    'rel="canonical"',
    'property="og:url"',
    'src=lp-',
    'utm_content=lp-',
    'data-fc-lp=',
)


def die(msg):
    print('ABORTADO - ' + msg, file=sys.stderr)
    sys.exit(2)


def read(path):
    # newline='' desliga a traducao universal de fim de linha, pra preservar
    # exatamente o que esta no disco. O checkout no Windows e' CRLF, mas em
    # Linux/CI e' LF — por isso o fim de linha e' DETECTADO, nunca assumido:
    # gravar o fim de linha errado faria o git marcar as ~3.000 linhas como
    # alteradas e tornaria o diff A x B ilegivel.
    with open(path, encoding='utf-8', newline='') as f:
        return f.read()


def write(path, texto):
    with open(path, 'w', encoding='utf-8', newline='') as f:
        f.write(texto)


def detecta_nl(texto):
    return '\r\n' if '\r\n' in texto[:4096] else '\n'


def swap(html, old, new, rotulo, vezes=1):
    achou = html.count(old)
    if achou != vezes:
        die('%s: esperava %d ocorrencia(s), achei %d -> %r' % (rotulo, vezes, achou, old[:80]))
    return html.replace(old, new, vezes)


def banner(nl):
    return nl.join([
        '<!-- ============================================================ -->',
        '<!-- ARQUIVO GERADO - NAO EDITE A MAO.                            -->',
        '<!-- Fonte: assinatura.html | Gerador: scripts/gen_variante_b.py  -->',
        '<!-- Copia da LP A; muda so' + ' o head (SEO) e o rastreio lp-b.    -->',
        '<!-- ============================================================ -->',
    ]) + nl


def conta_lp_a(src):
    """Quantos links de checkout carregam src=lp-a / utm_content=lp-a.

    Nao e' fixo de proposito: mudou de 2 pra 4 quando os planos pos-janela
    entraram na pagina, e mudou de novo quando o plano anual saiu. O que o
    script garante e' que a variante troca TODOS eles — nenhum lp-a sobra.
    """
    n_src = src.count('src=lp-a')
    n_utm = src.count('utm_content=lp-a')
    if n_src == 0:
        die('nao achei nenhum src=lp-a na fonte — o rastreio da variante ficaria vazio')
    return n_src, n_utm


def build(src):
    nl = detecta_nl(src)
    out = src

    if not out.startswith('<!DOCTYPE html>' + nl):
        die('banner: o arquivo nao comeca com <!DOCTYPE html> — abortando pra nao '
            'inserir comentario antes do doctype (dispara quirks mode)')
    out = out.replace('<!DOCTYPE html>' + nl, '<!DOCTYPE html>' + nl + banner(nl), 1)

    out = swap(out, '<meta name="robots" content="index, follow">',
               '<meta name="robots" content="noindex, nofollow">', 'robots')
    out = swap(out,
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinatura.html">',
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html">',
               'canonical')
    out = swap(out,
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinatura.html">',
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinaturas.html">',
               'og:url')

    n_src, n_utm = conta_lp_a(src)
    out = swap(out, 'src=lp-a', 'src=lp-b', 'src dos checkouts', vezes=n_src)
    if n_utm:
        out = swap(out, 'utm_content=lp-a', 'utm_content=lp-b', 'utm_content dos checkouts', vezes=n_utm)
    out = swap(out, 'data-fc-lp="a"', 'data-fc-lp="b"', 'variante no botao de download')

    return out


def check(src, out):
    """Pos-condicoes. E' aqui que mora o valor do script."""
    nl = detecta_nl(src)
    erros = []

    # (a) O CONTRATO: fora do banner, o diff so pode tocar head e rastreio.
    # Substitui todas as checagens estruturais que existiam quando a variante
    # tinha hero propria — agora "igual" e' uma condicao, nao uma lista de itens.
    linhas_out = out.split(nl)
    if linhas_out[1:1 + LINHAS_BANNER] != banner(nl).rstrip(nl).split(nl):
        erros.append('o banner de arquivo gerado nao ficou nas linhas 2-%d' % (1 + LINHAS_BANNER))
    sem_banner = [linhas_out[0]] + linhas_out[1 + LINHAS_BANNER:]

    for linha in difflib.unified_diff(src.split(nl), sem_banner, lineterm='', n=0):
        if linha[:3] in ('---', '+++', '@@ ') or not linha:
            continue
        if linha[0] not in '+-':
            continue
        conteudo = linha[1:]
        if not any(m in conteudo for m in MARCADORES_PERMITIDOS):
            erros.append('a variante divergiu fora do head/rastreio: %r' % conteudo.strip()[:110])

    # (b) Nenhum lp-a sobrou, e o total de lp-b bate com o que a fonte tinha.
    if 'lp-a' in out:
        erros.append('sobrou lp-a na variante')
    for termo_a, termo_b in (('src=lp-a', 'src=lp-b'), ('utm_content=lp-a', 'utm_content=lp-b')):
        if out.count(termo_b) != src.count(termo_a):
            erros.append('esperava %d ocorrencias de %s, achei %d'
                         % (src.count(termo_a), termo_b, out.count(termo_b)))

    # (c) SEO
    for esperado in ('<meta name="robots" content="noindex, nofollow">',
                     'rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html"',
                     'og:url" content="https://fluenciacontabil.com.br/assinaturas.html"'):
        if esperado not in out:
            erros.append('faltou no <head>: %s' % esperado)

    # (d) Fim de linha preservado
    if detecta_nl(out) != nl or (nl == '\r\n' and out.count('\n') != out.count('\r\n')):
        erros.append('o fim de linha da variante divergiu do da fonte')

    return erros


def main():
    modo_check = '--check' in sys.argv[1:]

    if not SRC.exists():
        die('nao achei a fonte: %s' % SRC)

    src = read(SRC)
    nl = detecta_nl(src)
    out = build(src)

    erros = check(src, out)
    if erros:
        for e in erros:
            print('  FALHOU: ' + e, file=sys.stderr)
        die('%d pos-condicao(oes) violada(s) — assinaturas.html NAO foi escrito' % len(erros))

    if modo_check:
        if not DST.exists():
            print('FALHOU: %s nao existe. Rode sem --check.' % DST.name, file=sys.stderr)
            sys.exit(1)
        if read(DST) != out:
            print('FALHOU: %s esta desatualizado em relacao a %s.' % (DST.name, SRC.name), file=sys.stderr)
            print('Rode: python scripts/gen_variante_b.py', file=sys.stderr)
            diff = difflib.unified_diff(
                read(DST).split(nl), out.split(nl),
                fromfile=DST.name + ' (commitado)', tofile=DST.name + ' (esperado)',
                lineterm='', n=1,
            )
            for linha in list(diff)[:60]:
                print(linha, file=sys.stderr)
            sys.exit(1)
        print('OK: %s esta em dia com %s.' % (DST.name, SRC.name))
        return

    write(DST, out)
    n_src = src.count('src=lp-a')
    print('OK: %s gerado a partir de %s.' % (DST.name, SRC.name))
    print('  - copia integral da LP A (hero, oferta, curriculo e CSS identicos)')
    print('  - head: noindex + canonical/og:url proprios')
    print('  - %d checkout(s) com src=lp-b' % n_src)
    print('  - botao de download com data-fc-lp="b"')
    print('  - %d linhas, fim de linha %s' % (len(out.split(nl)), repr(nl)))


if __name__ == '__main__':
    main()
