import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../assets/vsl.js', import.meta.url), 'utf8');
function run({ hidden = false, configured = true, storage = new Map() } = {}) {
  let clock = 0;
  const listeners = {}, domListeners = {};
  const frame = { contentWindow: {}, getAttribute: () => 'https://player-vz-test.tv.pandavideo.com.br/embed/?v=video-test' };
  const slot = { hidden, contains: () => true,
    getAttribute: k => ({'data-vsl-version': configured ? 'v1' : '', 'data-vsl-duration': '100', 'data-vsl-pitch': '70'})[k] };
  const window = { location: { href: 'https://fluenciacontabil.com.br/assinatura.html' },
    dataLayer: [], addEventListener: (name, fn) => listeners[name] = fn };
  const document = { visibilityState: 'visible', getElementById: id => id === 'heroVsl' ? slot : frame,
    addEventListener: (name, fn) => domListeners[name] = fn };
  const context = vm.createContext({window, document, URL, Number, Date: {now: () => clock},
    sessionStorage: {getItem: k => storage.get(k), setItem: (k, v) => storage.set(k, v)}});
  const load = () => vm.runInContext(source, context);
  load();
  const send = (message, currentTime, extra = {}, trusted = true) => {
    clock += 1000;
    listeners.message?.({source: trusted ? frame.contentWindow : {}, origin: 'https://player-vz-test.tv.pandavideo.com.br', data: {message, currentTime, ...extra}});
  };
  return {window, document, domListeners, storage, send, load, names: () => window.dataLayer.map(x => x.event),
    watch: (start, end) => {for (let t = start; t <= end; t++) send('panda_timeupdate', t);}};
}
test('vídeo oculto ou sem versão gravada não instala rastreamento', () => {
  for (const opts of [{hidden: true}, {configured: false}]) {
    const r = run(opts); r.send('panda_play', 0); assert.equal(r.names().length, 0);
  }
});
test('somente o iframe configurado conta; marcos únicos usam segundos assistidos', () => {
  const r = run(); r.send('panda_play', 0, {}, false); assert.deepEqual(r.names(), []);
  r.send('panda_play', 0); r.watch(1, 96); r.send('panda_pause', 96); r.send('panda_play', 0); r.watch(1, 30);
  for (const event of ['vsl_start', 'vsl_25', 'vsl_50', 'vsl_75', 'vsl_95', 'vsl_pitch_reached']) {
    assert.equal(r.names().filter(x => x === event).length, 1);
  }
  assert.ok(!r.names().includes('Purchase')); assert.ok(!r.names().includes('InitiateCheckout'));
  assert.ok(r.window.dataLayer.every(e => e.watched_seconds <= 100));
});
test('arrastar até o final não gera quartis nem pitch; autoplay indicador é ignorado', () => {
  const r = run(); r.send('panda_play', 0, {isMutedIndicator:true}); r.watch(1, 30);
  assert.deepEqual(r.names(), []);
  r.send('panda_play', 0); r.watch(1, 5); r.send('panda_seeking', 95); r.send('panda_seeked', 95); r.watch(95, 100);
  assert.deepEqual(r.names(), ['vsl_start']);
});
test('repetir trecho e assistir com aba oculta não infla a retenção', () => {
  const r = run(); r.send('panda_play', 0); r.watch(1, 15);
  r.send('panda_seeking', 0); r.send('panda_seeked', 0); r.watch(0, 15);
  assert.ok(!r.names().includes('vsl_25'));
  r.document.visibilityState = 'hidden'; r.watch(16, 90);
  assert.ok(!r.names().includes('vsl_25'));
});
test('recarregar na mesma sessão mantém deduplicação e o script não reinstala listeners', () => {
  const a = run(); a.send('panda_play', 0); a.watch(1, 30); a.send('panda_pause', 30);
  const b = run({storage:a.storage}); b.send('panda_play', 30); b.watch(31, 55);
  assert.ok(!b.names().includes('vsl_start')); assert.ok(!b.names().includes('vsl_25'));
  assert.ok(b.names().includes('vsl_50')); b.load(); b.send('panda_play', 55);
  assert.ok(!b.names().includes('vsl_start'));
});
test('play em aba oculta só inicia a métrica ao receber reprodução válida depois de voltar', () => {
  const r = run(); r.document.visibilityState = 'hidden';
  r.send('panda_play', 0); r.watch(1, 20);
  assert.deepEqual(r.names(), []);
  r.document.visibilityState = 'visible'; r.domListeners.visibilitychange();
  assert.deepEqual(r.names(), []);
  r.send('panda_timeupdate', 21);
  assert.deepEqual(r.names(), ['vsl_start']);
  assert.equal(r.window.dataLayer[0].video_position, 21);
  assert.equal(r.window.dataLayer[0].watched_seconds, 0);
  r.watch(22, 47);
  const quarter = r.window.dataLayer.find(x => x.event === 'vsl_25');
  assert.equal(quarter.video_position, 46);
  assert.equal(quarter.watched_seconds, 25);
});
test('clique no CTA preserva a posição conhecida após pausa ou término', () => {
  for (const [message, position] of [['panda_pause', 75], ['panda_ended', 100]]) {
    const r = run(); r.send('panda_play', 0); r.watch(1, position); r.send(message, position);
    r.domListeners.click({target:{closest:()=>({})}});
    const click = r.window.dataLayer.find(x => x.event === 'vsl_cta_click');
    assert.equal(click.video_position, position);
    assert.equal(click.watched_seconds, position);
  }
});
test('apelido antigo preserva UTMs e fragmento ao seguir para a página única', () => {
  const html = readFileSync(new URL('../assinaturas.html', import.meta.url), 'utf8');
  const script = /<script>([\s\S]*?)<\/script>/.exec(html)[1];
  let destination;
  const location = {href:'https://fluenciacontabil.com.br/assinaturas.html?utm_campaign=123&utm_term=criativo-7#oferta', search:'?utm_campaign=123&utm_term=criativo-7', hash:'#oferta', replace: value => destination = String(value)};
  vm.runInNewContext(script, {URL, window:{location}});
  assert.equal(destination, 'https://fluenciacontabil.com.br/assinatura.html?utm_campaign=123&utm_term=criativo-7#oferta');
  assert.ok(!html.includes('googletagmanager.com'));
});

function capture({ storageAvailable = true, networkFails = false } = {}) {
  const html = readFileSync(new URL('../assinatura.html', import.meta.url), 'utf8');
  const start = html.indexOf('/* ===== CAPTURA DE E-MAIL');
  const end = html.indexOf('/* ===== ATENDIMENTO NO WHATSAPP', start);
  assert.ok(start >= 0 && end > start);
  const script = html.slice(start, end);
  const ids = {}, dataLayer = [], storage = new Map(), requests = [];
  let downloads = 0;
  for (const id of ['fcCapOverlay','fcCapForm','fcCapEmail','fcCapErro','fcCapOk','fcCapBtn','fcCapClose','gat']) {
    const classes = new Set();
    const element = {style:{}, hidden:true, value:'', listeners:{}, focus:()=>{},
      classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),contains:x=>classes.has(x)},
      getAttribute:k=>({'data-fc-pdf':'qa.pdf','data-fc-download':'qa.pdf','data-fc-local':'hero'})[k]};
    element.addEventListener = (name, fn) => element.listeners[name] = fn;
    ids[id] = element;
  }
  ids.fcCapEmail.value = 'qa@example.invalid';
  const document = {querySelector:()=>ids.gat,getElementById:id=>ids[id],activeElement:ids.gat,
    referrer:'',addEventListener:()=>{},body:{appendChild:()=>{},removeChild:()=>{}},
    createElement:()=>({click:()=>downloads++})};
  const window = {dataLayer,location:{search:'?utm_campaign=QA',pathname:'/assinatura.html'},
    matchMedia:()=>({matches:false}),localStorage:{
      getItem:k=>{if(!storageAvailable)throw new Error('storage unavailable');return storage.get(k);},
      setItem:(k,v)=>{if(!storageAvailable)throw new Error('storage unavailable');storage.set(k,v);}}};
  const fetch = (url, options) => {
    requests.push({url,method:options.method,mode:options.mode,body:Object.fromEntries(options.body)});
    return networkFails ? Promise.reject(new TypeError('network unavailable')) : Promise.resolve({type:'opaque'});
  };
  vm.runInNewContext(script,{window,document,URLSearchParams,dataLayer,fetch,setTimeout:fn=>fn()});
  return {ids,dataLayer,storage,requests,downloads:()=>downloads,
    open:()=>ids.gat.listeners.click({preventDefault:()=>{}}),
    submit:async()=>{ids.fcCapForm.listeners.submit({preventDefault:()=>{}});await Promise.resolve();}};
}
test('amostra pode ser baixada novamente na página quando localStorage está indisponível', async () => {
  const r = capture({storageAvailable:false});
  r.open(); await r.submit();
  assert.equal(r.downloads(), 1);
  assert.equal(r.ids.fcCapOverlay.hidden, true);
  r.open();
  assert.equal(r.downloads(), 2);
  assert.equal(r.ids.fcCapOverlay.hidden, true);
  assert.equal(r.requests.length, 1);
  assert.equal(r.requests[0].mode, 'no-cors');
  assert.equal(r.requests[0].body.origem, 'assinatura_aula01');
  assert.equal(r.dataLayer.filter(x=>x.event==='lead_capturado').length, 1);
});
test('falha de rede na amostra permite tentar novamente e não registra envio ou download', async () => {
  const r = capture({networkFails:true}); r.open(); await r.submit();
  assert.equal(r.downloads(), 0);
  assert.equal(r.dataLayer.length, 0);
  assert.equal(r.storage.get('fc_ec_subscribed'), undefined);
  assert.equal(r.ids.fcCapBtn.disabled, false);
  assert.equal(r.ids.fcCapErro.classList.contains('on'), true);
  assert.notEqual(r.ids.fcCapForm.style.display, 'none');
});
