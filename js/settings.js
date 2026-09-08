'use strict';

const fs = require('fs');
const path = require('path');

// Creates a JSON document store with serialized atomic writes.
const createJsonStore = ({ filePath, initialData = null }) => {
    let data = initialData;
    let initialization = null;
    let writeQueue = Promise.resolve();
    let writeSequence = 0;

    // Initializes the in-memory document from its existing JSON file.
    const initialize = async () => {
        if (data) {
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
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
                    throw new Error('[Storage] JSON document must contain an object');
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

    // Persists the full document through a temporary file and rename.
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

    // Applies one mutation after preceding document writes have completed.
    const update = async (mutation) => {
        await initialize();
        await queueWrite(async () => {
            mutation(data);
            await saveAtomically();
        });
    };

    // Saves the current document without changing its contents.
    const save = async () => {
        await update(() => {});
    };

    // Returns the current in-memory document after initialization.
    const getData = () => data;

    // Backs up and clears the document without allowing writes to interleave.
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
        update: update,
        save: save,
        getData: getData,
        reset: reset
    };
};

// Creates a settings-specific wrapper that supplies defaults for missing keys.
const createSettingsStore = ({ filePath, defaults }) => {
    const jsonStore = createJsonStore({ filePath: filePath });

    // Returns a stored setting or its default without changing disk data.
    const get = (key) => {
        const data = jsonStore.getData();
        if (Object.prototype.hasOwnProperty.call(data, key)) {
            return data[key];
        }

        return defaults[key];
    };

    // Saves one top-level setting value.
    const set = async (key, value) => {
        await jsonStore.update((data) => {
            data[key] = value;
        });
    };

    // Removes one top-level setting value.
    const del = async (key) => {
        await jsonStore.update((data) => {
            delete data[key];
        });
    };

    return {
        initialize: jsonStore.initialize,
        get: get,
        set: set,
        del: del,
        reset: jsonStore.reset
    };
};

module.exports = {
    createJsonStore: createJsonStore,
    createSettingsStore: createSettingsStore
};
