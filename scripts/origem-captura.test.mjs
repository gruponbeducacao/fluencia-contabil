import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const origem = readFileSync(new URL('../assets/origem.js', import.meta.url), 'utf8');
const captura = readFileSync(new URL('../assets/email-capture.js', import.meta.url), 'utf8');
// Expõe somente no ensaio a função real que monta o request dos formulários.
// Nenhuma chamada de rede ou dado real entra no teste.
assert.match(captura, /\}\)\(\);\s*$/);
const capturaInstrumentada = captura.replace(/\}\)\(\);\s*$/, 'globalThis.capturarNoEnsaio = submitEmail;})();');
function pagina(url, storage = new Map(), { carregarOrigem = true, bloqueado = false, local = new Map(), referrer = '' } = {}) {
  const requests = [];
  const window = {
    location: new URL(url),
    dataLayer: [],
    localStorage: {
      getItem: (k) => local.get(k) ?? null,
      setItem(k, v) { local.set(k, String(v)); },
      removeItem(k) { local.delete(k); },
    },
    matchMedia: () => ({ matches: false }),
  };
  const ctx = vm.createContext({
    window, URL, URLSearchParams, Date,
    document: { readyState: 'loading', referrer, cookie: '', addEventListener() {} },
    sessionStorage: {
      getItem(k) { if (bloqueado) throw Error('indisponivel'); return storage.get(k) || null; },
      setItem(k, v) { if (bloqueado) throw Error('indisponivel'); storage.set(k, v); },
    },
    fetch: async (url, opts) => { requests.push({ url, opts }); return {}; },
  });
  if (carregarOrigem) vm.runInContext(origem, ctx);
  vm.runInContext(capturaInstrumentada, ctx);
  return {
    window,
    async enviar() {
      await ctx.capturarNoEnsaio('ensaio@example.invalid', 'blog_newsletter');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].opts.method, 'POST');
      return new URLSearchParams(requests[0].opts.body.toString());
    },
  };
}

test('campanha e anúncio persistem no formulário após navegação interna sem parâmetros', async () => {
  const storage = new Map();
  pagina('https://fluenciacontabil.com.br/?utm_source=meta&utm_medium=paid&utm_campaign=ensaio&utm_content=criativo&utm_term=1234567890123&src=anuncio&fbclid=clique_sintetico', storage);
  const blog = pagina('https://fluenciacontabil.com.br/blog/aula.html', storage);
  const body = await blog.enviar();
  assert.equal(body.get('utm_source'), 'meta');
  assert.equal(body.get('utm_medium'), 'paid');
  assert.equal(body.get('utm_campaign'), 'ensaio');
  assert.equal(body.get('utm_term'), '1234567890123');
  assert.equal(body.get('utm_content'), 'criativo');
  assert.equal(body.get('src'), 'anuncio');
  assert.equal(body.get('pagina'), '/blog/aula.html');
  // Cookies e parâmetros do checkout nunca vão para o formulário.
  for (const campo of ['s1', 's2', '_fbp', '_fbc', 'sck']) assert.equal(body.has(campo), false);
});

test('uma campanha nova não recebe anúncio ou origem da campanha antiga', async () => {
  const storage = new Map();
  pagina('https://fluenciacontabil.com.br/?utm_source=meta&utm_campaign=antiga&utm_term=1234567890123', storage);
  const atual = pagina('https://fluenciacontabil.com.br/?utm_campaign=nova', storage);
  const body = await atual.enviar();
  assert.equal(body.get('utm_campaign'), 'nova');
  assert.equal(body.get('utm_source'), '');
  assert.equal(body.get('utm_term'), '');
});

test('sem o asset de origem continua usando os parâmetros atuais da URL', async () => {
  const body = await pagina('https://fluenciacontabil.com.br/?utm_source=email&utm_campaign=ensaio', new Map(), { carregarOrigem: false }).enviar();
  assert.equal(body.get('utm_source'), 'email');
  assert.equal(body.get('utm_campaign'), 'ensaio');
});

test('storage bloqueado não impede envio nem inventa origem em navegação sem parâmetros', async () => {
  const body = await pagina('https://fluenciacontabil.com.br/blog/aula.html', new Map(), { bloqueado: true }).enviar();
  assert.equal(body.get('email'), 'ensaio@example.invalid');
  assert.equal(body.get('utm_source'), '');
  assert.equal(body.get('utm_campaign'), '');
});

test('objeto inválido de origem usa a URL e não serializa objetos como parâmetros', async () => {
  const p = pagina('https://fluenciacontabil.com.br/?utm_campaign=url', new Map(), { carregarOrigem: false });
  p.window.FC_ORIGEM = { instalada: true, origem: null };
  const body = await p.enviar();
  assert.equal(body.get('utm_campaign'), 'url');
});

const CAMPOS_DO_LEAD = ['pt_source', 'pt_medium', 'pt_campaign', 'pt_content', 'pt_term', 'pt_src',
  'pt_pagina', 'pt_referrer', 'pt_em', 'entrada', 'ut_em', 'fbclid', 'gclid'];

test('o formulário leva primeiro e último toque, id do clique e página de entrada', async () => {
  const storage = new Map(), local = new Map();
  pagina('https://fluenciacontabil.com.br/blog/aula.html?utm_source=meta&utm_medium=cpc&utm_campaign=teste&utm_content=peca&fbclid=abc', storage, { local });
  // Outra sessão, dias depois, vinda do Google: novo último toque.
  pagina('https://fluenciacontabil.com.br/cursos.html', new Map(), { local, referrer: 'https://www.google.com/search?q=curso' });
  const body = await pagina('https://fluenciacontabil.com.br/blog/dre.html', new Map(), { local }).enviar();
  assert.equal(body.get('pt_source'), 'meta');
  assert.equal(body.get('pt_medium'), 'cpc');
  assert.equal(body.get('pt_campaign'), 'teste');
  assert.equal(body.get('pt_content'), 'peca');
  assert.equal(body.get('pt_pagina'), 'fluenciacontabil.com.br/blog/aula.html');
  assert.match(body.get('pt_em'), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  assert.equal(body.get('entrada'), 'fluenciacontabil.com.br/cursos.html');
  assert.equal(body.get('fbclid'), '', 'o último toque (Google) não tem fbclid');
  // Os campos de hoje continuam vindo da sessão, como antes.
  assert.equal(body.get('utm_source'), '');
  assert.equal(body.get('pagina'), '/blog/dre.html');
  for (const k of CAMPOS_DO_LEAD) assert.equal(body.getAll(k).length, 1, k);
});

test('sem o asset de origem o formulário segue igual, sem os campos novos', async () => {
  const body = await pagina('https://fluenciacontabil.com.br/?utm_source=email', new Map(), { carregarOrigem: false }).enviar();
  assert.equal(body.get('utm_source'), 'email');
  for (const k of CAMPOS_DO_LEAD) assert.equal(body.has(k), false, k);
});

test('toda página que posta no Apps Script manda os campos de toque', () => {
  const raiz = new URL('../', import.meta.url);
  const arquivos = execFileSync('git', ['-c', `safe.directory=${fileURLToPath(raiz).replaceAll('\\', '/')}`, 'ls-files', '-z', '*.html'], { cwd: raiz, encoding: 'utf8' }).split('\0').filter(Boolean);
  let conferidas = 0;
  for (const arquivo of arquivos) {
    const html = readFileSync(new URL(arquivo, raiz), 'utf8');
    if (!html.includes('script.google.com/macros')) continue;
    conferidas++;
    assert.ok(/FC_ORIGEM\.(anexarCamposDoLead|contextoDoLead)/.test(html), `${arquivo}: formulário sem os campos de toque`);
    assert.ok(/assets\/origem\.js\?v=/.test(html), `${arquivo}: precisa carregar assets/origem.js`);
  }
  assert.ok(conferidas >= 7);
  assert.match(captura, /FC_ORIGEM\.anexarCamposDoLead\(data\)/);
});

// Reserva da newsletter dos posts: só roda se o email-capture.js não interceptar
// o envio. Executa a função real de cada post com DOM e rede simulados.
function newsletterDoPost(arquivo, { falhaRede = false, local = new Map() } = {}) {
  const html = readFileSync(new URL(`../${arquivo}`, import.meta.url), 'utf8');
  const fonte = html.match(/function subscribeNewsletter\(formEl\) \{[\s\S]*?\n\}\r?\n/);
  assert.ok(fonte, `${arquivo}: subscribeNewsletter não encontrada`);
  const endpoint = fonte[0].match(/fetch\('([^']+)'/)[1];
  const requests = [], inseridos = [], alertas = [];
  const btn = { textContent: 'Inscrever', disabled: false };
  const formEl = {
    innerHTML: '<input><button>', nextElementSibling: null,
    querySelector: (sel) => (sel === 'button' ? btn : { value: ' ensaio@example.invalid ' }),
    parentNode: { insertBefore(no) { inseridos.push(no); } },
  };
  const location = new URL('https://fluenciacontabil.com.br/blog/aula.html?utm_source=email&utm_campaign=news');
  const window = { location, matchMedia: () => ({ matches: true }), localStorage: {
    getItem: (k) => local.get(k) ?? null, setItem(k, v) { local.set(k, String(v)); }, removeItem(k) { local.delete(k); } } };
  const ctx = vm.createContext({
    window, location, URL, URLSearchParams, Date, alert: (m) => alertas.push(m),
    document: {
      readyState: 'loading', referrer: 'https://www.google.com/search?q=x', cookie: '', addEventListener() {},
      createElement: () => ({ style: {}, setAttribute(k, v) { this[k] = v; } }),
    },
    sessionStorage: { getItem: () => null, setItem() {} },
    fetch: (url, opts) => {
      requests.push({ url, body: new URLSearchParams(opts.body.toString()), mode: opts.mode });
      return falhaRede ? Promise.reject(new TypeError('Failed to fetch')) : Promise.resolve({ type: 'opaque' });
    },
  });
  ctx.window.FC_ORIGEM = undefined;
  return {
    endpoint, requests, inseridos, alertas, btn, formEl,
    comOrigem() { vm.runInContext(origem, ctx); return this; },
    async enviar() {
      vm.runInContext(fonte[0] + '\nglobalThis.__enviar = subscribeNewsletter;', ctx);
      ctx.__enviar(formEl);
      await new Promise((r) => setImmediate(r));
      return this;
    },
  };
}

const postsComNewsletter = execFileSync('git', ['ls-files', 'blog.html', 'blog/*.html'], { cwd: new URL('../', import.meta.url), encoding: 'utf8' })
  .split(/\r?\n/).filter((f) => f && readFileSync(new URL(`../${f}`, import.meta.url), 'utf8').includes('function subscribeNewsletter'));

test('newsletter dos posts: mesmo endpoint, contexto completo e toques no corpo', async () => {
  assert.ok(postsComNewsletter.length >= 28);
  for (const arquivo of postsComNewsletter) {
    const n = await newsletterDoPost(arquivo).comOrigem().enviar();
    assert.equal(n.requests.length, 1, arquivo);
    const { url, body, mode } = n.requests[0];
    assert.equal(url, n.endpoint, `${arquivo}: endpoint não pode mudar`);
    assert.equal(mode, 'no-cors');
    assert.equal(body.get('email'), 'ensaio@example.invalid');
    assert.ok(['Blog', 'blog_newsletter'].includes(body.get('origem')), arquivo);
    assert.equal(body.get('utm_source'), 'email', arquivo);
    assert.equal(body.get('utm_campaign'), 'news', arquivo);
    assert.equal(body.get('referrer'), 'https://www.google.com/search?q=x', arquivo);
    assert.equal(body.get('dispositivo'), 'Mobile', arquivo);
    assert.equal(body.get('pt_source'), 'email', arquivo);
    assert.equal(body.get('pt_referrer'), 'www.google.com/search', arquivo);
    assert.equal(body.get('entrada'), 'fluenciacontabil.com.br/blog/aula.html', arquivo);
    for (const k of CAMPOS_DO_LEAD) assert.equal(body.getAll(k).length, 1, `${arquivo}: ${k}`);
    assert.match(n.formEl.innerHTML, /Inscrito com sucesso/, arquivo);
  }
});

test('newsletter dos posts: falha de rede não diz "Inscrito" e pede para tentar de novo', async () => {
  for (const arquivo of postsComNewsletter) {
    const n = await newsletterDoPost(arquivo, { falhaRede: true }).comOrigem().enviar();
    assert.doesNotMatch(n.formEl.innerHTML, /Inscrito/, arquivo);
    assert.equal(n.btn.disabled, false, arquivo);
    assert.equal(n.btn.textContent, 'Inscrever', arquivo);
    assert.equal(n.inseridos.length, 1, arquivo);
    assert.match(n.inseridos[0].textContent, /tente de novo/, arquivo);
    assert.equal(n.inseridos[0].role, 'alert');
  }
});

test('newsletter dos posts sem origem.js ainda manda o contexto da URL', async () => {
  const n = await newsletterDoPost(postsComNewsletter[0]).enviar();
  const { body } = n.requests[0];
  assert.equal(body.get('utm_source'), 'email');
  assert.equal(body.get('pagina'), '/blog/aula.html?utm_source=email&utm_campaign=news');
  assert.equal(body.has('pt_source'), false);
});
