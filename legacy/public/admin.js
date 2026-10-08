const $ = (id) => document.getElementById(id);
const form = $("form");
const listEl = $("list");
const noticeEl = $("notice");
const cancelBtn = $("cancel");
const saveBtn = $("save");

const TOKEN_KEY = "fishAdminToken"; // shared with login.js

function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function goToLogin() {
  location.href = "/login.html?next=/admin.html";
}

// Bounce to the sign-in page if this server requires a token and we don't
// have one stored yet.
(async () => {
  try {
    const cfg = await (await fetch("/api/admin/config")).json();
    if (cfg.tokenRequired && !getToken()) goToLogin();
  } catch {}
})();

$("signout").addEventListener("click", (e) => {
  e.preventDefault();
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {}
  location.href = "/login.html";
});

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function notify(msg, ok = true) {
  noticeEl.hidden = false;
  noticeEl.textContent = msg;
  noticeEl.className = "notice " + (ok ? "ok" : "bad");
  if (ok) setTimeout(() => (noticeEl.hidden = true), 3000);
}

function headers() {
  const h = { "content-type": "application/json" };
  const t = getToken();
  if (t) h["x-admin-token"] = t;
  return h;
}

// A 401 means the stored token is missing or wrong — send them to sign in.
function handleAuth(res) {
  if (res.status === 401) {
    goToLogin();
    return true;
  }
  return false;
}

async function loadList() {
  const fish = await (await fetch("/api/fish")).json();
  listEl.innerHTML =
    fish
      .map(
        (f) => `
    <div class="admin-row" data-id="${esc(f.id)}">
      ${f.imageUrl ? `<img src="${esc(f.imageUrl)}" alt="" />` : `<div style="width:54px;height:54px;display:flex;align-items:center;justify-content:center">🐟</div>`}
      <div class="grow">
        <strong>${esc(f.name)}</strong><br />
        <small>${esc(f.scientificName || f.habitat || "")}</small>
      </div>
      <button class="ghost" data-act="edit">Edit</button>
      <button class="ghost" data-act="delete">Delete</button>
    </div>`,
      )
      .join("") || `<p style="color:var(--muted)">No fish yet.</p>`;
  window._fish = fish;
}

function fillForm(f) {
  $("editing").value = f.id;
  for (const k of ["name", "scientificName", "size", "imageUrl", "habitat", "diet", "description"]) {
    $(k).value = f[k] || "";
  }
  $("facts").value = (f.facts || []).join("\n");
  saveBtn.textContent = "Save changes";
  cancelBtn.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  $("editing").value = "";
  saveBtn.textContent = "Add fish";
  cancelBtn.hidden = true;
}

cancelBtn.addEventListener("click", resetForm);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const id = $("editing").value;
  const payload = {
    name: $("name").value,
    scientificName: $("scientificName").value,
    size: $("size").value,
    imageUrl: $("imageUrl").value,
    habitat: $("habitat").value,
    diet: $("diet").value,
    description: $("description").value,
    facts: $("facts").value,
  };
  const res = await fetch(id ? `/api/fish/${encodeURIComponent(id)}` : "/api/fish", {
    method: id ? "PUT" : "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  if (handleAuth(res)) return;
  const data = await res.json();
  if (!res.ok) return notify(data.error || "Save failed", false);
  notify(id ? "Fish updated." : "Fish added.");
  resetForm();
  loadList();
});

listEl.addEventListener("click", async (e) => {
  const btn = e.target.closest("button");
  if (!btn) return;
  const row = e.target.closest(".admin-row");
  const id = row.dataset.id;
  const f = (window._fish || []).find((x) => x.id === id);

  if (btn.dataset.act === "edit" && f) fillForm(f);

  if (btn.dataset.act === "delete") {
    if (!confirm(`Delete "${f ? f.name : id}"?`)) return;
    const res = await fetch(`/api/fish/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: headers(),
    });
    if (handleAuth(res)) return;
    const data = await res.json();
    if (!res.ok) return notify(data.error || "Delete failed", false);
    notify("Fish deleted.");
    loadList();
  }
});

loadList();
