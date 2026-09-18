# Origem no escritor ativo da planilha

O projeto Google que recebe os formulários estava na versão 18, de 15/09/2026. Ele já usa o escritor por cabeçalho com `Sheets.Spreadsheets.batchUpdate / appendCells`, além de filas e regras de WhatsApp posteriores ao arquivo histórico `apps_script_unified.gs`.

O patch compatível com esse projeto está em [apps-script-origem-ativo.gs](../scripts/apps-script-origem-ativo.gs) e [apps-script-origem-colunas.gs](../scripts/apps-script-origem-colunas.gs). A comparação real preservou os demais cinco módulos e alterou apenas Código.gs e captura_correcao.gs. Não publicar o arquivo histórico inteiro sobre o projeto ativo.

## Aplicação

Substituir as seis funções de captura, `appendLeadByHeader_` e `doGet` pelas funções homônimas do patch; adicionar uma única cópia de `leadTrackingRow_` e `diagnosticarOrigemTracking`. Conferir as funções existentes antes de aplicar. Não criar uma segunda definição dos handlers. Salvar e atualizar a implantação Web App existente, mantendo URL, executor e público.

Newsletter, Lista, Dicionário, Bolsão, Lives e Aulas ao Vivo passam os três parâmetros adicionais ao mesmo escritor. Campos antigos, estado das filas, fallback de WhatsApp, roteamento de aulas e trabalhador assíncrono ficam preservados. O GET passa a exibir `origem-v1-20260917`, sem criar contato.

As colunas são acrescentadas depois da grade existente, sem deslocar histórico ou SES/CRM. Um lock protege sua criação. Cabeçalho ambíguo, fórmula em cabeçalho, planilha divergente e grade acima do limite são recusados. O escritor continua usando appendCells; a própria API escolhe a próxima linha. IDs permanecem stringValue, inclusive quando têm 18 dígitos; aparência de fórmula não vira fórmula. Valor recebido como número não vira ID textual. Referências: [appendCells](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/request#AppendCellsRequest), [stringValue](https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets/other#ExtendedValue).

## Conferência

A função `diagnosticarOrigemTracking` só lê cabeçalhos e registra quantidade de colunas e compatibilidade das seis abas. Não aciona integrações nem lê conteúdo dos contatos. A primeira captura real em cada aba cria as três colunas ausentes. Depois, sincronizar o Gestão e abrir **Lead → Por onde entrou → Ver rastreamento**.

58 testes passaram, incluindo 20 do escritor ativo, com schemas/funções reais sem dados pessoais e uma planilha simulada. Eles cobrem filas, seis capturas, entrada antiga, string numérica, fórmulas, idempotência do schema, cabeçalho fora de ordem, conflitos, falha da API e preservação de uma linha concorrente. Nenhum teste disparou contatos reais.

A versão publicada e a conferência da primeira captura real devem ser registradas após a implantação. Teste local não comprova publicação nem atribuição de anúncios pela Meta.
