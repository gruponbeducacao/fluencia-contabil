"""
Gera o _INSTRUCOES_MAILERLITE.html consumindo _email_metadata.json.
Cada email vira um bloco com: Email name | Subject | Preheader | botão Copiar HTML.
"""
import json
from pathlib import Path
from html import escape

ROOT = Path(r'C:\Fluência_Contábil_OS_C\_MARKETING\Site\Versão 3\email-templates')
META = json.loads((ROOT / '_email_metadata.json').read_text(encoding='utf-8'))

# Index por id pra busca rápida
BY_ID = {m['id']: m for m in META}


def email_block(eid: str) -> str:
    """Renderiza 1 bloco de email com os 4 itens: name, subject, preheader, copy button."""
    m = BY_ID.get(eid)
    if not m:
        return f'<div class="email-block error">Email {eid} não encontrado nos metadados.</div>'
    return f'''
    <div class="email-block" data-html-path="{escape(m['path'])}">
      <div class="email-block-head">
        <span class="email-block-id">{escape(m['id'])}</span>
        <div class="email-block-actions">
          <a class="email-block-view" href="{escape(m['path'])}" target="_blank">Abrir preview ↗</a>
          <button type="button" class="email-block-copy" data-path="{escape(m['path'])}">📋 Copiar HTML</button>
        </div>
      </div>
      <dl class="email-meta">
        <dt>Email name</dt>
        <dd><code class="copyable" title="Clique para copiar">{escape(m['name'])}</code></dd>
        <dt>Subject</dt>
        <dd><code class="copyable" title="Clique para copiar">{escape(m['subject'])}</code></dd>
        <dt>Preheader</dt>
        <dd><code class="copyable" title="Clique para copiar">{escape(m['preheader'])}</code></dd>
      </dl>
    </div>'''


# ──────────────── CONTEÚDO ────────────────

# Seção 3 — Atualizar HTMLs (A5, B1, B4, B5, B6, C5, C6)
SEC3_BLOCKS = ''.join(email_block(x) for x in ['A5', 'B1', 'B4', 'B5', 'B6', 'C5', 'C6'])

# Seção 4 — Sequência D (D1..D5)
SEC4_TABLE_ROWS = ''.join(f'''
      <tr><td><strong>{x}</strong></td><td>{delay}</td><td>{tema}</td></tr>'''
    for x, delay, tema in [
        ('D1', '<strong>Imediato</strong> (0 minutos)', 'Boas-vindas + agenda 4 lives + Acesso Fundador (teaser) + Dicionário PDF'),
        ('D2', '<strong>+2 dias</strong>', 'Tese: Códigos → Próxima base → Casa abre → Casa por dentro'),
        ('D3', '<strong>+4 dias</strong>', 'Quem te ensina · trajetória · Senado Federal · grid de números'),
        ('D4', '<strong>+6 dias</strong>', '[Aula 01 grátis] Partidas Dobradas · prepara pra Live 1'),
        ('D5', '<strong>+9 dias</strong>', 'Como aproveitar as 4 noites · 3 dicas · LP única'),
    ]
)
SEC4_BLOCKS = ''.join(email_block(x) for x in ['D1', 'D2', 'D3', 'D4', 'D5'])

# Seção 5 — Convites das 4 lives (12 emails)
# Organizo por live → 3 blocos (D-3, D-0, AOVIVO)
def convites_live_block(label_live: str, data_live: str, tema: str, ids: list[str], envios: list[str]) -> str:
    blocks = ''.join(
        f'<div class="schedule-tag">📅 Envio: <strong>{env}</strong></div>{email_block(i)}'
        for i, env in zip(ids, envios)
    )
    return f'''
    <div class="convite-live">
      <h3>{label_live} · {data_live} · {tema}</h3>
      {blocks}
    </div>'''

SEC5_BLOCKS = (
    convites_live_block(
        'Live 1', 'ter 04/08 · 20h', 'Débito e Crédito',
        ['LIVE1-D3', 'LIVE1-D0', 'LIVE1-AV'],
        ['sáb 01/08 · 09h (D-3)', 'ter 04/08 · 09h (D-0)', 'ter 04/08 · 20h (AOVIVO)']
    ) +
    convites_live_block(
        'Live 2', 'qua 05/08 · 20h', 'CPC 51',
        ['LIVE2-D3', 'LIVE2-D0', 'LIVE2-AV'],
        ['dom 02/08 · 09h (D-3)', 'qua 05/08 · 09h (D-0)', 'qua 05/08 · 20h (AOVIVO)']
    ) +
    convites_live_block(
        'Live 3 🚨', 'qui 06/08 · 20h', 'Lançamento Oficial',
        ['LIVE3-D3', 'LIVE3-D0', 'LIVE3-AV'],
        ['seg 03/08 · 09h (D-3)', 'qui 06/08 · 09h (D-0)', 'qui 06/08 · 20h (AOVIVO)']
    ) +
    convites_live_block(
        'Live 4', 'sex 07/08 · 20h', 'Tour pela Plataforma',
        ['LIVE4-D3', 'LIVE4-D0', 'LIVE4-AV'],
        ['ter 04/08 · 09h (D-3)', 'sex 07/08 · 09h (D-0)', 'sex 07/08 · 20h (AOVIVO)']
    )
)

# Seção 6 — Sequência E enxuta (8 emails)
def seq_e_live_block(label: str, data: str, ids: list[str], envios: list[str]) -> str:
    blocks = ''.join(
        f'<div class="schedule-tag">📅 Envio: <strong>{env}</strong> · Segmento: <code>group "Inscritos Lives Ago/26"</code></div>{email_block(i)}'
        for i, env in zip(ids, envios)
    )
    return f'''
    <div class="convite-live">
      <h3>{label} · {data}</h3>
      {blocks}
    </div>'''

SEC6_BLOCKS = (
    seq_e_live_block(
        'Live 1', 'ter 04/08 · 20h',
        ['E1-VESP', 'E1-AV'],
        ['seg 03/08 · 18h (Véspera)', 'ter 04/08 · 19h55 (AOVIVO)']
    ) +
    seq_e_live_block(
        'Live 2', 'qua 05/08 · 20h',
        ['E2-VESP', 'E2-AV'],
        ['ter 04/08 · 18h (Véspera)', 'qua 05/08 · 19h55 (AOVIVO)']
    ) +
    seq_e_live_block(
        'Live 3 🚨', 'qui 06/08 · 20h',
        ['E3-VESP', 'E3-AV'],
        ['qua 05/08 · 18h (Véspera)', 'qui 06/08 · 19h55 (AOVIVO)']
    ) +
    seq_e_live_block(
        'Live 4', 'sex 07/08 · 20h',
        ['E4-VESP', 'E4-AV'],
        ['qui 06/08 · 18h (Véspera)', 'sex 07/08 · 19h55 (AOVIVO)']
    )
)

# Seção 7 — Lançamento L1-L7 (7 emails)
SEC7_SCHEDULE = {
    'L1': ('seg 27/07 · 09h', 'Newsletter + Lista + Lead Magnet + Lives'),
    'L2': ('sex 31/07 · 09h', 'Newsletter + Lista + Lead Magnet + Lives'),
    'L3': ('seg 03/08 · 18h', 'Todos (Newsletter + Lista + Lead Magnet + Lives)'),
    'L4': ('sáb 08/08 · 09h', 'Todos (com CTA Kiwify)'),
    'L5': ('qui 13/08 · 18h', 'Todos engajados (excluir compradores)'),
    'L6': ('dom 16/08 · 09h', 'Todos engajados (excluir compradores)'),
    'L7': ('dom 16/08 · 19h', 'Todos engajados (excluir compradores)'),
}
SEC7_BLOCKS = ''.join(
    f'<div class="schedule-tag">📅 Envio: <strong>{env}</strong> · Segmento: {seg}</div>{email_block(lid)}'
    for lid, (env, seg) in SEC7_SCHEDULE.items()
)

# ──────────────── HTML COMPLETO ────────────────

HTML = f'''<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1.0">
<meta name="robots" content="noindex,nofollow">
<title>Instruções MailerLite — Lançamento Ago/2026 · Fluência Contábil</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800;900&family=Source+Serif+4:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet">
<style>
:root{{
  --azul:#1B2A4A; --azul-med:#2A3F6F;
  --dourado:#C8A84B; --dourado-esc:#A68A3E;
  --cream:#FBF6E9; --texto:#1A1A1A; --branco:#FFFFFF;
  --vermelho:#C0392B; --verde:#10B981; --cinza:#6B7280;
}}
*,*::before,*::after{{margin:0;padding:0;box-sizing:border-box;}}
body{{font-family:'Montserrat',sans-serif;background:var(--cream);color:var(--texto);line-height:1.55;padding:40px 24px;}}
.wrap{{max-width:1100px;margin:0 auto;}}
h1{{font-size:32px;font-weight:900;color:var(--azul);letter-spacing:-1px;margin-bottom:8px;}}
.sub{{color:var(--cinza);font-size:15px;margin-bottom:36px;font-family:'Source Serif 4',serif;font-style:italic;}}

.toc{{background:var(--azul);color:white;padding:24px 28px;border-radius:8px;margin-bottom:36px;}}
.toc h2{{font-size:13px;font-weight:800;color:var(--dourado);letter-spacing:2px;text-transform:uppercase;margin-bottom:14px;}}
.toc ol{{list-style:none;counter-reset:steps;padding:0;}}
.toc li{{counter-increment:steps;padding:6px 0;font-size:14px;color:#FBF6E9;}}
.toc li::before{{content:counter(steps,decimal-leading-zero) "  ";color:var(--dourado);font-weight:800;margin-right:8px;}}
.toc a{{color:#FBF6E9;text-decoration:none;border-bottom:1px solid transparent;transition:border-color 0.2s;}}
.toc a:hover{{border-color:var(--dourado);}}

section{{background:white;border-radius:10px;padding:32px 36px;margin-bottom:28px;box-shadow:0 2px 12px rgba(27,42,74,0.06);}}
section h2{{font-size:22px;font-weight:900;color:var(--azul);margin-bottom:10px;letter-spacing:-0.3px;}}
section h2 .step{{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;background:var(--azul);color:var(--dourado);border-radius:50%;font-size:14px;font-weight:900;margin-right:14px;letter-spacing:0;}}
section h3{{font-size:16px;font-weight:800;color:var(--azul);margin:24px 0 12px;}}
section h3:first-of-type{{margin-top:18px;}}
section p{{margin-bottom:14px;font-family:'Source Serif 4',serif;font-size:15px;color:#333;line-height:1.7;}}
section ul, section ol{{margin:0 0 14px 24px;font-family:'Source Serif 4',serif;font-size:15px;}}
section li{{padding:4px 0;color:#333;line-height:1.6;}}
section strong{{color:var(--azul);font-family:'Montserrat',sans-serif;font-weight:700;}}

.badge{{display:inline-block;font-size:10px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;padding:4px 10px;border-radius:3px;}}
.badge-ok{{background:rgba(16,185,129,0.12);color:#059669;border:1px solid rgba(16,185,129,0.35);}}
.badge-pending{{background:rgba(200,168,75,0.15);color:var(--dourado-esc);border:1px solid rgba(200,168,75,0.4);}}
.badge-critical{{background:rgba(192,57,43,0.12);color:var(--vermelho);border:1px solid rgba(192,57,43,0.4);}}

.callout{{background:rgba(200,168,75,0.10);border-left:4px solid var(--dourado);padding:16px 22px;border-radius:0 4px 4px 0;margin:18px 0;font-size:14px;}}
.callout strong{{display:block;margin-bottom:6px;}}
.callout.critical{{background:rgba(192,57,43,0.08);border-left-color:var(--vermelho);}}
.callout.success{{background:rgba(16,185,129,0.08);border-left-color:var(--verde);}}

table{{width:100%;border-collapse:collapse;margin:14px 0 22px;font-size:13.5px;}}
table th{{background:var(--azul);color:white;padding:11px 14px;text-align:left;font-weight:700;letter-spacing:0.3px;}}
table th:first-child{{border-top-left-radius:4px;}}
table th:last-child{{border-top-right-radius:4px;}}
table td{{padding:11px 14px;border-bottom:1px solid #E8E2D0;background:white;color:#333;vertical-align:top;}}
table tr:hover td{{background:#FFFEF7;}}
table code{{background:#F4F0E0;padding:2px 6px;border-radius:2px;font-size:12px;color:var(--azul-med);}}

code{{background:#F4F0E0;padding:2px 6px;border-radius:2px;font-family:'Courier New',monospace;font-size:13px;color:var(--azul-med);}}
pre{{background:#0F1A30;color:#C8A84B;padding:14px 18px;border-radius:6px;overflow-x:auto;font-size:13px;line-height:1.55;margin:12px 0;font-family:'Courier New',monospace;}}

.checkbox-list{{list-style:none;margin-left:0;}}
.checkbox-list li{{padding:8px 0;border-bottom:1px dashed #E8E2D0;display:flex;align-items:flex-start;gap:12px;}}
.checkbox-list li:last-child{{border-bottom:none;}}
.checkbox-list input[type=checkbox]{{margin-top:5px;width:16px;height:16px;accent-color:var(--dourado);flex-shrink:0;}}
.checkbox-list label{{flex:1;cursor:pointer;font-size:14px;font-family:'Source Serif 4',serif;}}
.checkbox-list input[type=checkbox]:checked + label{{color:#888;text-decoration:line-through;}}

.back{{display:inline-block;font-size:12px;font-weight:700;color:var(--azul);text-decoration:none;margin-bottom:24px;letter-spacing:0.5px;}}
.back:hover{{color:var(--dourado);}}

/* ───── Bloco de email ───── */
.email-block{{background:#FAFAF6;border:1px solid #E8E2D0;border-radius:6px;padding:18px 22px;margin:14px 0;}}
.email-block-head{{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px dashed #E0D8BD;}}
.email-block-id{{display:inline-block;background:var(--azul);color:var(--dourado);font-weight:900;font-size:11px;letter-spacing:1.5px;padding:4px 10px;border-radius:3px;}}
.email-block-actions{{display:flex;gap:8px;align-items:center;}}
.email-block-view{{font-size:11px;font-weight:700;color:var(--azul);text-decoration:none;padding:6px 10px;border:1px solid #D0C8AE;border-radius:3px;letter-spacing:0.5px;transition:all 0.2s;}}
.email-block-view:hover{{background:white;border-color:var(--azul);}}
.email-block-copy{{font-size:11px;font-weight:800;color:var(--azul);background:var(--dourado);border:1px solid var(--dourado-esc);border-radius:3px;padding:6px 12px;cursor:pointer;letter-spacing:0.5px;font-family:'Montserrat',sans-serif;transition:all 0.2s;}}
.email-block-copy:hover{{background:var(--dourado-esc);color:white;}}
.email-block-copy.copied{{background:var(--verde);border-color:#059669;color:white;}}
.email-meta{{display:grid;grid-template-columns:auto 1fr;gap:8px 16px;align-items:start;}}
.email-meta dt{{font-size:11px;font-weight:800;color:var(--cinza);text-transform:uppercase;letter-spacing:1px;padding-top:7px;white-space:nowrap;}}
.email-meta dd{{font-size:13px;line-height:1.5;}}
.email-meta code.copyable{{background:white;border:1px solid #E0D8BD;color:var(--texto);padding:5px 10px;border-radius:3px;font-family:'Montserrat',sans-serif;font-size:13px;cursor:pointer;display:inline-block;max-width:100%;word-break:break-word;transition:all 0.15s;}}
.email-meta code.copyable:hover{{background:#FFF8DC;border-color:var(--dourado);}}
.email-meta code.copyable.copied{{background:rgba(16,185,129,0.15);border-color:var(--verde);color:#047857;}}
.email-meta code.copyable::after{{content:" 📋";opacity:0.4;font-size:11px;}}
.email-meta code.copyable.copied::after{{content:" ✓";opacity:1;color:var(--verde);}}

.convite-live{{margin:24px 0;padding:20px 22px;background:#FFFEF7;border:1px solid #F0E8C8;border-radius:8px;}}
.convite-live h3{{margin:0 0 16px !important;font-size:15px !important;color:var(--azul) !important;padding-bottom:10px;border-bottom:2px solid var(--dourado);}}
.schedule-tag{{display:inline-block;background:white;border:1px dashed var(--dourado);color:var(--azul);padding:6px 12px;border-radius:3px;font-size:12px;margin:8px 0 4px;font-family:'Montserrat',sans-serif;}}
.schedule-tag code{{font-size:11px;padding:1px 5px;}}

.legend{{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 20px;font-size:12px;}}
.legend span{{display:inline-flex;align-items:center;gap:6px;color:#555;}}

.toast{{position:fixed;bottom:30px;left:50%;transform:translateX(-50%) translateY(100px);background:var(--azul);color:var(--dourado);padding:14px 24px;border-radius:6px;font-weight:700;font-size:13px;letter-spacing:0.5px;box-shadow:0 8px 24px rgba(0,0,0,0.2);opacity:0;transition:all 0.3s ease;pointer-events:none;z-index:1000;}}
.toast.show{{opacity:1;transform:translateX(-50%) translateY(0);}}
</style>
</head>
<body>
<div class="wrap">

<a class="back" href="index.html">← Voltar ao dashboard</a>

<h1>📋 Instruções de programação · MailerLite</h1>
<p class="sub">Passo-a-passo para ativar as automações pendentes e agendar os 27 broadcasts do lançamento de ago/2026.<br>Cada email mostra <strong>Email name</strong>, <strong>Subject</strong>, <strong>Preheader</strong> e botão <strong>📋 Copiar HTML</strong>. Clique em qualquer campo de texto para copiar.</p>

<!-- ÍNDICE -->
<div class="toc">
  <h2>Roteiro de execução</h2>
  <ol>
    <li><a href="#estado">Estado atual do MailerLite</a></li>
    <li><a href="#prereq">Pré-requisitos · group único das lives</a></li>
    <li><a href="#atualizar">Atualizar HTMLs de 7 emails nas automations ativas</a></li>
    <li><a href="#sequencia-d">Criar Sequência D · Bem-vindo às Lives (5 emails)</a></li>
    <li><a href="#convites">Agendar 12 broadcasts · Convites das 4 lives</a></li>
    <li><a href="#sequencia-e">Agendar 8 broadcasts · Sequência E enxuta</a></li>
    <li><a href="#broadcasts-lancamento">Agendar 7 broadcasts L1–L7 · Lançamento</a></li>
    <li><a href="#como-copiar">Como copiar os textos e o HTML</a></li>
  </ol>
</div>

<!-- 1. ESTADO ATUAL -->
<section id="estado">
  <h2><span class="step">1</span>Estado atual do MailerLite</h2>
  <p>Você tem <strong>3 automações ativas</strong> rodando (Sequências A, B e C). O trabalho agora é (a) atualizar 7 emails dessas sequências, (b) criar 1 nova automação (Sequência D) e (c) agendar <strong>27 broadcasts</strong> (campanhas pontuais).</p>
  <table>
    <thead><tr><th>Sequência</th><th>Trigger</th><th>Emails</th><th>Status</th></tr></thead>
    <tbody>
      <tr><td><strong>A — Newsletter</strong></td><td>Joins group <code>Newsletter</code></td><td>5 (A1-A5)</td><td><span class="badge badge-ok">✓ ATIVA</span> — A5 precisa atualização</td></tr>
      <tr><td><strong>B — Lista de Espera</strong></td><td>Joins group <code>Lista de Espera</code></td><td>6 (B1-B6)</td><td><span class="badge badge-ok">✓ ATIVA</span> — B1, B4, B5, B6 precisam atualização</td></tr>
      <tr><td><strong>C — Lead Magnet</strong></td><td>Joins group <code>Lead Magnet - Dicionário</code></td><td>6 (C1-C6)</td><td><span class="badge badge-ok">✓ ATIVA</span> — C5, C6 precisam atualização</td></tr>
      <tr><td><strong>D — Bem-vindo às Lives</strong></td><td>Joins group <code>Inscritos Lives Ago/26</code> (ID <code>188077924412294920</code>)</td><td>5 (D1-D5)</td><td><span class="badge badge-pending">⏳ A CRIAR</span></td></tr>
      <tr><td><strong>E enxuta — Operacional</strong></td><td>Broadcasts agendados (não automation)</td><td>8 (4 lives × 2)</td><td><span class="badge badge-pending">⏳ A AGENDAR</span></td></tr>
      <tr><td><strong>Convites das lives</strong></td><td>Broadcasts agendados</td><td>12 (4 lives × 3)</td><td><span class="badge badge-pending">⏳ A AGENDAR</span></td></tr>
      <tr><td><strong>Broadcasts L1-L7</strong></td><td>Broadcasts agendados</td><td>7</td><td><span class="badge badge-pending">⏳ A AGENDAR</span></td></tr>
    </tbody>
  </table>
</section>

<!-- 2. PRÉ-REQUISITOS -->
<section id="prereq">
  <h2><span class="step">2</span>Pré-requisitos · group único das lives</h2>
  <p>No replanejamento de ago/2026 consolidamos as <strong>4 lives em 1 group único</strong> do MailerLite. Quem se inscreve na LP <code>/lives</code> entra no group <strong>"Inscritos Lives Ago/26"</strong> (ID <code>188077924412294920</code>). Esse é o trigger da Sequência D.</p>
  <div class="callout success">
    <strong>✓ Apps Script já está sincronizando</strong>
    O endpoint unificado (<code>AKfycbx8lWrX...</code>) roteia leads de <code>lives.html</code> pra esse group via trigger temporal de 1min. Validado de ponta a ponta em 21/05/2026. Você só precisa configurar a automation no MailerLite.
  </div>
  <p>Groups antigos (<code>Live 1</code>, <code>Live 2</code>, <code>Live 3</code>, <code>Live 4</code>, <code>Live 3 Lançamento</code>) do plano de set/2025 podem ser apagados — não são mais referenciados pelo código.</p>
</section>

<!-- 3. ATUALIZAR HTMLs -->
<section id="atualizar">
  <h2><span class="step">3</span>Atualizar HTMLs de 7 emails nas automations ativas</h2>
  <p>Esses emails JÁ ESTÃO no ar (rodando), mas o HTML foi atualizado no repo durante a remarcação ago/2026. Você precisa re-importar:</p>
  <ol>
    <li>Vá em <strong>Automations → [nome da sequência] → clique no email → Edit content</strong></li>
    <li>Atualize o <strong>Email name</strong>, <strong>Subject</strong> e <strong>Preheader</strong> com os valores abaixo</li>
    <li>Apague o HTML atual e cole o novo (botão <strong>📋 Copiar HTML</strong> em cada bloco)</li>
    <li>Salve e ative o email (às vezes o MailerLite desativa após edição grande)</li>
  </ol>
  {SEC3_BLOCKS}
  <div class="callout success">
    <strong>✓ Send test email antes de salvar</strong>
    Manda pra teu email pessoal e abre no Gmail + Outlook web pra confirmar que renderiza bem (botões, fontes, imagens).
  </div>
</section>

<!-- 4. SEQUÊNCIA D -->
<section id="sequencia-d">
  <h2><span class="step">4</span>Criar Sequência D · Bem-vindo às Lives (5 emails)</h2>
  <p>Em <strong>Automations → New automation → Workflow from scratch</strong>:</p>
  <h3>Configuração da automation</h3>
  <ul>
    <li><strong>Nome:</strong> <code>FC · Sequência D · Bem-vindo às Lives</code></li>
    <li><strong>Trigger:</strong> <em>When subscriber joins a group</em> → <strong>Inscritos Lives Ago/26</strong> (ID <code>188077924412294920</code>)</li>
    <li><strong>Allow re-entry?</strong> ❌ Não</li>
  </ul>
  <h3>Cadência</h3>
  <table>
    <thead><tr><th>#</th><th>Delay desde trigger</th><th>Conteúdo principal</th></tr></thead>
    <tbody>{SEC4_TABLE_ROWS}
    </tbody>
  </table>
  <h3>Emails da Sequência D</h3>
  {SEC4_BLOCKS}
  <div class="callout">
    <strong>📅 Cuidado com lead que entrar muito perto da Live 1</strong>
    Quem se inscrever em 02/08 (2 dias antes da L1) vai receber D1 imediatamente, D2 em 04/08 (dia da Live 1), D3 em 06/08 (dia da Live 3 — Lançamento)... a sequência ainda funciona, mas o aluno pode achar estranho receber emails de "boas-vindas" durante a semana das lives. Considere desativar a Sequência D entre <strong>30/07 e 07/08</strong> e usar só os broadcasts operacionais.
  </div>
</section>

<!-- 5. CONVITES DAS LIVES -->
<section id="convites">
  <h2><span class="step">5</span>Agendar 12 broadcasts · Convites das 4 lives</h2>
  <p>Em <strong>Campaigns → Create campaign → Regular campaign</strong>. <strong>3 broadcasts por live</strong> (D-3 manhã · D-0 manhã · AOVIVO 20h). Segmento padrão: <code>Newsletter + Lista + Lead Magnet + Inscritos Lives Ago/26</code>.</p>
  {SEC5_BLOCKS}
</section>

<!-- 6. SEQUÊNCIA E ENXUTA -->
<section id="sequencia-e">
  <h2><span class="step">6</span>Agendar 8 broadcasts · Sequência E enxuta</h2>
  <p>Lembretes <strong>SÓ pra quem se inscreveu nas lives</strong> (segmento = group <code>Inscritos Lives Ago/26</code>). 2 emails por live: véspera 18h + AOVIVO 19h55.</p>
  {SEC6_BLOCKS}
  <div class="callout">
    <strong>📌 Por que broadcast e não automation?</strong>
    Como o disparo é em data/hora <em>fixa</em> (não relativo à inscrição), broadcast agendado é mais simples e confiável. O segmento já filtra só quem está no group.
  </div>
</section>

<!-- 7. LANÇAMENTO L1-L7 -->
<section id="broadcasts-lancamento">
  <h2><span class="step">7</span>Agendar 7 broadcasts L1-L7 · Lançamento</h2>
  <p>Broadcasts de venda. L1-L3 pré-lives. L4-L7 pós Live 3 (carrinho aberto) com CTA pro checkout Kiwify (<code>https://pay.kiwify.com.br/Ze6v1aC</code>).</p>
  {SEC7_BLOCKS}
  <div class="callout critical">
    <strong>🚨 Excluir compradores dos L5-L7</strong>
    Crie um segment <code>Não comprou ainda</code> = excluir subscribers tagueados como <code>comprou</code> ou que entraram no group <code>Aluno Fundador</code> (você cria esse group quando começar a receber compras). Mandar email de venda pra quem já comprou destrói confiança.
  </div>
</section>

<!-- 8. COMO COPIAR -->
<section id="como-copiar">
  <h2><span class="step">8</span>Como copiar os textos e o HTML</h2>
  <h3>Email name, Subject e Preheader</h3>
  <p>Clique em qualquer um dos 3 campos de texto (com cinza claro e ícone 📋) — o conteúdo vai direto pro clipboard. Cola no campo correspondente do MailerLite. Os campos ficam verdes brevemente confirmando a cópia.</p>
  <h3>HTML completo do email</h3>
  <p>Clique no botão <strong>📋 Copiar HTML</strong> em cada bloco. O navegador faz <code>fetch</code> do arquivo, copia o HTML pro clipboard e mostra confirmação. No MailerLite: <strong>Edit content → Source/HTML mode</strong> → Ctrl+V → Salvar.</p>
  <h3>Send test email antes de finalizar</h3>
  <p>O MailerLite às vezes injeta tracking ou altera atributos. Faz teste pelo menos em 3 emails representativos: D1 (Sequência D), Convite Live 3 D-0 (broadcast pre-live), e L7 (broadcast pós-lives).</p>
</section>

<!-- CHECKLIST -->
<section>
  <h2><span class="step">✓</span>Checklist final · marca conforme avança</h2>
  <ul class="checkbox-list">
    <li><input type="checkbox" id="c1"><label for="c1"><strong>Group único confirmado:</strong> "Inscritos Lives Ago/26" (ID 188077924412294920) recebendo subscribers via Apps Script</label></li>
    <li><input type="checkbox" id="c2"><label for="c2"><strong>A5:</strong> Email name + Subject + Preheader + HTML atualizado na Sequência A</label></li>
    <li><input type="checkbox" id="c3"><label for="c3"><strong>B1:</strong> atualizado na Sequência B</label></li>
    <li><input type="checkbox" id="c4"><label for="c4"><strong>B4:</strong> atualizado na Sequência B</label></li>
    <li><input type="checkbox" id="c5"><label for="c5"><strong>B5:</strong> atualizado na Sequência B (correção "junho" → "agosto")</label></li>
    <li><input type="checkbox" id="c6"><label for="c6"><strong>B6:</strong> atualizado na Sequência B (preheader)</label></li>
    <li><input type="checkbox" id="c7"><label for="c7"><strong>C5:</strong> atualizado na Sequência C (correção "junho" → "agosto")</label></li>
    <li><input type="checkbox" id="c8"><label for="c8"><strong>C6:</strong> atualizado na Sequência C</label></li>
    <li><input type="checkbox" id="c9"><label for="c9"><strong>Sequência D criada</strong> · 5 emails · trigger group "Inscritos Lives Ago/26" · cadência 0/+2/+4/+6/+9 dias</label></li>
    <li><input type="checkbox" id="c10"><label for="c10"><strong>12 convites das lives</strong> agendados (Live 1, 2, 3, 4 × 3 broadcasts)</label></li>
    <li><input type="checkbox" id="c11"><label for="c11"><strong>8 broadcasts Sequência E</strong> agendados (4 lives × 2)</label></li>
    <li><input type="checkbox" id="c12"><label for="c12"><strong>7 broadcasts L1-L7</strong> agendados (lançamento)</label></li>
    <li><input type="checkbox" id="c13"><label for="c13"><strong>Send test email</strong> de 3 emails representativos (D1, Convite Live 3 D-0, L7)</label></li>
    <li><input type="checkbox" id="c14"><label for="c14"><strong>UTM nos CTAs</strong> de L1-L7 conferido pra rastrear vendas via Kiwify</label></li>
  </ul>
  <div class="callout success">
    <strong>✅ Quando terminar tudo, me avisa</strong>
    Rodamos um sanity check (curl + grep) pra garantir que tudo está apontando pras URLs/datas certas em dev/main. 🚀
  </div>
</section>

<a class="back" href="index.html">← Voltar ao dashboard</a>

</div>

<div id="toast" class="toast"></div>

<script>
(function() {{
  const toast = document.getElementById('toast');
  function showToast(msg) {{
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.remove('show'), 1800);
  }}
  async function copyText(text) {{
    try {{
      await navigator.clipboard.writeText(text);
      return true;
    }} catch(e) {{
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text; ta.style.position='fixed'; ta.style.left='-9999px';
      document.body.appendChild(ta); ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }}
  }}

  // Click em código copiável (Email name / Subject / Preheader)
  document.querySelectorAll('code.copyable').forEach(el => {{
    el.addEventListener('click', async () => {{
      const text = el.textContent.trim();
      const ok = await copyText(text);
      if (ok) {{
        el.classList.add('copied');
        showToast('✓ Copiado: ' + (text.length > 50 ? text.substring(0,50)+'…' : text));
        setTimeout(() => el.classList.remove('copied'), 1500);
      }} else {{
        showToast('❌ Erro ao copiar');
      }}
    }});
  }});

  // Click em "Copiar HTML"
  document.querySelectorAll('.email-block-copy').forEach(btn => {{
    btn.addEventListener('click', async () => {{
      const path = btn.dataset.path;
      const originalText = btn.textContent;
      btn.textContent = '⏳ Buscando...';
      btn.disabled = true;
      try {{
        const resp = await fetch(path);
        if (!resp.ok) throw new Error('HTTP ' + resp.status);
        const html = await resp.text();
        const ok = await copyText(html);
        if (ok) {{
          btn.textContent = '✓ HTML copiado!';
          btn.classList.add('copied');
          showToast('✓ HTML copiado · ' + path);
          setTimeout(() => {{
            btn.textContent = originalText;
            btn.classList.remove('copied');
            btn.disabled = false;
          }}, 1800);
        }} else {{
          throw new Error('clipboard');
        }}
      }} catch(e) {{
        btn.textContent = '❌ Erro';
        showToast('❌ Erro: ' + e.message);
        setTimeout(() => {{
          btn.textContent = originalText;
          btn.disabled = false;
        }}, 2000);
      }}
    }});
  }});
}})();
</script>
</body>
</html>
'''

OUT = ROOT / '_INSTRUCOES_MAILERLITE.html'
OUT.write_text(HTML, encoding='utf-8')
print(f'✅ Gerado: {OUT}')
print(f'   Tamanho: {len(HTML):,} chars · {HTML.count(chr(10)):,} linhas')
print(f'   Emails: {sum(HTML.count(f">{m["id"]}</span>") for m in META)} blocos identificados')
