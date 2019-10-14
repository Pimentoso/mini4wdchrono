'use strict';

const utils = require('./utils');

class LedManager {
    constructor(board, pinBuzzer) {
        this._board = board;
        this._pinBuzzer = pinBuzzer;
    }

    connected() {
        throw 'not implemented';
    }

    roundStart() {
        throw 'not implemented';
    }

    roundFinish(cars) {
        throw 'not implemented';
    }

    lap(lane) {
        throw 'not implemented';
    }

    beep(millis) {
        this._board.digitalWrite(this._pinBuzzer, 1);
	    utils.delay(() => { this._board.digitalWrite(this._pinBuzzer, 0); }, millis);
    }
}

// Simple manager for 3 green LEDs and a buzzer.
class LedManagerLilypad extends LedManager {
    constructor(board, pinLeds, pinBuzzer) {
        super(board, pinBuzzer);
        
        this.led1 = new j5.Led(pinLeds[0]);
        this.led2 = new j5.Led(pinLeds[1]);
        this.led3 = new j5.Led(pinLeds[2]);
        this.leds = [this.led1, this.led2, this.led3];
    }

    connected() {
        this.led1.blink(125); this.led2.blink(125); this.led3.blink(125);
        utils.delay(() => { this.led1.stop().off(); this.led2.stop().off(); this.led3.stop().off(); }, 3000);
    }

    roundStart(startTimerCallback) {
        this.led1.on(); this.led2.on(); this.led3.on(); beep(1500);
        utils
            .delay(() => { this.led1.off(); this.led2.off(); this.led3.off(); }, 1500)
            .delay(() => { this.led1.on(); beep(500); }, 1000)
            .delay(() => { this.led1.off(); this.led2.on(); beep(500); }, 1000)
            .delay(() => { this.led2.off(); this.led3.on(); beep(500); }, 1000)
            .delay(() => { this.led3.off(); }, 1000)
            .delay(() => { this.led1.on(); this.led2.on(); this.led3.on(); beep(1000); startTimerCallback(); }, 1500)
            .delay(() => { this.led1.off(); this.led2.off(); this.led3.off(); }, 2500);
    }

    roundFinish(cars) {
        // not implemented, turn on winner car led
    }

    lap(lane) {
        let led = this.leds[lane];
        led.on();
        utils.delay(() => { led.off(); }, 1000);
    }
}

// Manager for a 9 LEDs WS2812b strip and a buzzer.
class LedManagerRgbStrip extends LedManager {
    constructor(board, pinLeds, pinBuzzer) {
        super(board, pinBuzzer);
        // TODO init strip, pinLeds will be an array with 1 element
    }
}