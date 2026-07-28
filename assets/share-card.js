/* =============================================================================
   share-card.js — desenha o card social do artigo em Canvas 2D.

   Carregado sob demanda pelo email-capture.js no primeiro clique em "Instagram",
   pra não pesar o caminho crítico dos posts.

   O DESENHO É UMA RÉPLICA de render-artes/share-cards/card-template.html, que é
   a fonte de verdade em HTML/CSS. As medidas abaixo NÃO são chutadas: saem de
   `node _geometria.mjs` naquela pasta, que lê o que o CSS produziu de fato.
   Mexeu no template? Rode o _geometria.mjs, atualize as constantes daqui e rode
   `node test-canvas.mjs` — ele compara os dois.

   Linguagem visual: o template de e-mail da Fluência — cream, cartão branco,
   faixa navy com o wordmark no topo e no pé, blocos de conteúdo em cream.
   O card lista AS SEÇÕES DO ARTIGO: diz o que tem dentro, não só que existe.

   API:  window.FCShareCard.render('feed'|'story', dados) -> Promise<{blob,...}>
   ============================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------- tokens */
  var COR = {
    navy:    '#1B2A4A',
    ouro:    '#C8A84B',
    cream:   '#FBF6E9',
    linha:   '#E8E2D0',
    apagado: '#8B97B3',
    branco:  '#FFFFFF',
    taglineTxt: 'rgba(255,255,255,0.62)',
    handleTxt:  'rgba(255,255,255,0.55)'
  };

  /* Medidas do CSS, extraídas por _geometria.mjs. */
  var FORMATOS = {
    feed: {
      w: 1080, h: 1350,
      margemX: 28, margemTopo: 28, margemBase: 28,
      faixa: 181, rodape: 104,
      padTopo: 46, padLados: 54, padBase: 40,
      tituloMin: 34, tituloMax: 60, tituloLinhas: 3,
      secoesMin: 3, secoesMax: 8, gapBase: 18, gapExtraMax: 22
    },
    story: {
      w: 1080, h: 1920,
      // a UI do Instagram cobre topo e rodapé; o cartão fica confinado
      margemX: 28, margemTopo: 150, margemBase: 190,
      faixa: 181, rodape: 104,
      padTopo: 46, padLados: 54, padBase: 40,
      tituloMin: 38, tituloMax: 68, tituloLinhas: 4,
      secoesMin: 4, secoesMax: 9, gapBase: 18, gapExtraMax: 30
    }
  };

  /* Medidas internas, iguais nos dois formatos (o CSS não as diferencia). */
  var M = {
    faixaPadTopo: 44, wmPx: 42, taglineGap: 14, taglinePx: 14, taglineAlt: 17,
    fioGap: 22, fioLarg: 64, fioAlt: 3,

    sobrancelhaAlt: 19, categoriaPx: 15, leituraPx: 14, sobrancelhaGap: 20,

    tituloEntrelinha: 1.16, tituloTracking: -0.015,

    divisorGapTopo: 30, divisorGapBase: 26,
    rotuloPx: 13, rotuloAlt: 16, rotuloGap: 18,

    // lista simples: marcador redondo dourado + texto, sem caixa
    secaoGapInterno: 18, marcadorTam: 9, marcadorTopo: 13,
    secaoTxtPx: 26, secaoEntrelinha: 1.32,

    maisGap: 14, maisPx: 18, maisAlt: 22,

    rodapePad: 26, dominioPx: 21, dominioAlt: 26, handleGap: 8, handlePx: 16, handleAlt: 20,

    trackCategoria: 0.24, trackLeitura: 0.1, trackRotulo: 0.2,
    trackWm: 0.06, trackTagline: 0.2, trackDominio: 0.04, trackHandle: 0.06
  };

  var FONTE = 'Montserrat FC';           // nome próprio: não conflita com a fonte da página
  var CAMINHO_FONTE = 'fonts/montserrat-latin.woff2';

  /* ------------------------------------------------------------ utilitários */

  /** Base de /assets/, deduzida do próprio <script> — funciona em /blog/x.html. */
  var BASE_ASSETS = (function () {
    var s = document.currentScript || document.querySelector('script[src*="share-card.js"]');
    if (s && s.src) return s.src.replace(/[^/]*$/, '');
    return new URL('assets/', location.origin + '/').href;
  })();

  var suportaEspacamento = (function () {
    try { return 'letterSpacing' in document.createElement('canvas').getContext('2d'); }
    catch (e) { return false; }
  })();

  function fonte(peso, px) {
    return peso + ' ' + px + 'px "' + FONTE + '", Montserrat, sans-serif';
  }

  /** Largura do texto com espaçamento entre letras (`tracking` em "em"). */
  function medir(ctx, texto, tracking, px) {
    if (!tracking) return ctx.measureText(texto).width;
    if (suportaEspacamento) {
      ctx.letterSpacing = (tracking * px) + 'px';
      var w = ctx.measureText(texto).width;
      ctx.letterSpacing = '0px';
      return w;
    }
    // Sem letterSpacing nativo: o CSS insere o espaço DEPOIS de cada caractere.
    return ctx.measureText(texto).width + tracking * px * texto.length;
  }

  /** Escreve com espaçamento entre letras; desenha caractere a caractere se preciso. */
  function escrever(ctx, texto, x, y, tracking, px) {
    if (!tracking) { ctx.fillText(texto, x, y); return; }
    if (suportaEspacamento) {
      ctx.letterSpacing = (tracking * px) + 'px';
      ctx.fillText(texto, x, y);
      ctx.letterSpacing = '0px';
      return;
    }
    var passo = tracking * px, cursor = x;
    for (var i = 0; i < texto.length; i++) {
      ctx.fillText(texto[i], cursor, y);
      cursor += ctx.measureText(texto[i]).width + passo;
    }
  }

  /**
   * Fatia a palavra depois de cada hífen, mantendo o hífen no pedaço anterior:
   * "Auditor-Fiscal):" -> ["Auditor-", "Fiscal):"]
   *
   * Feito na mão de propósito: `split(/(?<=-)/)` seria mais curto, mas lookbehind
   * nem compila em Safari antigo — o script inteiro morreria no parse.
   */
  function fatiarNoHifen(palavra) {
    var partes = [], resto = palavra, pos;
    while ((pos = resto.indexOf('-')) >= 0) {
      partes.push(resto.slice(0, pos + 1));
      resto = resto.slice(pos + 1);
    }
    if (resto) partes.push(resto);
    return partes.length ? partes : [palavra];
  }

  /** Quebra em linhas, permitindo quebrar no espaço E depois do hífen (como o CSS). */
  function quebrar(ctx, texto, larguraMax, tracking, px) {
    var pedacos = [];
    String(texto).split(/\s+/).forEach(function (palavra, i, arr) {
      fatiarNoHifen(palavra).forEach(function (p, j, todas) {
        pedacos.push({ txt: p, espacoDepois: j === todas.length - 1 && i < arr.length - 1 });
      });
    });

    var linhas = [], atual = '';
    for (var i = 0; i < pedacos.length; i++) {
      var candidato = atual + pedacos[i].txt;
      if (atual && medir(ctx, candidato, tracking, px) > larguraMax) {
        linhas.push(atual.replace(/\s+$/, ''));
        atual = pedacos[i].txt;
      } else {
        atual = candidato;
      }
      if (pedacos[i].espacoDepois) atual += ' ';
    }
    if (atual.trim()) linhas.push(atual.replace(/\s+$/, ''));
    return linhas.length ? linhas : [''];
  }

  /* ------------------------------------------------------------- carregamento */

  var fontePronta = null;
  function carregarFonte() {
    if (fontePronta) return fontePronta;
    fontePronta = (function () {
      if (!window.FontFace || !document.fonts) return Promise.resolve(false);
      var face = new FontFace(FONTE, 'url(' + BASE_ASSETS + CAMINHO_FONTE + ')',
                              { weight: '400 900', style: 'normal' });
      return face.load().then(function () {
        document.fonts.add(face);
        // garante que os pesos usados estão prontos ANTES de medir: sem isso o
        // Canvas mede na fonte de fallback sem reclamar
        return Promise.all([
          document.fonts.load('400 18px "' + FONTE + '"'),
          document.fonts.load('600 26px "' + FONTE + '"'),
          document.fonts.load('800 60px "' + FONTE + '"')
        ]);
      }).then(function () {
        return document.fonts.check('800 60px "' + FONTE + '"');
      });
    })()['catch'](function () { return false; });
    return fontePronta;
  }

  /* ------------------------------------------------------------------ desenho */

  function render(nomeFormato, dados) {
    var f = FORMATOS[nomeFormato] || FORMATOS.feed;

    return carregarFonte().then(function (temFonte) {
      var cv = document.createElement('canvas');
      cv.width = f.w; cv.height = f.h;
      var ctx = cv.getContext('2d');

      /* ---- fundo cream e cartão branco ---- */
      ctx.fillStyle = COR.cream;
      ctx.fillRect(0, 0, f.w, f.h);

      var cx = f.margemX, cy = f.margemTopo;
      var cw = f.w - f.margemX * 2;
      var ch = f.h - f.margemTopo - f.margemBase;
      ctx.fillStyle = COR.branco;
      ctx.fillRect(cx, cy, cw, ch);

      /* ---- faixa navy do topo ---- */
      ctx.fillStyle = COR.navy;
      ctx.fillRect(cx, cy, cw, f.faixa);

      var meioX = cx + cw / 2;
      ctx.textBaseline = 'middle';
      ctx.textAlign = 'left';

      // wordmark: FLUÊNCIA branco + CONTÁBIL dourado, centralizados juntos
      ctx.font = fonte(800, M.wmPx);
      var p1 = 'FLUÊNCIA', p2 = 'CONTÁBIL';
      var w1 = medir(ctx, p1, M.trackWm, M.wmPx);
      var wEsp = ctx.measureText(' ').width;
      var w2 = medir(ctx, p2, M.trackWm, M.wmPx);
      var xWm = meioX - (w1 + wEsp + w2) / 2;
      var yWm = cy + M.faixaPadTopo + M.wmPx / 2;
      ctx.fillStyle = COR.branco;
      escrever(ctx, p1, xWm, yWm, M.trackWm, M.wmPx);
      ctx.fillStyle = COR.ouro;
      escrever(ctx, p2, xWm + w1 + wEsp, yWm, M.trackWm, M.wmPx);

      // tagline
      var tag = 'CONTABILIDADE PARA QUEM QUER SER FLUENTE';
      ctx.font = fonte(600, M.taglinePx);
      ctx.fillStyle = COR.taglineTxt;
      var yTag = cy + M.faixaPadTopo + M.wmPx + M.taglineGap + M.taglineAlt / 2;
      escrever(ctx, tag, meioX - medir(ctx, tag, M.trackTagline, M.taglinePx) / 2,
               yTag, M.trackTagline, M.taglinePx);

      // fio dourado
      var yFio = cy + M.faixaPadTopo + M.wmPx + M.taglineGap + M.taglineAlt + M.fioGap;
      ctx.fillStyle = COR.ouro;
      ctx.fillRect(meioX - M.fioLarg / 2, yFio, M.fioLarg, M.fioAlt);

      /* ---- faixa navy do pé ---- */
      var yRodape = cy + ch - f.rodape;
      ctx.fillStyle = COR.navy;
      ctx.fillRect(cx, yRodape, cw, f.rodape);

      var dominio = (dados.dominio || 'fluenciacontabil.com.br') + '/blog';
      ctx.font = fonte(700, M.dominioPx);
      ctx.fillStyle = COR.ouro;
      escrever(ctx, dominio, meioX - medir(ctx, dominio, M.trackDominio, M.dominioPx) / 2,
               yRodape + M.rodapePad + M.dominioAlt / 2, M.trackDominio, M.dominioPx);

      var handle = '@prof.viniciusferraz';
      ctx.font = fonte(500, M.handlePx);
      ctx.fillStyle = COR.handleTxt;
      escrever(ctx, handle, meioX - medir(ctx, handle, M.trackHandle, M.handlePx) / 2,
               yRodape + M.rodapePad + M.dominioAlt + M.handleGap + M.handleAlt / 2,
               M.trackHandle, M.handlePx);

      /* ---- corpo ---- */
      var esq = cx + f.padLados;
      var larg = cw - f.padLados * 2;
      var topoCorpo = cy + f.faixa + f.padTopo;
      var alturaCorpo = ch - f.faixa - f.rodape - f.padTopo - f.padBase;

      var titulo = String(dados.titulo || '').trim();
      var secoes = (dados.secoes || []).filter(Boolean);

      /* --- ajuste em duas dimensões ---
         Preferimos MAIS seções a título maior: o card existe pra dizer o que tem
         dentro do artigo. Para cada quantidade de seções (da maior pra menor),
         busca o maior título que ainda caiba; a primeira combinação vence. */
      var largTextoSecao = larg - M.marcadorTam - M.secaoGapInterno;
      var alturaLinhaSecao = M.secaoTxtPx * M.secaoEntrelinha;

      function alturaBlocos(n) {
        var total = 0;
        ctx.font = fonte(600, M.secaoTxtPx);
        for (var i = 0; i < n; i++) {
          total += quebrar(ctx, secoes[i], largTextoSecao, 0, M.secaoTxtPx).length * alturaLinhaSecao;
        }
        return total;
      }

      function alturaTitulo(px) {
        ctx.font = fonte(800, px);
        return quebrar(ctx, titulo, larg, M.tituloTracking, px).length * px * M.tituloEntrelinha;
      }

      function linhasTitulo(px) {
        ctx.font = fonte(800, px);
        return quebrar(ctx, titulo, larg, M.tituloTracking, px).length;
      }

      var fixo = M.sobrancelhaAlt + M.sobrancelhaGap
               + M.divisorGapTopo + 1 + M.divisorGapBase
               + M.rotuloAlt + M.rotuloGap;

      var disponiveis = Math.min(secoes.length, f.secoesMax);
      var escolhido = null;

      for (var n = disponiveis; n >= Math.min(f.secoesMin, disponiveis) && !escolhido; n--) {
        var resto = secoes.length - n;
        var alturaMais = resto > 0 ? M.maisGap + M.maisAlt : 0;
        var blocos = alturaBlocos(n);
        var min = f.tituloMin, max = f.tituloMax, melhor = 0;
        while (min <= max) {
          var meio = Math.floor((min + max) / 2);
          var total = fixo + alturaTitulo(meio) + blocos + (n - 1) * f.gapBase + alturaMais;
          if (linhasTitulo(meio) <= f.tituloLinhas && total <= alturaCorpo) { melhor = meio; min = meio + 1; }
          else { max = meio - 1; }
        }
        if (melhor) escolhido = { n: n, px: melhor, blocos: blocos, alturaMais: alturaMais };
      }

      if (!escolhido) {
        var nMin = Math.min(f.secoesMin, disponiveis);
        var restoMin = secoes.length - nMin;
        escolhido = { n: nMin, px: f.tituloMin, blocos: alturaBlocos(nMin),
                      alturaMais: restoMin > 0 ? M.maisGap + M.maisAlt : 0, estourou: true };
      }

      // Sobra vertical vira respiro entre os blocos, não vão morto acima do rodapé.
      var usado = fixo + alturaTitulo(escolhido.px) + escolhido.blocos
                + (escolhido.n - 1) * f.gapBase + escolhido.alturaMais;
      var gap = f.gapBase;
      if (escolhido.n > 1) {
        var sobra = alturaCorpo - usado;
        if (sobra > 0) gap += Math.min(f.gapExtraMax, Math.floor(sobra / (escolhido.n - 1)));
      }

      /* --- sobrancelha --- */
      var y = topoCorpo;
      ctx.font = fonte(800, M.categoriaPx);
      ctx.fillStyle = COR.ouro;
      escrever(ctx, String(dados.categoria || '').toUpperCase(), esq, y + M.sobrancelhaAlt / 2,
               M.trackCategoria, M.categoriaPx);

      if (dados.leitura) {
        ctx.font = fonte(600, M.leituraPx);
        ctx.fillStyle = COR.apagado;
        var txtLeitura = String(dados.leitura).toUpperCase();
        escrever(ctx, txtLeitura,
                 esq + larg - medir(ctx, txtLeitura, M.trackLeitura, M.leituraPx),
                 y + M.sobrancelhaAlt / 2, M.trackLeitura, M.leituraPx);
      }
      y += M.sobrancelhaAlt + M.sobrancelhaGap;

      /* --- título --- */
      ctx.font = fonte(800, escolhido.px);
      ctx.fillStyle = COR.navy;
      var alturaLinha = escolhido.px * M.tituloEntrelinha;
      quebrar(ctx, titulo, larg, M.tituloTracking, escolhido.px).forEach(function (linha) {
        escrever(ctx, linha, esq, y + alturaLinha / 2, M.tituloTracking, escolhido.px);
        y += alturaLinha;
      });

      /* --- divisor --- */
      y += M.divisorGapTopo;
      ctx.fillStyle = COR.linha;
      ctx.fillRect(esq, y, larg, 1);
      y += 1 + M.divisorGapBase;

      /* --- rótulo --- */
      ctx.font = fonte(800, M.rotuloPx);
      ctx.fillStyle = COR.ouro;
      escrever(ctx, 'O QUE VOCÊ VAI ENCONTRAR', esq, y + M.rotuloAlt / 2, M.trackRotulo, M.rotuloPx);
      y += M.rotuloAlt + M.rotuloGap;

      /* --- lista das seções: marcador dourado + texto, sem caixa --- */
      var xTexto = esq + M.marcadorTam + M.secaoGapInterno;
      var raio = M.marcadorTam / 2;

      for (var i = 0; i < escolhido.n; i++) {
        ctx.font = fonte(600, M.secaoTxtPx);
        var linhas = quebrar(ctx, secoes[i], largTextoSecao, 0, M.secaoTxtPx);

        // marcador centralizado na primeira linha do texto
        ctx.fillStyle = COR.ouro;
        ctx.beginPath();
        ctx.arc(esq + raio, y + M.marcadorTopo + raio, raio, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COR.navy;
        for (var L = 0; L < linhas.length; L++) {
          ctx.fillText(linhas[L], xTexto, y + alturaLinhaSecao * L + alturaLinhaSecao / 2);
        }

        y += linhas.length * alturaLinhaSecao + (i < escolhido.n - 1 ? gap : 0);
      }

      /* --- "+ N outras seções" --- */
      var restante = secoes.length - escolhido.n;
      if (restante > 0) {
        y += M.maisGap;
        ctx.font = fonte(600, M.maisPx);
        ctx.fillStyle = COR.apagado;
        ctx.fillText('+ ' + restante + (restante === 1 ? ' outra seção no artigo' : ' outras seções no artigo'),
                     esq, y + M.maisAlt / 2);
      }

      return new Promise(function (resolve, reject) {
        cv.toBlob(function (blob) {
          if (blob) resolve({ blob: blob, tituloPx: escolhido.px, secoes: escolhido.n,
                              comFonte: temFonte, estourou: !!escolhido.estourou });
          else reject(new Error('Não foi possível gerar a imagem.'));
        }, 'image/jpeg', 0.92);
      });
    });
  }

  window.FCShareCard = { render: render, FORMATOS: FORMATOS };
})();
