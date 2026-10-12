import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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
const feedReal = readFileSync(new URL('blog/feed.xml', raiz), 'utf8');

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

// `v` + data dá 11 caracteres, o tamanho de um id de vídeo do YouTube.
const aula = (data, extra = {}) => ({
  data, titulo: `Tema de ${data}: as <em>3 regras</em> de prova.`, pdf: 'assets/aulas/folha.pdf',
  capa_webp: 'assets/aulas/capa.webp', capa_jpg: 'assets/aulas/capa.jpg', youtube: `https://www.youtube.com/live/v${data}`, ...extra,
});
const agenda = { aulas: [aula('2026-09-30'), aula('2026-10-07'), aula('2026-10-14')] };

test('a próxima aula vira o destaque e a última já dada vira gravação', () => {
  const m = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 12, 10, 0));
  // A imagem do destaque é a miniatura do YouTube: a página só precisa do id do vídeo.
  assert.deepEqual(copia(m.destaque), {
    botao: 'live', kicker: 'Ao vivo · qua, 14/10 · 20h', titulo: 'Tema de 2026-10-14: as 3 regras de prova',
    cta: 'Pegar o caderno de questões', url: 'aula-ao-vivo.html', video: 'v2026-10-14',
  });
  assert.equal(m.novidades.length, 1);
  assert.equal(m.novidades[0].id, 'gravacao');
  assert.equal(m.novidades[0].kicker, 'Gravação · live de 07/10');
  assert.equal(m.novidades[0].url, 'https://www.youtube.com/live/v2026-10-07');
  assert.equal(m.novidades[0].video, 'v2026-10-07');
});

test('no dia da aula o destaque diz hoje; sem aula marcada, o destaque é a gravação da última', () => {
  const durante = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 14, 21, 30));
  assert.equal(durante.destaque.kicker, 'Ao vivo · hoje, 20h');
  // Duas horas depois do início a aula acabou. Enquanto o kit não publica a próxima,
  // a faixa do destaque mostra a gravação, que então sai da lista para não repetir.
  const depois = L.montar(agenda, { novidades: [] }, new Date(2026, 9, 14, 22, 0));
  assert.deepEqual(copia(depois.destaque), {
    botao: 'gravacao', kicker: 'Gravação · live de 14/10', titulo: 'Tema de 2026-10-14: as 3 regras de prova',
    cta: 'Assistir à gravação', url: 'https://www.youtube.com/live/v2026-10-14', video: 'v2026-10-14',
  });
  assert.deepEqual(campo(depois.novidades, 'id'), []);
});

test('o id do vídeo sai de qualquer formato de endereço do YouTube, e só dele', () => {
  for (const url of ['https://www.youtube.com/live/BO3dhLv8Uoc', 'https://youtu.be/BO3dhLv8Uoc', 'https://www.youtube.com/watch?v=BO3dhLv8Uoc&t=30s',
    'https://www.youtube.com/watch?feature=share&v=BO3dhLv8Uoc', 'https://youtube.com/shorts/BO3dhLv8Uoc', 'https://www.youtube.com/live/BO3dhLv8Uoc?si=abc']) {
    assert.equal(L.video(url), 'BO3dhLv8Uoc', url);
  }
  for (const url of ['', null, 'blog/artigo.html', 'https://www.youtube.com/@prof.viniciusferraz', 'https://outro.example/live/BO3dhLv8Uoc',
    'https://www.youtube.com/live/curto', 'https://www.youtube.com/live/BO3dhLv8Uoc_longo']) {
    assert.equal(L.video(url), '', String(url));
  }
});

test('aula sem caderno publicado não promete caderno; sem agenda a página segue de pé', () => {
  const m = L.montar({ aulas: [aula('2026-10-14', { pdf: '' })] }, { novidades: [] }, new Date(2026, 9, 12, 10, 0));
  assert.equal(m.destaque.cta, 'Ver a aula da semana');
  const semYoutube = L.montar({ aulas: [aula('2026-10-14', { youtube: '' })] }, { novidades: [] }, new Date(2026, 9, 12, 10, 0));
  assert.equal(semYoutube.destaque.video, '', 'sem endereço no YouTube, o destaque fica só com a faixa da marca');
  assert.deepEqual(copia(L.montar(null, null, new Date(2026, 9, 12))), { destaque: null, novidades: [] });
});

// Artigo como o feed do blog entrega: o pubDate do gerador é meia-noite de Brasília (03:00 GMT).
const artigo = (slug, titulo, mes, dia) => ({ slug, titulo, d: new Date(Date.UTC(2026, mes - 1, dia, 3)), dia: `${String(dia).padStart(2, '0')}/${String(mes).padStart(2, '0')}` });

test('novidades: os dois vídeos e os dois artigos mais recentes, mais a gravação, da mais nova para a mais antiga', () => {
  const novidades = [
    { id: 'video-setembro', tipo: 'video', data: '2026-09-24', titulo: 'Vídeo de setembro', url: 'https://www.youtube.com/watch?v=setembro_12' },
    { id: 'video-semana', tipo: 'video', data: '2026-10-08', titulo: 'Vídeo da semana.', url: 'https://www.youtube.com/watch?v=semana_1234', img: 'assets/links/video.webp' },
    { id: 'video-outubro', tipo: 'video', data: '2026-10-01', titulo: 'Vídeo de outubro', url: 'https://www.youtube.com/watch?v=outubro_123' },
  ];
  // O feed já vem do mais novo para o mais antigo; o terceiro artigo e o terceiro vídeo ficam de fora.
  const artigos = [artigo('cgu-2026', 'Artigo da semana', 10, 9), artigo('recurso-cfc', 'Artigo de setembro', 9, 29), artigo('dva', 'Artigo de agosto', 8, 1)];
  const m = L.montar(agenda, { novidades }, new Date(2026, 9, 12, 10, 0), artigos);
  assert.deepEqual(campo(m.novidades, 'id'), ['artigo-cgu-2026', 'video-semana', 'gravacao', 'video-outubro', 'artigo-recurso-cfc']);
  assert.deepEqual(campo(m.novidades, 'kicker'), [
    'Artigo novo · 09/10', 'Vídeo novo · 08/10', 'Gravação · live de 07/10', 'Vídeo · 01/10', 'Artigo · 29/09',
  ]);
  assert.equal(m.novidades[0].url, 'blog/cgu-2026.html');
  assert.equal(m.novidades[0].img, 'blog/imgs/share/cgu-2026-og.jpg', 'a miniatura do artigo é a imagem de compartilhamento do próprio post');
  assert.equal(m.novidades[0].video, '', 'artigo não tem vídeo');
  assert.equal(m.novidades[1].titulo, 'Vídeo da semana');
  assert.equal(m.novidades[1].img, 'assets/links/video.webp');
  assert.equal(m.novidades[3].video, 'outubro_123', 'vídeo sem arquivo de miniatura usa a do YouTube');
});

test('vídeo com data futura só aparece na hora marcada; marcado como estreia, aparece antes', () => {
  // É o que deixa o PR do vídeo ser mesclado na véspera: link de vídeo agendado ainda é privado.
  const quinta = { id: 'video-quinta', tipo: 'video', data: '2026-10-15T19:00', titulo: 'Vídeo de quinta', url: 'https://www.youtube.com/watch?v=quinta_1234' };
  const antes = L.montar({ aulas: [] }, { novidades: [quinta] }, new Date(2026, 9, 15, 18, 59));
  assert.deepEqual(campo(antes.novidades, 'id'), []);
  const naHora = L.montar({ aulas: [] }, { novidades: [quinta] }, new Date(2026, 9, 15, 19, 0));
  assert.deepEqual(campo(naHora.novidades, 'kicker'), ['Vídeo novo · 15/10']);
  const estreias = [{ ...quinta, estreia: true }, { ...quinta, id: 'video-sexta', data: '2026-10-16T19:30', estreia: true }];
  const comEstreia = L.montar({ aulas: [] }, { novidades: estreias }, new Date(2026, 9, 14, 12, 0));
  assert.deepEqual(campo(comEstreia.novidades, 'kicker'), ['Vídeo novo · estreia sex, 16/10, 19h30', 'Vídeo novo · estreia qui, 15/10, 19h']);
});

test('artigo posto à mão no links.json vale no lugar do mesmo artigo vindo do feed', () => {
  const manual = { id: 'artigo-especial', tipo: 'artigo', data: '2026-10-09', titulo: 'Título escolhido à mão', url: 'blog/cgu-2026.html', img: 'assets/links/especial.webp' };
  const m = L.montar({ aulas: [] }, { novidades: [manual] }, new Date(2026, 9, 12, 10, 0), [artigo('cgu-2026', 'Título do feed', 10, 9), artigo('recurso-cfc', 'Outro artigo', 9, 29)]);
  assert.deepEqual(campo(m.novidades, 'id'), ['artigo-especial', 'artigo-recurso-cfc']);
  assert.equal(m.novidades[0].titulo, 'Título escolhido à mão');
  const antigo = L.montar({ aulas: [] }, { novidades: [] }, new Date(2026, 9, 12, 10, 0), [artigo('dva', 'Artigo de agosto', 8, 1)]);
  assert.equal(antigo.novidades[0].kicker, 'Artigo · 01/08');
});

test('o feed do blog vira lista de artigos, só com endereço do próprio blog', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel>
    <title>Blog</title><link>https://fluenciacontabil.com.br/blog.html</link><pubDate>Fri, 09 Oct 2026 03:00:00 GMT</pubDate>
    <item><title>Sal&#225;rio &amp; corte: R$ 20 mil &lt;por m&#xEA;s&gt; &quot;real&quot; &amp;amp; sem dupla troca</title>
      <link>https://fluenciacontabil.com.br/blog/cgu-2026-contabilidade</link><pubDate>Fri, 09 Oct 2026 03:00:00 GMT</pubDate></item>
    <item><title>Com extensão</title><link>https://fluenciacontabil.com.br/blog/outro-post.html</link><pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate></item>
    <item><title>De outro site</title><link>https://outro.example/blog/x</link><pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate></item>
    <item><title>Fora da pasta do blog</title><link>https://fluenciacontabil.com.br/cursos</link><pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate></item>
    <item><title>Sem data</title><link>https://fluenciacontabil.com.br/blog/sem-data</link></item>
    <item><title></title><link>https://fluenciacontabil.com.br/blog/sem-titulo</link><pubDate>Tue, 29 Sep 2026 03:00:00 GMT</pubDate></item>
  </channel></rss>`;
  const lidos = L.feed(xml);
  assert.deepEqual(Array.from(lidos, (a) => [a.slug, a.titulo, a.dia]), [
    ['cgu-2026-contabilidade', 'Salário & corte: R$ 20 mil <por mês> "real" &amp; sem dupla troca', '09/10'],
    ['outro-post', 'Com extensão', '29/09'],
  ]);
  assert.equal(lidos[0].d.getTime(), Date.UTC(2026, 9, 9, 3));
  for (const vazio of ['', null, undefined, '<html>página de erro</html>']) assert.deepEqual(copia(L.feed(vazio)), []);
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

test('o comando da rotina grava um vídeo que a página aceita, sem duplicar', () => {
  const python = process.env.PYTHON || (process.platform === 'win32' ? 'python' : 'python3');
  const arquivo = path.join(mkdtempSync(path.join(tmpdir(), 'links-')), 'links.json');
  writeFileSync(arquivo, JSON.stringify({ versao: 1, leiame: 'fica como está', novidades: [] }));
  const rodar = (...args) => spawnSync(python, [fileURLToPath(new URL('scripts/links_video.py', raiz)), ...args, '--arquivo', arquivo], { encoding: 'utf8' });
  const url = 'https://youtu.be/quinta_1234';
  let r = rodar(url, '--titulo', '  Balanço e DRE:   a ponte  ', '--data', '2026-10-15T19:00');
  assert.equal(r.status, 0, r.stderr);
  // O mesmo vídeo de novo, por outro formato de endereço: corrige o item, não cria outro.
  r = rodar('https://www.youtube.com/watch?v=quinta_1234', '--titulo', 'Balanço e DRE: a ponte pelo lucro', '--data', '2026-10-15T19:00', '--estreia');
  assert.equal(r.status, 0, r.stderr);
  const cru = readFileSync(arquivo, 'utf8');
  assert.equal(cru.includes('\r'), false, 'fim de linha LF, mesmo no Windows');
  const gravado = JSON.parse(cru);
  assert.deepEqual(gravado, { versao: 1, leiame: 'fica como está', novidades: [
    { id: 'video-2026-10-15', tipo: 'video', data: '2026-10-15T19:00', titulo: 'Balanço e DRE: a ponte pelo lucro', url: 'https://www.youtube.com/watch?v=quinta_1234', estreia: true },
  ] });
  // O que o comando grava é o que a página mostra: as duas regras não podem divergir.
  const m = L.montar({ aulas: [] }, gravado, new Date(2026, 9, 14, 12, 0));
  assert.deepEqual(campo(m.novidades, 'kicker'), ['Vídeo novo · estreia qui, 15/10, 19h']);
  assert.equal(m.novidades[0].video, 'quinta_1234');
  const recusados = [
    ['https://www.youtube.com/@prof.viniciusferraz', '--titulo', 'canal não é vídeo'],
    [url, '--titulo', 'data errada', '--data', '15/10/2026'],
    [url, '--titulo', '   '],
    ['https://youtu.be/outro_12345', '--titulo', 'outro vídeo com o mesmo nome', '--id', 'video-2026-10-15'],
  ];
  for (const ruim of recusados) assert.equal(rodar(...ruim).status, 1, ruim.join(' '));
  assert.equal(readFileSync(arquivo, 'utf8'), cru, 'comando recusado não toca no arquivo');
});

test('o que está publicado hoje monta sem erro e aponta para arquivo que existe', () => {
  const fixos = new Set(ancoras.map((a) => a.bio));
  assert.ok(Array.isArray(linksReal.novidades));
  const artigosReais = L.feed(feedReal);
  assert.ok(artigosReais.length >= 2, 'o feed do blog tem de ser legível pela página');
  for (const a of artigosReais) assert.ok(existsSync(new URL(`blog/${a.slug}.html`, raiz)), `feed aponta para blog/${a.slug}.html, que não existe`);
  const m = L.montar(agendaReal, linksReal, new Date(), artigosReais);
  // Nada do links.json é descartado em silêncio: item inválido tem de falhar aqui, não sumir da página.
  // Com o relógio lá na frente nenhum item está no futuro; sobram os dois mais recentes de cada tipo.
  const todos = L.montar({ aulas: [] }, linksReal, new Date(2100, 0, 1));
  const doTipo = (tipo) => Math.min(2, linksReal.novidades.filter((n) => n.tipo === tipo).length);
  assert.equal(todos.novidades.length, doTipo('video') + doTipo('artigo'));
  for (const n of linksReal.novidades) {
    assert.equal(fixos.has(n.id), false, `${n.id}: nome já usado por um botão fixo`);
    // Vídeo do YouTube dispensa arquivo: a página busca a miniatura lá. Artigo precisa da sua.
    assert.ok(n.img || L.video(n.url), `${n.id}: sem miniatura`);
    if (n.img) assert.ok(existsSync(new URL(n.img, raiz)), `${n.id}: miniatura ${n.img} não existe`);
    if (!/^https:/.test(n.url)) assert.ok(existsSync(new URL(n.url.split('#')[0], raiz)), `${n.id}: ${n.url} não existe`);
  }
  assert.equal(new Set(linksReal.novidades.map((n) => n.id)).size, linksReal.novidades.length);
  for (const n of m.novidades) assert.ok(n.kicker && n.titulo && n.url);
  for (const a of ancoras.filter((x) => x.url.hostname === 'fluenciacontabil.com.br')) {
    assert.ok(existsSync(new URL(a.url.pathname.slice(1) || 'index.html', raiz)), `${a.bio}: ${a.url.pathname} não existe`);
  }
});
