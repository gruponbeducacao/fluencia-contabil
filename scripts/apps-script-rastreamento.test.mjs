import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const source = readFileSync(new URL('./apps_script_unified.gs', import.meta.url), 'utf8');
function harness(kind = 'NEWSLETTER', extra = ['SES Sync', 'SES Sync At', 'Seq Passo', 'CRM Sync']) {
  let locked = false, released = 0, flushes = 0;
  const formats = new Map();
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({ waitLock() { assert.equal(locked, false); locked = true; }, releaseLock() { locked = false; released++; } }) },
    SpreadsheetApp: { flush() { assert.equal(locked, true); flushes++; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ setMimeType: () => JSON.parse(s) }) },
  });
  vm.runInContext(source, context);
  const base = Array.from(vm.runInContext(kind + '_HEADERS', context));
  const headers = [...base, ...extra.filter(h => !base.includes(h))];
  const rows = [headers, headers.map((_, i) => 'historico-' + i)];
  let maxColumns = headers.length, maxRows = 2;
  const sheet = {
    getLastColumn: () => rows[0].length, getLastRow: () => rows.length,
    getMaxColumns: () => maxColumns, getMaxRows: () => maxRows,
    insertColumnsAfter(at, count) { assert.equal(locked, true); assert.equal(at, maxColumns); maxColumns += count; },
    insertRowsAfter(at, count) { assert.equal(locked, true); assert.equal(at, maxRows); maxRows += count; },
    getRange(row, col, height = 1, width = 1) {
      const range = {
        getValues: () => Array.from({ length: height }, (_, y) => Array.from({ length: width }, (_, x) => rows[row - 1 + y]?.[col - 1 + x] ?? '')),
        setValues(values) {
          assert.equal(locked, true);
          for (let y = 0; y < height; y++) {
            rows[row - 1 + y] ??= [];
            for (let x = 0; x < width; x++) {
              const label = rows[0][col - 1 + x];
              if (row > 1 && ['Src','UTM Content','UTM Term'].includes(label)) {
                assert.equal(formats.get(`${row + y}:${col + x}`), '@', 'texto antes de gravar');
              }
              rows[row - 1 + y][col - 1 + x] = values[y][x];
            }
          }
          return range;
        },
        setNumberFormat(format) { formats.set(`${row}:${col}`, format); return range; },
        setFontWeight() { return range; }, setBackground() { return range; }, setFontColor() { return range; },
      };
      return range;
    },
  };
  context.ensureSheet = () => sheet;
  const dispatched = [];
  context.dispatchLiveLeadImmediately_ = (_p, _s, row) => dispatched.push(row);
  return { context, rows, sheet, base, dispatched, state: () => ({ locked, released, flushes }) };
}
const sample = { email: 'ensaio@example.invalid', nome: 'Ensaio', origem: 'newsletter', telefone: '',
  utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'campanha-sintetica',
  src: 'meta', utm_content: 'criativo-a', utm_term: '120999999999999999' };
const read = (h, row, key) => h.rows[row][h.rows[0].indexOf(key)];
for (const [kind, handler] of [['NEWSLETTER','Newsletter'], ['LISTA','Lista'], ['DICIONARIO','Dicionario'], ['BOLSAO','Bolsao'], ['LIVES','Lives']]) {
  test(kind + ': preserva cabeçalhos, histórico e ID exato na captura', () => {
    const h = harness(kind), before = structuredClone(h.rows), headerCount = h.rows[0].length;
    h.context['handle' + handler]({ ...sample });
    assert.deepEqual(h.rows[0].slice(0, headerCount), before[0]);
    assert.deepEqual(h.rows[1], before[1]);
    assert.equal(read(h, 2, 'UTM Term'), sample.utm_term);
    assert.equal(read(h, 2, 'UTM Content'), 'criativo-a');
    assert.equal(read(h, 2, 'Src'), 'meta');
    assert.equal(read(h, 2, 'UTM Campaign'), 'campanha-sintetica');
    assert.equal(read(h, 2, 'SES Sync'), '');
    assert.equal(read(h, 2, 'CRM Sync'), '');
    assert.deepEqual(h.state(), { locked: false, released: 1, flushes: 1 });
    if (kind === 'LIVES') assert.deepEqual(h.dispatched, [3]);
    h.context['handle' + handler]({ ...sample, utm_term: '' });
    assert.equal(h.rows[0].length, headerCount + 3);
    assert.equal(read(h, 3, 'UTM Term'), '');
    assert.equal(h.rows.length, 4);
  });
}
test('formulário antigo não herda parâmetros da linha anterior', () => {
  const h = harness();
  h.context.handleNewsletter(sample);
  h.context.handleNewsletter({ email: 'outro@example.invalid', origem: 'newsletter' });
  for (const key of ['UTM Term', 'UTM Content', 'Src']) assert.equal(read(h, 3, key), '');
});
test('colunas novas em outra posição são encontradas por nome', () => {
  const h = harness('NEWSLETTER', ['UTM Term','SES Sync','Src','UTM Content']);
  const count = h.rows[0].length;
  h.context.handleNewsletter(sample);
  assert.equal(h.rows[0].length, count);
  assert.equal(read(h, 2, 'UTM Term'), sample.utm_term);
  assert.equal(read(h, 2, 'SES Sync'), '');
});
test('fórmula externa é gravada como texto e número impreciso não vira ID', () => {
  const h = harness();
  h.context.handleNewsletter({ ...sample, src: '=1+1', utm_content: '@formula', utm_term: 120999999999999999 });
  assert.equal(read(h, 2, 'Src'), "'=1+1");
  assert.equal(read(h, 2, 'UTM Content'), "'@formula");
  assert.equal(read(h, 2, 'UTM Term'), '');
});
test('cabeçalho duplicado recusa captura ambígua e libera o trinco', () => {
  const h = harness('NEWSLETTER', ['UTM Term','utm_term']);
  assert.throws(() => h.context.handleNewsletter(sample), /ambíguo/);
  assert.equal(h.rows.length, 2);
  assert.deepEqual(h.state(), { locked: false, released: 1, flushes: 0 });
});
