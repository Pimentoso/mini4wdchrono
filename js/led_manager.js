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
    // Creates an LED and buzzer controller for the connected hardware.
    constructor(_pin, pinBuzzer, reverse) {
        this.pinBuzzer = pinBuzzer;
        this.reverse = reverse;
        this.ready = false;
    }

    // Returns the shared LED manager instance.
    static getInstance(pin, pinBuzzer, reverse) {
        if (LedManager.instance) {
            return LedManager.instance;
        }

        LedManager.instance = new LedManager(pin, pinBuzzer, reverse);
        return LedManager.instance;
    }

    // Reports whether a buzzer pin is configured.
    buzzerAvailable() {
        return this.pinBuzzer > 0;
    }

    // Plays the connection animation and marks the controller ready.
    async connected() {
        if (this.buzzerAvailable()) {
            await this.beep(100);
        }

        await this.tamiyaSlide();
        this.ready = true;
    }

    // Clears hardware state after the controller disconnects.
    async disconnected() {
        this.ready = false;
        try {
            await window.electronAPI.hardwareLedOff({});
        } catch (error) {
            // Safely ignore errors when disconnecting hardware
        }
    }

    // Runs the configured start sequence before invoking the race callback.
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

    // Displays finishing positions after a completed round.
    roundFinish(cars) {
        const rLaps = storage.get('roundLaps');
        const finishCars = cars.filter((c) => !c.outOfBounds && c.lapCount === rLaps + 1);
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

    // Briefly highlights a lane after it records a lap.
    lap(lane) {
        if (this.ready) {
            this.colorLane(lane, COLOR_GREEN);
            setTimeout(async () => {
                await this.clearLane(lane);
            }, 1000);
        }
    }

    // Plays the buzzer for the requested duration.
    async beep(millis) {
        if (this.buzzerAvailable()) {
            try {
                await window.electronAPI.hardwareBuzz(millis);
            } catch (error) {
                console.warn('[LED] Failed to beep:', error);
            }
        }
    }

    // Returns the random or fixed delay before the green light.
    greenDelay() {
        if (storage.get('raceMode') === 1) {
            return 250 + (Math.random() * 3750);
        }

        return 1500;
    }

    // Maps a race lane to its physical LED lane.
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

    // Sets the LED color for one lane.
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

    // Turns off the LEDs for one lane.
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

    // Runs the green-light animation and then starts the race.
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

    // Runs the red countdown animation.
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

    // Runs the KITT-style LED animation.
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

    // Runs the Tamiya-color connection animation.
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
