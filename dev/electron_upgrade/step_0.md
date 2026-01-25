# Electron Upgrade Plan: v9 → v37 + Node 22

**Date:** January 2026  
**Target:** Electron 37.0.x + Node.js 22.x (Final target)  
**Reason:** Enable Python 3 builds on Apple Silicon, remove Python 2 dependency  
**Trade-off:** Drops Windows 7 support (Windows 10+ required, acceptable per requirements)
**Status:** Phase 2 (IPC Refactoring) - ✅ COMPLETED

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

### Phase 1: Setup & Foundation - ✅ COMPLETED
**See [step_1.md](step_1.md) for complete Phase 1 documentation.**

1. ✅ Upgrade package.json: Electron 37, Node 22
2. ✅ Create preload.js with safe API exposure
3. ✅ Enable contextIsolation and disable nodeIntegration
4. ✅ Create IPC channel infrastructure
5. ✅ Resolve Arch Linux build environment

### Phase 2: Storage/Config Refactoring - PENDING
1. Move storage.js file operations to main process
2. Move configuration.js settings read/write to main process
3. Implement full IPC handlers for FS operations
4. Update renderer calls to use IPC instead of direct fs
5. Test race data persistence

### Phase 3: Hardware & System APIs - PENDING
1. Move Johnny-Five initialization to main process
2. Refactor serial port communication via IPC
3. Update serialport from v9 (nested in firmata) to v10.x (standalone)
4. Move LED manager operations to main process
5. Implement IPC channels for sensor reading/LED writing
6. Move shell/dialog operations to main process
7. Test hardware communication under race conditions

### Phase 4: Security Hardening - PENDING
1. Remove all electron.remote calls from renderer
2. Validate all IPC message handlers in main
3. Add message validation/sanitization
4. Enable additional security options (sandbox, etc.)
5. Full security audit before release

---

## Risk Areas & Platform-Specific Considerations

| Risk | Platforms Affected | Mitigation |
|------|-------------------|-----------|
| **Johnny-Five async IPC latency** | All | Test with real lap timer, measure latency |
| **Serialport v9 C++ binding issues** | macOS ARM64 (unfixable), macOS Intel (Python 2 needed) | Phase 3 upgrade to serialport v10 |
| **Python 3.13 distutils missing** | Arch/Debian/Ubuntu (fixable) | Install python3-distutils OR use Python 3.12 |
| **Synchronous → async file ops** | All | Implement proper loading states in UI |
| **IPC channel message ordering** | All | Add sequence/timestamp validation |
| **Windows 10 only** | Windows users | Windows 7 no longer supported (deprecated in Electron 23) |

### Platform Build Compatibility

| Platform | Node 22 | Electron 37 | Python 3 | Status |
|----------|---------|-------------|----------|--------|
| **Arch Linux** | ✅ | ✅ | ✅ (3.13) | ✅ Works (distutils workaround in Phase 3) |
| **Ubuntu/Debian** | ✅ | ✅ | ✅ (3.10+) | ✅ Works (install python3-distutils) |
| **macOS Apple Silicon** | ✅ | ✅ | ✅ (3.10+) | ⚠️ Phase 3 needed (serialport v10 only) |
| **macOS Intel** | ✅ | ✅ | ✅ (3.10+) | ⚠️ Phase 3 needed (Python 2 era blocker) |
| **Windows 10** | ✅ | ✅ | ✅ (3.7+) | ✅ Works |
| **Windows 7** | ✅ | ❌ | N/A | ❌ Electron 23+ drops support |

### serialport v9 → v10 Upgrade (Phase 3 Task)

**Why not upgrade now (Phase 1)?**
- johnny-five v2.0.0 has firmata as a hard dependency that brings serialport v9
- The v9 library is nested and cannot be easily replaced
- Upgrading requires hardware refactoring (which Phase 3 does anyway)

**Phase 3 Strategy:**
1. Move hardware initialization from renderer to main process
2. Remove dependency on firmata's nested serialport v9
3. Use top-level serialport@10.x for all serial communication
4. Rebuild native bindings for Electron 37
5. **Benefits for all platforms:**
   - Arch: distutils issue resolved (v10 has modern node-gyp)
   - macOS ARM64: Finally works (prebuilt binaries available)
   - macOS Intel: No Python 2 needed
   - Windows 10: Modern C++ compiler compatibility

---

## Files to Modify

### Core Architecture
- **window.js** - Enable context isolation, disable node integration, set preload
- **js/main.js** - Add IPC handlers, move hardware logic
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

## Phase Details

- **Phase 1 Details:** See [step_1.md](step_1.md) - Setup & Foundation ✅ COMPLETED
- **Phase 2 Details:** (step_2.md) - Storage/Config Refactoring (not yet started)
- **Phase 3 Details:** (step_3.md) - Hardware & System APIs (not yet started)
- **Phase 4 Details:** (step_4.md) - Security Hardening (not yet started)

---

## Next Steps

**Current Status:** Phase 1 complete, ready to begin Phase 2

**To proceed with Phase 2:**
1. Read [step_1.md](step_1.md) for Phase 1 completion details
2. Move to Phase 2: Storage/Config refactoring
3. Implement IPC handlers in window.js for file operations
4. Update storage.js, configuration.js, export.js to use IPC

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
- [x] Context isolation **DISABLED** (contextIsolation: false) - Pragmatic choice for local-only app

---

## Architecture Decisions

### Context Isolation: DISABLED (January 25, 2026)

**Decision:** Set `contextIsolation: false` with `nodeIntegration: true`

**Rationale:**
- Mini4wdChrono only loads local, trusted code (no remote content, no user plugins)
- All JavaScript code is owned and audited by the project
- No XSS attack surface (no external websites, no user-generated HTML)
- Desktop app with local files only - not a web browser
- Significantly simpler module loading and API access
- Many production Electron apps use this configuration for similar use cases

**Security Impact:**
- **Low risk** for this specific application
- If app ever loads remote content in future, this should be revisited
- No credential exposure risk (no authentication/login system)
- File system access already limited to userData directory

**Technical Benefits:**
- Preload script can directly set `window` properties
- Required modules (via nodeRequire) share same window context
- No complex contextBridge API surface needed
- Simpler debugging and development
- More straightforward IPC patterns

**Alternative Considered:**
- `contextIsolation: true` - More secure but requires complex module initialization patterns
- Would need lazy loading, careful timing, and more complex code structure
- Not worth the complexity for a local-only desktop app

---

## References & Resources

- Electron 37 Release Notes: https://github.com/electron/electron/releases/tag/v37.0.0
- Node.js 22 LTS: https://nodejs.org/en/
- Context Isolation Guide: https://www.electronjs.org/docs/tutorial/context-isolation
- IPC Communication: https://www.electronjs.org/docs/api/ipc-main
- Preload Script Best Practices: https://www.electronjs.org/docs/tutorial/preload
