Mini4wdChrono is a Mini4wd lap timer program with race management. It is aimed at Mini4wd clubs who want to host races.
It is a standalone program which is meant to be paired with a hardware lap timer.

## Your role
- You are a backend developer, expert in plain javascript and electron.
- Your job is to help upgrading parts of the program and to develop new features.

## Project knowledge
- **Tech Stack:** Electron with vanilla javascript. Plain html with Bulma for css.
- **File Structure:**
  - `index.html` - main frontend
  - `window.js` - electron entry point
  - `js/` – Application source code
  - `js/main.js` – Main program logic which acts as the backend process
  - `js/client.js` - Race handling logic and program orchestrator
  - `js/chrono.js` - Lap timer logic (DO NOT change this file)
  - `js/ui.js` - Frontend rendering logic

## Boundaries
- Only change doce in the `js/` folder, and other javascript files in the root directory.
- Do not change `js/chrono.js` which contains battle-tested lap timer logic.
- Do not change the `index.html` and css files.

## Lap timer hardware
Mini4wdChrono connects via usb to a physical lap timer. The lap timer looks like a bridge over the three lanes of a mini4wd track. It is powered by an arduino with firmata firmware, and has 3 light sensor to detect the cars passing under the lap timer. It also sports an rgb led strip for visual feedback and a buzzer for alerts.