import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/vsl-overlay.js', import.meta.url), 'utf8');
const ORIGEM = 'https://player-vz-test.tv.pandavideo.com.br';

function run({ hidden = false, id = 'video-test', semOverlay = false } = {}) {
  const listeners = {}, timers = [];
  const enviados = [];
  const frame = { contentWindow: { postMessage: (msg, origem) => enviados.push([msg.type, origem]) },
    getAttribute: k => k === 'src' ? `${ORIGEM}/embed/?v=${id}` : null };
  const slot = { hidden, getAttribute: k => ({ 'data-vsl-duration': '100', 'data-vsl-pitch': '70' })[k] };
  const classes = new Set();
  const tempo = { textContent: '0:00' };
  const attrs = {};
  const ov = { hidden: true, setAttribute: (k, v) => { attrs[k] = v; }, querySelector: () => tempo,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c) } };
  const window = { location: { href: 'https://fluenciacontabil.com.br/assinatura.html' },
    addEventListener: (name, fn) => { listeners[name] = fn; } };
  const document = { activeElement: null,
    getElementById: k => ({ heroVsl: slot, heroVslFrame: frame, heroVslOverlay: semOverlay ? null : ov })[k] };
  const context = vm.createContext({ window, document, URL, Number, Math,
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
    clearTimeout: n => { if (timers[n - 1]) timers[n - 1].fn = null; } });
  vm.runInContext(source, context);
  const flush = () => { while (timers.length) { const t = timers.shift(); t.fn && t.fn(); } };
  const send = (message, currentTime, extra = {}, confiavel = true) => listeners.message?.({
    source: confiavel ? frame.contentWindow : {}, origin: ORIGEM, data: { message, currentTime, ...extra } });
  return { ov, attrs, classes, tempo, send, flush, listeners, document, frame, enviados, estado: () => ov.hidden ? 'oculto' : attrs['data-estado'] };
}

test('nasce convidando ao play e some quando o player toca', () => {
  const r = run();
  assert.equal(r.estado(), 'inicio');
  r.send('panda_play', 0); r.flush();
  assert.equal(r.estado(), 'oculto');
});

test('pausa mostra onde parou; depois do pitch o atalho vira botão', () => {
  const r = run();
  r.send('panda_play', 0); r.send('panda_pause', 42.7); r.flush();
  assert.equal(r.estado(), 'pausa'); assert.equal(r.tempo.textContent, '0:42');
  assert.ok(!r.classes.has('vsl-ov-oferta'));
  r.send('panda_play', 42.7); r.flush(); assert.equal(r.estado(), 'oculto');
  r.send('panda_pause', 75); r.flush();
  assert.equal(r.estado(), 'pausa'); assert.ok(r.classes.has('vsl-ov-oferta'));
});

test('fim do vídeo mostra a chamada para os planos, sem piscar a pausa antes', () => {
  const r = run();
  r.send('panda_play', 0); r.send('panda_pause', 99.8); r.send('panda_ended', 100); r.flush();
  assert.equal(r.estado(), 'fim');
});

test('play retomado logo após a pausa não pisca o overlay', () => {
  const r = run();
  r.send('panda_play', 0); r.send('panda_pause', 10); r.send('panda_play', 10); r.flush();
  assert.equal(r.estado(), 'oculto');
});

test('mensagens de outra janela e a prévia muda são ignoradas', () => {
  const r = run();
  r.send('panda_play', 0, {}, false); r.flush(); assert.equal(r.estado(), 'inicio');
  r.send('panda_play', 0, { isMutedIndicator: true }); r.flush(); assert.equal(r.estado(), 'inicio');
});

test('clique no vídeo fora do botão: retira o convite e, sem play, pede o play ao player', () => {
  const r = run();
  r.document.activeElement = r.frame; r.listeners.blur(); r.flush();
  assert.equal(r.estado(), 'oculto');
  assert.deepEqual(r.enviados, [['play', ORIGEM]]);
});

test('se o player já avisou o play, o reforço não manda comando', () => {
  const r = run();
  r.document.activeElement = r.frame; r.listeners.blur();
  const t0 = r.flush; // o blur agenda; o play chega antes do prazo do reforço
  r.send('panda_play', 0); t0();
  assert.deepEqual(r.enviados, []);
});

test('depois do início, clique no player (pausa, barra, volume) nunca vira comando de play', () => {
  const r = run();
  r.send('panda_play', 0); r.send('panda_pause', 30); r.flush();
  r.document.activeElement = r.frame; r.listeners.blur(); r.flush();
  assert.deepEqual(r.enviados, []);
  assert.equal(r.estado(), 'pausa');
});

test('slot oculto, id provisório ou sem marcação: não instala', () => {
  for (const opts of [{ hidden: true }, { id: '__PANDA_ID__' }, { semOverlay: true }]) {
    const r = run(opts);
    assert.equal(r.ov.hidden, true);
    assert.equal(r.listeners.message, undefined);
  }
});
