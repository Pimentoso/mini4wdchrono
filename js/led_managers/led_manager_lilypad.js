'use strict';

const LedManager = require('./led_manager');
const utils = require('../utils');
const storage = require('../storage');

// LED manager for 3 green LEDs.
class LedManagerLilypad extends LedManager {
    constructor(board, pinLeds, pinBuzzer, reverse) {
        super(board, pinBuzzer, reverse);
        this.pinLeds = pinLeds;
        this.ready = false;
    }

    static getInstance(board, pinLeds, pinBuzzer, reverse) {
        if (LedManagerLilypad.instance) {
            return LedManagerLilypad.instance;
        }

        LedManagerLilypad.instance = new LedManagerLilypad(board, pinLeds, pinBuzzer, reverse);
        return LedManagerLilypad.instance;
    }

    async connected() {
        await super.connected();

        // board is connected, start blink animation
        try {
            // Blink all 3 LEDs for 3 seconds
            await Promise.all(this.pinLeds.map(pin => 
                window.electronAPI.hardwareSimpleLed({ pin, operation: 'blink', interval: 125 })
            ));
            
            await utils.delayAsync(async () => {
                // Stop blinking and turn off
                await Promise.all(this.pinLeds.map(async pin => {
                    await window.electronAPI.hardwareSimpleLed({ pin, operation: 'stop' });
                    await window.electronAPI.hardwareSimpleLed({ pin, operation: 'off' });
                }));
                this.ready = true;
            }, 3000);
        } catch (error) {
            console.warn('Failed in connected animation:', error);
            this.ready = true;
        }
    }

    disconnected() {
        super.disconnected();
        // Cleanup happens in main process
    }

    async roundStart(animationType, startTimerCallback) {
        try {
            // Turn on all LEDs and beep
            await Promise.all(this.pinLeds.map(pin => 
                window.electronAPI.hardwareSimpleLed({ pin, operation: 'on' })
            ));
            await this.beep(1500);
            
            // Turn off all
            await utils.delayAsync(async () => {
                await Promise.all(this.pinLeds.map(pin => 
                    window.electronAPI.hardwareSimpleLed({ pin, operation: 'off' })
                ));
            }, 1500);
            
            // Countdown sequence: LED 1
            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[0], operation: 'on' });
                await this.beep(500);
            }, 1000);
            
            // LED 2
            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[0], operation: 'off' });
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[1], operation: 'on' });
                await this.beep(500);
            }, 1000);
            
            // LED 3
            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[1], operation: 'off' });
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[2], operation: 'on' });
                await this.beep(500);
            }, 1000);
            
            // Turn off LED 3
            await utils.delayAsync(async () => {
                await window.electronAPI.hardwareSimpleLed({ pin: this.pinLeds[2], operation: 'off' });
            }, 1000);
            
            // Green light - all on, start timer
            await utils.delayAsync(async () => {
                await Promise.all(this.pinLeds.map(pin => 
                    window.electronAPI.hardwareSimpleLed({ pin, operation: 'on' })
                ));
                await this.beep(1000);
                startTimerCallback();
            }, super.greenDelay());
            
            // Turn off after start delay
            await utils.delayAsync(async () => {
                await Promise.all(this.pinLeds.map(pin => 
                    window.electronAPI.hardwareSimpleLed({ pin, operation: 'off' })
                ));
            }, storage.get('startDelay') * 1000);
        } catch (error) {
            console.warn('Failed in roundStart:', error);
        }
    }

    async roundFinish(cars) {
        // turn on winner car led
        const rLaps = storage.get('roundLaps');
        const finishCars = _.filter(cars, (c) => { return !c.outOfBounds && c.lapCount === rLaps + 1; });
        await utils.delayAsync(async () => {
            for (const car of finishCars) {
                if (car.position === 1) {
                    const laneIdx = this.laneIndex(car.startLane);
                    await window.electronAPI.hardwareSimpleLed({ 
                        pin: this.pinLeds[laneIdx], 
                        operation: 'on' 
                    });
                }
            }
        }, 1500);
    }

    async lap(lane) {
        // flash lane led for 1 sec
        if (this.ready) {
            try {
                const laneIdx = this.laneIndex(lane);
                const pin = this.pinLeds[laneIdx];
                await window.electronAPI.hardwareSimpleLed({ pin, operation: 'on' });
                await utils.delayAsync(async () => {
                    await window.electronAPI.hardwareSimpleLed({ pin, operation: 'off' });
                }, 1000);
            } catch (error) {
                console.warn('Failed in lap:', error);
            }
        }
    }
}

module.exports = LedManagerLilypad;
