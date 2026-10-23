# Stress testing typst-collab (and boxtools) with concurrent clients

Two harnesses share `stress/core.ts` (seeded RNG, op mix, convergence checks):

- **Headless** (`stress/headless.ts` → bundled to `stress/dist/headless.mjs`):
  N simulated collaborators against a live y-websocket server. Scripted
  race scenarios with exact assertions + a seeded chaos soak asserting
  convergence. CI-able, deterministic (`--seed`).
- **In-app** (`?chaos=1`): overlay panel (`src/stress/`) spawning bot
  collaborators in-page against the same room, so you watch the real UI
  react to concurrent edits live.

## Server

Target is the `y-websocket-server` clone next to this project:

```sh
cd ../y-websocket-server
npm install          # once
npm start            # ws://localhost:1234 (PORT env to change)
```

Auth comes from its `tokens.yaml`. The stress defaults use the built-in
`TEST_` rule (token must equal the doc name part):

- room `TEST/stress1`, token `TEST_stress1` → write access.

Use a **fresh room per run** — server state is in-memory and rooms persist
for the server's lifetime, so re-running into the same room tests merging
with leftovers (occasionally useful, usually confusing).

## Headless runs

```sh
npm run stress -- --clients=3 --room=TEST/r1 --token=TEST_r1 --phase=all --ops=200 --seed=42
npm run stress:scripted -- --clients=2 --room=TEST/r2 --token=TEST_r2
npm run stress:chaos -- --clients=3 --room=TEST/r3 --token=TEST_r3 --ops=500
```

Phases (scripted): 0 bootstrap → 1 concurrent create → 2 disjoint-region
merge → 3 same-offset race → 4 rename-vs-edit → 5 delete-vs-edit →
6 binary race → 7 offline catch-up. Every phase ends at a barrier:
all providers `synced` + identical `encodeStateAsUpdate` hashes.
Exit 0 = ALL GREEN, non-zero + divergence dump = failure.

## In-app chaos mode

1. Open the app with `?chaos=1` (e.g. `http://localhost:5173/?chaos=1#…`).
2. Bottom-right panel → **start 2 bots** (asks `confirm()` first).
3. Watch the file tree/editor react; **check convergence** compares bot +
   main doc hashes after a 3s quiescence wait.

## Rules learned the hard way (read before writing concurrent tests)

1. **Bootstrap shared dirs first.** A directory must exist AND be synced
   before anyone writes into it: concurrent implicit parent creation makes
   distinct dir node ids, children-key LWW orphans whole subtrees (the
   losers' files vanish from every replica while hashes stay equal —
   agreement on the winner is not the files surviving). Phase 0 does
   single-writer `mkdir` + barrier; everything after assumes it.
2. **Genuine races need offline-concurrent updates.** Back-to-back local ops
   serialize through sync; real races are: disconnect → apply locally on
   each client → reconnect → converge. Phases 3–6 do exactly this.
3. **Disable BroadcastChannel in bots.** y-websocket's cross-tab BC
   (`disableBc:false` default) delivers same-room updates **synchronously
   in-process** (lib0 local channels) — co-located bots would sync
   instantly and no race would ever be real. All stress clients pass
   `disableBc:true`. (Production multi-tab use keeps BC on — that's a
   feature, not a bug.)
4. **Assert convergence AND presence.** Equal state hashes prove agreement,
   not survival (see rule 1). Scripted phases assert both; chaos asserts
   convergence + invariants.
5. **Let closes settle before reconnecting.** `provider.disconnect()` +
   immediate `connect()` races the ws close handshake and leaves the provider
   believing it is `synced` while missing updates — a *stable* divergence
   (all-synced, hashes never meet) that is a transport artifact, not a data
   bug (proven by offline full-mesh merge converging). Always settle
   (~1s) after disconnect before reconnecting. This footgun applies to any
   app driving y-websocket reconnects (codyjs included).
6. **Isolation probe.** `node stress/dist/probe.mjs` checks two local docs
   (no providers, no network) stay isolated through setFile+rename — the
   first thing to run if cross-client state ever looks impossible.
