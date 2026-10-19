'use strict';

const {
    afterEach,
    describe,
    test
} = require('node:test');
const assert = require('node:assert/strict');

const storage = require('../js/storage');

const originalStorageGet = storage.get;

// Loads a fresh LED manager whose green-light animation succeeds or fails.
const loadLedManager = (animationError) => {
    global.window = {
        electronAPI: {
            hardwareRunLedAnimation: async () => {
                if (animationError) {
                    throw animationError;
                }
            }
        }
    };
    storage.get = () => 0;
    delete require.cache[require.resolve('../js/led_manager')];
    const LedManager = require('../js/led_manager');
    LedManager.instance = null;
    return LedManager.getInstance(0, 0, false);
};

afterEach(() => {
    delete global.window;
    storage.get = originalStorageGet;
    delete require.cache[require.resolve('../js/led_manager')];
});

describe('led manager start sequence', () => {
    test('starts the race once the green light is shown', async () => {
        const ledManager = loadLedManager();
        const calls = [];

        await ledManager.greenLight(0, () => calls.push('start'), () => calls.push('failed'));

        assert.deepEqual(calls, ['start']);
    });

    test('reports a failed start when the green light cannot be shown', async () => {
        const ledManager = loadLedManager(new Error('LED manager not initialized'));
        const calls = [];

        await ledManager.greenLight(0, () => calls.push('start'), (error) => calls.push(error.message));

        assert.deepEqual(calls, ['LED manager not initialized']);
    });
});
