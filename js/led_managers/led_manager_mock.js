'use strict';

const LedManager = require('./led_manager');

// Mock led manager. Does nothing.
class LedManagerMock extends LedManager {
	constructor(board, pinBuzzer, reverse) {
		super(board, pinBuzzer, reverse);
	}

	static getInstance(board, pinBuzzer) {
		if (!!LedManagerMock.instance) {
      return LedManagerMock.instance;
    }

		LedManagerMock.instance = new LedManagerMock(board, pinBuzzer);
		return LedManagerMock.instance;
	}

	roundStart(_animationType, _startTimerCallback) { }

	roundFinish(_cars) { }

	lap(_lane) { }
}

module.exports = LedManagerMock;
