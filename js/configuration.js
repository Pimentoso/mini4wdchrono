'use strict';

// This renderer-side module provides both async and sync-like access to config
// by keeping a local cache hydrated from the main process.

const CONFIG_KEYS = [
    'ledAnimation',
    'ledType',
    'sensorPin1',
    'sensorPin2',
    'sensorPin3',
    'ledPin1',
    'ledPin2',
    'ledPin3',
    'piezoPin',
    'startButtonPin',
    'reverse',
    'title',
    'tab',
    'usbPort',
    'raceFile'
];

const cachedConfig = {};
let cacheReady = false;

// Removes every value from the local configuration cache.
const clearCache = () => {
    _.each(_.keys(cachedConfig), (key) => {
        delete cachedConfig[key];
    });
};

// Replaces cached configuration with the supplied values.
const replaceCachedConfig = (values) => {
    clearCache();
    _.extend(cachedConfig, values || {});
};

// Loads all supported configuration values from the main process.
const hydrateCache = async () => {
    const values = {};

    await Promise.all(CONFIG_KEYS.map(async (key) => {
        values[key] = await window.electronAPI.configGet(key);
    }));

    replaceCachedConfig(values);
};

// Initializes the configuration cache from main-process values.
const initAsync = async () => {
    try {
        if (!window.electronAPI) {
            throw new Error('window.electronAPI is not available. Preload script may not have run.');
        }

        cacheReady = false;
        await window.electronAPI.configInit();
        await hydrateCache();
        cacheReady = true;
    } catch (error) {
        console.error('[Configuration] Failed to initialize cache:', error);
        throw error;
    }
};

// Reports whether the configuration cache can serve a setting.
const ensureCacheReady = (settingKey) => {
    if (!cacheReady) {
        console.warn(`[Configuration] Cache not ready for key: ${settingKey}`);
        return false;
    }

    return true;
};

// Retrieves a configuration value directly from the main process.
const getAsync = async (settingKey) => {
    try {
        return await window.electronAPI.configGet(settingKey);
    } catch (error) {
        console.error('[Configuration] Failed to get value:', { settingKey: settingKey, error: error });
        throw error;
    }
};

// Retrieves a configuration value from the local cache.
const get = (settingKey) => {
    if (!ensureCacheReady(settingKey)) {
        return null;
    }

    return cachedConfig[settingKey];
};

// Persists a configuration value and updates the local cache.
const setAsync = async (settingKey, settingValue) => {
    await window.electronAPI.configSet(settingKey, settingValue);
    cachedConfig[settingKey] = settingValue;
};

// Updates cached configuration before persisting it in the background.
const set = (settingKey, settingValue) => {
    cachedConfig[settingKey] = settingValue;
    setAsync(settingKey, settingValue).catch(async (error) => {
        console.error('[Configuration] Failed to save value:', { settingKey: settingKey, error: error });
        try {
            await hydrateCache();
        } catch (rehydrateError) {
            console.error('[Configuration] Failed to rehydrate cache:', rehydrateError);
        }
    });
};

// Deletes a configuration value from persistence and the cache.
const delAsync = async (settingKey) => {
    await window.electronAPI.configDel(settingKey);
    delete cachedConfig[settingKey];
};

// Deletes a cached setting before removing it in the background.
const del = (settingKey) => {
    delete cachedConfig[settingKey];
    delAsync(settingKey).catch(async (error) => {
        console.error('[Configuration] Failed to delete value:', { settingKey: settingKey, error: error });
        try {
            await hydrateCache();
        } catch (rehydrateError) {
            console.error('[Configuration] Failed to rehydrate cache:', rehydrateError);
        }
    });
};

// Resets persisted configuration and rehydrates the cache.
const reset = async () => {
    try {
        cacheReady = false;
        const backupPath = await window.electronAPI.configReset();
        await hydrateCache();
        cacheReady = true;
        return backupPath;
    } catch (error) {
        console.error('[Configuration] Failed to reset:', error);
        throw error;
    }
};

module.exports = {
    initAsync: initAsync,
    reset: reset,
    get: get,
    getAsync: getAsync,
    set: set,
    setAsync: setAsync,
    del: del,
    delAsync: delAsync
};
