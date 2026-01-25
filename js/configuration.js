'use strict';

// Phase 2: All settings operations now use IPC via electronAPI
// This renderer-side module acts as a client to main-process config handlers

/**
 * Initializes configuration system
 * Calls config-init handler in main process
 * @returns {Promise<void>}
 */
const init = async () => {
    try {
        await window.electronAPI.configInit();
    } catch (error) {
        console.error('Error initializing configuration:', error);
        throw error;
    }
};

/**
 * Resets configuration to defaults with backup
 * @returns {Promise<string>} - Path to backup file
 */
const reset = async () => {
    try {
        return await window.electronAPI.configReset();
    } catch (error) {
        console.error('Error resetting configuration:', error);
        throw error;
    }
};

/**
 * Sets a configuration value
 * @param {string} settingKey - Setting key name
 * @param {any} settingValue - Value to set
 * @returns {Promise<void>}
 */
const set = async (settingKey, settingValue) => {
    try {
        await window.electronAPI.configSet(settingKey, settingValue);
    } catch (error) {
        console.error(`Error setting config ${settingKey}:`, error);
        throw error;
    }
};

/**
 * Gets a configuration value
 * @param {settingKey} settingKey - Setting key name
 * @returns {Promise<any>} - Setting value
 */
const get = async (settingKey) => {
    try {
        return await window.electronAPI.configGet(settingKey);
    } catch (error) {
        console.error(`Error getting config ${settingKey}:`, error);
        throw error;
    }
};

/**
 * Deletes a configuration value
 * @param {string} settingKey - Setting key name
 * @returns {Promise<void>}
 */
const del = async (settingKey) => {
    try {
        await window.electronAPI.configDel(settingKey);
    } catch (error) {
        console.error(`Error deleting config ${settingKey}:`, error);
        throw error;
    }
};

module.exports = {
    init: init,
    reset: reset,
    set: set,
    get: get,
    del: del
};
