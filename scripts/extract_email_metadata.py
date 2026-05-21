"""
Lê os 36 emails referenciados no _INSTRUCOES_MAILERLITE.html e extrai:
- Subject (<title>)
- Preheader (primeiro <div style="display:none;...">)

Imprime tabela CSV para validação manual antes de injetar no HTML.
Uso: python -X utf8 extract_email_metadata.py
"""
import os
import re
import json
from pathlib import Path

ROOT = Path(r'C:\Fluência_Contábil_OS_C\_MARKETING\Site\Versão 3\email-templates')

EMAILS = [
    # (id, category, path, email_name_for_mailerlite)
    # Seção 3 — Atualizar nas automations ativas
    ('A5', 'Sequência A', 'sequencia-a/A5-lista-espera.html', 'FC · Sequência A · A5 · Lista de Espera'),
    ('B1', 'Sequência B', 'sequencia-b/B1-bem-vindo-lista.html', 'FC · Sequência B · B1 · Bem-vindo Lista'),
    ('B4', 'Sequência B', 'sequencia-b/B4-vip-lives.html', 'FC · Sequência B · B4 · VIP nas Lives'),
    ('C6', 'Sequência C', 'sequencia-c/C6-lista-espera.html', 'FC · Sequência C · C6 · Lista de Espera'),

    # Seção 4 — Sequência D
    ('D1', 'Sequência D', 'sequencia-d/D1-bem-vindo-lives.html', 'FC · Sequência D · D1 · Bem-vindo às Lives'),
    ('D2', 'Sequência D', 'sequencia-d/D2-cinco-camadas.html', 'FC · Sequência D · D2 · Cinco Camadas'),
    ('D3', 'Sequência D', 'sequencia-d/D3-quem-te-ensina.html', 'FC · Sequência D · D3 · Quem te Ensina'),
    ('D4', 'Sequência D', 'sequencia-d/D4-aula-01.html', 'FC · Sequência D · D4 · Aula 01 Partidas Dobradas'),
    ('D5', 'Sequência D', 'sequencia-d/D5-proxima-live.html', 'FC · Sequência D · D5 · Como aproveitar as Lives'),

    # Seção 5 — Convites das lives (12)
    ('LIVE1-D3', 'Convite Live 1', 'broadcasts/convites-lives/live-1-debito-credito/D-3.html', 'FC · Convite Live 1 (Débito/Crédito) · D-3'),
    ('LIVE1-D0', 'Convite Live 1', 'broadcasts/convites-lives/live-1-debito-credito/D-0.html', 'FC · Convite Live 1 (Débito/Crédito) · D-0'),
    ('LIVE1-AV', 'Convite Live 1', 'broadcasts/convites-lives/live-1-debito-credito/AOVIVO.html', 'FC · Convite Live 1 (Débito/Crédito) · AOVIVO'),
    ('LIVE2-D3', 'Convite Live 2', 'broadcasts/convites-lives/live-2-cpc-51/D-3.html', 'FC · Convite Live 2 (CPC 51) · D-3'),
    ('LIVE2-D0', 'Convite Live 2', 'broadcasts/convites-lives/live-2-cpc-51/D-0.html', 'FC · Convite Live 2 (CPC 51) · D-0'),
    ('LIVE2-AV', 'Convite Live 2', 'broadcasts/convites-lives/live-2-cpc-51/AOVIVO.html', 'FC · Convite Live 2 (CPC 51) · AOVIVO'),
    ('LIVE3-D3', 'Convite Live 3', 'broadcasts/convites-lives/live-3-lancamento/D-3.html', 'FC · Convite Live 3 (Lançamento) · D-3'),
    ('LIVE3-D0', 'Convite Live 3', 'broadcasts/convites-lives/live-3-lancamento/D-0.html', 'FC · Convite Live 3 (Lançamento) · D-0'),
    ('LIVE3-AV', 'Convite Live 3', 'broadcasts/convites-lives/live-3-lancamento/AOVIVO.html', 'FC · Convite Live 3 (Lançamento) · AOVIVO'),
    ('LIVE4-D3', 'Convite Live 4', 'broadcasts/convites-lives/live-4-plataforma/D-3.html', 'FC · Convite Live 4 (Plataforma) · D-3'),
    ('LIVE4-D0', 'Convite Live 4', 'broadcasts/convites-lives/live-4-plataforma/D-0.html', 'FC · Convite Live 4 (Plataforma) · D-0'),
    ('LIVE4-AV', 'Convite Live 4', 'broadcasts/convites-lives/live-4-plataforma/AOVIVO.html', 'FC · Convite Live 4 (Plataforma) · AOVIVO'),

    # Seção 6 — Sequência E enxuta (8)
    ('E1-VESP', 'Sequência E', 'sequencia-e/live-1-vespera.html', 'FC · Sequência E · Live 1 · Véspera'),
    ('E1-AV',   'Sequência E', 'sequencia-e/live-1-aovivo.html', 'FC · Sequência E · Live 1 · AOVIVO'),
    ('E2-VESP', 'Sequência E', 'sequencia-e/live-2-vespera.html', 'FC · Sequência E · Live 2 · Véspera'),
    ('E2-AV',   'Sequência E', 'sequencia-e/live-2-aovivo.html', 'FC · Sequência E · Live 2 · AOVIVO'),
    ('E3-VESP', 'Sequência E', 'sequencia-e/live-3-vespera.html', 'FC · Sequência E · Live 3 · Véspera'),
    ('E3-AV',   'Sequência E', 'sequencia-e/live-3-aovivo.html', 'FC · Sequência E · Live 3 · AOVIVO'),
    ('E4-VESP', 'Sequência E', 'sequencia-e/live-4-vespera.html', 'FC · Sequência E · Live 4 · Véspera'),
    ('E4-AV',   'Sequência E', 'sequencia-e/live-4-aovivo.html', 'FC · Sequência E · Live 4 · AOVIVO'),

    # Seção 7 — Lançamento L1-L7 (7)
    ('L1', 'Lançamento', 'broadcasts/lancamento/L1-anuncio.html', 'FC · Lançamento · L1 · Anúncio'),
    ('L2', 'Lançamento', 'broadcasts/lancamento/L2-por-que-anual.html', 'FC · Lançamento · L2 · Por que só anual'),
    ('L3', 'Lançamento', 'broadcasts/lancamento/L3-vespera.html', 'FC · Lançamento · L3 · Véspera Live 1'),
    ('L4', 'Lançamento', 'broadcasts/lancamento/L4-pos-lives-roi.html', 'FC · Lançamento · L4 · Pós-Lives ROI'),
    ('L5', 'Lançamento', 'broadcasts/lancamento/L5-depoimentos.html', 'FC · Lançamento · L5 · Depoimentos'),
    ('L6', 'Lançamento', 'broadcasts/lancamento/L6-ultimo-dia.html', 'FC · Lançamento · L6 · Último Dia'),
    ('L7', 'Lançamento', 'broadcasts/lancamento/L7-ultima-chamada.html', 'FC · Lançamento · L7 · Última Chamada'),
]

TITLE_RE = re.compile(r'<title>\s*(.*?)\s*</title>', re.DOTALL | re.IGNORECASE)
# Preheader: primeiro div com display:none que tenha texto não vazio.
PREHEADER_RE = re.compile(
    r'<div\s+[^>]*style\s*=\s*"[^"]*display\s*:\s*none[^"]*"[^>]*>\s*([^<]+?)\s*</div>',
    re.DOTALL | re.IGNORECASE
)

results = []
for eid, cat, rel, name in EMAILS:
    fp = ROOT / rel
    if not fp.exists():
        results.append({'id': eid, 'category': cat, 'path': rel, 'name': name,
                        'subject': '⚠️ FILE NOT FOUND', 'preheader': '⚠️ FILE NOT FOUND',
                        'exists': False})
        continue

    raw = fp.read_text(encoding='utf-8', errors='replace')
    t = TITLE_RE.search(raw)
    p = PREHEADER_RE.search(raw)
    subject = t.group(1).strip() if t else '(sem title)'
    preheader = p.group(1).strip() if p else '(sem preheader)'
    # Normaliza espaços
    subject = re.sub(r'\s+', ' ', subject)
    preheader = re.sub(r'\s+', ' ', preheader)
    results.append({'id': eid, 'category': cat, 'path': rel, 'name': name,
                    'subject': subject, 'preheader': preheader, 'exists': True})

# Print resumo
print(f'Total: {len(results)} emails — {sum(1 for r in results if r["exists"])} existem')
print()
for r in results:
    mark = '✅' if r['exists'] else '❌'
    print(f'{mark} {r["id"]:10s} | {r["name"]}')
    print(f'   Subject:   {r["subject"][:90]}')
    print(f'   Preheader: {r["preheader"][:90]}')
    print()

# Salva JSON pra próxima etapa
out_path = ROOT / '_email_metadata.json'
out_path.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'JSON salvo em: {out_path}')
