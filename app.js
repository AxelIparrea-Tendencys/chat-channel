// Chat del portal. Sin dependencias: se sirve como estático desde GitHub Pages
// y solo habla con el backend que corre en la laptop.
//
// El token NUNCA vive en este archivo. Esta página es pública: cualquiera puede
// leer su código. El token lo escribe la persona, se queda en sessionStorage
// (se borra al cerrar la pestaña) y solo viaja en el header Authorization.

const KEY_ENDPOINT = "ai-assistant.endpoint";
const KEY_TOKEN = "ai-assistant.token";

const $ = (id) => document.getElementById(id);

const setup = $("setup");
const app = $("app");
const log = $("log");
const status = $("status");

let endpoint = "";
let token = "";

function saveSession() {
  try {
    sessionStorage.setItem(KEY_TOKEN, token);
    localStorage.setItem(KEY_ENDPOINT, endpoint);
  } catch {
    // Modo privado o almacenamiento bloqueado: la sesión simplemente no persiste.
  }
}

function restoreSession() {
  const configured = (window.AI_ASSISTANT_CONFIG || {}).endpoint || "";
  const titulo = (window.AI_ASSISTANT_CONFIG || {}).title;
  if (titulo) {
    document.title = titulo;
    document.querySelector("#setup h1").textContent = titulo;
  }
  try {
    // Lo que la persona escribió gana sobre el valor de config.js.
    $("endpoint").value = localStorage.getItem(KEY_ENDPOINT) || configured;
    const saved = sessionStorage.getItem(KEY_TOKEN);
    if (saved) $("token").value = saved;
  } catch {
    $("endpoint").value = configured;
  }
}

function normalizeEndpoint(raw) {
  const trimmed = (raw || "").trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Falta el endpoint.");
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("El endpoint no es una URL válida.");
  }
  // El token viaja en cada petición: sobre http plano lo lee cualquiera en la
  // red. localhost se permite porque no sale de la máquina.
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLocal) {
    throw new Error("Usa https. Sobre http el token viaja en claro.");
  }
  return trimmed;
}

async function call(path, payload) {
  const response = await fetch(endpoint + path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload || {}),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`El backend respondió ${response.status} sin JSON.`);
  }
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function addTurn(text, kind) {
  const el = document.createElement("div");
  el.className = `turn ${kind || ""}`.trim();
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = kind === "mine" ? "tú" : kind === "err" ? "error" : "asistente";
  el.append(who, document.createTextNode(text));
  log.append(el);
  log.scrollTop = log.scrollHeight;
  return el;
}

const HELP = `Comandos:
  /ls [ruta]        lista un directorio permitido
  /cat <ruta>       muestra un archivo
  /git <repo>       git status de un repo
  /health           estado del backend
  /help             esto

Cualquier otro texto va al motor que elijas abajo.
"Local" usa el modelo de tu compu y no cuesta nada.
"Claude Code" usa tu sesión, y tiene Slack, Gmail y Drive conectados.`;

async function handleCommand(raw) {
  const [cmd, ...rest] = raw.slice(1).split(/\s+/);
  const arg = rest.join(" ").trim();

  if (cmd === "help") return HELP;

  if (cmd === "health") {
    const data = await call("/api/health", {});
    const roots = data.roots
      .map((r) => `  ${r.accesible ? "✓" : "✗"} ${r.path}`)
      .join("\n");
    return [
      `LLM local:  ${data.llm_local ? "arriba" : "no responde"}`,
      `Claude CLI: ${data.claude_cli ? "disponible" : "no encontrado"}`,
      `Rutas permitidas:`,
      roots,
    ].join("\n");
  }

  if (cmd === "ls") {
    const data = await call("/api/list", arg ? { path: arg } : {});
    return `${data.path}\n\n${data.entries.join("\n") || "(vacío)"}`;
  }

  if (cmd === "cat") {
    if (!arg) throw new Error("Uso: /cat <ruta>");
    const data = await call("/api/read", { path: arg });
    return data.content + (data.truncated ? "\n\n[...truncado]" : "");
  }

  if (cmd === "git") {
    if (!arg) throw new Error("Uso: /git <ruta del repo>");
    const data = await call("/api/git", { repo: arg, command: "status" });
    return data.output;
  }

  throw new Error(`Comando desconocido: /${cmd}. Usa /help.`);
}

async function send() {
  const input = $("msg");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addTurn(text, "mine");
  $("send").disabled = true;

  const pending = addTurn("…", "");

  try {
    if (text.startsWith("/")) {
      pending.lastChild.textContent = await handleCommand(text);
    } else {
      const data = await call($("engine").value, { message: text });
      pending.lastChild.textContent = data.reply || "(sin respuesta)";
      pending.querySelector(".who").textContent = data.engine || "asistente";
    }
  } catch (error) {
    pending.className = "turn err";
    pending.querySelector(".who").textContent = "error";
    pending.lastChild.textContent = error.message;
  } finally {
    $("send").disabled = false;
    input.focus();
  }
}

async function connect() {
  const errorBox = $("setup-error");
  errorBox.hidden = true;
  $("connect").disabled = true;

  try {
    endpoint = normalizeEndpoint($("endpoint").value);
    token = $("token").value.trim();
    if (!token) throw new Error("Falta el token.");

    const health = await call("/api/health", {});
    saveSession();

    setup.hidden = true;
    app.hidden = false;
    status.textContent = health.llm_local ? "local arriba" : "local caído";
    status.className = `status ${health.llm_local ? "ok" : "bad"}`;
    addTurn("Conectado. Escribe /help para ver qué puedo hacer.", "");
    $("msg").focus();
  } catch (error) {
    errorBox.textContent =
      error.message === "Failed to fetch"
        ? "No se pudo conectar. Revisa que el backend y ngrok estén corriendo, y que este origen esté en AI_ASSISTANT_ALLOWED_ORIGINS."
        : error.message;
    errorBox.hidden = false;
  } finally {
    $("connect").disabled = false;
  }
}

function logout() {
  token = "";
  try {
    sessionStorage.removeItem(KEY_TOKEN);
  } catch {
    // Nada que limpiar si el almacenamiento no está disponible.
  }
  $("token").value = "";
  log.replaceChildren();
  app.hidden = true;
  setup.hidden = false;
}

$("connect").addEventListener("click", connect);
$("logout").addEventListener("click", logout);
$("send").addEventListener("click", send);
$("msg").addEventListener("keydown", (e) => {
  if (e.key === "Enter") send();
});
$("token").addEventListener("keydown", (e) => {
  if (e.key === "Enter") connect();
});

restoreSession();
