'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Loads a fresh configuration module using the supplied IPC mock.
const loadConfiguration = (electronAPI) => {
    global.window = {
        electronAPI: electronAPI,
        addEventListener: () => {}
    };
    delete require.cache[require.resolve('../js/configuration')];
    return require('../js/configuration');
};

// Removes renderer globals and module state after every test.
afterEach(() => {
    delete global.window;
    delete require.cache[require.resolve('../js/configuration')];
});

// Creates an IPC mock backed by a plain settings object.
const createElectronApi = (initialSettings = {}) => {
    const settings = { ...initialSettings };
    const calls = { init: 0, get: [], set: [], del: [], reset: 0 };

    return {
        calls: calls,
        settings: settings,
        api: {
            configInit: async () => {
                calls.init += 1;
            },
            configGet: async (key) => {
                calls.get.push(key);
                return settings[key];
            },
            configSet: async (key, value) => {
                calls.set.push([key, value]);
                settings[key] = value;
            },
            configDel: async (key) => {
                calls.del.push(key);
                delete settings[key];
            },
            configReset: async () => {
                calls.reset += 1;
                Object.keys(settings).forEach((key) => delete settings[key]);
                return '/tmp/settings.json.bak';
            }
        }
    };
};

describe('configuration cache', () => {
    test('hydrates supported settings through IPC and serves synchronous reads', async () => {
        const mock = createElectronApi({ title: 'Race Night', sensorPin1: 9 });
        const configuration = loadConfiguration(mock.api);

        await configuration.initAsync();

        assert.equal(mock.calls.init, 1);
        assert.equal(configuration.get('title'), 'Race Night');
        assert.equal(configuration.get('sensorPin1'), 9);
        assert.equal(mock.calls.get.length, 15);
    });

    test('updates the cache and persists a setting before invoking its callback', async () => {
        const mock = createElectronApi({ title: 'Before' });
        const configuration = loadConfiguration(mock.api);
        await configuration.initAsync();

        await new Promise((resolve, reject) => {
            configuration.set('title', 'After', (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        });

        assert.equal(configuration.get('title'), 'After');
        assert.deepEqual(mock.calls.set, [['title', 'After']]);
        assert.equal(mock.settings.title, 'After');
    });

    test('rehydrates the cache when an asynchronous save fails', async () => {
        const mock = createElectronApi({ title: 'Persisted' });
        mock.api.configSet = async () => {
            throw new Error('disk full');
        };
        const configuration = loadConfiguration(mock.api);
        await configuration.initAsync();

        const error = await new Promise((resolve) => {
            configuration.set('title', 'Unsaved', resolve);
        });

        assert.match(error.message, /disk full/);
        assert.equal(configuration.get('title'), 'Persisted');
    });

    test('resets persistence and rehydrates the cached settings', async () => {
        const mock = createElectronApi({ title: 'Before reset' });
        const configuration = loadConfiguration(mock.api);
        await configuration.initAsync();

        const backupPath = await configuration.reset();

        assert.equal(backupPath, '/tmp/settings.json.bak');
        assert.equal(mock.calls.reset, 1);
        assert.equal(configuration.get('title'), undefined);
    });
});
