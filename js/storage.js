'use strict';

// Phase 2: All file operations now use IPC via electronAPI
// This module provides both async and sync-like (cached) access patterns
// for backward compatibility with existing code during transition

// In-memory cache of current race data
let cachedRaceData = {};
let cacheReady = false;

/**
 * Internal: Sets values in the local cache
 */
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

/**
 * Internal: Gets values from the local cache
 */
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

/**
 * Initializes the storage system (must be called once at startup)
 * Loads configuration and race data into cache
 * @returns {Promise<void>}
 */
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
        
        cacheReady = true;
        console.log('[Storage] Initialized and ready');
    } catch (error) {
        console.error('[Storage] Initialization error:', error);
        throw error;
    }
};

/**
 * Creates a new race (async)
 */
const newRaceAsync = async (raceName) => {
    try {
        const filename = await window.electronAPI.storageNewRace(raceName);
        await loadRaceAsync(filename);
        return filename;
    } catch (error) {
        console.error('Error creating new race:', error);
        throw error;
    }
};

/**
 * Creates a new race (sync wrapper - fire and forget)
 */
const newRace = (raceName) => {
    newRaceAsync(raceName).catch(err => console.error('Async newRace failed:', err));
};

/**
 * Loads an existing race (async version)
 */
const loadRaceAsync = async (filename) => {
    try {
        if (!filename) {
            filename = await window.electronAPI.configGet('raceFile');
        }
        
        if (filename) {
            // Retrocompatibility: trim filename if needed
            filename = filename.substr(filename.length - 15);
            await window.electronAPI.storageLoadRace(filename);
            cacheReady = true;
        } else {
            // No race file, create a new one
            await newRaceAsync('Unnamed Race');
        }
    } catch (error) {
        console.error('Error loading race:', error);
        throw error;
    }
};

/**
 * Loads an existing race (sync wrapper)
 */
const loadRace = (filename) => {
    loadRaceAsync(filename).catch(err => console.error('Async loadRace failed:', err));
};

/**
 * Deletes a race file (async)
 */
const deleteRaceAsync = async (filename) => {
    try {
        await window.electronAPI.storageDeleteRace(filename);
    } catch (error) {
        console.error('Error deleting race:', error);
        throw error;
    }
};

/**
 * Deletes a race file (sync wrapper)
 */
const deleteRace = (filename) => {
    deleteRaceAsync(filename).catch(err => console.error('Async deleteRace failed:', err));
};

/**
 * Gets recent race files (async)
 */
const getRecentFilesAsync = async (num) => {
    try {
        num = num || 10;
        const recent = await window.electronAPI.storageListRaces(num);
        return _.sortBy(recent, 'created').reverse().slice(0, num);
    } catch (error) {
        console.error('Error getting recent files:', error);
        throw error;
    }
};

/**
 * Gets recent race files (sync wrapper)
 */
const getRecentFiles = (num) => {
    getRecentFilesAsync(num).catch(err => console.error('Async getRecentFiles failed:', err));
    return [];
};

/**
 * Sets a storage value (async)
 */
const setAsync = async (key, value) => {
    try {
        await window.electronAPI.storageSet(key, value);
        setCached(key, value);
    } catch (error) {
        console.error(`Error setting storage key ${key}:`, error);
        throw error;
    }
};

/**
 * Sets a storage value (sync wrapper using cache)
 */
const set = (key, value) => {
    setCached(key, value);
    setAsync(key, value).catch(err => console.error(`Async set(${key}) failed:`, err));
};

/**
 * Gets a storage value (async)
 */
const getAsync = async (key) => {
    try {
        return await window.electronAPI.storageGet(key);
    } catch (error) {
        console.error(`Error getting storage key ${key}:`, error);
        throw error;
    }
};

/**
 * Gets a storage value (sync wrapper using cache)
 */
const get = (key) => {
    return getCached(key);
};

/**
 * Removes a storage value (async)
 */
const removeAsync = async (key) => {
    try {
        await window.electronAPI.storageRemove(key);
        // Remove from cache
        const keys = key.split('.');
        let current = cachedRaceData;
        for (let i = 0; i < keys.length - 1; i++) {
            current = current[keys[i]];
            if (!current) return;
        }
        delete current[keys[keys.length - 1]];
    } catch (error) {
        console.error(`Error removing storage key ${key}:`, error);
        throw error;
    }
};

/**
 * Removes a storage value (sync wrapper)
 */
const remove = (key) => {
    const keys = key.split('.');
    let current = cachedRaceData;
    for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
        if (!current) return;
    }
    delete current[keys[keys.length - 1]];
    removeAsync(key).catch(err => console.error(`Async remove(${key}) failed:`, err));
};

/**
 * Saves round results
 */
const saveRound = (manche, round, cars) => {
    try {
        set(`race.m${manche}.r${round}`, cars);
    } catch (error) {
        console.error(`Error saving round m${manche}.r${round}:`, error);
        throw error;
    }
};

/**
 * Loads round results
 */
const loadRound = (manche, round) => {
    try {
        if (manche === null) {
            manche = get('currManche');
        }
        if (round === null) {
            round = get('currRound');
        }
        return get(`race.m${manche}.r${round}`);
    } catch (error) {
        console.error(`Error loading round m${manche}.r${round}:`, error);
        throw error;
    }
};

/**
 * Deletes round results
 */
const deleteRound = (manche, round) => {
    try {
        remove(`race.m${manche}.r${round}`);
    } catch (error) {
        console.error(`Error deleting round m${manche}.r${round}:`, error);
        throw error;
    }
};

/**
 * Gets manche list from tournament data
 */
const getManches = () => {
    try {
        const tournament = get('tournament');
        if (!tournament) return null;
        
        const mancheList = tournament.manches || [];
        if (tournament.finals) {
            mancheList.push(...tournament.finals);
        }
        return mancheList;
    } catch (error) {
        console.error('Error getting manches:', error);
        throw error;
    }
};

/**
 * Gets player list from tournament data
 */
const getPlayers = () => {
    try {
        const tournament = get('tournament');
        if (!tournament) return null;
        return tournament.players;
    } catch (error) {
        console.error('Error getting players:', error);
        throw error;
    }
};

/*
	Builds a structure like the following
	[
		(1 entry for each player)
		[
			(1 entry for each manche)
			{ time: 99999, position: 3, outOfBounds: true }
		]
	]
	@return [Array]
*/
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
        console.error('Error getting player data:', error);
        throw error;
    }
};

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
        console.error('Error getting sorted player list:', error);
        throw error;
    }
};

module.exports = {
    initAsync: initAsync,
    newRace: newRace,
    loadRace: loadRace,
    deleteRace: deleteRace,
    getRecentFiles: getRecentFiles,
    set: set,
    get: get,
    saveRound: saveRound,
    loadRound: loadRound,
    deleteRound: deleteRound,
    getManches: getManches,
    getPlayers: getPlayers,
    getPlayerData: getPlayerData,
    getSortedPlayerList: getSortedPlayerList
};
