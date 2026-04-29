# gh-dashboard

> `gh-dashboard` is a working name. The final project name will be picked together with the community — share your suggestion in the [naming discussion](https://github.com/debba/gh-dashboard/discussions/1) or on Discord.

> The initial scaffolding of this repository was produced in an AI-assisted session with [Claude Code](https://claude.com/claude-code). From here on, code is reviewed and maintained by humans, and contributions are welcome.

<p align="center">
  <a href="https://discord.gg/YrZPHAwMSG"><img src="https://img.shields.io/discord/1470772941296894128?color=5865F2&logo=discord&logoColor=white&label=Discord" alt="Discord" /></a>
</p>

An open-source dashboard to explore your GitHub repositories, issues, pull requests, traffic, and CI activity from a single interface.

## Demo

<div align="center">
  <img src="public/demo.gif" alt="gh-dashboard demo" />
</div>

## What it does

The dashboard pulls data from the GitHub REST and GraphQL APIs and organizes it into a few different views:

- **Repositories** — paginated grid with description, language, stars, forks, open issues, last push and a per-repo health score. Filter by organization, language, visibility, forks/archived; sort by stars, recent activity, etc.
- **Issues / Pull Requests** — cross-repo lists with the same filter sidebar, useful for triage across many projects.
- **Insights** — overview of all repos with alerts ("issues need attention", "no push for X days"), opportunities, and correlations between traffic and recent activity. Each repo gets a status (Strong / Watch / Risky).
- **Daily digest** — short per-repo summary of the day's movement (stars, forks, issues), with an executive summary you can copy as Markdown. Optionally augmented by an OpenAI-generated narrative when `OPENAI_API_KEY` is configured.
- **Board** — Kanban-style view that groups issues into columns (Backlog, To-do, In progress, Ready, In review, etc.).

### Per-repository view

Open any repository to see:

- **Overview** — stars, forks, open issues, owner, license, default branch, last push.
- **Actions** — recent workflow runs.
- **PRs** and **Issues** — open and recent items, paginated.
- **Releases** — release history.
- **Forks** — list of forks, sortable by most stars or recent push.
- **Traffic** — views and clones for the last 14 days, unique visitors/cloners, top referrers, popular paths.
- **Mentions** — references to the repo found via GitHub code/issue search, including previous names of the project.
- **Dependents** — repository relationships, where available.
- **Languages and trend charts** — language breakdown and stars/forks history.
- **Contributors** — paginated list with commit counts.

## Architecture

The app is a single repository with two cooperating processes:

- **Backend** — a Node HTTP server (`src/server.ts` + `src/server/*`) that handles GitHub OAuth (Device Flow), proxies all REST/GraphQL calls, caches responses on disk, and exposes a small JSON API under `/api/*`. The GitHub token is stored locally under `~/.gh-issues-dashboard/` and **never exposed to the browser**.
- **Frontend** — a React 19 + Vite SPA (`src/main.tsx`, `src/App.tsx`, `src/components/*`, `src/api/*`) that consumes the backend's `/api/*` endpoints.

In production both are served by the Node process: Vite builds the SPA into `dist/client/` and the server falls back to `index.html` for non-API routes.

### Tech stack

| Layer       | Tech                                           |
| ----------- | ---------------------------------------------- |
| Language    | TypeScript                                     |
| Frontend    | React 19, Vite 8                               |
| Backend     | Node `http` + `tsx` watch (dev), compiled JS in production |
| Tests       | Vitest + jsdom                                 |
| Tooling     | `concurrently`, `tsc`                          |

## Prerequisites

- **Node.js 20+** (anything that supports native `fetch` and ESM is fine).
- A **GitHub OAuth App** with **Device Flow enabled** (see next section).
- (Optional) An **OpenAI API key** if you want AI-generated daily digest summaries.

## Configure GitHub

The dashboard talks to GitHub using a personal **OAuth App** with the **Device Authorization Flow**. This means you keep ownership of the credentials and there is no client secret to manage. You only have to do this once.

### 1. Create the OAuth App

1. Go to <https://github.com/settings/developers> → **OAuth Apps** → **New OAuth App**.
   (For an org-owned app, use **Settings → Developer settings → OAuth Apps** on the organization instead.)
2. Fill in the form:
   - **Application name** — anything, e.g. `gh-dashboard (local)`.
   - **Homepage URL** — `http://127.0.0.1:8765` (or any URL you control; this is informational).
   - **Authorization callback URL** — `http://127.0.0.1:8765` will do. Device Flow does not actually use a redirect, but GitHub requires the field.
3. Click **Register application**.

### 2. Enable Device Flow

On the OAuth App's settings page, tick **Enable Device Flow** and **Update application**. This is required — without it, sign-in will fail with `unsupported_grant_type`.

### 3. Copy the Client ID

You only need the **Client ID** (it looks like `Iv1.xxxxxxxxxxxxxxxx` or `Ov23li...`). **Do not** generate a client secret — Device Flow does not use one, and the dashboard never reads it.

### 4. Export it before starting the server

```bash
export GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
```

You can also put it in a `.env` file or your shell profile. The server reads `process.env.GITHUB_CLIENT_ID` at startup and will refuse to start the OAuth flow without it.

### 5. Sign in from the UI

When you open the dashboard for the first time, it will:

1. call the backend, which asks GitHub for a **device code**;
2. show you a short **user code** and a verification URL (typically <https://github.com/login/device>);
3. you paste the code on GitHub and approve the requested scopes;
4. the backend exchanges the device code for an access token and stores it in `~/.gh-issues-dashboard/` — **the token never reaches the browser**.

Granted scopes default to `repo read:org project read:user user:email`. To narrow them, set `GITHUB_OAUTH_SCOPES` (see [Configuration](#configuration)). If you ever want to revoke access, remove the app from <https://github.com/settings/applications> and delete the local token file under `~/.gh-issues-dashboard/`.

## Configuration

The server reads its configuration from environment variables:

| Variable               | Required | Default                                        | Purpose                                          |
| ---------------------- | -------- | ---------------------------------------------- | ------------------------------------------------ |
| `GITHUB_CLIENT_ID`     | yes      | —                                              | Client ID of your GitHub OAuth App (Device Flow) |
| `GITHUB_OAUTH_SCOPES`  | no       | `repo read:org project read:user user:email`   | OAuth scopes requested at sign-in                |
| `HOST`                 | no       | `127.0.0.1`                                    | Interface the server binds to                    |
| `PORT`                 | no       | `8765`                                         | Port the server listens on                       |
| `OPENAI_API_KEY`       | no       | —                                              | Enables AI-generated daily digest narratives     |
| `OPENAI_DIGEST_MODEL`  | no       | `gpt-4.1-mini`                                 | Model used for digest narratives                 |

Tokens and snapshots are persisted under `~/.gh-issues-dashboard/`.

### Quick env setup

```bash
export GITHUB_CLIENT_ID=Iv1.xxxxxxxxxxxxxxxx
# optional
export OPENAI_API_KEY=sk-...
```

## Install

```bash
npm install
```

## Run in development

Starts the API server (with file-watch reload) and the Vite dev server in parallel. The Vite dev server proxies `/api` to the backend on port `8765`.

```bash
npm run dev
```

Then open <http://127.0.0.1:5173>. On first launch the UI will walk you through the GitHub Device Flow sign-in.

If you only want one of the two processes:

```bash
npm run api    # backend only, on http://127.0.0.1:8765
```

## Build

Type-checks the server, compiles it to `dist/`, and produces the production frontend bundle under `dist/client/`:

```bash
npm run build
```

## Run the production build

After `npm run build`, the Node server can serve both the API and the built SPA from a single port:

```bash
npm start
# or, equivalently
npm run serve
```

Then open <http://127.0.0.1:8765>.

`npm run preview` is also available if you want to preview only the static frontend through Vite (no backend).

## Test & type-check

```bash
npm test          # vitest run
npm run typecheck # tsc --noEmit
```

Tests live under `tests/` and mirror the structure of `src/` (see [AGENTS.md](AGENTS.md)).

## Project layout

```
.
├── index.html                 # SPA entrypoint consumed by Vite
├── src/
│   ├── main.tsx               # React bootstrap
│   ├── App.tsx                # Top-level component & routing
│   ├── api/                   # Browser-side API client (calls /api/*)
│   ├── components/            # UI: views, modals, common, sidebar, top bar
│   ├── styles/                # CSS modules (tokens, layout, views, modals, …)
│   ├── server.ts              # Node HTTP server entrypoint
│   ├── server/                # OAuth, GitHub client, caches, digests, insights
│   ├── types/github.ts        # Shared TypeScript types
│   └── utils/                 # Pure logic (covered by unit tests)
├── tests/                     # Vitest suites mirroring src/
├── public/                    # Static assets (demo media)
├── vite.config.ts
├── tsconfig.json              # Frontend TS config
└── tsconfig.server.json       # Server TS config (build → dist/)
```

## Status

Early scaffolding. APIs, modules, and the UI are still being shaped — expect rapid changes. Star the repo and join Discord to follow along.

## Community

- [Discord server](https://discord.gg/YrZPHAwMSG) — suggest features, report issues, or just say hi.
- [Help name the project](https://github.com/debba/gh-dashboard/discussions/1) — open discussion for naming suggestions.

## Contributing

Before opening a PR, please skim [AGENTS.md](AGENTS.md) for the project conventions (English-only identifiers, pure logic in `src/utils/` with mirrored tests, no GitHub tokens on the browser, etc.) and run `npm test` + `npm run build`.

## License

MIT License — see [LICENSE](LICENSE).
