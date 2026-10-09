import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fonte = fs.readFileSync(new URL('../assets/ab-assinatura-quiz.js', import.meta.url), 'utf8');

function roda({ path = '/assinatura.html', search = '', hash = '', storage = {}, sorteio = 0.1, semStorage = false }) {
  const dados = { ...storage };
  const redirecionou = [];
  const dataLayer = [];
  const window = {
    location: { pathname: path, search, hash, origin: 'https://fluenciacontabil.com.br', replace: (u) => redirecionou.push(u) },
    localStorage: semStorage ? { getItem() { throw new Error('x'); }, setItem() { throw new Error('x'); } }
      : { getItem: (k) => (k in dados ? dados[k] : null), setItem: (k, v) => { dados[k] = v; } },
    dataLayer,
  };
  const Math2 = Object.create(Math); Math2.random = () => sorteio;
  vm.runInNewContext(fonte, { window, URLSearchParams, JSON, Date, Math: Math2 });
  return { window, redirecionou, dataLayer, dados };
}

const PAGO = '?utm_source=meta&utm_medium=cpc&utm_campaign=assinatura-reels-2026-10&src=r9-plano&fbclid=abc';

test('orgânico e direto não entram no teste', () => {
  const r = roda({ search: '' });
  assert.equal(r.redirecionou.length, 0);
  assert.equal(r.dataLayer.length, 0);
  assert.deepEqual(Object.keys(r.dados), []);
});

test('pago sorteado para quiz redireciona com a query string e a âncora', () => {
  const r = roda({ search: PAGO, hash: '#oferta', sorteio: 0.1 });
  assert.deepEqual(r.redirecionou, ['https://fluenciacontabil.com.br/quiz.html' + PAGO + '#oferta']);
  assert.equal(JSON.parse(r.dados.fc_ab_assinatura_quiz).v, 'quiz');
});

test('pago sorteado para assinatura fica e emite o evento', () => {
  const r = roda({ search: PAGO, sorteio: 0.9 });
  assert.equal(r.redirecionou.length, 0);
  assert.equal(r.dataLayer[0].event, 'ab_atribuido');
  assert.equal(r.dataLayer[0].ab_variante, 'assinatura');
});

test('a versão sorteada é a mesma na volta', () => {
  const guardado = { fc_ab_assinatura_quiz: JSON.stringify({ v: 'assinatura', t: Date.now() }) };
  const r = roda({ search: PAGO, sorteio: 0.1, storage: guardado });
  assert.equal(r.redirecionou.length, 0);
  const g2 = { fc_ab_assinatura_quiz: JSON.stringify({ v: 'quiz', t: Date.now() }) };
  assert.equal(roda({ search: PAGO, sorteio: 0.9, storage: g2 }).redirecionou.length, 1);
});

test('atribuição com mais de 30 dias é sorteada de novo', () => {
  const velho = { fc_ab_assinatura_quiz: JSON.stringify({ v: 'assinatura', t: Date.now() - 31 * 86400000 }) };
  assert.equal(roda({ search: PAGO, sorteio: 0.1, storage: velho }).redirecionou.length, 1);
});

test('quiz emite o evento só para quem veio do sorteio', () => {
  const quiz = { fc_ab_assinatura_quiz: JSON.stringify({ v: 'quiz', t: Date.now() }) };
  const r = roda({ path: '/quiz.html', search: PAGO, storage: quiz });
  assert.equal(r.dataLayer[0].ab_variante, 'quiz');
  assert.equal(r.redirecionou.length, 0);
  assert.equal(roda({ path: '/quiz.html', search: PAGO }).dataLayer.length, 0);
});

test('?ab= força a versão, sem gravar e sem evento', () => {
  const q = roda({ search: '?ab=quiz' });
  assert.equal(q.redirecionou.length, 1);
  assert.deepEqual(Object.keys(q.dados), []);
  const a = roda({ search: '?ab=assinatura&utm_medium=cpc', sorteio: 0.1 });
  assert.equal(a.redirecionou.length, 0);
  assert.equal(a.dataLayer.length, 0);
});

test('sem storage não quebra a página', () => {
  const r = roda({ search: PAGO, sorteio: 0.9, semStorage: true });
  assert.equal(r.redirecionou.length, 0);
  assert.equal(r.dataLayer[0].ab_variante, 'assinatura');
});

test('em outra página o script não faz nada', () => {
  const r = roda({ path: '/cursos.html', search: PAGO });
  assert.equal(r.redirecionou.length + r.dataLayer.length, 0);
});

test('o kill switch (ativo: false) está no código', () => {
  assert.match(fonte, /ativo: true/);
});
