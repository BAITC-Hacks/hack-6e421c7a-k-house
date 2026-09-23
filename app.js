const weights = { context: 20, data: 20, result: 15, success: 15, constraints: 10, users: 10, contact: 10 };
const $ = (selector) => document.querySelector(selector);
const taskGrid = $("#task-grid");
const dialog = $("#proposal-dialog");
let selectedTaskId = null;

const starterTasks = [
  { id: "seed-1", title: "Дашборд продаж для кофейни", topic: "data", score: 82, context: "Нужно видеть продажи по точкам и категориям.", users: "Владелец и управляющие точек.", data: "Есть выгрузка заказов в CSV.", result: "Веб-дашборд с ключевыми метриками.", success: "Владелец видит выручку и топовые позиции.", constraints: "2 недели, только веб.", contact: "Еженедельный созвон с управляющим.", published: true },
  { id: "seed-2", title: "Лендинг для карьерного курса", topic: "web", score: 58, context: "Нужно рассказать о новом курсе.", users: "Студенты 18–24 лет.", data: "", result: "Одностраничный сайт.", success: "Не определены.", constraints: "Нужен запуск до конца месяца.", contact: "", published: true },
  { id: "seed-3", title: "Контент-план для локального бренда", topic: "marketing", score: 42, context: "Бренду одежды нужна активность в социальных сетях.", users: "Покупатели бренда.", data: "Есть Instagram-аккаунт.", result: "", success: "", constraints: "1 неделя.", contact: "Менеджер в Telegram.", published: true }
];

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; }
}
let tasks = load("taskbridge-tasks", starterTasks);
let proposals = load("taskbridge-proposals", [
  { id: "proposal-1", taskId: "seed-1", team: "Data Nomads", idea: "Соберём дашборд на React с фильтрами по точкам.", plan: "Анализ CSV → макет → разработка → тестирование", deadline: "12 дней", link: "https://example.com", status: "pending" }
]);

function save() {
  localStorage.setItem("taskbridge-tasks", JSON.stringify(tasks));
  localStorage.setItem("taskbridge-proposals", JSON.stringify(proposals));
}
function showToast(text) {
  const toast = $("#toast"); toast.textContent = text; toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2600);
}
function setView(view) {
  document.querySelectorAll(".view").forEach((item) => item.classList.toggle("active", item.id === view));
  document.querySelectorAll("[data-view]").forEach((item) => item.classList.toggle("active", item.dataset.view === view && item.classList.contains("nav-link")));
  window.scrollTo({ top: 0, behavior: "smooth" });
}
document.querySelectorAll("[data-view]").forEach((button) => button.addEventListener("click", () => setView(button.dataset.view)));

function scoreTask(task) {
  return Object.entries(weights).reduce((total, [field, weight]) => total + (String(task[field] || "").trim() ? weight : 0), 0);
}
function level(score) {
  if (score >= 90) return ["Приоритетная", "ready"];
  if (score >= 70) return ["Готовая", "ready"];
  if (score >= 40) return ["Рабочая", "workable"];
  return ["Черновик", "draft"];
}
function renderCatalog() {
  const topic = $("#topic-filter").value;
  const readiness = $("#readiness-filter").value;
  const filtered = tasks.filter((task) => {
    const taskLevel = level(task.score)[1];
    return task.published && (topic === "all" || task.topic === topic) && (readiness === "all" || taskLevel === readiness || (readiness === "workable" && task.score >= 40));
  }).sort((a, b) => b.score - a.score);
  taskGrid.innerHTML = filtered.length ? filtered.map((task) => {
    const [label, kind] = level(task.score);
    return `<article class="task-card"><div class="top"><span class="tag">${task.topic === "web" ? "Веб-разработка" : task.topic === "data" ? "Данные" : "Маркетинг"}</span><span class="score">${task.score}/100</span></div><h2>${escapeHtml(task.title)}</h2><p>${escapeHtml(task.context)}</p><p class="status ${kind}">${label}</p><button class="secondary-button respond" data-id="${task.id}">Откликнуться →</button></article>`;
  }).join("") : '<div class="empty">По этим фильтрам задач пока нет.</div>';
  document.querySelectorAll(".respond").forEach((button) => button.addEventListener("click", () => openProposal(button.dataset.id)));
}
function escapeHtml(value = "") { return value.replace(/[&<>"']/g, (symbol) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[symbol])); }

$("#analyze-button").addEventListener("click", () => {
  const draft = $("#draft").value.trim();
  if (draft.length < 10) return showToast("Опишите задачу хотя бы парой предложений.");
  $("#questions-panel").classList.remove("hidden");
  $("#analysis-summary").textContent = "В черновике есть задача, но пока не хватает деталей, чтобы команде оценить объём и результат.";
  const prompts = [
    ["Кто будет пользоваться результатом?", "Например: менеджеры кофейни, владельцы точек, клиенты."],
    ["Какие данные, материалы или примеры уже доступны?", "Например: CSV с заказами, брендбук, ссылка на текущий сайт."],
    ["Как вы поймёте, что задача успешно решена?", "Например: менеджер может собрать отчёт без Excel."],
    ["Какие есть сроки или технические ограничения?", "Например: запуск до 15 октября, нужен только веб-интерфейс."]
  ];
  $("#questions").innerHTML = prompts.map(([question, placeholder], index) => `<div class="question"><label for="answer-${index}">${index + 1}. ${question}</label><input id="answer-${index}" data-field="${["users", "data", "success", "constraints"][index]}" placeholder="${placeholder}" /></div>`).join("");
  $("#questions-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#build-card-button").addEventListener("click", () => {
  const draft = $("#draft").value.trim();
  const answers = Object.fromEntries([...document.querySelectorAll("#questions input")].map((input) => [input.dataset.field, input.value.trim()]));
  const form = $("#task-form");
  form.title.value = draft.split(/[.!?]/)[0].replace(/^нужен[а-яё ]*/i, "").trim() || "Новая бизнес-задача";
  form.context.value = draft;
  Object.entries(answers).forEach(([field, value]) => { if (form[field]) form[field].value = value; });
  $("#card-panel").classList.remove("hidden");
  updateLiveScore();
  $("#card-panel").scrollIntoView({ behavior: "smooth", block: "start" });
});
$("#task-form").addEventListener("input", updateLiveScore);
function formTask() {
  const data = Object.fromEntries(new FormData($("#task-form")).entries());
  data.id = "task-" + Date.now(); data.topic = "web"; data.published = false; data.score = scoreTask(data);
  return data;
}
function updateLiveScore() {
  const task = formTask(), score = task.score, [label] = level(score);
  $("#live-score").textContent = score + " / 100";
  $("#score-list").innerHTML = Object.entries(weights).map(([field, weight]) => {
    const labels = { context: "Контекст и потребность", data: "Данные и материалы", result: "Ожидаемый результат", success: "Критерии успеха", constraints: "Ограничения", users: "Пользователи", contact: "Контакт и взаимодействие" };
    const earned = task[field]?.trim() ? weight : 0;
    return `<li><span>${labels[field]}</span><strong>${earned}/${weight}</strong></li>`;
  }).join("") + `<li><span>Уровень готовности</span><strong>${label}</strong></li>`;
}
$("#publish-button").addEventListener("click", () => {
  const form = $("#task-form");
  if (!form.title.value.trim() || !form.context.value.trim()) return showToast("Заполните название и контекст задачи.");
  const task = formTask(); task.published = true; tasks.push(task); save(); renderCatalog();
  showToast(`Задача опубликована: ${task.score}/100`);
  setView("catalog");
});

function openProposal(taskId) {
  selectedTaskId = taskId;
  const task = tasks.find((item) => item.id === taskId);
  $("#proposal-task-title").textContent = task.title;
  $("#proposal-form").taskId.value = taskId;
  dialog.showModal();
}
$("#proposal-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget).entries());
  if (!data.team || !data.idea) return showToast("Укажите команду и идею решения.");
  proposals.push({ ...data, id: "proposal-" + Date.now(), status: "pending" });
  save(); dialog.close(); event.currentTarget.reset(); renderProposals(); showToast("Отклик отправлен бизнесу.");
});
function renderProposals() {
  const list = $("#proposals-list");
  if (!proposals.length) { list.innerHTML = '<div class="empty">Откликов пока нет. Откройте каталог как команда и оставьте первый.</div>'; return; }
  list.innerHTML = proposals.map((proposal) => {
    const task = tasks.find((item) => item.id === proposal.taskId);
    const status = proposal.status === "accepted" ? "Выбрана" : proposal.status === "rejected" ? "Отклонена" : "Ожидает решения";
    return `<article class="proposal-card"><header><div><p class="eyebrow">${escapeHtml(task?.title || "Задача")}</p><h2>${escapeHtml(proposal.team)}</h2></div><span class="status ${proposal.status === "accepted" ? "ready" : ""}">${status}</span></header><p><b>Идея:</b> ${escapeHtml(proposal.idea)}</p><p><b>План:</b> ${escapeHtml(proposal.plan || "Не указан")}</p><p><b>Срок:</b> ${escapeHtml(proposal.deadline || "Не указан")}</p>${proposal.status === "pending" ? `<div class="proposal-actions"><button class="secondary-button accept" data-action="accept" data-id="${proposal.id}">Выбрать команду</button><button class="secondary-button reject" data-action="reject" data-id="${proposal.id}">Отклонить</button></div>` : ""}</article>`;
  }).join("");
  document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
    const proposal = proposals.find((item) => item.id === button.dataset.id);
    proposal.status = button.dataset.action === "accept" ? "accepted" : "rejected";
    save(); renderProposals(); showToast(button.dataset.action === "accept" ? "Команда выбрана вручную." : "Отклик отклонён.");
  }));
}
$("#topic-filter").addEventListener("change", renderCatalog);
$("#readiness-filter").addEventListener("change", renderCatalog);
renderCatalog(); renderProposals();