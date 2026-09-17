# Preservar criativo e anúncio na planilha

O formulário envia `src`, `utm_content` e `utm_term`. Este patch preserva esses valores no endpoint Apps Script, além das três UTMs que já eram gravadas. É a etapa anterior à importação de leads do Gestão.

## O que muda

Newsletter, Lista de Espera, Dicionário, Bolsão e Lives passam por `appendLeadWithTracking_`. O helper localiza colunas pelo cabeçalho e acrescenta apenas as ausentes **ao final**, depois das colunas existentes de SES/CRM. A posição dos campos anteriores e as linhas antigas ficam preservadas. IDs são texto; valores com aparência de fórmula são escapados. A gravação usa um trinco e libera-o mesmo em erro.

O handler de Lives recebe a linha efetivamente gravada para atualizar o status das integrações. A correção não depende de alterar os triggers nem de reprocessar envios antigos.

## Publicação Google necessária

O merge deste repositório **não publica o Apps Script**. Conferir a versão atualmente implantada no projeto que recebe os formulários. Aplicar o diff em [apps_script_unified.gs](../scripts/apps_script_unified.gs): substituir as cinco funções `handleNewsletter`, `handleLista`, `handleDicionario`, `handleBolsao`, `handleLives` e adicionar `appendLeadWithTracking_`. Preservar os módulos e alterações existentes que não façam parte deste patch. Não adicionar uma segunda cópia dos handlers.

Salvar e atualizar **a implantação Web App existente** para a nova versão, mantendo a URL usada pelas páginas. Não executar os helpers `test*Flow` na base real: eles disparam as integrações de contato. O teste automatizado abaixo não faz chamadas externas.

As três colunas são criadas no primeiro recebimento de cada aba. A homologação pode acompanhar a próxima captura real: verificar o texto do ID, depois sincronizar o Gestão e conferir **Lead → Por onde entrou → Ver rastreamento**. `Origem` continua sendo o formulário; `Src` é o canal do link. Abas alimentadas por outro escritor precisam de ajuste próprio para persistir esses campos.

## Validação e limites

Executar `node --test scripts/apps-script-rastreamento.test.mjs scripts/origem.test.mjs scripts/origem-captura.test.mjs scripts/vsl.test.mjs`.

38 testes passaram, incluindo nove casos do escritor: cinco fluxos, preservação de histórico/status/índices, cabeçalhos fora de ordem, compatibilidade com formulário antigo, recusa de cabeçalho ambíguo e tratamento de IDs/fórmulas. Os testes simulam a API Google e não comprovam publicação. O Apps Script real ainda não foi atualizado nesta entrega.

Referências da API usadas no patch: [Range — valores e formato](https://developers.google.com/apps-script/reference/spreadsheet/range), [LockService — exclusão entre execuções](https://developers.google.com/apps-script/reference/lock/lock-service).
