/**
 * ═══════════════════════════════════════════════════════════════════════
 * LEADS Fluência Contábil — Endpoint Unificado (v3 — sync assíncrono)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * doPost grava o lead na planilha em <2s e retorna.
 * Coluna "ML Sync" começa vazia (= pendente).
 *
 * Trigger temporal `syncPendingToMailerLite` roda a cada 1min, pega
 * pendentes em batch (5/run) e sincroniza com MailerLite. Latência da
 * API externa NUNCA afeta a captura de lead.
 *
 * ─── PRÉ-REQUISITO ────────────────────────────────────────────────────
 * Script Properties → MAILERLITE_API_KEY = (API key)
 * Script Properties → MENSAGEIRO_WEBHOOK_URL = (webhook dos demais fluxos)
 * Script Properties → MENSAGEIRO_WEBHOOK_SECRET = (secret dos demais fluxos)
 * Script Properties → MENSAGEIRO_LIVES_WEBHOOK_URL = (webhook exclusivo das Lives)
 * Script Properties → MENSAGEIRO_LIVES_WEBHOOK_SECRET = (secret exclusivo das Lives)
 *   (nunca hardcoded no código — este arquivo é público via GitHub Pages)
 *
 * ─── PÓS-DEPLOY (rodar 1× após cada deploy) ───────────────────────────
 *   • setupAfterDeploy()  — adiciona colunas ML/Mensageiro Sync + triggers 1min
 *
 * ─── VALIDAÇÃO ────────────────────────────────────────────────────────
 *   • testMailerLiteAuth()   — checa API key
 *   • testNewsletterFlow()   — simula lead Newsletter (deve rodar <2s)
 *   • testListaFlow()        — simula lead Lista
 *   • testDicionarioFlow()   — simula lead LP Dicionário
 *   • testLivesFlow()        — simula lead LP Lives
 *   • testRegressionAll()    — roda 4 fluxos + 2 fallbacks (11 cases)
 *   • testMensageiroWebhook() — dispara 1 mensagem REAL de teste (não é dry-run;
 *     exige Script Property MENSAGEIRO_TEST_PHONE com seu próprio número)
 *
 * ─── SYNC MENSAGEIRO (Dicionário + Lives) ─────────────────────────────
 * Todo novo lead com telefone das LPs Dicionário e Lives é encaminhado
 * via webhook pro Mensageiro (trigger `syncPendingToMensageiro`, 1min,
 * mesmo padrão assíncrono do sync com MailerLite). Leads sem telefone
 * ficam marcados 'skip:sem_telefone' — não há WhatsApp pra acionar.
 * ═══════════════════════════════════════════════════════════════════════
 */

// ══════════════════════ CONFIG ══════════════════════

const SHEETS = {
  NEWSLETTER:  'Newsletter',
  LISTA:       'Lista de Espera',
  DICIONARIO:  'Lead Magnet - Dicionário',
  LIVES:       'Lives',
  BOLSAO:      'Bolsão',
  ERRORS:      '_errors'
};

const ML_GROUPS = {
  NEWSLETTER:  '185179968949454391',
  LISTA:       '185179979081843871',
  DICIONARIO:  '185179987559581196',
  LIVES_LP:    '188077924412294920'  // group único — todas as 4 lives do replanejamento ago/2026
};

const ML_API_URL = 'https://connect.mailerlite.com/api/subscribers';

// 5 × 60s timeout máx = 5min < 6min limite Apps Script. Seguro.
const ML_BATCH_SIZE = 5;

// Trigger separado do ML (própria janela de 6min) — só processa a aba Dicionário.
const MENSAGEIRO_BATCH_SIZE = 5;


// ══════════════════════ ROTAS WEB APP ══════════════════════

function doPost(e) {
  try {
    var p = (e && e.parameter) ? e.parameter : {};
    var email = String(p.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) {
      return jsonResponse({ ok: false, error: 'email inválido' });
    }
    p.email = email;
    return routeByOrigin(p);
  } catch (err) {
    logError(err, e);
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  return ContentService
    .createTextOutput('Endpoint unificado · LEADS Fluência Contábil · ' + new Date().toISOString())
    .setMimeType(ContentService.MimeType.TEXT);
}


// ══════════════════════ ROTEAMENTO ══════════════════════

function routeByOrigin(p) {
  var origem   = String(p.origem || '').trim().toLowerCase();
  var temNome  = !!(p.nome && String(p.nome).trim());
  var temWhats = !!(p.telefone || p.telefone_digits || p.whatsapp);

  if (origem.indexOf('bolsao') === 0) return handleBolsao(p); // bolsao_lp e variantes

  if (origem.indexOf('dicionario_') === 0 || origem === 'lead_magnet_dicionario') {
    return handleDicionario(p);
  }
  var newsletterOrigins = ['exit_intent', 'sticky_bar', 'blog_newsletter', 'newsletter'];
  if (newsletterOrigins.indexOf(origem) >= 0) return handleNewsletter(p);

  var listaOrigins = ['blog_inline_cta', 'lista_espera', 'site_lista_espera'];
  if (listaOrigins.indexOf(origem) >= 0) return handleLista(p);

  if (origem.indexOf('lives_form') === 0) return handleLives(p);

  if (temNome || temWhats) return handleLista(p);
  return handleNewsletter(p);
}


// ══════════════════════ HANDLERS (sem MailerLite síncrono) ══════════════════════

function handleNewsletter(p) {
  var sheet = ensureSheet(SHEETS.NEWSLETTER, NEWSLETTER_HEADERS, NEWSLETTER_NOTES);
  sheet.appendRow([
    new Date(), p.email,
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', ''  // ML Sync, ML Sync At
  ]);
  return jsonResponse({ ok: true, aba: SHEETS.NEWSLETTER });
}

function handleLista(p) {
  var sheet = ensureSheet(SHEETS.LISTA, LISTA_HEADERS, LISTA_NOTES);
  sheet.appendRow([
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', ''
  ]);
  return jsonResponse({ ok: true, aba: SHEETS.LISTA });
}

function handleDicionario(p) {
  var sheet = ensureSheet(SHEETS.DICIONARIO, DICIONARIO_HEADERS, DICIONARIO_NOTES);
  sheet.appendRow([
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || ''),
    String(p.origem || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', ''
  ]);
  return jsonResponse({ ok: true, aba: SHEETS.DICIONARIO });
}

function handleBolsao(p) {
  // Aba pós-MailerLite: sem colunas ML Sync (SES/Seq/CRM são adicionadas pelo setupBolsao do ses_mailer.gs)
  var sheet = ensureSheet(SHEETS.BOLSAO, BOLSAO_HEADERS, BOLSAO_NOTES);
  sheet.appendRow([
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || '')
  ]);
  return jsonResponse({ ok: true, aba: SHEETS.BOLSAO });
}

function handleLives(p) {
  var sheet = ensureSheet(SHEETS.LIVES, LIVES_HEADERS, LIVES_NOTES);
  var rowNum = sheet.getLastRow() + 1;
  sheet.appendRow([
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', '', '', ''
  ]);
  dispatchLiveLeadImmediately_(p, sheet, rowNum);
  return jsonResponse({ ok: true, aba: SHEETS.LIVES });
}

/**
 * Dispara as integrações críticas da LP de Lives ainda dentro do doPost.
 * Falhas ficam registradas nas colunas de status e podem ser recuperadas
 * pelos workers assíncronos já existentes.
 */
function dispatchLiveLeadImmediately_(p, sheet, rowNum) {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    dispatchLiveLeadImmediatelyUnlocked_(p, sheet, rowNum);
  } finally {
    lock.releaseLock();
  }
}

function dispatchLiveLeadImmediatelyUnlocked_(p, sheet, rowNum) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  var cols = {};
  headers.forEach(function(name, i) { cols[name] = i + 1; });
  var email = String(p.email || '').trim().toLowerCase();
  var nome = String(p.nome || '').trim();
  var telefone = normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || '');
  var telefoneE164 = '+55' + telefone;
  var now = new Date();

  // Mensageiro/CRM — imediato via webhook. A aba Lives usa CRM Sync.
  var crmSyncCol = cols['CRM Sync'] || cols['Mensageiro Sync'];
  var crmSyncAtCol = cols['CRM Sync At'] || cols['Mensageiro Sync At'];
  if (typeof pushToMensageiroLives_ === 'function' && crmSyncCol) {
    var crmPayload = {
      evento: 'lives_lead', nome: nome, email: email, telefone: telefoneE164,
      customer: { name: nome, email: email, phone: telefoneE164 },
      origem: String(p.origem || ''), pagina: String(p.pagina || ''),
      utm_source: String(p.utm_source || ''), utm_medium: String(p.utm_medium || ''),
      utm_campaign: String(p.utm_campaign || ''), dispositivo: String(p.dispositivo || ''),
      timestamp: now.toISOString()
    };
    try {
      pushToMensageiroLives_(crmPayload);
      sheet.getRange(rowNum, crmSyncCol).setValue('ok');
      if (crmSyncAtCol) sheet.getRange(rowNum, crmSyncAtCol).setValue(now);
    } catch (err) {
      sheet.getRange(rowNum, crmSyncCol).setValue('err:' + String(err).substring(0, 180));
      if (crmSyncAtCol) sheet.getRange(rowNum, crmSyncAtCol).setValue(now);
      logError('Mensageiro imediato Lives: ' + err, { parameter: { email: email, sheet: SHEETS.LIVES } });
    }
  }

  // AWS SES — contato e primeiro email da sequência D, se o módulo SES estiver no projeto.
  if (typeof sesUpsertContact_ === 'function' && cols['SES Sync']) {
    try {
      sesUpsertContact_(email, 'lives', { name: nome, phone: telefone, origem: String(p.origem || '') });
      sheet.getRange(rowNum, cols['SES Sync']).setValue('ok');
      if (cols['SES Sync At']) sheet.getRange(rowNum, cols['SES Sync At']).setValue(now);

      var steps = typeof loadSequenceConfig_ === 'function' ? loadSequenceConfig_() : {};
      var first = steps.D && steps.D[0];
      if (first && typeof renderTemplate_ === 'function' && typeof sesSendMarketing_ === 'function') {
        var html = renderTemplate_(first.template, nome);
        sesSendMarketing_(email, first.assunto, html, 'lives');
        var nextStep = steps.D[1];
        if (cols['Seq Passo']) sheet.getRange(rowNum, cols['Seq Passo']).setValue(nextStep ? 1 : 'concluída');
        if (cols['Seq Próximo Em'] && nextStep) {
          sheet.getRange(rowNum, cols['Seq Próximo Em']).setValue(
            new Date(now.getTime() + (nextStep.dias - first.dias) * 86400000)
          );
        }
      }
    } catch (err) {
      if (cols['SES Sync']) sheet.getRange(rowNum, cols['SES Sync']).setValue('err:' + String(err).substring(0, 180));
      if (cols['SES Sync At']) sheet.getRange(rowNum, cols['SES Sync At']).setValue(now);
      logError('SES imediato Lives: ' + err, { parameter: { email: email, sheet: SHEETS.LIVES } });
    }
  }
}


// ══════════════════════ SCHEMAS DAS ABAS ══════════════════════

const NEWSLETTER_HEADERS = [
  'Data', 'E-mail', 'Origem', 'Ref',
  'Página', 'Referrer',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Dispositivo',
  'ML Sync', 'ML Sync At'
];
const NEWSLETTER_NOTES = [
  'Timestamp do submit',
  'E-mail do lead',
  'Onde foi capturado: exit_intent, sticky_bar, blog_newsletter, newsletter',
  'Código de indicação (?ref=xxx)',
  'Pathname + query da página',
  'Referrer do navegador',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Mobile (≤720px) ou Desktop',
  'Status sync MailerLite: vazio=pendente, ok=enviado, err:...=falhou, migrated=lead anterior à arquitetura assíncrona',
  'Timestamp do último sync com MailerLite'
];

const LISTA_HEADERS = [
  'Data', 'Nome', 'E-mail', 'WhatsApp', 'Origem', 'Ref',
  'Página', 'Referrer',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Dispositivo',
  'ML Sync', 'ML Sync At'
];
const LISTA_NOTES = [
  'Timestamp do submit', 'Nome completo', 'E-mail', 'WhatsApp só dígitos',
  'Onde foi capturado: blog_inline_cta, lista_espera, site_lista_espera',
  'Código de indicação', 'Pathname + query', 'Referrer do navegador',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'Mobile ou Desktop',
  'Status sync MailerLite: vazio=pendente, ok=enviado, err:...=falhou, migrated=lead anterior à arquitetura assíncrona',
  'Timestamp do último sync'
];

const DICIONARIO_HEADERS = [
  'Data', 'Nome', 'E-mail', 'WhatsApp', 'Origem',
  'Página', 'Referrer',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Dispositivo',
  'ML Sync', 'ML Sync At',
  'Mensageiro Sync', 'Mensageiro Sync At'
];
const DICIONARIO_NOTES = [
  'Timestamp do submit', 'Nome (só forms completos)', 'E-mail',
  'WhatsApp dígitos (só forms completos)',
  'Origem: dicionario_form_top | dicionario_form_bottom | dicionario_exit_intent | dicionario_sticky_bar',
  'Pathname + query da LP', 'Referrer do navegador',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'Mobile ou Desktop',
  'Status sync MailerLite: vazio=pendente, ok=enviado, err:...=falhou, migrated=lead anterior à arquitetura assíncrona',
  'Timestamp do último sync MailerLite',
  'Status sync Mensageiro (WhatsApp): vazio=pendente, ok=enviado, err:...=falhou, skip:sem_telefone=sem WhatsApp pra acionar, migrated=lead anterior a esta integração',
  'Timestamp do último sync Mensageiro'
];

// Bolsão: aba criada já na era SES — sem colunas ML Sync de propósito
const BOLSAO_HEADERS = [
  'Data', 'Nome', 'E-mail', 'WhatsApp', 'Origem', 'Ref',
  'Página', 'Referrer',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Dispositivo'
];
const BOLSAO_NOTES = [
  'Timestamp do submit', 'Nome completo', 'E-mail', 'WhatsApp só dígitos',
  'Origem: bolsao_lp (variante Copa distinguível pela coluna Página)',
  'Código de indicação', 'Pathname + query', 'Referrer do navegador',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'Mobile ou Desktop'
];

const LIVES_HEADERS = [
  'Data', 'Nome', 'E-mail', 'WhatsApp', 'Origem', 'Ref',
  'Página', 'Referrer',
  'UTM Source', 'UTM Medium', 'UTM Campaign',
  'Dispositivo',
  'ML Sync', 'ML Sync At',
  'CRM Sync', 'CRM Sync At'
];
const LIVES_NOTES = [
  'Timestamp do submit', 'Nome completo', 'E-mail', 'WhatsApp só dígitos',
  'Origem: lives_form_top | lives_form_bottom',
  'Código de indicação', 'Pathname + query (deve começar com /lives.html)', 'Referrer do navegador',
  'UTM Source', 'UTM Medium', 'UTM Campaign', 'Mobile ou Desktop',
  'Status sync MailerLite: vazio=pendente, ok=enviado, err:...=falhou, migrated=lead anterior à arquitetura assíncrona',
  'Timestamp do último sync MailerLite',
  'Status sync CRM/Mensageiro: vazio=pendente, ok=enviado, skip:sem_telefone ou err:...=falhou',
  'Timestamp do último sync CRM/Mensageiro'
];


// ══════════════════════ HELPERS ══════════════════════

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email));
}

function normalizePhone(tel) {
  var digits = String(tel || '').replace(/\D+/g, '');
  if (digits.length > 11 && digits.substring(0, 2) === '55') digits = digits.substring(2);
  return digits;
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Garante que a aba existe e tem as colunas esperadas.
 * Se aba nova: cria com headers/notes/formato.
 * Se aba existe mas faltam colunas: adiciona no fim e marca leads existentes como "migrated".
 */
function ensureSheet(name, headers, notes) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    sheet.getRange(1, 1, 1, headers.length)
      .setValues([headers])
      .setFontWeight('bold')
      .setBackground('#1B2A4A')
      .setFontColor('#FFFFFF');
    sheet.setFrozenRows(1);
    if (notes && notes.length) {
      sheet.getRange(1, 1, 1, notes.length).setNotes([notes]);
    }
    sheet.getRange(2, 1, sheet.getMaxRows() - 1, 1).setNumberFormat('dd/mm/yyyy hh:mm:ss');
    sheet.setColumnWidth(1, 140);
    sheet.autoResizeColumns(2, headers.length - 1);
    return sheet;
  }

  // Aba existe: adiciona colunas faltantes (caso de migração v2 → v3)
  var existingLastCol = sheet.getLastColumn();
  if (existingLastCol < headers.length) {
    var firstNewCol = existingLastCol + 1;
    var newCount = headers.length - existingLastCol;
    var newHeaders = headers.slice(existingLastCol);

    sheet.getRange(1, firstNewCol, 1, newCount)
      .setValues([newHeaders])
      .setFontWeight('bold')
      .setBackground('#1B2A4A')
      .setFontColor('#FFFFFF');

    if (notes && notes.length === headers.length) {
      var newNotes = notes.slice(existingLastCol);
      sheet.getRange(1, firstNewCol, 1, newCount).setNotes([newNotes]);
    }

    // Marca leads existentes como "migrated" nas colunas de status REALMENTE
    // novas (padrão "* Sync" / "* Sync At") — não tentar re-sincronizar retroativo.
    // Genérico de propósito: cobre ML Sync, Mensageiro Sync e futuras colunas
    // de sync sem precisar tocar aqui de novo. (Se quiser forçar re-sync de um
    // lead específico, apague a célula de sync correspondente.)
    var lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      for (var ni = 0; ni < newHeaders.length; ni++) {
        var colIdx = firstNewCol + ni;
        var colName = newHeaders[ni];
        if (/ Sync At$/.test(colName)) {
          sheet.getRange(2, colIdx, lastRow - 1, 1).setValue(new Date());
        } else if (/ Sync$/.test(colName)) {
          sheet.getRange(2, colIdx, lastRow - 1, 1).setValue('migrated');
        }
      }
    }
  }
  return sheet;
}

function logError(err, e) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var log = ss.getSheetByName(SHEETS.ERRORS) || ss.insertSheet(SHEETS.ERRORS);
    if (log.getLastRow() === 0) {
      log.appendRow(['Timestamp', 'Erro', 'Parâmetros']);
      log.getRange(1, 1, 1, 3).setFontWeight('bold');
      log.setFrozenRows(1);
    }
    log.appendRow([new Date(), String(err), JSON.stringify(e && e.parameter ? e.parameter : {})]);
  } catch (_) {}
}


// ══════════════════════ MAILERLITE — SYNC ASSÍNCRONO ══════════════════════

/**
 * Trigger temporal: roda a cada 1min.
 * Processa até ML_BATCH_SIZE leads pendentes (ML Sync vazio) por execução.
 */
function syncPendingToMailerLite() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('Outro sync em andamento — pulando');
    return;
  }

  try {
    var configs = [
      { name: SHEETS.NEWSLETTER,  headers: NEWSLETTER_HEADERS, group: ML_GROUPS.NEWSLETTER, hasNamePhone: false },
      { name: SHEETS.LISTA,       headers: LISTA_HEADERS,      group: ML_GROUPS.LISTA,      hasNamePhone: true },
      { name: SHEETS.DICIONARIO,  headers: DICIONARIO_HEADERS, group: ML_GROUPS.DICIONARIO, hasNamePhone: true },
      { name: SHEETS.LIVES,       headers: LIVES_HEADERS,      group: ML_GROUPS.LIVES_LP,   hasNamePhone: true }
    ];

    var processed = 0;
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    for (var c = 0; c < configs.length; c++) {
      if (processed >= ML_BATCH_SIZE) break;
      var cfg = configs[c];
      var sheet = ss.getSheetByName(cfg.name);
      if (!sheet) continue;

      var lastRow = sheet.getLastRow();
      if (lastRow < 2) continue;

      var mlSyncCol   = cfg.headers.indexOf('ML Sync') + 1;
      var mlSyncAtCol = cfg.headers.indexOf('ML Sync At') + 1;
      var emailCol    = cfg.headers.indexOf('E-mail') + 1;

      var syncCol = sheet.getRange(2, mlSyncCol, lastRow - 1, 1).getValues();

      for (var r = 0; r < syncCol.length; r++) {
        if (processed >= ML_BATCH_SIZE) break;
        if (syncCol[r][0] !== '') continue;

        var rowNum = r + 2;
        var rowData = sheet.getRange(rowNum, 1, 1, cfg.headers.length).getValues()[0];

        var email = String(rowData[emailCol - 1] || '').trim().toLowerCase();
        if (!isValidEmail(email)) {
          sheet.getRange(rowNum, mlSyncCol).setValue('err:invalid_email');
          sheet.getRange(rowNum, mlSyncAtCol).setValue(new Date());
          processed++;
          continue;
        }

        var fields = buildMLFieldsFromRow(rowData, cfg.headers, cfg.hasNamePhone);

        try {
          pushToMailerLite(email, cfg.group, fields);
          sheet.getRange(rowNum, mlSyncCol).setValue('ok');
          sheet.getRange(rowNum, mlSyncAtCol).setValue(new Date());
        } catch (err) {
          var errStr = String(err).substring(0, 200);
          sheet.getRange(rowNum, mlSyncCol).setValue('err:' + errStr);
          sheet.getRange(rowNum, mlSyncAtCol).setValue(new Date());
          logError('ML sync: ' + err, { parameter: { email: email, sheet: cfg.name } });
        }
        processed++;
      }
    }

    if (processed > 0) console.log('ML sync run: ' + processed + ' leads processados');
  } finally {
    lock.releaseLock();
  }
}

function buildMLFieldsFromRow(row, headers, hasNamePhone) {
  var get = function(name) {
    var i = headers.indexOf(name);
    return i >= 0 ? String(row[i] || '') : '';
  };
  var fields = {
    origem:         get('Origem'),
    pagina_captura: get('Página'),
    referrer:       get('Referrer'),
    utm_source:     get('UTM Source'),
    utm_medium:     get('UTM Medium'),
    utm_campaign:   get('UTM Campaign'),
    dispositivo:    get('Dispositivo'),
    ref_in:         get('Ref')
  };
  if (hasNamePhone) {
    var nome = get('Nome');
    if (nome) fields.name = nome;
    var phone = get('WhatsApp');
    if (phone) fields.phone = phone;
  }
  return fields;
}

function pushToMailerLite(email, groupId, fields) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('MAILERLITE_API_KEY');
  if (!apiKey) throw new Error('MAILERLITE_API_KEY não configurada em Script Properties');

  var body = { email: email, groups: [groupId], fields: fields || {} };

  var response = UrlFetchApp.fetch(ML_API_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
    payload: JSON.stringify(body),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ': ' + response.getContentText().substring(0, 300));
  }
  return JSON.parse(response.getContentText());
}


// ══════════════════════ MENSAGEIRO — SYNC ASSÍNCRONO (só Dicionário) ══════════════════════

/**
 * Trigger temporal separado do ML: roda a cada 1min, só processa a aba
 * "Lead Magnet - Dicionário". Cada lead novo com telefone é encaminhado
 * ao webhook do Mensageiro (chatbot flow) — vira ponto de partida da
 * qualificação/reativação por WhatsApp descrita na spec-quiz-qualificacao.
 *
 * Usa o MESMO LockService.getScriptLock() do sync com MailerLite: se as
 * duas triggers colidirem no mesmo minuto, uma delas perde a corrida e
 * tenta de novo no minuto seguinte (self-healing, sem duplicar envio).
 */
function syncPendingToMensageiro() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('Outro sync em andamento — pulando (Mensageiro)');
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.DICIONARIO);
    if (!sheet) return;

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    var h = DICIONARIO_HEADERS;
    var syncCol   = h.indexOf('Mensageiro Sync') + 1;
    var syncAtCol = h.indexOf('Mensageiro Sync At') + 1;
    var nomeCol   = h.indexOf('Nome') + 1;
    var emailCol  = h.indexOf('E-mail') + 1;
    var whatsCol  = h.indexOf('WhatsApp') + 1;
    var origemCol = h.indexOf('Origem') + 1;
    var paginaCol = h.indexOf('Página') + 1;
    var utmSCol   = h.indexOf('UTM Source') + 1;
    var utmMCol   = h.indexOf('UTM Medium') + 1;
    var utmCCol   = h.indexOf('UTM Campaign') + 1;
    var dispCol   = h.indexOf('Dispositivo') + 1;

    var values = sheet.getRange(2, 1, lastRow - 1, h.length).getValues();
    var processed = 0;

    for (var r = 0; r < values.length && processed < MENSAGEIRO_BATCH_SIZE; r++) {
      if (values[r][syncCol - 1] !== '') continue;

      var rowNum = r + 2;
      var whatsDigits = String(values[r][whatsCol - 1] || '').replace(/\D+/g, '');

      if (!whatsDigits) {
        sheet.getRange(rowNum, syncCol).setValue('skip:sem_telefone');
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
        processed++;
        continue;
      }

      var payload = {
        evento: 'dicionario_lead',
        nome: String(values[r][nomeCol - 1] || ''),
        email: String(values[r][emailCol - 1] || ''),
        telefone: formatPhoneE164BR(whatsDigits),
        origem: String(values[r][origemCol - 1] || ''),
        pagina: String(values[r][paginaCol - 1] || ''),
        utm_source: String(values[r][utmSCol - 1] || ''),
        utm_medium: String(values[r][utmMCol - 1] || ''),
        utm_campaign: String(values[r][utmCCol - 1] || ''),
        dispositivo: String(values[r][dispCol - 1] || ''),
        timestamp: new Date().toISOString()
      };

      try {
        pushToMensageiro(payload);
        sheet.getRange(rowNum, syncCol).setValue('ok');
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
      } catch (err) {
        var errStr = String(err).substring(0, 200);
        sheet.getRange(rowNum, syncCol).setValue('err:' + errStr);
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
        logError('Mensageiro sync: ' + err, { parameter: { email: payload.email, sheet: SHEETS.DICIONARIO } });
      }
      processed++;
    }

    if (processed > 0) console.log('Mensageiro sync run: ' + processed + ' leads processados');
  } finally {
    lock.releaseLock();
  }
}

/**
 * Trigger temporal: sincroniza os leads da aba Lives com o Mensageiro.
 * Usa status separado para não misturar o resultado do MailerLite.
 */
function syncPendingLivesToMensageiro() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    console.log('Outro sync em andamento — Lives pulando');
    return;
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEETS.LIVES);
    if (!sheet) return;

    var h = LIVES_HEADERS;
    var syncCol   = h.indexOf('CRM Sync') + 1;
    var syncAtCol = h.indexOf('CRM Sync At') + 1;
    var nomeCol   = h.indexOf('Nome') + 1;
    var emailCol  = h.indexOf('E-mail') + 1;
    var whatsCol  = h.indexOf('WhatsApp') + 1;
    var origemCol = h.indexOf('Origem') + 1;
    var paginaCol = h.indexOf('Página') + 1;
    var utmSCol   = h.indexOf('UTM Source') + 1;
    var utmMCol   = h.indexOf('UTM Medium') + 1;
    var utmCCol   = h.indexOf('UTM Campaign') + 1;
    var dispCol   = h.indexOf('Dispositivo') + 1;
    var lastRow = sheet.getLastRow();
    if (lastRow < 2 || syncCol < 1 || syncAtCol < 1) return;

    var values = sheet.getRange(2, 1, lastRow - 1, h.length).getValues();
    var processed = 0;
    for (var r = 0; r < values.length && processed < MENSAGEIRO_BATCH_SIZE; r++) {
      if (String(values[r][syncCol - 1] || '') !== '') continue;

      var rowNum = r + 2;
      var whatsDigits = String(values[r][whatsCol - 1] || '').replace(/\D+/g, '');
      if (!whatsDigits) {
        sheet.getRange(rowNum, syncCol).setValue('skip:sem_telefone');
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
        processed++;
        continue;
      }

      var payload = {
        evento: 'lives_lead',
        nome: String(values[r][nomeCol - 1] || ''),
        email: String(values[r][emailCol - 1] || ''),
        telefone: formatPhoneE164BR(whatsDigits),
        customer: {
          name: String(values[r][nomeCol - 1] || ''),
          email: String(values[r][emailCol - 1] || ''),
          phone: formatPhoneE164BR(whatsDigits)
        },
        origem: String(values[r][origemCol - 1] || ''),
        pagina: String(values[r][paginaCol - 1] || ''),
        utm_source: String(values[r][utmSCol - 1] || ''),
        utm_medium: String(values[r][utmMCol - 1] || ''),
        utm_campaign: String(values[r][utmCCol - 1] || ''),
        dispositivo: String(values[r][dispCol - 1] || ''),
        timestamp: new Date().toISOString()
      };

      try {
        pushToMensageiroLives_(payload);
        sheet.getRange(rowNum, syncCol).setValue('ok');
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
      } catch (err) {
        var errStr = String(err).substring(0, 200);
        sheet.getRange(rowNum, syncCol).setValue('err:' + errStr);
        sheet.getRange(rowNum, syncAtCol).setValue(new Date());
        logError('Mensageiro Lives sync: ' + err, { parameter: { email: payload.email, sheet: SHEETS.LIVES } });
      }
      processed++;
    }
    if (processed > 0) console.log('Mensageiro Lives sync run: ' + processed + ' leads processados');
  } finally {
    lock.releaseLock();
  }
}

/** BR sem DDI (10-11 díg) → E.164 (+55DDDNUMERO). Já com 55: só prefixa '+'. */
function formatPhoneE164BR(tel) {
  var digits = String(tel || '').replace(/\D+/g, '');
  if (digits.length === 10 || digits.length === 11) digits = '55' + digits;
  return '+' + digits;
}

function pushToMensageiro(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MENSAGEIRO_WEBHOOK_URL');
  var secret = props.getProperty('MENSAGEIRO_WEBHOOK_SECRET');
  if (!url || !secret) {
    throw new Error('MENSAGEIRO_WEBHOOK_URL / MENSAGEIRO_WEBHOOK_SECRET não configuradas em Script Properties');
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Mensageiro-Webhook-Secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('HTTP ' + code + ': ' + response.getContentText().substring(0, 300));
  }
  var text = response.getContentText();
  try { return JSON.parse(text); } catch (_) { return { raw: text }; }
}


// ══════════════════════ SETUP PÓS-DEPLOY ══════════════════════

/**
 * Roda 1× manualmente após deploy nessa estrutura.
 * 1. Garante colunas ML Sync nas 4 abas (marca leads existentes como "migrated")
 * 2. Cria/recria trigger temporal de sync (1 min)
 */
function setupAfterDeploy() {
  ensureSheet(SHEETS.NEWSLETTER,  NEWSLETTER_HEADERS, NEWSLETTER_NOTES);
  ensureSheet(SHEETS.LISTA,       LISTA_HEADERS,      LISTA_NOTES);
  ensureSheet(SHEETS.DICIONARIO,  DICIONARIO_HEADERS, DICIONARIO_NOTES);
  ensureSheet(SHEETS.LIVES,       LIVES_HEADERS,      LIVES_NOTES);
  ensureSheet(SHEETS.BOLSAO,      BOLSAO_HEADERS,     BOLSAO_NOTES);
  Logger.log('✅ Colunas ML Sync + Mensageiro Sync garantidas (Bolsão não tem — era SES)');

  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var fn = triggers[i].getHandlerFunction();
    if (fn === 'syncPendingToMailerLite' || fn === 'syncPendingToMensageiro' || fn === 'syncPendingLivesToMensageiro') {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  if (removed > 0) Logger.log('Removeu ' + removed + ' trigger(s) antigo(s)');

  ScriptApp.newTrigger('syncPendingToMailerLite').timeBased().everyMinutes(1).create();
  Logger.log('✅ Trigger criado: syncPendingToMailerLite roda a cada 1 minuto');
  ScriptApp.newTrigger('syncPendingToMensageiro').timeBased().everyMinutes(1).create();
  Logger.log('✅ Trigger criado: syncPendingToMensageiro roda a cada 1 minuto (Dicionário)');
  ScriptApp.newTrigger('syncPendingLivesToMensageiro').timeBased().everyMinutes(1).create();
  Logger.log('✅ Trigger criado: syncPendingLivesToMensageiro roda a cada 1 minuto (Lives)');
  Logger.log('');
  Logger.log('Setup completo. Próximos passos:');
  Logger.log('1. Ver triggers em "Acionadores" (menu lateral, 4º ícone)');
  Logger.log('2. Configurar Script Properties: MENSAGEIRO_WEBHOOK_URL e MENSAGEIRO_WEBHOOK_SECRET');
  Logger.log('3. Rodar testNewsletterFlow() — deve completar em <2s');
  Logger.log('4. Aguardar 1min e ver "ML Sync = ok" no lead de teste');
  Logger.log('5. Rodar testMensageiroWebhook() (exige MENSAGEIRO_TEST_PHONE — dispara msg real)');
}


// ══════════════════════ FUNÇÕES DE TESTE ══════════════════════

function testMailerLiteAuth() {
  var apiKey = PropertiesService.getScriptProperties().getProperty('MAILERLITE_API_KEY');
  if (!apiKey) { Logger.log('❌ MAILERLITE_API_KEY não está em Script Properties.'); return; }
  try {
    var response = UrlFetchApp.fetch('https://connect.mailerlite.com/api/subscribers?limit=1', {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + apiKey, 'Accept': 'application/json' },
      muteHttpExceptions: true
    });
    var code = response.getResponseCode();
    if (code === 200) Logger.log('✅ MailerLite auth OK (HTTP 200).');
    else { Logger.log('❌ HTTP ' + code); Logger.log(response.getContentText().substring(0, 300)); }
  } catch (err) { Logger.log('❌ Erro: ' + err); }
}

function testNewsletterFlow() {
  var fake = { parameter: {
    email: 'teste.newsletter.' + Date.now() + '@example.com',
    origem: 'exit_intent', pagina: '/blog/teste', referrer: 'https://google.com',
    utm_source: 'test', utm_medium: 'script', utm_campaign: 'validation',
    dispositivo: 'Desktop'
  }};
  var result = doPost(fake);
  Logger.log('Newsletter result: ' + result.getContent());
  Logger.log('(Sync com MailerLite acontece via trigger em até 1min)');
}

function testListaFlow() {
  var fake = { parameter: {
    email: 'teste.lista.' + Date.now() + '@example.com',
    nome: 'Teste Automático Lista', telefone_digits: '11999999999',
    origem: 'lista_espera', pagina: '/cursos', dispositivo: 'Desktop'
  }};
  var result = doPost(fake);
  Logger.log('Lista result: ' + result.getContent());
  Logger.log('(Sync com MailerLite acontece via trigger em até 1min)');
}

function testDicionarioFlow() {
  var fake = { parameter: {
    email: 'teste.dicionario.' + Date.now() + '@example.com',
    nome: 'Teste Automático Dicionário', telefone_digits: '11988887777',
    origem: 'dicionario_form_top', pagina: '/', referrer: '',
    utm_source: 'test', utm_medium: 'script', utm_campaign: 'validation_dic',
    dispositivo: 'Mobile'
  }};
  var result = doPost(fake);
  Logger.log('Dicionário result: ' + result.getContent());
  Logger.log('(Sync com MailerLite acontece via trigger em até 1min)');
}

function testLivesFlow() {
  var fake = { parameter: {
    email: 'teste.lives.' + Date.now() + '@example.com',
    nome: 'Teste Automático Lives', telefone_digits: '11977776666',
    origem: 'lives_form_top', pagina: '/lives.html', referrer: 'https://google.com',
    utm_source: 'test', utm_medium: 'script', utm_campaign: 'validation_lives',
    dispositivo: 'Desktop'
  }};
  var result = doPost(fake);
  Logger.log('Lives result: ' + result.getContent());
  Logger.log('(Sync com MailerLite acontece via trigger em até 1min)');
}

/**
 * Dispara 1 mensagem REAL de teste via webhook do Mensageiro — NÃO é dry-run.
 * Exige Script Property MENSAGEIRO_TEST_PHONE (seu próprio número, ex: 11999999999).
 * Sem essa property configurada, recusa rodar (evita mandar pro número errado por engano).
 */
function testMensageiroWebhook() {
  var props = PropertiesService.getScriptProperties();
  var testPhone = props.getProperty('MENSAGEIRO_TEST_PHONE');
  if (!testPhone) {
    Logger.log('⚠️  Defina a Script Property MENSAGEIRO_TEST_PHONE (seu número, ex: 11999999999) antes de rodar.');
    Logger.log('    Este teste DISPARA UMA MENSAGEM REAL de WhatsApp via Mensageiro — não é dry-run.');
    return;
  }
  var payload = {
    evento: 'dicionario_lead',
    nome: 'Teste Automático Apps Script',
    email: 'teste.mensageiro.' + Date.now() + '@example.com',
    telefone: formatPhoneE164BR(testPhone),
    origem: 'dicionario_form_top',
    pagina: '/teste-mensageiro',
    utm_source: 'test', utm_medium: 'script', utm_campaign: 'validation_mensageiro',
    dispositivo: 'Desktop',
    timestamp: new Date().toISOString()
  };
  try {
    var result = pushToMensageiro(payload);
    Logger.log('✅ Webhook Mensageiro respondeu OK: ' + JSON.stringify(result).substring(0, 300));
    Logger.log('   Confira no WhatsApp de ' + testPhone + ' se a conversa/fluxo iniciou.');
  } catch (err) {
    Logger.log('❌ Erro: ' + err);
  }
}

/**
 * Roda os 4 fluxos + 2 fallbacks em sequência (11 cases). Cada submit deve cair na aba esperada.
 * Use depois de qualquer mudança em routeByOrigin.
 */
function testRegressionAll() {
  var t = Date.now();
  var cases = [
    { label: 'Newsletter (exit_intent)',       params: { email: 'rt.news.' + t + '@example.com',   origem: 'exit_intent',         dispositivo: 'Desktop' }, esperado: 'Newsletter' },
    { label: 'Newsletter (sticky_bar)',        params: { email: 'rt.sticky.' + t + '@example.com', origem: 'sticky_bar',          dispositivo: 'Mobile'  }, esperado: 'Newsletter' },
    { label: 'Newsletter (blog_newsletter)',   params: { email: 'rt.bn.' + t + '@example.com',     origem: 'blog_newsletter',     dispositivo: 'Desktop' }, esperado: 'Newsletter' },
    { label: 'Lista (blog_inline_cta)',        params: { email: 'rt.bi.' + t + '@example.com',     nome: 'X', telefone_digits: '11900000000', origem: 'blog_inline_cta',   dispositivo: 'Desktop' }, esperado: 'Lista de Espera' },
    { label: 'Lista (site_lista_espera)',      params: { email: 'rt.sle.' + t + '@example.com',    nome: 'Y', telefone_digits: '11900000000', origem: 'site_lista_espera', dispositivo: 'Mobile'  }, esperado: 'Lista de Espera' },
    { label: 'Dicionário (form_top)',          params: { email: 'rt.dic.' + t + '@example.com',    nome: 'Z', telefone_digits: '11900000000', origem: 'dicionario_form_top',  dispositivo: 'Desktop' }, esperado: 'Lead Magnet - Dicionário' },
    { label: 'Dicionário (sticky_bar)',        params: { email: 'rt.dicst.' + t + '@example.com',  origem: 'dicionario_sticky_bar', dispositivo: 'Mobile' }, esperado: 'Lead Magnet - Dicionário' },
    { label: 'Lives (form_top)',               params: { email: 'rt.liv1.' + t + '@example.com',   nome: 'A', telefone_digits: '11900000000', origem: 'lives_form_top',    dispositivo: 'Desktop' }, esperado: 'Lives' },
    { label: 'Lives (form_bottom)',            params: { email: 'rt.liv2.' + t + '@example.com',   nome: 'B', telefone_digits: '11900000000', origem: 'lives_form_bottom', dispositivo: 'Mobile'  }, esperado: 'Lives' },
    { label: 'Bolsão (bolsao_lp)',             params: { email: 'rt.bol.' + t + '@example.com',    nome: 'W', telefone_digits: '11900000000', origem: 'bolsao_lp',         dispositivo: 'Mobile'  }, esperado: 'Bolsão' },
    { label: 'Fallback com nome (sem origem)', params: { email: 'rt.fbn.' + t + '@example.com',    nome: 'Q', telefone_digits: '11900000000', dispositivo: 'Desktop' }, esperado: 'Lista de Espera' },
    { label: 'Fallback sem nome (sem origem)', params: { email: 'rt.fbe.' + t + '@example.com',    dispositivo: 'Desktop' }, esperado: 'Newsletter' }
  ];
  var falhas = 0;
  cases.forEach(function(c) {
    try {
      var r = JSON.parse(doPost({ parameter: c.params }).getContent());
      var ok = r.ok && r.aba === c.esperado;
      Logger.log((ok ? '✅' : '❌') + ' ' + c.label + ' → ' + (r.aba || r.error) + (ok ? '' : ' (esperado: ' + c.esperado + ')'));
      if (!ok) falhas++;
    } catch (err) {
      Logger.log('❌ ' + c.label + ' → exception: ' + err);
      falhas++;
    }
  });
  Logger.log('');
  Logger.log(falhas === 0 ? '✅ TODOS os caminhos OK (' + cases.length + '/' + cases.length + ')' : '❌ FALHAS: ' + falhas + '/' + cases.length);
  Logger.log('⚠️  Limpe as ' + cases.length + ' linhas de teste das abas após verificação.');
}


// ══════════════════════ DASHBOARD ══════════════════════

/**
 * Cria/recria a aba Dashboard com métricas agregadas das 4 abas
 * (Newsletter, Lista de Espera, Lead Magnet - Dicionário, Lives).
 * Dashboard antiga é renomeada para Dashboard_old_<timestamp> (preservada).
 *
 * Rodar 1× depois de qualquer mudança estrutural (nova aba, nova origem).
 * As fórmulas são auto-atualizáveis — não precisa rodar de novo a cada submit.
 */
function setupDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var existing = ss.getSheetByName('Dashboard');
  if (existing) {
    var stamp = Utilities.formatDate(new Date(), 'America/Sao_Paulo', 'yyyy-MM-dd-HHmm');
    existing.setName('Dashboard_old_' + stamp);
    Logger.log('📦 Dashboard antiga renomeada para Dashboard_old_' + stamp);
  }

  // setFormula() não converte vírgulas p/ ponto-e-vírgula de forma confiável
  // em pt-BR quando há strings entre aspas. Detectar locale e ajustar.
  var locale = (ss.getSpreadsheetLocale() || 'pt_BR').toLowerCase();
  var SEP = locale.indexOf('pt') === 0 ? ';' : ',';

  var dash = ss.insertSheet('Dashboard', 0);

  var REFS = [
    { name: 'Newsletter',                label: 'Newsletter',               dataCol: 'A', emailCol: 'B', origemCol: 'C', dispCol: 'J', utmSrcCol: 'G', referrerCol: 'F' },
    { name: 'Lista de Espera',           label: 'Lista de Espera',          dataCol: 'A', emailCol: 'C', origemCol: 'E', dispCol: 'L', utmSrcCol: 'I', referrerCol: 'H' },
    { name: 'Lead Magnet - Dicionário',  label: 'Lead Magnet — Dicionário', dataCol: 'A', emailCol: 'C', origemCol: 'E', dispCol: 'K', utmSrcCol: 'H', referrerCol: 'G' },
    { name: 'Lives',                     label: 'Lives',                    dataCol: 'A', emailCol: 'C', origemCol: 'E', dispCol: 'L', utmSrcCol: 'I', referrerCol: 'H' },
    { name: 'Bolsão',                    label: 'Bolsão 28/06',             dataCol: 'A', emailCol: 'C', origemCol: 'E', dispCol: 'L', utmSrcCol: 'I', referrerCol: 'H' }
  ];

  var GOLD  = '#C8A84B';
  var NAVY  = '#1B2A4A';
  var WHITE = '#FFFFFF';
  var CREAM = '#FBF6E9';

  function sectionHeader(row, title) {
    dash.getRange(row, 1, 1, 2).merge()
      .setValue(title).setFontWeight('bold').setFontColor(NAVY)
      .setBackground(GOLD).setHorizontalAlignment('center');
  }
  function totalRow(row) {
    dash.getRange(row, 1, 1, 2).setBackground(CREAM).setFontWeight('bold');
  }

  // HEADER
  dash.getRange('A1:B1').merge()
    .setValue('LEADS — FLUÊNCIA CONTÁBIL')
    .setFontSize(18).setFontWeight('bold')
    .setBackground(NAVY).setFontColor(WHITE)
    .setHorizontalAlignment('center').setVerticalAlignment('middle');
  dash.setRowHeight(1, 36);
  dash.getRange('A2:B2').merge()
    .setValue('Dashboard em tempo real — atualiza sozinho a cada nova inscrição')
    .setFontStyle('italic').setFontSize(10)
    .setHorizontalAlignment('center').setFontColor('#888888');

  var row = 4;

  // TOTAIS
  sectionHeader(row, 'TOTAIS'); row++;
  REFS.forEach(function(s) {
    dash.getRange(row, 1).setValue(s.label);
    dash.getRange(row, 2).setFormula(
      "=IFERROR(COUNTIF('" + s.name + "'!" + s.emailCol + "2:" + s.emailCol + SEP + " \"?*@?*.?*\")" + SEP + " 0)"
    );
    row++;
  });
  dash.getRange(row, 1).setValue('TOTAL');
  dash.getRange(row, 2).setFormula('=SUM(B' + (row - REFS.length) + ':B' + (row - 1) + ')');
  totalRow(row);
  row += 2;

  // HOJE
  sectionHeader(row, 'HOJE'); row++;
  REFS.forEach(function(s) {
    dash.getRange(row, 1).setValue(s.label);
    dash.getRange(row, 2).setFormula(
      "=IFERROR(COUNTIFS('" + s.name + "'!" + s.dataCol + "2:" + s.dataCol + SEP + " \">=\"&TODAY()" + SEP +
      " '" + s.name + "'!" + s.dataCol + "2:" + s.dataCol + SEP + " \"<\"&TODAY()+1)" + SEP + " 0)"
    );
    row++;
  });
  dash.getRange(row, 1).setValue('TOTAL');
  dash.getRange(row, 2).setFormula('=SUM(B' + (row - REFS.length) + ':B' + (row - 1) + ')');
  totalRow(row);
  row += 2;

  // ÚLTIMOS 7 DIAS
  sectionHeader(row, 'ÚLTIMOS 7 DIAS'); row++;
  REFS.forEach(function(s) {
    dash.getRange(row, 1).setValue(s.label);
    dash.getRange(row, 2).setFormula(
      "=IFERROR(COUNTIFS('" + s.name + "'!" + s.dataCol + "2:" + s.dataCol + SEP + " \">=\"&TODAY()-7" + SEP +
      " '" + s.name + "'!" + s.dataCol + "2:" + s.dataCol + SEP + " \"<\"&TODAY()+1)" + SEP + " 0)"
    );
    row++;
  });
  dash.getRange(row, 1).setValue('TOTAL');
  dash.getRange(row, 2).setFormula('=SUM(B' + (row - REFS.length) + ':B' + (row - 1) + ')');
  totalRow(row);
  row += 2;

  // POR ORIGEM (4 blocos)
  var origensPorAba = [
    { titulo: 'POR ORIGEM — NEWSLETTER',             sheet: 'Newsletter',               origemCol: 'C', origens: ['exit_intent', 'sticky_bar', 'blog_newsletter', 'newsletter'] },
    { titulo: 'POR ORIGEM — LISTA DE ESPERA',        sheet: 'Lista de Espera',          origemCol: 'E', origens: ['blog_inline_cta', 'lista_espera', 'site_lista_espera'] },
    { titulo: 'POR ORIGEM — LEAD MAGNET DICIONÁRIO', sheet: 'Lead Magnet - Dicionário', origemCol: 'E', origens: ['dicionario_form_top', 'dicionario_form_bottom', 'dicionario_exit_intent', 'dicionario_sticky_bar'] },
    { titulo: 'POR ORIGEM — LIVES',                  sheet: 'Lives',                    origemCol: 'E', origens: ['lives_form_top', 'lives_form_bottom'] },
    { titulo: 'POR ORIGEM — BOLSÃO',                 sheet: 'Bolsão',                   origemCol: 'E', origens: ['bolsao_lp'] }
  ];
  origensPorAba.forEach(function(o) {
    sectionHeader(row, o.titulo); row++;
    o.origens.forEach(function(orig) {
      dash.getRange(row, 1).setValue(orig);
      dash.getRange(row, 2).setFormula("=COUNTIF('" + o.sheet + "'!" + o.origemCol + ":" + o.origemCol + SEP + " \"" + orig + "\")");
      row++;
    });
    row++;
  });

  // POR DISPOSITIVO (consolidado)
  sectionHeader(row, 'POR DISPOSITIVO (todas as abas)'); row++;
  ['Mobile', 'Desktop'].forEach(function(d) {
    dash.getRange(row, 1).setValue(d);
    var formula = '=' + REFS.map(function(s) {
      return "COUNTIF('" + s.name + "'!" + s.dispCol + ":" + s.dispCol + SEP + " \"" + d + "\")";
    }).join('+');
    dash.getRange(row, 2).setFormula(formula);
    row++;
  });
  row++;

  // TOP UTM SOURCES (top 5, consolidado)
  sectionHeader(row, 'TOP UTM SOURCES (top 5)'); row++;
  dash.getRange(row, 1).setValue('UTM Source').setFontWeight('bold');
  dash.getRange(row, 2).setValue('Leads').setFontWeight('bold');
  row++;
  var utmFormula = "=IFERROR(QUERY({" +
    REFS.map(function(s) { return "'" + s.name + "'!" + s.utmSrcCol + "2:" + s.utmSrcCol; }).join(';') +
    "}" + SEP + " \"select Col1, count(Col1) where Col1 is not null and Col1 <> '' group by Col1 order by count(Col1) desc limit 5\"" + SEP + " 0)" + SEP + " \"sem dados\")";
  dash.getRange(row, 1).setFormula(utmFormula);
  row += 6;

  // TOP REFERRERS (top 5, consolidado)
  sectionHeader(row, 'TOP REFERRERS (top 5)'); row++;
  dash.getRange(row, 1).setValue('Referrer').setFontWeight('bold');
  dash.getRange(row, 2).setValue('Leads').setFontWeight('bold');
  row++;
  var refFormula = "=IFERROR(QUERY({" +
    REFS.map(function(s) { return "'" + s.name + "'!" + s.referrerCol + "2:" + s.referrerCol; }).join(';') +
    "}" + SEP + " \"select Col1, count(Col1) where Col1 is not null and Col1 <> '' group by Col1 order by count(Col1) desc limit 5\"" + SEP + " 0)" + SEP + " \"sem dados\")";
  dash.getRange(row, 1).setFormula(refFormula);
  row += 6;

  // GLOSSÁRIO
  sectionHeader(row, 'GLOSSÁRIO — O QUE CADA COISA SIGNIFICA'); row++;
  var glossario = [
    ['Aba Newsletter', 'Leads que querem APENAS conteúdo gratuito (artigos por e-mail). Baixo compromisso.'],
    ['Aba Lista de Espera', 'Leads com intenção de COMPRA — querem garantir vaga no curso. Alto compromisso. Prioridade para contato.'],
    ['Aba Lead Magnet — Dicionário', 'Leads que baixaram o Dicionário Contábil em PDF (LP dicionario.fluenciacontabil.com.br). Compromisso médio.'],
    ['Aba Lives', 'Leads inscritos para as 4 lives gratuitas de pré-lançamento (LP lives.html). Compromisso médio-alto.'],
    ['Aba Bolsão', 'Inscritos no Bolsão da Fluência (prova 28/06, 5 bolsas de 1 ano). Campanha Meta a partir de 13/06. A variante da LP (Copa) é distinguível pela coluna Página.'],
    ['exit_intent', 'Modal "Antes de ir" — aparece no desktop quando o visitante move o mouse pra fora da aba, e no mobile quando ele termina de ler o post (>70% scroll + 4s parado).'],
    ['sticky_bar', 'Barra azul escura fixa no rodapé de todas as páginas. Aparece após 50% de scroll ou 45 segundos de permanência.'],
    ['blog_newsletter', 'Formulário simples "Receba novos artigos" no rodapé dos posts do blog.'],
    ['blog_inline_cta', 'Caixa azul escura no MEIO dos posts do blog. Só pede e-mail — alta conversão.'],
    ['lista_espera', 'Form grande da página /cursos com nome + e-mail + WhatsApp. Lead mais qualificado (tem telefone e nome).'],
    ['site_lista_espera', 'Variante da Lista de Espera capturada em outras páginas do site (não /cursos).'],
    ['dicionario_form_top', 'Form principal no topo da LP do dicionário (nome + e-mail + WhatsApp).'],
    ['dicionario_form_bottom', 'Form final no rodapé da LP do dicionário (nome + e-mail + WhatsApp).'],
    ['dicionario_exit_intent', 'Modal exit-intent na LP do dicionário (só e-mail).'],
    ['dicionario_sticky_bar', 'Sticky bar na LP do dicionário (só e-mail).'],
    ['lives_form_top', 'Form principal no topo da LP de Lives (nome + e-mail + WhatsApp).'],
    ['lives_form_bottom', 'Form final no rodapé da LP de Lives (nome + e-mail + WhatsApp).'],
    ['Ref (código de indicação)', 'Quando alguém se inscreve, gera um link único tipo fluenciacontabil.com.br/?ref=abc12345. Se um amigo chegar por esse link e se inscrever, "abc12345" aparece na coluna Ref dele — você sabe quem o trouxe.'],
    ['Origem (coluna)', 'De qual widget específico o lead veio. Permite saber qual ponto de captura converte mais.'],
    ['UTM Source/Medium/Campaign', 'Parâmetros de marketing na URL. Ex: ?utm_source=instagram&utm_medium=bio&utm_campaign=lancamento.'],
    ['Dispositivo', 'Mobile (celular, tela ≤720px) ou Desktop. Ajuda a dimensionar onde investir em UX/ads.'],
    ['ML Sync', 'Status sync MailerLite: vazio=pendente, ok=enviado, err:...=falhou, migrated=lead anterior à arquitetura assíncrona.'],
    ['Atualização automática', 'Este dashboard recalcula sozinho a cada nova inscrição. Não precisa apertar nada — é só atualizar a página (F5) se quiser forçar.']
  ];
  glossario.forEach(function(g) {
    dash.getRange(row, 1).setValue(g[0]).setFontWeight('bold');
    dash.getRange(row, 2).setValue(g[1]).setWrap(true);
    row++;
  });

  dash.setColumnWidth(1, 320);
  dash.setColumnWidth(2, 600);
  dash.setFrozenRows(2);

  Logger.log('✅ Dashboard recriada — ' + (row - 1) + ' linhas geradas');
  Logger.log('   Locale: ' + locale + ' | Separador de argumentos: ' + SEP);
  Logger.log('   Cobre: Newsletter, Lista, Dicionário, Lives');
  Logger.log('   Antiga preservada como Dashboard_old_*');
}

/** Envia somente os leads da LP de Lives para o webhook específico das Lives. */
function pushToMensageiroLives_(payload) {
  var props = PropertiesService.getScriptProperties();
  var url = props.getProperty('MENSAGEIRO_LIVES_WEBHOOK_URL');
  var secret = props.getProperty('MENSAGEIRO_LIVES_WEBHOOK_SECRET');

  if (!url || !secret) {
    throw new Error('MENSAGEIRO_LIVES_WEBHOOK_URL / MENSAGEIRO_LIVES_WEBHOOK_SECRET não configuradas em Script Properties');
  }

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { 'X-Mensageiro-Webhook-Secret': secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var code = response.getResponseCode();
  if (code < 200 || code >= 300) {
    throw new Error('Mensageiro Lives HTTP ' + code + ': ' + response.getContentText().substring(0, 300));
  }
  var responseText = response.getContentText();
  try { return JSON.parse(responseText); } catch (_) { return { raw: responseText }; }
}

/** Teste direto do webhook exclusivo das Lives. Dispara uma mensagem real. */
function testMensageiroLivesWebhook() {
  var props = PropertiesService.getScriptProperties();
  var testPhone = props.getProperty('MENSAGEIRO_TEST_PHONE');
  if (!testPhone) {
    Logger.log('Defina MENSAGEIRO_TEST_PHONE antes de rodar este teste.');
    return;
  }

  var now = Date.now();
  var payload = {
    evento: 'lives_lead_teste',
    nome: 'Teste Lives Apps Script',
    email: 'teste.lives.' + now + '@example.com',
    telefone: formatPhoneE164BR(testPhone),
    customer: {
      name: 'Teste Lives Apps Script',
      email: 'teste.lives.' + now + '@example.com',
      phone: formatPhoneE164BR(testPhone)
    },
    origem: 'teste_apps_script_lives',
    pagina: '/lives',
    timestamp: new Date().toISOString()
  };

  try {
    var result = pushToMensageiroLives_(payload);
    Logger.log('Webhook Lives HTTP OK: ' + JSON.stringify(result).substring(0, 500));
    Logger.log('Confira o WhatsApp de ' + testPhone + '.');
  } catch (err) {
    Logger.log('Erro no webhook Lives: ' + err);
  }
}
