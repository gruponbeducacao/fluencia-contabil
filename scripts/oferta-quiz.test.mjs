import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fonte = fs.readFileSync(new URL('../assets/oferta-quiz.js', import.meta.url), 'utf8');
const quiz = fs.readFileSync(new URL('../quiz.html', import.meta.url), 'utf8').replace(/\r\n/g, '\n');

// Roda o script num window de mentira. ativo = null roda o arquivo como está publicado.
function roda({ path = '/quiz', search = '', storage = {}, sorteio = 0.1, semStorage = false, ativo = null }) {
  const dados = { ...storage };
  const dataLayer = [];
  const window = {
    location: { pathname: path, search },
    localStorage: semStorage ? { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }
      : { getItem: (k) => (k in dados ? dados[k] : null), setItem: (k, v) => { dados[k] = v; } },
    dataLayer,
  };
  const Math2 = Object.create(Math); Math2.random = () => sorteio;
  const codigo = ativo === null ? fonte : fonte.replace(/ativo: \w+/, 'ativo: ' + ativo);
  vm.runInNewContext(codigo, { window, URLSearchParams, JSON, Date, Math: Math2 });
  return { window, dataLayer, dados };
}

const ANUNCIO = '?utm_source=meta&utm_medium=cpc&utm_campaign=assinatura-videos-2026-10&src=s06-receita-federal&fbclid=abc';

test('sorteio abaixo de 50 escolhe a tabela b, a partir de 50 fica na a', () => {
  const b = roda({ search: ANUNCIO, sorteio: 0.49 });
  assert.equal(b.window.FC_OFERTA, 'b');
  assert.equal(JSON.parse(b.dados.fc_oferta_quiz).v, 'b');
  assert.equal(roda({ search: ANUNCIO, sorteio: 0.5 }).window.FC_OFERTA, 'a');
});

test('emite ab_atribuido com o nome e a tabela', () => {
  const r = roda({ search: ANUNCIO, sorteio: 0.1 });
  // JSON: o objeto nasce no contexto do vm, com outro Object.prototype
  assert.deepEqual(JSON.parse(JSON.stringify(r.dataLayer)),
    [{ event: 'ab_atribuido', ab_teste: 'oferta_quiz', ab_variante: 'b', ab_pct_b: 50 }]);
});

test('vale para /quiz e /quiz.html, e não faz nada em outra página', () => {
  assert.equal(roda({ path: '/quiz.html', sorteio: 0.1 }).window.FC_OFERTA, 'b');
  const outra = roda({ path: '/assinatura.html', sorteio: 0.1 });
  assert.equal(outra.window.FC_OFERTA, undefined);
  assert.equal(outra.dataLayer.length, 0);
  assert.deepEqual(Object.keys(outra.dados), []);
});

test('quem volta vê a mesma tabela', () => {
  const ga = { fc_oferta_quiz: JSON.stringify({ v: 'a', t: Date.now() }) };
  assert.equal(roda({ sorteio: 0.01, storage: ga }).window.FC_OFERTA, 'a');
  const gb = { fc_oferta_quiz: JSON.stringify({ v: 'b', t: Date.now() }) };
  assert.equal(roda({ sorteio: 0.99, storage: gb }).window.FC_OFERTA, 'b');
});

test('escolha com mais de 30 dias é sorteada de novo', () => {
  const velho = { fc_oferta_quiz: JSON.stringify({ v: 'a', t: Date.now() - 31 * 86400000 }) };
  assert.equal(roda({ sorteio: 0.1, storage: velho }).window.FC_OFERTA, 'b');
});

test('?oferta= força a tabela, sem gravar e sem evento', () => {
  const b = roda({ search: '?oferta=b', sorteio: 0.99 });
  assert.equal(b.window.FC_OFERTA, 'b');
  assert.deepEqual(Object.keys(b.dados), []);
  assert.equal(b.dataLayer.length, 0);
  assert.equal(roda({ search: '?oferta=a', sorteio: 0.01 }).window.FC_OFERTA, 'a');
});

test('sem storage não quebra a página', () => {
  const r = roda({ sorteio: 0.9, semStorage: true });
  assert.equal(r.window.FC_OFERTA, 'a');
  assert.equal(r.dataLayer[0].ab_variante, 'a');
});

test('desligado (ativo: false), todo mundo fica na tabela a, sem evento', () => {
  const r = roda({ sorteio: 0.01, ativo: false });
  assert.equal(r.window.FC_OFERTA, 'a');
  assert.equal(r.dataLayer.length, 0);
});

test('o arquivo publicado está ligado e em 50/50', () => {
  assert.match(fonte, /ativo: true/);
  assert.match(fonte, /pctB: 50/);
});

test('o quiz carrega o script no head, antes do GTM e dos planos', () => {
  const tag = quiz.indexOf('<script src="assets/oferta-quiz.js?v=');
  assert.ok(tag > 0, 'quiz.html não carrega assets/oferta-quiz.js');
  assert.ok(tag < quiz.indexOf('GTM-MGQFHR5J'), 'o script precisa vir antes do GTM');
  assert.ok(tag < quiz.indexOf('var DADOS = {'), 'o script precisa vir antes dos planos');
});

// Roda o bloco de dados do quiz.html (DADOS + PLANOS_B) com cada tabela.
function planos(tabela) {
  const ini = quiz.indexOf('var DADOS = {');
  const fim = quiz.indexOf('/* =====================================================================\n   ESTADO E MEDIÇÃO');
  assert.ok(ini > 0 && fim > ini, 'não achei o bloco de dados do quiz.html');
  const ctx = { window: { FC_OFERTA: tabela } };
  vm.runInNewContext(quiz.slice(ini, fim) + '\n;this.DADOS = DADOS;', ctx);
  return ctx.DADOS;
}

test('tabela a: os planos e o FAQ ficam como estão', () => {
  const d = planos('a');
  assert.equal(d.planos.trimestral.kw, '4Qx0g3O');
  assert.equal(d.planos.semestral.vista, 'R$ 547');
  assert.equal(d.planos.anual.parcela, 'R$ 84,27');
  assert.ok(d.faq.some((f) => f.a.includes('cerca de 36% mais barato')), 'o FAQ perdeu a frase que a tabela b troca');
});

test('tabela b: troca links, valores, mês de acesso e o FAQ, e mantém o resto do plano', () => {
  const d = planos('b');
  assert.deepEqual(
    Object.fromEntries(Object.entries(d.planos).map(([k, p]) => [k, [p.kw, p.vista, p.parcela, p.mes, p.meses, p.nome]])),
    {
      trimestral: ['5DBL8y7', 'R$ 297', 'R$ 30,72', 'R$ 99 por mês de acesso', 3, 'Plano trimestral'],
      semestral: ['CY76Yiq', 'R$ 397', 'R$ 41,06', 'R$ 66 por mês de acesso', 6, 'Plano semestral'],
      anual: ['n16FyVi', 'R$ 497', 'R$ 51,40', 'R$ 41 por mês de acesso', 12, 'Plano anual'],
    },
  );
  assert.ok(d.faq.some((f) => f.a.includes('cerca de 33% mais barato')));
  assert.ok(!d.faq.some((f) => f.a.includes('36%')));
});

test('a resposta a "O preço" destaca a parcela, não o custo por mês de acesso', () => {
  const preco = planos('b').objecoes.find((o) => o.rotulo === 'O preço');
  assert.equal(preco.hero.args[0].t, '12× de {parcela}');
  assert.ok(quiz.includes(".replace('{parcela}', pl.parcela)"), 'o quiz não substitui {parcela}');
});

test('o cartão de preço não mostra o custo por mês de acesso', () => {
  assert.ok(!quiz.includes('Equivale a '), 'o cartão voltou a mostrar "Equivale a R$ X por mês de acesso"');
});
