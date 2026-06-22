# ⚙️ Classroom — Backend API

A secure, type-safe **REST API** powering the [Classroom](https://classroom-frontend-peach.vercel.app) management dashboard. Built with **Express 5 + TypeScript (ESM)**, [Drizzle ORM](https://orm.drizzle.team) over **Neon serverless Postgres**, authentication via [Better Auth](https://www.better-auth.com/), and edge security (rate-limiting, bot & shield protection) from [Arcjet](https://arcjet.com).

| | URL |
|---|---|
| **Backend API (Railway)** | https://classroom-backend-production-5a9e.up.railway.app/ |
| **Frontend (Vercel)** | https://classroom-frontend-peach.vercel.app |
| **Health check** | `GET /health` → `{ "status": "ok" }` |

---

## ✨ Features

- **RESTful CRUD** for departments, subjects, classes, users (faculty/students) and enrollments, with search, filtering and pagination.
- **Authentication** — email & password via Better Auth, with a Drizzle adapter and two extra user fields (`role`, `imageCldPubId`).
- **Role model** — `student` · `teacher` · `admin` (Postgres enum), used for role-based rate limiting and frontend access control.
- **Aggregated stats endpoints** that power the dashboard's KPI cards and charts.
- **Edge security** — Arcjet Shield (e.g. SQL-injection patterns), bot detection, and per-role sliding-window rate limits.
- **Referential integrity** — foreign keys with sensible `onDelete` rules; destructive actions (e.g. deleting a subject that still has classes) are blocked with a `409`.
- **Resilient DB layer** — Neon HTTP transport wrapped with retry/backoff so transient network blips don't surface as 500s.
- **Observability** — application performance monitoring via APM Insight.

---

## 🛠️ Tech Stack

| Area | Technology |
|------|-----------|
| **Runtime** | [Node.js](https://nodejs.org) ≥ 20 (ESM) |
| **Framework** | [Express](https://expressjs.com) 5 |
| **Language** | [TypeScript](https://www.typescriptlang.org) 6 (`tsx` for dev) |
| **Database** | [Neon](https://neon.tech) serverless **PostgreSQL** |
| **ORM / Migrations** | [Drizzle ORM](https://orm.drizzle.team) + Drizzle Kit |
| **Auth** | [Better Auth](https://www.better-auth.com/) (Drizzle adapter) |
| **Security** | [Arcjet](https://arcjet.com) — shield, bot detection, rate limiting + CORS |
| **Monitoring** | [APM Insight](https://www.site24x7.com/apm/) |
| **Deployment** | [Railway](https://railway.app) (Nixpacks) |

---

## 🧭 Architecture

```
                      ┌──────────────────────────────────────────────┐
  Client (Vercel) ──► │  Express app (src/index.ts)                  │
                      │   • trust proxy + CORS (credentials)         │
                      │   • GET /health                              │
                      │   • /api/auth/*  → Better Auth handler       │
                      │   • securityMiddleware (Arcjet, role limits) │
                      │   • /api/{departments,subjects,classes,      │
                      │           users,enrollments,stats}           │
                      └───────────────┬──────────────────────────────┘
                                      │  Drizzle ORM (neon-http + retry)
                                      ▼
                              Neon PostgreSQL
```

Request lifecycle for a data route: **CORS → Better Auth (auth routes only) → `securityMiddleware` (Arcjet) → router handler → Drizzle → Neon**.

---

## 🗄️ Data Model

| Table | Purpose | Key relations |
|-------|---------|---------------|
| `user` | Accounts with `role` + profile image | → sessions, accounts, classes (as teacher), enrollments |
| `session`, `account`, `verification` | Better Auth tables | → user |
| `departments` | Top-level grouping | → subjects |
| `subjects` | Belongs to a department (`onDelete: restrict`) | → classes |
| `classes` | Belongs to a subject + teacher; has `inviteCode`, `capacity`, `status`, JSON `schedules` | → enrollments |
| `enrollments` | Student ↔ class join (unique per pair) | → user, class |

---

## 🔌 API Reference

> Base URL: `/api`. All list endpoints accept `?page` & `?limit`; many accept `?search` / filter params.

### Auth — `/api/auth/*` (Better Auth)
`POST /sign-up/email` · `POST /sign-in/email` · `POST /sign-out` · `GET /get-session` … (full Better Auth surface)

### Departments — `/api/departments`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List departments (search, pagination) |
| POST | `/` | Create a department |
| GET | `/:id` | Department detail + counts |
| PUT | `/:id` | Update a department |
| DELETE | `/:id` | Delete (blocked if it still has subjects) |
| GET | `/:id/subjects` | Subjects in a department |
| GET | `/:id/classes` | Classes in a department |
| GET | `/:id/users` | Users in a department |

### Subjects — `/api/subjects`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List subjects (search, `?department`, pagination) |
| POST | `/` | Create a subject |
| GET | `/:id` | Subject detail + class count |
| PUT | `/:id` | Update a subject |
| DELETE | `/:id` | Delete (blocked if it still has classes) |
| GET | `/:id/classes` | Classes in a subject |
| GET | `/:id/users` | Users in a subject by `?role` |

### Classes — `/api/classes`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List classes (`?search`, `?subject`, `?teacher`) |
| POST | `/` | Create a class |
| GET | `/:id` | Class detail |
| PUT | `/:id` | Update a class |
| DELETE | `/:id` | Delete a class |
| GET | `/:id/users` | Users in a class |

### Users — `/api/users`
| Method | Path | Description |
|---|---|---|
| GET | `/` | List users (`?role`, `?search`, pagination) |
| GET | `/:id` | User detail |
| PUT | `/:id` | Update a user |
| DELETE | `/:id` | Delete a user |
| GET | `/:id/departments` | Departments linked to a user |
| GET | `/:id/subjects` | Subjects linked to a user |

### Enrollments — `/api/enrollments`
| Method | Path | Description |
|---|---|---|
| POST | `/` | Enroll a student in a class |
| POST | `/join` | Join a class via invite code |
| DELETE | `/` | Unenroll (by student + class) |
| DELETE | `/:id` | Delete an enrollment |

### Stats — `/api/stats`
| Method | Path | Description |
|---|---|---|
| GET | `/overview` | Entity counts (users, teachers, admins, subjects, departments, classes) |
| GET | `/latest` | Latest classes & teachers |
| GET | `/charts` | Aggregates: users by role, subjects by department, classes by subject |

---

## 🔐 Security

`securityMiddleware` (`src/middleware/security.ts`) runs every data request through Arcjet:

- **Shield** — blocks common attack patterns (e.g. SQL injection).
- **Bot detection** — blocks automated traffic (search-engine & preview bots allowed).
- **Per-role rate limits** (sliding window, 1 minute):

  | Role | Requests / min |
  |------|:---:|
  | Admin | 60 |
  | Teacher / Student | 50 |
  | Guest | 40 |

  Plus a global burst limit of **30 requests / 2s** (`src/config/arcjet.ts`).

> Security is skipped when `NODE_ENV=test`, and the `/health` probe is registered **before** the middleware so platform health checks are never rate-limited or flagged.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js ≥ 20** (required — Better Auth uses the global Web Crypto API, which is only available by default on Node 20+)
- A [Neon](https://neon.tech) Postgres database
- An [Arcjet](https://arcjet.com) key

### 1. Install
```bash
npm install
```

### 2. Configure environment
Create a `.env` file:

```env
DATABASE_URL=postgres://<user>:<pass>@<host>/<db>?sslmode=require
FRONTEND_URL=http://localhost:5173
ARCJET_KEY=ajkey_xxx
ARCJET_ENV=development
BETTER_AUTH_SECRET=<random-32+ char secret>
BETTER_AUTH_URL=http://localhost:8080
```

### 3. Database
```bash
npm run db:generate   # generate SQL migrations from the Drizzle schema
npm run db:migrate    # apply migrations
npx tsx src/seed.ts   # (optional) seed demo departments, subjects, classes, users…
```

### 4. Run
```bash
npm run dev     # tsx watch (hot reload)
npm run build   # tsc → dist/
npm start       # node dist/index.js
```

Server listens on `PORT` (default **8080**).

---

## 📂 Project Structure

```
src/
├── index.ts                # Express app: CORS, auth handler, routers, health check
├── lib/auth.ts             # Better Auth config (Drizzle adapter, extra fields)
├── config/arcjet.ts        # Arcjet rules (shield, bot detection, burst limit)
├── middleware/security.ts  # Per-role rate limiting + Arcjet protect
├── routes/                 # departments · subjects · classes · users · enrollments · stats
├── db/
│   ├── index.ts            # Neon + Drizzle client (fetch retry)
│   ├── migrate.ts          # migration runner
│   └── schema/             # auth.ts (user/session/account) + app.ts (domain tables)
└── seed.ts                 # idempotent demo-data seeder
```

---

## ☁️ Deployment (Railway)

Configured via `railway.json` (Nixpacks builder):

- **Build:** `npm run build` · **Start:** `npm start`
- **Health check:** `/health` (120s timeout)
- **Restart policy:** on failure, up to 5 retries
- **Node version** is pinned to **≥ 20** via the `engines` field in `package.json` and `.nvmrc`, so the runtime exposes the global `crypto` Better Auth depends on.

Set all `.env` variables in the Railway service settings, with `FRONTEND_URL` / `BETTER_AUTH_URL` pointing at your deployed URLs.

---

## 📄 License

ISC
