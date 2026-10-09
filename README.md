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

Conecte este projeto a um repositorio GitHub privado no Vercel. O site publicado
sera publico, mas o repositorio e a exportacao original do Trello permanecerao
privados. O endpoint do dashboard disponibiliza os dados exibidos no site para
qualquer pessoa que o acessar.

O Vercel executa `npm run build` e publica a pasta `public`. A funcao em `api/`
serve `/api/dados` usando a exportacao `trello.json.json`.

Para atualizar os dados publicados, substitua `trello.json.json`, envie a
alteracao para o GitHub e aguarde o Vercel concluir uma nova implantacao. A
deteccao automatica de alteracoes do arquivo funciona somente quando o servidor
local esta em execucao.
