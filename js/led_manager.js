'use strict';

const j5 = require('johnny-five');
const utils = require('./utils');

class LedManager {
	constructor(board, pinBuzzer) {
		this.board = board;
		this.pinBuzzer = pinBuzzer;
	}

	connected() {
        this.board.pinMode(this.pinBuzzer, j5.Pin.OUTPUT);
        this.beep(250);
	}

	disconnected() {
		this.board.digitalWrite(this.pinBuzzer, 0);
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
		this.board.digitalWrite(this.pinBuzzer, 1);
		utils.delay(() => { this.board.digitalWrite(this.pinBuzzer, 0); }, millis);
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
		super.connected();
		// blink all leds for 3 sec
		this.led1.blink(125); this.led2.blink(125); this.led3.blink(125);
		utils.delay(() => { this.led1.stop().off(); this.led2.stop().off(); this.led3.stop().off(); }, 3000);
	}

	disconnected() {
		super.disconnected();
		this.led1.stop().off();
		this.led2.stop().off();
		this.led3.stop().off();
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
		// turn on winner car led
		let winnerCar = _.filter(cars, (c) => { return !c.outOfBounds && c.lapCount == 4 && c.position == 1; });
		if (winnerCar) {
			let winnerLane = winnerCar.startLane;
			this.leds[winnerLane].on();
		}
	}

	lap(lane) {
		// flash lane led for 1 sec
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

module.exports = {
	LedManagerLilypad: LedManagerLilypad,
	LedManagerRgbStrip: LedManagerRgbStrip
}
