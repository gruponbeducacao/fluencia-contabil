/* Depoimentos em vídeo (Panda) das páginas de venda. O player só entra na página no toque no play: até lá a página
   carrega só o poster (uma imagem de ~50 KB por vídeo), sem script nem conexão com a Panda.
   Cada <figure class="dv"> traz data-panda (id do vídeo na Panda), data-aluno (para a medição) e data-nome. */
(function () {
  'use strict';
  var PLAYER = 'https://player-vz-7867cfdb-be1.tv.pandavideo.com.br/embed/?v=';
  var ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

  document.addEventListener('click', function (ev) {
    var botao = ev.target.closest && ev.target.closest('[data-dv-play]');
    if (!botao) return;
    var fig = botao.closest('.dv');
    if (!fig || fig.classList.contains('dv-tocando')) return;
    var id = fig.getAttribute('data-panda') || '';
    if (!ID.test(id)) return;

    var quadro = document.createElement('iframe');
    quadro.src = PLAYER + id + '&autoplay=true';
    quadro.title = 'Depoimento de ' + (fig.getAttribute('data-nome') || 'aluno');
    quadro.setAttribute('allow', 'accelerometer;gyroscope;autoplay;encrypted-media;picture-in-picture');
    quadro.setAttribute('allowfullscreen', '');
    fig.querySelector('.dv-moldura').appendChild(quadro);
    fig.classList.add('dv-tocando');

    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: 'depo_video_play', aluno: fig.getAttribute('data-aluno') || '', pagina: location.pathname });
    } catch (e) { /* medição nunca derruba o player */ }
  });
})();
