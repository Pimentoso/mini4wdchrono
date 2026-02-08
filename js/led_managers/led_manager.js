'use strict';

const storage = require('../storage');

class LedManager {
    constructor(pinBuzzer, reverse) {
        this.pinBuzzer = pinBuzzer;
        this.reverse = reverse;
    }

    buzzerAvailable() {
        return this.pinBuzzer > 0;
    }

    async connected() {
        if (this.buzzerAvailable()) {
            await this.beep(100);
        }
    }

    async disconnected() {
        // Nothing to do here in renderer
    }

    roundStart(_animationType, _startTimerCallback) {
        throw new Error('not implemented');
    }

    roundFinish(_cars) {
        throw new Error('not implemented');
    }

    lap(_lane) {
        throw new Error('not implemented');
    }

    async beep(millis) {
        if (this.buzzerAvailable()) {
            try {
                await window.electronAPI.hardwareBuzz(millis);
            } catch (error) {
                console.warn('Failed to beep:', error);
            }
        }
    }

    greenDelay() {
        if (storage.get('raceMode') === 1) {
            // if final mode, delay is random between 0.25/4 sec
            return 250 + (Math.random() * 3750);
        }
        else {
            return 1500;
        }
    }

    laneIndex(lane) {
        if (this.reverse) {
            if (lane === 0) {
                return 2;
            }
            else if (lane === 2) {
                return 0;
            }
            else {
                return 1;
            }
        }
        else {
            return lane;
        }
    }
}

module.exports = LedManager;
