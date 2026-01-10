# Electron Upgrade Plan: v9 → v37 + Node 22

**Date:** January 2026  
**Target:** Electron 37.0.x + Node.js 22.x (Final target)  
**Reason:** Enable Python 3 builds on Apple Silicon, remove Python 2 dependency  
**Trade-off:** Drops Windows 7 support (acceptable)

---

## Current State

| Component | Current Version | Issue |
|-----------|-----------------|-------|
| **Electron** | 9.4.4 (March 2020) | No context isolation, Python 2 requirement |
| **Node.js** | 12 (bundled) | Python 2 required for native module compilation |
| **Architecture** | No context isolation | Backend/renderer mixed in main.js |
| **Key Dependencies** | serialport 9.0.7 | Will fail on Node 22+ |

### Critical Architectural Issues
1. **Node integration enabled** in window.js (nodeIntegration: true)
2. **No context isolation** (contextIsolation not set/false)
3. **No preload script** - direct Electron API access from renderer
4. **Renderer process runs**: Hardware I/O (Johnny-Five), file operations, serial communication
5. **Uses deprecated APIs**: electron.remote, synchronous file reads

---

## Target State

| Component | Target Version | Benefits |
|-----------|-----------------|----------|
| **Electron** | 37.0.x | Last to support Windows 10+ (Python 3 compatible) |
| **Node.js** | 22.x | LTS until May 2027, Apple Silicon native support |
| **Build Tools** | Python 3.7+, C++ build chain | Modern, widely available |
| **Architecture** | Context isolation enabled, IPC-based | Secure, future-proof |

### Target Outcome
- ✅ Builds on Apple Silicon without Python 2
- ✅ Builds on Windows 10+ without Python 2
- ✅ Builds on Linux with standard Python 3
- ✅ Security hardened with context isolation
- ⚠️ Windows 7 no longer supported (deprecated in Electron 23)

---

## System Calls Requiring IPC Conversion

### High Priority (Breaking in Electron 37+)

#### 1. **electron.remote** (main.js)
- **Locations:** Lines 9, 179, 229, 282 in js/main.js
- **Operations:** Window manipulation, app lifecycle, dialog access
- **IPC Channels Needed:**
  - `maximize-window` / `minimize-window` / `close-window`
  - `show-open-dialog` / `show-save-dialog`
  - `get-app-version` / `get-app-name`

#### 2. **File Operations - storage.js**
- **Operations:**
  - Line 27-28: Directory existence check and creation
  - Line 34: Create race JSON file
  - Line 57: Delete race file
  - Line 73-76: Read/list races (synchronous)
- **IPC Channels Needed:**
  - `fs-ensure-dir`
  - `fs-write-file` (race data)
  - `fs-delete-file`
  - `fs-list-races`

#### 3. **File Operations - configuration.js**
- **Operations:**
  - Line 21-22: Settings backup/restore
  - Line 28, 33: Settings read/write via nconf
- **IPC Channels Needed:**
  - `config-save`
  - `config-load`
  - `config-reset` (with backup)

#### 4. **Hardware I/O - main.js**
- **Lines:** 96-341 (Johnny-Five integration)
- **Current Issue:** Serial communication in renderer process
- **Requires:** Full refactoring to move to main process
- **IPC Channels Needed:**
  - `hardware-initialize`
  - `hardware-read-sensors`
  - `hardware-write-leds`
  - `hardware-send-buzz`

### Medium Priority

#### 5. **File Operations - export.js**
- **Line 17-18:** Export directory management
- **Line 68:** Excel file writes
- **IPC Channels Needed:**
  - `fs-ensure-export-dir`
  - `fs-write-excel`

#### 6. **App Paths - main.js**
- **Line 17:** Uses app.getPath() in renderer
- **Should Move:** Path resolution to main process
- **IPC Channels Needed:**
  - `get-app-path`
  - `get-user-data-path`
  - `get-logs-path`

#### 7. **Dialog Operations - main.js**
- **Lines:** 179, 229 (dialog.showOpenDialog, dialog.showSaveDialog)
- **IPC Channels Needed:**
  - `show-open-file-dialog`
  - `show-save-file-dialog`

#### 8. **Shell Operations - main.js**
- **Line 276:** shell.openPath() for file explorer
- **IPC Channels Needed:**
  - `open-path-in-explorer`

#### 9. **Clipboard Operations - main.js**
- **Line 278, 281:** clipboard operations (if used)
- **IPC Channels Needed:**
  - `clipboard-write`
  - `clipboard-read`

---

## Data Persistence Strategy

### Race Data (storage.js)
- **Current:** JSON files in userData/races/ (sync read, async write via electron-settings)
- **Change:** All file operations move to main process via IPC
- **Format:** Unchanged (JSON per race)
- **Affected:** All race CRUD operations

### Settings (configuration.js)
- **Current:** settings.json via nconf (async load/save)
- **Change:** Main process owns file I/O, renderer requests via IPC
- **Format:** Unchanged (JSON)
- **Affected:** Hardware config, UI settings, user preferences

### Exports (export.js)
- **Current:** Excel files written from renderer via exceljs
- **Change:** Move to main process for security
- **Format:** Excel workbook (.xlsx)
- **Affected:** Race report generation

### Logs (electron-log)
- **Current:** Logged to userData/logs/
- **Consideration:** Can remain in renderer or be centralized in main
- **Priority:** Low (non-critical for upgrade)

---

## Migration Steps (High Level)

### Phase 1: Setup & Foundation
1. Upgrade package.json: Electron 37, Node 22, rebuild serialport (v10+)
2. Create preload.js with safe API exposure
3. Enable contextIsolation: true and nodeIntegration: false in window.js
4. Create IPC channel infrastructure in main.js
5. Test that basic window creation works

### Phase 2: Storage/Config Refactoring
1. Move storage.js file operations to main process
2. Move configuration.js settings read/write to main process
3. Implement IPC handlers for all FS operations
4. Update renderer calls to use IPC instead of direct fs
5. Test race data persistence

### Phase 3: Hardware & System APIs
1. Move Johnny-Five initialization to main process
2. Refactor serial port communication via IPC
3. Move LED manager operations to main process
4. Implement IPC channels for sensor reading/LED writing
5. Move shell/dialog operations to main process
6. Test hardware communication under race conditions

### Phase 4: Security Hardening
1. Remove all electron.remote calls from renderer
2. Validate all IPC message handlers in main
3. Add message validation/sanitization
4. Enable additional security options (sandbox, etc.)
5. Full security audit before release

---

## Risk Areas & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| **Johnny-Five async IPC latency** | Race timing may be affected | Test with real lap timer, measure latency |
| **Serialport v9 → v10 compatibility** | Hardware communication breaks | Test with target Arduino board before phase 3 |
| **Synchronous → async file ops** | App responsiveness changes | Implement proper loading states in UI |
| **IPC channel message ordering** | Race events out of sequence | Add sequence/timestamp validation |
| **Windows 10 only** | Some users lose support | Clear communication in release notes |

---

## Files to Modify

### Core Architecture
- **window.js** - Enable context isolation, disable node integration, set preload
- **js/main.js** - Create preload.js, add IPC handlers, move hardware logic
- **js/client.js** - Update to use IPC for system calls
- **js/ui.js** - Update file/dialog operations to use IPC

### Storage & Config
- **js/storage.js** - Convert to IPC-based file operations
- **js/configuration.js** - Convert to IPC-based settings
- **js/export.js** - Convert to IPC-based export

### Build & Dependencies
- **package.json** - Update Electron, Node, serialport versions
- **scripts/postinstall.js** - Update for Python 3 build chain

### Hardware (Not to Change)
- **js/chrono.js** - NO CHANGES (battle-tested lap timer logic)
- **js/led_managers/** - Refactor for main process, but core logic unchanged

---

## Success Criteria

- [ ] Application builds on Apple Silicon Mac with Python 3
- [ ] Application builds on Windows 10+ with Python 3
- [ ] Application builds on Linux with Python 3
- [ ] All race data persists correctly
- [ ] Hardware lap timer communication works reliably
- [ ] No race timing deviations (±5ms tolerance)
- [ ] All UI dialogs functional
- [ ] No console warnings about deprecated APIs
- [ ] Context isolation enabled without errors

---

## Next Steps (Session 2+)

1. **Step 1 (Phase 1):** Update package.json and dependencies, test build
2. **Step 2 (Phase 1-2):** Create preload.js, enable context isolation, basic IPC setup
3. **Step 3 (Phase 2):** Refactor storage.js and configuration.js to use IPC
4. **Step 4 (Phase 3):** Move hardware I/O to main process
5. **Step 5 (Phase 4):** Security hardening and final testing