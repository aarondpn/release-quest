# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Release Quest is a multiplayer bug-catching arcade game. Players click bugs before they escape, survive 3 levels, then defeat a boss. Built with Node.js 24 (native TypeScript), WebSockets for real-time multiplayer, and PostgreSQL for persistence.

## Commands

- **Start server:** `npm start` (requires PostgreSQL running)
- **Dev mode (watch):** `npm dev` (auto-rebuilds client JS/CSS bundles)
- **Build client bundles:** `npm build` (esbuild bundles `public/js/main.js` → `main.min.js`, CSS → `.min.css`)
- **Type check:** `npm run typecheck` (tsc --noEmit, no test framework exists)

Requires Node.js 24+ (native TypeScript via `node server.ts`, no transpilation step) and PostgreSQL 16+. Database tables auto-create on startup.

## Architecture

### Server (TypeScript, ESM)

`server.ts` is the entry point — sets up Express for HTTP/static files and a WebSocket server (`ws`) for real-time game communication.

Key server modules:
- **`server/websocket-handler.ts`** — Routes incoming WebSocket messages to handlers
- **`server/handlers/`** — Message handlers organized by domain (auth, lobby, game, stats, recording)
- **`server/event-bus.ts`** — Internal event system; game state changes emit events → handlers broadcast to clients
- **`server/lobby.ts`** — Lobby lifecycle (create, join, leave, destroy)
- **`server/game.ts`** / **`server/game-lifecycle.ts`** — Level progression, win/loss conditions
- **`server/bugs.ts`** — Bug spawning with variant types
- **`server/boss.ts`** — Boss fight mechanics (health, regen, enrage, minions)
- **`server/entity-types/`** — Plugin-style bug type registry (`BugTypePlugin` interface with custom behaviors, rendering descriptors, onClick handlers)
- **`server/boss-types/`** — Boss type descriptors
- **`server/db.ts`** — PostgreSQL pool, schema auto-creation, all queries
- **`server/auth.ts`** — Registration/login with bcrypt, session tokens
- **`server/recording.ts`** — Game replay capture and retrieval
- **`server/metrics.ts`** — Prometheus metrics on a separate port (default 9091)
- **`server/config.ts`** — Game balance constants, server config (reads `config.json` and env vars)
- **`server/types.ts`** — Shared TypeScript interfaces

### Client (Vanilla JS, ES modules)

All client code is in `public/`. No framework — vanilla JS with HTML5 Canvas for bug rendering.

- **`public/js/main.js`** — Entry point, UI setup, event listeners
- **`public/js/network.js`** — WebSocket client, message dispatch
- **`public/js/state.js`** — Client-side game state and DOM references
- **`public/js/coordinates.js`** — Maps logical game coordinates (800×500) to pixel coordinates

The client JS is bundled by esbuild for production (`main.min.js`) but individual modules are used in development.

### Data Flow

Player actions → WebSocket message → server handler validates (Zod schemas) → updates game state → event bus emits → broadcast to all players in lobby.

### Database

PostgreSQL with tables: `users`, `sessions`, `guest_sessions`, `lobbies`, `lobby_players`, `user_stats`, `game_recordings`, `recording_players`, `recording_events`, `recording_mouse_moves`. Schema is defined in `server/db.ts` and auto-created on startup.

## Key Conventions

- Server uses native Node 24 TypeScript (no build step) with strict mode. Client is plain JS.
- WebSocket messages are validated with Zod schemas before processing.
- Logging uses Pino (`server/logger.ts`) — use structured logging with context objects, not string interpolation.
- Game state is in-memory per lobby; only accounts, stats, and recordings persist to the database.
- The coordinate system uses a logical 800×500 grid mapped to actual screen dimensions.
