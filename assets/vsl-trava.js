/* Fluência Contábil — trava da página no vídeo da VSL (pedido do Vinícius, 30/09/2026).
   Enquanto a página está travada (<html class="vsl-trava">), só o hero aparece: o resto fica
   com display:none e não há o que rolar. Libera depois de data-vsl-trava segundos de vídeo
   REALMENTE assistidos — mesma regra do vsl.js: arrastar a barra, aba em segundo plano e
   reprodução repetida não contam.
   Não trava: link com âncora (ex.: #oferta, usado em e-mails e botões), quem já liberou antes
   (localStorage), ?semtrava=1 (equipe) e robôs de busca. Falha sempre abre: sem aviso do player
   em 15 s ou com panda_error, a página libera sozinha — vídeo quebrado não tranca venda. */
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
  var tocando = false, pulando = false, travada = true, ouviuPlayer = false, taxa = 1;
  var tempoAnterior = null, relogioAnterior = null;

  function evento(nome, extra) {
    window.dataLayer = window.dataLayer || [];
    var dados = {event: nome, vsl_version: versao, vsl_trava_segundos: limite, watched_seconds: Math.round(assistido)};
    for (var k in extra) dados[k] = extra[k];
    window.dataLayer.push(dados);
  }
  function mmss(t) {
    t = Math.max(0, Math.ceil(t));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function desenha() {
    if (txt) {
      txt.textContent = assistido > 0
        ? 'Assista mais ' + mmss(limite - assistido) + ' para liberar a página'
        : 'Dê o play: a página libera depois de ' + Math.round(limite / 60) + ' minutos de vídeo';
    }
    if (barra) barra.style.width = Math.min(100, assistido / limite * 100).toFixed(1) + '%';
  }
  function libera(motivo) {
    if (!travada) return;
    travada = false;
    raiz.classList.remove('vsl-trava');
    aviso.hidden = true;
    if (motivo === 'assistiu') gravar('localStorage', chaveLiberada, '1');
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
      case 'panda_play': tocando = true; pulando = false; zera(); amostra(t); break;
      case 'panda_timeupdate': amostra(t); break;
      case 'panda_pause': amostra(t); tocando = false; zera(); break;
      case 'panda_seeking': pulando = true; zera(); break;
      case 'panda_seeked': pulando = false; zera(); break;
      case 'panda_ended': amostra(t); tocando = false; zera(); libera('assistiu'); break;
      case 'panda_error': libera('erro_player'); break;
      case 'panda_speed_update':
        var nova = Number(data.speed || data.playbackRate);
        if (Number.isFinite(nova) && nova >= 0.25 && nova <= 4) taxa = nova;
        zera(); break;
    }
  });
  document.addEventListener('visibilitychange', zera);
})();
