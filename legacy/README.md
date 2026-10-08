# 🐟 Fish Finder

A small website for browsing a catalog of fish and asking an LLM-powered
chatbot questions about them. The chatbot is grounded in your fish catalog and
answered by Google's Gemini.

## What's inside

| Path | Purpose |
| --- | --- |
| `server.js` | Express server: serves the site, a fish CRUD API, and a `/api/chat` proxy to Gemini |
| `db.js` | SQLite data layer — schema, queries, and the one-time JSON import |
| `data/fish.db` | The catalog — a SQLite database (created on first run, gitignored) |
| `data/fish.json` | Seed data. Only read once, to populate an empty database. |
| `public/index.html` | Public catalog + chat widget |
| `public/login.html` | Admin sign-in (token check) — not linked from the public site |
| `public/admin.html` | Form to add / edit / delete fish — reached via the sign-in page |

## The database

The catalog lives in a SQLite file at `data/fish.db`, using two tables:

| Table | Columns |
| --- | --- |
| `fish` | `id`, `name`, `scientific_name`, `habitat`, `diet`, `size`, `image_url`, `description`, `created_at`, `updated_at` |
| `fish_facts` | `fish_id` → `fish(id)`, `position`, `fact` — one row per "did you know?" fact, `ON DELETE CASCADE` |

`db.js` creates the schema on startup if it doesn't exist. On the **first run
against an empty database**, it imports every fish from `data/fish.json` so the
switch from the old JSON store loses nothing. After that, `data/fish.json` is
ignored — manage fish through the admin page or the API. To re-seed from
scratch, delete `data/fish.db` (and its `-wal` / `-shm` sidecar files) and
restart.

Override the database location with `DB_FILE` in `.env`.

## Prerequisites

- **Node.js 20 or newer** (required by `better-sqlite3`). Get it from
  <https://nodejs.org>; verify with `node --version`.
- A **Gemini API key** — <https://aistudio.google.com/apikey>

## Setup

```bash
cd fish-website
npm install

cp .env.example .env      # then edit .env and paste your GEMINI_API_KEY
npm start
```

Open <http://localhost:3000> for the public catalog. The admin area is a
separate page with no link from the public site — go straight to
<http://localhost:3000/login.html> (bookmark it). Sign in there and you're
taken to the management form.

The gallery works without an API key; only the chatbot needs one.

## Managing fish

Use the admin page, or the JSON API directly. The API request/response body
looks like:

```json
{
  "id": "clownfish",
  "name": "Clownfish",
  "scientificName": "Amphiprion ocellaris",
  "habitat": "Coral reefs of the Indian and Pacific Oceans",
  "diet": "Omnivore — algae, plankton, crustaceans",
  "size": "8–11 cm (3–4 in)",
  "imageUrl": "https://…/clownfish.jpg",
  "description": "A short overview.",
  "facts": ["Fun fact one.", "Fun fact two."]
}
```

Only `name` is required. `id` is generated from the name if you don't supply one.

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/fish` | List all fish |
| `POST` | `/api/fish` | Add a fish |
| `PUT` | `/api/fish/:id` | Update a fish (send only the fields you're changing) |
| `DELETE` | `/api/fish/:id` | Remove a fish |

Writes require the `x-admin-token` header when `ADMIN_TOKEN` is set.

## How the chatbot works

`POST /api/chat` receives the conversation history from the browser, attaches the
full fish catalog (read from the database) as context in the system prompt, and
calls the Gemini `generateContent` REST API (via `fetch` — no SDK dependency).
The API key stays on the server and is never exposed to the browser.

The model defaults to `gemini-3.6-flash` in `server.js`. Override it with
`GEMINI_MODEL` in `.env`, e.g. `gemini-3.1-pro-preview` for stronger answers or
`gemini-3.5-flash-lite` for lower cost.

## Deploying

- Set `GEMINI_API_KEY` and a strong `ADMIN_TOKEN` as environment variables.
- With `ADMIN_TOKEN` set, visiting the admin page redirects to `/login.html`;
  the token is checked by `POST /api/admin/login`, then stored in the browser
  and sent as the `x-admin-token` header on every write. There is no
  server-side session. Without `ADMIN_TOKEN` (local dev), sign-in is skipped.
- `data/fish.db` is a file on disk, so use a host with a persistent filesystem.
  For an ephemeral host, point `DB_FILE` at a mounted volume, or move to a
  networked database (Postgres/MySQL) — `db.js` is the only file that would
  need to change.
