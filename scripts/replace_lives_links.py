"""
Substitui o link genérico https://fluenciacontabil.com.br/lives.html nos
emails de convite + Sequência E pelo placeholder {LINK_LIVE_N} específico
de cada live. O usuário substitui depois pelo link real do YouTube.

D1 e D5 (Sequência D) NÃO são tocados aqui — recebem reescrita manual
porque precisam de 4 botões (um por live).
"""
from pathlib import Path
import re

ROOT = Path(r'C:\Fluência_Contábil_OS_C\_MARKETING\Site\Versão 3\email-templates')
OLD_URL = 'https://fluenciacontabil.com.br/lives.html'

# Mapeamento arquivo → número da live
MAPPING = {
    # Convites das lives (12 arquivos)
    'broadcasts/convites-lives/live-1-debito-credito/D-3.html': 1,
    'broadcasts/convites-lives/live-1-debito-credito/D-0.html': 1,
    'broadcasts/convites-lives/live-1-debito-credito/AOVIVO.html': 1,
    'broadcasts/convites-lives/live-2-cpc-51/D-3.html': 2,
    'broadcasts/convites-lives/live-2-cpc-51/D-0.html': 2,
    'broadcasts/convites-lives/live-2-cpc-51/AOVIVO.html': 2,
    'broadcasts/convites-lives/live-3-lancamento/D-3.html': 3,
    'broadcasts/convites-lives/live-3-lancamento/D-0.html': 3,
    'broadcasts/convites-lives/live-3-lancamento/AOVIVO.html': 3,
    'broadcasts/convites-lives/live-4-plataforma/D-3.html': 4,
    'broadcasts/convites-lives/live-4-plataforma/D-0.html': 4,
    'broadcasts/convites-lives/live-4-plataforma/AOVIVO.html': 4,
    # Sequência E enxuta (8 arquivos)
    'sequencia-e/live-1-vespera.html': 1,
    'sequencia-e/live-1-aovivo.html': 1,
    'sequencia-e/live-2-vespera.html': 2,
    'sequencia-e/live-2-aovivo.html': 2,
    'sequencia-e/live-3-vespera.html': 3,
    'sequencia-e/live-3-aovivo.html': 3,
    'sequencia-e/live-4-vespera.html': 4,
    'sequencia-e/live-4-aovivo.html': 4,
}

total_files = 0
total_replacements = 0

for rel_path, n in MAPPING.items():
    placeholder = '{LINK_LIVE_' + str(n) + '}'
    fp = ROOT / rel_path
    if not fp.exists():
        print(f'❌ MISSING: {rel_path}')
        continue
    raw = fp.read_text(encoding='utf-8')
    count = raw.count(OLD_URL)
    if count == 0:
        print(f'⚠️ no match: {rel_path}')
        continue
    new_raw = raw.replace(OLD_URL, placeholder)
    fp.write_text(new_raw, encoding='utf-8')
    print(f'✅ Live {n}: {rel_path} ({count}x → {placeholder})')
    total_files += 1
    total_replacements += count

print()
print(f'Total: {total_files} arquivos, {total_replacements} substituições')
