// Patch do escritor ativo v18: substituir funções homônimas, sem duplicá-las.
// Demais arquivos, filas e parâmetros de execução ficam preservados.

function handleNewsletter(p) {
  appendLeadByHeader_(SHEETS.NEWSLETTER, NEWSLETTER_HEADERS, [
    new Date(), p.email,
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', ''  // ML Sync, ML Sync At
  ], p);
  return jsonResponse({ ok: true, aba: SHEETS.NEWSLETTER });
}

function handleLista(p) {
  appendLeadByHeader_(SHEETS.LISTA, LISTA_HEADERS, [
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', ''
  ], p);
  return jsonResponse({ ok: true, aba: SHEETS.LISTA });
}

function handleDicionario(p) {
  appendLeadByHeader_(SHEETS.DICIONARIO, DICIONARIO_HEADERS, [
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', '', FC_CAPTURA_WPP_PENDENTE, ''
  ], p);
  return jsonResponse({ ok: true, aba: SHEETS.DICIONARIO });
}

function handleBolsao(p) {
  // Aba pós-MailerLite: sem colunas ML Sync (SES/Seq/CRM são adicionadas pelo setupBolsao do ses_mailer.gs)
  appendLeadByHeader_(SHEETS.BOLSAO, BOLSAO_HEADERS, [
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || '')
  ], p);
  return jsonResponse({ ok: true, aba: SHEETS.BOLSAO });
}

function handleLives(p) {
  appendLeadByHeader_(SHEETS.LIVES, LIVES_HEADERS, [
    new Date(), String(p.nome || '').trim(), p.email,
    normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || ''),
    String(p.origem || ''), String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    '', '', FC_CAPTURA_WPP_PENDENTE, ''
  ], p);
  return jsonResponse({ ok: true, aba: SHEETS.LIVES });
}

function handleAulaAoVivo(p) {
  var origem = String(p.origem || '').trim().toLowerCase();

  // `lives_form_sefaz_sc` é aceito por compatibilidade com peça antiga.
  var cfg = aulasCfgPorOrigem_(origem)
         || (origem === 'lives_form_sefaz_sc' ? aulasCfgPorOrigem_('aula_sefaz_sc') : null);

  // Origem `aula_*` desconhecida NÃO vira lead órfão: registra o erro e usa um
  // rótulo explícito, para aparecer na planilha em vez de sumir.
  if (!cfg) {
    logError('Aula ao vivo: origem não configurada', { parameter: {} });
    cfg = { campanha: 'DESCONHECIDA (' + origem + ')', topico: 'aula-outras' };
  }

  var email = String(p.email || '').trim().toLowerCase();
  var nome = String(p.nome || '').trim();
  var telefone = normalizePhone(p.telefone_digits || p.telefone || p.whatsapp || '');
  var now = new Date();

  appendLeadByHeader_(SHEETS.AULAS, AULAS_HEADERS, [
    now, cfg.campanha, nome, email, telefone,
    origem, String(p.ref || ''),
    String(p.pagina || ''), String(p.referrer || ''),
    String(p.utm_source || ''), String(p.utm_medium || ''), String(p.utm_campaign || ''),
    String(p.dispositivo || ''),
    'off', '',     // CRM Sync: desligado até o template do Mensageiro existir
    '', ''         // SES Sync: pendente para o trabalhador de contatos
  ], p);

  return jsonResponse({ ok: true, aba: SHEETS.AULAS, campanha: cfg.campanha });
}

function appendLeadByHeader_(name, headers, row, tracking) {
  if (headers.length !== row.length) throw new Error('CAPTURA_LINHA_INVALIDA');
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sheet = ss.getSheetByName(name);
  var enriched = tracking ? leadTrackingRow_(sheet, headers, row, tracking) : null;
  if (enriched) { headers = enriched.headers; row = enriched.row; }
  var meta = enriched ? enriched.meta : leadHeaders_(sheet, headers), tz = ss.getSpreadsheetTimeZone();
  var cells = new Array(meta.width).fill(null).map(function() { return {}; });
  headers.forEach(function(h, i) {
    var v = row[i], cell;
    if (v instanceof Date) {
      if (isNaN(v.getTime())) throw new Error('CAPTURA_DATA_INVALIDA');
      // Datas Sheets são seriais na hora local da planilha. Mantém getValues() como Date.
      var local = Utilities.formatDate(v, tz, "yyyy-MM-dd'T'HH:mm:ss.SSS");
      cell = { userEnteredValue: { numberValue: Date.parse(local + 'Z') / 86400000 + 25569 },
        userEnteredFormat: { numberFormat: { type: 'DATE_TIME', pattern: 'dd/mm/yyyy hh:mm:ss' } } };
    } else cell = { userEnteredValue: { stringValue: String(v == null ? '' : v) } };
    cells[meta.cols[h] - 1] = cell;
  });
  Sheets.Spreadsheets.batchUpdate({ requests: [{ appendCells: { sheetId: meta.sheetId,
    rows: [{ values: cells }], fields: 'userEnteredValue,userEnteredFormat.numberFormat' } }] }, meta.spreadsheetId);
}

function doGet(e) {
  return ContentService.createTextOutput('Endpoint unificado · LEADS Fluência Contábil · [' +
    FC_CAPTURA_REVISAO + '] · origem-v1-20260917 · ' + new Date().toISOString()).setMimeType(ContentService.MimeType.TEXT);
}
