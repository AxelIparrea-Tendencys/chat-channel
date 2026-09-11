// Chat del portal. Sin dependencias: se sirve como estático desde GitHub Pages
// y solo habla con el backend que corre en la laptop.
//
// El token NUNCA vive en este archivo. Esta página es pública: cualquiera puede
// leer su código. El token lo escribe la persona, se queda en sessionStorage
// (se borra al cerrar la pestaña) y solo viaja en el header Authorization.

const KEY_ENDPOINT = "ai-assistant.endpoint";
const KEY_TOKEN = "ai-assistant.token";

// Turnos que se mandan al backend para que no pierda el hilo de una tarea.
// Se recortan aquí porque el modelo que los lee es chico.
const MAX_HISTORY = 8;

// Historial de la conversación en memoria. No se persiste: al recargar se
// empieza limpio, y así no queda nada sensible guardado en el navegador.
const history = [];

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
      // ngrok en plan gratuito intercepta las peticiones de navegador con una
      // página de advertencia. Sin este header, fetch recibe ese HTML en vez
      // del JSON del backend y todo falla con un error de parseo confuso.
      "ngrok-skip-browser-warning": "true",
    },
    body: JSON.stringify(payload || {}),
  });

  let data;
  try {
    data = await response.json();
  } catch {
    // Respuesta no-JSON: casi siempre es un intermediario (la advertencia de
    // ngrok, un portal de wifi) respondiendo en lugar del backend.
    throw new Error(
      `El backend respondió ${response.status} sin JSON. ` +
        "Revisa que la URL apunte a tu backend y no a otra cosa."
    );
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

const HELP = `Escribe en lenguaje normal. El asistente decide qué hacer:

  "qué hay en mis descargas"       lista la carpeta
  "cuál es el último archivo de X" busca y ordena por fecha
  "muéstrame el archivo Y"         lo lee
  "cómo va el repo Z"              git status
  "recuerda que mi repo es X"      lo guarda para siempre
  "qué sabes de mi repo"           consulta lo que guardó

Lo que necesita código, Slack o correo lo escala solo a Claude Code.

Comandos directos, si prefieres saltarte al asistente:
  /health   estado del backend
  /help     esto`;

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

  throw new Error(`Comando desconocido: /${cmd}. Usa /help, o pídelo en lenguaje normal.`);
}

async function send() {
  const input = $("msg");
  const text = input.value.trim();
  if (!text) return;

  input.value = "";
  addTurn(text, "mine");
  $("send").disabled = true;
  history.push({ role: "user", content: text });

  const pending = addTurn("…", "");

  try {
    if (text.startsWith("/")) {
      pending.lastChild.textContent = await handleCommand(text);
    } else {
      // Un solo endpoint: el backend decide si responde local, usa una
      // herramienta o escala. La persona no elige motor.
      const data = await call("/api/agent", {
        message: text,
        history: history.slice(-MAX_HISTORY),
      });
      pending.lastChild.textContent = data.reply || "(sin respuesta)";
      const etiqueta = data.tool
        ? `${data.engine} · ${data.tool}`
        : data.engine || "asistente";
      pending.querySelector(".who").textContent = etiqueta;
      if (data.reply) history.push({ role: "assistant", content: data.reply });
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
  history.length = 0;
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
