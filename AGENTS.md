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
- `js/chrono.js`: timing engine. **Never modify.**
- `js/ui.js`: DOM rendering and user flows.
- `js/configuration.js`, `js/storage.js`: cached renderer APIs backed by async IPC.
- `js/led_manager.js`: renderer LED abstraction.
- `window.js`: Electron main process, IPC, hardware.
- `preload.js`: renderer IPC surface.
- `utils/build-*`: GitHub Release artifacts.

## Rules

- Use plain JavaScript; preserve existing CommonJS style.
- Keep async IPC in configuration/storage/hardware layers.
- Client/UI APIs should use synchronous cache wrappers and callbacks, not expose async persistence races.
- Preserve IPC separation; never import `johnny-five`, `serialport`, or `firmata` in renderer code.
- Do not change `js/chrono.js`, `index.html`, or CSS.
- Log with stable area prefixes, e.g. `[Hardware]`, `[IPC]`, `[Storage]`, `[Race setup]`.
- Preserve unrelated working-tree changes.

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
