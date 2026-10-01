import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const ARQUIVO = process.env.VSL_TRAVA_ARQUIVO || new URL('../assets/vsl-trava.js', import.meta.url);
const PAGINA = process.env.VSL_TRAVA_PAGINA || new URL('../assinatura.html', import.meta.url);
const source = readFileSync(ARQUIVO, 'utf8');
const html = readFileSync(PAGINA, 'utf8');
// Trecho opcional das páginas: ouve o player desde antes do iframe e marca window.FC_VSL_PLAYER_OK.
const TRECHO = (html.match(/<script data-vsl-trava-ouvinte>([\s\S]*?)<\/script>/) || [])[1];
const ORIGEM = 'https://player-vz-test.tv.pandavideo.com.br';

// Página falsa ESTRITA: getElementById e querySelector só respondem aos ids/seletores exatos (o resto
// é null), cada evento guarda todos os ouvintes e o relógio é virtual — setTimeout/clearTimeout de
// verdade, disparados na ordem do prazo quando o tempo anda. Nada passa "por acaso".
function pagina({ hash = '', search = '', ua = 'Mozilla/5.0 (iPhone)', liberada = false, hidden = false,
  id = 'video-test', trava = '180', conteudo = null, sem = [], segundos = null, texto = null } = {}) {
  let agora = 1_000_000, proximo = 1;
  const timers = [], ouvintes = { window: {}, document: {} };
  const liga = alvo => (nome, fn) => { (ouvintes[alvo][nome] ||= []).push(fn); };
  const desliga = alvo => (nome, fn) => {
    const lista = ouvintes[alvo][nome] || [], i = lista.indexOf(fn);
    if (i >= 0) lista.splice(i, 1);
  };
  const dispara = (alvo, nome, ev) => (ouvintes[alvo][nome] || []).slice().forEach(fn => fn(ev));
  const local = new Map(liberada ? [['fc_vsl_liberada:v1', '1']] : []);
  const sessao = new Map(segundos !== null ? [['fc_vsl_trava_seg:v1', segundos]] : []);
  const classes = new Set(), attrs = new Set();
  const txt = { textContent: '' }, barra = { style: { width: '' } };
  const aviso = { hidden: true,
    querySelector: s => ({ '[data-vsl-trava-txt]': txt, '[data-vsl-trava-barra]': barra })[s] ?? null,
    setAttribute: k => attrs.add(k), removeAttribute: k => attrs.delete(k) };
  const frame = { contentWindow: { quem: 'player' },
    getAttribute: k => (k === 'data-src' ? `${ORIGEM}/embed/?v=${id}` : null) };
  const slotAttrs = { 'data-vsl-trava': trava, 'data-vsl-version': 'v1' };
  if (conteudo !== null) slotAttrs['data-vsl-content'] = conteudo;
  if (texto !== null) slotAttrs['data-vsl-trava-texto'] = texto;
  const slot = { hidden, getAttribute: k => (k in slotAttrs ? slotAttrs[k] : null) };
  const elementos = { heroVsl: slot, heroVslFrame: frame, vslTrava: aviso };
  for (const k of sem) delete elementos[k];
  const body = { quem: 'body' };
  const dataLayer = [];
  const window = {
    location: { href: 'https://fluenciacontabil.com.br/assinatura.html' + search + hash, hash, search },
    navigator: { userAgent: ua }, dataLayer,
    localStorage: { getItem: k => local.get(k) ?? null, setItem: (k, v) => local.set(k, v) },
    sessionStorage: { getItem: k => sessao.get(k) ?? null, setItem: (k, v) => sessao.set(k, v) },
    addEventListener: liga('window'), removeEventListener: desliga('window'),
  };
  const document = {
    visibilityState: 'visible', activeElement: body,
    documentElement: { classList: { add: c => classes.add(c), remove: c => classes.delete(c) } },
    getElementById: k => elementos[k] ?? null,
    addEventListener: liga('document'), removeEventListener: desliga('document'),
  };
  const context = vm.createContext({
    window, document, URL, Number, Math, String,
    Date: { now: () => agora },
    setTimeout: (fn, ms) => { const n = proximo++; timers.push({ n, fn, em: agora + (Number(ms) || 0) }); return n; },
    clearTimeout: n => { const i = timers.findIndex(t => t.n === n); if (i >= 0) timers.splice(i, 1); },
  });
  const anda = seg => {
    const fim = agora + Math.round(seg * 1000);
    for (;;) {
      timers.sort((a, b) => a.em - b.em || a.n - b.n);
      if (!timers.length || timers[0].em > fim) break;
      const t = timers.shift();
      agora = Math.max(agora, t.em);
      t.fn();
    }
    agora = fim;
  };
  const posta = (data, de = {}) => dispara('window', 'message', {
    source: 'source' in de ? de.source : frame.contentWindow, origin: de.origin || ORIGEM, data });
  const msg = (message, currentTime, extra = {}, de = {}) => posta({ message, currentTime, ...extra }, de);
  // toca de `de` até `ate` segundos de vídeo, em passos de 1 s de relógio
  const toca = (de, ate) => { for (let t = de; t <= ate; t += 1) { msg('panda_timeupdate', t); anda(1); } };
  // a página perde o foco para `foco` (o iframe = clique no vídeo; outro = outra aba, outro app)
  const perdeFoco = foco => { document.activeElement = foco; dispara('window', 'blur', {}); anda(0); };
  const clica = () => perdeFoco(frame);
  const liberacoes = () => dataLayer.filter(e => e.event === 'vsl_pagina_liberada');
  return {
    window, document, frame, body, classes, aviso, txt, barra, local, dataLayer, posta, msg, toca, anda, clica, perdeFoco, liberacoes,
    instala: () => vm.runInContext(source, context),
    roda: codigo => vm.runInContext(codigo, context),
    esconde: sim => { document.visibilityState = sim ? 'hidden' : 'visible'; dispara('document', 'visibilitychange', {}); },
    travada: () => classes.has('vsl-trava'),
    motivo: () => (liberacoes().at(-1) || {}).motivo,
    avisoVisivel: () => !aviso.hidden && attrs.has('data-pausa'),
  };
}
function run(opts) { const p = pagina(opts); p.instala(); return p; }

test('trava a página ao abrir, com o aviso de tempo ainda invisível', () => {
  const r = run();
  assert.equal(r.travada(), true);
  assert.equal(r.aviso.hidden, false);  // no layout (reserva o espaço), mas sem data-pausa
  assert.equal(r.avisoVisivel(), false);
  assert.equal(r.txt.textContent, 'Assista mais 3:00 para liberar a página');
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
  assert.equal(r.liberacoes().length, 1);
  assert.equal(r.motivo(), 'assistiu');
});

test('o texto do aviso pode vir da página (data-vsl-trava-texto) e segue o tempo que falta', () => {
  const r = run({ texto: 'Assista mais {tempo} para liberar seu cashback' });
  assert.equal(r.txt.textContent, 'Assista mais 3:00 para liberar seu cashback');
  r.msg('panda_play', 0); r.toca(0, 60);
  assert.equal(r.txt.textContent, 'Assista mais 2:00 para liberar seu cashback');
});

test('texto da página sem {tempo}, ou vazio, volta ao texto de sempre', () => {
  assert.equal(run({ texto: 'Assista para liberar' }).txt.textContent, 'Assista mais 3:00 para liberar a página');
  assert.equal(run({ texto: '' }).txt.textContent, 'Assista mais 3:00 para liberar a página');
});

test('arrastar a barra não conta como assistido', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 10);
  r.msg('panda_seeking', 10); r.msg('panda_seeked', 170);
  r.toca(170, 175);
  assert.equal(r.travada(), true);
  assert.match(r.txt.textContent, /Assista mais 2:4\d/);
});

test('o tempo que falta só aparece na pausa e some quando o vídeo volta a tocar', () => {
  // 30/09/2026, pedido do Vinícius: "só mostre o tempo que falta quando a pessoa clicar em pause"
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 60);
  assert.equal(r.avisoVisivel(), false);
  r.msg('panda_pause', 60);
  assert.equal(r.avisoVisivel(), true);
  assert.equal(r.txt.textContent, 'Assista mais 2:00 para liberar a página');
  r.msg('panda_play', 60);
  assert.equal(r.avisoVisivel(), false);
});

test('pausa congela a contagem', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 30);
  r.msg('panda_pause', 30); r.anda(600); r.toca(30, 60);
  assert.equal(r.txt.textContent, 'Assista mais 2:30 para liberar a página');
});

// ---------------------------------------------------------------------------------------------
// Falha abre, mas só com sinal de falha (revisão de 30/09/2026). Uma linha da tabela por teste.

test('Panda inteiro bloqueado (nenhuma mensagem): libera aos 15 s com player_mudo, sem lembrar', () => {
  const r = run();
  r.anda(14.9);
  assert.equal(r.travada(), true);
  r.anda(0.1);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_mudo');
  assert.equal(r.local.get('fc_vsl_liberada:v1'), undefined);
});

test('panda_error libera na hora', () => {
  const r = run();
  r.msg('panda_ready', 0); r.msg('panda_error', 0);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'erro_player');
});

test('A1: player carrega e o vídeo não (play sem o tempo andar) — libera 20 s depois do play com player_travado', () => {
  // Medido pelo revisor com o CDN do vídeo bloqueado: panda_ready, e no clique só panda_play; nem
  // timeupdate nem panda_error. Antes a página ficava trancada para sempre.
  const r = run();
  r.msg('PANDA_READY'); r.msg('panda_ready', 0); r.msg('panda_allData');
  r.anda(3); r.msg('panda_play', 0);
  r.anda(19.9);
  assert.equal(r.travada(), true);
  r.anda(0.1);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_travado');
  assert.equal(r.local.get('fc_vsl_liberada:v1'), undefined);
});

test('A1: pausar e dar play de novo não zera o prazo do vídeo que não anda', () => {
  const r = run();
  r.msg('panda_ready', 0);
  r.msg('panda_play', 0); r.anda(8);
  r.msg('panda_pause', 0); r.anda(4);
  r.msg('panda_play', 0); r.anda(7.9);
  assert.equal(r.travada(), true);
  r.anda(0.1);  // 20 s depois do PRIMEIRO play
  assert.equal(r.motivo(), 'player_travado');
});

test('A1: arrastar a barra com o vídeo parado não prova que o vídeo carregou', () => {
  const r = run();
  r.msg('panda_ready', 0); r.msg('panda_play', 0);
  r.anda(5); r.msg('panda_seeking', 60); r.msg('panda_timeupdate', 60);   // arraste: vários avisos
  r.msg('panda_timeupdate', 100); r.msg('panda_seeked', 100);             // dentro da mesma busca
  r.anda(15);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_travado');
});

test('prévia muda (autoplay sem som) é o player vivo: não libera por mudo nem conta tempo', () => {
  const r = run();
  for (let t = 0; t < 30; t += 1) { r.msg('panda_timeupdate', t, { isMutedIndicator: true }); r.anda(1); }
  r.anda(600);
  assert.equal(r.travada(), true);
  assert.equal(r.txt.textContent, 'Assista mais 3:00 para liberar a página');
});

test('vídeo que demora a começar mas anda não é liberado pelo prazo de 20 s', () => {
  const r = run();
  r.msg('panda_ready', 0); r.msg('panda_play', 0);
  r.anda(6);                         // carregando: nenhum timeupdate
  r.toca(0, 60);                     // começou a andar
  r.anda(120);
  assert.equal(r.travada(), true);
  assert.equal(r.liberacoes().length, 0);
});

test('prazo do vídeo com a aba em segundo plano: espera a pessoa voltar', () => {
  const r = run();
  r.msg('panda_ready', 0); r.msg('panda_play', 0);
  r.anda(5); r.esconde(true);
  r.anda(40);
  assert.equal(r.travada(), true);
  r.esconde(false); r.anda(5);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_travado');
});

test('player funcionando e a pessoa sem dar play: continua travada (nenhum relógio libera)', () => {
  const r = run();
  r.msg('PANDA_READY'); r.msg('panda_ready', 0); r.msg('panda_allData');
  r.anda(16); r.msg('panda_canplay', 0); r.msg('panda_progress', 0);  // o que o player manda sem play
  r.anda(600);
  assert.equal(r.travada(), true);
  assert.equal(r.liberacoes().length, 0);
});

test('A2: a página já ouviu o player antes deste arquivo (FC_VSL_PLAYER_OK) — continua travada', () => {
  const p = pagina();
  p.window.FC_VSL_PLAYER_OK = true;   // o trecho da página ouviu o panda_ready antes de a trava existir
  p.instala();
  p.anda(600);
  assert.equal(p.travada(), true);
  assert.equal(p.liberacoes().length, 0);
});

test('A2 sem o trecho na página: continua como antes (sem ouvir nada, abre aos 15 s)', () => {
  const p = pagina();
  p.msg('panda_ready', 0);            // chegou antes: ninguém ouvia
  p.anda(0.5); p.instala();
  p.anda(15);
  assert.equal(p.travada(), false);
  assert.equal(p.motivo(), 'player_mudo');
});

test('player que não responde ao clique: o foco no iframe conta como tentativa e libera em 20 s', () => {
  const r = run();
  r.msg('panda_ready', 0);            // falou ao carregar (o prazo de 15 s não vale mais)...
  r.anda(4); r.clica();               // ...mas o clique não gera panda_play nem nada
  r.anda(19.9);
  assert.equal(r.travada(), true);
  r.anda(0.1);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_travado');
});

test('perder o foco para fora do vídeo (outra aba, outro app) não é tentativa de play', () => {
  const r = run();
  r.msg('panda_ready', 0);
  r.anda(1); r.perdeFoco(r.body);
  r.anda(1); r.perdeFoco({ quem: 'campo-de-busca' });
  r.anda(600);
  assert.equal(r.travada(), true);
  assert.equal(r.liberacoes().length, 0);
});

test('player que não fala nada desde o início: 15 s, com ou sem clique', () => {
  const r = run();
  r.anda(2); r.clica();
  r.anda(12.9);
  assert.equal(r.travada(), true);
  r.anda(0.1);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'player_mudo');
});

test('arrastar até o fim: libera (continuar de onde parou), lembra, e o motivo diz fim_do_video', () => {
  const r = run();
  r.msg('panda_play', 0); r.toca(0, 10);
  r.msg('panda_seeking', 10); r.msg('panda_seeked', 178); r.toca(178, 180);
  r.msg('panda_ended', 180.1);
  assert.equal(r.travada(), false);
  assert.equal(r.motivo(), 'fim_do_video');
  assert.equal(r.local.get('fc_vsl_liberada:v1'), '1');
  assert.ok(r.liberacoes()[0].watched_seconds < 180);
});

test('fim do vídeo com o limite já assistido: motivo assistiu', () => {
  const r = run({ trava: '30' });
  r.msg('panda_play', 0); r.toca(0, 29); r.msg('panda_ended', 30);   // o último pedaço fecha a conta
  assert.equal(r.motivo(), 'assistiu');
  assert.equal(r.liberacoes().length, 1);
  const s = run({ trava: '30', segundos: '30' });                     // já contado nesta sessão
  s.msg('panda_ended', 787);
  assert.equal(s.motivo(), 'assistiu');
});

test('eventos levam content_name do data-vsl-content, como o vsl.js — e só quando existe', () => {
  const r = run({ conteudo: 'dicionario_2026_09' });
  r.anda(15);
  for (const e of r.dataLayer) assert.equal(e.content_name, 'dicionario_2026_09', e.event);
  assert.deepEqual(r.dataLayer.map(e => e.event), ['vsl_trava_inicio', 'vsl_pagina_liberada']);
  const s = run();
  s.anda(15);
  for (const e of s.dataLayer) assert.equal('content_name' in e, false, e.event);
});

test('mensagens de outra janela ou de outra origem não contam como o player', () => {
  const r = run();
  r.msg('panda_ready', 0, {}, { source: { quem: 'outro-iframe' } });
  r.msg('panda_ready', 0, {}, { origin: 'https://evil.example' });
  r.anda(15);
  assert.equal(r.motivo(), 'player_mudo');
});

test('não trava: link com âncora, quem já liberou, ?semtrava=1, robô de busca, slot oculto e página sem as peças', () => {
  for (const opts of [{ hash: '#oferta' }, { liberada: true }, { search: '?semtrava=1' },
    { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, { hidden: true }, { id: '__PANDA_ID__' },
    { sem: ['vslTrava'] }, { sem: ['heroVslFrame'] }, { sem: ['heroVsl'] }]) {
    const r = run(opts);
    assert.equal(r.travada(), false, JSON.stringify(opts));
    assert.equal(r.aviso.hidden, true, JSON.stringify(opts));
    assert.equal(r.window.FC_VSL_TRAVA, undefined, JSON.stringify(opts));
  }
});

// ---------------------------------------------------------------------------------------------
// O trecho da assinatura.html (<script data-vsl-trava-ouvinte>), o mesmo que as outras páginas copiam.

test('assinatura.html: o trecho que ouve o player vem antes do iframe e do código que liga o src', () => {
  assert.ok(TRECHO, 'sem <script data-vsl-trava-ouvinte> na página');
  const i = html.indexOf('<script data-vsl-trava-ouvinte>');
  assert.ok(i < html.indexOf('id="heroVslFrame"'), 'o trecho tem de vir antes do iframe');
  assert.ok(i < html.indexOf("f.setAttribute('src', src)"), 'o trecho tem de vir antes de o player começar a carregar');
});

test('corrida A2 com o trecho da assinatura.html: o panda_ready chega antes do arquivo e a página continua travada', () => {
  const p = pagina();
  p.roda(TRECHO);                                              // inline, antes do iframe
  p.anda(0.7); p.msg('PANDA_READY'); p.msg('panda_ready', 0); p.msg('panda_allData');
  p.anda(1.8); p.instala();                                    // o vsl-trava.js chega depois (defer, injetado, rede lenta)
  p.anda(19); p.msg('panda_canplay', 0); p.msg('panda_progress', 0);  // próximo aviso sem play: 14,7–21 s (medido)
  p.anda(600);
  assert.equal(p.window.FC_VSL_PLAYER_OK, true);
  assert.equal(p.travada(), true);
  assert.equal(p.liberacoes().length, 0);
  p.msg('panda_play', 0); p.anda(20);                          // e a saída do A1 continua valendo
  assert.equal(p.motivo(), 'player_travado');
});

test('trecho da assinatura.html não se engana: outra janela, outra origem ou aviso sem message não marcam o player', () => {
  const p = pagina();
  p.roda(TRECHO);
  p.msg('panda_ready', 0, {}, { source: { quem: 'outro-iframe' } });
  p.msg('panda_ready', 0, {}, { origin: 'https://evil.example' });
  p.msg('panda_ready', 0, {}, { origin: 'https://player-vz-test.tv.pandavideo.com.br.evil.example' });
  p.posta({ type: 'panda_ready' }); p.posta('panda_ready'); p.posta(null);
  assert.equal(p.window.FC_VSL_PLAYER_OK, undefined);
  p.instala(); p.anda(15);                                     // Panda bloqueado com o trecho: 15 s, como sem ele
  assert.equal(p.motivo(), 'player_mudo');
});

test('assinatura.html: libera no fim da proposta da Fluência Contábil (6:41) e o texto sem JS bate com o do script', () => {
  // 30/09/2026: 3:00 era arbitrário e 11:39 (pitch) longo demais; 5:31 (fim da demonstração de débito e crédito)
  // durou um PR. O Vinícius fechou em 6:41: fim da proposta da Fluência Contábil — "É essa autonomia que eu quero
  // construir em você." termina em 6:40.55 da VSL v2
  const trava = (html.match(/id="heroVsl" data-vsl-trava="(\d+)"/) || [])[1];
  assert.equal(trava, '401');
  const estatico = (html.match(/data-vsl-trava-txt>([^<]+)</) || [])[1];
  assert.equal(estatico, 'Assista mais 6:41 para liberar a página');
  assert.equal(run({ trava }).txt.textContent, estatico);
});

test('continuar.html: libera no pitch do vídeo do cashback (4:23), texto sem JS igual ao do script, arquivo da assinatura', () => {
  // 30/09/2026, decisão do Vinícius: trava para todos os compradores do Dicionário; a oferta só
  // aparece depois do pitch (263 s no vídeo já a 1,25x). A página injeta o mesmo arquivo, na mesma versão.
  const html = readFileSync(new URL('../continuar.html', import.meta.url), 'utf8');
  const slot = (html.match(/<section\b[^>]*\bid="heroVsl"[^>]*>/) || [''])[0];
  const attr = nome => (slot.match(new RegExp(`\\s${nome}="([^"]*)"`)) || [])[1];
  const trava = attr('data-vsl-trava');
  assert.equal(trava, '263');
  assert.equal(attr('data-vsl-pitch'), trava);
  assert.ok(attr('data-vsl-version'), 'sem data-vsl-version o vsl-trava.js não trava');
  // 01/10/2026, pedido do Vinícius: no cashback, "Assista mais m:ss para liberar seu cashback".
  const texto = attr('data-vsl-trava-texto');
  assert.equal(texto, 'Assista mais {tempo} para liberar seu cashback');
  const estatico = (html.match(/data-vsl-trava-txt>([^<]+)</) || [])[1];
  assert.equal(estatico, 'Assista mais 4:23 para liberar seu cashback');
  assert.equal(run({ trava, texto }).txt.textContent, estatico);
  const assinatura = readFileSync(new URL('../assinatura.html', import.meta.url), 'utf8');
  const versao = s => (s.match(/assets\/vsl-trava\.js\?v=(\w+)/) || [])[1];
  assert.ok(versao(html));
  assert.equal(versao(html), versao(assinatura));
});

test('continuar.html: o mesmo trecho que ouve o player, antes do iframe e do src, e a corrida A2 continua travada', () => {
  // A continuar copia data-src para src em iniciarVsl() e injeta o vsl-trava.js logo depois: o panda_ready pode
  // chegar antes do arquivo. O trecho é o da assinatura.html, byte a byte (tirando os espaços).
  const cont = readFileSync(new URL('../continuar.html', import.meta.url), 'utf8');
  const daAssinatura = readFileSync(new URL('../assinatura.html', import.meta.url), 'utf8');
  const trecho = s => (s.match(/<script data-vsl-trava-ouvinte>([\s\S]*?)<\/script>/) || [])[1];
  const normaliza = s => (s || '').replace(/\s+/g, ' ').trim();
  assert.ok(trecho(cont), 'sem <script data-vsl-trava-ouvinte> na continuar.html');
  assert.equal(normaliza(trecho(cont)), normaliza(trecho(daAssinatura)));
  const i = cont.indexOf('<script data-vsl-trava-ouvinte>');
  assert.ok(i < cont.indexOf('id="heroVslFrame"'), 'o trecho tem de vir antes do iframe');
  assert.ok(i < cont.indexOf("f.setAttribute('src', src)"), 'o trecho tem de vir antes de o player começar a carregar');
  const p = pagina({ trava: '263' });
  p.roda(trecho(cont));
  p.anda(0.7); p.msg('panda_ready', 0); p.anda(1.8); p.instala();   // o arquivo injetado chega depois do player
  p.anda(600);
  assert.equal(p.window.FC_VSL_PLAYER_OK, true);
  assert.equal(p.travada(), true);
  assert.equal(p.liberacoes().length, 0);
});
