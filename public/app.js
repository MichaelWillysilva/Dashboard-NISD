const state = { data: null, charts: {} };
const EMPTY_MEMBER_LABEL = "Todos do NISD";

const palette = {
  blue: "#4777df",
  red: "#e76a6b",
  amber: "#e6ad48",
  green: "#51ae87",
  purple: "#9276d1",
  slate: "#9aa7b7",
  teal: "#57aeb0",
  pink: "#cf7fa5",
  lightBlue: "#83a3e9",
  darkBlue: "#61738b",
};

const elements = {
  listFilter: document.querySelector("#list-filter"),
  priorityFilter: document.querySelector("#priority-filter"),
  memberFilter: document.querySelector("#member-filter"),
  lastRead: document.querySelector("#last-read"),
  table: document.querySelector("#cards-table"),
  tableCount: document.querySelector("#table-count"),
  historyNote: document.querySelector("#history-note"),
  refresh: document.querySelector("#refresh-button"),
  toast: document.querySelector("#toast"),
};

const priorityColors = {
  alta: "priority-alta",
  media: "priority-media",
  baixa: "priority-baixa",
  rotina: "priority-rotina",
};

function dateFrom(value) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDate(value, includeTime = false) {
  const date = dateFrom(value);
  if (!date) return "Sem registro";
  return new Intl.DateTimeFormat("pt-BR", includeTime
    ? { dateStyle: "short", timeStyle: "short" }
    : { dateStyle: "short" }).format(date);
}

function daysSince(value, now) {
  const date = dateFrom(value);
  if (!date) return null;
  return Math.max(0, (now.getTime() - date.getTime()) / 86400000);
}

function hasNoMovementForAWeek(value, now) {
  const date = dateFrom(value);
  return Boolean(date && now.getTime() - date.getTime() > 7 * 86400000);
}

function getFilteredCards() {
  const { data } = state;
  if (!data) return [];
  const listId = elements.listFilter.value;
  const priorityKey = elements.priorityFilter.value;
  const memberId = elements.memberFilter.value;
  return data.cards.filter((card) =>
    (!listId || card.listId === listId) &&
    (!priorityKey || card.priorities.some((priority) => priority.key === priorityKey)) &&
    (!memberId || (memberId === "unassigned"
      ? card.members.length === 0
      : card.members.some((member) => member.id === memberId))),
  );
}

function populateSelect(select, options, firstLabel) {
  const existingValue = select.value;
  select.replaceChildren(new Option(firstLabel, ""));
  for (const option of options) {
    select.add(new Option(option.name, option.id));
  }
  if ([...select.options].some((option) => option.value === existingValue)) {
    select.value = existingValue;
  }
}

function populateFilters(data) {
  populateSelect(elements.listFilter, data.lists.map((list) => ({ id: list.id, name: list.name })), "Todas as listas");
  populateSelect(elements.priorityFilter, data.priorities.map((priority) => ({ id: priority.key, name: priority.label })), "Todas as prioridades");
  const members = data.members
    .map((member) => ({ id: member.id, name: member.name }))
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  populateSelect(elements.memberFilter, members, "Todos do NISD");
}

function countCards(cards, now) {
  return {
    total: cards.length,
    overdue: cards.filter((card) => {
      const due = dateFrom(card.due);
      return due && due.getTime() < now.getTime() && !card.dueComplete;
    }).length,
    upcoming: cards.filter((card) => {
      const due = dateFrom(card.due);
      return due && due.getTime() >= now.getTime() &&
        due.getTime() <= now.getTime() + 7 * 86400000 && !card.dueComplete;
    }).length,
    stale: cards.filter((card) => {
      return hasNoMovementForAWeek(card.dateLastActivity, now);
    }).length,
    unassigned: cards.filter((card) => card.members.length === 0).length,
    completedDue: cards.filter((card) => card.dueComplete).length,
  };
}

function renderSummary(cards, now) {
  const counts = countCards(cards, now);
  document.querySelector("#total-cards").textContent = counts.total;
  document.querySelector("#overdue-cards").textContent = counts.overdue;
  document.querySelector("#upcoming-cards").textContent = counts.upcoming;
  document.querySelector("#stale-cards").textContent = counts.stale;
  document.querySelector("#unassigned-cards").textContent = counts.unassigned;
  document.querySelector("#completed-due").textContent = counts.completedDue;
}

function updateChart(name, canvasId, config) {
  if (state.charts[name]) state.charts[name].destroy();
  const canvas = document.getElementById(canvasId);
  state.charts[name] = new Chart(canvas, config);
}

function chartScales() {
  return {
    x: { grid: { display: false }, border: { display: false }, ticks: { color: "#8b97a6", font: { family: "Segoe UI", size: 10 } } },
    y: { beginAtZero: true, grid: { color: "#eef1f5", drawTicks: false }, border: { display: false, dash: [3, 4] }, ticks: { color: "#96a1af", precision: 0, padding: 8, font: { family: "Segoe UI", size: 9 } } },
  };
}

function renderCharts(cards, now) {
  const listCounts = state.data.lists.map((list) => cards.filter((card) => card.listId === list.id).length);
  updateChart("list", "list-chart", {
    type: "bar",
    data: {
      labels: state.data.lists.map((list) => list.name),
      datasets: [{ data: listCounts, backgroundColor: palette.blue, hoverBackgroundColor: "#2f5fc1", borderRadius: 5, maxBarThickness: 34 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.raw} cards` } } },
      scales: chartScales(),
    },
  });

  const priorityCounts = state.data.priorities.map((priority) => cards.filter((card) =>
    card.priorities.some((item) => item.key === priority.key),
  ).length);
  updateChart("priority", "priority-chart", {
    type: "doughnut",
    data: {
      labels: state.data.priorities.map((priority) => priority.label),
      datasets: [{ data: priorityCounts, backgroundColor: [palette.red, palette.amber, palette.green, palette.blue, palette.purple], borderColor: "#fff", borderWidth: 3, hoverOffset: 4 }],
    },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: "69%",
      plugins: {
        legend: { position: "right", labels: { usePointStyle: true, pointStyle: "circle", boxWidth: 7, boxHeight: 7, padding: 13, color: "#66758a", font: { family: "Segoe UI", size: 10 } } },
        tooltip: { callbacks: { label: (context) => ` ${context.label}: ${context.raw} cards` } },
      },
    },
  });

  const memberRows = state.data.members.map((member) => ({
    name: member.name,
    count: cards.filter((card) => card.members.some((item) => item.id === member.id)).length,
  })).filter((member) => member.count > 0).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "pt-BR"));
  const unassigned = cards.filter((card) => card.members.length === 0).length;
  if (unassigned > 0) memberRows.push({ name: EMPTY_MEMBER_LABEL, count: unassigned });
  updateChart("member", "member-chart", {
    type: "bar",
    data: {
      labels: memberRows.map((member) => member.name),
      datasets: [{ data: memberRows.map((member) => member.count), backgroundColor: palette.teal, hoverBackgroundColor: "#398e91", borderRadius: 4, barThickness: 10, maxBarThickness: 12 }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.raw} cards` } } },
      scales: {
        x: { ...chartScales().y, max: Math.max(1, ...memberRows.map((item) => item.count)) },
        y: { grid: { display: false }, border: { display: false }, ticks: { color: "#748297", font: { family: "Segoe UI", size: 9 } } },
      },
    },
  });

  const filteredIds = new Set(cards.map((card) => card.id));
  const filtersActive = Boolean(
    elements.listFilter.value || elements.priorityFilter.value || elements.memberFilter.value,
  );
  const actionCounts = new Map();
  for (const action of state.data.actions) {
    if (filtersActive && (!action.cardId || !filteredIds.has(action.cardId))) continue;
    if (!filtersActive && action.cardId && !filteredIds.has(action.cardId)) continue;
    const date = dateFrom(action.date);
    if (!date) continue;
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    actionCounts.set(key, (actionCounts.get(key) || 0) + 1);
  }
  const keys = [...actionCounts.keys()].sort();
  const first = keys.length ? new Date(`${keys[0]}T00:00:00`) : null;
  const last = keys.length ? new Date(`${keys[keys.length - 1]}T00:00:00`) : null;
  const labels = [];
  const values = [];
  if (first && last) {
    for (const date = new Date(first); date <= last; date.setDate(date.getDate() + 1)) {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      labels.push(new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "2-digit" }).format(date));
      values.push(actionCounts.get(key) || 0);
    }
  }
  updateChart("activity", "activity-chart", {
    type: "line",
    data: {
      labels,
      datasets: [{ data: values, borderColor: palette.purple, backgroundColor: "rgba(146,118,209,.12)", borderWidth: 2, fill: true, tension: .35, pointRadius: values.length > 30 ? 0 : 2, pointHoverRadius: 4, pointBackgroundColor: palette.purple }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (context) => ` ${context.raw} ações` } } },
      scales: {
        x: { ...chartScales().x, ticks: { ...chartScales().x.ticks, maxTicksLimit: 8, maxRotation: 0 } },
        y: chartScales().y,
      },
    },
  });
  elements.historyNote.textContent =
    `Histórico curto: ${state.data.historyActionCount} ações nesta exportação` +
    (first && last ? `, de ${formatDate(first)} a ${formatDate(last)}.` : ".") +
    " Ações antigas não incluídas no arquivo não aparecem.";
}

function createPill(text, className) {
  const pill = document.createElement("span");
  pill.className = className;
  pill.textContent = text;
  return pill;
}

function renderTable(cards, now) {
  elements.table.replaceChildren();
  elements.tableCount.textContent = `${cards.length} ${cards.length === 1 ? "card exibido" : "cards exibidos"}`;
  if (!cards.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.className = "empty-state";
    cell.colSpan = 7;
    cell.textContent = "Nenhum card corresponde aos filtros selecionados.";
    row.append(cell);
    elements.table.append(row);
    return;
  }

  const sorted = [...cards].sort((a, b) => a.listName.localeCompare(b.listName, "pt-BR") || a.name.localeCompare(b.name, "pt-BR"));
  for (const card of sorted) {
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    const name = document.createElement("span");
    name.className = "card-name";
    name.textContent = card.name;
    nameCell.append(name);
    const idHint = document.createElement("span");
    idHint.className = "card-subtitle";
    idHint.textContent = card.id ? `ID ${card.id.slice(-8)}` : "Card";
    nameCell.append(idHint);
    row.append(nameCell);

    const listCell = document.createElement("td");
    listCell.className = "list-cell";
    listCell.append(createPill(card.listName, "list-pill"));
    row.append(listCell);

    const priorityCell = document.createElement("td");
    const priorityPills = document.createElement("div");
    priorityPills.className = "priority-pills";
    if (card.priorities.length) {
      for (const priority of card.priorities) {
        priorityPills.append(createPill(priority.label, `priority-pill ${priorityColors[priority.key] || "priority-none"}`));
      }
    } else {
      priorityPills.append(createPill("Sem prioridade", "priority-pill priority-none"));
    }
    priorityCell.append(priorityPills);
    row.append(priorityCell);

    const memberCell = document.createElement("td");
    const memberPills = document.createElement("div");
    memberPills.className = "member-pills";
    if (card.members.length) {
      for (const member of card.members) memberPills.append(createPill(member.name, "member-pill"));
    } else {
      memberPills.append(createPill(EMPTY_MEMBER_LABEL, "member-pill"));
    }
    memberCell.append(memberPills);
    row.append(memberCell);

    const dueCell = document.createElement("td");
    dueCell.className = "due-cell";
    dueCell.textContent = formatDate(card.due);
    const due = dateFrom(card.due);
    if (card.dueComplete) dueCell.classList.add("due-complete");
    else if (due && due.getTime() < now.getTime()) dueCell.classList.add("due-late");
    row.append(dueCell);

    const activityCell = document.createElement("td");
    activityCell.className = "activity-cell";
    const ageDays = daysSince(card.dateLastActivity, now);
    activityCell.textContent = card.dateLastActivity
      ? `${formatDate(card.dateLastActivity)}${ageDays !== null ? ` · ${ageDays.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} dias` : ""}`
      : "Sem registro";
    if (hasNoMovementForAWeek(card.dateLastActivity, now)) activityCell.classList.add("due-late");
    row.append(activityCell);

    const linkCell = document.createElement("td");
    if (card.shortUrl && /^https:\/\/trello\.com\//i.test(card.shortUrl)) {
      const link = document.createElement("a");
      link.className = "open-link";
      link.href = card.shortUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.setAttribute("aria-label", `Abrir ${card.name} no Trello`);
      link.title = "Abrir no Trello";
      link.textContent = "↗";
      linkCell.append(link);
    } else {
      linkCell.textContent = "—";
    }
    row.append(linkCell);
    elements.table.append(row);
  }
}

function renderDashboard() {
  if (!state.data) return;
  const now = new Date();
  const cards = getFilteredCards();
  renderSummary(cards, now);
  renderCharts(cards, now);
  renderTable(cards, now);
}

async function loadData(showToast = false) {
  elements.refresh.disabled = true;
  elements.refresh.classList.add("is-loading");
  try {
    const response = await fetch("/api/dados", { cache: "no-store" });
    if (!response.ok) throw new Error(`O servidor respondeu com status ${response.status}.`);
    const data = await response.json();
    state.data = data;
    populateFilters(data);
    elements.lastRead.textContent = formatDate(data.loadedAt, true);
    renderDashboard();
    if (showToast) showMessage("Dados atualizados com sucesso.", false);
  } catch (error) {
    showMessage(`Não foi possível carregar os dados: ${error.message}`, true);
  } finally {
    elements.refresh.disabled = false;
    elements.refresh.classList.remove("is-loading");
  }
}

let toastTimeout;
function showMessage(message, isError) {
  elements.toast.textContent = message;
  elements.toast.classList.toggle("error", isError);
  elements.toast.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => elements.toast.classList.remove("visible"), 4000);
}

for (const filter of [elements.listFilter, elements.priorityFilter, elements.memberFilter]) {
  filter.addEventListener("change", renderDashboard);
}
document.querySelector("#clear-filters").addEventListener("click", () => {
  elements.listFilter.value = "";
  elements.priorityFilter.value = "";
  elements.memberFilter.value = "";
  renderDashboard();
});
elements.refresh.addEventListener("click", () => loadData(true));

loadData();
window.setInterval(() => loadData(), 30000);
