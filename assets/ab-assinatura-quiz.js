/* Fluência Contábil — ab-assinatura-quiz.js
   Teste A/B: página de venda da assinatura (assinatura.html) × quiz (quiz.html).
   Só entra no teste quem chega de anúncio pago (utm_medium=cpc, fbclid ou gclid).
   Orgânico e acesso direto ficam na assinatura.html, sem sorteio.
   A divisão é 50/50 por padrão e fica gravada no navegador (localStorage, 30 dias):
   quem voltar vê sempre a mesma versão. O redirecionamento leva a query string
   inteira, então o origem.js do quiz herda UTMs e src do anúncio como na assinatura.
   Desligar o teste: ativo = false (a assinatura.html para de redirecionar na hora).
   QA: ?ab=quiz ou ?ab=assinatura força a versão, sem gravar e sem emitir evento.
   Evento no dataLayer: ab_atribuido { ab_teste, ab_variante: quiz|assinatura, ab_pct_quiz }.
   Falha de storage não impede a navegação (sem storage, sorteia a cada visita). */
(function () {
  'use strict';
  var CFG = { ativo: true, pctQuiz: 50, chave: 'fc_ab_assinatura_quiz', dias: 30, teste: 'assinatura_quiz' };

  var loc = window.location;
  var naAssinatura = /\/assinatura(\.html)?\/?$/.test(loc.pathname);
  var noQuiz = /\/quiz(\.html)?\/?$/.test(loc.pathname);
  if (!naAssinatura && !noQuiz) return;

  var p = null;
  try { p = new URLSearchParams(loc.search); } catch (e) {}

  function pago() {
    return !!p && (p.get('utm_medium') === 'cpc' || !!p.get('fbclid') || !!p.get('gclid'));
  }

  function forcado() {
    var v = p && p.get('ab');
    return v === 'quiz' || v === 'assinatura' ? v : '';
  }

  function lido() {
    try {
      var v = JSON.parse(window.localStorage.getItem(CFG.chave) || 'null');
      if (v && (v.v === 'quiz' || v.v === 'assinatura') && typeof v.t === 'number'
          && Date.now() - v.t < CFG.dias * 86400000) return v.v;
    } catch (e) {}
    return '';
  }

  function gravar(v) {
    try { window.localStorage.setItem(CFG.chave, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }

  function emitir(variante) {
    window.FC_AB = { teste: CFG.teste, variante: variante };
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'ab_atribuido', ab_teste: CFG.teste, ab_variante: variante, ab_pct_quiz: CFG.pctQuiz });
    } catch (e) {}
  }

  var f = forcado();

  if (naAssinatura) {
    if (!CFG.ativo && !f) return;
    if (!f && !pago()) return;
    var v = f || lido();
    if (!v) {
      v = Math.random() * 100 < CFG.pctQuiz ? 'quiz' : 'assinatura';
      gravar(v);
    }
    if (v === 'quiz') {
      // replace: o botão Voltar não devolve o visitante para a página que redireciona
      loc.replace(loc.origin + '/quiz.html' + loc.search + loc.hash);
      return;
    }
    if (f) window.FC_AB = { teste: CFG.teste, variante: v, forcado: true };
    else emitir(v);
    return;
  }

  // quiz.html: só registra a versão de quem veio do sorteio (ou do ?ab=quiz de QA)
  if (f) { window.FC_AB = { teste: CFG.teste, variante: f, forcado: true }; return; }
  if (lido() === 'quiz') emitir('quiz');
})();
