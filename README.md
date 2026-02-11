# Release Quest

Multiplayer bug-catching arcade game. Click bugs before they escape and drain your team's HP. Survive 3 levels of increasingly fast bugs, then take down the Mega Bug boss.

## Quick Start

### Docker (recommended)

```bash
docker-compose up
```

Open http://localhost:3000.

### Local

Requires Node.js 24+ (native TypeScript support) and PostgreSQL 16+.

```bash
# Create the database
createdb release_quest

# Install and run
npm install
npm start
```

The server reads `config.json` for database credentials. Environment variables override the file:

| Variable | Default |
|---|---|
| `PORT` | `3000` |
| `DATABASE_URL` | _(none, uses individual vars below)_ |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `release_quest` |
| `DB_USER` | `release_quest` |
| `DB_PASSWORD` | `release_quest` |

Tables are created automatically on startup.

## How to Play

1. Pick a name and icon (or log in to an account)
2. Create or join a lobby
3. Click bugs to squash them before they escape
4. Survive 3 levels, then defeat the boss

Visit the **Game Wiki** (📚 button in the lobby browser or link on the start screen) to see detailed information about all bugs, bosses, powerups, and game mechanics.

### Bug Types

| Bug | Appearance | Behavior |
|---|---|---|
| **Normal** | Red | Wanders and escapes. 10 points. |
| **Heisenbug** | Teal, shimmering | Flees from your cursor up to 4 times. 30 points. |
| **Feature-Not-A-Bug** | Green with checkmark | Clicking it costs 10 HP. Let it leave on its own. |
| **Merge Conflict** | Paired bugs with `<<<` / `>>>` | Two players must click both bugs within 1.5s. 50 bonus points. |
| **Pipeline Bug** | Purple chain of 3-5 | Slithers like a snake. Must squash in order (1→2→3). 15 pts each + 40 bonus. |

### Powerups

**Rubber Duck** -- appears randomly, click it for 2x points for 6 seconds.

**Hotfix Hammer** -- appears randomly, click it to stun all bugs and the boss for 2 seconds.

### Boss Fight

After level 3, a Mega Bug spawns with 500 HP. Click it to deal damage. It regenerates health, spawns minions, and enrages at 50% HP. You have 2 minutes.

## Accounts

Accounts are optional. Guest play is the default. Registered accounts persist your display name and icon across sessions. Click **LOG IN** on the name entry screen to register or log in.

## Project Structure

```
server.ts              HTTP server, WebSocket message routing
server/
  types.ts             Shared TypeScript interfaces and type aliases
  config.ts            Game balance constants
  db.ts                PostgreSQL schema and queries
  auth.ts              Registration, login, sessions
  lobby.ts             Lobby creation and management
  game.ts              Level progression, win/loss
  bugs.ts              Bug spawning and variants
  boss.ts              Boss fight logic
  powerups.ts          Rubber duck and hotfix hammer mechanics
  entity-types.ts      Entity type registry and descriptors
  state.ts             Game state factory
  stats.ts             Player statistics tracking
  network.ts           WebSocket broadcast helpers
  timer-bag.ts         Named timer management
  match-logger.ts      Per-match event logging
frontend/
  App.vue              Main Vue application component
  main.ts              Vue application entry point
  i18n.ts              Internationalization configuration (EN/DE)
  components/          Vue components (game UI, lobby, etc.)
  composables/         Vue composables (game state, WebSocket, etc.)
public/
  overview.html        Game wiki (bugs, bosses, powerups)
  dist/                Built Vue.js frontend (generated)
  css/
    styles.css         Shared styles
    overview.css       Wiki page styles
```

## Tech Stack

- **Server:** Node.js 24 (native TypeScript, ESM), WebSocket (ws), PostgreSQL (pg), bcrypt
- **Client:** Vue 3 (Composition API), TypeScript, Vite, vue-i18n
- **Deploy:** Docker / Docker Compose
- **Type checking:** `npm run typecheck` (tsc --noEmit, no build step)
