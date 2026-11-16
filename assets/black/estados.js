/* ═══════════════════════════════════════════════════════════════
   /black · estados da noite de 25/11 (segunda chance) e do carrinho. O estado já vem decidido no
   <head> (html[data-estado], ver black.html); aqui só o que depende dele:
   - relógio de cada estado;
   - player da live, carregado só no estado ao vivo;
   - os botões "Entrar na lista VIP" do resto da página passam a levar à oferta;
   - a página troca sozinha de estado quando a hora vira (20h, 20h50, 0h e 12h de 26/11 e 0h de 28/11),
     sem precisar recarregar.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  var raiz = document.documentElement;
  var B = window.__black;
  if (!B) return;

  // Id do vídeo da live de 25/11 no YouTube. Vazio até o evento ser criado: os links levam à
  // página /live do canal (abre a transmissão do momento) e o player embutido não aparece.
  var VIDEO = 'sC0MeGlg6t0';
  var LINK_LIVE = VIDEO ? 'https://youtu.be/' + VIDEO : 'https://www.youtube.com/@prof.viniciusferraz/live';
  document.querySelectorAll('a[data-live]').forEach(function (a) { a.setAttribute('href', LINK_LIVE); });
  var BOTAO = {
    'ao-vivo': { txt: 'Assistir à live', href: LINK_LIVE, fora: true },
    condicao: { txt: 'Garantir a vitalícia', href: '#oferta' },
    prorrogacao: { txt: 'Garantir a vitalícia', href: '#oferta' },
    carrinho: { txt: 'Ver as condições', href: '#oferta-carrinho' },
    encerrado: { txt: 'Ver os planos', href: 'assinatura.html' }
  };
  var FIM = {
    condicao: new Date('2026-11-25T23:59:59-03:00'),
    prorrogacao: new Date('2026-11-26T12:00:00-03:00'), // o carrinho começa neste instante
    carrinho: new Date('2026-11-27T23:59:59-03:00')
  };

  function dois(n) { return (n < 10 ? '0' : '') + n; }

  function relogios(estado) {
    var fim = FIM[estado];
    var caixas = document.querySelectorAll('[data-relogio="' + estado + '"]');
    if (!fim || !caixas.length) return;
    var falta = Math.max(0, fim - new Date());
    var s = Math.floor(falta / 1000);
    var v = { dias: Math.floor(s / 86400), horas: Math.floor(s % 86400 / 3600), min: Math.floor(s % 3600 / 60), seg: s % 60 };
    caixas.forEach(function (c) {
      c.querySelectorAll('[data-r]').forEach(function (b) { b.textContent = dois(v[b.getAttribute('data-r')]); });
    });
  }

  function player() {
    var caixa = document.getElementById('st-player');
    if (!caixa || caixa.firstChild || !VIDEO) return;
    var f = document.createElement('iframe');
    f.src = 'https://www.youtube.com/embed/' + VIDEO + '?autoplay=1&mute=1&rel=0';
    f.title = 'Live da Black da Fluência, 2ª chance, 25/11, 20h';
    f.allow = 'autoplay; encrypted-media; picture-in-picture';
    f.allowFullscreen = true;
    caixa.appendChild(f);
  }

  // Os botões da fase de lista guardam o original para poder voltar (?estado= troca na mesma página).
  function botoes(estado) {
    var b = BOTAO[estado];
    // Ao vivo, só o botão do topo muda: o formulário da lista continua na página, e os
    // botões das seções seguem levando a ele.
    var soTopo = !estado || estado === 'ao-vivo';
    var alvos = document.querySelectorAll('.topbar a.cta, .sec a.btn[href="#lista"], .sec a.btn[data-lista]');
    alvos.forEach(function (a) {
      if (!a.hasAttribute('data-lista')) {
        a.setAttribute('data-lista', a.textContent);
      }
      if (!b || (soTopo && !a.matches('.topbar a.cta'))) {
        a.textContent = a.getAttribute('data-lista');
        a.setAttribute('href', '#lista');
        a.removeAttribute('target');
        return;
      }
      a.textContent = b.txt;
      a.setAttribute('href', b.href);
      if (b.fora) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); }
      else a.removeAttribute('target');
    });
  }

  var atual = null;
  function aplicar() {
    var estado = B.estado();
    if (estado !== atual) {
      if (estado) raiz.setAttribute('data-estado', estado); else raiz.removeAttribute('data-estado');
      botoes(estado);
      if (estado === 'ao-vivo') player();
      atual = estado;
    }
    relogios(estado);
  }

  aplicar();
  setInterval(aplicar, 1000);
})();
