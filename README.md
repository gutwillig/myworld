# myworld

A tiny low-poly beach town for everything you do, plus your friends' islands across the sea.

## Run it locally

1. Install Bun: https://bun.sh
2. In this folder:

   bun install
   bun run dev

3. Open the URL it prints (usually http://localhost:8080 or :5173).

Tests: `bun x vitest run`. Production build: `bun run build` (outputs to dist/).

Your worlds are saved in your browser's localStorage. Use Export in the app to keep a .json copy.

## Where things live
- src/store      world data and persistence (no three.js)
- src/grid       hex math, lots and roads, the archipelago and ferry routes
- src/world      the 3D scene: islands, buildings, roads, camera, boat and voyage
- src/buildings  the 10-building kit and keyword suggestions
- src/loop       the prompt bar (type a name, pick a building)
- src/panel      the building panel
- src/app        pages, menus, neighbors
