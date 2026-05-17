#!/usr/bin/env python3
"""
Gera os 9 broadcasts de convite pras Lives 2, 3 e 4 a partir dos templates
D-3, D-0 e AOVIVO da Live 1.

Atualizado em 17/05/2026 pra refletir o replanejamento de 06/05/2026:
4 lives concentradas (seg 29/06 → qui 02/07), janela só anual.

Lê:
  email-templates/broadcasts/convites-lives/live-1-debito-credito/
    D-3.html · D-0.html · AOVIVO.html

Gera (9 arquivos):
  email-templates/broadcasts/convites-lives/live-2-cpc-51/
    D-3.html · D-0.html · AOVIVO.html
  email-templates/broadcasts/convites-lives/live-3-lancamento/
    D-3.html · D-0.html · AOVIVO.html
  email-templates/broadcasts/convites-lives/live-4-plataforma/
    D-3.html · D-0.html · AOVIVO.html

Uso:
    python scripts/generate_live_invites.py
"""
from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# ========== Config ==========
TEMPLATE_DIR = Path("email-templates/broadcasts/convites-lives/live-1-debito-credito")
OUTPUT_BASE  = Path("email-templates/broadcasts/convites-lives")
EMAILS = ["D-3.html", "D-0.html", "AOVIVO.html"]

# Substituições por live. ORDEM IMPORTA — strings longas antes das curtas
# pra evitar over-replacement (ex: "Débito e Crédito ao vivo" antes de "Débito e Crédito").
LIVES = {
    # ────────────────────────────────────────────────────────────────────
    "live-2-cpc-51": [
        # Slugs e identidade
        ("live-1-debito-credito", "live-2-cpc-51"),
        # Tema (ordem importa: composta primeiro)
        ("Débito e Crédito ao vivo",                "CPC 51 ao vivo"),
        ("HOJE 20h: Débito e Crédito",              "HOJE 20h: CPC 51"),
        ("sobre Débito e Crédito",                  "sobre CPC 51"),
        ("Live 1 sobre <strong style=\"color:#1B2A4A;\">Débito e Crédito</strong>",
         "Live 2 sobre <strong style=\"color:#1B2A4A;\">CPC 51</strong>"),
        ("Débito e Crédito — onde tudo começa",     "CPC 51 — a palavra mais cobrada"),
        ("DÉBITO E CRÉDITO",                        "CPC 51"),
        ("Débito e Crédito",                        "CPC 51"),
        # Identidade da live (LIVE/Live)
        ("LIVE 1 ·",  "LIVE 2 ·"),
        ("Live 1 ·",  "Live 2 ·"),
        ("Live 1 começou",  "Live 2 começou"),
        ("Live 1 começa",   "Live 2 começa"),
        ("a Live 1",   "a Live 2"),
        # Datas e dias da semana
        ("segunda-feira, 29 de junho",   "terça-feira, 30 de junho"),
        ("segunda, 29 de junho",         "terça, 30 de junho"),
        ("Segunda-feira começa",         "Terça-feira continua"),
        ("Hoje começa a <strong style=\"color:#1B2A4A;\">semana das 4 lives gratuitas</strong>",
         "Hoje é a <strong style=\"color:#1B2A4A;\">segunda das 4 lives gratuitas</strong>"),
        ("Segunda 29/06",   "Terça 30/06"),
        ("segunda · 29/06", "terça · 30/06"),
        ("29 de junho",     "30 de junho"),
        ("29/06",           "30/06"),
        ("Até segunda",     "Até terça"),
        ("segunda às 20h",  "terça às 20h"),
        ("Não pode segunda",  "Não pode terça"),
        # Subheads e copy
        ('"Onde tudo começa."',  '"A palavra mais cobrada."'),
        ("Onde tudo começa",     "A palavra mais cobrada"),
        ("tema mais fundamental:",  "tema com mais pegadinha de banca:"),
        ("A primeira é em",         "A segunda é em"),
        ("A primeira tem o tema",   "A segunda tem o tema"),
        # 3 ganchos do D-3
        ("A <strong style=\"color:#1B2A4A;\">lógica</strong> por trás de Débito e Crédito — sem decoreba",
         "O que mudou do <strong style=\"color:#1B2A4A;\">CPC 26 pro CPC 51</strong> — na prática"),
        ("O erro mais comum em lançamentos (e como evitar)",
         "Por que algumas bancas chamam CPC 51 de \"o CPC que matou o CPC 26\""),
        ("A base que conecta com as outras 3 lives da semana",
         "As armadilhas de CPC 51 já cobradas em CEBRASPE, FGV e FCC"),
        # Preview text
        ("Em algumas horas a Live 1 começa", "Em algumas horas a Live 2 começa"),
        ("Última chamada de inscrição.",     "Última chamada de inscrição."),
        ("Inscrição gratuita — só hoje pra você se inscrever.",
         "Inscrição gratuita — entra antes do bicho pegar."),
    ],
    # ────────────────────────────────────────────────────────────────────
    "live-3-lancamento": [
        ("live-1-debito-credito", "live-3-lancamento"),
        # Tema
        ("Débito e Crédito ao vivo",                "Lançamento Oficial ao vivo"),
        ("HOJE 20h: Débito e Crédito",              "HOJE 20h: A CASA ABRE"),
        ("sobre Débito e Crédito",                  "sobre o Lançamento Oficial"),
        ("Live 1 sobre <strong style=\"color:#1B2A4A;\">Débito e Crédito</strong>",
         "Live 3 do <strong style=\"color:#1B2A4A;\">Lançamento Oficial</strong>"),
        ("Débito e Crédito — onde tudo começa",     "Lançamento Oficial — a casa abre"),
        ("DÉBITO E CRÉDITO",                        "LANÇAMENTO OFICIAL"),
        ("Débito e Crédito",                        "Lançamento Oficial"),
        # Identidade
        ("LIVE 1 ·",  "🚨 LIVE 3 ·"),
        ("Live 1 ·",  "Live 3 ·"),
        ("Live 1 começou",  "Live 3 começou"),
        ("Live 1 começa",   "Live 3 começa"),
        ("a Live 1",   "a Live 3"),
        # Datas
        ("segunda-feira, 29 de junho",   "quarta-feira, 1º de julho"),
        ("segunda, 29 de junho",         "quarta, 1º de julho"),
        ("Segunda-feira começa",         "Quarta-feira é o dia do lançamento"),
        ("Hoje começa a <strong style=\"color:#1B2A4A;\">semana das 4 lives gratuitas</strong>",
         "Hoje é o <strong style=\"color:#C0392B;\">dia do lançamento oficial</strong>"),
        ("Segunda 29/06",   "Quarta 01/07"),
        ("segunda · 29/06", "quarta · 01/07"),
        ("29 de junho",     "1º de julho"),
        ("29/06",           "01/07"),
        ("Até segunda",     "Até quarta"),
        ("segunda às 20h",  "quarta às 20h"),
        ("Não pode segunda",  "Não pode quarta"),
        # Subheads
        ('"Onde tudo começa."',  '"A casa abre, ao vivo."'),
        ("Onde tudo começa",     "A casa abre, ao vivo"),
        ("tema mais fundamental:",  "evento mais importante da semana:"),
        ("A primeira é em",         "A terceira é em"),
        ("A primeira tem o tema",   "A terceira é o lançamento"),
        # 3 ganchos D-3
        ("A <strong style=\"color:#1B2A4A;\">lógica</strong> por trás de Débito e Crédito — sem decoreba",
         "As vagas do <strong style=\"color:#1B2A4A;\">Fluência Contábil</strong> entram no ar ao vivo"),
        ("O erro mais comum em lançamentos (e como evitar)",
         "Bônus <strong style=\"color:#1B2A4A;\">Acesso Fundador</strong> exclusivo de quem decide na janela"),
        ("A base que conecta com as outras 3 lives da semana",
         "Por que essa noite é a virada de chave — sem repeteco"),
        # Preview text
        ("Em algumas horas a Live 1 começa", "Em algumas horas a casa abre"),
        ("Última chamada de inscrição.",     "A janela do Acesso Fundador abre ao vivo."),
        ("Inscrição gratuita — só hoje pra você se inscrever.",
         "Inscrição gratuita — vale estar presente, evento único."),
        # Tom dos CTAs
        ("QUERO MINHA VAGA →",           "QUERO ESTAR NO LANÇAMENTO →"),
        ("GARANTIR VAGA GRATUITA →",     "GARANTIR PRESENÇA NO LANÇAMENTO →"),
    ],
    # ────────────────────────────────────────────────────────────────────
    "live-4-plataforma": [
        ("live-1-debito-credito", "live-4-plataforma"),
        # Tema
        ("Débito e Crédito ao vivo",                "Tour pela Plataforma ao vivo"),
        ("HOJE 20h: Débito e Crédito",              "HOJE 20h: Tour pela Plataforma"),
        ("sobre Débito e Crédito",                  "sobre a Plataforma"),
        ("Live 1 sobre <strong style=\"color:#1B2A4A;\">Débito e Crédito</strong>",
         "Live 4 com o <strong style=\"color:#1B2A4A;\">tour da plataforma</strong>"),
        ("Débito e Crédito — onde tudo começa",     "Tour pela Plataforma — a casa por dentro"),
        ("DÉBITO E CRÉDITO",                        "TOUR PELA PLATAFORMA"),
        ("Débito e Crédito",                        "Tour pela Plataforma"),
        # Identidade
        ("LIVE 1 ·",  "LIVE 4 ·"),
        ("Live 1 ·",  "Live 4 ·"),
        ("Live 1 começou",  "Live 4 começou"),
        ("Live 1 começa",   "Live 4 começa"),
        ("a Live 1",   "a Live 4"),
        # Datas
        ("segunda-feira, 29 de junho",   "quinta-feira, 2 de julho"),
        ("segunda, 29 de junho",         "quinta, 2 de julho"),
        ("Segunda-feira começa",         "Quinta-feira encerra"),
        ("Hoje começa a <strong style=\"color:#1B2A4A;\">semana das 4 lives gratuitas</strong>",
         "Hoje é a <strong style=\"color:#1B2A4A;\">última das 4 lives gratuitas</strong>"),
        ("Segunda 29/06",   "Quinta 02/07"),
        ("segunda · 29/06", "quinta · 02/07"),
        ("29 de junho",     "2 de julho"),
        ("29/06",           "02/07"),
        ("Até segunda",     "Até quinta"),
        ("segunda às 20h",  "quinta às 20h"),
        ("Não pode segunda",  "Não pode quinta"),
        # Subheads
        ('"Onde tudo começa."',  '"A casa por dentro."'),
        ("Onde tudo começa",     "A casa por dentro"),
        ("tema mais fundamental:",  "último encontro da série:"),
        ("A primeira é em",         "A última é em"),
        ("A primeira tem o tema",   "A última te leva por dentro da plataforma"),
        # 3 ganchos
        ("A <strong style=\"color:#1B2A4A;\">lógica</strong> por trás de Débito e Crédito — sem decoreba",
         "Tour ao vivo da <strong style=\"color:#1B2A4A;\">plataforma</strong> — módulos, aulas, materiais"),
        ("O erro mais comum em lançamentos (e como evitar)",
         "Como o curso vive na prática — não slide bonito"),
        ("A base que conecta com as outras 3 lives da semana",
         "Tira-dúvidas pré-decisão antes da janela do Fundador fechar (05/07)"),
        # Preview text
        ("Em algumas horas a Live 1 começa", "Em algumas horas a Live 4 começa"),
        ("Última chamada de inscrição.",     "Último encontro da série."),
        ("Inscrição gratuita — só hoje pra você se inscrever.",
         "Inscrição gratuita — última chance de ver a plataforma ao vivo."),
    ],
}


def generate_live(live_slug: str, substitutions: list[tuple[str, str]]) -> int:
    output_dir = OUTPUT_BASE / live_slug
    output_dir.mkdir(parents=True, exist_ok=True)

    count = 0
    for email_file in EMAILS:
        source = TEMPLATE_DIR / email_file
        dest = output_dir / email_file

        if not source.exists():
            print(f"  [skip] template não existe: {source}")
            continue

        with open(source, "r", encoding="utf-8") as f:
            content = f.read()

        for old, new in substitutions:
            content = content.replace(old, new)

        with open(dest, "w", encoding="utf-8", newline="\n") as f:
            f.write(content)

        count += 1
        print(f"  ok {dest}")

    return count


def main() -> int:
    missing = [f for f in EMAILS if not (TEMPLATE_DIR / f).exists()]
    if missing:
        print(f"ERRO: templates faltando em {TEMPLATE_DIR}:")
        for f in missing:
            print(f"  - {f}")
        return 1

    print(f"Gerando broadcasts de convite a partir de {TEMPLATE_DIR}...\n")
    total = 0
    for slug, subs in LIVES.items():
        print(f"-> {slug}")
        total += generate_live(slug, subs)
        print()

    print(f"Pronto. Total: {total} broadcasts gerados ({len(LIVES)} lives × {len(EMAILS)} emails).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
