import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const PORT = process.env.PORT || 3000;
const root = process.cwd();
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8" };
const schema = {
  type: "object", additionalProperties: false,
  properties: {
    questions: { type: "array", minItems: 3, maxItems: 4, items: { type: "string" } },
    missingFields: { type: "array", items: { type: "string", enum: ["users", "data", "success", "constraints"] } }
  },
  required: ["questions", "missingFields"]
};

function send(res, code, body, type = "application/json") {
  res.writeHead(code, { "Content-Type": type }); res.end(typeof body === "string" ? body : JSON.stringify(body));
}
async function parseJson(req) {
  let raw = ""; for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || "{}");
}
async function analyzeDraft(draft) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not configured");
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-6-astra",
      input: [
        { role: "developer", content: "You prepare business tasks for student teams. Do not invent facts. Return only questions that ask for missing information in the draft." },
        { role: "user", content: draft }
      ],
      text: { format: { type: "json_schema", name: "task_questions", strict: true, schema } }
    })
  });
  if (!response.ok) throw new Error(`OpenAI request failed: ${response.status}`);
  const result = await response.json();
  const text = result.output_text || result.output
    ?.flatMap((item) => item.content || [])
    .find((item) => item.type === "output_text")?.text;
  if (!text) throw new Error("AI returned no structured text");
  const parsed = JSON.parse(text);
  if (!Array.isArray(parsed.questions) || parsed.questions.length < 3) throw new Error("Invalid AI response");
  return parsed;
}
createServer(async (req, res) => {
  try {
    if (req.method === "POST" && req.url === "/api/analyze-task") {
      const { draft } = await parseJson(req);
      if (typeof draft !== "string" || draft.trim().length < 10) return send(res, 400, { error: "Draft must contain at least 10 characters." });
      return send(res, 200, await analyzeDraft(draft.trim()));
    }
    const url = req.url === "/" ? "/index.html" : req.url.split("?")[0];
    const file = normalize(join(root, url));
    if (!file.startsWith(root)) return send(res, 403, "Forbidden", "text/plain");
    const content = await readFile(file);
    return send(res, 200, content, types[extname(file)] || "application/octet-stream");
  } catch (error) {
    if (req.url === "/api/analyze-task") return send(res, 503, { error: "AI is unavailable. Use manual questions." });
    return send(res, 404, "Not found", "text/plain");
  }
}).listen(PORT, () => console.log(`TaskBridge AI: http://localhost:${PORT}`));