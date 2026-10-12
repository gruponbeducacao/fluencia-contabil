# Página de links da bio (`links.html`)

`fluenciacontabil.com.br/links` é o endereço que fica na bio. Ela mostra a aula ao vivo
da semana, seis atalhos fixos e as novidades (vídeo, artigo, gravação). O HTML não muda
de semana para semana: o que muda vem de três arquivos, e só um deles pede um gesto.

## O que entra sozinho e o que pede um passo

| Conteúdo | De onde vem | O que fazer |
|---|---|---|
| Aula ao vivo (cartão do topo) | `assets/aulas/agenda.json`, escrito pelo kit das lives | Nada no site. A imagem é a miniatura da transmissão no YouTube. |
| Gravação da última aula | a mesma agenda | Nada. Entra duas horas depois do início da aula. |
| Artigo do blog | `blog/feed.xml`, que o CI regenera a cada post | Nada. Entra quando o PR do post é mesclado. |
| Vídeo da semana | `assets/links/links.json` | **Um comando** (abaixo) e um PR. |

A lista de novidades mostra os dois vídeos e os dois artigos mais recentes, mais a
gravação. O `links.json` pode guardar o histórico: vídeo antigo não precisa ser apagado.

## A rotina, por tipo de conteúdo

### Aula ao vivo (quarta)

O `publicar_semana_lp.py` do kit (`_LIVES/_semanal`) já grava a aula na agenda, e a
página a mostra até duas horas depois do início. Dois cuidados, os dois no YouTube:

- **Antes:** a transmissão precisa da miniatura cadastrada. É ela que aparece no cartão.
  Sem miniatura, o cartão fica com a faixa azul e o símbolo da marca.
- **Depois:** trocar a miniatura pela de gravação (a que não traz o selo "ao vivo").
  Entre o fim da aula e a publicação da próxima, o cartão do topo mostra a gravação
  com a imagem que estiver no YouTube.

### Artigo do blog

Nenhum passo. O título é o `headline` do post, a data é a de publicação e a miniatura é
a imagem de compartilhamento, `blog/imgs/share/<slug>-og.jpg`. Sem essa imagem, o item
aparece com um ícone no lugar.

Para trocar o título ou a imagem que o feed traria, ponha o artigo à mão no
`links.json` (`"tipo": "artigo"`, `url` do post e `img` em `assets/links/`, 336 × 189):
o item manual vale no lugar do que vem do feed.

### Vídeo da semana (quinta)

No worktree do site, a partir de `origin/main`:

```
python scripts/links_video.py <endereço do vídeo> --titulo "Título como está no YouTube" --data AAAA-MM-DDTHH:MM
node --test scripts/links.test.mjs
```

Depois, commit de `assets/links/links.json` e PR.

- **Vídeo agendado:** com data e hora futuras, o item só aparece na página na hora
  marcada. O PR pode ser mesclado na véspera, assim que o vídeo estiver no YouTube.
- **Estreia:** acrescente `--estreia` só se o vídeo foi programado como Estreia. Aí ele
  aparece antes, anunciado como estreia. Vídeo apenas agendado tem link privado até a
  hora: sem `--estreia`, a página espera.
- **Sem `--data`**, vale o dia de hoje.
- Rodar de novo com o mesmo vídeo corrige o item, não duplica.
- A miniatura vem do YouTube. Não há arquivo de imagem para gerar.

## Conferência

`node --test scripts/links.test.mjs` roda no CI a cada PR. Ele reprova, entre outras
coisas: link da casa sem a etiqueta de bio, item do `links.json` que a página
descartaria em silêncio, e feed do blog que a página não consegue ler.

Depois do merge, abrir `fluenciacontabil.com.br/links` e ver o item na lista. O arquivo
da semana é pedido com um parâmetro que muda a cada dez minutos; um item recém-publicado
pode levar esse tempo para aparecer.

## A etiqueta de bio

Todo link para o site e para o Dicionário sai com
`src=bio&utm_source=instagram&utm_medium=bio&utm_campaign=bio-links&utm_content=<botão>`.
Na página de venda, o `origem.js` leva a etiqueta ao checkout, e o botão chega em
`utm_term`. Os detalhes e as armadilhas estão no comentário do topo de `links.html`.

- **Outra rede:** o mesmo endereço com a fonte na frente, por exemplo
  `/links?utm_source=youtube` na bio do YouTube.
- **Botão novo fixo:** leva `data-bio` com um nome único e, se for da casa, a etiqueta
  completa já no `href`. O teste reprova o que faltar.
