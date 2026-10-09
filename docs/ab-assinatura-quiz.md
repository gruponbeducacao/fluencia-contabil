# Teste A/B: assinatura.html × quiz.html

Código: `assets/ab-assinatura-quiz.js` (carregado no `<head>` das duas páginas, antes do GTM).
Testes: `scripts/ab-assinatura-quiz.test.mjs` (rodam no workflow `origem.yml`).

## Como funciona
- Só entra no teste quem chega de anúncio pago: `utm_medium=cpc`, `fbclid` ou `gclid`. Orgânico e direto ficam na `assinatura.html`.
- O sorteio é 50/50 (`pctQuiz`) e fica no `localStorage` (`fc_ab_assinatura_quiz`, 30 dias): a mesma pessoa vê sempre a mesma versão.
- Sorteado para o quiz: `location.replace('/quiz.html' + query + hash)`. As UTMs e o `src` do anúncio chegam ao quiz e o `origem.js` os leva até a Kiwify, igual à assinatura.
- Evento no dataLayer, uma vez por visita das duas versões: `ab_atribuido` com `ab_teste=assinatura_quiz`, `ab_variante=quiz|assinatura`, `ab_pct_quiz`.

## Como ler
- Venda: a Kiwify grava `s3` = `host + pathname` da página do clique (`.../assinatura.html` ou `.../quiz.html`); `src` e `utm_term` trazem o criativo.
- Clique em comprar: `checkout_click` traz `pagina` (`/assinatura.html` ou `/quiz.html`) e `cta_location`.
- Métrica principal: `checkout_click` por visitante único de cada versão; a venda é a confirmação.
- O anual (R$ 814,80) só existe no quiz: é uma segunda variável do teste.

## Ligar, mudar e desligar
- Mudar a proporção: `pctQuiz` no arquivo (quem já foi sorteado mantém a versão).
- Parar o teste: `ativo = false` e subir o `?v=` nas duas páginas. A `assinatura.html` deixa de redirecionar.
- QA: `?ab=quiz` ou `?ab=assinatura` força a versão, sem gravar e sem emitir evento.

## GTM (fora do repositório)
Criar um gatilho de evento personalizado para `ab_atribuido`, e variáveis de camada de dados `ab_variante` e `ab_teste` enviadas ao GA4. Os eventos do quiz (`quiz_inicio`, `quiz_resposta`, `quiz_frase`, `quiz_overlay`, `quiz_oferta_vista`, `download_aula01`, `lead_capturado`) também precisam de gatilho.
