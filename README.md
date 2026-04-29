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
- **Daily digest** — short per-repo summary of the day's movement (stars, forks, issues), with an executive summary you can copy as Markdown.
- **Board** — Kanban-style view that groups issues into columns (Backlog, To-do, In progress, Ready, In review, etc.).

### Per-repository view

Open any repository to see:

- **Overview** — stars, forks, open issues, owner, license, default branch, last push.
- **Actions** — recent workflow runs.
- **PRs** and **Issues** — open and recent items.
- **Releases** — release history.
- **Forks** — list of forks, sortable by most stars or recent push.
- **Traffic** — views and clones for the last 14 days, unique visitors/cloners, top referrers, popular paths.
- **Mentions** — references to the repo found via GitHub code/issue search, including previous names of the project.
- **Dependents** — repository relationships, where available.
- **Languages and trend charts** — language breakdown and stars/forks history.
- **Contributors** — paginated list with commit counts.

## Status

Early scaffolding. APIs, modules, and the UI are still being shaped — expect rapid changes. Star the repo and join Discord to follow along.

## Community

- [Discord server](https://discord.gg/YrZPHAwMSG) — suggest features, report issues, or just say hi.
- [Help name the project](https://github.com/debba/gh-dashboard/discussions/1) — open discussion for naming suggestions.

## License

MIT License — see [LICENSE](LICENSE).
