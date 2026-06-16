/**
 * ═══════════════════════════════════════════════════════════════════════
 * SYNC PLANILHA → MENSAGEIRO (WhatsApp Bolsão via webhook)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Arquivo NOVO no mesmo projeto Apps Script da planilha "LEADS Fluência
 * Contábil". Mesmo padrão queue/worker do ML/SES Sync: coluna "CRM Sync"
 * vazia = pendente; trigger 1min processa em batch.
 *
 * A aba Bolsão dispara a jornada WhatsApp por webhooks do Bot Builder:
 *   01 boas-vindas: imediato quando a linha entra na planilha
 *   02 véspera:     27/06/2026 18h00
 *   03 dia prova:   28/06/2026 07h35
 *   04 pós-prova:   29/06/2026 18h05
 *
 * O payload enviado ao Mensageiro fica disponível no flow como:
 *   webhook.customer.name
 *   webhook.customer.first_name
 *   webhook.customer.email
 *   webhook.customer.phone
 *   webhook.step
 *   webhook.template
 *
 * ─── PRÉ-REQUISITOS (Script Properties) ───────────────────────────────
 *   BOLSAO_WPP_WEBHOOK_SECRET = <segredo do webhook do Mensageiro>
 *   BOLSAO_WPP_WEBHOOK_URL    = <URL comum, se usar 1 flow roteando por step>
 *
 *   Ou, se usar 4 flows separados:
 *   BOLSAO_WPP_01_WEBHOOK_URL = <URL do flow boas-vindas>
 *   BOLSAO_WPP_02_WEBHOOK_URL = <URL do flow véspera>
 *   BOLSAO_WPP_03_WEBHOOK_URL = <URL do flow dia da prova>
 *   BOLSAO_WPP_04_WEBHOOK_URL = <URL do flow pós-prova>
 *
 *   Opcional:
 *   BOLSAO_RANKING_URL        = <link do ranking para a mensagem 04>
 *
 * ─── ATIVAÇÃO ──────────────────────────────────────────────────────────
 *   1. Configurar o trigger Webhook no flow e copiar URL + segredo
 *   2. Preencher as Script Properties acima
 *   3. setupCrmSync()              — colunas + triggers
 *   4. testBolsaoWebhookPayload()  — confere o JSON que será enviado
 *   5. testBolsaoWebhookConfig()   — valida URLs/segredo configurados
 * ═══════════════════════════════════════════════════════════════════════
 */

// Abas onde garantimos as colunas de status. A jornada automática usa Bolsão.
const CRM_TABS = ['Lista de Espera', 'Lead Magnet - Dicionário', 'Lives', 'Bolsão'];

const BOLSAO_TAB = 'Bolsão';
const CRM_COLS = [
  'CRM Sync', 'CRM Sync At',
  'WPP 02 Sync', 'WPP 02 Sync At',
  'WPP 03 Sync', 'WPP 03 Sync At',
  'WPP 04 Sync', 'WPP 04 Sync At'
];
const CRM_CONFIG_SHEET = 'Config CRM';
const CRM_BATCH_SIZE = 10;
const BOLSAO_WPP_SCHEDULE_BATCH = 25;
const BOLSAO_WPP_SECRET_HEADER = 'X-Mensageiro-Webhook-Secret';

const BOLSAO_WPP_STEPS = [
  {
    step: 'boas_vindas',
    label: 'Mensagem 01 — Boas-vindas',
    template: 'bolsao_boas_vindas',
    statusCol: 'CRM Sync',
    urlProp: 'BOLSAO_WPP_01_WEBHOOK_URL',
    scheduledAt: ''
  },
  {
    step: 'lembrete_vespera',
    label: 'Mensagem 02 — Lembrete véspera',
    template: 'bolsao_lembrete_vespera',
    statusCol: 'WPP 02 Sync',
    urlProp: 'BOLSAO_WPP_02_WEBHOOK_URL',
    scheduledAt: '2026-06-27T18:00:00-03:00'
  },
  {
    step: 'dia_prova',
    label: 'Mensagem 03 — Dia da prova',
    template: 'bolsao_dia_prova',
    statusCol: 'WPP 03 Sync',
    urlProp: 'BOLSAO_WPP_03_WEBHOOK_URL',
    scheduledAt: '2026-06-28T07:35:00-03:00'
  },
  {
    step: 'pos_prova',
    label: 'Mensagem 04 — Pós-prova ranking',
    template: 'bolsao_pos_prova',
    statusCol: 'WPP 04 Sync',
    urlProp: 'BOLSAO_WPP_04_WEBHOOK_URL',
    scheduledAt: '2026-06-29T18:05:00-03:00'
  }
];


// ══════════════════════ HTTP ══════════════════════

function crmRequest_(method, path, payload) {
  var props = PropertiesService.getScriptProperties();
  var base = props.getProperty('CRM_API_BASE');
  var token = props.getProperty('CRM_API_TOKEN');
  if (!base || !token) throw new Error('CRM_API_BASE / CRM_API_TOKEN não configurados em Script Properties');

  var options = {
    method: method.toLowerCase(),
    headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/json' },
    muteHttpExceptions: true
  };
  if (payload) { options.contentType = 'application/json'; options.payload = JSON.stringify(payload); }

  var res = UrlFetchApp.fetch(base.replace(/\/$/, '') + path, options);
  var code = res.getResponseCode();
  var body;
  try { body = JSON.parse(res.getContentText()); } catch (_) { body = { _raw: res.getContentText() }; }
  return { code: code, ok: code >= 200 && code < 300, body: body };
}

function crmTenantPath_(suffix) {
  var tenant = PropertiesService.getScriptProperties().getProperty('CRM_TENANT_ID');
  if (!tenant) throw new Error('CRM_TENANT_ID não configurado em Script Properties');
  return '/tenants/' + encodeURIComponent(tenant) + suffix;
}


// ══════════════════════ WORKER ══════════════════════

/**
 * Trigger 1 min. Leads novos da aba Bolsão com "CRM Sync" vazio disparam
 * o webhook da mensagem 01 (boas-vindas).
 */
function syncPendingToCRM() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var processed = processBolsaoWppStep_(getBolsaoWppStep_('boas_vindas'), CRM_BATCH_SIZE, new Date());
    if (processed > 0) console.log('Bolsão WhatsApp 01: ' + processed + ' leads processados');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Trigger 5 min. Quando a data/hora de uma etapa agendada chega, envia
 * o respectivo webhook para linhas ainda pendentes daquela etapa.
 */
function processBolsaoWhatsAppSchedule() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var now = new Date();
    BOLSAO_WPP_STEPS.forEach(function(step) {
      if (!step.scheduledAt) return; // mensagem 01 é processada por syncPendingToCRM()
      if (now.getTime() < new Date(step.scheduledAt).getTime()) return;
      try {
        var processed = processBolsaoWppStep_(step, BOLSAO_WPP_SCHEDULE_BATCH, now);
        if (processed > 0) console.log(step.label + ': ' + processed + ' leads processados');
      } catch (err) {
        console.log(step.label + ' não processada: ' + err);
      }
    });
  } finally {
    lock.releaseLock();
  }
}

function processBolsaoWppStep_(step, batchSize, now) {
  var endpoint = bolsaoWebhookEndpoint_(step);
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(BOLSAO_TAB);
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var cols = headerIndexes_(sheet);
  if (!cols[step.statusCol]) throw new Error('Coluna "' + step.statusCol + '" ausente. Rode setupCrmSync().');

  var lastRow = sheet.getLastRow();
  var statuses = sheet.getRange(2, cols[step.statusCol], lastRow - 1, 1).getValues();
  var processed = 0;

  for (var r = 0; r < statuses.length && processed < batchSize; r++) {
    if (statuses[r][0] !== '') continue;

    var rowNum = r + 2;
    var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
    var get = function(name) { return cols[name] ? String(row[cols[name] - 1] || '').trim() : ''; };
    var phone = normalizeE164_(get('WhatsApp'));

    if (!phone) {
      markCell_(sheet, rowNum, cols, step.statusCol, 'skip:sem_whatsapp');
      processed++;
      continue;
    }

    try {
      var payload = bolsaoBuildWebhookPayload_(get, phone, step, now);
      var result = mensageiroWebhookPost_(endpoint, payload);
      markCell_(sheet, rowNum, cols, step.statusCol, 'ok:http_' + result.code);
    } catch (err) {
      markCell_(sheet, rowNum, cols, step.statusCol, 'err:' + String(err).substring(0, 180));
      logError('Bolsão WhatsApp webhook: ' + err, { parameter: { phone: phone, step: step.step, sheet: BOLSAO_TAB } });
    }

    processed++;
  }

  return processed;
}

function mensageiroWebhookPost_(endpoint, payload) {
  var headers = {};
  headers[endpoint.secretHeader] = endpoint.secret;

  var res = UrlFetchApp.fetch(endpoint.url, {
    method: 'post',
    contentType: 'application/json',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code < 200 || code >= 300) {
    throw new Error('Webhook HTTP ' + code + ': ' + String(text).substring(0, 250));
  }

  return { code: code, body: text };
}

function bolsaoWebhookEndpoint_(step) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty(step.urlProp) || props.getProperty('BOLSAO_WPP_WEBHOOK_URL');
  var secret = props.getProperty('BOLSAO_WPP_WEBHOOK_SECRET') || props.getProperty('MENSAGEIRO_WEBHOOK_SECRET');
  var secretHeader = props.getProperty('BOLSAO_WPP_SECRET_HEADER') || BOLSAO_WPP_SECRET_HEADER;

  if (!url) {
    throw new Error(step.urlProp + ' ou BOLSAO_WPP_WEBHOOK_URL não configurado em Script Properties');
  }
  if (!secret) {
    throw new Error('BOLSAO_WPP_WEBHOOK_SECRET não configurado em Script Properties');
  }

  return { url: url, secret: secret, secretHeader: secretHeader };
}

function bolsaoBuildWebhookPayload_(get, phone, step, now) {
  var name = get('Nome') || get('E-mail');
  var email = get('E-mail').toLowerCase();
  var firstName = firstName_(name);
  var rankingUrl = PropertiesService.getScriptProperties().getProperty('BOLSAO_RANKING_URL') || '';
  var secondParam = '';

  if (step.step === 'dia_prova') secondParam = email;
  if (step.step === 'pos_prova') secondParam = rankingUrl;

  return {
    campaign: 'bolsao_2026',
    step: step.step,
    template: step.template,
    scheduledAt: step.scheduledAt || '',
    sentAt: now ? now.toISOString() : new Date().toISOString(),
    source: get('Origem') || 'bolsao_lp',
    sheet: BOLSAO_TAB,
    customer: {
      name: name,
      first_name: firstName,
      email: email,
      phone: phone
    },
    template_params: {
      body_1: firstName,
      body_2: secondParam
    },
    ranking_url: rankingUrl,
    page: get('Página'),
    referrer: get('Referrer'),
    ref: get('Ref'),
    utm_source: get('UTM Source'),
    utm_medium: get('UTM Medium'),
    utm_campaign: get('UTM Campaign'),
    device: get('Dispositivo')
  };
}

function getBolsaoWppStep_(stepName) {
  for (var i = 0; i < BOLSAO_WPP_STEPS.length; i++) {
    if (BOLSAO_WPP_STEPS[i].step === stepName) return BOLSAO_WPP_STEPS[i];
  }
  throw new Error('Etapa WhatsApp não encontrada: ' + stepName);
}

function crmCreateLead_(lead) {
  var res = crmRequest_('POST', crmTenantPath_('/leads'), lead);
  if (!res.ok) throw new Error('POST /leads HTTP ' + res.code + ': ' + JSON.stringify(res.body).substring(0, 200));
  return res.body && res.body.data && res.body.data.id;
}

/** Dedupe: procura lead pelo telefone normalizado. Retorna id ou null. */
function crmFindLeadByPhone_(phone) {
  var res = crmRequest_('GET', crmTenantPath_('/leads?search=' + encodeURIComponent(phone) + '&limit=1'), null);
  if (!res.ok) return null; // busca falhou → deixa o POST decidir (não bloqueia ingestão)
  var items = res.body && res.body.data;
  if (Array.isArray(items) && items.length && items[0].phone === phone) return items[0].id;
  return null;
}

function buildCrmTags_(get, cfg) {
  var tags = [];
  if (get('Origem')) tags.push(get('Origem'));
  (cfg.tags || []).forEach(function(t) { if (tags.indexOf(t) === -1) tags.push(t); });
  return tags;
}

function firstName_(name) {
  var cleaned = String(name || '').trim();
  if (!cleaned) return 'concurseiro(a)';
  return cleaned.split(/\s+/)[0];
}

/** Dígitos BR (da planilha, sem DDI) → E.164 +55DDDXXXXXXXXX. */
function normalizeE164_(digits) {
  var d = String(digits || '').replace(/\D+/g, '');
  if (d.length > 11 && d.substring(0, 2) === '55') d = d.substring(2);
  if (d.length < 10 || d.length > 11) return '';
  return '+55' + d;
}

/** Lê a aba Config CRM → { 'Lista de Espera': {pipelineId, stageId, tags[]}, ... } */
function loadCrmConfig_() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(CRM_CONFIG_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return {};
  var rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 4).getValues();
  var out = {};
  rows.forEach(function(r) {
    var aba = String(r[0] || '').trim();
    var pipelineId = String(r[1] || '').trim();
    var stageId = String(r[2] || '').trim();
    if (!aba || !pipelineId || !stageId) return;
    out[aba] = {
      pipelineId: pipelineId,
      stageId: stageId,
      tags: String(r[3] || '').split(',').map(function(s) { return s.trim(); }).filter(Boolean)
    };
  });
  return out;
}


// ══════════════════════ SETUP / TESTES ══════════════════════

/** 1× — colunas de status WhatsApp + triggers. Idempotente. */
function setupCrmSync() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();

  CRM_TABS.forEach(function(tabName) {
    var sheet = ss.getSheetByName(tabName);
    if (!sheet) return;
    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
    CRM_COLS.forEach(function(col) {
      if (headers.indexOf(col) === -1) {
        var c = sheet.getLastColumn() + 1;
        sheet.getRange(1, c).setValue(col).setFontWeight('bold')
          .setBackground('#1B2A4A').setFontColor('#FFFFFF');
        headers.push(col);
      }
    });
  });
  Logger.log('✅ Colunas de status WhatsApp garantidas em: ' + CRM_TABS.join(', '));

  recreateTrigger_('syncPendingToCRM', function(b) { return b.timeBased().everyMinutes(1); });
  recreateTrigger_('processBolsaoWhatsAppSchedule', function(b) { return b.timeBased().everyMinutes(5); });

  Logger.log('✅ Trigger criado: syncPendingToCRM roda a cada 1 minuto (mensagem 01)');
  Logger.log('✅ Trigger criado: processBolsaoWhatsAppSchedule roda a cada 5 minutos (mensagens 02–04)');
  Logger.log('⚙️ Configure BOLSAO_WPP_WEBHOOK_SECRET e BOLSAO_WPP_WEBHOOK_URL ou as URLs BOLSAO_WPP_01/02/03/04_WEBHOOK_URL em Script Properties.');
}

/** Loga funis e estágios existentes no Mensageiro (pra copiar IDs pra Config CRM). */
function crmListPipelines() {
  var res = crmRequest_('GET', crmTenantPath_('/pipelines'), null);
  if (!res.ok) { Logger.log('❌ HTTP ' + res.code + ': ' + JSON.stringify(res.body).substring(0, 400)); return; }
  var pipelines = (res.body && res.body.data) || [];
  if (!pipelines.length) { Logger.log('ℹ️ Nenhum funil — crie os funis no Mensageiro (/configuracoes/crm/funis) e rode de novo.'); return; }
  pipelines.forEach(function(p) {
    Logger.log('Funil "' + p.name + '" → pipelineId: ' + p.id);
    (p.stages || []).forEach(function(s) {
      Logger.log('   Estágio "' + s.name + '" → stageId: ' + s.id);
    });
  });
}

/** Cria 1 lead de teste no CRM (depois apague no painel do Mensageiro). */
function testCrmCreateLead() {
  var configs = loadCrmConfig_();
  var cfg = configs['Lista de Espera'];
  if (!cfg) { Logger.log('❌ Config CRM sem IDs pra "Lista de Espera" — preencha primeiro.'); return; }
  var id = crmCreateLead_({
    name: 'Teste Sync Planilha',
    email: 'teste.crm.' + Date.now() + '@example.com',
    phone: '+5511999990000',
    tags: ['teste'],
    pipelineId: cfg.pipelineId,
    stageId: cfg.stageId,
    attributes: { origem: 'teste_apps_script' }
  });
  Logger.log('✅ Lead de teste criado. id=' + id + ' — apague no painel do Mensageiro depois de conferir.');
}

/** Mostra o JSON que será recebido pelo flow como variável `webhook`. Não envia. */
function testBolsaoWebhookPayload() {
  var sample = {
    Nome: 'Maria Silva',
    'E-mail': 'maria@example.com',
    WhatsApp: '(11) 99999-0000',
    Origem: 'bolsao_lp',
    Ref: 'abc123',
    Página: '/?utm_source=meta&utm_medium=cpc&utm_campaign=bolsao',
    Referrer: 'https://instagram.com/',
    'UTM Source': 'meta',
    'UTM Medium': 'cpc',
    'UTM Campaign': 'bolsao',
    Dispositivo: 'Mobile'
  };
  var get = function(name) { return String(sample[name] || '').trim(); };
  var payload = bolsaoBuildWebhookPayload_(get, normalizeE164_(sample.WhatsApp), getBolsaoWppStep_('boas_vindas'), new Date('2026-06-12T12:00:00-03:00'));
  Logger.log(JSON.stringify(payload, null, 2));
}

/** Valida se URLs e segredo dos webhooks do Bolsão estão configurados. Não envia. */
function testBolsaoWebhookConfig() {
  BOLSAO_WPP_STEPS.forEach(function(step) {
    var endpoint = bolsaoWebhookEndpoint_(step);
    Logger.log('✅ ' + step.label + ' → ' + endpoint.url + ' · header=' + endpoint.secretHeader + ' · secret=' + maskSecret_(endpoint.secret));
  });
}

/**
 * Envia um payload de teste para o webhook da mensagem 01.
 * Exige BOLSAO_WPP_TEST_PHONE em Script Properties para evitar envio acidental.
 */
function testBolsaoWebhookSendBoasVindas() {
  var props = PropertiesService.getScriptProperties();
  var testPhone = normalizeE164_(props.getProperty('BOLSAO_WPP_TEST_PHONE'));
  if (!testPhone) {
    Logger.log('❌ Configure BOLSAO_WPP_TEST_PHONE em Script Properties antes de enviar teste real.');
    return;
  }

  var sample = {
    Nome: props.getProperty('BOLSAO_WPP_TEST_NAME') || 'Teste Bolsão',
    'E-mail': props.getProperty('BOLSAO_WPP_TEST_EMAIL') || 'teste@example.com',
    WhatsApp: testPhone,
    Origem: 'teste_apps_script',
    Ref: '',
    Página: '/teste',
    Referrer: '',
    'UTM Source': 'teste',
    'UTM Medium': 'apps_script',
    'UTM Campaign': 'bolsao',
    Dispositivo: 'Desktop'
  };
  var get = function(name) { return String(sample[name] || '').trim(); };
  var step = getBolsaoWppStep_('boas_vindas');
  var payload = bolsaoBuildWebhookPayload_(get, testPhone, step, new Date());
  var result = mensageiroWebhookPost_(bolsaoWebhookEndpoint_(step), payload);
  Logger.log('✅ Webhook de teste enviado. HTTP ' + result.code);
}

function maskSecret_(secret) {
  var s = String(secret || '');
  if (s.length <= 6) return '***';
  return s.substring(0, 3) + '***' + s.substring(s.length - 3);
}
