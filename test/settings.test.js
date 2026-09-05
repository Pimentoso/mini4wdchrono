'use strict';

const { afterEach, describe, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { createJsonStore, createSettingsStore } = require('../js/settings');

const temporaryDirectories = [];

// Creates an isolated settings file path for one test.
const createTemporarySettingsPath = async () => {
    const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'mini4wdchrono-settings-'));
    temporaryDirectories.push(directory);
    return path.join(directory, 'settings.json');
};

// Removes all settings fixtures created by completed tests.
afterEach(async () => {
    await Promise.all(temporaryDirectories.splice(0).map(directory =>
        fs.promises.rm(directory, { recursive: true, force: true })
    ));
});

describe('settings store', () => {
    test('reads legacy settings without changing their JSON structure', async () => {
        const filePath = await createTemporarySettingsPath();
        const legacySettings = {
            raceFile: '1666541866.json',
            usbPort: '/dev/tty.usbserial-01',
            legacyOption: { retained: true }
        };
        await fs.promises.writeFile(filePath, JSON.stringify(legacySettings, null, 2), 'utf8');

        const settings = createSettingsStore({ filePath: filePath, defaults: { title: 'MINI4WD CHRONO' } });
        await settings.initialize();

        assert.equal(settings.get('raceFile'), legacySettings.raceFile);
        assert.equal(settings.get('title'), 'MINI4WD CHRONO');
        assert.deepEqual(JSON.parse(await fs.promises.readFile(filePath, 'utf8')), legacySettings);

        await settings.set('title', 'Race Night');

        assert.deepEqual(JSON.parse(await fs.promises.readFile(filePath, 'utf8')), {
            ...legacySettings,
            title: 'Race Night'
        });
    });

    test('serializes concurrent updates into one complete settings document', async () => {
        const filePath = await createTemporarySettingsPath();
        const settings = createSettingsStore({ filePath: filePath, defaults: {} });
        await settings.initialize();

        await Promise.all(Array.from({ length: 100 }, (_value, index) =>
            settings.set(`setting${index}`, index)
        ));

        const savedSettings = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        assert.equal(Object.keys(savedSettings).length, 100);
        assert.equal(savedSettings.setting0, 0);
        assert.equal(savedSettings.setting99, 99);
    });

    test('persists race-style nested updates without losing concurrent results', async () => {
        const filePath = await createTemporarySettingsPath();
        const race = createJsonStore({
            filePath: filePath,
            initialData: { name: 'Race Night', race: {} }
        });
        await race.save();

        await Promise.all(Array.from({ length: 20 }, (_value, index) => race.update((data) => {
            data.race[`round${index}`] = { position: index + 1 };
        })));

        const savedRace = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
        assert.equal(savedRace.name, 'Race Night');
        assert.equal(Object.keys(savedRace.race).length, 20);
        assert.deepEqual(savedRace.race.round19, { position: 20 });
    });

    test('removes settings while keeping defaults out of the persisted document', async () => {
        const filePath = await createTemporarySettingsPath();
        await fs.promises.writeFile(filePath, JSON.stringify({ title: 'Custom', usbPort: '/dev/test' }), 'utf8');
        const settings = createSettingsStore({ filePath: filePath, defaults: { title: 'Default', reverse: 0 } });
        await settings.initialize();

        await settings.del('title');

        assert.equal(settings.get('title'), 'Default');
        assert.equal(settings.get('reverse'), 0);
        assert.deepEqual(JSON.parse(await fs.promises.readFile(filePath, 'utf8')), { usbPort: '/dev/test' });
    });

    test('backs up and clears settings without retaining stale in-memory values', async () => {
        const filePath = await createTemporarySettingsPath();
        const backupPath = `${filePath}.bak`;
        const originalSettings = { raceFile: '123.json', usbPort: '/dev/test' };
        await fs.promises.writeFile(filePath, JSON.stringify(originalSettings), 'utf8');
        const settings = createSettingsStore({ filePath: filePath, defaults: { tab: 'setup' } });
        await settings.initialize();

        await settings.reset(backupPath);

        assert.deepEqual(JSON.parse(await fs.promises.readFile(backupPath, 'utf8')), originalSettings);
        await assert.rejects(fs.promises.access(filePath), { code: 'ENOENT' });
        assert.equal(settings.get('raceFile'), undefined);
        assert.equal(settings.get('tab'), 'setup');
    });

    test('rejects malformed settings without overwriting the file', async () => {
        const filePath = await createTemporarySettingsPath();
        const malformedJson = '{"usbPort":"/dev/test"}}';
        await fs.promises.writeFile(filePath, malformedJson, 'utf8');
        const settings = createSettingsStore({ filePath: filePath, defaults: {} });

        await assert.rejects(settings.initialize(), SyntaxError);
        assert.equal(await fs.promises.readFile(filePath, 'utf8'), malformedJson);
    });
});
