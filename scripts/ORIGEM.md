# Origem da visita e intenção de compra

`assets/origem.js` captura a campanha na entrada, mantém a origem na sessão e
prepara os links para o checkout. Todas as páginas públicas com GTM devem carregar
uma única cópia, com caminho relativo e a versão atual (`?v=20261124`). Isso inclui
páginas sem botão de compra: uma visita ao blog pode continuar até uma oferta.

## Contrato

- A URL com parâmetros de origem substitui a origem anterior, sem misturar campanhas.
  Sem parâmetros, reutiliza `fc_origem` no `sessionStorage` do mesmo domínio.
- Links HTTPS entre o site principal, sua versão `www` e o Dicionário recebem os
  parâmetros de origem. Cookies não são copiados para esses links.
- Somente `https://pay.kiwify.com.br` recebe `s1` (`_fbp` existente), `s2` (`_fbc`
  válido ou valor construído a partir de `fbclid`) e `s3` (host e caminho da página).
  Produto, oferta e posição do botão em `utm_content` são preservados; o criativo
  recebido entra em `utm_term` quando esse campo está livre.
- O instante usado para construir `fbc` permanece estável entre botões e páginas
  da sessão. Um cookie de outro clique não substitui o `fbclid` recém-recebido.
- O clique em checkout envia apenas `checkout_click`, com `cta_location` e
  `pagina`, para o `dataLayer` existente. O GTM faz o mapeamento para
  `ClicouComprar`. O script não emite `InitiateCheckout` ou `Purchase`.
- A inicialização é única mesmo com inclusão duplicada do arquivo. Links criados
  depois do carregamento são tratados pelo listener delegado. Falhas de storage
  ou cookies não bloqueiam a navegação.

Não são criados cookies, tags ou chamadas externas. Se o navegador bloquear o
storage, a origem da URL funciona na página atual, mas sua continuidade entre
páginas depende desse armazenamento. Entre domínios, os parâmetros são levados
pela URL; não há compartilhamento de `sessionStorage`.

## Verificação e manutenção

```sh
node --test scripts/origem.test.mjs
node --test scripts/origem-captura.test.mjs
```

Os testes usam dados sintéticos e APIs nativas do Node. Verificam navegação,
estabilidade do identificador, cookies tardios, storage indisponível, inclusão
duplicada, links dinâmicos, destinos permitidos e cobertura dos HTMLs rastreados
pelo Git. O workflow `origem.yml` executa essa verificação em PRs e merges.

Ao alterar o asset, atualizar a versão nos HTMLs e no teste de cobertura. A rota
`assinaturas.html` apenas redireciona para `assinatura.html`, preservando query e
fragmento; não possui campanha ou tags próprias. Manter as cópias de `origem.js`, deste documento, dos testes e do workflow alinhadas entre
os repositórios do site e do Dicionário.

O ensaio local comprova a preparação dos links e os eventos do script. A recepção
na Meta, a configuração de cada produto na Kiwify e a deduplicação entre navegador
e servidor precisam de homologação separada; não são comprovadas por estes testes.

Referências: [dataLayer do Google](https://developers.google.com/tag-platform/tag-manager/datalayer),
[tratamento oficial de click ID da Meta](https://github.com/facebook/capi-param-builder/blob/main/client_js/shared/utils/cookieUtil.js)
e [eventos do pixel na Kiwify](https://ajuda.kiwify.com.br/pt-br/article/como-configurar-o-pixel-do-facebook-1rb2xtr/).

## Captura após navegação interna — 16/09/2026

No site principal, `email-capture.js` usa o mesmo snapshot `FC_ORIGEM.origem`
para os seis parâmetros já aceitos pelo formulário: `utm_source`, `utm_medium`,
`utm_campaign`, `utm_content`, `utm_term` e `src`. Assim, entrar pelo anúncio,
navegar para outra página e preencher um widget conserva campanha e anúncio.
Uma nova campanha substitui o conjunto anterior; campos ausentes não são
completados com IDs de outra visita. Sem o asset, continua valendo a URL atual.

Não há novos campos pessoais, cookies, persistência ou chamadas de rede.
O teste reproduz a perda no código anterior, percorre a inicialização real de
`origem.js` entre páginas e inspeciona o corpo produzido pela função real dos
formulários com `fetch` simulado. Não inscreve leads nem envia eventos externos.
O transporte `no-cors` já existente continua sem confirmação legível de gravação;
o evento de captura no `dataLayer` não foi convertido em comprovante de servidor.

Ensaio no Google Chrome isolado: entrada com campanha, navegação para um post
sem parâmetros e envio pelo formulário real da newsletter preservaram os seis
campos. POST interceptado, sem cadastrar lead real. Também foram conferidos o
decorador entre domínios com âncora sintética e o CTA real do rodapé do Dicionário:
campanha/ID de anúncio, `s1` e `s2` chegaram à URL de checkout; um clique gerou
uma intenção `checkout_click`. GTM, Panda e chamadas externas foram bloqueados.
Isso não homologa o CTA interno do iframe Panda nem a entrega nativa de eventos.

Os dois `origem.js` publicados em 16/09 foram comparados com os arquivos
auditados: conteúdo idêntico, normalizando apenas finais de linha. O
`email-capture.js` publicado também correspondia ao código anterior que perde
as UTMs após navegação. A correção requer merge/publicação deste PR.

## Primeiro e último toque — 24/11/2026

Contrato: `_contrato_origem_toques.md` (site, Apps Script e Gestão seguem o mesmo
arquivo). O `origem.js` passa a guardar, além da origem da sessão, o primeiro e o
último toque da pessoa em `localStorage` (`fc_toques`), nunca em cookie.

- Toque = chegada com `utm_*`, `src`, `fbclid` ou `gclid` na URL, ou com referrer
  de domínio de fora da marca. Referrer de `fluenciacontabil.com.br`, `kiwify.com.br`
  (e subdomínios) ou do próprio host é navegação interna. `sck` sozinho não é toque.
  Visita direta não cria toque.
- O primeiro toque é gravado uma vez e só é trocado quando o registro expira. O
  último é sempre o mais recente. Validade: 90 dias contados do último toque,
  conferida ao carregar e também na hora do envio; expirado, os dois somem.
- Página e referrer guardam só host + caminho (sem query, fragmento ou porta).
  Valor acima de 300 caracteres é descartado (não truncado). Valor com cara de
  e-mail é descartado.
- `FC_ORIGEM.camposDoLead()` devolve um objeto plano com `pt_source`, `pt_medium`,
  `pt_campaign`, `pt_content`, `pt_term`, `pt_src`, `pt_pagina`, `pt_referrer`,
  `pt_em`, `entrada`, `ut_em`, `fbclid` e `gclid`, todos string (vazios quando não
  há toque). Datas em ISO 8601 UTC.
- `FC_ORIGEM.anexarCamposDoLead(corpo)` acrescenta esses campos a um
  `URLSearchParams`, `FormData` ou objeto, sem sobrescrever o que o formulário já
  manda. `FC_ORIGEM.contextoDoLead()` devolve o mesmo contexto do `email-capture.js`
  (página, referrer, `utm_*` e `src` da sessão, dispositivo) mais os campos acima,
  para formulários que não passam por ele (reserva da newsletter dos posts).
- Os campos de hoje (`utm_*`, `src`, `pagina`, `referrer`, `dispositivo`, `origem`,
  `ref`) continuam iguais e continuam vindo da sessão.
- O checkout não muda: a Kiwify continua recebendo só a origem da sessão
  (`fc_origem`, lista `HERDA`, `s1`/`s2`/`s3`). O teste
  `checkout continua igual` confere que o registro de toques não entra no link.
- Com o `localStorage` bloqueado (ou cheio), nada lança: o formulário recebe ao
  menos o toque da página atual, guardado em memória.

Quem posta no Apps Script: `assets/email-capture.js` (`submitEmail`, que cobre
exit-intent, barra fixa, CTA dos posts, lista de espera e a newsletter dos posts
interceptada), `aula-ao-vivo.html`, `aula-sefaz-sc.html`, `aula-transpetro.html`,
`black.html`, `quiz.html`, `assinatura.html` e a função de reserva
`subscribeNewsletter()` de `blog.html` e dos posts. O teste
`toda página que posta no Apps Script manda os campos de toque` reprova página
nova que poste sem eles.
