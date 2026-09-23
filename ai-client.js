const fallbackQuestions = [
  ["Кто будет пользоваться результатом?", "users", "Например: менеджеры, владельцы, клиенты."],
  ["Какие данные, материалы или примеры уже доступны?", "data", "Например: CSV, брендбук, ссылка на текущий сайт."],
  ["Как вы поймёте, что задача успешно решена?", "success", "Например: менеджер собирает отчёт без Excel."],
  ["Какие сроки или технические ограничения есть?", "constraints", "Например: запуск до 15 октября, только веб."]
];
function renderAiQuestions(questions, fields = []) {
  const container = document.querySelector("#questions");
  container.innerHTML = questions.slice(0, 4).map((question, index) => {
    const field = fields[index] || fallbackQuestions[index]?.[1] || "constraints";
    return `<div class="question"><label for="answer-${index}">${index + 1}. ${question}</label><input id="answer-${index}" data-field="${field}" placeholder="Ваш ответ" /></div>`;
  }).join("");
  document.querySelector("#questions-panel").classList.remove("hidden");
  document.querySelector("#questions-panel").scrollIntoView({ behavior: "smooth", block: "start" });
}
document.querySelector("#analyze-button").addEventListener("click", async (event) => {
  event.stopImmediatePropagation();
  const draft = document.querySelector("#draft").value.trim();
  if (draft.length < 10) return window.showToast?.("Опишите задачу хотя бы парой предложений.");
  const button = event.currentTarget; button.disabled = true; button.textContent = "AI анализирует…";
  try {
    const response = await fetch("/api/analyze-task", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft }) });
    if (!response.ok) throw new Error("AI unavailable");
    const data = await response.json();
    renderAiQuestions(data.questions, data.missingFields);
    document.querySelector("#analysis-summary").textContent = "AI нашёл поля, которых не хватает для понятной задачи. Проверьте и ответьте только тем, что знаете.";
  } catch {
    renderAiQuestions(fallbackQuestions.map(([question]) => question), fallbackQuestions.map(([, field]) => field));
    document.querySelector("#analysis-summary").textContent = "AI временно недоступен — используем безопасный ручной режим уточнения.";
  } finally { button.disabled = false; button.innerHTML = "AI: найти, что уточнить <span aria-hidden=\"true\">→</span>"; }
}, true);
