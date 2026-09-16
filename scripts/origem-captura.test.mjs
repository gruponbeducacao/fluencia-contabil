import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const origem = readFileSync(new URL('../assets/origem.js', import.meta.url), 'utf8');
const captura = readFileSync(new URL('../assets/email-capture.js', import.meta.url), 'utf8');
// Expõe somente no ensaio a função real que monta o request dos formulários.
// Nenhuma chamada de rede ou dado real entra no teste.
assert.match(captura, /\}\)\(\);\s*$/);
const capturaInstrumentada = captura.replace(/\}\)\(\);\s*$/, 'globalThis.capturarNoEnsaio = submitEmail;})();');
function pagina(url, storage = new Map(), { carregarOrigem = true, bloqueado = false } = {}) {
  const requests = [];
  const window = {
    location: new URL(url),
    dataLayer: [],
    localStorage: { getItem: () => null, setItem() {} },
    matchMedia: () => ({ matches: false }),
  };
  const ctx = vm.createContext({
    window, URL, URLSearchParams, Date,
    document: { readyState: 'loading', referrer: '', cookie: '', addEventListener() {} },
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
  for (const campo of ['fbclid', 'gclid', 's1', 's2', '_fbp', '_fbc']) assert.equal(body.has(campo), false);
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
