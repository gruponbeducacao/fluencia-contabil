/* /receita-federal · layout v2 (26/11/2026, homologado no mock "liga e desliga").
   Faixa de missão, números (lidos de window.__OR.NUMEROS, no config.js), questão da FGV no formato
   da plataforma, linha do tempo, vídeo-convite, formulário em 3 passos no celular e a plataforma por dentro. */
(function(){
  'use strict';
  var OR = window.__OR || {}, R = document.documentElement;
  function el(id){ return document.getElementById(id); }
  function d2(n){ return String(n).padStart(2,'0'); }

  // números da campanha: um lugar só (config.js → NUMEROS)
  var N = OR.NUMEROS || {};
  document.querySelectorAll('[data-n]').forEach(function(e){ var v = N[e.dataset.n]; if (v == null) return;
    e.textContent = typeof v === 'number' ? v.toLocaleString('pt-BR') : v;
    if (e.hasAttribute('data-conta') && typeof v === 'number') e.dataset.conta = v; });
  document.querySelectorAll('[data-nv]').forEach(function(e){ var v = N[e.dataset.nv]; if (typeof v === 'number') e.style.setProperty('--v', v); });
  document.querySelectorAll('.favs, .barras').forEach(function(lista){
    var max = 0; lista.querySelectorAll('[data-nv]').forEach(function(li){ max = Math.max(max, +li.style.getPropertyValue('--v') || 0); });
    if (max) lista.style.setProperty('--max', max); });

  // vídeo-convite: só aparece com VIDEO_CONVITE preenchido no config.js (sem ele, fica a arte do dossiê)
  if (OR.VIDEO_CONVITE) {
    R.classList.add('tem-video');
    var vid = document.querySelector('.palco .video');
    var capa = vid && vid.querySelector('img');
    if (capa && OR.VIDEO_CAPA) { capa.src = OR.VIDEO_CAPA; capa.width = 540; capa.height = 960; }
    if (vid) vid.addEventListener('click', function(){
      if (vid.querySelector('iframe')) return;
      var f = document.createElement('iframe');
      f.src = OR.VIDEO_CONVITE + (OR.VIDEO_CONVITE.indexOf('?') < 0 ? '?' : '&') + 'autoplay=1';
      f.title = 'Convite da Operação Receita'; f.allow = 'autoplay; fullscreen; picture-in-picture'; f.setAttribute('allowfullscreen', '');
      vid.innerHTML = ''; vid.appendChild(f);
    });
  }

  // faixa de missão (mesma conta do relógio da página)
  var LIVE = Date.parse(OR.LIVE || '2026-12-09T20:00:00-03:00');
  function conta(){ var s = Math.max(0, Math.floor((LIVE - Date.now())/1000));
    el('m-dias').textContent = Math.floor(s/86400); el('m-horas').textContent = d2(Math.floor(s%86400/3600));
    el('m-min').textContent = d2(Math.floor(s%3600/60)); el('m-seg').textContent = d2(s%60); }
  if (el('m-dias')) { conta(); setInterval(conta, 1000); }

  // a FGV em números: sobem ao aparecer
  var num = el('numeros');
  if (num) {
    if ('IntersectionObserver' in window) new IntersectionObserver(function(es, ob){ es.forEach(function(e){ if (!e.isIntersecting) return;
      num.classList.add('vis'); ob.disconnect();
      num.querySelectorAll('[data-conta]').forEach(function(b){ var alvo = +b.dataset.conta, t0 = performance.now();
        (function passo(t){ var k = Math.min(1, (t - t0)/1100); b.textContent = Math.round(alvo*(1-Math.pow(1-k,3))).toLocaleString('pt-BR'); if (k < 1) requestAnimationFrame(passo); })(t0); });
    }); }, { threshold: 0 }).observe(num); else num.classList.add('vis');
    setTimeout(function(){ num.classList.add('vis'); }, 2500);
  }

  // questão da FGV no formato do banco de questões da plataforma (texto idêntico ao do banco, sem código TEC na tela)
  var dados = el('q-dados');
  if (dados) {
    var q = JSON.parse(dados.textContent), LET = 'ABCDE';
    var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
    var html = function(s){ return /<(p|table|ul)\b/.test(s) ? s : s.split('\n').map(function(l){ return '<p>' + esc(l) + '</p>'; }).join(''); };
    el('q-plat').innerHTML =
      '<div class="qp-janela"><div class="qp-barra"><i></i><i></i><i></i><span>portal.fluenciacontabil.com.br · Questões</span></div>' +
      '<div class="qp-card"><div class="qp-meta"><b>FGV · ' + esc(q.examOrg) + ' · ' + q.year + '</b><span class="qp-badge">' + esc(q.cpcRef) + '</span><span class="qp-badge cinza">Múltipla escolha</span></div>' +
      '<div class="qp-trilha">' + esc(q.subject) + ' › ' + esc(q.subtopic) + '</div>' +
      '<div class="qp-enun">' + html(q.statement) + '</div>' +
      '<div class="qp-alts" id="qp-alts">' + q.options.map(function(o, i){ return '<button type="button" class="qp-alt" data-i="' + i + '"><span class="qp-l">' + LET[i] + '</span><span>' + esc(o) + '</span></button>'; }).join('') + '</div>' +
      '<div class="qp-res" id="qp-res" hidden><div class="qp-ver" id="qp-ver"></div>' + (/Gabarito/.test(q.comment) ? '' : '<div class="qp-gab">Gabarito: alternativa ' + LET[q.correctIndex] + '</div>') +
      '<div class="qp-com" id="qp-com">' + html(q.comment) + '</div><button type="button" class="qp-mais" id="qp-mais">Ver a resolução completa</button></div></div></div>';
    el('q-plat').addEventListener('click', function(e){
      var b = e.target.closest('.qp-alt'), alts = el('qp-alts');
      if (b && !alts.classList.contains('feito')) {
        var i = +b.dataset.i, certo = i === q.correctIndex;
        alts.classList.add('feito');
        alts.querySelectorAll('.qp-alt').forEach(function(x){ var j = +x.dataset.i; if (j === q.correctIndex) x.classList.add('certa'); else if (j === i) x.classList.add('errada'); });
        var v = el('qp-ver'); v.textContent = certo ? '✓ Correto · Resolução da Fluência' : '✗ Incorreto · Resolução da Fluência'; v.className = 'qp-ver ' + (certo ? 'ok' : 'erro');
        el('qp-res').hidden = false; el('qp-cta').hidden = false;
        if (window.dataLayer) window.dataLayer.push({ event: 'or_questao_respondida', acertou: certo });
        return;
      }
      if (e.target.id === 'qp-mais') { el('qp-com').classList.add('aberto'); e.target.hidden = true; }
    });
  }

  // "hoje" na linha do tempo
  var h = new Date(); if (el('lt-hoje')) el('lt-hoje').textContent = 'Hoje · ' + d2(h.getDate()) + '/' + d2(h.getMonth()+1);

  // celular: formulário em 3 passos e barra fixa que some quando o formulário aparece
  if (matchMedia('(max-width:920px)').matches && el('or-form')) {
    var form = el('or-form'), campos = Array.prototype.filter.call(form.children, function(c){ return c.tagName === 'DIV'; }),
        env = el('or-enviar'), passo = 0, prog = document.createElement('div'), seg = document.createElement('button');
    if (campos.length === 3) {
      prog.className = 'passos'; form.insertBefore(prog, form.firstChild);
      seg.type = 'button'; seg.className = 'btn'; seg.textContent = 'Continuar'; env.parentNode.insertBefore(seg, env);
      var OK = [function(v){ return v.trim().length >= 2; }, function(v){ return /^[1-9]{2}9?\d{8}$/.test(v.replace(/\D/g,'')); }, function(){ return true; }];
      var MSG = ['Escreva seu nome.', 'Confira o WhatsApp: DDD e número.'];
      var mostra = function(){ campos.forEach(function(c, i){ c.hidden = i !== passo; }); seg.hidden = passo === 2; env.hidden = passo !== 2;
        prog.innerHTML = '<span>Passo ' + (passo+1) + ' de 3 · ' + ['seu nome','seu WhatsApp','seu e-mail'][passo] + '</span><i style="--p:' + ((passo+1)/3) + '"></i>'; };
      seg.addEventListener('click', function(){ var inp = campos[passo].querySelector('input'), e = el('or-erro');
        if (!OK[passo](inp.value)) { e.textContent = MSG[passo]; e.hidden = false; inp.setAttribute('aria-invalid','true'); inp.focus(); return; }
        e.hidden = true; inp.setAttribute('aria-invalid','false'); passo++; mostra(); campos[passo].querySelector('input').focus(); });
      mostra();
    }
    var barra = el('barra-fixa');
    if (barra && 'IntersectionObserver' in window) new IntersectionObserver(function(es){ es.forEach(function(e){ barra.classList.toggle('some', e.isIntersecting); }); }, { threshold: .15 }).observe(el('lista'));
  }
})();

/* a plataforma por dentro: abas com as gravações reais (as mesmas da /black, em assets/quiz/telas) + demo navegável */
(function(){
  var abas = document.getElementById('abas'); if (!abas) return;
  var N = (window.__OR && window.__OR.NUMEROS) || {};
  var TELAS = [
    { id:'aula-videos', nome:'Aulas', t:'Aulas em vídeo e em PDF', d:'Cada aula tem os vídeos de teoria e os de resolução de questões. A aba Questões monta na hora um caderno só com as questões daquela aula.', r:'Você não monta o caminho. Ele já vem em ordem.' },
    { id:'questoes-filtros', nome:'Questões', t:'Questões de banca real, comentadas', d:'Mais de ' + (N.questoes_mais_de || '6.300') + ' questões publicadas, ' + (N.fgv_total || 1222).toLocaleString('pt-BR') + ' delas da FGV. Filtro por assunto, banca, área e ano; depois de responder vem a resolução comentada da Fluência.', r:'Você entende por que cada alternativa errada está errada.' },
    { id:'mapa', nome:'Mapa de Incidência', t:'Mapa de Incidência', d:'O item da norma cruzado com a banca: quanto mais forte a cor, mais aquela banca cobra.', r:'Você estuda primeiro o que a FGV cobra de verdade.' },
    { id:'edital-catalogo', nome:'Meu Edital', t:'Catálogo de Editais e Meu Edital', d:'Cada item do edital vem com as aulas e as questões ligadas a ele.', r:'Acaba o garimpo no PDF do edital.' },
    { id:'cadernos-pastas', nome:'Cadernos', t:'Cadernos em pastas e modo Simulado', d:'Guarde os cadernos em pastas e refaça qualquer um como simulado cronometrado.', r:'Você treina o relógio da prova antes da prova.' },
    { id:'plano-estudos', nome:'Plano de Estudos', t:'Plano de Estudos', d:'A semana montada na sua rotina, as tarefas do dia em ordem, o cronômetro e a revisão espaçada.', r:'Acaba o estuda-esquece.' }
  ];
  var video = document.getElementById('tela-video'), visivel = false, atual = 0;
  abas.innerHTML = TELAS.map(function(x,i){ return '<button class="aba" type="button" role="tab" aria-selected="'+(i===0)+'" data-i="'+i+'">'+x.nome+'</button>'; }).join('');
  function mostrar(i){
    atual = i; var x = TELAS[i];
    abas.querySelectorAll('.aba').forEach(function(b,j){ b.setAttribute('aria-selected', String(j===i)); });
    document.getElementById('tela-n').textContent = String(i+1).padStart(2,'0') + ' / ' + String(TELAS.length).padStart(2,'0') + ' · Tela real';
    document.getElementById('tela-titulo').textContent = x.t;
    document.getElementById('tela-desc').textContent = x.d;
    var r = document.getElementById('tela-resolve'); r.textContent = x.r; r.hidden = !x.r;
    video.poster = 'assets/quiz/telas/' + x.id + '.jpg';
    if (visivel) { video.src = 'assets/quiz/telas/' + x.id + '.mp4'; var p = video.play(); if (p && p.catch) p.catch(function(){}); }
  }
  abas.addEventListener('click', function(e){ var b = e.target.closest('.aba'); if (b) mostrar(+b.dataset.i); });
  mostrar(0);
  if ('IntersectionObserver' in window) new IntersectionObserver(function(en,obs){ if (!en[0].isIntersecting) return; visivel = true; obs.disconnect(); mostrar(atual); }, {rootMargin:'200px'}).observe(video);
  else { visivel = true; mostrar(atual); }
  document.getElementById('demo-abrir').addEventListener('click', function(){
    var m = document.getElementById('demo-moldura');
    if (!m.firstChild) m.innerHTML = '<iframe src="assets/quiz/demo_plataforma.html" title="Demonstração navegável da plataforma"></iframe>';
    m.hidden = false; this.hidden = true;
  });
})();
