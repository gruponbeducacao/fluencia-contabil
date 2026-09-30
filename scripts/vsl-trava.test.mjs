import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ARQUIVO = process.env.VSL_TRAVA_ARQUIVO || new URL('../assets/vsl-trava.js', import.meta.url);
const source = readFileSync(ARQUIVO, 'utf8');
const ORIGEM = 'https://player-vz-test.tv.pandavideo.com.br';

function run({ hash = '', search = '', ua = 'Mozilla/5.0 (iPhone)', liberada = false, hidden = false, id = 'video-test', trava = '180' } = {}) {
  const listeners = {}, docListeners = {}, timers = [];
  const local = new Map(liberada ? [['fc_vsl_liberada:v1', '1']] : []), sessao = new Map();
  const classes = new Set();
  const txt = { textContent: '' }, barra = { style: { width: '' } };
  const aviso = { hidden: true, querySelector: s => (s === '[data-vsl-trava-txt]' ? txt : barra) };
  const frame = { contentWindow: {}, getAttribute: k => (k === 'data-src' ? `${ORIGEM}/embed/?v=${id}` : null) };
  const slot = { hidden, getAttribute: k => ({ 'data-vsl-trava': trava, 'data-vsl-version': 'v1' })[k] };
  let agora = 1_000_000;
  const dataLayer = [];
  const window = {
    location: { href: 'https://fluenciacontabil.com.br/assinatura.html' + search + hash, hash, search },
    navigator: { userAgent: ua }, dataLayer,
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, v) },
    sessionStorage: { getItem: k => sessao.get(k) ?? null, setItem: (k, v) => sessao.set(k, v) },
    addEventListener: (n, fn) => { listeners[n] = fn; },
  };
  const document = {
    visibilityState: 'visible',
    documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } },
    getElementById: k => ({ heroVsl: slot, heroVslFrame: frame, vslTrava: aviso })[k],
    addEventListener: (n, fn) => { docListeners[n] = fn; },
  };
  const context = vm.createContext({
    window, document, URL, Number, Math, String,
    Date: { now: () => agora },
    setTimeout: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
  });
  vm.runInContext(source, context);
  const msg = (message, currentTime, extra = {}) => listeners.message?.({
    source: frame.contentWindow, origin: ORIGEM, data: { message, currentTime, ...extra } });
  // toca de `de` até `ate` segundos de vídeo, em passos de 1 s de relógio
  const toca = (de, ate) => { for (let t = de; t <= ate; t += 1) { msg('panda_timeupdate', t); agora += 1000; } };
  const vence = () => timers.splice(0).forEach(t => t.fn());
  return { classes, aviso, txt, barra, local, dataLayer, msg, toca, vence,
    anda: s => { agora += s * 1000; }, travada: () => classes.has('vsl-trava') };
}

test('trava a página ao abrir e convida a dar o play', () => {
  const r = run();
  assert.equal(r.travada(), true);
  assert.equal(r.aviso.hidden, false);
  assert.equal(r.txt.textContent, 'Dê o play: a página libera depois de 3:00 de vídeo');
  assert.equal(r.dataLayer.at(-1).event, 'vsl_trava_inicio');
});

test('conta só o que foi assistido e mostra quanto falta', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 60);
  assert.equal(r.travada(), true);
  assert.equal(r.txt.textContent, 'Assista mais 2:00 para liberar a página');
  assert.equal(r.barra.style.width, '33.3%');
});

test('libera ao completar o tempo, lembra para a próxima visita e avisa o dataLayer', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 181);
  assert.equal(r.travada(), false);
  assert.equal(r.aviso.hidden, true);
  assert.equal(r.local.get('fc_vsl_liberada:v1'), '1');
  const ev = r.dataLayer.find(e => e.event === 'vsl_pagina_liberada');
  assert.equal(ev.motivo, 'assistiu');
});

test('arrastar a barra não conta como assistido', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 10);
  r.msg('panda_seeking', 10); r.msg('panda_seeked', 170);
  r.toca(170, 175);
  assert.equal(r.travada(), true);
  assert.match(r.txt.textContent, /Assista mais 2:4\d/);
});

test('pausa congela a contagem', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 30);
  r.msg('panda_pause', 30); r.anda(600); r.toca(30, 60);
  assert.equal(r.txt.textContent, 'Assista mais 2:30 para liberar a página');
});

test('player mudo por 15 s ou com erro: a página libera sozinha', () => {
  const r = run();
  r.vence();
  assert.equal(r.travada(), false);
  assert.equal(r.dataLayer.at(-1).motivo, 'player_mudo');
  const r2 = run();
  r2.msg('panda_ready', 0); r2.msg('panda_error', 0);
  assert.equal(r2.travada(), false);
  assert.equal(r2.dataLayer.at(-1).motivo, 'erro_player');
});

test('com o player respondendo, o prazo de 15 s não libera', () => {
  const r = run();
  r.msg('panda_ready', 0); r.vence();
  assert.equal(r.travada(), true);
});

test('não trava: link com âncora, quem já liberou, ?semtrava=1, robô de busca e slot oculto', () => {
  for (const opts of [{ hash: '#oferta' }, { liberada: true }, { search: '?semtrava=1' },
    { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, { hidden: true }, { id: '__PANDA_ID__' }]) {
    const r = run(opts);
    assert.equal(r.travada(), false, JSON.stringify(opts));
    assert.equal(r.aviso.hidden, true, JSON.stringify(opts));
  }
});


test('assinatura.html: libera no fim da demonstração de débito e crédito (5:31) e o texto sem JS bate com o do script', () => {
  // 30/09/2026: o Vinícius achou 11:39 (pitch) longo demais e pediu para ir até um argumento importante —
  // a demonstração de débito e crédito, que o gancho promete, fecha em 5:31 da VSL v2 ("Ufa!" começa em 5:31.41)
  const html = readFileSync(new URL('../assinatura.html', import.meta.url), 'utf8');
  const trava = (html.match(/id="heroVsl" data-vsl-trava="(\d+)"/) || [])[1];
  assert.equal(trava, '331');
  const estatico = (html.match(/data-vsl-trava-txt>([^<]+)</) || [])[1];
  assert.equal(estatico, 'Dê o play: a página libera depois de 5:31 de vídeo');
  assert.equal(run({ trava }).txt.textContent, estatico);
});
