'use strict';

const j5 = require('johnny-five');
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
		if (!!LedManagerLilypad.instance) {
			return LedManagerLilypad.instance;
		}

		LedManagerLilypad.instance = new LedManagerLilypad(board, pinLeds, pinBuzzer, reverse);
		return LedManagerLilypad.instance;
	}

	connected() {
		super.connected();

		// board is connected, init hardware
		this.led1 = new j5.Led({
			board: this.board,
			pin: this.pinLeds[0]
		});
		this.led2 = new j5.Led({
			board: this.board,
			pin: this.pinLeds[1]
		});
		this.led3 = new j5.Led({
			board: this.board,
			pin: this.pinLeds[2]
		});
		this.leds = [this.led1, this.led2, this.led3];

		// blink all leds for 3 sec
		this.led1.blink(125); this.led2.blink(125); this.led3.blink(125);
		utils.delay(() => { this.led1.stop().off(); this.led2.stop().off(); this.led3.stop().off(); this.ready = true; }, 3000);
	}

	disconnected() {
		super.disconnected();
		try {
			this.led1.stop().off();
			this.led2.stop().off();
			this.led3.stop().off();
		} catch (e) { }
	}

	roundStart(startTimerCallback) {
		this.led1.on(); this.led2.on(); this.led3.on(); this.beep(1500);
		utils
			.delay(() => { this.led1.off(); this.led2.off(); this.led3.off(); }, 1500)
			.delay(() => { this.led1.on(); this.beep(500); }, 1000)
			.delay(() => { this.led1.off(); this.led2.on(); this.beep(500); }, 1000)
			.delay(() => { this.led2.off(); this.led3.on(); this.beep(500); }, 1000)
			.delay(() => { this.led3.off(); }, 1000)
			.delay(() => { this.led1.on(); this.led2.on(); this.led3.on(); this.beep(1000); startTimerCallback(); }, super.greenDelay())
			.delay(() => { this.led1.off(); this.led2.off(); this.led3.off(); }, storage.get('startDelay') * 1000);
	}

	roundStartInstant(startTimerCallback) {
		utils
			.delay(() => { this.led1.on(); this.led2.on(); this.led3.on(); this.beep(1000); startTimerCallback(); }, 0)
			.delay(() => { this.led1.off(); this.led2.off(); this.led3.off(); }, storage.get('startDelay') * 1000);
	}

	roundFinish(cars) {
		// turn on winner car led
		let rLaps = storage.get('roundLaps');
		let finishCars = _.filter(cars, (c) => { return !c.outOfBounds && c.lapCount == rLaps + 1 });
		utils.delay(() => {
			_.each(finishCars, (c) => {
				if (c.position == 1) {
					this.leds[this.laneIndex(c.startLane)].on();
				}
			})
		}, 1500);
	}

	lap(lane) {
		// flash lane led for 1 sec
		if (this.ready) {
			lane = this.laneIndex(lane);
			let led = this.leds[lane];
			led.on();
			utils.delay(() => { led.off(); }, 1000);
		}
	}
}

module.exports = LedManagerLilypad;
