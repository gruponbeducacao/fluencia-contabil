import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

/* Operação Receita (/receita-federal): o estado da página sai só da data, no navegador
   (window.__rfb, no <head> da receita-federal.html), com os valores de
   assets/receita-federal/operacao/config.js. Captação até 09/12/2026 20h, ao vivo até 23h,
   e depois venda SÓ com VENDA_LIBERADA = true; sem ela, "espera". */
const raiz = new URL('../', import.meta.url);
const ler = (arq) => readFileSync(new URL(arq, raiz), 'utf8');
const ms = (iso) => Date.parse(iso);
const html = ler('receita-federal.html');
const obrigado = ler('receita-federal-obrigado.html');
const config = ler('assets/receita-federal/operacao/config.js');

function scriptCom(fonte, marca) {
  const s = [...fonte.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).filter((x) => x.includes(marca));
  assert.equal(s.length, 1, `um script com ${marca}`);
  return s[0];
}

function carregar(busca = '') {
  const window = {};
  const ctx = vm.createContext({ window, location: new URL('https://fluenciacontabil.com.br/receita-federal' + busca),
    URLSearchParams, Date, document: { documentElement: { setAttribute() {} } } });
  vm.runInContext(config, ctx);
  vm.runInContext(scriptCom(html, 'window.__rfb='), ctx);
  return window;
}

test('/receita-federal: captação até a live de 09/12, ao vivo até 23h, depois venda só se liberada', () => {
  const { __rfb: R } = carregar();
  const casos = [
    ['2026-11-28T10:00:00-03:00', false, null],
    ['2026-12-09T19:59:59-03:00', true, null],
    ['2026-12-09T20:00:00-03:00', false, 'ao-vivo'],
    ['2026-12-09T22:59:59-03:00', true, 'ao-vivo'],
    ['2026-12-09T23:00:00-03:00', false, 'espera'],
    ['2026-12-09T23:00:00-03:00', true, 'venda'],
    ['2027-01-15T10:00:00-03:00', false, 'espera'],
  ];
  for (const [quando, venda, esperado] of casos) assert.equal(R.estadoEm(ms(quando), venda), esperado, `${quando} venda=${venda}`);
});

test('config: a venda nasce travada e o grupo, quando preenchido, é um convite do WhatsApp', () => {
  const { __OR: C } = carregar();
  assert.equal(C.VENDA_LIBERADA, false, 'a venda só liga com o OK do Vinícius');
  assert.ok(C.GRUPO_URL === '' || /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/.test(C.GRUPO_URL));
  assert.equal(C.LIVE, '2026-12-09T20:00:00-03:00');
});

test('?estado= força o estado para homologar, e só os conhecidos', () => {
  assert.equal(carregar('?estado=venda').__rfb.estado(), 'venda');
  assert.equal(carregar('?estado=ao-vivo').__rfb.estado(), 'ao-vivo');
  assert.equal(carregar('?estado=qualquer').__rfb.estado(), carregar().__rfb.estadoEm(Date.now(), false));
});

test('captura: origem aula_*_whatsapp (Config Aulas), Lead pelo GTM e nada de fbq na página', () => {
  assert.match(html, /ORIGEM_COM_WHATSAPP = 'aula_operacao_receita_2026_whatsapp'/);
  assert.match(html, /event:'lead_capturado'/);
  assert.doesNotMatch(html, /fbq\(/);
  assert.match(html, /location\.href = 'receita-federal-obrigado'/);
});

test('as duas páginas leem a mesma config, com o mesmo cache-buster', () => {
  const v = (f) => (f.match(/operacao\/config\.js\?v=(\d+)/) || [])[1];
  assert.ok(v(html), 'config na página');
  assert.equal(v(html), v(obrigado));
});

test('nome de marca e do órgão não quebram de linha nos títulos', () => {
  for (const fonte of [html, obrigado]) {
    for (const m of fonte.matchAll(/<h1[^>]*>([\s\S]*?)<\/h1>/g)) {
      if (/Receita Federal/.test(m[1])) assert.match(m[1], /<span class="nw">Receita Federal/, m[1]);
    }
  }
});
