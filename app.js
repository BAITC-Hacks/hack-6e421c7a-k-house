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
// Каталог, карточка задачи и отклики — в student-flow.js.
function escapeHtml(value = "") { return String(value ?? "").replace(/[&<>"']/g, (symbol) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[symbol])); }

$("#build-card-button").addEventListener("click", () => {
  const draft = $("#draft").value.trim();
  const answers = Object.fromEntries([...document.querySelectorAll("#questions input")].map((input) => [input.dataset.field, input.value.trim()]));
  const form = $("#task-form");
  const title = draft.split(/[.!?]/)[0].replace(/^(?:нам\s+)?нуж(?:ен|на|но|ны)\s+/i, "").trim();
  form.title.value = title ? title[0].toUpperCase() + title.slice(1) : "Новая бизнес-задача";
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
