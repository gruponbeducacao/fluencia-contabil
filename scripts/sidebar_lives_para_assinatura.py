# -*- coding: utf-8 -*-
"""
O card lateral "Lives Gratuitas" vira CTA de assinatura.

O bloco `.sidebar-cta` fica na coluna da direita dos posts, abaixo de "Artigos
Relacionados", e aponta para /lives — página que ainda anuncia as 4 lives de 04 a
07/08, encerradas. São 17 posts, um link em cada.

Mexe APENAS no conteúdo (h3, p, href e texto do botão). A classe `.sidebar-cta` e a
do botão não são tocadas: fundo azul-marinho e botão dourado continuam iguais.

Quatro variantes convivem: o container é `sidebar-cta` ou `side-card side-cta`,
e o link vem com ou sem `class="btn-cta"`. Todas são tratadas.

Uso:
  PY="C:/Users/vfnev/AppData/Local/Python/pythoncore-3.14-64/python.exe"
  "$PY" scripts/sidebar_lives_para_assinatura.py          # aplica
  "$PY" scripts/sidebar_lives_para_assinatura.py --check  # só relata
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parent.parent

TITULO = "Assine o curso"
TEXTO = ("Contabilidade para concursos ensinada pela lógica, com exemplos numéricos "
         "e questões comentadas de banca.")
BOTAO = "Quero assinar &rarr;"
DESTINO = "../cursos.html#assinar"

# Duas classes convivem no repo para o mesmo card: `sidebar-cta` (6 posts) e
# `side-card side-cta` (11). A estrutura interna é a mesma (h3 + p + a); muda só a
# classe do container e a presença de `class="btn-cta"` no link.
RX_CARD = re.compile(r'<div class="(?:sidebar-cta|side-card side-cta)">(.*?)</div>', re.S)


def main(argv):
    check = "--check" in argv
    arquivos, trocas = 0, 0

    for p in sorted(RAIZ.rglob("*.html")):
        if ".git" in p.parts:
            continue
        # newline="" preserva os EOL; o repo é CRLF e tem arquivos de EOL misto
        with open(p, encoding="utf-8", newline="") as fh:
            t = fh.read()

        feitas = 0
        for bloco in RX_CARD.findall(t):
            if "/lives" not in bloco:
                continue  # card que já aponta para outro lugar fica como está
            novo = bloco
            novo = re.sub(r"(<h3>).*?(</h3>)",
                          lambda m: m.group(1) + TITULO + m.group(2), novo, count=1, flags=re.S)
            novo = re.sub(r"(<p>).*?(</p>)",
                          lambda m: m.group(1) + TEXTO + m.group(2), novo, count=1, flags=re.S)
            # preserva class="btn-cta" onde ela existe — as duas variantes convivem
            novo = re.sub(r'<a href="[^"]*"([^>]*)>.*?</a>',
                          lambda m: '<a href="%s"%s>%s</a>' % (DESTINO, m.group(1), BOTAO),
                          novo, count=1, flags=re.S)
            t = t.replace(bloco, novo, 1)
            feitas += 1

        if feitas:
            arquivos += 1
            trocas += feitas
            print("  %-52s %d" % (str(p.relative_to(RAIZ))[:52], feitas))
            if not check:
                with open(p, "w", encoding="utf-8", newline="") as fh:
                    fh.write(t)

    print()
    print("=" * 74)
    print("%s: %d card(s) em %d arquivo(s)" % ("SIMULACAO" if check else "APLICADO", trocas, arquivos))
    print("=" * 74)

    if not check:
        sobrando = []
        for p in RAIZ.rglob("*.html"):
            if ".git" in p.parts:
                continue
            with open(p, encoding="utf-8", newline="") as fh:
                conteudo = fh.read()
            for bloco in RX_CARD.findall(conteudo):
                if "/lives" in bloco:
                    sobrando.append(p.name)
        print("cards laterais ainda apontando para /lives: %d" % len(sobrando))
        if sobrando:
            print("!! %s" % sorted(set(sobrando)))
            return 1
        print()
        print("A classe .sidebar-cta e a do botão não foram tocadas:")
        print("fundo azul-marinho e botão dourado permanecem idênticos.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
