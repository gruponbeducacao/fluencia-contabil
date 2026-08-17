"""
Gera assinaturas.html (variante B do teste A/B) a partir de assinatura.html.

Diferenca entre as duas paginas:

  LP A (assinatura.html)  — hero com o card de oferta: preco em destaque,
                            beneficios, countdown e CTA indo direto pra Kiwify.
  LP B (assinaturas.html) — hero LEVE, recriada a partir da versao original de
                            23/07 (commit 419a4e6): subtitulo, o que esta
                            incluso, data da janela, countdown solto sobre o
                            fundo escuro, CTA e nota de garantia. Sem preco
                            nenhum acima da dobra, e o CTA do header e o do hero
                            apontam pra ancora #oferta em vez do checkout —
                            ninguem chega na Kiwify sem ter visto o valor.

O preco continua aparecendo na secao #oferta e no FAQ, depois do argumento.

O arquivo e' DERIVADO, nunca editado a mao. Edite assinatura.html e regenere:

    python scripts/gen_variante_b.py            # (re)gera assinaturas.html
    python scripts/gen_variante_b.py --check    # nao escreve; falha se desatualizado

Rode o --check antes de todo push: e' ele que transforma "editei a A e esqueci
de regenerar a B" de bug silencioso em falha explicita.

Toda transformacao e' ancorada em ESTRUTURA (indentacao + tag), nunca em
conteudo — se o preco ou a copy mudarem, o script continua funcionando. E toda
transformacao exige um numero exato de ocorrencias: se a pagina mudar de um jeito
que o script nao entenda, ele ABORTA em vez de gerar uma variante errada calado.

As classes da hero leve (.hero-sub, .hero-datas, .countdown-wrap, .hero-cta,
.hero-note) continuam definidas no <style> da LP A mesmo sem uso — foi o que
permitiu recriar a hero original sem escrever CSS novo.
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

LINHAS_BANNER = 5
ANCORA_OFERTA = '<section class="section oferta" id="oferta">'
CHECKOUT = 'https://pay.kiwify.com.br/'


def die(msg):
    print('ABORTADO - ' + msg, file=sys.stderr)
    sys.exit(2)


def read(path):
    # newline='' desliga a traducao universal de fim de linha, pra preservar
    # exatamente o que esta no disco. O checkout no Windows e' CRLF, mas em
    # Linux/CI e' LF — por isso o fim de linha e' DETECTADO, nunca assumido:
    # gravar o fim de linha errado faria o git marcar as ~3.300 linhas como
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


def acha_um(html, padrao, rotulo):
    achados = list(padrao.finditer(html))
    if len(achados) != 1:
        die('%s: esperava 1 bloco, achei %d' % (rotulo, len(achados)))
    return achados[0]


def banner(nl):
    return nl.join([
        '<!-- ============================================================ -->',
        '<!-- ARQUIVO GERADO - NAO EDITE A MAO.                            -->',
        '<!-- Fonte: assinatura.html | Gerador: scripts/gen_variante_b.py  -->',
        '<!-- Variante B do teste A/B: hero leve, sem preco acima da dobra.-->',
        '<!-- ============================================================ -->',
    ]) + nl


def hero_leve(nl, bloco_download):
    """Hero da variante B — recriada da versao original de 23/07 (419a4e6).

    O texto e' verbatim daquele commit. O unico acrescimo e' o bloco de
    download, que nasceu depois, aqui reaproveitado dentro do .hero-cta.
    """
    linhas = [
        '      <div class="hero-badge">\U0001F3DB️ Edição 2026 · Janela de lançamento até 16/08</div>',
        '',
        '      <h1>Transforme contabilidade na sua <span class="destaque">maior vantagem</span> para conquistar múltiplas aprovações.<span class="sub-risco" aria-hidden="true"></span></h1>',
        '',
        '      <p class="hero-sub">A Fluência Contábil ensina contabilidade <strong>como um idioma, pela lógica</strong> — pra você parar de perder pontos <span class="ouro-claro">onde mais cai</span> e interpretar qualquer questão sem decoreba.</p>',
        '',
        '      <p class="hero-sub menor">Assinatura anual da edição 2026: <strong>4 módulos, 36 aulas + 3 bônus</strong>, questões comentadas de banca real e a plataforma completa por <strong>12 meses</strong>.</p>',
        '',
        '      <p class="hero-datas">Janela <strong>Aluno Fundador</strong>: até domingo, <strong>16/08, 23h59</strong> — depois o plano anual sai do ar e o bônus não volta.</p>',
        '',
        '      <div class="countdown-wrap">',
        '        <div class="countdown-label">A janela Aluno Fundador encerra em</div>',
        '        <div class="countdown" id="countdown">',
        '          <div class="cd-unit"><span class="cd-num" id="cd-d">--</span><span class="cd-txt">Dias</span></div>',
        '          <div class="cd-unit"><span class="cd-num" id="cd-h">--</span><span class="cd-txt">Horas</span></div>',
        '          <div class="cd-unit"><span class="cd-num" id="cd-m">--</span><span class="cd-txt">Min</span></div>',
        '          <div class="cd-unit"><span class="cd-num" id="cd-s">--</span><span class="cd-txt">Seg</span></div>',
        '        </div>',
        '      </div>',
        '',
        '      <div class="hero-cta">',
        '        <a href="#oferta" class="btn cta-compra">Quero ser Aluno Fundador</a>',
        '        <p class="hero-note">7 dias de garantia incondicional · Pix, boleto ou cartão em até 12×</p>',
    ]
    # O bloco de download vem da LP A, so' reindentado de 8 pra 8 espacos dentro
    # do .hero-cta. Assim ele nunca diverge entre as duas paginas.
    linhas += bloco_download
    linhas += ['      </div>']
    return nl.join(linhas) + nl


# Blocos ancorados por indentacao + tag. Lazy, com a tag de fechamento na
# indentacao exata; a assercao de "exatamente 1" cobre o risco de casar demais.
def padroes(nl):
    n = re.escape(nl)
    return {
        # Do <div class="hero-badge"> ate o fim do card .hero-oferta. O badge abre
        # e fecha na mesma linha, dai o `.*` antes da quebra. O fechamento e' o
        # </div> de 6 espacos imediatamente antes do </div> de 4 que encerra o
        # .hero-texto — o lookahead garante que e' o ultimo, e nao um aninhado.
        'hero_miolo': re.compile(
            r'^ {6}<div class="hero-badge">.*' + n + r'(?:.*' + n + r')*?'
            r' {6}</div>' + n + r'(?= {4}</div>)', re.M),
        'bloco_download': re.compile(
            r'^ {8}<div class="hero-degusta">' + n + r'(?:.*' + n + r')*? {8}</div>' + n, re.M),
        'sticky_preco': re.compile(
            r'^ {4}<span class="sticky-oferta">' + n + r'(?:.*' + n + r')*? {4}</span>' + n, re.M),
    }


def build(src):
    """Aplica as transformacoes. Devolve (html_da_variante, precos_removidos)."""
    nl = detecta_nl(src)
    pat = padroes(nl)
    out = src

    if not out.startswith('<!DOCTYPE html>' + nl):
        die('banner: o arquivo nao comeca com <!DOCTYPE html> — abortando pra nao '
            'inserir comentario antes do doctype (dispara quirks mode)')
    out = out.replace('<!DOCTYPE html>' + nl, '<!DOCTYPE html>' + nl + banner(nl), 1)

    out = swap(out, '<meta name="robots" content="index, follow">',
               '<meta name="robots" content="noindex, nofollow">', 'robots')

    # Canonical e og:url apontam pra propria variante (self-canonical). noindex
    # somado a canonical apontando pra LP A seriam sinais contraditorios, com
    # risco de o noindex propagar pela canonical e tirar a LP A do indice.
    out = swap(out,
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinatura.html">',
               '<link rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html">',
               'canonical')
    out = swap(out,
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinatura.html">',
               '<meta property="og:url" content="https://fluenciacontabil.com.br/assinaturas.html">',
               'og:url')

    # 1) Troca o miolo do hero pela versao leve, reaproveitando o bloco de download da LP A.
    m_dl = acha_um(out, pat['bloco_download'], 'bloco de download na LP A')
    download = [l for l in m_dl.group(0).split(nl) if l.strip()]
    m_hero = acha_um(out, pat['hero_miolo'], 'miolo do hero')
    miolo_antigo = m_hero.group(0)
    out = out[:m_hero.start()] + hero_leve(nl, download) + out[m_hero.end():]

    # 2) Header sticky: fora o bloco de preco.
    m_sticky = acha_um(out, pat['sticky_preco'], 'preco do header')
    sticky_antigo = m_sticky.group(0)
    out = out[:m_sticky.start()] + out[m_sticky.end():]

    # 3) O CTA do header deixa de ir pro checkout e vira ancora — na LP B ninguem
    #    chega na Kiwify sem ter passado pela secao de preco. O da hero ja nasce
    #    como #oferta no template acima.
    m_cta = re.search(r'href="' + re.escape(CHECKOUT) + r'[^"]*" class="btn-sm cta-compra"', out)
    if not m_cta:
        die('CTA do header: nao achei o link de checkout com class="btn-sm cta-compra"')
    out = out[:m_cta.start()] + 'href="#oferta" class="btn-sm cta-compra"' + out[m_cta.end():]

    # 4) Sobram 4 checkouts, todos abaixo do preco:
    #      2 do plano anual (card de oferta da janela + CTA final), e
    #      2 dos planos padrao pos-janela (trimestral 4Qx0g3O e semestral DXvdSEu),
    #        que vivem no bloco .planos-pos e so' aparecem com body.encerrada.
    #    Eram 2 ate' 16/08; viraram 4 quando a LP passou a mostrar os planos novos
    #    no lugar do aviso de "janela encerrada".
    #    O utm_content dos dois novos e' trimestral/semestral (nao lp-a), entao
    #    a contagem dele continua 2.
    out = swap(out, 'src=lp-a', 'src=lp-b', 'src dos checkouts', vezes=4)
    out = swap(out, 'utm_content=lp-a', 'utm_content=lp-b', 'utm_content dos checkouts', vezes=2)
    out = swap(out, 'data-fc-lp="a"', 'data-fc-lp="b"', 'variante no botao de download')

    return out, [miolo_antigo, sticky_antigo]


def bloco_style(html, rotulo):
    ini, fim = html.find('<style>'), html.find('</style>')
    if ini < 0 or fim < 0:
        die('%s: nao achei o bloco <style>' % rotulo)
    return html[ini:fim]


def check(src, out, removidos):
    """Pos-condicoes. E' aqui que mora o valor do script."""
    nl = detecta_nl(src)
    erros = []

    # (a) O CSS das duas paginas tem que ser byte-identico. A variante nao poda os
    # seletores que ficaram orfaos justamente pra que esta comparacao sirva de
    # sentinela: qualquer divergencia de estilo entre A e B vira falha dura.
    if bloco_style(src, 'fonte') != bloco_style(out, 'variante'):
        erros.append('o bloco <style> da variante divergiu do da fonte')

    # (b) Nenhum preco acima da secao #oferta. Os valores saem dos PROPRIOS blocos
    # removidos, entao a checagem continua valendo se o preco mudar.
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
        # nenhum link de checkout acima do preco
        if CHECKOUT in acima:
            erros.append('ha link de checkout ANTES da secao #oferta — o CTA de cima '
                         'deve ser ancora #oferta na variante B')

    # (c) Marcadores estruturais
    for marcador in ('class="sticky-oferta"', 'class="hero-oferta-preco"',
                     'class="hero-oferta-pgto"', 'class="hero-oferta"'):
        if marcador in out:
            erros.append('%s deveria ter sumido do HTML da variante' % marcador)
    if 'lp-a' in out:
        erros.append('sobrou lp-a na variante')
    # src=lp-b: 4 (2 do anual + 2 dos planos pos-janela). utm_content=lp-b: 2,
    # porque os planos novos usam utm_content=trimestral/semestral.
    for termo, vezes in (('src=lp-b', 4), ('utm_content=lp-b', 2)):
        if out.count(termo) != vezes:
            erros.append('esperava %d ocorrencias de %s, achei %d' % (vezes, termo, out.count(termo)))
    if out.count('href="#oferta"') != src.count('href="#oferta"') + 2:
        erros.append('esperava 2 ancoras #oferta a mais que a fonte (header e hero)')

    # (d) A hero leve montou, e o que nao podia sumir continua de pe
    for marcador in ('class="hero-sub"', 'class="hero-sub menor"', 'class="hero-datas"',
                     'class="countdown-wrap"', 'class="hero-cta"', 'class="hero-note"',
                     'id="countdown"', 'class="hero-badge"',
                     'data-fc-cta="amostra-aula01"', 'data-fc-lp="b"',
                     'aula-01-partidas-dobradas.pdf'):
        if marcador not in out:
            erros.append('%s faltando na variante' % marcador)
    if out.count('cta-compra') != src.count('cta-compra'):
        erros.append('a variante perdeu ou ganhou CTAs')
    if out.count('id="countdown"') != 1 or out.count('id="countdown2"') != 1:
        erros.append('os dois countdowns precisam existir e ser unicos (o JS de '
                     'encerramento busca por id)')

    # (e) SEO
    for esperado in ('<meta name="robots" content="noindex, nofollow">',
                     'rel="canonical" href="https://fluenciacontabil.com.br/assinaturas.html"',
                     'og:url" content="https://fluenciacontabil.com.br/assinaturas.html"'):
        if esperado not in out:
            erros.append('faltou no <head>: %s' % esperado)

    # (f) Fim de linha preservado
    if detecta_nl(out) != nl or (nl == '\r\n' and out.count('\n') != out.count('\r\n')):
        erros.append('o fim de linha da variante divergiu do da fonte')

    return erros


def main():
    modo_check = '--check' in sys.argv[1:]

    if not SRC.exists():
        die('nao achei a fonte: %s' % SRC)

    src = read(SRC)
    nl = detecta_nl(src)
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
    print('OK: %s gerado a partir de %s.' % (DST.name, SRC.name))
    print('  - hero leve no lugar do card de oferta (versao de 23/07, sem preco)')
    print('  - preco fora do header sticky')
    print('  - CTA do header e do hero apontando pra #oferta, nao pro checkout')
    print('  - 4 checkouts restantes (anual: oferta e CTA final; pos-janela: tri e sem) com src=lp-b')
    print('  - botao de download preservado, com data-fc-lp="b"')
    print('  - <style> identico ao da fonte (checado)')
    print('  - %d linhas, fim de linha %s' % (len(out.split(nl)), repr(nl)))


if __name__ == '__main__':
    main()
