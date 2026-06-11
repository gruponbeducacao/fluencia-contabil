/**
 * ═══════════════════════════════════════════════════════════════════════
 * SYNC PLANILHA → CRM MENSAGEIRO (leads com WhatsApp)
 * ═══════════════════════════════════════════════════════════════════════
 *
 * Arquivo NOVO no mesmo projeto Apps Script da planilha "LEADS Fluência
 * Contábil". Mesmo padrão queue/worker do ML/SES Sync: coluna "CRM Sync"
 * vazia = pendente; trigger 1min processa em batch.
 *
 * Só sincroniza abas com WhatsApp (Lista de Espera, Dicionário, Lives) —
 * o Mensageiro é WhatsApp-first; Newsletter (só email) fica de fora.
 *
 * API (ver _MARKETING/_CRM/api.md):
 *   POST /tenants/:tenantId/leads   { name, email, phone, tags, pipelineId, stageId }
 *   GET  /tenants/:tenantId/leads?search=...   (dedupe por telefone)
 *   GET  /tenants/:tenantId/pipelines          (descobrir IDs de funil/estágio)
 *
 * ─── PRÉ-REQUISITOS (Script Properties) ───────────────────────────────
 *   CRM_API_BASE   = https://<host-da-api-do-mensageiro>   (sem barra final)
 *   CRM_TENANT_ID  = <tenantId da Fluência>
 *   CRM_API_TOKEN  = <JWT com role admin>   ← NUNCA no código
 *
 * ─── ATIVAÇÃO ──────────────────────────────────────────────────────────
 *   1. Preencher as 3 Script Properties
 *   2. crmListPipelines()  — loga funis/estágios pra copiar os IDs
 *   3. Preencher a aba "Config CRM" (criada pelo setup) com os IDs
 *   4. setupCrmSync()      — colunas + trigger 1min
 *   5. testCrmCreateLead() — cria 1 lead de teste e loga a resposta
 * ═══════════════════════════════════════════════════════════════════════
 */

// Abas que sobem pro CRM (Newsletter fica de fora — sem WhatsApp)
const CRM_TABS = ['Lista de Espera', 'Lead Magnet - Dicionário', 'Lives', 'Bolsão'];

const CRM_COLS = ['CRM Sync', 'CRM Sync At'];
const CRM_CONFIG_SHEET = 'Config CRM';
const CRM_BATCH_SIZE = 5;


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
 * Trigger 1 min. Leads com WhatsApp e "CRM Sync" vazio são criados no
 * Mensageiro no funil/estágio configurado na aba "Config CRM".
 */
function syncPendingToCRM() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return;
  try {
    var configs = loadCrmConfig_();
    if (!Object.keys(configs).length) return; // Config CRM ainda sem IDs

    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var processed = 0;

    for (var t = 0; t < CRM_TABS.length && processed < CRM_BATCH_SIZE; t++) {
      var tabName = CRM_TABS[t];
      var cfg = configs[tabName];
      if (!cfg) continue; // aba sem mapeamento → não sobe

      var sheet = ss.getSheetByName(tabName);
      if (!sheet || sheet.getLastRow() < 2) continue;
      var cols = headerIndexes_(sheet);
      if (!cols['CRM Sync']) continue; // setup ainda não rodou

      var lastRow = sheet.getLastRow();
      var syncVals = sheet.getRange(2, cols['CRM Sync'], lastRow - 1, 1).getValues();

      for (var r = 0; r < syncVals.length && processed < CRM_BATCH_SIZE; r++) {
        if (syncVals[r][0] !== '') continue;
        var rowNum = r + 2;
        var row = sheet.getRange(rowNum, 1, 1, sheet.getLastColumn()).getValues()[0];
        var get = function(name) { return cols[name] ? String(row[cols[name] - 1] || '').trim() : ''; };

        var phone = normalizeE164_(get('WhatsApp'));
        if (!phone) {
          // Sem WhatsApp não há lead útil no CRM — marca e segue
          markCell_(sheet, rowNum, cols, 'CRM Sync', 'skip:sem_whatsapp');
          processed++;
          continue;
        }

        try {
          var existing = crmFindLeadByPhone_(phone);
          if (existing) {
            markCell_(sheet, rowNum, cols, 'CRM Sync', 'ok:existia (' + existing + ')');
          } else {
            var leadId = crmCreateLead_({
              name: get('Nome') || get('E-mail'),
              email: get('E-mail').toLowerCase(),
              phone: phone,
              tags: buildCrmTags_(get, cfg),
              pipelineId: cfg.pipelineId,
              stageId: cfg.stageId,
              attributes: {
                origem: get('Origem'), pagina: get('Página'),
                utm_source: get('UTM Source'), utm_medium: get('UTM Medium'),
                utm_campaign: get('UTM Campaign'), ref_in: get('Ref'),
                fonte: 'planilha_leads'
              }
            });
            markCell_(sheet, rowNum, cols, 'CRM Sync', 'ok' + (leadId ? ' (' + leadId + ')' : ''));
          }
        } catch (err) {
          markCell_(sheet, rowNum, cols, 'CRM Sync', 'err:' + String(err).substring(0, 180));
          logError('CRM sync: ' + err, { parameter: { phone: phone, sheet: tabName } });
        }
        processed++;
      }
    }
    if (processed > 0) console.log('CRM sync run: ' + processed + ' leads processados');
  } finally {
    lock.releaseLock();
  }
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

/** 1× — colunas CRM Sync nas 3 abas + aba Config CRM + trigger 1min. Idempotente. */
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
  Logger.log('✅ Colunas CRM Sync / CRM Sync At garantidas em: ' + CRM_TABS.join(', '));

  if (!ss.getSheetByName(CRM_CONFIG_SHEET)) {
    var cfg = ss.insertSheet(CRM_CONFIG_SHEET);
    cfg.getRange(1, 1, 5, 4).setValues([
      ['Aba', 'Pipeline ID', 'Stage ID', 'Tags extras (csv)'],
      ['Lista de Espera',          '', '', 'lista-espera'],
      ['Lead Magnet - Dicionário', '', '', 'dicionario'],
      ['Lives',                    '', '', 'lives'],
      ['Bolsão',                   '', '', 'bolsao']
    ]);
    cfg.getRange(1, 1, 1, 4).setFontWeight('bold').setBackground('#1B2A4A').setFontColor('#FFFFFF');
    cfg.setFrozenRows(1);
    cfg.getRange('F1').setValue('Preencher Pipeline ID / Stage ID com os valores logados por crmListPipelines(). Linha sem IDs = aba não sincroniza (proposital).');
    Logger.log('✅ Aba "Config CRM" criada — preencha os IDs (rode crmListPipelines() pra descobrir)');
  }

  recreateTrigger_('syncPendingToCRM', function(b) { return b.timeBased().everyMinutes(1); });
  Logger.log('✅ Trigger criado: syncPendingToCRM roda a cada 1 minuto (não faz nada até a Config CRM ter IDs)');
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
