const TOKEN_KEY = "fishAdminToken"; // shared with admin.js

const form = document.getElementById("login-form");
const tokenEl = document.getElementById("token");
const submitBtn = document.getElementById("submit");
const hintEl = document.getElementById("hint");
const noticeEl = document.getElementById("notice");

// Where to go after a successful sign-in. Only allow same-site paths so a
// crafted ?next=https://evil.example can't turn this into an open redirect.
function nextUrl() {
  const raw = new URLSearchParams(location.search).get("next") || "/admin.html";
  return /^\/[^/]/.test(raw) ? raw : "/admin.html";
}

function notify(msg) {
  noticeEl.hidden = false;
  noticeEl.textContent = msg;
  noticeEl.className = "notice bad";
}

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

function saveToken(value) {
  try {
    if (value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {}
}

let tokenRequired = true;

// Ask the server whether a token is needed at all.
(async () => {
  tokenEl.value = readToken();
  try {
    const cfg = await (await fetch("/api/admin/config")).json();
    tokenRequired = Boolean(cfg.tokenRequired);
  } catch {
    // Assume a token is required if we can't reach the server.
  }
  if (!tokenRequired) {
    hintEl.hidden = false;
    hintEl.textContent =
      "This server has no ADMIN_TOKEN set, so sign-in isn't required for local development.";
    tokenEl.closest("label").hidden = true;
    submitBtn.textContent = "Continue to admin";
  }
})();

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const token = tokenEl.value.trim();
  submitBtn.disabled = true;

  try {
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await res.json();
    if (!res.ok) {
      notify(data.error || "Sign-in failed.");
      submitBtn.disabled = false;
      return;
    }
    saveToken(tokenRequired ? token : "");
    location.href = nextUrl();
  } catch {
    notify("Couldn't reach the server. Try again.");
    submitBtn.disabled = false;
  }
});
