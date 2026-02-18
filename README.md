<div align="center">

```
  ██████╗ ███████╗██╗     ███████╗ █████╗ ███████╗███████╗
  ██╔══██╗██╔════╝██║     ██╔════╝██╔══██╗██╔════╝██╔════╝
  ██████╔╝█████╗  ██║     █████╗  ███████║███████╗█████╗
  ██╔══██╗██╔══╝  ██║     ██╔══╝  ██╔══██║╚════██║██╔══╝
  ██║  ██║███████╗███████╗███████╗██║  ██║███████║███████╗
  ╚═╝  ╚═╝╚══════╝╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝╚══════╝
   ██████╗ ██╗   ██╗███████╗███████╗████████╗
  ██╔═══██╗██║   ██║██╔════╝██╔════╝╚══██╔══╝
  ██║   ██║██║   ██║█████╗  ███████╗   ██║
  ██║▄▄ ██║██║   ██║██╔══╝  ╚════██║   ██║
  ╚██████╔╝╚██████╔╝███████╗███████║   ██║
   ╚══▀▀═╝  ╚═════╝ ╚══════╝╚══════╝   ╚═╝
```

**Multiplayer bug-catching arcade game**

Squash bugs. Survive the swarm. Defeat the boss. Together.

[![CI](https://github.com/aarondpn/release-quest/actions/workflows/ci.yml/badge.svg)](https://github.com/aarondpn/release-quest/actions/workflows/ci.yml)
[![Node 24+](https://img.shields.io/badge/node-24%2B-brightgreen)](#)
[![PostgreSQL 16+](https://img.shields.io/badge/postgresql-16%2B-336791)](#)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED)](#)

</div>

---

## Quick Start

### Docker (recommended)

```bash
docker-compose up
```

Open http://localhost:3000 — that's it.

### Local

Requires **Node.js 24+** and **PostgreSQL 16+**.

```bash
createdb release_quest
npm install
npm start
```

> Tables are created automatically on first startup.

<details>
<summary><strong>Environment variables</strong></summary>

The server reads `config.json` for database credentials. Environment variables override the file:

| Variable | Default |
|---|---|
| `PORT` | `3000` |
| `DATABASE_URL` | *(none — uses individual vars below)* |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `release_quest` |
| `DB_USER` | `release_quest` |
| `DB_PASSWORD` | `release_quest` |

</details>

---

## How to Play

```
  Pick a name  ──>  Create/Join lobby  ──>  Squash bugs  ──>  Shop  ──>  Boss fight!
       🎮                 🚪                    🐛              🛒           👾
```

1. **Pick a name and icon** — play as a guest or log in to save your stats
2. **Create or join a lobby** — 2-8 players, optional password protection
3. **Squash bugs** across 3 increasingly chaotic levels
4. **Spend points in the shop** between levels to gear up
5. **Take down the boss** — a multi-phase Mega Bug with shields, swarms, and minions

---

## The Bugs

Every bug has a personality. Learn them or lose HP.

| Bug | Points | Mechanic |
|---|---|---|
| **Normal** | 10 | Wanders around. Click it. Simple. |
| **Heisenbug** | 30 | Flees from your cursor. Chase it down. |
| **Feature-Not-A-Bug** | — | *Don't click it.* Costs 10 HP. Let it leave on its own. |
| **Merge Conflict** | 50 bonus | Two linked bugs — two *different* players must click them within 1.5s. |
| **Pipeline Bug** | 15 each + 40 bonus | A snake chain of 3-5 bugs. Must squash in exact order (1 → 2 → 3). |
| **Memory Leak** | varies | Grows through 4 stages. Hold cooperatively with teammates to defuse. |
| **Infinite Loop** | 30 | Orbits in ellipses. Only vulnerable at the precise breakpoint angle. |
| **Azubi** | — | Unclickable companion that spawns child bugs. Can't be stopped, only endured. |

> See the in-game **Game Wiki** for full details on every bug, boss, and item.

---

## Powerups

Appear randomly during levels — grab them before they despawn.

| Powerup | Effect |
|---|---|
| **Rubber Duck** | 2x points for 6 seconds |
| **Hotfix Hammer** | Freezes all bugs and the boss for 2 seconds |

---

## The Shop

Between each level, spend your hard-earned points on buffs:

| Item | Cost | Effect |
|---|---|---|
| Healing Patch | 40-50 | Restore 25 HP |
| Bigger Cursor | 50 | Larger click area for easier tracking |
| Bug Magnet | 60 | Bugs drift toward your cursor |
| Eagle Eye | 60 | Feature bugs glow red — avoid the traps |
| Kevlar Vest | 75 | 50% reduced damage from escaped bugs |
| Turbo Duck | 80 | Rubber ducks spawn twice as often next level |

All buffs last one level. Choose wisely.

---

## Boss Fight — The Mega Bug

The Mega Bug is a three-phase encounter that scales with your team size.

```
┌──────────────────────────────────────────────────────────┐
│                                                          │
│   Phase 1: The Sprint    100% ████████████████████  60%  │
│   Wanders and regens. Spawns minions. Warm-up.           │
│                                                          │
│   Phase 2: The Shield     60% ████████████████      25%  │
│   Cycles a damage shield on/off. 2x regen while          │
│   shielded. More minions. Patience required.             │
│                                                          │
│   Phase 3: The Swarm      25% ████████              0%   │
│   Anchors to center. Screen-wide bug waves.              │
│   Minions reduce your damage up to 85%. All out.         │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

---

## Difficulty Modes

Each lobby picks a difficulty that shapes the entire experience:

|  | Easy | Medium | Hard |
|---|---|---|---|
| **Team HP** | 150 | 100 | 75 |
| **Damage / escaped bug** | 10 | 15 | 20 |
| **Score multiplier** | 0.5x | 1x | 1.5x |
| **Boss HP** | 400 | 500 | 600 |
| **Boss time limit** | 2:30 | 2:00 | 1:40 |
| **Shop time** | 20s | 15s | 12s |

> Lobbies also support **custom config overrides** for challenge runs and modding.

---

## Features

- **Real-time multiplayer** — WebSocket-driven, see other players' cursors live
- **Guest or account play** — optional registration persists stats, name, and icon
- **Game recordings** — every match is captured with millisecond-precision replay data
- **Player statistics** — games played, win rate, total score, highest score, bugs squashed
- **In-game wiki** — full reference for all bugs, bosses, powerups, and mechanics
- **Lobby chat** — communicate with your team during and between rounds
- **Prometheus metrics** — HTTP, WebSocket, game, and player metrics on port 9091
- **Grafana dashboards** — included in the Docker Compose stack (port 3001)

---

## Monitoring Stack

The `docker-compose.example.yml` includes a full observability stack:

```
┌─────────┐     ┌────────────┐     ┌─────────┐
│  Game    │────>│ Prometheus │────>│ Grafana  │
│ :3000   │     │  (scrape)  │     │  :3001   │
│ :9091   │     └────────────┘     └─────────┘
└─────────┘
```

Tracked metrics include active lobbies, online players, games by outcome, bugs squashed, WebSocket message rates, and standard Node.js runtime stats.

---

## Architecture

```
                          ┌──────────────────────────────────┐
                          │          Express + WS             │
                          │          server.ts                │
                          └──────┬──────────────┬────────────┘
                                 │              │
                     ┌───────────┘              └───────────┐
                     ▼                                      ▼
           ┌─────────────────┐                   ┌──────────────────┐
           │  HTTP / Static  │                   │   WebSocket      │
           │  (pages, wiki,  │                   │   (real-time     │
           │   recordings)   │                   │    game comms)   │
           └─────────────────┘                   └────────┬─────────┘
                                                          │
                                                          ▼
                                               ┌──────────────────┐
                                               │  Message Router  │
                                               │  + Zod Schemas   │
                                               └────────┬─────────┘
                                                         │
                        ┌──────────┬──────────┬──────────┼──────────┐
                        ▼          ▼          ▼          ▼          ▼
                     ┌──────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌──────┐
                     │ Auth │ │ Lobby  │ │  Game  │ │  Boss  │ │ Shop │
                     └──────┘ └────────┘ └────────┘ └────────┘ └──────┘
                        │                     │
                        ▼                     ▼
                   ┌──────────┐        ┌───────────┐
                   │ Postgres │        │ Event Bus │──> Broadcast
                   │  (pg)    │        └───────────┘    to clients
                   └──────────┘
```

- **Server** — Node.js 24 native TypeScript (no transpilation), ESM, `ws` for WebSockets
- **Client** — vanilla JS with HTML5 Canvas, ES modules, bundled by esbuild
- **Data flow** — player action → WebSocket → Zod validation → state update → event bus → broadcast
- **Persistence** — PostgreSQL for accounts, stats, and recordings; game state is in-memory per lobby

<details>
<summary><strong>Project structure</strong></summary>

```
server.ts                   Entry point — HTTP server + WebSocket setup
server/
  config.ts                 Game balance constants & difficulty presets
  types.ts                  Shared TypeScript interfaces
  db.ts                     PostgreSQL schema, pool, queries
  auth.ts                   Registration, login, sessions (bcrypt)
  lobby.ts                  Lobby create / join / leave / destroy
  game.ts / game-lifecycle  Level progression, win/loss conditions
  bugs.ts                   Bug spawning engine
  boss.ts                   Boss fight mechanics
  shop.ts                   Between-level shop system
  powerups.ts               Rubber duck & hotfix hammer
  entity-types/             Plugin-style bug type registry
  boss-types/               Boss type descriptors
  recording.ts              Replay capture & retrieval
  metrics.ts                Prometheus metrics (port 9091)
  event-bus.ts              Internal event system
  network.ts                WebSocket broadcast helpers
  logger.ts                 Pino structured logging
  match-logger.ts           Per-match event logging
  state.ts                  Game state factory
  stats.ts                  Player statistics tracking
  timer-bag.ts              Named timer management

public/
  index.html                Game page
  overview.html             In-game wiki
  css/styles.css            All styles
  js/
    main.js                 Client entry point
    network.js              WebSocket client & message dispatch
    state.js                Client state & DOM refs
    auth-ui.js              Login / register UI
    lobby-ui.js             Lobby browser
    hud.js                  Score, HP, player count
    bugs.js                 Bug rendering (Canvas)
    boss.js                 Boss rendering
    players.js              Remote cursor display
    vfx.js                  Visual effects
    coordinates.js          Logical (800x500) ↔ pixel mapping
    config.js               Client-side constants
```

</details>

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 24 (native TypeScript, ESM) |
| Networking | WebSocket (`ws`), Express 5 |
| Database | PostgreSQL 16 (`pg`) |
| Validation | Zod |
| Auth | bcrypt |
| Logging | Pino |
| Metrics | prom-client (Prometheus) |
| Client | Vanilla JS, HTML5 Canvas, CSS3 |
| Bundler | esbuild |
| CI/CD | GitHub Actions → GitHub Container Registry |
| Deploy | Docker / Docker Compose |

---

## Development

```bash
npm install          # Install dependencies
npm run dev          # Watch mode — auto-rebuilds client bundles
npm run typecheck    # Type check (tsc --noEmit)
npm run build        # Production client bundle
```

---

<div align="center">
<sub>Built for fun. Ship bugs responsibly.</sub>
</div>
