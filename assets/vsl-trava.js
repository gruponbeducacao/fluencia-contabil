/* Fluência Contábil — trava da página no vídeo da VSL (pedido do Vinícius, 30/09/2026).
   Enquanto a página está travada (<html class="vsl-trava">), só o hero aparece: o resto fica
   com display:none e não há o que rolar. Libera depois de data-vsl-trava segundos de vídeo
   REALMENTE assistidos — mesma regra do vsl.js: arrastar a barra, aba em segundo plano e
   reprodução repetida não contam.
   Não trava: link com âncora (ex.: #oferta, usado em e-mails e botões), quem já liberou antes
   (localStorage), ?semtrava=1 (equipe) e robôs de busca.
   Falha sempre abre — vídeo quebrado não tranca venda —, mas só com sinal de falha: quem tem o
   player funcionando e ainda não deu o play continua travado (revisão de 30/09/2026).
   - player_mudo: o player não disse nada em 15 s (Panda bloqueado, iframe que não carrega).
     "Nada" inclui o que a página ouviu antes deste arquivo: o trecho opcional no HTML
     (<script data-vsl-trava-ouvinte>, ver a assinatura.html) marca window.FC_VSL_PLAYER_OK na
     1ª mensagem do player. Sem o trecho, um panda_ready anterior a este arquivo passa
     despercebido e a página pode abrir aos 15 s, como antes.
   - erro_player: panda_error, na hora.
   - player_travado: a pessoa tentou dar play (panda_play, ou clique que leva o foco ao iframe,
     o mesmo sinal do vsl-overlay.js) e o vídeo não andou em 20 s — o player carregou e o vídeo
     não, ou o player não responde ao clique. Pausar não zera o prazo; com a aba em segundo plano,
     ele espera a pessoa voltar.
   - panda_ended libera sempre (protege quem volta pelo "continuar de onde parou" do Panda); o
     motivo é fim_do_video se a pessoa ainda não tinha assistido o limite, assistiu se já tinha.
   O aviso com o tempo que falta só aparece na pausa (pedido do Vinícius, 30/09/2026): fica no layout
   o tempo todo (reserva o espaço, o vídeo não pula) e o CSS só o mostra com [data-pausa]. O texto
   dele pode vir da página: data-vsl-trava-texto no slot, com {tempo} no lugar do m:ss. */
(function () {
  'use strict';
  if (window.FC_VSL_TRAVA) return;
  var raiz = document.documentElement;
  var slot = document.getElementById('heroVsl');
  var frame = document.getElementById('heroVslFrame');
  var aviso = document.getElementById('vslTrava');
  if (!slot || !frame || !aviso || slot.hidden) return;
  var limite = Number(slot.getAttribute('data-vsl-trava'));
  var versao = slot.getAttribute('data-vsl-version') || '';
  var conteudo = slot.getAttribute('data-vsl-content') || '';
  // Texto do aviso, opcional por página (01/10/2026: no cashback, "para liberar seu cashback").
  // Sem o atributo, ou sem o {tempo}, vale o texto de sempre.
  var modelo = slot.getAttribute('data-vsl-trava-texto') || '';
  if (modelo.indexOf('{tempo}') === -1) modelo = 'Assista mais {tempo} para liberar a página';
  if (!Number.isFinite(limite) || limite <= 0 || !versao) return;
  var src = frame.getAttribute('src') || frame.getAttribute('data-src') || '';
  if (!src || src.indexOf('__PANDA_ID__') !== -1) return;
  var url;
  try { url = new URL(src, window.location.href); } catch (e) { return; }
  if (url.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname)) return;

  var chaveLiberada = 'fc_vsl_liberada:' + versao;
  var chaveTempo = 'fc_vsl_trava_seg:' + versao;
  function ler(armazem, chave) { try { return window[armazem].getItem(chave); } catch (e) { return null; } }
  function gravar(armazem, chave, valor) { try { window[armazem].setItem(chave, valor); } catch (e) {} }

  var loc = window.location;
  var semTrava = /(?:^|[?&])semtrava=1(?:&|$)/.test(loc.search || '');
  var robo = /bot|crawl|spider|slurp|lighthouse|headless|preview/i.test((window.navigator && window.navigator.userAgent) || '');
  if ((loc.hash && loc.hash.length > 1) || semTrava || robo || ler('localStorage', chaveLiberada) === '1') return;

  window.FC_VSL_TRAVA = true;
  var txt = aviso.querySelector('[data-vsl-trava-txt]');
  var barra = aviso.querySelector('[data-vsl-trava-barra]');
  var assistido = Number(ler('sessionStorage', chaveTempo)) || 0;
  var tocando = false, pulando = false, travada = true, taxa = 1;
  var tempoAnterior = null, relogioAnterior = null;
  // Sinais de vida: o player falou (aqui ou no trecho da página) e o vídeo andou de verdade.
  var ouviuPlayer = window.FC_VSL_PLAYER_OK === true, andou = false, ultimoTempo = null, vigia = null;

  function evento(nome, extra) {
    window.dataLayer = window.dataLayer || [];
    var dados = {event: nome, vsl_version: versao, vsl_trava_segundos: limite, watched_seconds: Math.round(assistido)};
    if (conteudo) dados.content_name = conteudo;
    for (var k in extra) dados[k] = extra[k];
    window.dataLayer.push(dados);
  }
  function mmss(t) {
    t = Math.max(0, Math.ceil(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function desenha() {
    if (txt) {
      txt.textContent = modelo.replace('{tempo}', mmss(limite - assistido));
    }
    if (barra) barra.style.width = Math.min(100, assistido / limite * 100).toFixed(1) + '%';
  }
  function naPausa(sim) {
    if (sim) aviso.setAttribute('data-pausa', ''); else aviso.removeAttribute('data-pausa');
  }
  function libera(motivo) {
    if (!travada) return;
    travada = false;
    clearTimeout(vigia);
    raiz.classList.remove('vsl-trava');
    aviso.hidden = true;
    if (motivo === 'assistiu' || motivo === 'fim_do_video') gravar('localStorage', chaveLiberada, '1');
    evento('vsl_pagina_liberada', {motivo: motivo});
  }
  function zera() { tempoAnterior = null; relogioAnterior = null; }
  function amostra(t) {
    var agora = Date.now();
    if (!tocando || pulando || document.visibilityState === 'hidden' || !Number.isFinite(t)) { zera(); return; }
    if (tempoAnterior !== null) {
      var delta = t - tempoAnterior, passou = (agora - relogioAnterior) / 1000;
      if (delta > 0 && passou >= 0 && passou <= 5 && delta <= passou * taxa + 0.6) {
        assistido += delta;
        gravar('sessionStorage', chaveTempo, String(Math.round(assistido)));
        desenha();
        if (assistido >= limite) libera('assistiu');
      }
    }
    tempoAnterior = t; relogioAnterior = agora;
  }
  // O vídeo andou: currentTime maior que o do aviso anterior, sem busca no meio. Arrastar a barra
  // não prova que o vídeo carregou; quanto foi assistido continua sendo conta do amostra().
  function viuTempo(t) {
    if (pulando || !Number.isFinite(t)) return;
    if (ultimoTempo !== null && t > ultimoTempo) { andou = true; clearTimeout(vigia); }
    ultimoTempo = t;
  }
  function confere() {
    vigia = null;
    if (andou || !travada) return;
    if (document.visibilityState === 'hidden') { vigia = setTimeout(confere, 5000); return; }
    libera('player_travado');
  }
  function tentou() {
    if (travada && !andou && vigia === null) vigia = setTimeout(confere, 20000);
  }

  raiz.classList.add('vsl-trava');
  aviso.hidden = false;
  desenha();
  evento('vsl_trava_inicio', {});

  setTimeout(function () { if (!ouviuPlayer) libera('player_mudo'); }, 15000);

  window.addEventListener('message', function (event) {
    if (!travada || event.source !== frame.contentWindow || event.origin !== url.origin) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.message !== 'string') return;
    ouviuPlayer = true;
    if (data.isMutedIndicator === true) { tocando = false; zera(); return; }
    var t = Number(data.currentTime);
    switch (data.message) {
      case 'panda_play': tocando = true; pulando = false; naPausa(false); zera(); viuTempo(t); amostra(t); tentou(); break;
      case 'panda_timeupdate': viuTempo(t); amostra(t); break;
      case 'panda_pause': viuTempo(t); amostra(t); tocando = false; zera(); desenha(); naPausa(true); break;
      case 'panda_seeking': pulando = true; ultimoTempo = null; zera(); break;
      case 'panda_seeked': pulando = false; zera(); viuTempo(t); break;
      case 'panda_ended': amostra(t); tocando = false; zera(); libera(assistido >= limite ? 'assistiu' : 'fim_do_video'); break;
      case 'panda_error': libera('erro_player'); break;
      case 'panda_speed_update':
        var nova = Number(data.speed || data.playbackRate);
        if (Number.isFinite(nova) && nova >= 0.25 && nova <= 4) taxa = nova;
        zera(); break;
    }
  });
  // Clique no vídeo sem aviso do player: o clique leva o foco ao iframe e a página perde o foco.
  window.addEventListener('blur', function () {
    setTimeout(function () { if (document.activeElement === frame) tentou(); }, 0);
  });
  document.addEventListener('visibilitychange', zera);
})();
