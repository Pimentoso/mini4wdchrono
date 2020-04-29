'use strict';

const LedManager = require('./led_manager');

// Mock led manager. Does nothing.
class LedManagerMock extends LedManager {
	constructor(board, pinBuzzer) {
		super(board, pinBuzzer);
	}

	roundStart(startTimerCallback) { }

	roundFinish(cars) { }

	lap(lane) { }
}

module.exports = LedManagerMock;
