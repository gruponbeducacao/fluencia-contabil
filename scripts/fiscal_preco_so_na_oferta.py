"""Fiscal: o preco so' pode aparecer a partir da secao da oferta.

Decisao do Vinicius em 03/09/2026 para a LP do Pacote SEFAZ AL: o header nao
mostra preco, e o valor e' revelado so' na oferta. Regra sem fiscal volta a ser
violada no proximo commit — este script existe para que ela nao volte em
silencio.

O que ele NAO faz: julgar o texto. Ele so' pergunta "este numero aparece antes
da ancora?". Metadado (`<meta>`, `og:`, `twitter:`) fica de fora de proposito —
ele nao e' visivel na pagina, e mexer nele e' decisao de SEO, nao de layout.
Comentario de codigo tambem fica de fora: o comentario-guarda dos planos cita os
valores justamente para documentar a regra.

Uso:
    py -3 scripts/fiscal_preco_so_na_oferta.py sefaz-al-2026.html
    py -3 scripts/fiscal_preco_so_na_oferta.py            # varre as LPs conhecidas

Sai com codigo 1 se achar preco antes da oferta.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent

# Cada LP com a ancora a partir da qual o preco e' permitido.
ALVOS: dict[str, str] = {
    "sefaz-al-2026.html": '<section class="section oferta" id="oferta">',
}

# Grafias do preco. Inclui a versao com &nbsp; porque e' invisivel no diff.
PADROES = [
    re.compile(r"R\$\s*(?:&nbsp;)?\s*237\b"),
    re.compile(r"\b24,51\b"),
    re.compile(r"\b294,12\b"),
    re.compile(r'"price"\s*:\s*"?237'),
]

# Linhas que nao contam: nao sao texto visivel da pagina.
IGNORAR = re.compile(r"<meta\b|<title\b|og:|twitter:")

# Comentarios sao neutralizados, nao removidos: trocar o conteudo por espacos
# preserva a contagem de linhas, entao o numero que o fiscal reporta continua
# batendo com o editor. Detectar comentario pelo INICIO da linha nao funciona —
# o comentario-guarda dos planos tem linhas internas sem marcador nenhum.
COMENTARIOS = re.compile(r"/\*.*?\*/|<!--.*?-->", re.DOTALL)


def sem_comentarios(texto: str) -> str:
    return COMENTARIOS.sub(lambda m: re.sub(r"[^\n]", " ", m.group(0)), texto)


def linhas_com_preco(html: str, ate: int) -> list[tuple[int, str]]:
    limpo = sem_comentarios(html[:ate])
    originais = html[:ate].split("\n")
    achados: list[tuple[int, str]] = []
    for n, linha in enumerate(limpo.split("\n"), start=1):
        if IGNORAR.search(linha):
            continue
        if any(p.search(linha) for p in PADROES):
            achados.append((n, originais[n - 1].strip()[:150]))
    return achados


def confere(caminho: Path, ancora: str) -> bool:
    html = caminho.read_text(encoding="utf-8").replace("\r\n", "\n")
    pos = html.find(ancora)
    if pos < 0:
        print(f"  FALHA  {caminho.name}: ancora da oferta nao encontrada")
        print(f"         esperava: {ancora}")
        return False

    achados = linhas_com_preco(html, pos)
    linha_ancora = html[:pos].count("\n") + 1

    if achados:
        print(f"  FALHA  {caminho.name}: preco aparece antes da oferta (linha {linha_ancora})")
        for n, texto in achados:
            print(f"         linha {n}: {texto}")
        return False

    depois = len([1 for p in PADROES for _ in p.finditer(html[pos:])])
    print(f"  ok     {caminho.name}: nenhum preco antes da linha {linha_ancora}; {depois} ocorrencias a partir da oferta")
    return True


def main() -> int:
    alvos = ALVOS
    if len(sys.argv) > 1:
        nome = Path(sys.argv[1]).name
        if nome not in ALVOS:
            print(f"  {nome} nao esta em ALVOS — adicione a ancora da oferta dele no script.")
            return 2
        alvos = {nome: ALVOS[nome]}

    print("Fiscal: o preco so' aparece a partir da secao da oferta\n")
    ok = True
    for nome, ancora in alvos.items():
        caminho = RAIZ / nome
        if not caminho.exists():
            print(f"  FALHA  {nome}: arquivo nao encontrado")
            ok = False
            continue
        ok = confere(caminho, ancora) and ok

    print()
    print("PASSOU" if ok else "REPROVOU")
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
