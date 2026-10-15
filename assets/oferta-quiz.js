/* Fluência Contábil — oferta-quiz.js
   Escolhe a tabela de ofertas do quiz (a ou b) e publica window.FC_OFERTA. As tabelas ficam no
   quiz.html (DADOS.planos e PLANOS_B). A escolha fica no navegador por 30 dias.
   ?oferta=a ou ?oferta=b força a tabela, sem gravar e sem evento. ativo = false deixa todos na a.
   Evento no dataLayer: ab_atribuido { ab_teste: 'oferta_quiz', ab_variante: a|b, ab_pct_b }. */
(function () {
  'use strict';
  var CFG = { ativo: true, pctB: 50, chave: 'fc_oferta_quiz', dias: 30, teste: 'oferta_quiz' };

  var loc = window.location;
  if (!/\/quiz(\.html)?\/?$/.test(loc.pathname)) return;
  window.FC_OFERTA = 'a';

  var p = null;
  try { p = new URLSearchParams(loc.search); } catch (e) {}
  var forcado = p && p.get('oferta');
  if (forcado === 'a' || forcado === 'b') { window.FC_OFERTA = forcado; return; }
  if (!CFG.ativo) return;

  var v = '';
  try {
    var g = JSON.parse(window.localStorage.getItem(CFG.chave) || 'null');
    if (g && (g.v === 'a' || g.v === 'b') && typeof g.t === 'number'
        && Date.now() - g.t < CFG.dias * 86400000) v = g.v;
  } catch (e) {}
  if (!v) {
    v = Math.random() * 100 < CFG.pctB ? 'b' : 'a';
    try { window.localStorage.setItem(CFG.chave, JSON.stringify({ v: v, t: Date.now() })); } catch (e) {}
  }
  window.FC_OFERTA = v;
  try {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'ab_atribuido', ab_teste: CFG.teste, ab_variante: v, ab_pct_b: CFG.pctB });
  } catch (e) {}
})();
