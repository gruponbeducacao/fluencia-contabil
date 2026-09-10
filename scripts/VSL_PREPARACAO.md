# Preparação da VSL e captura da amostra

Estado verificado em 10/09/2026: preparação local, sem ativação do vídeo. O slot
`heroVsl` continua com `hidden`, ID de vídeo pendente e metadados vazios. Preços,
links de checkout, PDF e endpoint do Apps Script permanecem os existentes na
página. Este documento descreve o contrato do código; não atesta configuração
publicada no Panda, GTM, Meta, Apps Script ou Gestão.

## Arquivos e limites desta entrega

- `assinatura.html`: página canônica, slot de VSL e captura local da Aula 01.
- `assinaturas.html`: apelido que encaminha para a página canônica.
- `assets/vsl.js`: receptor dos eventos do iframe; envia somente ao `dataLayer`.
- `assets/origem.js` e [ORIGEM.md](ORIGEM.md): atribuição da visita e cliques no
  checkout, com contrato próprio preservado.
- `scripts/vsl.test.mjs`: ensaios isolados do receptor, apelido e captura.

O vídeo não bloqueia rolagem, pausa ou acesso à oferta. O CTA interno do slot
aponta para `#oferta`. A preparação não cria uma segunda oferta e não modifica os
valores trimestral ou semestral. A ativação deve usar a oferta e o roteiro
homologados para a gravação, sem inserir prazo, escassez ou garantia de aprovação.

## Ativar depois da gravação

Preparar os quatro valores reais juntos antes de retirar `hidden`:

| Local | Valor esperado |
| --- | --- |
| `heroVslFrame[data-src]` | URL HTTPS do embed Panda da biblioteca existente, substituindo `__PANDA_ID__` pelo ID externo real no parâmetro `v`. |
| `heroVsl[data-vsl-version]` | Identificador não vazio da edição gravada. Mudar quando mudar a edição ou os pontos medidos. |
| `heroVsl[data-vsl-duration]` | Duração real do arquivo em segundos, maior que zero. |
| `heroVsl[data-vsl-pitch]` | Segundo real em que começa a apresentação da oferta; maior que zero e menor que a duração. |

O receptor aceita a origem HTTPS do host configurado, no formato
`player-….tv.pandavideo.com.br`, e exige que a mensagem venha do `contentWindow`
daquele iframe. A mensagem precisa ser um objeto, com `message` textual e, para
amostragem, `currentTime` numérico válido. Não converter mensagens de outra janela
ou origem em eventos de reprodução.

Manter o iframe sem atributo `src` no HTML. O carregador inline copia `data-src`
para `src` apenas quando o slot nasce visível e o ID está preenchido. O receptor
também exige versão, duração e pitch válidos: preencher só o ID pode carregar um
vídeo sem instalar sua medição. Por isso os quatro valores são uma única etapa
de preparação, conferida no ensaio antes da ativação.

Recarregar a página após mudar a configuração. Os scripts não observam alterações
dinâmicas desses atributos, e o receptor possui guarda de instalação única.
Não retirar `hidden` em produção antes de homologar vídeo, dados e eventos.

## Contrato de eventos e GTM

O código não contém envio direto à Meta nem instala novas tags. O GTM existente
é responsável por consentimento, destino e mapeamento dos eventos. A tabela traz
nomes exatos do `dataLayer` e uma convenção possível para eventos personalizados
da Meta, a configurar e homologar no container; essa configuração não faz parte
do código entregue.

| `event` no `dataLayer` | O que significa | Mapeamento Meta proposto |
| --- | --- | --- |
| `vsl_start` | Primeiro `panda_play` com a página visível; se o play ocorreu oculto, primeiro `panda_timeupdate` válido já visível enquanto a reprodução continua. | `VSLPlay` |
| `vsl_25`, `vsl_50`, `vsl_75`, `vsl_95` | A união dos trechos contabilizados atingiu o percentual da duração configurada. | `VSL25`, `VSL50`, `VSL75`, `VSL95` |
| `vsl_30s`, `vsl_60s` | A união dos trechos contabilizados atingiu 30 ou 60 segundos de conteúdo. | Diagnóstico; envio à Meta opcional. |
| `vsl_pitch_reached` | A reprodução atravessou o segundo configurado como início da oferta, sem um salto detectado. | `VSLPitch` |
| `vsl_cta_click` | Clique no CTA marcado com `data-fc-vsl-cta` dentro do slot; navega para a oferta. | `VSLCTA` |
| `vsl_pause`, `vsl_error` | Primeiro aviso de pausa ou erro recebido do iframe. | Diagnóstico; envio à Meta opcional. |

Cada evento traz `content_name: assinatura_2026`, `vsl_version`, `video_id`,
`video_duration`, `video_position`, `watched_seconds` e `watched_percent`.
Posição e segundos são arredondados; percentual é truncado e limitado a 100.
Nenhum desses campos contém e-mail. A posição do CTA usa a última posição válida
informada pelo player nesta página, preservada após pausa ou término; se nenhuma
posição foi informada, será zero.

Todos os eventos da tabela são emitidos no máximo uma vez por vídeo + versão na
sessão disponível, inclusive pausa, erro e CTA. Logo `vsl_pause` não conta todas
as pausas e `vsl_cta_click` não conta todos os cliques repetidos. A chave de
`sessionStorage` é `fc_vsl_session:<video_id>:<vsl_version>`; guarda os eventos já
emitidos e os intervalos contabilizados. Recarregar a mesma edição nessa sessão
preserva a deduplicação. Sem acesso a esse armazenamento, a deduplicação vale
somente enquanto a página atual permanece carregada.

Os marcos medem trechos distintos de conteúdo sob as condições do receptor, e
não atenção humana comprovada. Reassistir ao mesmo trecho não aumenta a união.
O script descarta amostras com aba oculta, seeking ativo, posição inválida,
salto incompatível com o tempo transcorrido ou intervalo de amostragem superior
a cinco segundos. Mudança de velocidade reinicia a amostragem; velocidades
informadas entre 0,25 e 4 são consideradas. Há tolerância de 0,6 segundo no
avanço e 0,05 segundo na junção de intervalos; são proteções práticas, não
telemetria perfeita. A lista é limitada a 200 intervalos, podendo subcontar
sessões muito fragmentadas. Uma reprodução em 2× contabiliza segundos de
conteúdo, não segundos de relógio.

Voltar para uma aba visível apenas reinicia a amostragem. O callback de
`visibilitychange` não fabrica `play` ou `vsl_start`: aguarda mensagem válida do
player. O indicador com `isMutedIndicator: true` é ignorado. Essa regra não
identifica todo autoplay silencioso possível; conferir o comportamento da
configuração real do Panda. Chegar ao pitch também não significa ter assistido
à argumentação inteira, nem ter lido a oferta.

O clique no CTA da VSL não é checkout. Os links reais da Kiwify continuam
produzindo `checkout_click` pelo contrato de origem, a ser mapeado no GTM como
`ClicouComprar`. Não mapear eventos de vídeo, visualização da oferta, cadastro,
download, clique de compra ou Pix gerado como `Purchase`. O pagamento aprovado
precisa ser confirmado pelo fluxo efetivo do checkout e sua integração, com
deduplicação própria entre navegador e servidor. Este receptor não emite
`InitiateCheckout` ou `Purchase`.

## Apelido da página e atribuição

Com JavaScript, `assinaturas.html` usa `location.replace` e preserva a query
inteira e o fragmento ao encaminhar para `assinatura.html`. O apelido não carrega
seu próprio GTM. Não recriar a antiga variante pelo gerador B removido. O
fallback sem JavaScript leva à página canônica, mas não preserva query e
fragmento; a continuidade completa da atribuição depende de JavaScript.

Conferir entrada com UTMs e `fbclid`, passagem pelo apelido, navegação até a
oferta e URL final do checkout conforme [ORIGEM.md](ORIGEM.md). O teste local
comprova o encaminhamento da URL; não comprova que a plataforma de anúncios
recebeu ou atribuiu uma venda.

## PDF, e-mail, Apps Script e planilha

O botão da amostra mantém
`aulas/aula-01-partidas-dobradas.pdf?v=20260813`, com o download disparado por
um link criado pelo script. Um visitante sem sinal local de cadastro vê o
formulário; o código valida o formato do e-mail e envia `POST` com
`URLSearchParams` ao mesmo `ENDPOINT` do Apps Script já presente no bloco de
captura. A página continua sem carregar `assets/email-capture.js`.

Campos enviados: `email`, `origem=assinatura_aula01`, `pagina` (caminho e query),
`referrer`, `utm_source`, `utm_medium`, `utm_campaign` e `dispositivo`.
`utm_content` e `utm_term` não são campos separados desse formulário. Não
adicionar e-mail ao `dataLayer`, parâmetros do player ou eventos da Meta.

O transporte permanece `mode: no-cors`. Quando a promessa de `fetch` resolve,
o código marca a página como enviada, tenta gravar `fc_ec_subscribed=1`, emite
`lead_capturado` com a origem, mostra a confirmação visual e tenta baixar o PDF.
Quando a chamada rejeita por falha de rede, o formulário permanece disponível,
o botão é reabilitado e nenhum cadastro/download é registrado no `dataLayer`.

Uma resposta opaca de `no-cors` não permite ao navegador verificar status HTTP,
resultado de negócio nem linha gravada. Portanto `lead_capturado` significa
envio concluído do ponto de vista desse fluxo do navegador, não cadastro
confirmado no servidor. Um erro devolvido pelo servidor pode ser indistinguível
de sucesso aqui. A correção definitiva desse limite exigiria um contrato de
resposta verificável no endpoint; ele foi preservado nesta preparação.

O comentário de integração existente na página informa que
`assinatura_aula01`, sem rota própria, cai na aba `Newsletter`, contemplada na
sincronização. Conferir isso no Apps Script e na planilha reais antes de usar
o dado operacionalmente. Conferir também a ingestão pela Gestão, seus campos,
deduplicação e rotina agendada; não inferir recebimento a partir do modal ou
do tempo decorrido. Nenhuma linha de produção foi enviada durante estes testes.

A chave local é compartilhada com capturas anteriores: é uma conveniência,
não prova atual de existência do e-mail na planilha. Se `localStorage` estiver
bloqueado, o estado em memória permite novo download após o primeiro envio na
mesma página; ao recarregar, poderá ser necessário preencher de novo. A chave
não armazena o endereço de e-mail.

`download_aula01` registra a tentativa de abrir/baixar, com `metodo=com_email`
ou `ja_lead` e `cta_location`; não confirma arquivo concluído no dispositivo.
O PDF continua público por URL. Esse formulário organiza o caminho normal da
amostra e não constitui proteção de acesso ao arquivo.

## Homologação antes de anunciar

1. Conferir o arquivo gravado, a edição, a duração e o início da oferta. Abrir
   uma cópia de homologação com os quatro valores reais e recarregar.
2. Verificar o iframe real e as mensagens do Panda. Confirmar origem, janela,
   nomes de eventos, campos de tempo, seek, velocidade e indicador de autoplay.
   Os ensaios sintéticos abaixo não substituem essa compatibilidade.
3. Executar play normal, play com a aba oculta e retorno sem novo play, pausa,
   fim, retomada, replay, seek para além do pitch e mudança de velocidade.
   Conferir eventos únicos, posição do CTA após pausa/fim e retenção sem saltos.
4. Conferir atualização da página na mesma sessão e nova versão, inclusive
   armazenamento indisponível. Não reutilizar dados de QA como tráfego real.
5. No GTM Preview, validar gatilhos pelo nome exato, variáveis do payload,
   consentimento e ausência de tags duplicadas. Validar recepção no destino
   pretendido sem transformar diagnósticos em compras.
6. Em dispositivos móveis, conferir vídeo, texto, CTA, teclado e modal em
   Android, iPhone e navegador interno do Instagram. Abertura deve focar o
   e-mail; fechamento deve devolver o foco. Conferir também Tab, Escape,
   leitura do diálogo, teclado aberto e rolagem. O código atual não implementa
   confinamento de foco no modal; essa limitação permanece para o QA de teclado.
7. Com e-mail de teste autorizado, conferir envio, linha real na planilha,
   origem/campanha e posterior ingestão na Gestão. Testar falha de rede,
   formato inválido, reabertura e novo download com armazenamento bloqueado.
   Conferir o PDF efetivamente aberto no dispositivo.
8. Conferir UTMs no apelido e no checkout; validar a integração real de
   pagamento aprovado e a deduplicação correspondente. Registrar evidências
   de configuração e resultado antes de ativar campanhas.

## Verificação local executada

```sh
node --test scripts/origem.test.mjs scripts/vsl.test.mjs
python scripts/fiscal_persuasao_assinatura.py
```

Resultado em 10/09/2026: **22 testes passaram** (12 de origem + 10 de VSL,
apelido e captura); **fiscal com 82 OK e zero falhas**. O fiscal foi executado
com o Python do ambiente local do projeto. O HTML mantém CRLF.

As regressões cobrem os três problemas corrigidos nesta revisão: CTA perdia
a posição após pausa/fim; play em aba oculta contava início prematuro; modal
sem armazenamento persistente impedia novo download na mesma página. Também
há verificação de falha de rede sem falso evento de envio/download. O harness
usa iframe, relógio, storage, DOM e `fetch` simulados: não acessa o endpoint,
Panda, planilha, checkout ou contas de anúncios. Publicação e homologação real
dessas integrações permanecem etapas distintas.
