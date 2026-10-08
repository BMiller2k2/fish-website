import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import {
  listFish,
  getFish,
  fishExists,
  createFish,
  updateFish,
  deleteFish,
  seedFromJsonIfEmpty,
} from "./db.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Minimal .env loader (so we don't need a dependency just to read a file).
// Lines look like  KEY=value  ; anything after # on its own line is ignored.
// ---------------------------------------------------------------------------
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const PORT = process.env.PORT || 3000;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

if (!GEMINI_API_KEY) {
  console.warn(
    "\n  ⚠  GEMINI_API_KEY is not set. The fish gallery still works,\n" +
      "     but the chatbot will return an error until you add a key to .env\n",
  );
}

// The catalog lives in SQLite (see db.js). On first run against an empty
// database, import the seed fish from the old data/fish.json if it's there.
const seeded = seedFromJsonIfEmpty();
if (seeded > 0) {
  console.log(`  ↳ imported ${seeded} fish from data/fish.json into the database`);
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

// ---------------------------------------------------------------------------
// App
// ---------------------------------------------------------------------------
const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

function requireAdmin(req, res, next) {
  if (!ADMIN_TOKEN) return next(); // no token configured => admin is open (local dev)
  if (req.get("x-admin-token") === ADMIN_TOKEN) return next();
  res.status(401).json({ error: "Invalid or missing admin token." });
}

// --- Admin sign-in ------------------------------------------------------
// The sign-in page asks whether a token is even needed, then posts the token
// here to check it before sending the user on to the admin page. There's no
// server-side session — the browser stores the token and sends it as the
// x-admin-token header on every write (see requireAdmin above).
app.get("/api/admin/config", (_req, res) => {
  res.json({ tokenRequired: Boolean(ADMIN_TOKEN) });
});

app.post("/api/admin/login", (req, res) => {
  if (!ADMIN_TOKEN) return res.json({ ok: true }); // open in local dev
  const token = String(req.body?.token || "");
  if (token && token === ADMIN_TOKEN) return res.json({ ok: true });
  res.status(401).json({ error: "That admin token isn't right." });
});

// Parse the `facts` field, which may arrive as an array or a newline string.
function parseFacts(facts) {
  const list = Array.isArray(facts) ? facts : String(facts || "").split("\n");
  return list.map((f) => String(f).trim()).filter(Boolean);
}

// --- Fish CRUD -------------------------------------------------------------
app.get("/api/fish", (_req, res) => {
  res.json(listFish());
});

app.post("/api/fish", requireAdmin, (req, res) => {
  const body = req.body || {};
  if (!body.name || !String(body.name).trim()) {
    return res.status(400).json({ error: "A fish needs at least a name." });
  }
  let id = body.id ? slugify(body.id) : slugify(body.name);
  if (!id) id = "fish-" + Date.now();
  let unique = id;
  let n = 2;
  while (fishExists(unique)) unique = `${id}-${n++}`;

  const entry = {
    id: unique,
    name: String(body.name).trim(),
    scientificName: (body.scientificName || "").trim(),
    habitat: (body.habitat || "").trim(),
    diet: (body.diet || "").trim(),
    size: (body.size || "").trim(),
    imageUrl: (body.imageUrl || "").trim(),
    description: (body.description || "").trim(),
    facts: parseFacts(body.facts),
  };
  res.status(201).json(createFish(entry));
});

app.put("/api/fish/:id", requireAdmin, (req, res) => {
  const current = getFish(req.params.id);
  if (!current) return res.status(404).json({ error: "Fish not found." });
  const body = req.body || {};
  const updated = {
    ...current,
    name: body.name != null ? String(body.name).trim() : current.name,
    scientificName:
      body.scientificName != null
        ? String(body.scientificName).trim()
        : current.scientificName,
    habitat: body.habitat != null ? String(body.habitat).trim() : current.habitat,
    diet: body.diet != null ? String(body.diet).trim() : current.diet,
    size: body.size != null ? String(body.size).trim() : current.size,
    imageUrl: body.imageUrl != null ? String(body.imageUrl).trim() : current.imageUrl,
    description:
      body.description != null
        ? String(body.description).trim()
        : current.description,
    facts: body.facts != null ? parseFacts(body.facts) : current.facts,
  };
  res.json(updateFish(req.params.id, updated));
});

app.delete("/api/fish/:id", requireAdmin, (req, res) => {
  if (!deleteFish(req.params.id))
    return res.status(404).json({ error: "Fish not found." });
  res.json({ ok: true });
});

// --- Chatbot (Google Gemini) --------------------------------------------
const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

app.post("/api/chat", async (req, res) => {
  if (!GEMINI_API_KEY) {
    return res
      .status(500)
      .json({ error: "The server's GEMINI_API_KEY is missing." });
  }

  const history = Array.isArray(req.body?.messages) ? req.body.messages : [];
  if (history.length === 0) {
    return res.status(400).json({ error: "No messages provided." });
  }

  // Map the browser's history to Gemini's shape: user -> "user",
  // assistant -> "model". Keep only valid turns and cap the length.
  const contents = history
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-20)
    .map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.content) }],
    }));

  const fish = listFish();
  const catalog =
    fish.length > 0
      ? JSON.stringify(fish, null, 2)
      : "(The catalog is currently empty — no fish have been added yet.)";

  const system = [
    "You are a friendly aquarium guide on a small website about fish.",
    "Answer visitors' questions about the fish in the site's catalog below.",
    "Prefer information grounded in the catalog. If the catalog doesn't cover",
    "something, you may share accurate general knowledge, but say when you're",
    "going beyond the catalog. If the catalog is empty, tell the visitor that",
    "no fish have been added yet. Keep answers concise and conversational.",
    "",
    "=== FISH CATALOG (JSON) ===",
    catalog,
  ].join("\n");

  try {
    const response = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": GEMINI_API_KEY,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: system }] },
        contents,
        generationConfig: { maxOutputTokens: 1024 },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      console.error("Gemini error:", response.status, detail);
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return res
          .status(500)
          .json({ error: "The server's GEMINI_API_KEY is missing or invalid." });
      }
      if (response.status === 429) {
        return res
          .status(429)
          .json({ error: "The chatbot is rate limited right now. Try again shortly." });
      }
      return res
        .status(500)
        .json({ error: "The chatbot had a problem answering that." });
    }

    const data = await response.json();
    const text = (data.candidates?.[0]?.content?.parts || [])
      .filter((p) => typeof p.text === "string")
      .map((p) => p.text)
      .join("")
      .trim();
    res.json({ reply: text || "(no response)" });
  } catch (err) {
    console.error("Chat error:", err?.message || err);
    res.status(500).json({ error: "The chatbot had a problem answering that." });
  }
});

app.listen(PORT, () => {
  console.log(`\n  🐟  Fish website running at http://localhost:${PORT}`);
  console.log(`      Admin page:  http://localhost:${PORT}/admin.html\n`);
});
