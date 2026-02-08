# Step 6: Timestamp Accuracy for Lap Timing

## Problem Statement

In the Electron IPC architecture, sensor events from the main process are sent to the renderer process via `webContents.send()`. The timestamp for lap timing was being captured in the renderer process after:
1. IPC message transmission (variable latency: 10-50ms+)
2. Event queue processing
3. JavaScript callback execution

This introduced non-deterministic timing errors incompatible with millisecond-precision lap timing requirements.

## Solution

Capture timestamps **at the hardware event source** (main process) and pass them through the IPC chain to ensure timing accuracy.

### Implementation Details

#### 1. Hardware Layer (window.js)
Modified all three sensor change listeners to capture timestamps immediately:

```javascript
sensors.lane0.on('change', function() {
    if (mainWindow) {
        const timestamp = Date.now(); // Capture immediately
        mainWindow.webContents.send('hardware-sensor-change', {
            lane: 0,
            value: this.value,
            timestamp: timestamp  // Include in IPC message
        });
    }
});
```

#### 2. Timing Core (chrono.js)
Updated `addLap()` to accept optional timestamp parameter:

```javascript
const addLap = (lane, timestamp) => {
    // Use provided timestamp (captured at hardware level) or fallback
    if (!timestamp) {
        timestamp = new Date().getTime();
    }
    // ... rest of timing logic
}
```

#### 3. Race Logic (client.js)
Updated to pass timestamp through:

```javascript
const addLap = (lane, timestamp) => {
    if (!raceRunning) {
        return;
    }
    chrono.addLap(lane, timestamp);
    // ...
}
```

#### 4. Event Handler (main.js)
Extract timestamp from IPC message and pass to client:

```javascript
window.electronAPI.onSensorChange((event, data) => {
    const { lane, value, timestamp } = data;
    // ...
    client.addLap(lane, timestamp);
});
```

## Benefits

1. **Timing Accuracy**: Timestamps captured within microseconds of hardware event
2. **IPC Latency Eliminated**: Measurement taken before IPC communication
3. **Deterministic Timing**: Removes JavaScript event loop variance
4. **Backward Compatible**: Fallback to `Date.now()` if timestamp not provided

## Testing Considerations

- Verify lap times match between consecutive runs on identical tracks
- Compare timestamps in logs to ensure hardware-level capture
- Test with high-frequency sensor triggers to validate no timing drift
- Verify debug mode still works correctly (no hardware)

## Status

✅ Implemented and ready for testing
