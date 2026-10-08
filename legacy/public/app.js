// ---------------------------------------------------------------------------
// Fish gallery
// ---------------------------------------------------------------------------
const grid = document.getElementById("grid");
const emptyEl = document.getElementById("empty");
const countEl = document.getElementById("count");
const searchEl = document.getElementById("search");
const detail = document.getElementById("detail");
const detailBody = document.getElementById("detail-body");

let allFish = [];

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function photo(f, cls) {
  if (f.imageUrl) {
    return `<img class="${cls}" src="${esc(f.imageUrl)}" alt="${esc(f.name)}"
      onerror="this.replaceWith(Object.assign(document.createElement('div'),{className:'${cls} placeholder',textContent:'🐟'}))" />`;
  }
  return `<div class="${cls} placeholder">🐟</div>`;
}

function render() {
  const q = searchEl.value.trim().toLowerCase();
  const list = allFish.filter((f) => {
    if (!q) return true;
    return [f.name, f.scientificName, f.habitat, f.diet, f.description]
      .join(" ").toLowerCase().includes(q);
  });

  countEl.textContent = allFish.length
    ? `${list.length} of ${allFish.length} fish`
    : "";
  emptyEl.hidden = allFish.length !== 0;
  grid.innerHTML = list
    .map(
      (f) => `
      <article class="card" data-id="${esc(f.id)}">
        ${photo(f, "photo")}
        <div class="body">
          <h3>${esc(f.name)}</h3>
          ${f.scientificName ? `<span class="sci">${esc(f.scientificName)}</span>` : ""}
          ${f.description ? `<p class="desc">${esc(f.description)}</p>` : ""}
        </div>
      </article>`,
    )
    .join("");
}

grid.addEventListener("click", (e) => {
  const card = e.target.closest(".card");
  if (!card) return;
  const f = allFish.find((x) => x.id === card.dataset.id);
  if (!f) return;
  const rows = [
    ["Scientific name", f.scientificName],
    ["Habitat", f.habitat],
    ["Diet", f.diet],
    ["Size", f.size],
  ].filter(([, v]) => v);
  detailBody.innerHTML = `
    ${photo(f, "")}
    <h2>${esc(f.name)}</h2>
    ${f.scientificName ? `<span class="sci">${esc(f.scientificName)}</span>` : ""}
    ${f.description ? `<p>${esc(f.description)}</p>` : ""}
    ${rows.length ? `<dl>${rows.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl>` : ""}
    ${
      f.facts && f.facts.length
        ? `<strong>Did you know?</strong><ul>${f.facts.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>`
        : ""
    }
    <div class="close-row"><button class="ghost" onclick="document.getElementById('detail').close()">Close</button></div>
  `;
  detail.showModal();
});

detail.addEventListener("click", (e) => {
  if (e.target === detail) detail.close();
});

searchEl.addEventListener("input", render);

async function loadFish() {
  const res = await fetch("/api/fish");
  allFish = await res.json();
  render();
}
loadFish();

// ---------------------------------------------------------------------------
// Chatbot
// ---------------------------------------------------------------------------
const toggle = document.getElementById("chat-toggle");
const panel = document.getElementById("chat-panel");
const log = document.getElementById("chat-log");
const form = document.getElementById("chat-form");
const textEl = document.getElementById("chat-text");
const sendBtn = document.getElementById("chat-send");

// Conversation history sent to the server each turn.
const history = [];
let greeted = false;

function addBubble(role, text) {
  const div = document.createElement("div");
  div.className = "msg " + role;
  div.textContent = text;
  log.appendChild(div);
  log.scrollTop = log.scrollHeight;
  return div;
}

// Greet once, the first time the visitor actually opens the panel.
function greet() {
  if (greeted) return;
  greeted = true;
  addBubble(
    "bot",
    "Hi! I'm the fish guide. Ask me about any fish in the catalog — habitat, diet, fun facts, or how two fish compare.",
  );
}

function expandChat() {
  panel.classList.remove("collapsed");
  panel.classList.remove("attention"); // stop flashing once acknowledged
  document.getElementById("chat-collapse").setAttribute("aria-label", "Collapse chat");
  greet();
  textEl.focus();
}

function openChat() {
  panel.hidden = false;
  toggle.hidden = true;
  expandChat();
}

function closeChat() {
  panel.hidden = true;
  toggle.hidden = false;
}

function toggleCollapsed() {
  if (panel.classList.contains("collapsed")) {
    expandChat();
  } else {
    panel.classList.add("collapsed");
    document.getElementById("chat-collapse").setAttribute("aria-label", "Expand chat");
  }
}

toggle.addEventListener("click", openChat);

// Clicking anywhere on the header collapses / expands the panel, except when
// the click lands on the ✕ (which closes it back to the pill button).
document.getElementById("chat-header").addEventListener("click", (e) => {
  if (e.target.closest("#chat-close")) return;
  toggleCollapsed();
});
document.getElementById("chat-close").addEventListener("click", (e) => {
  e.stopPropagation();
  closeChat();
});

// The guide starts collapsed (see index.html). A moment after load, flash it
// once so a first-time visitor notices it's there; the flash clears itself
// when the animation ends or as soon as the visitor opens the panel.
panel.addEventListener(
  "animationend",
  () => panel.classList.remove("attention"),
  { once: true },
);
setTimeout(() => {
  if (panel.classList.contains("collapsed")) panel.classList.add("attention");
}, 700);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const question = textEl.value.trim();
  if (!question) return;

  addBubble("user", question);
  history.push({ role: "user", content: question });
  textEl.value = "";
  textEl.disabled = true;
  sendBtn.disabled = true;

  const thinking = addBubble("bot", "…");

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: history }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    thinking.textContent = data.reply;
    history.push({ role: "assistant", content: data.reply });
  } catch (err) {
    thinking.remove();
    addBubble("error", "⚠ " + err.message);
    // Drop the unanswered question so history stays valid.
    history.pop();
  } finally {
    textEl.disabled = false;
    sendBtn.disabled = false;
    textEl.focus();
  }
});
