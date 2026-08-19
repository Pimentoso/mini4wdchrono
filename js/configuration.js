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

const clearCache = () => {
    _.each(_.keys(cachedConfig), (key) => {
        delete cachedConfig[key];
    });
};

const replaceCachedConfig = (values) => {
    clearCache();
    _.extend(cachedConfig, values || {});
};

const hydrateCache = async () => {
    const values = {};

    await Promise.all(CONFIG_KEYS.map(async (key) => {
        values[key] = await window.electronAPI.configGet(key);
    }));

    replaceCachedConfig(values);
};

/**
 * Initializes configuration cache from main process values.
 * @returns {Promise<void>}
 */
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

const ensureCacheReady = (settingKey) => {
    if (!cacheReady) {
        console.warn(`[Configuration] Cache not ready for key: ${settingKey}`);
        return false;
    }

    return true;
};

/**
 * Gets a configuration value.
 * @param {string} settingKey - Setting key name
 * @returns {Promise<any>} - Setting value
 */
const getAsync = async (settingKey) => {
    try {
        return await window.electronAPI.configGet(settingKey);
    } catch (error) {
        console.error('[Configuration] Failed to get value:', { settingKey: settingKey, error: error });
        throw error;
    }
};

/**
 * Gets a configuration value from local cache.
 * @param {string} settingKey - Setting key name
 * @returns {any} - Cached setting value
 */
const get = (settingKey) => {
    if (!ensureCacheReady(settingKey)) {
        return null;
    }

    return cachedConfig[settingKey];
};

/**
 * Sets a configuration value.
 * @param {string} settingKey - Setting key name
 * @param {any} settingValue - Value to set
 * @returns {Promise<void>}
 */
const setAsync = async (settingKey, settingValue) => {
    await window.electronAPI.configSet(settingKey, settingValue);
    cachedConfig[settingKey] = settingValue;
};

/**
 * Sets a configuration value in cache, then persists in background.
 * On failure, rehydrate cache from main process.
 * @param {string} settingKey - Setting key name
 * @param {any} settingValue - Value to set
 */
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

/**
 * Deletes a configuration value.
 * @param {string} settingKey - Setting key name
 * @returns {Promise<void>}
 */
const delAsync = async (settingKey) => {
    await window.electronAPI.configDel(settingKey);
    delete cachedConfig[settingKey];
};

/**
 * Deletes a configuration value from cache, then persists in background.
 * On failure, rehydrate cache from main process.
 * @param {string} settingKey - Setting key name
 */
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

/**
 * Resets configuration to defaults with backup, then rehydrates cache.
 * @returns {Promise<string>} - Path to backup file
 */
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
