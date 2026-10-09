const express = require("express");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const SOURCE_NAMES = ["trello_json.json", "trello.json.json"];
const PRIORITIES = [
  { key: "alta", label: "Alta", match: /alta/i },
  { key: "media", label: "Média", match: /m[eé]dia/i },
  { key: "baixa", label: "Baixa", match: /baixa/i },
  { key: "rotina", label: "Rotina", match: /rotina|manuten/i },
];

let boardData;
let loadedAt;
let sourcePath;
let watchTimer;
let reloadInProgress = false;
let reloadQueued = false;

function findSourcePath() {
  return SOURCE_NAMES.map((name) => path.join(ROOT, name)).find((filePath) =>
    fs.existsSync(filePath),
  );
}

function fullName(member) {
  return member && typeof member.fullName === "string"
    ? member.fullName
    : member && typeof member.username === "string"
      ? member.username
      : null;
}

function normalizeBoard(raw) {
  const lists = Array.isArray(raw.lists) ? raw.lists : [];
  const labels = Array.isArray(raw.labels) ? raw.labels : [];
  const members = Array.isArray(raw.members) ? raw.members : [];
  const rawCards = Array.isArray(raw.cards) ? raw.cards : [];
  const rawActions = Array.isArray(raw.actions) ? raw.actions : [];
  const openLists = lists.filter((list) => list && list.closed !== true);
  const openListIds = new Set(openLists.map((list) => list.id));
  const labelById = new Map(labels.filter(Boolean).map((label) => [label.id, label]));
  const memberById = new Map(members.filter(Boolean).map((member) => [member.id, member]));

  const cards = rawCards
    .filter((card) => card && card.closed !== true && openListIds.has(card.idList))
    .map((card) => {
      const list = openLists.find((item) => item.id === card.idList);
      const cardLabelIds = Array.isArray(card.idLabels) ? card.idLabels : [];
      const cardLabels = cardLabelIds
        .map((id) => labelById.get(id))
        .filter((label) => label && label.name)
        .map((label) => label.name);
      const priorities = PRIORITIES
        .filter((priority) => cardLabels.some((name) => priority.match.test(name)))
        .map((priority) => ({ key: priority.key, label: priority.label }));
      const memberIds = Array.isArray(card.idMembers) ? card.idMembers : [];
      const cardMembers = memberIds
        .map((id) => memberById.get(id))
        .filter(Boolean)
        .map((member) => ({ id: member.id, name: fullName(member) || "Membro sem nome" }));

      return {
        id: card.id || null,
        name: typeof card.name === "string" ? card.name : "(Card sem nome)",
        listId: card.idList || null,
        listName: list && typeof list.name === "string" ? list.name : "Lista sem nome",
        labelNames: cardLabels,
        priorities,
        members: cardMembers,
        due: typeof card.due === "string" ? card.due : null,
        dueComplete: card.dueComplete === true,
        dateLastActivity:
          typeof card.dateLastActivity === "string" ? card.dateLastActivity : null,
        shortUrl: typeof card.shortUrl === "string" ? card.shortUrl : null,
      };
    });

  const activeCardIds = new Set(cards.map((card) => card.id).filter(Boolean));
  const actions = rawActions
    .filter((action) => action && typeof action.date === "string")
    .map((action) => ({
      date: action.date,
      cardId:
        action.data && action.data.card && typeof action.data.card.id === "string"
          ? action.data.card.id
          : null,
    }))
    .filter((action) => !action.cardId || activeCardIds.has(action.cardId));

  return {
    boardName: typeof raw.name === "string" ? raw.name : "Trello",
    loadedAt: new Date().toISOString(),
    lists: openLists.map((list) => ({
      id: list.id,
      name: typeof list.name === "string" ? list.name : "Lista sem nome",
    })),
    priorities: PRIORITIES.map(({ key, label }) => ({ key, label })),
    members: members.filter(Boolean).map((member) => ({
      id: member.id,
      name: fullName(member) || "Membro sem nome",
    })),
    cards,
    actions,
    historyActionCount: rawActions.length,
  };
}

async function loadBoard() {
  const nextSourcePath = findSourcePath();
  if (!nextSourcePath) {
    throw new Error(
      `Arquivo Trello nao encontrado. Esperado: ${SOURCE_NAMES.join(" ou ")}`,
    );
  }

  const contents = await fs.promises.readFile(nextSourcePath, "utf8");
  const raw = JSON.parse(contents);
  const nextData = normalizeBoard(raw);
  boardData = nextData;
  loadedAt = nextData.loadedAt;
  sourcePath = nextSourcePath;
  console.log(
    `Dados atualizados: ${path.basename(sourcePath)} (${cardsCount()} cards ativos) - ${new Date(loadedAt).toLocaleString("pt-BR")}`,
  );
}

function cardsCount() {
  return boardData ? boardData.cards.length : 0;
}

async function reloadBoard() {
  if (reloadInProgress) {
    reloadQueued = true;
    return;
  }

  reloadInProgress = true;
  try {
    await loadBoard();
  } catch (error) {
    console.error(`Falha ao recarregar a exportacao do Trello: ${error.message}`);
  } finally {
    reloadInProgress = false;
    if (reloadQueued) {
      reloadQueued = false;
      await reloadBoard();
    }
  }
}

function startFileWatcher() {
  fs.watch(ROOT, (eventType, filename) => {
    if (!filename) {
      return;
    }
    const changedName = filename.toString();
    if (!SOURCE_NAMES.includes(changedName)) {
      return;
    }
    clearTimeout(watchTimer);
    watchTimer = setTimeout(reloadBoard, 200);
  });
}

function getNetworkAddresses() {
  const addresses = [];
  for (const interfaces of Object.values(os.networkInterfaces())) {
    for (const network of interfaces || []) {
      if (network.family === "IPv4" && !network.internal) {
        addresses.push(network.address);
      }
    }
  }
  return [...new Set(addresses)];
}

app.use(express.static(PUBLIC_DIR));

app.get("/api/dados", async (request, response) => {
  if (!boardData) {
    try {
      await loadBoard();
    } catch (error) {
      console.error(`Falha ao carregar a exportacao do Trello: ${error.message}`);
      return response.status(503).json({ error: "Os dados do quadro nao puderam ser carregados." });
    }
  }
  return response.json({ ...boardData, loadedAt });
});

async function startServer() {
  await loadBoard();
  startFileWatcher();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Dashboard NISD disponivel em http://localhost:${PORT}`);
    const addresses = getNetworkAddresses();
    if (addresses.length) {
      for (const address of addresses) {
        console.log(`Acesso pela rede: http://${address}:${PORT}`);
      }
    } else {
      console.log("Nenhum IP de rede local foi detectado.");
    }
    console.log(`Observando alteracoes em ${path.basename(sourcePath)}.`);
  });
}

if (require.main === module) {
  startServer().catch((error) => {
    console.error(`Nao foi possivel iniciar o dashboard: ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = app;
