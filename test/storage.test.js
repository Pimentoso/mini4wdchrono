'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

// Returns an independent copy of JSON-compatible race data.
const clone = (value) => JSON.parse(JSON.stringify(value));

// Gets a nested value using the same dot-separated keys as the storage IPC API.
const getNested = (data, key) => key.split('.').reduce((current, part) => {
    return current === undefined || current === null ? undefined : current[part];
}, data);

// Stores a nested value using the same dot-separated keys as the storage IPC API.
const setNested = (data, key, value) => {
    const keys = key.split('.');
    let current = data;
    for (let index = 0; index < keys.length - 1; index++) {
        current[keys[index]] = current[keys[index]] || {};
        current = current[keys[index]];
    }
    current[keys[keys.length - 1]] = value;
};

// Removes a nested value using the same dot-separated keys as the storage IPC API.
const removeNested = (data, key) => {
    const keys = key.split('.');
    let current = data;
    for (let index = 0; index < keys.length - 1; index++) {
        current = current[keys[index]];
        if (!current) return;
    }
    delete current[keys[keys.length - 1]];
};

// Lets fire-and-forget renderer persistence calls finish in the mock IPC backend.
const flushAsyncWork = () => new Promise((resolve) => setImmediate(resolve));

// Creates an in-memory IPC backend that mirrors race and configuration operations.
const createElectronApi = ({ settings = {}, races = {} } = {}) => {
    const persistedSettings = { ...settings };
    const persistedRaces = new Map(Object.entries(races).map(([filename, race]) => [filename, clone(race)]));
    let currentFilename = null;
    let nextRaceId = 2000000000;

    return {
        settings: persistedSettings,
        races: persistedRaces,
        api: {
            configInit: async () => {},
            configGet: async (key) => persistedSettings[key],
            configSet: async (key, value) => {
                persistedSettings[key] = value;
            },
            configDel: async (key) => {
                delete persistedSettings[key];
            },
            configReset: async () => '/tmp/settings.json.bak',
            storageNewRace: async (name) => {
                const filename = `${nextRaceId++}.json`;
                persistedRaces.set(filename, {
                    name: name,
                    created: parseInt(filename, 10),
                    currManche: 0,
                    currRound: 0
                });
                currentFilename = filename;
                persistedSettings.raceFile = filename;
                return filename;
            },
            storageLoadRace: async (filename) => {
                if (!persistedRaces.has(filename)) {
                    throw new Error(`Race ${filename} does not exist`);
                }
                currentFilename = filename;
                persistedSettings.raceFile = filename;
            },
            storageGetAll: async () => clone(persistedRaces.get(currentFilename)),
            storageSet: async (key, value) => {
                setNested(persistedRaces.get(currentFilename), key, clone(value));
            },
            storageGet: async (key) => clone(getNested(persistedRaces.get(currentFilename), key)),
            storageRemove: async (key) => {
                removeNested(persistedRaces.get(currentFilename), key);
            },
            storageListRaces: async (num) => Array.from(persistedRaces.entries())
                .map(([filename, race]) => ({ filename: filename, name: race.name, created: race.created }))
                .sort((first, second) => second.created - first.created)
                .slice(0, num),
            storageDeleteRace: async (filename) => {
                persistedRaces.delete(filename);
                if (currentFilename === filename) {
                    currentFilename = null;
                    delete persistedSettings.raceFile;
                }
            }
        }
    };
};

// Loads fresh renderer persistence modules against the supplied IPC backend.
const loadStorage = (electronAPI) => {
    global.window = {
        electronAPI: electronAPI,
        addEventListener: () => {}
    };
    delete require.cache[require.resolve('../js/configuration')];
    delete require.cache[require.resolve('../js/storage')];
    const configuration = require('../js/configuration');
    const storage = require('../js/storage');
    return { configuration: configuration, storage: storage };
};

// Clears renderer globals and module state after every test.
afterEach(() => {
    delete global.window;
    delete require.cache[require.resolve('../js/configuration')];
    delete require.cache[require.resolve('../js/storage')];
});

describe('race storage renderer integration', () => {
    test('loads the configured race and exposes its cached data and recent files', async () => {
        const backend = createElectronApi({
            settings: { raceFile: '100.json' },
            races: {
                '100.json': { name: 'Morning Race', created: 100, currManche: 2, currRound: 1 },
                '200.json': { name: 'Evening Race', created: 200 }
            }
        });
        const { configuration, storage } = loadStorage(backend.api);

        await configuration.initAsync();
        await storage.initAsync();

        assert.equal(storage.get('name'), 'Morning Race');
        assert.equal(storage.get('currManche'), 2);
        assert.deepEqual(storage.getRecentFiles(), [
            { filename: '200.json', name: 'Evening Race', created: 200 },
            { filename: '100.json', name: 'Morning Race', created: 100 }
        ]);
    });

    test('creates a race, saves nested results, and removes a saved round', async () => {
        const backend = createElectronApi();
        const { configuration, storage } = loadStorage(backend.api);
        await configuration.initAsync();

        const filename = await storage.newRaceAsync('Championship Final');
        await storage.setAsync('race.m0.r1', [{ playerId: 3, currTime: 1234 }]);
        storage.deleteRound(0, 1);
        await flushAsyncWork();

        assert.equal(storage.get('name'), 'Championship Final');
        assert.equal(configuration.get('raceFile'), filename);
        assert.equal(backend.settings.raceFile, filename);
        assert.equal(storage.get('race.m0.r1'), null);
        assert.equal(getNested(backend.races.get(filename), 'race.m0.r1'), undefined);
    });

    test('deletes the selected race and clears its configured filename', async () => {
        const backend = createElectronApi({
            settings: { raceFile: '2000000300.json' },
            races: { '2000000300.json': { name: 'Saved Race', created: 2000000300 } }
        });
        const { configuration, storage } = loadStorage(backend.api);
        await configuration.initAsync();
        await storage.initAsync();

        storage.deleteRace('2000000300.json');
        await flushAsyncWork();

        assert.equal(backend.races.has('2000000300.json'), false);
        assert.equal(configuration.get('raceFile'), undefined);
        assert.equal(backend.settings.raceFile, undefined);
    });
});
