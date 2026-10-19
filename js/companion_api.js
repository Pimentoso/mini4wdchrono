'use strict';

const storage = require('./storage');
const auth = require('./companion_auth');
const log = require('./logger');

// Renderer-side client for the Mini4WD Companion REST API: race listing for the
// logged in organizer, live heat result submission, and chrono version checks.

const BASE_URL = 'https://mini4wd-companion.com';

// Sentinel time used by the chrono for a car that did not finish.
const DNF_TIME = 99999;

let appVersion = '';

// Last payload submitted per round, so unchanged rounds are not re-sent.
const lastSubmitted = {};

// Caches the app version sent in the X-Chrono-Version header.
const initAsync = async () => {
    appVersion = await window.electronAPI.getAppVersion();
};

// Builds the request headers, adding the bearer token when logged in.
const buildHeaders = () => {
    const headers = { 'X-Chrono-Version': appVersion };
    const token = auth.getToken();
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// Lists the races the logged in organizer is running today.
const fetchTodayRaces = (onSuccess, onError) => {
    if (!auth.isLoggedIn()) {
        if (onError) onError('not logged in');
        return;
    }

    $.ajax({
        url: `${BASE_URL}/api/v1/organizer/races/today`,
        type: 'GET',
        contentType: 'application/json',
        headers: buildHeaders(),
        success: (response) => {
            // Response format: { success: true, data: { races: [...] } }
            const data = response.data || response;
            if (onSuccess) onSuccess(data.races || []);
        },
        error: (xhr, status, error) => {
            log.error('[Companion] Failed to fetch today races', { status: status, error: error });
            if (onError) onError(error);
        }
    });
};

// Adds the finals bracket fields when the round belongs to a generated final.
const addFinalsFields = (body, tournament, mancheIndex, roundIndex) => {
    const qualifierCount = tournament.mancheCount || (tournament.manches || []).length;
    if (mancheIndex < qualifierCount || !tournament.finals || !tournament.finals.length) {
        return;
    }

    body.round_type = 'final';
    const finalsIndex = mancheIndex - qualifierCount;
    // With two brackets the first one is the finalina and the last one the final.
    body.finals_bracket = (tournament.finals.length >= 2 && finalsIndex === 0) ? 'finalina' : 'final';
    // The round index is the Latin square rotation inside the bracket.
    body.finals_round_number = roundIndex + 1;
};

// Returns the lane (1-based) the car runs in for each of its laps, or null when
// the track lane order is unknown. A car changes lane every lap following that
// order, so the starting lane alone does not say where a lap was run.
const buildSplitLanes = (startLane, lapCount) => {
    const track = storage.get('track');
    const order = track && Array.isArray(track.order) ? track.order : null;
    if (!order || order.length === 0) {
        return null;
    }

    // The chrono numbers lanes from zero internally; the track order and the API
    // both number them from one.
    const startIndex = order.indexOf(startLane + 1);
    if (startIndex === -1) {
        // Lane absent from the order, as on a same-lane (1-1-1) track: the car
        // stays in the lane it started from, exactly as chrono.nextLane does.
        return new Array(lapCount).fill(startLane + 1);
    }

    const lanes = [];
    for (let lap = 0; lap < lapCount; lap++) {
        lanes.push(order[(startIndex + lap) % order.length]);
    }
    return lanes;
};

// Converts a stored round into the list of results expected by the API.
const buildResults = (cars, players) => {
    const results = [];
    cars.forEach((car, index) => {
        if (car.playerId === -1 || car.playerId === null || car.playerId === undefined) {
            // Empty lane, nothing to report.
            return;
        }
        const isDnf = car.outOfBounds === true || car.currTime === DNF_TIME;
        const result = {
            car_name: players[car.playerId],
            lap_time: isDnf ? null : car.currTime / 1000,
            is_dnf: isDnf
        };
        // Split times are only trustworthy for cars timed by the sensors: a time
        // edited by hand (originalTime set) no longer matches the recorded splits.
        // A car that did not finish still reports the laps it completed before
        // going out; there is no total for them to disagree with.
        const splitsTrusted = isDnf || car.originalTime === undefined;
        if (splitsTrusted && Array.isArray(car.splitTimes) && car.splitTimes.length > 0) {
            result.split_times = car.splitTimes.map((t) => Math.round(t) / 1000);
            // Cars are stored in starting-lane order, so the index is the fallback.
            const startLane = car.startLane === undefined ? index : car.startLane;
            const splitLanes = buildSplitLanes(startLane, result.split_times.length);
            if (splitLanes) {
                result.split_lanes = splitLanes;
            }
        }
        results.push(result);
    });
    return results;
};

// Submits the result of a single round to the Companion tournament it belongs to.
const submitRoundResult = (mancheIndex, roundIndex) => {
    const tournament = storage.get('tournament');
    if (!tournament || !tournament.code) {
        // Not a Companion tournament, nothing to publish.
        return;
    }

    const cars = storage.loadRound(mancheIndex, roundIndex);
    if (!cars) {
        return;
    }

    const results = buildResults(cars, tournament.players || []);
    if (results.length === 0) {
        return;
    }

    // The API numbers manches from 1, matching what the UI displays.
    const body = { manche_number: mancheIndex + 1, results: results };
    addFinalsFields(body, tournament, mancheIndex, roundIndex);

    const cacheKey = `m${mancheIndex}r${roundIndex}`;
    const payload = JSON.stringify(body);
    if (lastSubmitted[cacheKey] === payload) {
        return;
    }

    $.ajax({
        url: `${BASE_URL}/api/v1/public/tournament/${tournament.code}/heats`,
        type: 'POST',
        contentType: 'application/json',
        headers: buildHeaders(),
        data: payload,
        success: () => {
            lastSubmitted[cacheKey] = payload;
            log.info('[Companion] Round submitted', { manche: mancheIndex + 1, round: roundIndex + 1 });
        },
        error: (xhr, status, error) => {
            log.error('[Companion] Failed to submit round', {
                manche: mancheIndex + 1, round: roundIndex + 1, status: status, error: error
            });
        }
    });
};

// Submits every round that already has stored results, skipping unchanged ones.
const submitAllCompletedRounds = () => {
    const tournament = storage.get('tournament');
    if (!tournament || !tournament.code) {
        return;
    }

    const mancheList = storage.getManches() || [];
    mancheList.forEach((manche, mancheIndex) => {
        manche.forEach((_round, roundIndex) => {
            if (storage.loadRound(mancheIndex, roundIndex)) {
                submitRoundResult(mancheIndex, roundIndex);
            }
        });
    });
};

// Asks the Companion server whether this chrono version is still supported.
const checkVersion = (callback) => {
    $.ajax({
        url: `${BASE_URL}/api/v1/public/chrono/version-check?version=${appVersion}`,
        type: 'GET',
        contentType: 'application/json',
        headers: { 'X-Chrono-Version': appVersion },
        success: (response) => {
            const data = response.data || response;
            log.info('[Companion] Version check result', { status: data.status });
            if (callback) callback(data);
        },
        error: (xhr, status, error) => {
            log.error('[Companion] Version check failed', { status: status, error: error });
            if (callback) callback(null);
        }
    });
};

module.exports = {
    initAsync: initAsync,
    fetchTodayRaces: fetchTodayRaces,
    submitRoundResult: submitRoundResult,
    submitAllCompletedRounds: submitAllCompletedRounds,
    checkVersion: checkVersion
};
