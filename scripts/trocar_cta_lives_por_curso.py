# -*- coding: utf-8 -*-
"""
Troca os CTA inline que ainda apontam para as lives do lançamento (04/08 a 07/08,
vencido) por CTA de assinatura do curso.

Mexe APENAS no conteúdo do bloco (headline, subtítulo, href e texto do botão). As
classes `.cta-inline`, `.cta-headline`, `.cta-sub` e `.btn-cta` não são tocadas —
estilo, cores, borda dourada e fundo cream continuam exatamente iguais.

Cada post recebe um texto próprio, coerente com o assunto do artigo: CTA genérico
converte menos e destoa do padrão que os posts recentes já usam (o do TJ-PR fala em
"firmar a base societária", o do PNCT em "contabilidade como um idioma").

Uso:
  PY="C:/Users/vfnev/AppData/Local/Python/pythoncore-3.14-64/python.exe"
  "$PY" scripts/trocar_cta_lives_por_curso.py          # aplica
  "$PY" scripts/trocar_cta_lives_por_curso.py --check  # só relata, não escreve
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

BLOG = Path(__file__).resolve().parent.parent / "blog"
DESTINO = "../cursos.html#assinar"
BOTAO = "Quero assinar agora"

# (arquivo, headline antiga que identifica o bloco) -> (headline nova, subtitulo novo)
TROCAS = {
    ("cpc-51-categorias-dre-paralelo-dfc.html", "Assista às lives gratuitas de Contabilidade"): (
        "Domine a DRE e a DFC de ponta a ponta",
        "As cinco categorias do CPC 51 e o paralelo com a DFC, com exemplos numéricos e lançamentos comentados.",
    ),
    ("cpc-51-categorias-dre-paralelo-dfc.html", "Pronto pra estudar contabilidade com lógica?"): (
        "Pronto pra estudar contabilidade com lógica?",
        "Contabilidade para concursos ensinada pelo raciocínio, não pela decoreba.",
    ),
    ("cpc-51-pegadinhas-concurso.html", "Assista às lives gratuitas de Contabilidade"): (
        "Não caia nas pegadinhas que a banca repete",
        "O curso destrincha cada armadilha do CPC 51 com a norma na mão e questões reais.",
    ),
    ("cpc-51-pegadinhas-concurso.html", "Pronto pra estudar contabilidade com lógica?"): (
        "Pronto pra estudar contabilidade com lógica?",
        "Contabilidade para concursos ensinada pelo raciocínio, não pela decoreba.",
    ),
    ("iss-caruaru-2026-contabilidade.html", "Assista às lives gratuitas de Contabilidade"): (
        "Prepare a Contabilidade que decide esse concurso",
        "Fundamentos, contas, demonstrações e os CPCs que as bancas cobram — com lógica, não com memorização.",
    ),
    ("iss-manaus-2026-contabilidade.html", "Assista às lives gratuitas de Contabilidade"): (
        "Prepare a Contabilidade que decide esse concurso",
        "Fundamentos, contas, demonstrações e os CPCs que as bancas cobram — com lógica, não com memorização.",
    ),
    ("iss-santos-2026-contabilidade.html", "Assista às lives gratuitas de Contabilidade"): (
        "Prepare a Contabilidade que decide esse concurso",
        "Fundamentos, contas, demonstrações e os CPCs que as bancas cobram — com lógica, não com memorização.",
    ),
}

RX_BLOCO = re.compile(r'<div class="cta-inline">(.*?)</div>', re.S)


def main(argv):
    check = "--check" in argv
    total, arquivos = 0, 0

    for arq in sorted({a for a, _ in TROCAS}):
        p = BLOG / arq
        if not p.exists():
            print("ERRO: nao encontrei %s" % p)
            return 1
        # newline="" preserva os EOL byte a byte. Sem isso, o Python normaliza as
        # quebras e o git reescreve o arquivo INTEIRO — os dois posts de CPC 51 têm
        # EOL misto (478 CRLF + 10 LF) e o diff saltou de 6 para ~950 linhas.
        with open(p, encoding="utf-8", newline="") as fh:
            t = original = fh.read()
        feitas = 0

        for bloco in RX_BLOCO.findall(t):
            mh = re.search(r'class="cta-headline">(.*?)</p>', bloco, re.S)
            if not mh:
                continue
            antiga = re.sub(r"<[^>]+>", "", mh.group(1)).strip()
            chave = (arq, antiga)
            if chave not in TROCAS:
                continue
            nova_h, nova_sub = TROCAS[chave]

            novo = bloco
            novo = re.sub(r'(class="cta-headline">).*?(</p>)',
                          lambda m: m.group(1) + nova_h + m.group(2), novo, count=1, flags=re.S)
            novo = re.sub(r'(class="cta-sub">).*?(</p>)',
                          lambda m: m.group(1) + nova_sub + m.group(2), novo, count=1, flags=re.S)
            novo = re.sub(r'href="[^"]*"', 'href="%s"' % DESTINO, novo, count=1)
            novo = re.sub(r'(class="btn-cta">).*?(</a>)',
                          lambda m: m.group(1) + BOTAO + m.group(2), novo, count=1, flags=re.S)

            t = t.replace(bloco, novo, 1)
            feitas += 1
            print("  %-42s %s" % (arq[:42], antiga[:52]))
            print("  %-42s   -> %s" % ("", nova_h))

        if feitas:
            arquivos += 1
            total += feitas
            if not check:
                with open(p, "w", encoding="utf-8", newline="") as fh:
                    fh.write(t)

    print()
    print("=" * 74)
    print("%s: %d CTA(s) em %d arquivo(s)" % ("SIMULACAO" if check else "APLICADO", total, arquivos))
    print("=" * 74)

    # fiscal: nenhum CTA inline pode sobrar apontando para as lives
    sobrando = []
    for p in sorted(BLOG.glob("*.html")):
        with open(p, encoding="utf-8", newline="") as fh:
            conteudo = fh.read()
        for bloco in RX_BLOCO.findall(conteudo):
            if "/lives" in bloco:
                sobrando.append(p.name)
    if sobrando and not check:
        print("!! ainda apontam para /lives: %s" % sorted(set(sobrando)))
        return 1
    print("CTA inline apontando para /lives: %d" % len(sobrando))
    print()
    print("O CSS (.cta-inline, .cta-headline, .cta-sub, .btn-cta) NAO foi tocado:")
    print("estilo, cores, borda dourada e fundo cream permanecem identicos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
