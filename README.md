# Dashboard NISD do Trello

Dashboard web baseado em uma exportacao JSON do Trello. O servidor local observa o
arquivo `trello.json.json` e atualiza os dados quando ele e substituido.

## Executar localmente

```sh
npm install
npm start
```

Abra `http://localhost:3000`.

## Publicar no Vercel

Este repositorio e publico. O arquivo `trello.json.json` e o endpoint `/api/dados`
tambem ficam acessiveis publicamente; nao inclua dados que devam permanecer
restritos.

O Vercel publica a pasta `public`, configurada em `vercel.json`. A funcao em
`api/` serve `/api/dados` usando a exportacao `trello.json.json`.

Para atualizar os dados publicados, substitua `trello.json.json`, envie a
alteracao para o GitHub e aguarde o Vercel concluir uma nova implantacao. A
deteccao automatica de alteracoes do arquivo funciona somente quando o servidor
local esta em execucao.
