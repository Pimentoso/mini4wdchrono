'use strict';

const j5 = require('johnny-five');
const utils = require('./utils');
const pixel = require('node-pixel');

class LedManager {
	constructor(board, pinBuzzer) {
		this.board = board;
		this.pinBuzzer = pinBuzzer;
	}

	connected() {
		this.board.pinMode(this.pinBuzzer, j5.Pin.OUTPUT);
		this.beep(100);
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
		this.ready = false;
	}

	connected() {
		super.connected();
		// blink all leds for 3 sec
		this.led1.blink(125); this.led2.blink(125); this.led3.blink(125);
		utils.delay(() => { this.led1.stop().off(); this.led2.stop().off(); this.led3.stop().off(); this.ready = true; }, 3000);
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
		if (this.ready) {
			let led = this.leds[lane];
			led.on();
			utils.delay(() => { led.off(); }, 1000);
		}
	}
}

// Manager for a 9 LEDs WS2812b strip and a buzzer.
class LedManagerRgbStrip extends LedManager {
	constructor(board, pin, pinBuzzer) {
		super(board, pinBuzzer);
		this.pin = pin;
		this.ready = false;
	}

	connected() {
		super.connected();
		this.strip = new pixel.Strip({
			board: this.board,
			controller: "FIRMATA",
			strips: [{ pin: this.pin, length: 9 },],
			gamma: 2.8
		});
		var manager = this;

		this.strip.on("ready", function () {
			manager.strip.pixel(0).color('#188bc8');
			manager.strip.pixel(3).color('#e62227');
			manager.strip.pixel(6).color('#f8f8f8');
			manager.strip.show();

			let shift = setInterval(function () {
				manager.strip.shift(1, pixel.FORWARD, true);
				manager.strip.show();
			}, 125);
			utils
				.delay(() => { clearInterval(shift); }, 3000)
				.delay(() => { manager.strip.off(); manager.ready = true; }, 125);
		});
	}

	disconnected() {
		super.disconnected();
		this.strip.off();
	}

	roundStart(startTimerCallback) {
		var stripp = this.strip;
		this.beep(1500);
		utils
			.delay(() => { stripp.off(); }, 1500)
			.delay(() => { stripp.pixel(0).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(1).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(2).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(3).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(4).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(5).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(6).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(7).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.pixel(8).color('#ff0100'); stripp.show(); }, 400)
			.delay(() => { stripp.color('#06a14e'); stripp.show(); this.beep(1000); startTimerCallback(); }, 1500)
			.delay(() => { stripp.off(); }, 2500)
	}

	roundFinish(cars) {
		// turn on winner car led
		let finishCars = _.filter(cars, (c) => { return !c.outOfBounds && c.lapCount == 4 });
		_.each(finishCars, (c) => {
			if (c.position == 1) {
				colorLane(c.startLane, '#ff0100');
			}
			else if (c.position == 2) {
				colorLane(c.startLane, '#ff7400');
			}
			else if (c.position == 3) {
				colorLane(c.startLane, '#fec101');
			}
		});
		this.strip.show();
	}

	lap(lane) {
		// flash lane led for 1 sec
		if (this.ready) {
			this.colorLane(lane, '#06a14e');
			utils.delay(() => {
				this.clearLane(lane);
			}, 1000);
		}
	}

	colorLane(lane, color) {
		let start = lane * 3;
		for (let i = start; i <= start+2; i++) {
			this.strip.pixel(i).color(color);
		}
		this.strip.show();
	}

	clearLane(lane) {
		let start = lane * 3;
		for (let i = start; i <= start+2; ++i) {
			this.strip.pixel(i).off();
		}
		this.strip.show();
	}
}

module.exports = {
	LedManagerLilypad: LedManagerLilypad,
	LedManagerRgbStrip: LedManagerRgbStrip
}
