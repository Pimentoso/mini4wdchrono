# Phase 3: Hardware & Native Modules Refactoring

**Date:** January 25, 2026  
**Session:** TBD  
**Status:** ⏳ PENDING

---

## Overview

Phase 3 moves all hardware I/O operations (Johnny-Five, serialport, Arduino communication) from the renderer process to the main process and rebuilds native modules for Node.js 22 compatibility.

This phase addresses:
1. Native module bindings (serialport) incompatible with Node.js 22
2. Hardware I/O running in renderer process (architectural issue)
3. LED manager refactoring for IPC-based control
4. Event-based sensor communication

**Phase 2 Prerequisite:** ✅ Complete (see [step_2.md](step_2.md))

---

## Current State Analysis

### Serialport Native Module Error

**Current Error:**
```
/home/miche/Documents/Github/mini4wdchrono/node_modules/johnny-five/node_modules/firmata/lib/com.js:57 
It looks like serialport didn't install properly.
Error: Could not locate the bindings file.
```

**Root Cause:**
- serialport contains C++ bindings compiled for old Node.js version (Node 12)
- Electron 37 uses Node.js 22 - ABI incompatible
- Needs native module rebuild for current Electron/Node.js version

### Hardware Architecture Issues

**Current Architecture (PROBLEMATIC):**
```
Renderer Process (js/main.js)
  ↓ require('johnny-five')
  ↓ Direct board.* API calls
  ↓ Sensor event handlers in renderer
  ↓ LED/buzzer control from renderer
  ↓ Serial communication via USB
Arduino Hardware (via USB serial)
```

**Target Architecture:**
```
Renderer Process (js/main.js)
  ↓ window.electronAPI.hardware*() calls
  ↓ IPC messages
Main Process (window.js)
  ↓ Johnny-Five board initialization
  ↓ Sensor event handlers
  ↓ LED/buzzer control
  ↓ Serial communication via USB
  ↓ Events sent back to renderer via IPC
Arduino Hardware (via USB serial)
```

### Hardware Components

**Mini4WD Lap Timer Hardware:**
- **Arduino board** (Uno/Nano/Pro Micro) with Firmata firmware
- **3 light sensors** (one per lane) - detect cars passing under bridge
- **RGB LED strip** - visual feedback per lane
- **Buzzer** - race start countdown and alerts
- **USB connection** - serial communication

**Current Code Locations:**
- [js/main.js](../js/main.js) lines 96-341 - Johnny-Five integration (~250 lines)
  - Board initialization (line 153+)
  - Event handlers: ready, info, warn, fail, error, close, exit
  - Sensor setup and monitoring
  - LED and buzzer control logic
- [js/led_managers/](../js/led_managers/) - 4 LED manager classes
  - `led_manager.js` - Base class
  - `led_manager_lilypad.js` - Lilypad LED implementation
  - `led_manager_rgb_strip.js` - RGB LED strip (most common)
  - `led_manager_mock.js` - Mock for testing without hardware
- [js/chrono.js](../js/chrono.js) - **DO NOT MODIFY** (lap timer logic, battle-tested)

---

## Implementation Plan

### Step 1: Rebuild Native Modules ⚠️ CRITICAL FIRST STEP

**Goal:** Rebuild serialport and other native dependencies for Node.js 22

**Commands:**
```bash
# Install electron-rebuild
npm install --save-dev @electron/rebuild

# Rebuild all native modules
npx electron-rebuild

# Alternative: using electron-rebuild package
npm install --save-dev electron-rebuild
npx electron-rebuild
```

**Expected Outcome:**
- serialport bindings compile successfully
- No "Could not locate the bindings file" errors
- Johnny-Five can initialize board connection

**Complexity:** Low | **Impact:** Unblocks all hardware work

---

### Step 2: Create Hardware IPC Handlers in window.js

**IPC Handlers to Implement:**

```javascript
// Hardware initialization
ipcMain.handle('hardware-initialize', async (event, options) => {
    // Initialize Johnny-Five board
    // Set up sensors, LEDs, buzzer
    // Return success/failure
});

// Sensor reading
ipcMain.handle('hardware-read-sensors', async () => {
    // Return current state of 3 light sensors
    return { lane0: value, lane1: value, lane2: value };
});

// LED control
ipcMain.handle('hardware-write-leds', async (event, laneData) => {
    // Update LED strip for each lane
    // laneData: { lane0: {r, g, b}, lane1: {r, g, b}, lane2: {r, g, b} }
});

// Buzzer control
ipcMain.handle('hardware-buzz', async (event, duration) => {
    // Trigger buzzer for specified milliseconds
});

// Event emitters (main → renderer)
// Send sensor state changes back to renderer
mainWindow.webContents.send('hardware-sensor-change', { lane, value });
mainWindow.webContents.send('hardware-board-ready');
mainWindow.webContents.send('hardware-board-error', error);
```

**Preload API (already stubbed in preload.js):**
```javascript
hardwareInitialize: () => ipcRenderer.invoke('hardware-initialize'),
hardwareReadSensors: () => ipcRenderer.invoke('hardware-read-sensors'),
hardwareWriteLeds: (laneData) => ipcRenderer.invoke('hardware-write-leds', laneData),
hardwareBuzz: (duration) => ipcRenderer.invoke('hardware-buzz', duration),

// Event listeners
onBoardReady: (callback) => ipcRenderer.on('hardware-board-ready', callback),
onBoardError: (callback) => ipcRenderer.on('hardware-board-error', callback),
onSensorChange: (callback) => ipcRenderer.on('hardware-sensor-change', callback),
```

**Complexity:** High | **Impact:** Enables hardware control from renderer

---

### Step 3: Move Johnny-Five Logic to Main Process

**Extract from js/main.js (~250 lines of hardware code):**

1. **Board Initialization** (lines 96-152)
   - Move to window.js `hardware-initialize` handler
   - Keep configuration from settings (sensor pins, LED pins, etc.)

2. **Event Handlers** (lines 153-258)
   - `board.on('ready')` → Initialize sensors/LEDs in main process
   - `board.on('fail')`, `board.on('error')` → Send errors to renderer via IPC
   - `board.on('close')`, `board.on('exit')` → Cleanup and notify renderer

3. **Sensor Monitoring**
   - Move sensor value reads to main process
   - Emit sensor-change events to renderer when values change

4. **LED/Buzzer Control**
   - Keep LED update logic in main process
   - Renderer sends commands via IPC, main process executes

**Files to Modify:**
- **window.js** - Add hardware handlers, Johnny-Five initialization
- **js/main.js** - Remove direct Johnny-Five calls, use IPC instead

**Complexity:** High | **Impact:** Core hardware functionality

---

### Step 4: Refactor LED Managers for IPC

**Current LED Managers:**
- [js/led_managers/led_manager.js](../js/led_managers/led_manager.js) - Base class
- [js/led_managers/led_manager_rgb_strip.js](../js/led_managers/led_manager_rgb_strip.js) - Most used
- [js/led_managers/led_manager_lilypad.js](../js/led_managers/led_manager_lilypad.js)
- [js/led_managers/led_manager_mock.js](../js/led_managers/led_manager_mock.js) - Testing

**Refactoring Approach:**

**Option A:** Keep LED managers in renderer, add IPC calls
```javascript
// In led_manager_rgb_strip.js
async setLed(lane, color) {
    await window.electronAPI.hardwareWriteLeds({
        [lane]: { r: color.r, g: color.g, b: color.b }
    });
}
```

**Option B:** Move LED managers to main process (cleaner but more work)
- LED logic stays with hardware in main process
- Renderer only sends high-level commands (lane, state)
- Main process maps states to colors

**Recommended:** Option A (simpler migration path)

**Complexity:** Medium | **Impact:** Visual feedback works

---

### Step 5: Update Renderer Hardware Calls

**Files to Update:**
- [js/main.js](../js/main.js) - Replace board.* calls with IPC
- [js/client.js](../js/client.js) - Update hardware initialization if needed
- [js/ui.js](../js/ui.js) - Update any direct hardware references

**Pattern:**
```javascript
// BEFORE (Phase 2)
board.on('ready', function() {
    // Direct sensor access
});

// AFTER (Phase 3)
window.electronAPI.hardwareInitialize().then(() => {
    window.electronAPI.onBoardReady(() => {
        // Hardware ready callback
    });
});
```

**Complexity:** Medium | **Impact:** Renderer can control hardware

---

### Step 6: Testing & Validation

**Hardware Tests:**
- [ ] Arduino connects via USB
- [ ] Board initializes without errors
- [ ] 3 light sensors detect state changes
- [ ] RGB LED strip updates per lane (colors, animations)
- [ ] Buzzer sounds for race countdown
- [ ] Lap timing accuracy within ±5ms tolerance
- [ ] Mock LED manager works for dev without hardware

**Integration Tests:**
- [ ] Full race flow: setup → countdown → lap detection → results
- [ ] Race restart/abort
- [ ] Hardware disconnect/reconnect handling
- [ ] LED animations during race states

**Stress Tests:**
- [ ] Multiple rapid sensor triggers
- [ ] Extended race sessions (30+ minutes)
- [ ] Memory leaks check (hardware event listeners)

**Complexity:** High | **Impact:** Quality assurance

---

## Dependencies & Imports

### Main Process (window.js) - Add Hardware Modules

```javascript
const five = require('johnny-five');

// Global hardware state
let board = null;
let sensors = { lane0: null, lane1: null, lane2: null };
let leds = { lane0: null, lane1: null, lane2: null };
let buzzer = null;
```

### Native Modules to Rebuild

```json
"dependencies": {
  "johnny-five": "^2.1.0",  // Uses serialport internally
  "serialport": "^9.0.7"     // Native module - needs rebuild
}
```

---

## Architecture Decisions

### Why Move Hardware to Main Process?

1. **Security:** Renderer process should not have direct hardware access
2. **Stability:** Renderer crashes (UI errors) won't kill hardware connection
3. **Best Practices:** Electron docs recommend all I/O in main process
4. **Context Isolation:** Hardware in renderer breaks with contextIsolation: true
5. **Future-proof:** Aligns with modern Electron architecture

### Event Flow Design

**Sensor Detection Flow:**
```
Arduino → Serial → Main Process (Johnny-Five)
  ↓ Sensor value change detected
  ↓ IPC event: 'hardware-sensor-change'
Renderer Process (js/chrono.js)
  ↓ Update lap time calculations
  ↓ IPC call: 'hardwareWriteLeds'
Main Process
  ↓ Update LED strip
Arduino
```

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Native module rebuild fails** | High | Test on multiple platforms, document dependencies |
| **Timing degradation (IPC latency)** | Medium | Benchmark lap timing, optimize event handlers |
| **Hardware compatibility issues** | Medium | Test with Uno, Nano, Pro Micro boards |
| **LED manager refactoring breaks animations** | Low | Keep mock manager for testing |
| **Event listener memory leaks** | Medium | Proper cleanup on board disconnect |

---

## Success Criteria

- [ ] Native modules rebuild successfully for Node.js 22
- [ ] No serialport binding errors
- [ ] Johnny-Five board initializes in main process
- [ ] All sensor readings work via IPC
- [ ] LED strip control works via IPC
- [ ] Buzzer works via IPC
- [ ] Lap timing accuracy maintained (±5ms tolerance)
- [ ] All LED animations functional
- [ ] Mock LED manager works for development
- [ ] No hardware code remains in renderer process
- [ ] Hardware disconnect/reconnect handled gracefully
- [ ] No memory leaks in long-running sessions
- [ ] Application runs successfully with Arduino connected

**Phase 3 Status: ⏳ NOT STARTED**

---

## Files to Modify This Phase

### Main Process
- **window.js** - Add hardware IPC handlers, Johnny-Five initialization

### Renderer (Refactored)
- **js/main.js** - Remove direct Johnny-Five calls, use IPC
- **js/led_managers/*.js** - Update for IPC-based LED control
- **js/client.js** - Update hardware initialization calls
- **js/ui.js** - Update hardware status display

### Not Modified This Phase
- **js/chrono.js** - **NO CHANGES** (battle-tested lap timer logic)
- **js/storage.js** - Already refactored in Phase 2
- **js/configuration.js** - Already refactored in Phase 2
- **js/export.js** - Already refactored in Phase 2

---

## Known Issues from Phase 2

**Current Error on Startup:**
```
/home/miche/Documents/Github/mini4wdchrono/node_modules/johnny-five/node_modules/firmata/lib/com.js:57 
It looks like serialport didn't install properly.
More information can be found here https://serialport.io/docs/guide-installation
The result of requiring the package is: undefined
Error: Could not locate the bindings file.
```

**This is EXPECTED and is the starting point for Phase 3.**

The serialport module needs to be rebuilt for Node.js 22. This is the first task in Step 1.

---

## Next Steps After Phase 3

Once Phase 3 is complete:
1. Full end-to-end race testing with hardware
2. Multi-platform testing (Linux, macOS, Windows 10+)
3. Performance benchmarking (lap timing accuracy)
4. Phase 4: Build & Distribution (packaging for all platforms)

---

## References & Resources

- **Johnny-Five Documentation:** http://johnny-five.io/
- **Firmata Protocol:** https://github.com/firmata/protocol
- **Serialport Documentation:** https://serialport.io/
- **@electron/rebuild:** https://github.com/electron/rebuild
- **Electron IPC Events:** https://www.electronjs.org/docs/api/ipc-renderer
- **Native Module Best Practices:** https://www.electronjs.org/docs/tutorial/using-native-node-modules

---

## Hardware Setup Reference

**Arduino Firmata Firmware:**
- Location: [resources/firmware/](../resources/firmware/)
- Supported boards: Uno, Nano, Pro Micro
- Flash before first use

**Pin Configuration (from configuration.js):**
```javascript
{
  "sensorPin1": 6,    // Lane 0 sensor
  "sensorPin2": 7,    // Lane 1 sensor
  "sensorPin3": 8,    // Lane 2 sensor
  "ledPin1": 3,       // Lane 0 LED strip
  "ledPin2": 4,       // Lane 1 LED strip
  "ledPin3": 5,       // Lane 2 LED strip
  "piezoPin": 2       // Buzzer
}
```

**USB Connection:**
- Auto-detection of Arduino serial port
- Baud rate: 57600 (Firmata default)
- Reconnection handling needed

---

## Session Notes

### Starting Point (Session TBD)
- Phase 2 complete (all IPC handlers working)
- Storage/config/export refactored
- Application launches successfully
- Serialport binding error blocking hardware initialization
- Ready to begin Phase 3

### Work Log
*To be filled during Phase 3 implementation*
