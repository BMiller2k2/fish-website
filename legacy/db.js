// ---------------------------------------------------------------------------
// SQLite data layer for the fish catalog.
//
// The catalog lives in two tables:
//   fish        — one row per fish (scalar fields)
//   fish_facts  — one row per "did you know?" fact, linked to a fish by
//                 fish_id, ordered by position (a proper relational child
//                 table rather than a JSON blob)
//
// Every function here speaks the same camelCase shape the HTTP API uses, so
// server.js never sees a column name or a SQL statement.
// ---------------------------------------------------------------------------
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "fish.db");
const SEED_FILE = path.join(__dirname, "data", "fish.json");

fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL"); // better concurrent read/write behaviour
db.pragma("foreign_keys = ON"); // enforce fish_facts -> fish, enable ON DELETE CASCADE

db.exec(`
  CREATE TABLE IF NOT EXISTS fish (
    id              TEXT PRIMARY KEY,
    name            TEXT NOT NULL,
    scientific_name TEXT NOT NULL DEFAULT '',
    habitat         TEXT NOT NULL DEFAULT '',
    diet            TEXT NOT NULL DEFAULT '',
    size            TEXT NOT NULL DEFAULT '',
    image_url       TEXT NOT NULL DEFAULT '',
    description     TEXT NOT NULL DEFAULT '',
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS fish_facts (
    fish_id  TEXT    NOT NULL REFERENCES fish(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    fact     TEXT    NOT NULL,
    PRIMARY KEY (fish_id, position)
  );

  CREATE INDEX IF NOT EXISTS idx_fish_facts_fish ON fish_facts(fish_id);
`);

// --- Prepared statements ---------------------------------------------------
const stmt = {
  all: db.prepare("SELECT * FROM fish ORDER BY name COLLATE NOCASE"),
  one: db.prepare("SELECT * FROM fish WHERE id = ?"),
  exists: db.prepare("SELECT 1 FROM fish WHERE id = ?"),
  count: db.prepare("SELECT COUNT(*) AS n FROM fish"),
  facts: db.prepare("SELECT fact FROM fish_facts WHERE fish_id = ? ORDER BY position"),
  insert: db.prepare(`
    INSERT INTO fish (id, name, scientific_name, habitat, diet, size, image_url, description)
    VALUES (@id, @name, @scientificName, @habitat, @diet, @size, @imageUrl, @description)
  `),
  update: db.prepare(`
    UPDATE fish SET
      name = @name, scientific_name = @scientificName, habitat = @habitat,
      diet = @diet, size = @size, image_url = @imageUrl, description = @description,
      updated_at = datetime('now')
    WHERE id = @id
  `),
  delete: db.prepare("DELETE FROM fish WHERE id = ?"),
  clearFacts: db.prepare("DELETE FROM fish_facts WHERE fish_id = ?"),
  insertFact: db.prepare("INSERT INTO fish_facts (fish_id, position, fact) VALUES (?, ?, ?)"),
};

function rowToFish(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    scientificName: row.scientific_name,
    habitat: row.habitat,
    diet: row.diet,
    size: row.size,
    imageUrl: row.image_url,
    description: row.description,
    facts: stmt.facts.all(row.id).map((r) => r.fact),
  };
}

function writeFacts(id, facts) {
  stmt.clearFacts.run(id);
  facts.forEach((fact, i) => stmt.insertFact.run(id, i, fact));
}

// --- Public API ----------------------------------------------------------
export function listFish() {
  return stmt.all.all().map(rowToFish);
}

export function getFish(id) {
  return rowToFish(stmt.one.get(id));
}

export function fishExists(id) {
  return !!stmt.exists.get(id);
}

// `fish` is a full record: all scalar fields plus a `facts` array.
export const createFish = db.transaction((fish) => {
  stmt.insert.run(fish);
  writeFacts(fish.id, fish.facts);
  return getFish(fish.id);
});

// `fish` is the already-merged full record (server.js merges partial edits
// against the current row before calling this).
export const updateFish = db.transaction((id, fish) => {
  stmt.update.run({ ...fish, id });
  writeFacts(id, fish.facts);
  return getFish(id);
});

export function deleteFish(id) {
  return stmt.delete.run(id).changes > 0; // fish_facts rows go via ON DELETE CASCADE
}

// One-time migration: if the fish table is empty and data/fish.json still
// exists, import it so the switch to SQLite doesn't lose the seed catalog.
export function seedFromJsonIfEmpty() {
  if (stmt.count.get().n > 0) return 0;
  if (!fs.existsSync(SEED_FILE)) return 0;

  let items;
  try {
    items = JSON.parse(fs.readFileSync(SEED_FILE, "utf8"));
  } catch {
    return 0;
  }
  if (!Array.isArray(items) || items.length === 0) return 0;

  const seed = db.transaction((list) => {
    for (const it of list) {
      const fish = {
        id: it.id || String(it.name || "fish").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""),
        name: it.name || "",
        scientificName: it.scientificName || "",
        habitat: it.habitat || "",
        diet: it.diet || "",
        size: it.size || "",
        imageUrl: it.imageUrl || "",
        description: it.description || "",
      };
      stmt.insert.run(fish);
      const facts = Array.isArray(it.facts) ? it.facts : [];
      facts.forEach((fact, i) => stmt.insertFact.run(fish.id, i, fact));
    }
    return list.length;
  });

  return seed(items);
}
