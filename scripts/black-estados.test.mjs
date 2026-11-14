import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

/* A Black da Fluência troca de cara só pela data, no navegador: o estado da /black
   (window.__black, no <head> da black.html), a fase do tema do site inteiro
   (faseEm, em assets/black/tema-black.js) e a sub-fase 2a das páginas de parceiros
   (window.__of.sub ou window.__cond.sub, no <head> de cada uma). Segunda chance (decisão de 14/11/2026):
   lista até 25/11 20h, ao vivo, condição da noite às 20h50, carrinho em 26 e 27/11,
   encerrado em 28/11; parceiros com a vitalícia de R$ 537 até 27/11, 23h59. */
const raiz = new URL('../', import.meta.url);
const ler = (arq) => readFileSync(new URL(arq, raiz), 'utf8');
const ms = (iso) => Date.parse(iso);

function scriptCom(html, marca) {
  const s = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((m) => m[1]).filter((x) => x.includes(marca));
  assert.equal(s.length, 1, `um script com ${marca}`);
  return s[0];
}

// Date com relógio parado, para as funções que leem Date.now() sozinhas.
function relogioEm(t) {
  return class extends Date {
    constructor(...a) { if (a.length) super(...a); else super(t); }
    static now() { return t; }
  };
}

const black = ler('black.html');
const obrigado = ler('black-obrigado.html');
const tema = ler('assets/black/tema-black.js');
const PARCEIROS = ['only-fiscais', 'fiscal-de-resenha', 'evoluiu', 'guruja'];

function estadoDaBlack() {
  const window = {};
  const ctx = vm.createContext({ window, location: new URL('https://fluenciacontabil.com.br/black'), URLSearchParams, Date,
    document: { documentElement: { setAttribute() {} } } });
  vm.runInContext(scriptCom(black, 'window.__black='), ctx);
  return window.__black;
}

test('/black: lista até a live de 25/11 e os estados da noite, do carrinho e do fim', () => {
  const B = estadoDaBlack();
  const casos = [
    ['2026-11-14T10:00:00-03:00', null],
    ['2026-11-25T19:59:59-03:00', null],
    ['2026-11-25T20:00:00-03:00', 'ao-vivo'],
    ['2026-11-25T20:49:59-03:00', 'ao-vivo'],
    ['2026-11-25T20:50:00-03:00', 'condicao'],
    ['2026-11-25T23:59:59-03:00', 'condicao'],
    ['2026-11-26T00:00:00-03:00', 'carrinho'],
    ['2026-11-27T23:59:59-03:00', 'carrinho'],
    ['2026-11-28T00:00:00-03:00', 'encerrado'],
  ];
  for (const [quando, esperado] of casos) assert.equal(B.estadoEm(ms(quando)), esperado, quando);
});

test('tema do site: vendas fechadas desde a virada até 25/11 20h, condição até 27/11, desligado em 28/11', () => {
  const window = {};
  const ctx = vm.createContext({ window, location: { search: '', hash: '', replace() {} }, Date,
    document: { currentScript: { getAttribute: () => 'redirecionar' } } });
  vm.runInContext(tema, ctx);
  const fase = window.__temaBlackFase;
  const casos = [
    ['2026-11-14T00:00:00-03:00', 'fechado'],
    ['2026-11-20T12:00:00-03:00', 'fechado'],
    ['2026-11-25T19:59:59-03:00', 'fechado'],
    ['2026-11-25T20:00:00-03:00', 'condicao'],
    ['2026-11-27T23:59:59-03:00', 'condicao'],
    ['2026-11-28T00:00:00-03:00', null],
  ];
  for (const [quando, esperado] of casos) assert.equal(fase(ms(quando), false), esperado, quando);
  assert.equal(fase(ms('2026-12-10T12:00:00-03:00'), true), 'fechado', '?tema=black força as vendas fechadas');
});

test('parceiros: vitalícia de R$ 537 (sub-fase 2a) até 27/11, 23h59; depois, a Black do grupo até 04/12', () => {
  for (const nome of PARCEIROS) {
    const html = ler(`${nome}.html`);
    const cabeca = scriptCom(html, 'FIM_2A:');
    const em = (quando, endereco = `https://fluenciacontabil.com.br/${nome}`) => {
      const window = {};
      const attrs = {};
      const ctx = vm.createContext({ window, location: new URL(endereco), URLSearchParams, Date: relogioEm(ms(quando)),
        document: { documentElement: { setAttribute: (k, v) => { attrs[k] = v; } },
          querySelectorAll: () => [], querySelector: () => null } });
      vm.runInContext(cabeca, ctx);
      return attrs;
    };
    assert.deepEqual(em('2026-11-14T10:00:00-03:00'), { 'data-fase': 'black', 'data-sub': '2a' }, nome);
    assert.deepEqual(em('2026-11-27T23:59:59-03:00'), { 'data-fase': 'black', 'data-sub': '2a' }, nome);
    assert.deepEqual(em('2026-11-28T00:00:00-03:00'), { 'data-fase': 'black' }, nome);
    assert.deepEqual(em('2026-12-05T00:00:00-03:00'), { 'data-fase': 'regular' }, nome);
    assert.deepEqual(em('2026-12-01T10:00:00-03:00', `https://fluenciacontabil.com.br/${nome}?fase=2a`),
      { 'data-fase': 'black', 'data-sub': '2a' }, `${nome} ?fase=2a`);
    assert.match(html, /var LINK_VITALICIA_2A = '/, `${nome}: LINK_VITALICIA_2A`);
    assert.match(html, /R\$ 429,60/, `${nome}: preço com o cupom na 2a`);
  }
});

test('segunda chance: grupo novo, live de 25/11 e selo novo em todas as páginas da Black', () => {
  const grupoBlack = black.match(/var GRUPO_VIP = '([^']+)'/)[1];
  assert.match(grupoBlack, /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+$/);
  assert.ok(obrigado.includes(`href="${grupoBlack}"`), 'o obrigado leva ao mesmo grupo da /black');
  const chave = black.match(/var CHAVE_LOCAL = '([^']+)'/)[1];
  assert.ok(obrigado.includes(`localStorage.getItem('${chave}')`), 'o obrigado lê a mesma chave da /black');
  for (const [nome, html] of [['black.html', black], ['black-obrigado.html', obrigado]]) {
    assert.ok(html.includes("new Date('2026-11-25T20:00:00-03:00')"), `${nome}: LIVE em 25/11, 20h`);
    assert.ok(html.includes('20261125T230000Z/20261126T010000Z'), `${nome}: agenda em 25/11`);
  }
  for (const nome of ['black.html', 'black-obrigado.html', ...PARCEIROS.map((p) => `${p}.html`)]) {
    const html = ler(nome);
    assert.ok(!html.includes('logo-black-selo.png'), `${nome}: sem o selo de 11/11`);
    assert.ok(!html.includes('E1g998o4J2H8ZOD7RoeHxZ'), `${nome}: sem o grupo da lista VIP de 11/11`);
  }
  assert.ok(tema.includes("var SELO = '/assets/black/selo-2a-chance.png'"));
});
