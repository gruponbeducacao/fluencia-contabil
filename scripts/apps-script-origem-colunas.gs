/** Rastreamento com appendCells; o lock serve somente para preparar colunas. */
function leadTrackingRow_(sheet, headers, row, p) {
  var fields = [['Src', 'src'], ['UTM Content', 'utm_content'], ['UTM Term', 'utm_term']];
  var normalize = function(h) {
    return String(h).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  var layout = function(meta) {
    var labels = [], missing = [];
    fields.forEach(function(field) {
      var key = normalize(field[0]);
      if (headers.some(function(h) { return normalize(h) === key; })) throw new Error('TRACKING_SCHEMA_INCOMPATIVEL');
      var matches = meta.headers.filter(function(h) { return normalize(h) === key; });
      if (matches.length > 1) throw new Error('TRACKING_CABECALHO_AMBIGUO');
      labels.push(matches[0] || field[0]);
      if (!matches.length) missing.push(field[0]);
    });
    return { labels: labels, missing: missing };
  };
  // O caminho normal não disputa o lock mantido pelos trabalhadores de envios.
  var meta = leadHeaders_(sheet, headers, true), columns = layout(meta);
  if (columns.missing.length) {
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      // Outra captura pode ter criado as colunas enquanto aguardávamos.
      meta = leadHeaders_(sheet, headers, true);
      columns = layout(meta);
      if (columns.missing.length) {
        if (meta.width + columns.missing.length > 200) throw new Error('TRACKING_GRADE_FORA_LIMITE');
        Sheets.Spreadsheets.batchUpdate({ requests: [
          { appendDimension: { sheetId: meta.sheetId, dimension: 'COLUMNS', length: columns.missing.length } },
          { updateCells: {
            start: { sheetId: meta.sheetId, rowIndex: 0, columnIndex: meta.width },
            rows: [{ values: columns.missing.map(function(h) { return { userEnteredValue: { stringValue: h } }; }) }],
            fields: 'userEnteredValue'
          } }
        ] }, meta.spreadsheetId);
        // A API é a fonte da largura; SpreadsheetApp pode estar em cache.
        meta = leadHeaders_(sheet, headers.concat(columns.labels), true);
      }
    } finally {
      lock.releaseLock();
    }
  }
  return {
    meta: meta,
    headers: headers.concat(columns.labels),
    row: row.concat(fields.map(function(field) {
      // stringValue mantém IDs exatos e valores com aparência de fórmula literais.
      return p && typeof p[field[1]] === 'string' ? p[field[1]].trim() : '';
    }))
  };
}

function schemasOrigemTracking_() {
  return [
    ['NEWSLETTER', SHEETS.NEWSLETTER, NEWSLETTER_HEADERS],
    ['LISTA', SHEETS.LISTA, LISTA_HEADERS],
    ['DICIONARIO', SHEETS.DICIONARIO, DICIONARIO_HEADERS],
    ['BOLSAO', SHEETS.BOLSAO, BOLSAO_HEADERS],
    ['LIVES', SHEETS.LIVES, LIVES_HEADERS],
    ['AULAS', SHEETS.AULAS, AULAS_HEADERS]
  ];
}

/** Só lê cabeçalhos; não lê contatos nem aciona integrações. */
function diagnosticarOrigemTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = schemasOrigemTracking_().map(function(s) {
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

/** Prepara apenas cabeçalhos, antes da publicação; nunca acrescenta contatos. */
function prepararColunasOrigemTracking() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var result = schemasOrigemTracking_().map(function(s) {
    var prepared = leadTrackingRow_(ss.getSheetByName(s[1]), s[2], s[2].map(function() { return ''; }), {});
    return { aba: s[0], colunas: prepared.meta.width };
  });
  console.log(JSON.stringify({ revisao: 'origem-v1-20260917', somenteCabecalhos: true, abas: result }));
  return result;
}
