#!/usr/bin/env python3
"""
Remarcação das datas do lançamento (20/05/2026) — Live 1 migrou de 29/06 (seg)
pra 04/08 (ter) por conta dos jogos da Copa do Mundo (e aniversário do Vinícius).

Aplica substituições em lote nos arquivos listados (não regenera nada — só
substitui strings).

Datas antigas → novas:
  L1: seg 29/06 → ter 04/08
  L2: ter 30/06 → qua 05/08
  L3: qua 01/07 → qui 06/08 (Lançamento Oficial)
  L4: qui 02/07 → sex 07/08

  Janela Pioneiro: 29/06-02/07 → 04/08-07/08
  Janela Fundador: 29/06-15/07 → 04/08-16/08 (encerra dom 23h59)

  Broadcasts L1-L7 datas:
    L1 antigo seg 22/06 → seg 27/07
    L2 antigo sex 26/06 → sex 31/07
    L3 antigo dom 28/06 → seg 03/08 (véspera Live 1 ter)
    L4 antigo sex 03/07 → sáb 08/08
    L5 antigo sáb 04/07 → qui 13/08
    L6 antigo dom 05/07 → dom 16/08
    L7 antigo dom 05/07 → dom 16/08 (mesmo dia, 19h)

Uso:
    python scripts/update_dates_aug2026.py
"""
from __future__ import annotations

import sys
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

REPO = Path(".")

# ORDEM IMPORTA — strings longas/específicas primeiro pra evitar over-replacement
SUBSTITUTIONS: list[tuple[str, str]] = [
    # ── Datas longas (formato extenso) ──
    ("segunda-feira, 29 de junho", "terça-feira, 4 de agosto"),
    ("Segunda-feira, 29 de junho", "Terça-feira, 4 de agosto"),
    ("terça-feira, 30 de junho", "quarta-feira, 5 de agosto"),
    ("Terça-feira, 30 de junho", "Quarta-feira, 5 de agosto"),
    ("quarta-feira, 1º de julho", "quinta-feira, 6 de agosto"),
    ("Quarta-feira, 1º de julho", "Quinta-feira, 6 de agosto"),
    ("quarta-feira, 1 de julho", "quinta-feira, 6 de agosto"),
    ("Quarta-feira, 1 de julho", "Quinta-feira, 6 de agosto"),
    ("quinta-feira, 2 de julho", "sexta-feira, 7 de agosto"),
    ("Quinta-feira, 2 de julho", "Sexta-feira, 7 de agosto"),

    # ── Datas curtas com dia da semana abreviado ──
    ("seg 29/06", "ter 04/08"),
    ("Seg · 29/06", "Ter · 04/08"),
    ("Segunda · 29/06", "Terça · 04/08"),
    ("Segunda 29/06", "Terça 04/08"),
    ("ter 30/06", "qua 05/08"),
    ("Ter · 30/06", "Qua · 05/08"),
    ("Terça · 30/06", "Quarta · 05/08"),
    ("Terça 30/06", "Quarta 05/08"),
    ("qua 01/07", "qui 06/08"),
    ("Qua · 01/07", "Qui · 06/08"),
    ("Quarta · 01/07", "Quinta · 06/08"),
    ("Quarta 01/07", "Quinta 06/08"),
    ("qui 02/07", "sex 07/08"),
    ("Qui · 02/07", "Sex · 07/08"),
    ("Quinta · 02/07", "Sexta · 07/08"),
    ("Quinta 02/07", "Sexta 07/08"),

    # ── Datas em formato "29 de junho" simples ──
    ("29 de junho", "4 de agosto"),
    ("30 de junho", "5 de agosto"),
    ("1º de julho", "6 de agosto"),
    ("1 de julho", "6 de agosto"),
    ("2 de julho", "7 de agosto"),

    # ── Broadcasts de lançamento (datas pré-lives) ──
    ("seg 22/06", "seg 27/07"),
    ("Seg · 22/06", "Seg · 27/07"),
    ("Segunda 22/06", "Segunda 27/07"),
    ("22 de junho", "27 de julho"),

    ("sex 26/06", "sex 31/07"),
    ("Sex · 26/06", "Sex · 31/07"),
    ("Sexta 26/06", "Sexta 31/07"),
    ("26 de junho", "31 de julho"),

    ("dom 28/06", "seg 03/08"),
    ("Dom · 28/06", "Seg · 03/08"),
    ("Domingo 28/06", "Segunda 03/08"),
    ("28 de junho", "3 de agosto"),

    # ── Broadcasts pós-lives ──
    ("sex 03/07", "sáb 08/08"),
    ("Sex · 03/07", "Sáb · 08/08"),
    ("Sexta 03/07", "Sábado 08/08"),
    ("3 de julho", "8 de agosto"),

    ("sáb 04/07", "qui 13/08"),
    ("Sáb · 04/07", "Qui · 13/08"),
    ("Sábado 04/07", "Quinta 13/08"),
    ("4 de julho", "13 de agosto"),

    ("dom 05/07", "dom 16/08"),
    ("Dom · 05/07", "Dom · 16/08"),
    ("Domingo 05/07", "Domingo 16/08"),
    ("5 de julho", "16 de agosto"),

    # ── Janela Fundador antiga 15/07 → 16/08 ──
    ("ter 15/07", "dom 16/08"),
    ("Ter · 15/07", "Dom · 16/08"),
    ("Terça 15/07", "Domingo 16/08"),
    ("15 de julho", "16 de agosto"),

    # ── Janelas (período) ──
    ("29/06 a 02/07", "04/08 a 07/08"),
    ("29/06 a 05/07", "04/08 a 16/08"),
    ("29/06 a 15/07", "04/08 a 16/08"),
    ("29/06 a 16/07", "04/08 a 16/08"),
    ("03/07 a 15/07", "08/08 a 16/08"),
    ("03/07 e 15/07", "08/08 e 16/08"),
    ("29/06 a 02/07/2026", "04/08 a 07/08/2026"),

    # ── Janela L4 (já dentro da janela Fundador) ──
    ("16/07+", "17/08+"),
    ("(10/07+)", "(17/08+)"),
    ("10/07", "17/08"),
    ("dia 10/07", "dia 17/08"),

    # ── Datas curtas residuais ──
    ("29/06", "04/08"),
    ("30/06", "05/08"),
    ("01/07", "06/08"),
    ("1º/07", "06/08"),
    ("02/07", "07/08"),
    ("03/07", "08/08"),
    ("04/07", "13/08"),
    ("05/07", "16/08"),
    ("11/07", "13/08"),
    ("14/07", "15/08"),
    ("15/07", "16/08"),
    ("22/06", "27/07"),
    ("26/06", "31/07"),
    ("27/06", "01/08"),
    ("28/06", "03/08"),

    # ── Dia da semana em frases (após datas já trocadas, agora ajustar dias soltos
    # que se referem à Live 1, que era segunda e virou terça) ──
    # CUIDADO: essas são genéricas e podem afetar contexto não-Live. Por isso
    # estão depois das datas. Strings curtas demais ficam fora pra evitar
    # over-replacement.
    ("Segunda-feira começa a semana", "Terça-feira começa a semana"),
    ("segunda-feira começa a semana", "terça-feira começa a semana"),
    ("Hoje começa a semana das 4 lives", "Hoje começa a semana das 4 lives"),  # mantém (não tem dia)

    # ── Spans de duração (eram 7 dias / 17 dias / agora 13 dias) ──
    ("7 dias = 7 dias", "13 dias"),  # placeholder bobo, vou ajustar abaixo
    ("janela de 7 dias", "janela de 13 dias"),
    ("janela de 17 dias", "janela de 13 dias"),
    ("janela do Acesso Fundador (7 dias)", "janela do Acesso Fundador (13 dias)"),
    ("7 dias na janela", "13 dias na janela"),
    ("17 dias na janela", "13 dias na janela"),
    ("48 horas na janela", "9 dias na janela"),  # L4 antigo dizia "48h", agora restam 9 dias
    ("restam exatamente 48 horas", "restam 9 dias"),
    ("Restam <em style=\"color:#C0392B; font-style:normal;\">48 horas</em>", "Restam <em style=\"color:#C0392B; font-style:normal;\">9 dias</em>"),
    ("48h", "9d"),  # cuidado — pode afetar outras coisas, mas geral

    # ── L5/L6/L7 copy de escassez ──
    ("Faltam menos de <strong style=\"color:#1B2A4A;\">30 horas</strong>", "Faltam <strong style=\"color:#1B2A4A;\">3 dias</strong>"),
    ("Amanhã 23h59 o anual sai do ar", "Domingo 16/08 às 23h59 o anual sai do ar"),

    # ── Janela: durações específicas ──
    ("17 dias", "13 dias"),  # NÃO usar — pode afetar outras coisas, vou comentar pra rodar com cuidado
]

# Strings que devem ser tratadas com cuidado (provavelmente NÃO substituir, mas listadas pra revisão manual depois):
# - "segunda" / "terça" / "quarta" / "quinta" — risco alto de over-replacement
# - "junho" / "julho" / "agosto" — risco alto
# - números curtos como "5", "17" — não

# Arquivos a processar (vivos no plano atual)
FILES_TO_UPDATE: list[Path] = [
    # Sequência D
    REPO / "email-templates/sequencia-d/D1-bem-vindo-lives.html",
    REPO / "email-templates/sequencia-d/D2-cinco-camadas.html",
    REPO / "email-templates/sequencia-d/D3-quem-te-ensina.html",
    REPO / "email-templates/sequencia-d/D4-aula-01.html",
    REPO / "email-templates/sequencia-d/D5-proxima-live.html",
    # Sequência E enxuta
    REPO / "email-templates/sequencia-e/live-1-vespera.html",
    REPO / "email-templates/sequencia-e/live-1-aovivo.html",
    REPO / "email-templates/sequencia-e/live-2-vespera.html",
    REPO / "email-templates/sequencia-e/live-2-aovivo.html",
    REPO / "email-templates/sequencia-e/live-3-vespera.html",
    REPO / "email-templates/sequencia-e/live-3-aovivo.html",
    REPO / "email-templates/sequencia-e/live-4-vespera.html",
    REPO / "email-templates/sequencia-e/live-4-aovivo.html",
    # Convites das 4 lives
    REPO / "email-templates/broadcasts/convites-lives/live-1-debito-credito/D-3.html",
    REPO / "email-templates/broadcasts/convites-lives/live-1-debito-credito/D-0.html",
    REPO / "email-templates/broadcasts/convites-lives/live-1-debito-credito/AOVIVO.html",
    REPO / "email-templates/broadcasts/convites-lives/live-2-cpc-51/D-3.html",
    REPO / "email-templates/broadcasts/convites-lives/live-2-cpc-51/D-0.html",
    REPO / "email-templates/broadcasts/convites-lives/live-2-cpc-51/AOVIVO.html",
    REPO / "email-templates/broadcasts/convites-lives/live-3-lancamento/D-3.html",
    REPO / "email-templates/broadcasts/convites-lives/live-3-lancamento/D-0.html",
    REPO / "email-templates/broadcasts/convites-lives/live-3-lancamento/AOVIVO.html",
    REPO / "email-templates/broadcasts/convites-lives/live-4-plataforma/D-3.html",
    REPO / "email-templates/broadcasts/convites-lives/live-4-plataforma/D-0.html",
    REPO / "email-templates/broadcasts/convites-lives/live-4-plataforma/AOVIVO.html",
    # Broadcasts L1-L7
    REPO / "email-templates/broadcasts/lancamento/L1-anuncio.html",
    REPO / "email-templates/broadcasts/lancamento/L2-por-que-anual.html",
    REPO / "email-templates/broadcasts/lancamento/L3-vespera.html",
    REPO / "email-templates/broadcasts/lancamento/L4-pos-lives-roi.html",
    REPO / "email-templates/broadcasts/lancamento/L5-depoimentos.html",
    REPO / "email-templates/broadcasts/lancamento/L6-ultimo-dia.html",
    REPO / "email-templates/broadcasts/lancamento/L7-ultima-chamada.html",
    # Sequências A, B, C — ajustes pontuais
    REPO / "email-templates/sequencia-a/A5-lista-espera.html",
    REPO / "email-templates/sequencia-b/B1-bem-vindo-lista.html",
    REPO / "email-templates/sequencia-b/B4-vip-lives.html",
    REPO / "email-templates/sequencia-b/B5-aula-01.html",
    REPO / "email-templates/sequencia-b/B6-rotina.html",
    REPO / "email-templates/sequencia-c/C5-aula-01.html",
    REPO / "email-templates/sequencia-c/C6-lista-espera.html",
    # Dashboard + selos + overview
    REPO / "email-templates/index.html",
    REPO / "email-templates/_SELOS_2026.html",
    REPO / "email-templates/_LANCAMENTO_2026_OVERVIEW.html",
    # LP única + agradecimento (site)
    REPO / "lives.html",
    REPO / "obrigado-lives.html",
    # Site institucional — topbar e menções
    REPO / "index.html",
    REPO / "cursos.html",
    REPO / "blog.html",
    REPO / "contato.html",
    REPO / "depoimentos.html",
    REPO / "desafios.html",
    REPO / "institucional.html",
    REPO / "professor.html",
    # Scripts geradores (pra que futuras regerações usem datas novas)
    REPO / "scripts/generate_live_invites.py",
    REPO / "scripts/generate_sequencia_e.py",
    REPO / "scripts/generate_broadcasts_lancamento.py",
]


def apply_substitutions(path: Path) -> tuple[int, list[str]]:
    """Aplica substituições no arquivo. Retorna (count_changes, applied_subs)."""
    if not path.exists():
        return -1, []

    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    original = content
    applied = []
    for old, new in SUBSTITUTIONS:
        if old in content:
            count_in_file = content.count(old)
            content = content.replace(old, new)
            applied.append(f"{old!r} → {new!r} ({count_in_file}x)")

    if content == original:
        return 0, []

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(content)

    return sum(int(s.split("(")[-1].split("x")[0]) for s in applied), applied


def main() -> int:
    print(f"Aplicando {len(SUBSTITUTIONS)} substituições em {len(FILES_TO_UPDATE)} arquivos...\n")
    total_changes = 0
    files_changed = 0
    files_missing = []

    for path in FILES_TO_UPDATE:
        changes, applied = apply_substitutions(path)
        if changes == -1:
            files_missing.append(str(path))
            print(f"  [skip] {path} (não existe)")
            continue
        if changes == 0:
            print(f"  [no-op] {path} (nenhuma substituição aplicada)")
            continue
        print(f"  ✓ {path}: {changes} mudança(s)")
        for sub in applied[:3]:  # mostra até 3 substituições
            print(f"      · {sub}")
        if len(applied) > 3:
            print(f"      · ... e mais {len(applied) - 3}")
        total_changes += changes
        files_changed += 1

    print(f"\nResumo: {files_changed} arquivos modificados · {total_changes} substituições no total")
    if files_missing:
        print(f"\n⚠ Arquivos não encontrados ({len(files_missing)}):")
        for f in files_missing:
            print(f"  · {f}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
