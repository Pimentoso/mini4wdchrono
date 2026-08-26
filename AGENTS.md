# Mini4wdChrono

Electron app for Mini4WD race timing and race management. Vanilla JS, HTML, Bulma.

## Architecture

- Main: `window.js`; filesystem, config/storage persistence, serial hardware, IPC.
- Preload: `preload.js`; exposes `window.electronAPI`.
- Renderer: `js/`; UI and race logic.
- Renderer hardware access only through `window.electronAPI` / IPC.
- Sensor timestamps originate in main process. Do not create renderer-side timing timestamps.

## Key files

- `js/main.js`: renderer bootstrap, IPC event handlers.
- `js/client.js`: race orchestration.
- `js/chrono.js`: timing engine.
- `js/ui.js`: DOM rendering and user flows.
- `js/configuration.js`, `js/storage.js`: cached renderer APIs backed by async IPC.
- `js/led_manager.js`: renderer LED abstraction.
- `window.js`: Electron main process, IPC, hardware.
- `preload.js`: renderer IPC surface.
- `utils/build-*`: GitHub Release artifacts.

## Basic functionality

- Timing supports three lanes and requires a serial-connected hardware lap timer, except when `debugMode` is enabled.
  - Users configure sensor and optional hardware pins.
  - A hardware disconnect blocks racing until the connection is restored.
  - Hardware and application-wide settings are stored in the user-data `settings.json`.
- Track data is required before a race can start. Load it from the track API or enter the track length and lane order manually.
- Race-specific data includes the race name, track, tournament, current round, race mode, lap count, timing thresholds, and results. Persist each race under the user-data `races/` directory as `<Unix timestamp>.json`.
- Tournament data is optional and can be loaded from the tournament API.
  - Without a tournament, only free rounds are available; free-round results are not persisted.
  - With a tournament, preserve bracket player/lane order, round navigation, replay, time editing/disqualification, generated finals, standings, race-progress tables, and Excel export.
  - Free rounds remain available during a tournament and must not overwrite tournament-round results.

## Rules

- Use plain JavaScript; preserve existing CommonJS style.
- Keep async IPC in configuration/storage/hardware layers.
- Client/UI APIs should use synchronous cache wrappers and callbacks, not expose async persistence races.
- Preserve IPC separation; never import `serialport` or `firmata` in renderer code.
- Log with stable area prefixes, e.g. `[Hardware]`, `[IPC]`, `[Storage]`, `[Race setup]`.
- Preserve unrelated working-tree changes.
- Always add a single line comment above functions with a concise explanation.

## Build and validation

- Require Node.js 20+ and npm 9+.
- `npm ci` installs SerialPort's shipped native prebuilds.
- Release scripts create uploadable zip artifacts:
  - `utils/build-darwin.sh`
  - `utils/build-linux-x64.sh`
  - `utils/build-win64.ps1`
- Run `npm run lint:fix` after JavaScript changes.
- Run relevant build script after packaging/dependency changes.

## Scope

Change `js/`, root JavaScript files, `package.json`/lockfile, build scripts, or documentation only when task requires it.
