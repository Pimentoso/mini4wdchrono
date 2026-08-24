'use strict';

// This module provides both async and sync-like (cached) access patterns
// for backward compatibility with existing code during transition
const configuration = require('./configuration');

// In-memory cache of current race data
const cachedRaceData = {};

let cacheReady = false;
let cachedRecentFiles = [];

// Stores a nested value in the local race-data cache.
const setCached = (key, value) => {
    const keys = key.split('.');
    let current = cachedRaceData;

    for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]]) {
            current[keys[i]] = {};
        }
        current = current[keys[i]];
    }

    current[keys[keys.length - 1]] = value;
};

// Replaces the local race-data cache with the supplied data.
const replaceCachedData = (data) => {
    _.each(_.keys(cachedRaceData), (key) => {
        delete cachedRaceData[key];
    });
    _.extend(cachedRaceData, data || {});
};

// Retrieves a nested value from the local race-data cache.
const getCached = (key) => {
    if (!cacheReady) {
        console.warn(`[Storage] Cache not ready for key: ${key}`);
        return null;
    }

    const keys = key.split('.');
    let current = cachedRaceData;

    for (let i = 0; i < keys.length; i++) {
        current = current[keys[i]];
        if (current === undefined || current === null) {
            return null;
        }
    }

    return current;
};

// Initializes persistence and populates the local race-data cache.
const initAsync = async () => {
    try {
        // Check if electronAPI is available
        if (!window.electronAPI) {
            throw new Error('window.electronAPI is not available. Preload script may not have run.');
        }

        // Initialize main process config
        await window.electronAPI.configInit();

        // Load current race file
        await loadRaceAsync();
        cachedRecentFiles = await getRecentFilesAsync(50);

        cacheReady = true;
    } catch (error) {
        console.error('[Storage] Initialization error:', error);
        throw error;
    }
};

// Creates, selects, and loads a new race asynchronously.
const newRaceAsync = async (raceName) => {
    const filename = await window.electronAPI.storageNewRace(raceName);
    configuration.set('raceFile', filename);
    await loadRaceAsync(filename);
    await getRecentFilesAsync(50);
    return filename;
};

// Creates a new race while preserving the callback-based renderer API.
const newRace = (raceName, onComplete) => {
    newRaceAsync(raceName)
        .then((filename) => {
            if (onComplete) onComplete(filename);
        })
        .catch(err => console.error('[Race setup] New race creation failed:', err));
};

// Loads the selected race and refreshes the local cache.
const loadRaceAsync = async (filename) => {
    if (!filename) {
        filename = configuration.get('raceFile');
    }

    if (filename) {
        // Retrocompatibility: trim filename if needed
        filename = filename.slice(-15);
        await window.electronAPI.storageLoadRace(filename);
        configuration.set('raceFile', filename);
        replaceCachedData(await window.electronAPI.storageGetAll());
        cacheReady = true;
    } else {
        // No race file, create a new one
        await newRaceAsync('Unnamed Race');
    }
};

// Loads a race while preserving the callback-based renderer API.
const loadRace = (filename, onComplete) => {
    loadRaceAsync(filename)
        .then(() => {
            if (onComplete) onComplete();
        })
        .catch(err => console.error('[Race setup] Race open failed:', { filename: filename, error: err }));
};

// Deletes a persisted race and clears it if it is selected.
const deleteRaceAsync = async (filename) => {
    await window.electronAPI.storageDeleteRace(filename);
    if (filename === configuration.get('raceFile')) {
        configuration.del('raceFile');
    }
};

// Deletes a race without exposing asynchronous persistence to callers.
const deleteRace = (filename) => {
    deleteRaceAsync(filename).catch(err => console.error('[Storage] Failed to delete race:', { filename: filename, error: err }));
};

// Retrieves and caches the most recent race files.
const getRecentFilesAsync = async (num) => {
    num = num || 10;
    const recent = await window.electronAPI.storageListRaces(num);
    cachedRecentFiles = _.sortBy(recent, 'created').reverse().slice(0, num);
    return cachedRecentFiles;
};

// Returns cached recent races while refreshing them in the background.
const getRecentFiles = (num) => {
    num = num || 10;
    getRecentFilesAsync(num).catch(err => console.error('[Storage] Failed to list recent races:', { limit: num, error: err }));
    return cachedRecentFiles.slice(0, num);
};

// Persists a race-data value and updates its cache entry.
const setAsync = async (key, value) => {
    await window.electronAPI.storageSet(key, value);
    setCached(key, value);
};

// Updates cached race data before persisting it in the background.
const set = (key, value) => {
    setCached(key, value);
    setAsync(key, value).catch(err => console.error('[Storage] Failed to save value:', { key: key, error: err }));
};

// Retrieves a race-data value directly from persistence.
const getAsync = async (key) => { // eslint-disable-line no-unused-vars
    try {
        return await window.electronAPI.storageGet(key);
    } catch (error) {
        console.error('[Storage] Failed to get value:', { key: key, error: error });
        throw error;
    }
};

// Retrieves a race-data value from the local cache.
const get = (key) => {
    return getCached(key);
};

// Removes a persisted race-data value and its cache entry.
const removeAsync = async (key) => {
    await window.electronAPI.storageRemove(key);
    // Remove from cache
    const keys = key.split('.');
    let current = cachedRaceData;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
        if (!current) return;
    }
    delete current[keys[keys.length - 1]];
};

// Removes a cached race-data value before persisting the deletion.
const remove = (key) => {
    const keys = key.split('.');
    let current = cachedRaceData;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
        if (!current) return;
    }
    delete current[keys[keys.length - 1]];
    removeAsync(key).catch(err => console.error('[Storage] Failed to remove value:', { key: key, error: err }));
};

// Saves the cars and results for a tournament round.
const saveRound = (manche, round, cars) => {
    try {
        set(`race.m${manche}.r${round}`, cars);
    } catch (error) {
        console.error('[Storage] Failed to save round:', { manche: manche, round: round, error: error });
        throw error;
    }
};

// Loads cars and results for the requested or current round.
const loadRound = (manche, round) => {
    try {
        if (manche === undefined || manche === null) {
            manche = get('currManche');
        }
        if (round === undefined || round === null) {
            round = get('currRound');
        }
        return get(`race.m${manche}.r${round}`);
    } catch (error) {
        console.error('[Storage] Failed to load round:', { manche: manche, round: round, error: error });
        throw error;
    }
};

// Deletes the stored results for a tournament round.
const deleteRound = (manche, round) => {
    try {
        remove(`race.m${manche}.r${round}`);
    } catch (error) {
        console.error('[Storage] Failed to delete round:', { manche: manche, round: round, error: error });
        throw error;
    }
};

// Returns tournament manches, including any generated finals.
const getManches = () => {
    try {
        const tournament = get('tournament');
        if (!tournament) return null;

        let mancheList = _.clone(tournament.manches || []);
        if (tournament.finals && tournament.finals.length) {
            mancheList = mancheList.concat(tournament.finals);
        }
        return mancheList;
    } catch (error) {
        console.error('[Storage] Failed to get manches:', error);
        throw error;
    }
};

// Returns the configured tournament players.
const getPlayers = () => {
    try {
        const tournament = get('tournament');
        if (!tournament) return null;
        return tournament.players;
    } catch (error) {
        console.error('[Storage] Failed to get players:', error);
        throw error;
    }
};

// Builds per-player result data for every tournament manche.
const getPlayerData = () => {
    try {
        let cars;
        const playerTimes = [];
        const mancheList = getManches();

        _.each(mancheList, (manche, mindex) => {
            _.each(manche, (round, rindex) => {
                cars = loadRound(mindex, rindex);
                _.each(round, (playerId, pindex) => {
                    playerTimes[playerId] = playerTimes[playerId] || [];
                    if (cars) {
                        playerTimes[playerId][mindex] = {
                            time: cars[pindex].currTime,
                            position: cars[pindex].position,
                            outOfBounds: cars[pindex].outOfBounds
                        };
                    } else {
                        playerTimes[playerId][mindex] = {
                            time: 0,
                            position: 0,
                            outOfBounds: false
                        };
                    }
                });
            });
        });
        return playerTimes;
    } catch (error) {
        console.error('[Storage] Failed to get player data:', error);
        throw error;
    }
};

// Ranks players by the sum of their two best recorded times.
const getSortedPlayerList = () => {
    try {
        const playerList = getPlayers();
        const playerData = getPlayerData();

        // calculate best time sums
        const sums = [];
        let pData, bestTimes, bestSum;
        _.each(playerList, (_player, pindex) => {
            pData = playerData[pindex] || [];
            bestTimes = _.sortBy(_.filter(pData, (i) => { return i && i.time > 0; }), 'time').slice(0, 2);
            bestSum = (bestTimes[0] ? bestTimes[0].time : 99999) + (bestTimes[1] ? bestTimes[1].time : 99999);
            sums[pindex] = bestSum;
        });

        // sort list by sum desc
        const playerTimes = _.map(playerData, (data, index) => {
            return {
                id: index,
                times: _.map(data, (i) => { return i ? i.time : null; }),
                best: sums[index]
            };
        });
        return _.sortBy(playerTimes, 'best');
    } catch (error) {
        console.error('[Storage] Failed to get sorted player list:', error);
        throw error;
    }
};

module.exports = {
    initAsync: initAsync,
    newRace: newRace,
    newRaceAsync: newRaceAsync,
    loadRace: loadRace,
    loadRaceAsync: loadRaceAsync,
    deleteRace: deleteRace,
    getRecentFiles: getRecentFiles,
    set: set,
    setAsync: setAsync,
    get: get,
    saveRound: saveRound,
    loadRound: loadRound,
    deleteRound: deleteRound,
    getManches: getManches,
    getPlayers: getPlayers,
    getPlayerData: getPlayerData,
    getSortedPlayerList: getSortedPlayerList
};
