import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html = readFileSync(new URL('../aula-ao-vivo.html', import.meta.url), 'utf8');
const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((s) => s.includes('var ORIGEM_SEM_AULA'));
assert.equal(scripts.length, 1);
const origem = readFileSync(new URL('../assets/origem.js', import.meta.url), 'utf8');
const base = 'https://fluenciacontabil.com.br/aula-ao-vivo.html';
const campos = {
  utm_source: 'meta', utm_medium: 'paid', utm_campaign: 'ensaio',
  utm_content: 'criativo', utm_term: '123456789012345678', src: 'anuncio',
};
const marcada = `${base}?${new URLSearchParams(campos)}`;
const esperar = () => new Promise((resolve) => setImmediate(resolve));
// Quem nasce escondido no HTML nasce escondido aqui: sem isso, "apareceu" passaria
// mesmo quando o script nunca mexeu no elemento.
const escondidos = new Set([...html.matchAll(/<[a-z]+\b[^>]*>/g)]
  .filter((m) => /\shidden(?=[\s>])/.test(m[0]))
  .map((m) => (m[0].match(/\bid="([^"]+)"/) || [])[1]).filter(Boolean));
assert.ok(escondidos.has('cap-agenda') && escondidos.has('cap-agenda-google') && escondidos.has('cap-agenda-ics'));

// Executa o script completo do formulário e o asset real de origem.
// DOM, armazenamento e rede são simulados; nenhum contato ou pixel é acionado.
function pagina(url = base, storage = new Map(), opcoes = {}) {
  const nodes = new Map(), requests = [], events = [];
  function el(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', hidden: escondidos.has(id), disabled: false, listeners: {}, attrs: {},
      setAttribute(nome, valor) { this.attrs[nome] = valor; }, focus() {}, appendChild() {},
      querySelector: () => el('fechar'), querySelectorAll: () => [],
      addEventListener(event, fn) { this.listeners[event] = fn; },
    });
    return nodes.get(id);
  }
  const dataLayer = [];
  const window = {
    location: new URL(url), matchMedia: () => ({ matches: false }),
    fbq: (...args) => events.push(args),
    dataLayer,
  };
  const ctx = vm.createContext({
    window, location: window.location, URL, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    // `jaInscrito`: o navegador de quem já deixou o e-mail nesta aula.
    localStorage: { getItem: () => (opcoes.jaInscrito ? '1' : null), setItem() {} },
    sessionStorage: {
      getItem(k) { if (opcoes.storageBloqueado) throw Error('bloqueado'); return storage.get(k) ?? null; },
      setItem(k, v) { if (opcoes.storageBloqueado) throw Error('bloqueado'); storage.set(k, v); },
    },
    document: {
      readyState: 'loading', cookie: '', getElementById: el,
      querySelectorAll: () => [], addEventListener() {},
      createElement: () => el('novo'), createTextNode: (text) => ({ text }),
    },
    fetch: async (url, options) => {
      if (url.startsWith('assets/aulas/agenda.json')) {
        return { ok: true, json: async () => ({ aulas: opcoes.aulas || [] }) };
      }
      assert.equal(new URL(url).hostname, 'script.google.com');
      requests.push({ url, options, body: new URLSearchParams(options.body.toString()) });
      return { ok: true, type: 'cors', json: async () => ({ ok: opcoes.aceita !== false }) };
    },
  });
  if (opcoes.carregarOrigem !== false) vm.runInContext(origem, ctx);
  if (opcoes.antes) opcoes.antes(el);
  vm.runInContext(scripts[0], ctx);
  return {
    window, requests, events, dataLayer, el, esperar,
    async enviar({ duplo = false } = {}) {
      await esperar();
      el('cap-email').value = 'Ensaio@example.invalid';
      const submit = () => el('cap-form').listeners.submit({ preventDefault() {} });
      submit();
      if (duplo) submit();
      await esperar();
      assert.equal(requests.length, 1);
      assert.equal(requests[0].options.method, 'POST');
      assert.equal(requests[0].options.mode, 'cors');
      return requests[0].body;
    },
  };
}

test('Aulas preserva os seis parâmetros depois de navegar sem query string', async () => {
  const storage = new Map();
  pagina(marcada, storage);
  const body = await pagina(base, storage).enviar();
  for (const [k, v] of Object.entries(campos)) assert.equal(body.get(k), v, k);
});

test('acesso direto mantém ID de 18 dígitos e os campos do formulário', async () => {
  const body = await pagina(marcada + '&fbclid=clique&gclid=outro&s1=cookie&s2=clique').enviar();
  for (const [k, v] of Object.entries(campos)) assert.equal(body.get(k), v, k);
  assert.equal(body.get('email'), 'ensaio@example.invalid');
  assert.equal(body.get('origem'), 'aula_ao_vivo');
  assert.equal(body.get('consentimento'), 'material_e_aviso_semanal_aula_ao_vivo');
  assert.equal(body.get('pagina'), base);
  for (const k of ['fbclid', 'gclid', 's1', 's2', '_fbp', '_fbc']) assert.equal(body.has(k), false);
});

test('campanha nova parcial não herda campos da campanha anterior', async () => {
  const storage = new Map();
  pagina(marcada, storage);
  const body = await pagina(base + '?utm_campaign=nova', storage).enviar();
  assert.equal(body.get('utm_campaign'), 'nova');
  for (const k of Object.keys(campos).filter((k) => k !== 'utm_campaign')) assert.equal(body.has(k), false);
});

test('clique novo sem UTMs não recebe a atribuição antiga', async () => {
  const storage = new Map();
  pagina(marcada, storage);
  const body = await pagina(base + '?fbclid=clique_novo', storage).enviar();
  for (const k of Object.keys(campos)) assert.equal(body.has(k), false);
});

test('sem o asset de origem usa a URL atual', async () => {
  const body = await pagina(marcada, new Map(), { carregarOrigem: false }).enviar();
  for (const [k, v] of Object.entries(campos)) assert.equal(body.get(k), v);
});

test('objeto de origem inválido usa a URL atual', async () => {
  for (const origemInvalida of [null, [], 'invalida']) {
    const p = pagina(marcada, new Map(), { carregarOrigem: false });
    p.window.FC_ORIGEM = { instalada: true, origem: origemInvalida };
    const body = await p.enviar();
    for (const [k, v] of Object.entries(campos)) assert.equal(body.get(k), v);
  }
});

test('storage bloqueado mantém a URL e não inventa origem na página sem parâmetros', async () => {
  const body = await pagina(marcada, new Map(), { storageBloqueado: true }).enviar();
  for (const [k, v] of Object.entries(campos)) assert.equal(body.get(k), v);
  const sem = await pagina(base, new Map(), { storageBloqueado: true }).enviar();
  for (const k of Object.keys(campos)) assert.equal(sem.has(k), false);
});

test('a origem persistida continua sujeita ao limite de tamanho e ao tipo textual', async () => {
  const p = pagina(base);
  p.window.FC_ORIGEM = { instalada: true, origem: {
    utm_source: {}, utm_medium: ['paid'], utm_campaign: 'a'.repeat(181),
    utm_term: 123456789012345678, utm_content: '0', src: 'a'.repeat(180),
  } };
  const body = await p.enviar();
  for (const k of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term']) assert.equal(body.has(k), false);
  assert.equal(body.get('utm_content'), '0');
  assert.equal(body.get('src'), 'a'.repeat(180));
});

// O Lead sai pelo container: a página empurra `lead_capturado` e a tag
// `Meta — Lead` do GTM-MGQFHR5J fala com a Meta. Chamar `fbq('track','Lead')`
// aqui TAMBÉM contaria o mesmo lead duas vezes.
// Os objetos nascem dentro do contexto vm, com outro protótipo: copiar os campos
// é o que permite compará-los com deepEqual estrito.
const leads = (p) => p.dataLayer
  .filter((e) => e.event === 'lead_capturado')
  .map((e) => ({ ...e }));

test('confirmação única mantém um Lead e nenhum Purchase mesmo com submit repetido', async () => {
  const p = pagina(marcada);
  await p.enviar({ duplo: true });
  assert.deepEqual(leads(p), [{ event: 'lead_capturado', origem: 'folha_aula_ao_vivo' }]);
  assert.deepEqual(p.dataLayer.filter((e) => /purchase/i.test(String(e.event))), []);
  assert.deepEqual(p.events.filter((e) => /lead|purchase/i.test(String(e[1]))), []);
});

test('o Lead NÃO sai duas vezes: nem fbq manual, nem segundo push', async () => {
  const p = pagina(marcada);
  await p.enviar();
  assert.equal(leads(p).length, 1);
  assert.equal(p.events.some((e) => e[0] === 'track' && e[1] === 'Lead'), false);
});

test('resposta sem confirmação não libera evento Lead', async () => {
  const p = pagina(marcada, new Map(), { aceita: false });
  await p.enviar();
  assert.deepEqual(p.events, []);
  assert.deepEqual(leads(p), []);
});

/* Botões de agenda da tela "inscrição feita": enfeite. Os dois destinos vêm prontos
   da agenda.json (`agenda_google` e `ics`, publicados pelo kit); a página só confere
   o formato. Nada do que acontecer ali pode impedir nem repetir o registro da inscrição. */
const semana = {
  data: '2099-01-07', origem: 'aula_ao_vivo_2099_01_07', tema: 'Tema', questoes: 5,
  youtube: 'https://www.youtube.com/live/AAAAAAAAAAA',
  ics: 'assets/aulas/aula-2099-01-07-0a1b2c3d.ics',
  agenda_google: 'https://calendar.google.com/calendar/render?action=TEMPLATE&text=Aula+ao+vivo%3A+Tema'
    + '&dates=20990107T230000Z%2F20990108T010000Z',
};
const visiveis = (p) => ({
  bloco: !p.el('cap-agenda').hidden, google: !p.el('cap-agenda-google').hidden, ics: !p.el('cap-agenda-ics').hidden,
});

test('com aula e link na semana, os dois botões aparecem com destino e o Lead sai uma vez', async () => {
  const p = pagina(base, new Map(), { aulas: [semana] });
  await p.enviar();
  assert.deepEqual(visiveis(p), { bloco: true, google: true, ics: true });
  assert.equal(p.el('cap-agenda-google').href, semana.agenda_google);
  assert.equal(p.el('cap-agenda-ics').href, semana.ics);
  // sem `download`: no iPhone o link direto abre "Adicionar ao Calendário"
  assert.equal('download' in p.el('cap-agenda-ics').attrs, false);
  assert.equal(leads(p).length, 1);
});

test('semana sem link da transmissão não oferece agenda, mesmo com os campos preenchidos', async () => {
  const p = pagina(base, new Map(), { aulas: [{ ...semana, youtube: null }] });
  await p.enviar();
  assert.deepEqual(visiveis(p), { bloco: false, google: false, ics: false });
  assert.equal(leads(p).length, 1);
});

test('com um destino só, aparece só ele; sem nenhum, o bloco some', async () => {
  const casos = [
    [{ ics: null }, { bloco: true, google: true, ics: false }],
    [{ agenda_google: null }, { bloco: true, google: false, ics: true }],
    [{ ics: null, agenda_google: null }, { bloco: false, google: false, ics: false }],
  ];
  for (const [falta, esperado] of casos) {
    const p = pagina(base, new Map(), { aulas: [{ ...semana, ...falta }] });
    await p.enviar();
    assert.deepEqual(visiveis(p), esperado, JSON.stringify(falta));
    assert.equal(leads(p).length, 1);
  }
});

test('destino fora do padrão do kit não vira link', async () => {
  for (const ics of ['data:text/calendar,x', 'https://exemplo.invalid/a.ics', '../a.ics', 'assets/aulas/../../a.ics']) {
    const p = pagina(base, new Map(), { aulas: [{ ...semana, ics }] });
    await p.enviar();
    assert.equal(p.el('cap-agenda-ics').hidden, true, ics);
  }
  for (const agenda_google of [
    'javascript:alert(1)',
    'http://calendar.google.com/calendar/render?action=TEMPLATE',
    'https://calendar.google.com.exemplo.invalid/calendar/render?action=TEMPLATE',
    'https://calendar.google.com/calendar/render?action=TEMPLATE" onclick="x',
    'https://exemplo.invalid/?https://calendar.google.com/calendar/render?action=TEMPLATE',
  ]) {
    const p = pagina(base, new Map(), { aulas: [{ ...semana, agenda_google }] });
    await p.enviar();
    assert.equal(p.el('cap-agenda-google').hidden, true, agenda_google);
  }
});

test('erro ao montar a agenda não impede nem duplica a inscrição', async () => {
  const p = pagina(base, new Map(), {
    aulas: [semana],
    antes: (el) => Object.defineProperty(el('cap-agenda-google'), 'href', { set() { throw new Error('quebrou'); } }),
  });
  await p.enviar();
  assert.equal(p.el('cap-ok').hidden, false);
  assert.equal(leads(p).length, 1);
});

test('quem volta já inscrito vê a agenda sem reenviar o e-mail nem contar outro Lead', async () => {
  const p = pagina(base, new Map(), { aulas: [semana], jaInscrito: true });
  await p.esperar();
  assert.deepEqual(visiveis(p), { bloco: true, google: true, ics: true });
  assert.equal(p.requests.length, 0);
  assert.deepEqual(leads(p), []);
});

/* O contrato com o kit, pela ponta de quem recebe: a semana que está publicada na
   agenda.json tem de passar nas travas da página. A data vai para 2099 só para a
   página tratá-la como aula futura. */
test('a semana publicada pelo kit passa nas travas da página', async () => {
  const agenda = JSON.parse(readFileSync(new URL('../assets/aulas/agenda.json', import.meta.url), 'utf8'));
  const publicadas = agenda.aulas.filter((a) => a.ics && a.agenda_google);
  assert.ok(publicadas.length >= 1, 'nenhuma semana com agenda publicada');
  for (const a of publicadas) {
    const p = pagina(base, new Map(), { aulas: [{ ...a, data: '2099-01-07' }] });
    await p.enviar();
    assert.deepEqual(visiveis(p), { bloco: true, google: true, ics: true }, a.data);
    assert.equal(p.el('cap-agenda-google').href, a.agenda_google);
    assert.equal(p.el('cap-agenda-ics').href, a.ics);
  }
});
