"""
Atualiza os textos dos botões CTA nos 20 emails afetados, agora que os
links apontam pro link direto da live (e não mais pra LP lives.html).

Textos antigos sugeriam inscrição/agenda da LP; novos textos sugerem ação
direta no link da live no YouTube.
"""
from pathlib import Path

ROOT = Path(r'C:\Fluência_Contábil_OS_C\_MARKETING\Site\Versão 3\email-templates')

# (file_path, lista de (old, new) substituições)
PATCHES = {
    # ─── CONVITES — D-3 (3 dias antes) ───
    # Lives 1, 2, 4: "GARANTIR VAGA GRATUITA →"
    'broadcasts/convites-lives/live-1-debito-credito/D-3.html': [
        ('GARANTIR VAGA GRATUITA →', '▶ ANOTAR NO YOUTUBE →'),
    ],
    'broadcasts/convites-lives/live-2-cpc-51/D-3.html': [
        ('GARANTIR VAGA GRATUITA →', '▶ ANOTAR NO YOUTUBE →'),
    ],
    'broadcasts/convites-lives/live-4-plataforma/D-3.html': [
        ('GARANTIR VAGA GRATUITA →', '▶ ANOTAR NO YOUTUBE →'),
    ],
    # Live 3 (Lançamento) tem texto diferente
    'broadcasts/convites-lives/live-3-lancamento/D-3.html': [
        ('GARANTIR PRESENÇA NO LANÇAMENTO →', '▶ NÃO PERDER O LANÇAMENTO →'),
    ],

    # ─── CONVITES — D-0 (manhã do dia) ───
    'broadcasts/convites-lives/live-1-debito-credito/D-0.html': [
        ('QUERO MINHA VAGA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'broadcasts/convites-lives/live-2-cpc-51/D-0.html': [
        ('QUERO MINHA VAGA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'broadcasts/convites-lives/live-4-plataforma/D-0.html': [
        ('QUERO MINHA VAGA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'broadcasts/convites-lives/live-3-lancamento/D-0.html': [
        ('QUERO ESTAR NO LANÇAMENTO →', '▶ ESTAR NO LANÇAMENTO →'),
    ],

    # ─── SEQUÊNCIA E — Véspera 18h ───
    # Texto antigo: "VER A AGENDA COMPLETA →"
    # Novo: "▶ ABRIR LIVE NO YOUTUBE →"
    'sequencia-e/live-1-vespera.html': [
        ('VER A AGENDA COMPLETA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'sequencia-e/live-2-vespera.html': [
        ('VER A AGENDA COMPLETA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'sequencia-e/live-3-vespera.html': [
        ('VER A AGENDA COMPLETA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],
    'sequencia-e/live-4-vespera.html': [
        ('VER A AGENDA COMPLETA →', '▶ ABRIR LIVE NO YOUTUBE →'),
    ],

    # AOVIVO (convites + Sequência E): "▶ ENTRAR NA LIVE AGORA" já está bom,
    # nada a mudar.
}

total_files = 0
total_replacements = 0
for rel, patches in PATCHES.items():
    fp = ROOT / rel
    if not fp.exists():
        print(f'❌ MISSING: {rel}')
        continue
    raw = fp.read_text(encoding='utf-8')
    changed = False
    for old, new in patches:
        count = raw.count(old)
        if count == 0:
            print(f'⚠️ no match: {rel} ← {old!r}')
            continue
        raw = raw.replace(old, new)
        total_replacements += count
        changed = True
        print(f'✅ {rel}: "{old}" → "{new}" ({count}x)')
    if changed:
        fp.write_text(raw, encoding='utf-8')
        total_files += 1

print()
print(f'Total: {total_files} arquivos, {total_replacements} substituições de texto')
