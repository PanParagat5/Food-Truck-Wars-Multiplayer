# Food Truck Wars Multiplayer

Food Truck Wars is a live classroom strategy simulation for up to ten team players and one host master.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/foodtruck-wars` — the responsive host and player game experience.
- `artifacts/api-server/src/lib/foodtruck-game.ts` — the in-memory game engine and demand/capital model.
- `artifacts/api-server/src/routes/games.ts` — room, round, decision, shock, and scoring endpoints.
- `lib/api-spec/openapi.yaml` — source of truth for the generated API client and Zod contracts.

## Architecture decisions

- The room supports ten teams plus one host master; teams can join until the game starts.
- Each team starts with ₹2,00,000 and carries its cash balance across rounds.
- Round 2+ decision forms preload the prior round's decisions so earlier strategy and spend remain relevant.
- Decisions are private to the submitting team until the host resolves the round; state is polled every two seconds for simple cross-browser synchronization.

## Product

Hosts create rooms, share a short room code, start rounds, choose the round-three disruption, monitor submissions, resolve results, score the final pitch, and reveal the leaderboard. Teams join with a name, make private business decisions, track capital and spend, and see the impact of each round.

## User preferences

- The workshop uses ten teams and one master host.
- Starting capital is ₹2,00,000 per team, with marketing spend and all operating expenses carried forward through the game.

## Gotchas

- The API game state is held in memory for the current server process; restarting the API clears active rooms.
- The server must be running before using the web preview because the game UI calls the shared `/api` service.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
