'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');

const MODULES = [
    '../js/configuration',
    '../js/storage',
    '../js/companion_auth',
    '../js/companion_api'
];

// Returns an independent copy of JSON-compatible race data.
const clone = (value) => JSON.parse(JSON.stringify(value));

// Gets a nested value using the same dot-separated keys as the storage IPC API.
const getNested = (data, key) => key.split('.').reduce((current, part) => {
    return current === undefined || current === null ? undefined : current[part];
}, data);

// Creates a jQuery stub that records every request and answers it immediately.
const createAjaxStub = () => {
    const requests = [];
    const failures = [];

    return {
        requests: requests,
        // Makes the next request answer with an error instead of a success.
        failNext: () => failures.push(true),
        // Reads back the JSON body a recorded request was sent with.
        bodyOf: (index) => JSON.parse(requests[index].data),
        jquery: {
            ajax: (options) => {
                requests.push(options);
                if (failures.shift()) {
                    if (options.error) options.error({}, 'error', 'Bad Request');
                    return;
                }
                if (options.success) options.success(options.responseStub || { success: true, data: {} });
            }
        }
    };
};

// Creates an in-memory IPC backend holding one race file and its settings.
const createElectronApi = ({ settings = {}, race = {}, version = '2.0.0' } = {}) => {
    // A configured race file keeps storage on its load path instead of creating one.
    const persistedSettings = { raceFile: 'race.json', ...settings };
    const persistedRace = clone(race);

    return {
        settings: persistedSettings,
        api: {
            getAppVersion: async () => version,
            configInit: async () => {},
            configGet: async (key) => persistedSettings[key],
            configSet: async (key, value) => {
                persistedSettings[key] = value;
            },
            configDel: async (key) => {
                delete persistedSettings[key];
            },
            storageLoadRace: async () => {},
            storageGetAll: async () => clone(persistedRace),
            storageGet: async (key) => getNested(persistedRace, key),
            storageListRaces: async () => [],
            openExternal: async () => {},
            onCompanionAuthCallback: () => {}
        }
    };
};

// Loads fresh renderer modules against the supplied IPC backend and jQuery stub.
const loadModules = (electronAPI, jquery) => {
    global.window = { electronAPI: electronAPI, addEventListener: () => {} };
    global.$ = jquery;
    MODULES.forEach((name) => delete require.cache[require.resolve(name)]);
    return {
        configuration: require('../js/configuration'),
        storage: require('../js/storage'),
        auth: require('../js/companion_auth'),
        api: require('../js/companion_api')
    };
};

// Clears renderer globals and module state after every test.
afterEach(() => {
    delete global.window;
    delete global.$;
    MODULES.forEach((name) => delete require.cache[require.resolve(name)]);
});

// A three manche tournament plus a finalina and a final, as stored on disk.
const tournamentRace = {
    tournament: {
        code: 'ABC123',
        players: ['Ada', 'Bruno', 'Carla', 'Dino', 'Eva', 'Fabio'],
        mancheCount: 3,
        manches: [
            [[0, 1, 2]],
            [[2, 0, 1]],
            [[1, 2, 0]]
        ],
        finals: [
            [[3, 4, 5]],
            [[0, 1, 2]]
        ]
    },
    race: {
        m0: {
            r0: [
                { playerId: 0, currTime: 7250, outOfBounds: false },
                { playerId: 1, currTime: 99999, outOfBounds: true },
                { playerId: 2, currTime: 7810, outOfBounds: false }
            ]
        }
    }
};

// Boots configuration, storage and the Companion API against a loaded race.
const bootWithRace = async (race, { settings, version } = {}) => {
    const ajax = createAjaxStub();
    const backend = createElectronApi({ race: race, settings: settings, version: version });
    const modules = loadModules(backend.api, ajax.jquery);

    await modules.configuration.initAsync();
    await modules.storage.initAsync();
    modules.auth.init();
    await modules.api.initAsync();

    return { ...modules, ajax: ajax, backend: backend };
};

describe('companion round submission', () => {
    test('reports lap times in seconds and flags cars that did not finish', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        api.submitRoundResult(0, 0);

        assert.equal(ajax.requests.length, 1);
        assert.equal(ajax.requests[0].url, 'https://mini4wd-companion.com/api/v1/public/tournament/ABC123/heats');
        assert.equal(ajax.requests[0].type, 'POST');
        assert.deepEqual(ajax.bodyOf(0).results, [
            { car_name: 'Ada', lap_time: 7.25, is_dnf: false },
            { car_name: 'Bruno', lap_time: null, is_dnf: true },
            { car_name: 'Carla', lap_time: 7.81, is_dnf: false }
        ]);
    });

    test('treats the sentinel time as a retirement even without the out of bounds flag', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[1] = { playerId: 1, currTime: 99999, outOfBounds: false };
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[1], { car_name: 'Bruno', lap_time: null, is_dnf: true });
    });

    test('numbers manches from one and skips empty lanes', async () => {
        const race = clone(tournamentRace);
        race.race.m1 = { r0: [
            { playerId: 2, currTime: 7000, outOfBounds: false },
            { playerId: -1, currTime: 0, outOfBounds: false },
            { playerId: 1, currTime: 7100, outOfBounds: false }
        ] };
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(1, 0);

        assert.equal(ajax.bodyOf(0).manche_number, 2);
        assert.deepEqual(ajax.bodyOf(0).results.map((r) => r.car_name), ['Carla', 'Bruno']);
    });

    test('sends the access token and the chrono version as headers', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace, {
            settings: { companionToken: 'token-42', companionUser: { role: 'organizer' } },
            version: '2.0.0'
        });

        api.submitRoundResult(0, 0);

        assert.equal(ajax.requests[0].headers['Authorization'], 'Bearer token-42');
        assert.equal(ajax.requests[0].headers['X-Chrono-Version'], '2.0.0');
    });

    test('does nothing for a tournament that did not come from Companion', async () => {
        const race = clone(tournamentRace);
        delete race.tournament.code;
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.equal(ajax.requests.length, 0);
    });

    test('reports the split times in seconds for cars that finished', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[0], {
            car_name: 'Ada', lap_time: 7.25, is_dnf: false, split_times: [2.401, 2.399, 2.45]
        });
    });

    test('omits the split times of cars without splits', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[1].splitTimes = [];
        race.race.m0.r0[2].splitTimes = [];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.equal('split_times' in ajax.bodyOf(0).results[1], false);
        assert.equal('split_times' in ajax.bodyOf(0).results[2], false);
    });

    test('reports the laps a car completed before it went out', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[1].splitTimes = [2401, 2399];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[1], {
            car_name: 'Bruno', lap_time: null, is_dnf: true, split_times: [2.401, 2.399]
        });
    });

    test('keeps the split times of a car disqualified after the race', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[0] = { playerId: 0, currTime: 99999, originalTime: 7250, outOfBounds: true, splitTimes: [2401, 2399, 2450] };
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[0].split_times, [2.401, 2.399, 2.45]);
    });

    test('omits the split times of cars whose time was edited by hand', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        race.race.m0.r0[0].originalTime = 7300;
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[0], { car_name: 'Ada', lap_time: 7.25, is_dnf: false });
    });

    test('does nothing for a round that has no stored results', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        api.submitRoundResult(2, 0);

        assert.equal(ajax.requests.length, 0);
    });

    test('reports the lane of every lap following the track lane order', async () => {
        const race = clone(tournamentRace);
        race.track = { length: 160, order: [1, 2, 3] };
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        race.race.m0.r0[2].splitTimes = [2600, 2600, 2610];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        // Ada starts in lane 1 and Carla in lane 3: both rotate 1-2-3-1.
        // results[1] is Bruno, who retired.
        assert.deepEqual(ajax.bodyOf(0).results[0].split_lanes, [1, 2, 3]);
        assert.deepEqual(ajax.bodyOf(0).results[2].split_lanes, [3, 1, 2]);
    });

    test('follows a reversed track lane order', async () => {
        const race = clone(tournamentRace);
        race.track = { length: 160, order: [1, 3, 2] };
        race.race.m0.r0[2].splitTimes = [2600, 2600, 2610];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        // Carla starts in lane 3, which sits second in a 1-3-2-1 rotation.
        assert.deepEqual(ajax.bodyOf(0).results[2].split_lanes, [3, 2, 1]);
    });

    test('keeps a car in its own lane on a same-lane track', async () => {
        const race = clone(tournamentRace);
        race.track = { length: 160, order: [1, 1, 1] };
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        race.race.m0.r0[2].splitTimes = [2600, 2600, 2610];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.deepEqual(ajax.bodyOf(0).results[0].split_lanes, [1, 1, 1]);
        assert.deepEqual(ajax.bodyOf(0).results[2].split_lanes, [3, 3, 3]);
    });

    test('omits the lanes when the track lane order is unknown', async () => {
        const race = clone(tournamentRace);
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.equal('split_lanes' in ajax.bodyOf(0).results[0], false);
    });

    test('omits the lanes of a car whose splits were dropped', async () => {
        const race = clone(tournamentRace);
        race.track = { length: 160, order: [1, 2, 3] };
        race.race.m0.r0[0].splitTimes = [2401, 2399, 2450];
        race.race.m0.r0[0].originalTime = 7300;
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(0, 0);

        assert.equal('split_lanes' in ajax.bodyOf(0).results[0], false);
    });
});

describe('companion finals tagging', () => {
    test('tags the first of two brackets as the finalina and the last as the final', async () => {
        const race = clone(tournamentRace);
        race.race.m3 = { r0: [{ playerId: 3, currTime: 7000, outOfBounds: false }] };
        race.race.m4 = { r0: [{ playerId: 0, currTime: 6900, outOfBounds: false }] };
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(3, 0);
        api.submitRoundResult(4, 0);

        assert.deepEqual(
            { round_type: ajax.bodyOf(0).round_type, bracket: ajax.bodyOf(0).finals_bracket, round: ajax.bodyOf(0).finals_round_number },
            { round_type: 'final', bracket: 'finalina', round: 1 }
        );
        assert.equal(ajax.bodyOf(1).finals_bracket, 'final');
    });

    test('tags a single bracket as the final', async () => {
        const race = clone(tournamentRace);
        race.tournament.finals = [[[0, 1, 2]]];
        race.race.m3 = { r0: [{ playerId: 0, currTime: 7000, outOfBounds: false }] };
        const { api, ajax } = await bootWithRace(race);

        api.submitRoundResult(3, 0);

        assert.equal(ajax.bodyOf(0).finals_bracket, 'final');
    });

    test('leaves qualifying rounds untagged', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        api.submitRoundResult(0, 0);

        assert.equal(ajax.bodyOf(0).round_type, undefined);
        assert.equal(ajax.bodyOf(0).finals_bracket, undefined);
    });
});

describe('companion submission de-duplication', () => {
    test('does not resend a round whose results have not changed', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        api.submitRoundResult(0, 0);
        api.submitRoundResult(0, 0);

        assert.equal(ajax.requests.length, 1);
    });

    test('resends a round after a failed submission', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        ajax.failNext();
        api.submitRoundResult(0, 0);
        api.submitRoundResult(0, 0);

        assert.equal(ajax.requests.length, 2);
    });

    test('submits every stored round and skips the rounds never raced', async () => {
        const race = clone(tournamentRace);
        race.race.m2 = { r0: [{ playerId: 1, currTime: 7400, outOfBounds: false }] };
        const { api, ajax } = await bootWithRace(race);

        api.submitAllCompletedRounds();

        assert.deepEqual(ajax.requests.map((_r, i) => ajax.bodyOf(i).manche_number), [1, 3]);
    });
});

describe('companion version check', () => {
    test('unwraps the payload and reports the status', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace, { version: '2.0.0' });

        let received = null;
        ajax.jquery.ajax = (options) => {
            ajax.requests.push(options);
            options.success({ success: true, data: { status: 'blocked', min_version: '3.0.0' } });
        };
        api.checkVersion((data) => { received = data; });

        assert.match(ajax.requests[0].url, /version-check\?version=2\.0\.0$/);
        assert.deepEqual(received, { status: 'blocked', min_version: '3.0.0' });
    });

    test('reports null when the server cannot be reached', async () => {
        const { api, ajax } = await bootWithRace(tournamentRace);

        let received = 'untouched';
        ajax.failNext();
        api.checkVersion((data) => { received = data; });

        assert.equal(received, null);
    });
});
