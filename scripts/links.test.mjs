import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

/* links.html é a página do link da bio. O que se confere aqui é o que decide a
   atribuição da venda: todo link sai com a etiqueta de bio e o nome do botão, o
   visitante da bio não cai no teste A/B de tráfego pago, e os dois arquivos que
   mudam toda semana (agenda.json e links.json) nunca deixam a página apontar
   para um arquivo que não existe. */
const raiz = new URL('../', import.meta.url);
const html = readFileSync(new URL('links.html', raiz), 'utf8');
const origemJs = readFileSync(new URL('assets/origem.js', raiz), 'utf8');
const agendaReal = JSON.parse(readFileSync(new URL('assets/aulas/agenda.json', raiz), 'utf8'));
const linksReal = JSON.parse(readFileSync(new URL('assets/links/links.json', raiz), 'utf8'));

const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
  .map((m) => m[1]).filter((s) => s.includes('window.FC_LINKS'));
assert.equal(scripts.length, 1);

// O DOM não é montado: `readyState: 'loading'` deixa a página esperando o
// DOMContentLoaded, que aqui nunca chega. Só as regras são exercitadas.
function pagina(endereco = 'https://fluenciacontabil.com.br/links') {
  const window = { location: new URL(endereco), dataLayer: [] };
  const ctx = vm.createContext({
    window, location: window.location, URL, URLSearchParams, Date,
    document: { readyState: 'loading', addEventListener() {} },
  });
  vm.runInContext(scripts[0], ctx);
  return window.FC_LINKS;
}
const L = pagina();
// Objetos criados dentro do vm têm outro Object.prototype; a cópia compara só os valores.
const copia = (o) => JSON.parse(JSON.stringify(o));
// Mesma razão: `.map` numa lista do vm devolve lista do vm. Array.from traz para cá.
const campo = (itens, nome) => Array.from(itens, (n) => n[nome]);

const BASE = 'https://fluenciacontabil.com.br/links';
const CASA = ['fluenciacontabil.com.br', 'dicionario.fluenciacontabil.com.br'];
const PADRAO = { src: 'bio', utm_source: 'instagram', utm_medium: 'bio', utm_campaign: 'bio-links' };
const ETIQUETAS = ['src', 'sck', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'fbclid', 'gclid'];
const ancoras = [...html.matchAll(/<a\b[^>]*>/g)].map((m) => {
  const atributo = (nome) => (m[0].match(new RegExp(`\\b${nome}="([^"]*)"`)) || [])[1];
  return { tag: m[0], bio: atributo('data-bio'), url: new URL((atributo('href') || '').replaceAll('&amp;', '&'), BASE) };
});

test('todo link tem nome de botão, e os da casa já saem do HTML com a etiqueta de bio', () => {
  assert.ok(ancoras.length >= 10);
  const nomes = ancoras.map((a) => a.bio);
  for (const a of ancoras) assert.match(a.bio || '', /^[a-z0-9][a-z0-9._-]{0,39}$/, a.tag);
  assert.equal(new Set(nomes).size, nomes.length, 'nome de botão repetido');
  for (const a of ancoras) {
    const p = a.url.searchParams;
    if (CASA.includes(a.url.hostname)) {
      for (const [k, v] of Object.entries(PADRAO)) assert.equal(p.get(k), v, `${a.bio}: ${k}`);
      assert.equal(p.get('utm_content'), a.bio, `${a.bio}: utm_content`);
      assert.equal(p.get('fbclid'), null);
      assert.equal(p.get('gclid'), null);
    } else {
      for (const k of ETIQUETAS) assert.equal(p.get(k), null, `${a.bio}: ${k} em destino que não lê etiqueta`);
    }
  }
});

test('a página não vende direto e o WhatsApp é o de atendimento', () => {
  assert.equal(html.includes('pay.kiwify'), false);
  const zap = ancoras.filter((a) => a.url.hostname === 'wa.me');
  assert.equal(zap.length, 1);
  assert.equal(zap[0].url.pathname, '/5521959042832');
  assert.match(zap[0].url.searchParams.get('text'), /link da bio/);
  assert.equal(html.includes('1152399211'), false, 'número de disparo em massa não aparece em página pública');
});

test('visitante sem etiqueta sai como bio, com o nome do botão', () => {
  assert.deepEqual(copia(L.etiqueta({}, 'assinatura')), { ...PADRAO, utm_content: 'assinatura' });
  assert.deepEqual(copia(L.etiqueta(undefined, 'cursos')), { ...PADRAO, utm_content: 'cursos' });
});

test('o fbclid que o Instagram põe no link da bio não segue adiante', () => {
  // assinatura.html sorteia para o teste A/B quem chega com fbclid: é a marca de anúncio pago.
  const t = copia(L.etiqueta({ fbclid: 'PAZ_sintetico', fbclidEm: 1788955200000 }, 'assinatura'));
  assert.deepEqual(t, { ...PADRAO, utm_content: 'assinatura' });
});

test('outra rede troca só o que informou; campanha e src nunca ficam vazios', () => {
  assert.deepEqual(copia(L.etiqueta({ utm_source: 'youtube' }, 'blog')), { ...PADRAO, utm_source: 'youtube', utm_content: 'blog' });
  assert.deepEqual(copia(L.etiqueta({ utm_medium: 'story' }, 'live')), { ...PADRAO, utm_medium: 'story', utm_content: 'live' });
});

test('quem chegou de anúncio mantém a etiqueta do anúncio e ganha o botão', () => {
  const anuncio = { utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'pos_janela_2026', src: 'r2-debito', utm_term: 'criativo', utm_content: 'video-1', fbclid: 'clique_sintetico', fbclidEm: 1788955200000 };
  assert.deepEqual(copia(L.etiqueta(anuncio, 'assinatura')), {
    src: 'r2-debito', utm_source: 'facebook', utm_medium: 'cpc', utm_campaign: 'pos_janela_2026',
    utm_term: 'criativo', fbclid: 'clique_sintetico', utm_content: 'assinatura',
  });
});

test('marcar só mexe em página da casa, troca etiqueta velha e preserva a âncora', () => {
  assert.equal(L.marcar('https://www.youtube.com/@prof.viniciusferraz', {}, 'youtube'), 'https://www.youtube.com/@prof.viniciusferraz');
  assert.equal(L.marcar('https://portal.fluenciacontabil.com.br/', {}, 'aluno'), 'https://portal.fluenciacontabil.com.br/');
  const u = new URL(L.marcar('https://fluenciacontabil.com.br/cursos.html?utm_content=velho&fbclid=velho#assinar', {}, 'cursos'));
  assert.equal(u.pathname + u.hash, '/cursos.html#assinar');
  assert.deepEqual(Object.fromEntries(u.searchParams), { ...PADRAO, utm_content: 'cursos' });
  const d = new URL(L.marcar('https://dicionario.fluenciacontabil.com.br/', { utm_source: 'tiktok' }, 'dicionario'));
  assert.equal(d.searchParams.get('utm_source'), 'tiktok');
  assert.equal(d.searchParams.get('utm_campaign'), 'bio-links');
  // Na prévia do Netlify o artigo da lista de novidades é do próprio endereço: etiqueta igual à do site.
  const previa = pagina('https://deploy-preview-1--sintetico.netlify.app/links');
  const artigo = new URL(previa.marcar('https://deploy-preview-1--sintetico.netlify.app/blog/a.html', {}, 'artigo-a'));
  assert.deepEqual(Object.fromEntries(artigo.searchParams), { ...PADRAO, utm_content: 'artigo-a' });
  assert.equal(previa.marcar('https://outro.example/blog/a.html', {}, 'artigo-a'), 'https://outro.example/blog/a.html');
});

test('a venda chega ao checkout como bio, com o botão em utm_term, e fora do teste A/B', () => {
  const entrada = ancoras.find((a) => a.bio === 'assinatura').url;
  assert.equal(entrada.pathname, '/assinatura.html');
  assert.equal(entrada.searchParams.get('utm_medium') === 'cpc' || entrada.searchParams.has('fbclid') || entrada.searchParams.has('gclid'), false);
  // O origem.js real, na página de venda, com o botão já etiquetado pela campanha paga.
  const botao = { href: 'https://pay.kiwify.com.br/oferta-sintetica?utm_source=site&utm_campaign=pos_janela_2026&utm_content=semestral', getAttribute: () => null };
  const window = { location: entrada, dataLayer: [] };
  vm.runInContext(origemJs, vm.createContext({
    window, URL, URLSearchParams, Date,
    document: { cookie: '', readyState: 'complete', querySelectorAll: () => [botao], addEventListener() {} },
    sessionStorage: { getItem: () => null, setItem() {} },
    setInterval: () => 1, clearInterval() {},
  }));
  const p = new URL(botao.href).searchParams;
  for (const [k, v] of Object.entries(PADRAO)) assert.equal(p.get(k), v, k);
  assert.equal(p.get('utm_content'), 'semestral', 'o produto do botão não muda');
  assert.equal(p.get('utm_term'), 'assinatura', 'o botão da bio desce para utm_term');
});

const aula = (data, extra = {}) => ({
  data, titulo: `Tema de ${data}: as <em>3 regras</em> de prova.`, pdf: 'assets/aulas/folha.pdf',
  capa_webp: 'assets/aulas/capa.webp', capa_jpg: 'assets/aulas/capa.jpg', youtube: `https://www.youtube.com/live/${data}`, ...extra,
});
const agenda = { aulas: [aula('2026-09-30'), aula('2026-10-07'), aula('2026-10-14')] };

test('a próxima aula vira o destaque e a última já dada vira gravação', () => {
  const m = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 12, 10, 0));
  assert.deepEqual(copia(m.destaque), {
    kicker: 'Ao vivo · qua, 14/10 · 20h', titulo: 'Tema de 2026-10-14: as 3 regras de prova',
    cta: 'Pegar o caderno de questões', capa_webp: 'assets/aulas/capa.webp', capa_jpg: 'assets/aulas/capa.jpg',
  });
  assert.equal(m.novidades.length, 1);
  assert.equal(m.novidades[0].id, 'gravacao');
  assert.equal(m.novidades[0].kicker, 'Gravação · live de 07/10');
  assert.equal(m.novidades[0].url, 'https://www.youtube.com/live/2026-10-07');
});

test('no dia da aula o destaque diz hoje; duas horas depois do início ela vira gravação', () => {
  const durante = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 14, 21, 30));
  assert.equal(durante.destaque.kicker, 'Ao vivo · hoje, 20h');
  const depois = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 14, 22, 0));
  assert.equal(depois.destaque, null);
  assert.equal(depois.novidades[0].kicker, 'Gravação · live de 14/10');
});

test('aula sem caderno publicado não promete caderno; sem agenda a página segue de pé', () => {
  const m = L.montar({ aulas: [aula('2026-10-14', { pdf: '' })] }, { novidades: [] }, new Date(2026, 9, 12, 10, 0));
  assert.equal(m.destaque.cta, 'Ver a aula da semana');
  assert.deepEqual(copia(L.montar(null, null, new Date(2026, 9, 12))), { destaque: null, novidades: [] });
});

test('novidades saem da mais nova para a mais antiga, no máximo cinco, com data e selo de novo', () => {
  const novidades = [
    { id: 'artigo-velho', tipo: 'artigo', data: '2026-08-01', titulo: 'Artigo antigo', url: 'blog/antigo.html' },
    { id: 'video-novo', tipo: 'video', data: '2026-10-08', titulo: 'Vídeo da semana.', url: 'https://www.youtube.com/watch?v=sintetico', img: 'assets/links/video.webp' },
    { id: 'artigo-novo', tipo: 'artigo', data: '2026-10-09', titulo: 'Artigo da semana', url: 'blog/novo.html' },
    { id: 'video-estreia', tipo: 'video', data: '2026-10-15T19:00', titulo: 'Vídeo que estreia', url: 'https://www.youtube.com/watch?v=estreia' },
    { id: 'video-meia', tipo: 'video', data: '2026-10-16T19:30', titulo: 'Estreia na meia hora', url: 'https://www.youtube.com/watch?v=meia' },
    { id: 'artigo-set', tipo: 'artigo', data: '2026-09-29', titulo: 'Artigo de setembro', url: 'blog/setembro.html' },
  ];
  const m = L.montar(agenda, { novidades }, new Date(2026, 9, 12, 10, 0));
  assert.deepEqual(campo(m.novidades, 'id'), ['video-meia', 'video-estreia', 'artigo-novo', 'video-novo', 'gravacao']);
  assert.deepEqual(campo(m.novidades, 'kicker'), [
    'Vídeo novo · estreia sex, 16/10, 19h30', 'Vídeo novo · estreia qui, 15/10, 19h',
    'Artigo novo · 09/10', 'Vídeo novo · 08/10', 'Gravação · live de 07/10',
  ]);
  assert.equal(m.novidades[3].titulo, 'Vídeo da semana');
  assert.equal(m.novidades[3].img, 'assets/links/video.webp');
  const velho = L.montar({ aulas: [] }, { novidades: [novidades[0]] }, new Date(2026, 9, 12, 10, 0));
  assert.equal(velho.novidades[0].kicker, 'Artigo · 01/08');
});

test('item malformado ou com destino estranho fica de fora, sem derrubar os outros', () => {
  const bom = { id: 'artigo-bom', tipo: 'artigo', data: '2026-10-09', titulo: 'Bom', url: 'blog/bom.html' };
  const ruins = [
    null, { ...bom, id: 'Com Espaço' }, { ...bom, id: 'gravacao' }, { ...bom, tipo: 'podcast' }, { ...bom, data: '09/10/2026' },
    { ...bom, titulo: '' }, { ...bom, url: 'javascript:alert(1)' }, { ...bom, url: 'http://sem-https.example/' }, { ...bom, url: '//outro.example/x.html' },
  ];
  const m = L.montar({ aulas: [] }, { novidades: [...ruins, bom, { ...bom, id: 'img-de-fora', img: 'https://outro.example/x.png' }] }, new Date(2026, 9, 12));
  assert.deepEqual(campo(m.novidades, 'id'), ['artigo-bom', 'img-de-fora']);
  assert.equal(m.novidades[1].img, '');
});

test('o que está publicado hoje monta sem erro e aponta para arquivo que existe', () => {
  const fixos = new Set(ancoras.map((a) => a.bio));
  assert.ok(Array.isArray(linksReal.novidades));
  const m = L.montar(agendaReal, linksReal, new Date());
  // Nada do links.json é descartado em silêncio: item inválido tem de falhar aqui, não sumir da página.
  const todos = L.montar({ aulas: [] }, linksReal, new Date(2020, 0, 1));
  assert.equal(todos.novidades.length, Math.min(5, linksReal.novidades.length));
  for (const n of linksReal.novidades) {
    assert.equal(fixos.has(n.id), false, `${n.id}: nome já usado por um botão fixo`);
    assert.ok(n.img, `${n.id}: sem miniatura`);
    assert.ok(existsSync(new URL(n.img, raiz)), `${n.id}: miniatura ${n.img} não existe`);
    if (!/^https:/.test(n.url)) assert.ok(existsSync(new URL(n.url.split('#')[0], raiz)), `${n.id}: ${n.url} não existe`);
  }
  assert.equal(new Set(linksReal.novidades.map((n) => n.id)).size, linksReal.novidades.length);
  for (const n of m.novidades) assert.ok(n.kicker && n.titulo && n.url);
  for (const a of ancoras.filter((x) => x.url.hostname === 'fluenciacontabil.com.br')) {
    assert.ok(existsSync(new URL(a.url.pathname.slice(1) || 'index.html', raiz)), `${a.bio}: ${a.url.pathname} não existe`);
  }
});
