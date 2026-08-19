#!/usr/bin/env python3
"""
Fluência Contábil — troca "Os Desafios" por "Editais" no menu do site.

One-shot: o catálogo de editais toma a vaga de `desafios.html` no menu, e a
página dos desafios é aposentada (sai do menu, do sitemap e do ar) — decisão do
Vinícius em 19/08/2026.

O site não tem include: nav, menu mobile e rodapé são duplicados à mão em cada
HTML. Este script faz a troca nos 7 arquivos que linkam, no mapa de item ativo
(que é JS, não link) e no sitemap — o padrão da casa para mudança cross-page
(ver apply_onda1_to_blog.py, update_cta_button_texts.py).

GUARDA: aborta se `editais.html` não existir. Trocar o menu antes de a página
existir deixaria um item apontando para 404 em TODAS as páginas do site — o
pior resultado possível desta mudança.

Uso:
    python scripts/migrar_desafios_para_editais.py --dry-run
    python scripts/migrar_desafios_para_editais.py

Sem dependências externas. Preserva o CRLF dos arquivos (o repo usa CRLF; gravar
LF marcaria como alterada cada linha que não mudou).
"""

from __future__ import annotations

import argparse
import os
import re
import sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGINA_NOVA = "editais.html"
PAGINA_VELHA = "desafios.html"

# (velho, novo) — cada par cobre um dos contextos em que o link aparece.
# O 4º é o mapa JS que marca o item ativo do menu, não um link.
TROCAS = [
    (
        '<li><a href="desafios.html" id="lnk-des">Os Desafios</a></li>',
        '<li><a href="editais.html" id="lnk-edi">Editais</a></li>',
    ),
    (
        '<li><a href="desafios.html">Os Desafios</a></li>',
        '<li><a href="editais.html">Editais</a></li>',
    ),
    (
        '<a href="desafios.html">Os Desafios</a>',
        '<a href="editais.html">Editais</a>',
    ),
    (
        "'desafios.html':'lnk-des'",
        "'editais.html':'lnk-edi'",
    ),
]

ENTRADA_SITEMAP = (
    '  <url><loc>https://fluenciacontabil.com.br/editais.html</loc>'
    '<lastmod>{hoje}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>'
)


def arquivos_alvo() -> list[str]:
    """HTMLs da raiz que citam a página velha (os posts do blog não citam)."""
    out = []
    for nome in sorted(os.listdir(RAIZ)):
        if not nome.endswith(".html") or nome == PAGINA_VELHA:
            continue
        caminho = os.path.join(RAIZ, nome)
        with open(caminho, encoding="utf-8", newline="") as f:
            if PAGINA_VELHA in f.read():
                out.append(caminho)
    return out


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="não escreve; só relata")
    ap.add_argument("--hoje", default=None, help="data do lastmod (AAAA-MM-DD)")
    args = ap.parse_args()

    if not os.path.exists(os.path.join(RAIZ, PAGINA_NOVA)):
        print(
            f"[migrar] {PAGINA_NOVA} não existe — abortando.\n"
            "[migrar] Gere a página ANTES de trocar o menu; senão as ~26 páginas do site\n"
            "         passam a ter um item de menu apontando para 404.\n"
            "[migrar]   python scripts/generate_catalogo_editais.py",
            file=sys.stderr,
        )
        return 1

    alvos = arquivos_alvo()
    if not alvos:
        print("[migrar] nenhum arquivo cita a página velha — nada a fazer.")
        return 0

    total = 0
    for caminho in alvos:
        with open(caminho, encoding="utf-8", newline="") as f:
            antes = f.read()
        depois = antes
        for velho, novo in TROCAS:
            depois = depois.replace(velho, novo)

        n = antes.count(PAGINA_VELHA) - depois.count(PAGINA_VELHA)
        restam = depois.count(PAGINA_VELHA)
        nome = os.path.basename(caminho)
        if restam:
            # contexto não previsto: melhor parar do que deixar link quebrado
            print(
                f"[migrar] {nome}: {restam} ocorrência(s) de {PAGINA_VELHA} em contexto "
                "não previsto — abortando sem escrever nada.",
                file=sys.stderr,
            )
            trecho = re.search(r".{0,70}desafios\.html.{0,70}", depois)
            if trecho:
                print(f"[migrar]   ...{trecho.group(0)}...", file=sys.stderr)
            return 1

        total += n
        print(f"[migrar] {nome}: {n} troca(s)")
        if not args.dry_run and depois != antes:
            with open(caminho, "w", encoding="utf-8", newline="") as f:
                f.write(depois)

    # sitemap: a entrada velha sai, a nova entra no lugar
    sm = os.path.join(RAIZ, "sitemap.xml")
    with open(sm, encoding="utf-8", newline="") as f:
        antes = f.read()
    quebra = "\r\n" if "\r\n" in antes else "\n"
    linhas = [l for l in antes.split(quebra) if PAGINA_VELHA not in l]
    if len(linhas) == len(antes.split(quebra)):
        print("[migrar] sitemap: entrada de desafios não encontrada (já removida?)")
    hoje = args.hoje or __import__("datetime").date.today().isoformat()
    nova = ENTRADA_SITEMAP.format(hoje=hoje)
    if PAGINA_NOVA not in antes:
        for i, l in enumerate(linhas):
            if "/cursos.html" in l:  # entra logo depois de Meus Cursos
                linhas.insert(i + 1, nova)
                break
    depois = quebra.join(linhas)
    print(f"[migrar] sitemap: -1 desafios, +1 editais (lastmod {hoje})")
    if not args.dry_run:
        with open(sm, "w", encoding="utf-8", newline="") as f:
            f.write(depois)

    velha = os.path.join(RAIZ, PAGINA_VELHA)
    print(f"[migrar] {PAGINA_VELHA}: remover ({os.path.getsize(velha)} bytes)")
    if not args.dry_run:
        os.remove(velha)

    print(f"[migrar] {'(dry-run) ' if args.dry_run else ''}{total} links trocados em {len(alvos)} arquivos.")
    if not args.dry_run:
        print("[migrar] Confira o menu em uma página antes de commitar.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
