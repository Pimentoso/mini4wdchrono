'use strict';

const LedManager = require('./led_manager');

// Mock led manager. Does nothing.
class LedManagerMock extends LedManager {
	constructor(board, pinBuzzer) {
		super(board, pinBuzzer);
	}

	static getInstance(board, pinBuzzer) {
		if (!!LedManagerMock.instance) {
      return LedManagerMock.instance;
    }

		LedManagerMock.instance = new LedManagerMock(board, pinBuzzer);
		return LedManagerMock.instance;
	}

	roundStart(startTimerCallback) { }

	roundFinish(cars) { }

	lap(lane) { }
}

module.exports = LedManagerMock;
