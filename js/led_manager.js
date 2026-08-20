'use strict';

const storage = require('./storage');

const COLOR_GREEN = '#66cc33';
const COLOR_BLUE = '#188bc8';
const COLOR_RED = '#ff0100';

const COLOR_POS1 = COLOR_GREEN;
const COLOR_POS2 = COLOR_BLUE;
const COLOR_POS3 = COLOR_RED;

const COLOR_TAMIYA_RED = '#e62227';
const COLOR_TAMIYA_WHITE = '#f8f8f8';
const COLOR_TAMIYA_BLUE = COLOR_BLUE;

// Manager for a 9 LEDs WS2812b strip and a buzzer.
class LedManager {
    constructor(_pin, pinBuzzer, reverse) {
        this.pinBuzzer = pinBuzzer;
        this.reverse = reverse;
        this.ready = false;
    }

    static getInstance(pin, pinBuzzer, reverse) {
        if (LedManager.instance) {
            return LedManager.instance;
        }

        LedManager.instance = new LedManager(pin, pinBuzzer, reverse);
        return LedManager.instance;
    }

    buzzerAvailable() {
        return this.pinBuzzer > 0;
    }

    async connected() {
        if (this.buzzerAvailable()) {
            await this.beep(100);
        }

        await this.tamiyaSlide();
        this.ready = true;
    }

    async disconnected() {
        this.ready = false;
        try {
            await window.electronAPI.hardwareLedOff({});
        } catch (error) {
            // Safely ignore errors when disconnecting hardware
        }
    }

    roundStart(animationType, startTimerCallback) {
        if (animationType === 0) {
            this.beep(1500);
            this.kitt(COLOR_BLUE);
            this.countdown(2500);
            this.greenLight(2500 + 3200 + this.greenDelay(), startTimerCallback);
        }
        else if (animationType === 1) {
            this.countdown(0);
            this.greenLight(3200 + this.greenDelay(), startTimerCallback);
        }
        else {
            this.greenLight(0, startTimerCallback);
        }
    }

    roundFinish(cars) {
        const rLaps = storage.get('roundLaps');
        const finishCars = _.filter(cars, (c) => !c.outOfBounds && c.lapCount === rLaps + 1);
        setTimeout(async () => {
            for (const c of finishCars) {
                let color;
                if (c.position === 1) {
                    color = COLOR_POS1;
                } else if (c.position === 2) {
                    color = COLOR_POS2;
                } else if (c.position === 3) {
                    color = COLOR_POS3;
                }
                if (color) {
                    await this.colorLane(c.startLane, color);
                }
            }
        }, 1500);
    }

    lap(lane) {
        if (this.ready) {
            this.colorLane(lane, COLOR_GREEN);
            setTimeout(async () => {
                await this.clearLane(lane);
            }, 1000);
        }
    }

    async beep(millis) {
        if (this.buzzerAvailable()) {
            try {
                await window.electronAPI.hardwareBuzz(millis);
            } catch (error) {
                console.warn('[LED] Failed to beep:', error);
            }
        }
    }

    greenDelay() {
        if (storage.get('raceMode') === 1) {
            return 250 + (Math.random() * 3750);
        }

        return 1500;
    }

    laneIndex(lane) {
        if (this.reverse) {
            if (lane === 0) {
                return 2;
            }
            else if (lane === 2) {
                return 0;
            }
        }

        return lane === 1 ? 1 : lane;
    }

    async colorLane(lane, color) {
        lane = this.laneIndex(lane);
        try {
            await window.electronAPI.hardwareWriteLeds({
                lane: lane,
                color: color
            });
        } catch (error) {
            console.warn('[LED] Failed to color lane:', error);
        }
    }

    async clearLane(lane) {
        lane = this.laneIndex(lane);
        try {
            await window.electronAPI.hardwareLedOff({
                lane: lane
            });
        } catch (error) {
            console.warn('[LED] Failed to clear lane:', error);
        }
    }

    async greenLight(delay, callback) {
        try {
            await window.electronAPI.hardwareRunLedAnimation({
                type: 'greenLight',
                delay: delay,
                offDelay: storage.get('startDelay') * 1000,
                color: COLOR_GREEN,
                buzzDuration: 1000
            });
            callback();
        } catch (error) {
            console.warn('[LED] Green-light animation failed:', error);
        }
    }

    async countdown(delay) {
        try {
            await window.electronAPI.hardwareRunLedAnimation({
                type: 'countdown',
                delay: delay,
                reverse: this.reverse,
                color: COLOR_RED,
                buzzDuration: 200,
                stepDelay: 400
            });
        } catch (error) {
            console.warn('[LED] Countdown animation failed:', error);
        }
    }

    async kitt(color) {
        try {
            await window.electronAPI.hardwareRunLedAnimation({
                type: 'kitt',
                color: color,
                stepDelay: 50,
                duration: 1650
            });
        } catch (error) {
            console.warn('[LED] KITT animation failed:', error);
        }
    }

    async tamiyaSlide() {
        try {
            await window.electronAPI.hardwareRunLedAnimation({
                type: 'tamiyaSlide',
                stepDelay: 100,
                duration: 3000,
                colors: [
                    COLOR_TAMIYA_BLUE,
                    COLOR_TAMIYA_BLUE,
                    COLOR_TAMIYA_BLUE,
                    COLOR_TAMIYA_RED,
                    COLOR_TAMIYA_RED,
                    COLOR_TAMIYA_RED,
                    COLOR_TAMIYA_WHITE,
                    COLOR_TAMIYA_WHITE,
                    COLOR_TAMIYA_WHITE
                ]
            });
        } catch (error) {
            console.warn('[LED] Tamiya slide animation failed:', error);
        }
    }
}

module.exports = LedManager;
