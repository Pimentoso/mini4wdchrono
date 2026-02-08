'use strict';

const LedManager = require('./led_manager');

// Mock led manager. Does nothing.
class LedManagerMock extends LedManager {
    constructor(pinBuzzer, reverse) {
        super(pinBuzzer, reverse);
    }

    static getInstance(pinBuzzer) {
        if (LedManagerMock.instance) {
            return LedManagerMock.instance;
        }

        LedManagerMock.instance = new LedManagerMock(pinBuzzer);
        return LedManagerMock.instance;
    }

    roundStart(_animationType, _startTimerCallback) { }

    roundFinish(_cars) { }

    lap(_lane) { }
}

module.exports = LedManagerMock;
