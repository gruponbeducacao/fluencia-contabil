# -*- coding: utf-8 -*-
"""
Bump do cache-buster de email-capture.js/.css em todo o site.

Por que isso é necessário: os assets são servidos com `Cache-Control: max-age=14400`
(4 horas no CDN) e referenciados com `?v=AAAAMMDD` fixo. Quando o conteúdo do JS muda
mas o `?v=` não, o navegador de quem já visitou o site continua servindo a versão
antiga do próprio cache — e o CDN idem. Foi o que aconteceu com o CTA inline: o
arquivo novo estava na main e no origin, e a produção continuava entregando
"De 4 a 7 de agosto".

Trocar o `?v=` faz a URL ser outra, o que força busca nova em todas as camadas.

REGRA: todo commit que altere email-capture.js ou email-capture.css tem de vir
acompanhado de um bump aqui.

Uso:
  PY="C:/Users/vfnev/AppData/Local/Python/pythoncore-3.14-64/python.exe"
  "$PY" scripts/bump_cachebuster.py 20260819           # aplica
  "$PY" scripts/bump_cachebuster.py 20260819 --check   # só relata
"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parent.parent
RX = re.compile(r'(email-capture\.(?:js|css))\?v=(\d{8})')


def main(argv):
    args = [a for a in argv[1:] if not a.startswith("--")]
    if not args or not re.fullmatch(r"\d{8}", args[0]):
        print("uso: bump_cachebuster.py AAAAMMDD [--check]")
        return 2
    novo = args[0]
    check = "--check" in argv

    arquivos, trocas, versoes_antes = 0, 0, set()

    for p in sorted(RAIZ.rglob("*.html")):
        if ".git" in p.parts:
            continue
        # newline="" preserva os EOL byte a byte; o repo é CRLF e tem arquivos de
        # EOL misto, que uma escrita normal reescreveria por inteiro
        with open(p, encoding="utf-8", newline="") as fh:
            t = fh.read()
        achados = RX.findall(t)
        if not achados:
            continue
        versoes_antes.update(v for _, v in achados)
        alvo = [(a, v) for a, v in achados if v != novo]
        if not alvo:
            continue
        t2 = RX.sub(lambda m: "%s?v=%s" % (m.group(1), novo), t)
        arquivos += 1
        trocas += len(alvo)
        print("  %-52s %d referência(s)" % (str(p.relative_to(RAIZ))[:52], len(alvo)))
        if not check:
            with open(p, "w", encoding="utf-8", newline="") as fh:
                fh.write(t2)

    print()
    print("=" * 74)
    print("%s: %d referência(s) em %d arquivo(s) → ?v=%s" % (
        "SIMULACAO" if check else "APLICADO", trocas, arquivos, novo))
    print("versões encontradas antes: %s" % ", ".join(sorted(versoes_antes)))
    print("=" * 74)

    if not check:
        restantes = set()
        for p in RAIZ.rglob("*.html"):
            if ".git" in p.parts:
                continue
            with open(p, encoding="utf-8", newline="") as fh:
                restantes.update(v for _, v in RX.findall(fh.read()))
        print("versões em uso agora: %s" % ", ".join(sorted(restantes)))
        if restantes - {novo}:
            print("!! sobrou versão antiga — o bump não ficou uniforme")
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
