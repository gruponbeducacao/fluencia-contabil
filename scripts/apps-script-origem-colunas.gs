/** Acrescenta rastreamento ao escritor ativo que usa appendCells (Sheets API). */
function leadTrackingRow_(sheet, headers, row, p) {
  var fields = [['Src', 'src'], ['UTM Content', 'utm_content'], ['UTM Term', 'utm_term']];
  var normalize = function(h) {
    return String(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // A API é a fonte da largura: SpreadsheetApp pode manter um valor antigo.
    var meta = leadHeaders_(sheet, headers, true);
    var labels = [], missing = [];
    fields.forEach(function(field) {
      var key = normalize(field[0]);
      if (headers.some(function(h) { return normalize(h) === key; })) throw new Error('TRACKING_SCHEMA_INCOMPATIVEL');
      var matches = meta.headers.filter(function(h) { return normalize(h) === key; });
      if (matches.length > 1) throw new Error('TRACKING_CABECALHO_AMBIGUO');
      labels.push(matches[0] || field[0]);
      if (!matches.length) missing.push(field[0]);
    });
    if (missing.length) {
      if (meta.width + missing.length > 200) throw new Error('TRACKING_GRADE_FORA_LIMITE');
      // Depois de toda a grade existente: nenhuma coluna anterior é deslocada.
      Sheets.Spreadsheets.batchUpdate({ requests: [
        { appendDimension: { sheetId: meta.sheetId, dimension: 'COLUMNS', length: missing.length } },
        { updateCells: {
          start: { sheetId: meta.sheetId, rowIndex: 0, columnIndex: meta.width },
          rows: [{ values: missing.map(function(h) { return { userEnteredValue: { stringValue: h } }; }) }],
          fields: 'userEnteredValue'
        } }
      ] }, meta.spreadsheetId);
      meta = leadHeaders_(sheet, headers.concat(labels), true);
    }
    return {
      meta: meta,
      headers: headers.concat(labels),
      row: row.concat(fields.map(function(field) {
        // stringValue no escritor mantém IDs exatos e não executa fórmulas.
        return p && typeof p[field[1]] === 'string' ? p[field[1]].trim() : '';
      }))
    };
  } finally {
    lock.releaseLock();
  }
}

/** Conferência manual sem escrever na planilha nem acionar integrações. */
function diagnosticarOrigemTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var schemas = [
    ['NEWSLETTER', SHEETS.NEWSLETTER, NEWSLETTER_HEADERS],
    ['LISTA', SHEETS.LISTA, LISTA_HEADERS],
    ['DICIONARIO', SHEETS.DICIONARIO, DICIONARIO_HEADERS],
    ['BOLSAO', SHEETS.BOLSAO, BOLSAO_HEADERS],
    ['LIVES', SHEETS.LIVES, LIVES_HEADERS],
    ['AULAS', SHEETS.AULAS, AULAS_HEADERS]
  ];
  var result = schemas.map(function(s) {
    var meta = leadHeaders_(ss.getSheetByName(s[1]), s[2], true);
    var normalize = function(h) { return String(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''); };
    var keys = meta.headers.map(normalize), missing = 0;
    ['src', 'utmcontent', 'utmterm'].forEach(function(k) {
      if (keys.indexOf(k) !== keys.lastIndexOf(k)) throw new Error('TRACKING_CABECALHO_AMBIGUO');
      if (keys.indexOf(k) < 0) missing++;
    });
    return { aba: s[0], colunas: meta.width, faltantes: missing, comporta: meta.width + missing <= 200 };
  });
  console.log(JSON.stringify({ revisao: 'origem-v1-20260917', somenteLeitura: true, abas: result }));
  return result;
}