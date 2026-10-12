#!/usr/bin/env python3
"""Põe o vídeo da semana na página de links (links.html).

É o único passo manual da rotina da página; o resto entra sozinho (ver scripts/LINKS.md).

    python scripts/links_video.py https://youtu.be/XXXXXXXXXXX --titulo "Título do vídeo"
    python scripts/links_video.py <url> --titulo "..." --data 2026-10-15T19:00
    python scripts/links_video.py <url> --titulo "..." --data 2026-10-15T19:00 --estreia

Sem --data, vale hoje. Com data e hora futuras, o vídeo só aparece na página na hora
marcada: dá para mesclar o PR na véspera. Com --estreia ele aparece antes, anunciado
como estreia (use só quando o vídeo foi programado como Estreia no YouTube, que tem
página pública; o link de um vídeo apenas agendado ainda é privado).

Rodar de novo com o mesmo vídeo atualiza o item em vez de duplicar. Só biblioteca padrão.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from datetime import date
from pathlib import Path

RAIZ = Path(__file__).resolve().parent.parent
ARQUIVO = RAIZ / "assets" / "links" / "links.json"

# As mesmas regras que a página aplica (links.html): se divergirem, o item some em silêncio.
VIDEO = re.compile(
    r"^https://(?:www\.|m\.)?(?:youtube\.com/(?:live/|shorts/|embed/|watch\?(?:[^#]*&)?v=)|youtu\.be/)"
    r"([A-Za-z0-9_-]{11})(?![A-Za-z0-9_-])"
)
DATA = re.compile(r"^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$")
NOME = re.compile(r"^[a-z0-9][a-z0-9._-]{0,39}$")


def erro(mensagem: str) -> int:
    print(f"links_video: {mensagem}", file=sys.stderr)
    return 1


def main(argv: list[str] | None = None) -> int:
    # No Windows a saída redirecionada é cp1252: um título com emoji derrubaria o
    # comando DEPOIS de gravar o arquivo.
    for saida in (sys.stdout, sys.stderr):
        if hasattr(saida, "reconfigure"):
            saida.reconfigure(encoding="utf-8", errors="replace")
    p = argparse.ArgumentParser(description="Põe o vídeo da semana na página de links.")
    p.add_argument("url", help="endereço do vídeo no YouTube")
    p.add_argument("--titulo", required=True, help="título como está no YouTube")
    p.add_argument("--data", default=date.today().isoformat(), help="AAAA-MM-DD ou AAAA-MM-DDTHH:MM (padrão: hoje)")
    p.add_argument("--estreia", action="store_true", help="vídeo programado como Estreia: aparece antes da hora")
    p.add_argument("--id", dest="nome", help="nome do botão no rastreamento (padrão: video-AAAA-MM-DD)")
    p.add_argument("--arquivo", type=Path, default=ARQUIVO, help=argparse.SUPPRESS)
    a = p.parse_args(argv)

    achado = VIDEO.match(a.url)
    if not achado:
        return erro(f"não reconheci um vídeo do YouTube em {a.url!r}")
    if not DATA.match(a.data):
        return erro(f"data {a.data!r} fora do formato AAAA-MM-DD ou AAAA-MM-DDTHH:MM")
    titulo = " ".join(a.titulo.split())
    if not titulo:
        return erro("título vazio")
    nome = a.nome or f"video-{a.data[:10]}"
    if not NOME.match(nome) or nome == "gravacao":
        return erro(f"id {nome!r} inválido: minúsculas, números, ponto, hífen e sublinhado, até 40 caracteres")

    dados = json.loads(a.arquivo.read_text(encoding="utf-8"))
    itens = dados.setdefault("novidades", [])
    mesmo_video = [n for n in itens if (VIDEO.match(n.get("url", "")) or [None, None])[1] == achado.group(1)]
    outro_com_o_nome = [n for n in itens if n.get("id") == nome and n not in mesmo_video]
    if outro_com_o_nome:
        return erro(f"já existe outro item com o id {nome!r}; passe --id com outro nome")

    item = {"id": nome, "tipo": "video", "data": a.data, "titulo": titulo, "url": a.url}
    if a.estreia:
        item["estreia"] = True
    if mesmo_video:
        # Mantém o nome do botão já em uso: é ele que aparece nos relatórios.
        if not a.nome:
            item["id"] = mesmo_video[0]["id"]
        itens[itens.index(mesmo_video[0])] = item
        for repetido in mesmo_video[1:]:
            itens.remove(repetido)
        feito = "atualizado"
    else:
        itens.insert(0, item)
        feito = "acrescentado"

    # newline="\n": no Windows o Python gravaria CRLF e o diff do arquivo inteiro mudaria.
    with a.arquivo.open("w", encoding="utf-8", newline="\n") as f:
        json.dump(dados, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(f"{feito}: {item['id']} · {item['data']} · {titulo}")
    print("agora: node --test scripts/links.test.mjs, commit de assets/links/links.json e PR")
    return 0


if __name__ == "__main__":
    sys.exit(main())
