/* Fluência Contábil — overlay de play e pausa da VSL (só visual).
   O overlay tem pointer-events: none: o clique atravessa e cai no próprio player do
   Panda. Assim o play acontece dentro do iframe e o navegador libera o som (no iPhone,
   um play mandado da página por postMessage pode sair mudo ou nem começar). O overlay
   apenas reage aos avisos do player: some no play, volta na pausa e no fim.
   Único comando: na tela inicial, se o clique cair no vídeo fora do botão do Panda
   (que só inicia pelo botão) e o player não avisar o play em 600 ms, pede o play —
   o gesto aconteceu dentro do iframe, então o som continua liberado.
   Não envia eventos ao dataLayer — a medição é do vsl.js. */
(function () {
  'use strict';
  if (window.FC_VSL_OVERLAY) return;
  var slot = document.getElementById('heroVsl');
  var frame = document.getElementById('heroVslFrame');
  var ov = document.getElementById('heroVslOverlay');
  if (!slot || !frame || !ov || slot.hidden) return;
  var src = frame.getAttribute('src') || frame.getAttribute('data-src') || '';
  if (!src || src.indexOf('__PANDA_ID__') !== -1) return;
  var url;
  try { url = new URL(src, window.location.href); } catch (e) { return; }
  if (url.protocol !== 'https:' || !/^player-[a-z0-9-]+\.tv\.pandavideo\.com\.br$/.test(url.hostname)) return;
  window.FC_VSL_OVERLAY = true;
  var duration = Number(slot.getAttribute('data-vsl-duration'));
  var pitch = Number(slot.getAttribute('data-vsl-pitch'));
  var tempo = ov.querySelector('[data-vsl-ov-tempo]');
  var timer = null, reforco = null, estado = '', tocando = false, ultimo = 0;

  function mmss(t) {
    t = Math.max(0, Math.floor(t || 0));
    return Math.floor(t / 60) + ':' + ('0' + (t % 60)).slice(-2);
  }
  function mostra(novo) {
    clearTimeout(timer);
    estado = novo;
    ov.setAttribute('data-estado', novo);
    ov.hidden = false;
  }
  function esconde() {
    clearTimeout(timer);
    estado = 'tocando';
    ov.hidden = true;
  }
  function pausa() {
    // Um instante de espera: a pausa que antecede o fim ou uma busca não pisca o overlay.
    clearTimeout(timer);
    timer = setTimeout(function () {
      if (tocando) return;
      if (Number.isFinite(duration) && ultimo >= duration - 1) { mostra('fim'); return; }
      if (tempo) tempo.textContent = mmss(ultimo);
      if (Number.isFinite(pitch) && ultimo >= pitch) ov.classList.add('vsl-ov-oferta');
      else ov.classList.remove('vsl-ov-oferta');
      mostra('pausa');
    }, 350);
  }

  mostra('inicio');

  window.addEventListener('message', function (event) {
    if (event.source !== frame.contentWindow || event.origin !== url.origin) return;
    var data = event.data;
    if (!data || typeof data !== 'object' || typeof data.message !== 'string') return;
    // Prévia muda (autoplay silencioso) não conta como play: o overlay continua convidando.
    if (data.isMutedIndicator === true) return;
    var t = Number(data.currentTime);
    if (data.currentTime !== null && data.currentTime !== '' && Number.isFinite(t) && t >= 0) ultimo = t;
    switch (data.message) {
      case 'panda_play': tocando = true; clearTimeout(reforco); esconde(); break;
      case 'panda_pause': tocando = false; pausa(); break;
      case 'panda_seeking': clearTimeout(timer); if (estado !== 'inicio') ov.hidden = true; break;
      case 'panda_seeked': if (!tocando && estado !== 'inicio') pausa(); break;
      case 'panda_ended': tocando = false; mostra('fim'); break;
    }
  });

  // O primeiro clique no vídeo leva o foco para o iframe (a página perde o foco): retira o
  // convite mesmo sem aviso do player e, se o play não vier, pede o play ao player.
  window.addEventListener('blur', function () {
    setTimeout(function () {
      if (estado !== 'inicio' || document.activeElement !== frame) return;
      esconde();
      reforco = setTimeout(function () {
        if (tocando) return;
        try { frame.contentWindow.postMessage({ type: 'play' }, url.origin); } catch (e) {}
      }, 600);
    }, 0);
  });
})();
