'use strict';

const ui = require('./ui');
const utils = require('./utils');
const configuration = require('./configuration');
const storage = require('./storage');
const chrono = require('./chrono');
const xls = require('./export');
const i18n = new (require('../i18n/i18n'));
const clone = require('clone');

let currTrack, currTournament, ledManager;
let mancheList, mancheCount;
let currManche = 0, currRound = 0, raceStarting = false, raceRunning = false, freeRound = true;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds;
let checkRaceTask;

// Initializes renderer state from cached race data and dependencies.
const init = (params) => {
    ui.init();
    ui.gotoTab(configuration.get('tab'));

    // init variables
    pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
    ledManager = params.led_manager;
    mancheList = [];
    mancheCount = 0;
    currManche = storage.get('currManche') || 0;
    currRound = storage.get('currRound') || 0;
    currTrack = null;
    currTournament = null;
    freeRound = true;
    raceStarting = false;
    raceRunning = false;

    // load track from settings (do this before tournament)
    const savedTrack = storage.get('track');
    if (savedTrack) {
        trackLoadDone(savedTrack);
    }
    showTrackDetails();

    // load tournament from settings
    const savedTournament = storage.get('tournament');
    if (savedTournament) {
        tournamentLoadDone(savedTournament);
    }
    showTournamentDetails();
};

// Resets client state and creates a named race.
const reset = (name, onComplete) => {
    mancheList = [];
    mancheCount = 0;
    currManche = 0;
    currRound = 0;
    currTrack = null;
    currTournament = null;
    freeRound = true;
    raceStarting = false;
    raceRunning = false;

    storage.newRace(name, (filename) => {
        console.log('[Race setup] New race created', { name: name, filename: filename });
        ui.init();

        showTrackDetails();
        showTournamentDetails();
        if (onComplete) onComplete();
    });
};

// Initializes the timing engine for the active round.
const chronoInit = (reset) => {
    if (currTournament === null || freeRound) {
    // free round
        chrono.init(currTrack);
    }
    else if (reset) {
    // new blank round, or replay a past round
        storage.deleteRound(currManche, currRound);
        chrono.init(currTrack, mancheList[currManche][currRound]);
    }
    else {
    // load existing round
        const cars = storage.loadRound(currManche, currRound);
        if (cars) {
            chrono.init(currTrack, mancheList[currManche][currRound], cars);
        } else {
            chrono.init(currTrack, mancheList[currManche][currRound]);
        }
    }
};

// ==========================================================================
// ==== time list handling

// Disqualifies a player in the specified or current round.
const disqualify = (mindex, rindex, pindex) => {
    mindex = mindex === undefined || mindex === null ? currManche : mindex;
    rindex = rindex === undefined || rindex === null ? currRound : rindex;
    const cars = storage.loadRound(mindex, rindex);
    cars[pindex].originalTime = cars[pindex].currTime;
    cars[pindex].currTime = 99999;
    storage.saveRound(mindex, rindex, cars);

    ui.initRace(freeRound);
    updateRace();
};

// Reads edited round times from the UI and persists them.
const overrideTimes = () => {
    let time, newTime, oldTime, cars;
    _.each(mancheList, (manche, mindex) => {
        _.each(manche, (round, rindex) => {
            cars = storage.loadRound(mindex, rindex);
            if (cars) {
                _.each(round, (_playerId, pindex) => {
                    time = $(`input[data-manche='${mindex}'][data-round='${rindex}'][data-player='${pindex}']`).val();
                    if (time) {
                        newTime = utils.safeTime(time);
                        oldTime = cars[pindex].currTime;
                        if (newTime !== oldTime) {
                            cars[pindex].originalTime = oldTime;
                            cars[pindex].currTime = newTime;
                        }
                    }
                });
            }
            storage.saveRound(mindex, rindex, cars);
        });
    });

    ui.showPlayerList();
    ui.showMancheList();
    ui.initRace(freeRound);
    updateRace();
};

// Generates tournament final rounds from the current rankings.
const initFinal = () => {
    const ids = _.map(storage.getSortedPlayerList(), (t) => { return t.id; });

    // remove any previously generated finals
    mancheList = mancheList.slice(0, mancheCount);
    currTournament.finals = [];

    // generate semifinal manche rounds
    if (ids.length >= 5) {
        const semifinalPlayerIds = ids.slice(3, 6);
        if (semifinalPlayerIds.length === 2) {
            // only 5 players: pad array
            semifinalPlayerIds[2] = -1;
        }
        currTournament.finals.push([
            [semifinalPlayerIds[0], semifinalPlayerIds[1], semifinalPlayerIds[2]],
            [semifinalPlayerIds[2], semifinalPlayerIds[0], semifinalPlayerIds[1]],
            [semifinalPlayerIds[1], semifinalPlayerIds[2], semifinalPlayerIds[0]]
        ]);
    }

    // generate final manche rounds
    const finalPlayerIds = ids.slice(0, 3);
    currTournament.finals.push([
        [finalPlayerIds[0], finalPlayerIds[1], finalPlayerIds[2]],
        [finalPlayerIds[2], finalPlayerIds[0], finalPlayerIds[1]],
        [finalPlayerIds[1], finalPlayerIds[2], finalPlayerIds[0]]
    ]);

    mancheList.push(...currTournament.finals);
    storage.set('tournament', currTournament);
};

// ==========================================================================
// ==== handle interface buttons

// Validates race state and starts the configured race sequence.
const startRace = (debugMode) => {
    if (!storage.get('track')) {
    // track not loaded
        window.electronAPI.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-track-not-loaded'), buttons: ['Ok'] });
        return;
    }
    if ($('div[data-tab=race]').is(':hidden')) {
    // race tab not selected in interface
        return;
    }
    if (isStarted()) {
    // race is already started
        return;
    }

    if (debugMode) {
    // debug mode
        raceStarting = true;
        ui.raceStarted(freeRound);
        initRound();
        startRound();
    }
    else {
    // production mode
        if (!freeRound && storage.get('tournament') && storage.loadRound()) {
            const result = window.electronAPI.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-replay-round'), buttons: ['Ok', 'Cancel'] });
            if (result === 1) {
                return;
            }
        }
        raceStarting = true;
        ui.raceStarted(freeRound);
        initRound();
        ledManager.roundStart(configuration.get('ledAnimation'), startRound);
    }
};

// Prepares the timing engine before the starting sequence.
const initRound = () => {
    chronoInit(!freeRound);
    updateRace();
};

// Starts race timers after the starting sequence finishes.
const startRound = () => {
    timerIntervals = [null, null, null];
    timerSeconds = [];

    // run tasks periodically
    checkRaceTask = setInterval(checkRace, 500);
    setTimeout(checkStart, storage.get('startDelay') * 1000);

    raceStarting = false;
    raceRunning = true;

    // if final mode, start all timers now
    if (storage.get('raceMode') === 1) {
        startTimer(0);
        startTimer(1);
        startTimer(2);
    }
};

// Stops an active race when the stop control is pressed.
const stopRace = () => {
    if (raceStarting) {
        return false;
    }

    chrono.stopRace();
    checkRace();
};

// Navigates to the previous tournament round after confirmation.
const prevRound = () => {
    if (currTournament === null || currTrack === null) {
    // tournament not loaded
        window.electronAPI.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
        return;
    }
    if (currManche === 0 && currRound === 0) {
    // first round, can't go back
        return;
    }

    const result = window.electronAPI.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel'] });
    if (result === 0) {
        currRound--;
        if (currRound < 0) {
            currManche--;
            currRound = mancheList[currManche].length - 1;
        }

        storage.set('currManche', currManche);
        storage.set('currRound', currRound);
        chronoInit();
        ui.initRace(freeRound);
        updateRace();
    }
};

// Navigates to the next tournament round after confirmation.
const nextRound = () => {
    if (currTournament === null || currTrack === null) {
    // tournament not loaded
        window.electronAPI.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
        return;
    }

    if (currTournament.finals && currManche === (mancheCount + currTournament.finals.length - 1) && currRound === 2) {
    // end of finals
        return;
    }

    const dialogText = (currManche === (mancheCount - 1) && currRound === (mancheList[currManche].length - 1) && !currTournament.finals) ? i18n.__('dialog-enter-final') : i18n.__('dialog-change-round');
    const result = window.electronAPI.showMessageBoxSync({ type: 'warning', message: dialogText, buttons: ['Ok', 'Cancel'] });
    if (result === 0) {
        currRound++;
        if (currRound === mancheList[currManche].length) {
            currManche++;
            currRound = 0;

            if (currManche >= mancheCount) {
                // manche index is higher than the original count: final mode
                if (!currTournament.finals) {
                    // generate final rounds only once
                    initFinal();
                }

                // Change race mode to final
                storage.set('raceMode', 1);
                ui.showRaceModeDetails();
            }
            else {
                // Change race mode to time attack
                storage.set('raceMode', 0);
                ui.showRaceModeDetails();
            }
        }

        storage.set('currManche', currManche);
        storage.set('currRound', currRound);
        chronoInit();
        ui.initRace(freeRound);
        updateRace();
    }
};

// Navigates to a selected tournament round after confirmation.
const gotoRound = (mindex, rindex) => {
    if (currTournament === null || currTrack === null) {
    // tournament not loaded
        window.electronAPI.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
        return;
    }

    const result = window.electronAPI.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel'] });
    if (result === 0) {
        currManche = mindex;
        currRound = rindex;
        storage.set('currManche', currManche);
        storage.set('currRound', currRound);
        chronoInit();
        ui.initRace(freeRound);
        updateRace();
    }
};

// Reports whether the current race is a free round.
const isFreeRound = () => freeRound;

// Reports whether a race is starting or currently running.
const isStarted = () => raceStarting || raceRunning;

// Switches between free-round and tournament-round modes.
const toggleFreeRound = () => {
    freeRound = !freeRound;
    chronoInit();
    ui.toggleFreeRound(freeRound);
    ui.initRace(freeRound);
    updateRace();
};

// Handles debug keyboard shortcuts for adding laps.
const keydown = (keyCode) => {
    if (raceRunning) {
        if (keyCode === 49 || keyCode === 97) {
            // pressed 1
            addLap(0);
        }
        else if (keyCode === 50 || keyCode === 98) {
            // pressed 2
            addLap(1);
        }
        else if (keyCode === 51 || keyCode === 99) {
            // pressed 3
            addLap(2);
        }
    }
};

// ==========================================================================
// ==== API calls

// Loads a track definition from the remote track service.
const loadTrack = (code) => {
    $.getJSON(`https://mini4wd-track-editor.pimentoso.com/api/track/${code}`)
        .done((obj) => {
            console.log('[Race setup] Remote track loaded', { code: obj.code, length: obj.length, order: obj.order });
            trackLoadDone(obj);
        })
        .fail(() => {
            console.error('[Race setup] Remote track load failed', { code: code });
            trackLoadFail();
        })
        .always(() => {
            showTrackDetails();
        });
};

// Stores a manually entered track definition.
const setTrackManual = (length, order) => {
    const obj = { 'code': i18n.__('tag-track-manual'), 'length': length, 'order': order, 'manual': true };
    storage.set('track', obj);
    trackLoadDone(obj);
};

// Loads a tournament definition from the remote tournament service.
const loadTournament = (code) => {
    $.getJSON(`https://mini4wd-tournament.pimentoso.com/api/tournament/${code}`)
        .done((obj) => {
            console.log('[Race setup] Remote tournament loaded', { code: obj.code, manches: obj.manches ? obj.manches.length : 0 });
            tournamentLoadDone(obj);
        })
        .fail(() => {
            console.error('[Race setup] Remote tournament load failed', { code: code });
            tournamentLoadFail();
        })
        .always(() => {
            showTournamentDetails();
        });
};

// Applies a successfully loaded track to the client state.
const trackLoadDone = (obj) => {
    currTrack = obj;
    storage.set('track', currTrack);

    ui.trackLoadDone(currTrack);
    showTrackDetails();
};

// Opens a persisted race and rebuilds client state.
const openRace = (filename, onComplete) => {
    storage.loadRace(filename, () => {
        console.log('[Race setup] Race opened', { filename: filename });
        init({ led_manager: ledManager });
        if (onComplete) onComplete();
    });
};

// Clears track state after a failed track load.
const trackLoadFail = () => {
    currTrack = null;
    ui.trackLoadFail();
    showTrackDetails();
};

// Applies a successfully loaded tournament to the client state.
const tournamentLoadDone = (obj) => {
    currTournament = obj;
    mancheList = clone(obj.manches);

    mancheCount = mancheList.length; // save original manche count, without finals
    currTournament.mancheCount = mancheCount;

    if (obj.finals) {
        mancheList.push(...clone(obj.finals));
    }

    storage.set('tournament', currTournament);
    ui.showPlayerList();
    ui.showMancheList();

    freeRound = false;
    ui.tournamentLoadDone(currTournament);
};

// Clears tournament state after a failed tournament load.
const tournamentLoadFail = () => {
    currTournament = null;
    ui.tournamentLoadFail();
};

// ==========================================================================
// ==== race status

// Checks whether cars have left the track or finished the race.
const checkRace = () => {
    let redraw = chrono.checkOutCars();
    if (chrono.isRaceFinished()) {
        raceFinished();
        redraw = true;
    }
    if (redraw) updateRace();
};

// Marks cars that did not start within the allowed time.
const checkStart = () => {
    let redraw = chrono.checkNotStartedCars();
    if (chrono.isRaceFinished()) {
        raceFinished();
        redraw = true;
    }
    if (redraw) updateRace();
};

// Finalizes the current round, persists results, and updates the UI.
const raceFinished = () => {
    // kill race check task
    clearInterval(checkRaceTask);

    const cars = chrono.getCars();
    ledManager.roundFinish(cars);

    if (currTournament && !freeRound) {
        storage.saveRound(currManche, currRound, cars);

        ui.showPlayerList();
        ui.showMancheList();
    }

    raceStarting = false;
    raceRunning = false;
    ui.raceFinished(freeRound);
};

// ==========================================================================
// ==== write to interface

// Refreshes UI and timing state after a track change.
const showTrackDetails = () => {
    ui.showTrackDetails(currTrack);
    ui.showThresholds();
    chronoInit();
    ui.initRace(freeRound);
    updateRace();
};

// Refreshes UI and timing state after a tournament change.
const showTournamentDetails = () => {
    ui.showTournamentDetails(currTournament);
    ui.initRace(freeRound);
    updateRace();
};

// Renders current cars and synchronizes per-lane timers.
const updateRace = () => {
    let cars = (raceRunning || freeRound) ? chrono.getCars() : storage.loadRound(currManche, currRound);
    cars = cars || chrono.getCars(); // if loaded round was undefined
    ui.drawRace(cars, raceRunning);

    // stop timers
    _.each(cars, (car, i) => {
        if (car.outOfBounds || car.lapCount > storage.get('roundLaps')) {
            stopTimer(i);
        }
        else if (car.lapCount === 1) {
            startTimer(i);
        }
    });
};

// Starts the display timer for a lane when it is idle.
const startTimer = (lane) => {
    if (timerIntervals[lane] === null) {
        timerSeconds[lane] = 0;
        timerIntervals[lane] = setInterval(timer, 100, lane);
    }
};

// Stops the display timer for a lane.
const stopTimer = (lane) => {
    clearInterval(timerIntervals[lane]);
};

// Advances and renders the display timer for a lane.
const timer = (lane) => {
    pageTimerSeconds[lane].text((timerSeconds[lane]++ / 10).toFixed(3));
};

// ==========================================================================
// ==== export excel

// Exports the current tournament when one is loaded.
const saveXls = () => {
    if (currTournament) {
        xls.generateXls();
    }
};

// ==========================================================================
// ==== listen to arduino events

// Sends a main-process sensor timestamp to the timing engine.
const addLap = (lane, timestamp) => {
    if (!raceRunning) {
        return;
    }

    chrono.addLap(lane, timestamp);
    if (chrono.isRaceFinished()) {
        raceFinished();
    }
    updateRace();
};

module.exports = {
    init: init,
    reset: reset,
    openRace: openRace,
    keydown: keydown,
    loadTrack: loadTrack,
    setTrackManual: setTrackManual,
    loadTournament: loadTournament,
    saveXls: saveXls,
    addLap: addLap,
    disqualify: disqualify,
    overrideTimes: overrideTimes,
    startRace: startRace,
    stopRace: stopRace,
    prevRound: prevRound,
    nextRound: nextRound,
    gotoRound: gotoRound,
    isFreeRound: isFreeRound,
    isStarted: isStarted,
    toggleFreeRound: toggleFreeRound
};
