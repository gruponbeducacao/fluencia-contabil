# Origem no escritor ativo da planilha

O projeto Google que recebe os formulários estava na versão 18, de 15/09/2026. Ele já usa o escritor por cabeçalho com `Sheets.Spreadsheets.batchUpdate / appendCells`, além de filas e regras de WhatsApp posteriores ao arquivo histórico `apps_script_unified.gs`.

O patch compatível com esse projeto está em [apps-script-origem-ativo.gs](../scripts/apps-script-origem-ativo.gs) e [apps-script-origem-colunas.gs](../scripts/apps-script-origem-colunas.gs). A comparação real preservou os demais cinco módulos e alterou apenas Código.gs e captura_correcao.gs. Não publicar o arquivo histórico inteiro sobre o projeto ativo.

## Aplicação

Substituir as seis funções de captura, `appendLeadByHeader_` e `doGet` pelas funções homônimas do patch; adicionar uma única cópia de `leadTrackingRow_`, `schemasOrigemTracking_`, `diagnosticarOrigemTracking` e `prepararColunasOrigemTracking`. Conferir as funções existentes antes de aplicar. Não criar uma segunda definição dos handlers. Salvar e atualizar a implantação Web App existente, mantendo URL, executor e público.

Newsletter, Lista, Dicionário, Bolsão, Lives e Aulas ao Vivo passam os três parâmetros adicionais ao mesmo escritor. Campos antigos, estado das filas, fallback de WhatsApp, roteamento de aulas e trabalhador assíncrono ficam preservados. O GET passa a exibir `origem-v1-20260917`, sem criar contato.

As colunas são acrescentadas depois da grade existente, sem deslocar histórico ou SES/CRM. Um lock protege apenas sua criação. Com as colunas prontas, a captura não disputa o lock usado pelos trabalhadores de e-mail e WhatsApp. Cabeçalho ambíguo, fórmula em cabeçalho, planilha divergente e grade acima do limite são recusados. O escritor continua usando appendCells; a própria API escolhe a próxima linha. IDs permanecem stringValue, inclusive quando têm 18 dígitos; aparência de fórmula não vira fórmula. Valor recebido como número não vira ID textual. Referências: [appendCells](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AppendCellsRequest), [stringValue](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other#ExtendedValue).

## Conferência

A função `diagnosticarOrigemTracking` só lê cabeçalhos e registra quantidade de colunas e compatibilidade das seis abas. Não aciona integrações nem lê conteúdo dos contatos. Antes da publicação, executar `prepararColunasOrigemTracking`: acrescenta apenas os cabeçalhos ausentes, sem gravar contatos. Repetir o diagnóstico e exigir zero campos ausentes nas seis abas. Depois, sincronizar o Gestão e abrir **Lead → Por onde entrou → Ver rastreamento**.

60 testes passaram, incluindo 22 do escritor ativo, com schemas/funções reais sem dados pessoais e uma planilha simulada. Eles cobrem filas, seis capturas, entrada antiga, string numérica, fórmulas, idempotência do schema, cabeçalho fora de ordem, conflitos, falha da API e preservação de uma linha concorrente e captura com o lock ocupado pelos trabalhadores. Nenhum teste disparou contatos reais.

## Ativação em 18/09/2026

A implantação existente foi atualizada para a **versão 19 às 09:05 (São Paulo)**, mantendo endereço, executor e acesso. O GET público respondeu às 09:06 com `origem-v1-20260917`. Antes de publicar, os hashes dos sete módulos foram conferidos: somente Código.gs e captura_correcao.gs diferem do código original observado na versão 18.

`prepararColunasOrigemTracking` foi executada às 08:58 e criou apenas os três cabeçalhos ausentes em cada aba. O diagnóstico seguinte, às 08:59, confirmou zero campos ausentes nas seis abas: Dicionário ficou com 31 colunas alocadas e as outras cinco com 29. Não foram enviados formulários de teste nem acionadas integrações com contatos.

O Gestão de desenvolvimento já recebeu a migration dos campos de captura; API, banco e os três rótulos no detalhe do lead foram conferidos em sessão autenticada. A validação de ponta a ponta com valores reais continua dependente de uma nova captura que traga esses parâmetros e da sua sincronização. Capturas antigas podem permanecer vazias; não há reconstrução artificial de origem.

Publicação e cabeçalhos confirmam a ativação do capturador. Eles não comprovam atribuição de anúncios, correspondência ou deduplicação de eventos na Meta.
