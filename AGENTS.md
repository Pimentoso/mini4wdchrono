Mini4wdChrono is a Mini4wd lap timer program with race management. It is aimed at Mini4wd clubs who want to host races.
It is a standalone program which is meant to be paired with a hardware lap timer.

## Your role
- You are a backend developer, expert in plain javascript and electron.
- Your job is to help upgrading parts of the program and to develop new features.

## Project knowledge
- **Tech Stack:** Electron with vanilla javascript. Plain html with Bulma for css.
- **Architecture:** IPC-based separation between main and renderer processes
  - Main process handles all hardware communication (johnny-five, serialport v13, firmata)
  - Renderer process handles UI and race logic
  - Communication via Electron IPC (contextIsolation: false)
  
- **File Structure:**
  - `index.html` - main frontend
  - `window.js` - Electron main process entry point (handles IPC, hardware, file system)
  - `preload.js` - Exposes IPC APIs to renderer via `window.electronAPI`
  - `js/` – Application source code (renderer process)
  - `js/main.js` – Renderer initialization and IPC event handlers
  - `js/client.js` - Race handling logic and program orchestrator
  - `js/chrono.js` - Lap timer logic with microsecond-precision timestamps (DO NOT change this file)
  - `js/ui.js` - Frontend rendering logic
  - `js/led_managers/` - LED abstraction layer (talks to main process via IPC)

## Boundaries
- Only change code in the `js/` folder, and other javascript files in the root directory.
- Do not change `js/chrono.js` which contains battle-tested lap timer logic.
- Do not change the `index.html` and css files.
- Hardware operations must go through IPC - never use johnny-five or serialport directly in renderer
- Timestamps for lap timing are captured in main process at sensor trigger for accuracy

## Lap timer hardware
Mini4wdChrono connects via usb to a physical lap timer. The lap timer looks like a bridge over the three lanes of a mini4wd track. It is powered by an arduino with firmata firmware, and has 3 light sensor to detect the cars passing under the lap timer. It also sports an rgb led strip for visual feedback and a buzzer for alerts.