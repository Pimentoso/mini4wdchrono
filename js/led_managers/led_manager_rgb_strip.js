'use strict';

const LedManager = require('./led_manager');
const utils = require('../utils');
const storage = require('../storage');

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
class LedManagerRgbStrip extends LedManager {
    constructor(pin, pinBuzzer, reverse) {
        super(pinBuzzer, reverse);
        this.pin = pin;
        this.ready = false;
    }

    static getInstance(pin, pinBuzzer, reverse) {
        if (LedManagerRgbStrip.instance) {
            return LedManagerRgbStrip.instance;
        }

        LedManagerRgbStrip.instance = new LedManagerRgbStrip(pin, pinBuzzer, reverse);
        return LedManagerRgbStrip.instance;
    }

    async connected() {
        await super.connected();

        // Simulate tamiya slide animation
        await this.tamiyaSlide();
        this.ready = true;
    }

    async disconnected() {
        await super.disconnected();
        try {
            await window.electronAPI.hardwareLedOff({});
        } catch (e) {
            // Safely ignore errors when disconnecting hardware
        }
    }

    async roundStart(animationType, startTimerCallback) {
        if (animationType === 0) {
            // full animation
            await this.beep(1500);
            await this.kitt(COLOR_BLUE);
            await this.countdown(2500);
            await this.greenLight(2500 + 3200 + super.greenDelay(), startTimerCallback);
        }
        else if (animationType === 1) {
            // countdown only
            await this.countdown(0);
            await this.greenLight(3200 + super.greenDelay(), startTimerCallback);
        }
        else {
            // no animations
            await this.greenLight(0, startTimerCallback);
        }
    }

    roundFinish(cars) {
        // color lanes based on positions
        const rLaps = storage.get('roundLaps');
        const finishCars = _.filter(cars, (c) => { return !c.outOfBounds && c.lapCount === rLaps + 1; });
        utils.delay(async () => {
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
        // flash lane led for 1 sec
        if (this.ready) {
            this.colorLane(lane, COLOR_GREEN);
            utils.delay(async () => {
                await this.clearLane(lane);
            }, 1000);
        }
    }

    async colorLane(lane, color) {
        lane = this.laneIndex(lane);
        try {
            await window.electronAPI.hardwareWriteLeds({
                lane: lane,
                color: color
            });
        } catch (error) {
            console.warn('Failed to color lane:', error);
        }
    }

    async clearLane(lane) {
        lane = this.laneIndex(lane);
        try {
            await window.electronAPI.hardwareLedOff({
                lane: lane
            });
        } catch (error) {
            console.warn('Failed to clear lane:', error);
        }
    }

    async greenLight(delay, callback) {
        try {
            await utils.delayAsync(async () => {
                // Turn all LEDs green
                for (let i = 0; i < 9; i++) {
                    await window.electronAPI.hardwareWriteLeds({
                        pixelIndex: i,
                        color: COLOR_GREEN,
                        show: false
                    });
                }
                await window.electronAPI.hardwareLedShow();
                await this.beep(1000);
                callback();
            }, delay);

            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareLedOff({});
            }, storage.get('startDelay') * 1000);
        } catch (error) {
            console.warn('Failed in greenLight:', error);
        }
    }

    async countdown(delay) {
        try {
            const pixels = this.reverse ? [8,7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7,8];
            let currentDelay = delay;

            for (let i = 0; i < pixels.length; i++) {
                await utils.delayAsync(async () => {
                    await window.electronAPI.hardwareWriteLeds({
                        pixelIndex: pixels[i],
                        color: COLOR_RED
                    });
                    if (i % 3 === 0) {
                        await this.beep(200);
                    }
                }, currentDelay);
                currentDelay = 400;
            }
        } catch (error) {
            console.warn('Failed in countdown:', error);
        }
    }

    async kitt(color) {
        try {
            let direction = 0, curr = 0, prev = -1;
            const millis = 50;
            const iterations = Math.floor(1650 / millis);

            for (let i = 0; i < iterations; i++) {
                await utils.delayAsync(async () => {
                    await window.electronAPI.hardwareWriteLeds({
                        pixelIndex: curr,
                        color: color,
                        show: false
                    });
                    if (prev >= 0) {
                        await window.electronAPI.hardwareLedOff({
                            pixelIndex: prev,
                            show: false
                        });
                    }
                    await window.electronAPI.hardwareLedShow();

                    if (direction === 0) {
                        curr++; prev++;
                        if (curr > 8) {
                            direction = 1;
                            curr = 7;
                        }
                    } else {
                        curr--; prev--;
                        if (curr < 0) {
                            direction = 0;
                            curr = 1;
                        }
                    }
                }, i * millis);
            }

            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareLedOff({});
            }, iterations * millis + millis);
        } catch (error) {
            console.warn('Failed in kitt:', error);
        }
    }

    async tamiyaSlide() {
        try {
            const millis = 100;

            // Set initial colors
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 0, color: COLOR_TAMIYA_BLUE, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 1, color: COLOR_TAMIYA_BLUE, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 2, color: COLOR_TAMIYA_BLUE, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 3, color: COLOR_TAMIYA_RED, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 4, color: COLOR_TAMIYA_RED, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 5, color: COLOR_TAMIYA_RED, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 6, color: COLOR_TAMIYA_WHITE, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 7, color: COLOR_TAMIYA_WHITE, show: false });
            await window.electronAPI.hardwareWriteLeds({ pixelIndex: 8, color: COLOR_TAMIYA_WHITE, show: false });
            await window.electronAPI.hardwareLedShow();

            // Note: Full shift animation is complex to do via IPC
            // For now, just show the Tamiya colors and fade out
            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareLedOff({});
            }, 3000);
        } catch (error) {
            console.warn('Failed in tamiyaSlide:', error);
        }
    }
}

module.exports = LedManagerRgbStrip;
