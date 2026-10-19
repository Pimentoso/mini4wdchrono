'use strict';

const {
    afterEach,
    describe,
    test
} = require('node:test');
const assert = require('node:assert/strict');
const EventEmitter = require('events');

const { createAutoUpdater } = require('../js/auto_updater');

const silentLog = { info: () => {}, warn: () => {} };

// Stands in for electron-updater's autoUpdater and records what it was asked to do.
const createFakeAutoUpdater = ({ checkError } = {}) => {
    const fake = new EventEmitter();
    fake.checks = 0;
    fake.installs = [];
    fake.checkForUpdates = async () => {
        fake.checks += 1;
        if (checkError) {
            throw checkError;
        }
    };
    fake.quitAndInstall = (...args) => fake.installs.push(args);
    return fake;
};

let updater = null;

// Builds an updater for the given build, keeping it so its timer can be stopped.
const setup = ({ isPackaged = true, platform = 'win32', fake = createFakeAutoUpdater(), log = silentLog } = {}) => {
    const notified = [];
    let loads = 0;
    updater = createAutoUpdater({
        app: { isPackaged: isPackaged },
        platform: platform,
        log: log,
        loadAutoUpdater: () => {
            loads += 1;
            return fake;
        },
        notify: (version) => notified.push(version)
    });
    return { fake: fake, notified: notified, loads: () => loads };
};

afterEach(() => {
    if (updater) {
        updater.stop();
        updater = null;
    }
});

describe('auto updater', () => {
    test('checks for updates on the packaged Windows build', () => {
        const { fake, loads } = setup();

        assert.equal(updater.start(), true);

        assert.equal(loads(), 1);
        assert.equal(fake.checks, 1);
        assert.equal(fake.autoDownload, true);
        assert.equal(fake.autoInstallOnAppQuit, true);
    });

    test('stays off on macOS, Linux and development builds', () => {
        const cases = [
            { isPackaged: true, platform: 'darwin' },
            { isPackaged: true, platform: 'linux' },
            { isPackaged: false, platform: 'win32' }
        ];

        cases.forEach((build) => {
            const { loads } = setup(build);
            assert.equal(updater.start(), false);
            assert.equal(loads(), 0);
        });
    });

    test('tells the renderer which version was downloaded', () => {
        const { fake, notified } = setup();
        updater.start();

        fake.emit('update-downloaded', { version: '2.2.0' });

        assert.deepEqual(notified, ['2.2.0']);
        assert.equal(updater.getDownloadedVersion(), '2.2.0');
    });

    test('installs silently and relaunches once an update is downloaded', () => {
        const { fake } = setup();
        updater.start();

        assert.equal(updater.install(), false);
        assert.deepEqual(fake.installs, []);

        fake.emit('update-downloaded', { version: '2.2.0' });

        assert.equal(updater.install(), true);
        assert.deepEqual(fake.installs, [[true, true]]);
    });

    test('only logs a failed check, so being offline at the track is harmless', async () => {
        const warnings = [];
        const log = { info: () => {}, warn: (message) => warnings.push(message) };
        const fake = createFakeAutoUpdater({ checkError: new Error('offline') });
        setup({ fake: fake, log: log });

        updater.start();
        await new Promise((resolve) => setImmediate(resolve));

        assert.deepEqual(warnings, ['[Updater] Update check failed:']);
    });

    test('does not install when updates are not supported', () => {
        setup({ platform: 'darwin' });
        updater.start();

        assert.equal(updater.install(), false);
    });
});
