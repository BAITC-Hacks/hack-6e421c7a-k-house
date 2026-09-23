// Студенческий сценарий: каталог → фильтр → подробная карточка → отклик → ручное решение бизнеса.
const topicLabels = { web: "Веб-разработка", data: "Данные", marketing: "Маркетинг" };
const fieldLabels = { context: "Контекст и потребность", users: "Пользователи", data: "Данные и материалы", result: "Ожидаемый результат", success: "Критерии успеха", constraints: "Ограничения", contact: "Контакт и взаимодействие" };
const statusLabels = { pending: "Ожидает решения", accepted: "Выбрана", rejected: "Отклонена" };
let teams = [];
let seed = null;
let proposalFilter = "all";

const topicLabel = (topic) => topicLabels[topic] || "Другое";
const proposalsFor = (taskId) => proposals.filter((proposal) => proposal.taskId === taskId);

function normalizeProposal(proposal) {
  const team = teams.find((item) => item.id === proposal.teamId);
  return { ...proposal, team: proposal.team || team?.name || "Команда", link: proposal.link || proposal.prototypeUrl || "" };
}
function applySeed() {
  tasks = seed.tasks.map((task) => ({ ...task, score: scoreTask(task) }));
  proposals = seed.proposals.map(normalizeProposal);
  save();
}
async function loadSeed() {
  try {
    const response = await fetch("data/seed.json");
    if (!response.ok) throw new Error("Seed is unavailable");
    seed = await response.json();
    teams = seed.teams || [];
    if (!localStorage.getItem("taskbridge-tasks")) applySeed();
  } catch {
    // Без сервера (file://) остаются встроенные демо-задачи из app.js.
  }
  $("#team-options").innerHTML = teams.map((team) => `<option value="${escapeHtml(team.name)}"></option>`).join("");
}

function renderCatalog() {
  const topic = $("#topic-filter").value;
  const readiness = $("#readiness-filter").value;
  const direction = $("#sort-order").value === "asc" ? 1 : -1;
  const filtered = tasks.filter((task) => {
    const kind = level(task.score)[1];
    const readinessMatch = readiness === "all" || (readiness === "ready" ? task.score >= 70 : readiness === "workable" ? task.score >= 40 : kind === "draft");
    return task.published && (topic === "all" || task.topic === topic) && readinessMatch;
  }).sort((a, b) => (a.score - b.score) * direction);
  $("#catalog-count").textContent = `Найдено задач: ${filtered.length}`;
  taskGrid.innerHTML = filtered.length ? filtered.map((task) => {
    const [label, kind] = level(task.score);
    const count = proposalsFor(task.id).length;
    return `<article class="task-card"><div class="top"><span class="tag">${topicLabel(task.topic)}</span><span class="score">${task.score}/100</span></div><h2>${escapeHtml(task.title)}</h2><p>${escapeHtml(task.context)}</p><p class="status ${kind}">${label}</p><p class="card-meta">Откликов: ${count}</p><div class="card-actions"><button class="secondary-button" data-open="${task.id}">Подробнее</button><button class="primary-button" data-respond="${task.id}">Откликнуться</button></div></article>`;
  }).join("") : '<div class="empty">По этим фильтрам задач пока нет. Попробуйте выбрать «Все темы» или «Любой уровень».</div>';
}

function openTask(taskId) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) return;
  const [label, kind] = level(task.score);
  const count = proposalsFor(task.id).length;
  $("#task-detail-content").innerHTML = `
    <div class="detail-head">
      <div><p class="eyebrow">${topicLabel(task.topic).toUpperCase()}</p><h1>${escapeHtml(task.title)}</h1><p class="status ${kind}">${label} задача</p></div>
      <div class="detail-score"><strong>${task.score}</strong><span>/100</span></div>
    </div>
    <dl class="detail-fields">${Object.entries(fieldLabels).map(([field, name]) => {
      const value = String(task[field] || "").trim();
      return `<div class="${value ? "" : "missing"}"><dt>${name}<small>${value ? weights[field] : 0}/${weights[field]}</small></dt><dd>${value ? escapeHtml(value) : "Бизнес пока не указал"}</dd></div>`;
    }).join("")}</dl>
    <div class="detail-footer"><p class="muted">${count ? `Уже откликнулись команд: ${count}` : "Откликов пока нет — станьте первыми."}</p><button class="primary-button" data-respond="${task.id}">Откликнуться на задачу <span aria-hidden="true">→</span></button></div>`;
  setView("task-detail");
}

function openProposal(taskId) {
  selectedTaskId = taskId;
  const task = tasks.find((item) => item.id === taskId);
  $("#proposal-task-title").textContent = task.title;
  $("#proposal-form").taskId.value = taskId;
  dialog.showModal();
}
$("#proposal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = Object.fromEntries([...new FormData(form).entries()].map(([key, value]) => [key, String(value).trim()]));
  if (!data.team || !data.idea) return showToast("Укажите команду и идею решения.");
  if (proposals.some((item) => item.taskId === data.taskId && item.team.toLowerCase() === data.team.toLowerCase())) return showToast("Эта команда уже откликнулась на задачу.");
  const team = teams.find((item) => item.name.toLowerCase() === data.team.toLowerCase());
  proposals.push({ ...data, teamId: team?.id, id: "proposal-" + Date.now(), status: "pending" });
  save(); dialog.close(); form.reset(); renderCatalog(); renderProposals();
  showToast("Отклик отправлен бизнесу. Решение принимает только он.");
});
$("#proposal-close").addEventListener("click", () => dialog.close());

function renderProposalFilters() {
  const counts = { all: proposals.length, pending: 0, accepted: 0, rejected: 0 };
  proposals.forEach((proposal) => counts[proposal.status]++);
  const names = { all: "Все", pending: "Ожидают", accepted: "Выбраны", rejected: "Отклонены" };
  $("#proposal-filters").innerHTML = Object.entries(names).map(([status, name]) => `<button class="chip ${proposalFilter === status ? "active" : ""}" data-filter="${status}" aria-pressed="${proposalFilter === status}">${name} <b>${counts[status]}</b></button>`).join("");
}
function proposalCard(proposal) {
  const team = teams.find((item) => item.id === proposal.teamId);
  const skills = team ? [...team.skills, ...team.technologies].join(", ") : "";
  const link = /^https?:\/\//.test(proposal.link || "") ? `<p><b>Прототип:</b> <a href="${escapeHtml(proposal.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(proposal.link)}</a></p>` : "";
  const actions = proposal.status === "pending"
    ? `<button class="secondary-button accept" data-action="accepted" data-id="${proposal.id}">Выбрать команду</button><button class="secondary-button reject" data-action="rejected" data-id="${proposal.id}">Отклонить</button>`
    : `<button class="secondary-button" data-action="pending" data-id="${proposal.id}">Вернуть на рассмотрение</button>`;
  return `<article class="proposal-card"><header><div><h2>${escapeHtml(proposal.team)}</h2>${skills ? `<p class="card-meta">${escapeHtml(skills)}</p>` : ""}</div><span class="status ${proposal.status}">${statusLabels[proposal.status]}</span></header><p><b>Идея:</b> ${escapeHtml(proposal.idea)}</p><p><b>План:</b> ${escapeHtml(proposal.plan || "Не указан")}</p><p><b>Срок:</b> ${escapeHtml(proposal.deadline || "Не указан")}</p>${link}<div class="proposal-actions">${actions}</div></article>`;
}
function renderProposals() {
  renderProposalFilters();
  const list = $("#proposals-list");
  const visible = proposals.filter((proposal) => proposalFilter === "all" || proposal.status === proposalFilter);
  if (!visible.length) { list.innerHTML = `<div class="empty">${proposals.length ? "В этом статусе откликов нет." : "Откликов пока нет. Откройте каталог как команда и оставьте первый."}</div>`; return; }
  const groups = visible.reduce((result, proposal) => ((result[proposal.taskId] ||= []).push(proposal), result), {});
  list.innerHTML = Object.entries(groups).map(([taskId, items]) => {
    const task = tasks.find((item) => item.id === taskId);
    return `<section class="proposal-group"><h3><button class="link-button" data-open="${taskId}">${escapeHtml(task?.title || "Задача")}</button><span>${items.length}</span></h3>${items.map(proposalCard).join("")}</section>`;
  }).join("");
}

document.addEventListener("click", (event) => {
  const target = event.target.closest("[data-open], [data-respond], [data-action], [data-filter]");
  if (!target) return;
  if (target.dataset.open) openTask(target.dataset.open);
  else if (target.dataset.respond) openProposal(target.dataset.respond);
  else if (target.dataset.filter) { proposalFilter = target.dataset.filter; renderProposals(); }
  else if (target.dataset.action) {
    const proposal = proposals.find((item) => item.id === target.dataset.id);
    const selectedForTask = proposal.status !== "accepted" && target.dataset.action === "accepted"
      ? proposals.find((item) => item.taskId === proposal.taskId && item.status === "accepted" && item.id !== proposal.id)
      : null;
    if (selectedForTask) {
      showToast(`Для этой задачи уже выбрана команда ${selectedForTask.team}.`);
      return;
    }
    proposal.status = target.dataset.action;
    save(); renderProposals();
    showToast({ accepted: "Команда выбрана вручную.", rejected: "Отклик отклонён.", pending: "Отклик снова ожидает решения." }[proposal.status]);
  }
});
["#topic-filter", "#readiness-filter", "#sort-order"].forEach((selector) => $(selector).addEventListener("change", renderCatalog));
$("#reset-demo").addEventListener("click", () => {
  if (!seed) return showToast("Демо-данные доступны при запуске через сервер.");
  applySeed(); proposalFilter = "all"; renderCatalog(); renderProposals();
  showToast("Демо-данные восстановлены: 5 задач, 5 откликов.");
});

loadSeed().then(() => { renderCatalog(); renderProposals(); });
