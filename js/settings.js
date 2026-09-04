'use strict';

const fs = require('fs');
const path = require('path');

// Creates a JSON-backed settings store with serialized atomic writes.
const createSettingsStore = ({ filePath, defaults }) => {
    let data = null;
    let initialization = null;
    let writeQueue = Promise.resolve();
    let writeSequence = 0;

    // Initializes the in-memory settings object from the existing JSON file.
    const initialize = async () => {
        if (data) {
            return;
        }

        if (!initialization) {
            initialization = (async () => {
                await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
                let storedData = {};

                try {
                    storedData = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error;
                    }
                }

                if (!storedData || Array.isArray(storedData) || typeof storedData !== 'object') {
                    throw new Error('[Settings] settings.json must contain an object');
                }

                data = storedData;
            })().finally(() => {
                initialization = null;
            });
        }

        await initialization;
    };

    // Serializes writes and leaves the queue usable if a write fails.
    const queueWrite = (writeOperation) => {
        const queuedWrite = writeQueue.then(writeOperation, writeOperation);
        writeQueue = queuedWrite.catch(() => {});
        return queuedWrite;
    };

    // Persists the full settings object through a temporary file and rename.
    const saveAtomically = async () => {
        const temporaryPath = `${filePath}.${process.pid}.${++writeSequence}.tmp`;

        try {
            await fs.promises.writeFile(temporaryPath, JSON.stringify(data, null, 2), 'utf8');
            await fs.promises.rename(temporaryPath, filePath);
        } catch (error) {
            await fs.promises.unlink(temporaryPath).catch(() => {});
            throw error;
        }
    };

    // Applies one mutation after preceding settings writes have completed.
    const update = async (mutation) => {
        await initialize();
        await queueWrite(async () => {
            mutation(data);
            await saveAtomically();
        });
    };

    // Returns a stored value or its in-code default without changing disk data.
    const get = (key) => {
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }

        return defaults[key];
    };

    // Saves one top-level setting value.
    const set = async (key, value) => {
        await update((settings) => {
            settings[key] = value;
        });
    };

    // Removes one top-level setting value.
    const del = async (key) => {
        await update((settings) => {
            delete settings[key];
        });
    };

    // Backs up and clears settings without allowing writes to interleave.
    const reset = async (backupPath) => {
        await initialize();
        await queueWrite(async () => {
            try {
                await fs.promises.copyFile(filePath, backupPath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            try {
                await fs.promises.unlink(filePath);
            } catch (error) {
                if (error.code !== 'ENOENT') {
                    throw error;
                }
            }

            data = {};
        });
    };

    return {
        initialize: initialize,
        get: get,
        set: set,
        del: del,
        reset: reset
    };
};

module.exports = { createSettingsStore: createSettingsStore };
