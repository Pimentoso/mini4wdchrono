'use strict';

const j5 = require('johnny-five');
const utils = require('../utils');

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
		try {
			this.board.digitalWrite(this.pinBuzzer, 0);
		} catch (e) { }
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

module.exports = LedManager;
