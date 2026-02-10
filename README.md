# Release Quest

Multiplayer bug-catching arcade game. Click bugs before they escape and drain your team's HP. Survive 3 levels of increasingly fast bugs, then take down the Mega Bug boss.

## Quick Start

### Docker (recommended)

```bash
docker-compose up
```

Open http://localhost:3000.

### Local

Requires Node.js 22+ and PostgreSQL 16+.

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

### Powerups

**Rubber Duck** -- appears randomly, click it for 2x points for 6 seconds.

### Boss Fight

After level 3, a Mega Bug spawns with 500 HP. Click it to deal damage. It regenerates health, spawns minions, and enrages at 50% HP. You have 2 minutes.

## Accounts

Accounts are optional. Guest play is the default. Registered accounts persist your display name and icon across sessions. Click **LOG IN** on the name entry screen to register or log in.

## Project Structure

```
server.js              HTTP server, WebSocket message routing
server/
  config.js            Game balance constants
  db.js                PostgreSQL schema and queries
  auth.js              Registration, login, sessions
  lobby.js             Lobby creation and management
  game.js              Level progression, win/loss
  bugs.js              Bug spawning and variants
  boss.js              Boss fight logic
  powerups.js          Rubber duck mechanics
  state.js             Game state factory
  network.js           WebSocket broadcast helpers
public/
  index.html           Game page
  overview.html        Game wiki (bugs, bosses, powerups)
  css/
    styles.css         All styles
    overview.css       Wiki page styles
  js/
    main.js            Client entry point
    network.js         WebSocket client and message handling
    state.js           Client state and DOM refs
    auth-ui.js         Login/register UI
    lobby-ui.js        Lobby browser UI
    hud.js             Score, HP, player count
    bugs.js            Bug rendering
    boss.js            Boss rendering
    players.js         Remote cursor display
    vfx.js             Visual effects
    coordinates.js     Logical/pixel coordinate mapping
    config.js          Client-side constants
```

## Tech Stack

- **Server:** Node.js, WebSocket (ws), PostgreSQL (pg), bcrypt
- **Client:** Vanilla JS (ES modules), CSS3
- **Deploy:** Docker / Docker Compose
