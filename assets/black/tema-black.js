/* ═══════════════════════════════════════════════════════════════
   Tema da Black da Fluência — camada TEMPORÁRIA sobre o site.
   Liga sozinho de 24/10/2026 0h a 28/11/2026 0h (Brasília); fora da janela
   não faz nada, e para desfazer basta deixar a data passar.
   Para homologar antes: ?tema=black no endereço.

   Vai no <head>, de forma síncrona, logo depois do assets/black/tema-black.css,
   para a classe html.tema-black existir antes da primeira pintura.

   Modo da página (atributo data-black do próprio <script>):
     (sem)            páginas do site: visual, faixa, selo no menu, botão de
                      assinar levando à /black e, até 11/11 20h, nada de
                      "matrículas abertas" nem preço da assinatura;
     pacote           páginas de concurso (SEFAZ SC, SEFAZ AL, Transpetro): os
                      pacotes seguem à venda (decisão de 20/10), então muda só o
                      visual e a faixa; o texto e o preço ficam como estão;
     bio              links.html: ganha o destaque da lista VIP, o selo no topo
                      e o atalho da assinatura leva à /black;
     redirecionar     assinatura.html e quiz.html: com a Black no ar, vão
                      direto para a /black, levando a etiqueta de origem.

   Decisões do Vinícius em 20/10/2026 (página "Site na Black"). Até 11/11 20h
   as vendas da assinatura estão fechadas; de 11/11 20h a 27/11 a condição da
   Black mora na própria /black, então os botões continuam indo para lá. */
(function () {
  'use strict';
  var INICIO = Date.parse('2026-10-24T00:00:00-03:00');
  var FIM = Date.parse('2026-11-28T00:00:00-03:00');
  var REABRE = Date.parse('2026-11-11T20:00:00-03:00');
  var agora = Date.now();
  var forcado = /[?&]tema=black(?:&|$)/.test(location.search);
  if (!forcado && (agora < INICIO || agora >= FIM)) return;

  var script = document.currentScript;
  var modo = (script && script.getAttribute('data-black')) || 'site';
  if (modo === 'redirecionar') {
    location.replace('/black' + location.search + location.hash);
    return;
  }

  var raiz = document.documentElement;
  var fechado = agora < REABRE;
  raiz.classList.add('tema-black');
  if (fechado) raiz.classList.add('tema-black-fechado');

  var SELO = '/assets/email/logo-black-selo.png';
  var DESTINO = '/black';
  var BOTAO = fechado ? 'Entrar na lista VIP' : 'Ver a condição da Black';
  var AVISO = fechado
    ? 'Black da Fluência · vendas fechadas até 11/11 · 11/11, 20h, ao vivo '
    : 'Black da Fluência · a condição vale até 27/11 ';

  function el(tag, attrs, texto) {
    var e = document.createElement(tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (texto) e.textContent = texto;
    return e;
  }

  // a faixa do topo: a #topbar do site.css quando existe; senão, uma faixa nova no início da página
  function faixa() {
    var barra = document.getElementById('topbar');
    if (!barra) {
      barra = el('div', { 'class': 'fc-black-faixa', role: 'note' });
      barra.appendChild(el('img', { src: SELO, alt: '', width: '22', height: '22' }));
      document.body.insertBefore(barra, document.body.firstChild);
    } else {
      barra.textContent = '';
    }
    barra.appendChild(document.createTextNode(AVISO));
    barra.appendChild(el('a', { href: DESTINO }, BOTAO + ' →'));
  }

  // botões de compra da assinatura: o destino é a /black, levando a etiqueta de origem que já tinham
  function botoes() {
    var cursos = /(^|\/)cursos\.html#assinar$/;
    var naCursos = /(^|\/)cursos(\.html)?$/.test(location.pathname);
    var assinatura = /^(?:\.\.\/|\/)?(assinatura|quiz)(?:\.html)?(\?[^#]*)?(#.*)?$/;
    var verbo = /assin|planos|conhecer o método|estudar com o prof/i;
    Array.prototype.forEach.call(document.querySelectorAll('a[href]'), function (a) {
      var href = a.getAttribute('href'), m = href.match(assinatura);
      if (m) a.setAttribute('href', DESTINO + (m[2] || ''));
      else if (cursos.test(href) || (naCursos && href === '#assinar')) a.setAttribute('href', DESTINO);
      else return;
      if (modo === 'site' && verbo.test(a.textContent) && !a.querySelector('svg')) {
        a.textContent = /→/.test(a.textContent) ? BOTAO + ' →' : BOTAO;
      }
    });
  }

  function seloNoMenu() {
    var logo = document.querySelector('#mainNav .nav-logo');
    if (logo) {
      logo.classList.add('fc-black-marca');
      logo.textContent = '';
      logo.appendChild(el('img', { src: SELO, alt: 'Black da Fluência', width: '52', height: '52' }));
      var nome = el('span', {}, 'Fluência ');
      nome.appendChild(el('b', {}, 'Contábil'));
      logo.appendChild(nome);
    }
    // marca-d'água do topo da home: o <source> do <picture> manda na imagem, então sai
    var marca = document.querySelector('img.hero-logo');
    if (marca) {
      if (marca.parentNode && marca.parentNode.tagName === 'PICTURE') {
        Array.prototype.forEach.call(marca.parentNode.querySelectorAll('source'), function (s) { s.remove(); });
      }
      marca.removeAttribute('srcset');
      marca.src = SELO;
    }
  }

  // "Matrículas abertas" e o preço da assinatura não podem aparecer com as vendas fechadas
  function vendasFechadas() {
    var trocas = [[/As matrículas estão abertas\./, 'As matrículas reabrem em 11/11, às 20h.'],
                  [/Matrículas abertas/, 'Vendas fechadas até 11/11']];
    var preco = /R\$\s?(427|547|697|44,16|56,57)\b/;
    var comPreco = [];
    var anda = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (var n = anda.nextNode(); n; n = anda.nextNode()) {
      for (var i = 0; i < trocas.length; i++) {
        if (trocas[i][0].test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(trocas[i][0], trocas[i][1]);
      }
      if (preco.test(n.nodeValue) && n.parentElement) comPreco.push(n.parentElement);
    }
    comPreco.forEach(function (e) {
      if (!e.isConnected) return;
      var p = e.closest('p');
      if (p) {
        p.textContent = 'A assinatura reabre em 11/11, às 20h, ao vivo, por uma noite, na maior condição que a Fluência já fez.';
        return;
      }
      var bloco = e.closest('li, span, small, div');
      if (bloco && bloco.textContent.length < 260 && !bloco.querySelector('a')) bloco.style.display = 'none';
    });

    var fixa = document.querySelector('.cta-fixa-txt');
    if (fixa) {
      fixa.textContent = '';
      fixa.appendChild(el('b', {}, 'Vendas fechadas até 11/11'));
      fixa.appendChild(el('span', {}, '11/11, 20h, ao vivo · lista VIP'));
    }

    var planos = document.getElementById('assinar');
    if (planos) {
      var bloco = el('div', { 'class': 'fc-black-fechado' });
      bloco.appendChild(el('img', { src: SELO, alt: '' }));
      bloco.appendChild(el('span', { 'class': 'k' }, 'Vendas fechadas até 11/11'));
      var h = el('h2', {}, 'A assinatura reabre em 11/11, às 20h, ');
      h.appendChild(el('em', {}, 'na maior condição que a Fluência já fez.'));
      bloco.appendChild(h);
      bloco.appendChild(el('p', {}, 'É uma noite só, ao vivo no YouTube. Quem está na lista VIP recebe o link 10 minutos ' +
        'antes de todo mundo e ganha na hora o Raio-X da Banca.'));
      bloco.appendChild(el('a', { href: DESTINO }, 'Entrar na lista VIP'));
      planos.textContent = '';
      planos.appendChild(bloco);
    }
  }

  // links.html (o link da bio): destaque da lista VIP acima da aula da semana e selo no topo
  function bio() {
    var etiqueta = '?src=bio&utm_source=instagram&utm_medium=bio&utm_campaign=bio-links&utm_content=black';
    var logo = document.querySelector('.topo picture, .topo img');
    if (logo) {
      var selo = el('img', { src: SELO, alt: '', width: '54', height: '54', 'class': 'fc-black-selo-bio' });
      logo.parentNode.replaceChild(selo, logo);
    }
    var dest = document.getElementById('dest');
    if (dest) {
      var card = el('a', { 'class': 'fc-black-dest', href: DESTINO + etiqueta, 'data-bio': 'black' });
      card.appendChild(el('img', { src: SELO, alt: '' }));
      var txt = el('span', { 'class': 'txt' });
      txt.appendChild(el('span', { 'class': 'k' }, fechado ? 'Black da Fluência · 11/11, 20h' : 'Black da Fluência · até 27/11'));
      txt.appendChild(el('strong', {}, fechado ? 'Entre na lista VIP e ganhe o Raio-X da Banca' : 'A maior condição que a Fluência já fez'));
      txt.appendChild(el('span', { 'class': 'go' }, BOTAO + ' →'));
      card.appendChild(txt);
      dest.parentNode.insertBefore(card, dest);
    }
    var tile = document.querySelector('a.t.venda span');
    if (tile) tile.textContent = 'Black · lista VIP';
  }

  function aplicar() {
    if (modo === 'bio') bio(); else faixa();
    botoes();
    if (modo === 'site') {
      seloNoMenu();
      if (fechado) vendasFechadas();
    }
    // o robô de dúvidas do contato (variável global res) não pode prometer matrícula aberta nem preço
    if (modo === 'site' && fechado && window.res && typeof window.res.preco === 'string') {
      var lista = 'As vendas da assinatura estão fechadas até 11/11. Nesse dia, às 20h, ao vivo, abro por uma noite a maior ' +
        'condição que a Fluência já fez. Entre na <a href="/black" style="color:var(--dourado);font-weight:700">lista VIP</a> para saber primeiro.';
      window.res.lista = lista;
      window.res.lance = lista;
      window.res.preco = lista;
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', aplicar);
  else aplicar();
})();
