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

// Executa o script completo do formulário e o asset real de origem.
// DOM, armazenamento e rede são simulados; nenhum contato ou pixel é acionado.
function pagina(url = base, storage = new Map(), opcoes = {}) {
  const nodes = new Map(), requests = [], events = [];
  function el(id) {
    if (!nodes.has(id)) nodes.set(id, {
      value: '', hidden: false, disabled: false, listeners: {},
      setAttribute() {}, focus() {}, appendChild() {},
      querySelector: () => el('fechar'), querySelectorAll: () => [],
      addEventListener(event, fn) { this.listeners[event] = fn; },
    });
    return nodes.get(id);
  }
  const window = {
    location: new URL(url), matchMedia: () => ({ matches: false }),
    fbq: (...args) => events.push(args),
  };
  const ctx = vm.createContext({
    window, location: window.location, URL, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout() {},
    localStorage: { getItem: () => null, setItem() {} },
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
        return { ok: true, json: async () => ({ aulas: [] }) };
      }
      assert.equal(new URL(url).hostname, 'script.google.com');
      requests.push({ url, options, body: new URLSearchParams(options.body.toString()) });
      return { ok: true, type: 'cors', json: async () => ({ ok: opcoes.aceita !== false }) };
    },
  });
  if (opcoes.carregarOrigem !== false) vm.runInContext(origem, ctx);
  vm.runInContext(scripts[0], ctx);
  return {
    window, requests, events,
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

test('confirmação única mantém um Lead e nenhum Purchase mesmo com submit repetido', async () => {
  const p = pagina(marcada);
  await p.enviar({ duplo: true });
  assert.deepEqual(p.events.map((e) => e.slice(0, 2)), [['track', 'Lead']]);
});

test('resposta sem confirmação não libera evento Lead', async () => {
  const p = pagina(marcada, new Map(), { aceita: false });
  await p.enviar();
  assert.deepEqual(p.events, []);
});
