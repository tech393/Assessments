# Yes / No Poll App

Create yes/no polls, vote, and watch the percentages update live.
Each browser session can vote **once per poll**, and the server enforces it.

| Part | Tech | Folder |
|---|---|---|
| Website | React 19 + Vite 8 | `client/` |
| API | Node + Express 5 | `server/` |
| Database | PostgreSQL (Neon) via Prisma 6 | `server/prisma/` |

---

## 1. What you need first

- **Node.js 22.12 or newer** (20.19+ also works). Check with `node -v`. Download: https://nodejs.org
- **Git**
- A free **Neon** account for a **dev** PostgreSQL database: https://neon.tech

> **Windows / PowerShell:** if you see *"running scripts is disabled on this system"*,
> type `npm.cmd` wherever this guide says `npm` (or use Command Prompt instead).

## 2. Get the code

```bash
git clone https://github.com/tech393/Assessments.git
cd Assessments
```

## 3. Create the database connection (`server/.env`)

1. In the Neon console create a project, then click **Connect**, choose **Prisma**, and copy the connection string.
2. Create your private settings file from the template:

   ```bash
   cd server
   cp .env.example .env
   ```

   On Windows Command Prompt use `copy .env.example .env`.

3. Open `server/.env` and paste your string into `DATABASE_URL`, keeping the quotes. Then:
   - remove `-pooler` from the host name if it has one (migrations need the direct host), and
   - make sure it ends with `&connect_timeout=15` (a free Neon database may be asleep and needs a few seconds to wake).

`.env` holds your password. It is listed in `.gitignore`, so it is never committed. Use a **dev** database only.

## 4. Install and create the tables

Still inside `server/`:

```bash
npm install
npm run db:migrate
```

You should see `All migrations have been successfully applied.`

## 5. Run the app (two terminals)

**Terminal 1: API** (from `server/`)

```bash
npm run dev
```

It prints `Poll API listening on http://localhost:4000/api`.

**Terminal 2: website** (from the project folder)

```bash
cd client
npm install
npm run dev
```

Open **http://localhost:5173**. Stop either server with `Ctrl+C`.

## 6. Run the tests

From `server/`:

```bash
npm test
```

There are 13 API tests (create, list, bad input, 404, 409 double vote, simultaneous votes, and more).
They use the database in `server/.env`, take about 30 seconds, and **delete every poll they create**.

---

## API

All responses are JSON. Errors look like `{ "error": "message" }`.

| Method & path | Body | Success | Errors |
|---|---|---|---|
| `GET /api/polls` | none | `200` list of polls, newest first | none |
| `POST /api/polls` | `{ "question": "..." }` (5–200 chars) | `201` new poll | `400` bad input |
| `GET /api/polls/:id` | none | `200` one poll | `400` bad id, `404` not found |
| `POST /api/polls/:id/vote` | `{ "choice": "yes" }` or `"no"` | `201` updated poll | `400` bad id/choice, `404` not found, `409` already voted |

A poll looks like:

```json
{ "id": 1, "question": "Pizza on Friday?", "createdAt": "…",
  "yes": 2, "no": 1, "total": 3, "yesPercent": 67, "noPercent": 33, "myVote": "yes" }
```

`myVote` is what *this* browser session voted (`"yes"`, `"no"` or `null`).

## How "one vote per browser session" works

1. On its first request, a browser gets a random id in the `poll_sid` cookie. The cookie is `HttpOnly`
   (page scripts cannot read it) and has no expiry date, so the browser deletes it when it closes.
2. A vote stores `(pollId, sessionId)`. The database has a **unique constraint** on that pair, so a
   second vote from the same session is rejected by PostgreSQL itself and the API answers `409`.
3. The server does not check "already voted?" and then save as two separate steps. Two clicks
   at the same instant could both pass that check. The unique constraint makes the database decide.
4. A cookie value the server could not have issued is ignored and replaced with a fresh one.

Clearing cookies or using a private window counts as a new session. That is expected for a
session-based limit, which has no user accounts.

## Project layout

```
server/
  prisma/schema.prisma      Poll and Vote models (unique pollId + sessionId)
  prisma/migrations/        SQL migration applied by `npm run db:migrate`
  src/index.js              starts the server
  src/app.js                Express setup, JSON parsing, error handling
  src/routes.js             HTTP routes (no database code)
  src/pollRepository.js     all database code
  src/validation.js         input checks
  src/session.js            session cookie
  test/polls.test.js        API tests (Node's built-in test runner + supertest)
client/
  vite.config.js            dev proxy: /api -> http://localhost:4000
  src/api.js                fetch wrapper with readable error messages
  src/App.jsx               the page (create, list, vote, live results every 3 s)
```

## Troubleshooting

| Problem | Fix |
|---|---|
| `Environment variable not found: DATABASE_URL` | `server/.env` is missing. Do step 3. (Watch out for Notepad saving it as `.env.txt`.) |
| `P1001: Can't reach database server` | Use the direct (non-`-pooler`) host and add `&connect_timeout=15`. Check the Neon project is active. Try another network if port 5432 is blocked. |
| Page shows *Cannot reach the server* | The API is not running. Start it (step 5, terminal 1). |
| `running scripts is disabled` in PowerShell | Use `npm.cmd` instead of `npm`. |
| Changed `PORT` in `.env` and the site broke | Update the proxy target in `client/vite.config.js` to the same port. |
