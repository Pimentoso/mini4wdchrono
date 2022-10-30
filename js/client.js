'use strict';

const { dialog } = require('electron').remote;
const ui = require('./ui');
const utils = require('./utils');
const storage = require('./storage');
const chrono = require('./chrono');
const xls = require('./export');
const i18n = new (require('../i18n/i18n'));
const clone = require('clone');

var currTrack, currTournament, ledManager;
var playerList, mancheList, mancheCount, playerTimes;
var currManche = 0, currRound = 0, raceStarting = false, raceRunning = false, freeRound = true;

var timerIntervals = [], timerSeconds = [];
var pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
var checkRaceTask;

const init = (params) => {
	console.log('client.init called');

	ledManager = params.led_manager;
	ui.init();
	ui.gotoTab(configuration.get('tab'));

	// init variables
	playerTimes = [];
	playerList = [];
	mancheList = [];
	currManche = storage.get('currManche') || 0;
	currRound = storage.get('currRound') || 0;
	currTrack = null;
	currTournament = null;
	raceRunning = false;

	// load track from settings (do this before tournament)
	let savedTrack = storage.get('track');
	if (savedTrack) {
		trackLoadDone(savedTrack);
	}
	showTrackDetails();

	// load tournament from settings
	let savedTournament = storage.get('tournament');
	if (savedTournament) {
		playerTimes = storage.get('playerTimes') || [];
		tournamentLoadDone(savedTournament);
	}
	showTournamentDetails();
};

const reset = (name) => {
	console.log('client.reset called');

	playerTimes = [];
	playerList = [];
	mancheList = [];
	currManche = 0;
	currRound = 0;
	currTrack = null;
	currTournament = null;
	raceRunning = false;

	storage.newRace(name);
	ui.init();

	initTimeList();
	showTrackDetails();
	showTournamentDetails();
};

const chronoInit = (reset) => {
	console.log('client.chronoInit called');

	if (currTournament == null || freeRound) {
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
		let cars = storage.loadRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound], cars);
	}
};

// ==========================================================================
// ==== time list handling

const disqualify = (mindex, rindex, pindex) => {
	console.log('client.disqualify called');

	mindex = mindex || currManche;
	rindex = rindex || currRound;
	let cars = storage.loadRound(mindex, rindex);
	cars[pindex].originalTime = cars[pindex].currTime;
	cars[pindex].currTime = 99999;
	storage.saveRound(mindex, rindex, cars);

	rebuildTimeList();
	ui.initRace(freeRound);
	updateRace();
};

// Reads all input fields in the manches tab and rebuilds time list
const overrideTimes = () => {
	console.log('client.overrideTimes called');

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
						if (newTime != oldTime) {
							cars[pindex].originalTime = oldTime;
							cars[pindex].currTime = newTime;
						}
					}
				});
			}
			storage.saveRound(mindex, rindex, cars);
		});
	});

	rebuildTimeList();
	ui.showPlayerList();
	ui.showMancheList();
	ui.initRace(freeRound);
	updateRace();
};

// Initializes playerTimes
const initTimeList = () => {
	console.log('client.initTimeList called');
	_.each(mancheList, (_manche, mindex) => {
		_.each(playerList, (_playerId, pindex) => {
			playerTimes[pindex] = playerTimes[pindex] || [];
			playerTimes[pindex][mindex] = playerTimes[pindex][mindex] || 0;
		});
	});
	storage.set('playerTimes', playerTimes);
};

// Rebuilds playerTimes starting from saved race results
const rebuildTimeList = () => {
	console.log('client.rebuildTimeList called');

	let time, cars;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = storage.loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (playerId, pindex) => {
					time = cars[pindex].currTime;
					playerTimes[playerId] = playerTimes[playerId] || [];
					playerTimes[playerId][mindex] = time;
				});
			}
		});
	});
	storage.set('playerTimes', playerTimes);
};

const initFinal = () => {
	console.log('client.initFinal called');

	let ids = _.map(ui.getSortedPlayerList(), (t) => { return t.id });

	// remove any previously generated finals
	mancheList = mancheList.slice(0, mancheCount);
	currTournament.finals = []

	// generate semifinal manche rounds
	if (playerList.length >= 5) {
		let semifinalPlayerIds = ids.slice(3, 6);
		if (semifinalPlayerIds.length == 2) {
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
	let finalPlayerIds = ids.slice(0, 3);
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

const startRace = (debugMode) => {
	console.log('client.startRace called');

	if (!storage.get('track')) {
		// track not loaded
		dialog.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-track-not-loaded'), buttons: ['Ok'] });
		return;
	}
	if ($(`div[data-tab=race]`).is(":hidden")) {
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
		ui.raceStarted();
		initRound();
		startRound();
	}
	else {
		// production mode
		if (!freeRound && storage.get('tournament') && storage.loadRound()) {
			if (dialog.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-replay-round'), buttons: ['Ok', 'Cancel'] }) == 1) {
				return;
			}
		}
		raceStarting = true;
		ui.raceStarted();
		initRound();
		ledManager.roundStart(startRound);
	}
}

// called before the starting sequence
const initRound = () => {
	console.log('client.initRound called');

	chronoInit(!freeRound);
	updateRace();
};

// called when the starting sequence has finished
const startRound = () => {
	console.log('client.startRound called');

	timerIntervals = [];
	timerSeconds = [];

	// run tasks periodically
	checkRaceTask = setInterval(checkRace, 500);
	setTimeout(checkStart, storage.get('startDelay') * 1000);

	raceRunning = true;

	// if final mode, start all timers now
	if (storage.get('raceMode') == 1) {
		startTimer(0);
		startTimer(1);
		startTimer(2);
	}
};

// called when the stop button is pressed
const stopRace = () => {
	console.log('client.stopRace called');

	chrono.stopRace();
	checkRace();
};

const prevRound = () => {
	console.log('client.prevRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
		return;
	}
	if (currManche == 0 && currRound == 0) {
		// first round, can't go back
		return;
	}

	if (dialog.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel'] }) == 0) {
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

const nextRound = () => {
	console.log('client.nextRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
		return;
	}

	if (currTournament.finals && currManche == (mancheCount + currTournament.finals.length - 1) && currRound == 2) {
		// end of finals
		return;
	}

	let dialogText = (currManche == (mancheCount - 1) && currRound == (mancheList[currManche].length - 1) && !currTournament.finals) ? i18n.__('dialog-enter-final') : i18n.__('dialog-change-round');
	if (dialog.showMessageBoxSync({ type: 'warning', message: dialogText, buttons: ['Ok', 'Cancel'] }) == 0) {
		currRound++;
		if (currRound == mancheList[currManche].length) {
			currManche++;
			currRound = 0;

			if (currManche >= mancheCount) {
				// manche index is higher than the original count: final mode
				if (!currTournament.finals) {
					// generate final rounds only once
					initFinal();
				}
			}
		}

		storage.set('currManche', currManche);
		storage.set('currRound', currRound);
		chronoInit();
		ui.initRace(freeRound);
		updateRace();
	}
};

const gotoRound = (mindex, rindex) => {
	console.log('client.gotoRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBoxSync({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded'), buttons: ['Ok'] });
		return;
	}

	if (dialog.showMessageBoxSync({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel'] }) == 0) {
		storage.set('currManche', mindex);
		storage.set('currRound', rindex);
		chronoInit();
		ui.initRace(freeRound);
		updateRace();
	}
};

const isFreeRound = () => freeRound;

const isStarted = () => raceStarting || raceRunning;

const toggleFreeRound = () => {
	console.log('client.toggleFreeRound called');

	freeRound = !freeRound;
	chronoInit();
	ui.toggleFreeRound(freeRound);
	ui.initRace(freeRound);
	updateRace();
};

// keyboard shortcuts for debug
const keydown = (keyCode) => {
	if (raceRunning) {
		if (keyCode == 49 || keyCode == 97) {
			// pressed 1
			addLap(1);
		}
		else if (keyCode == 50 || keyCode == 98) {
			// pressed 2
			addLap(2);
		}
		else if (keyCode == 51 || keyCode == 99) {
			// pressed 3
			addLap(3);
		}
	}
};

// ==========================================================================
// ==== API calls

const loadTrack = (code) => {
	console.log('client.loadTrack called');

	$.getJSON(`https://mini4wd-track-editor.pimentoso.com/api/track/${code}`)
		.done((obj) => {
			trackLoadDone(obj);
		})
		.fail(trackLoadFail)
		.always(() => {
			showTrackDetails();
		});
};

const setTrackManual = (length, order) => {
	console.log('client.setTrackManual called');

	let obj = { 'code': i18n.__('tag-track-manual'), 'length': length, 'order': order, 'manual': true };
	storage.set('track', obj);
	trackLoadDone(obj);
};

const loadTournament = (code) => {
	console.log('client.loadTournament called');

	$.getJSON(`https://mini4wd-tournament.pimentoso.com/api/tournament/${code}`)
		.done((obj) => {
			playerTimes = [];
			storage.set('playerTimes', playerTimes);
			tournamentLoadDone(obj);
		})
		.fail(tournamentLoadFail)
		.always(() => {
			showTournamentDetails();
		});
};

const trackLoadDone = (obj) => {
	console.log('client.trackLoadDone called');

	currTrack = obj;
	storage.set('track', currTrack);

	ui.trackLoadDone(currTrack);
	showTrackDetails();
};

const trackLoadFail = () => {
	console.log('client.trackLoadFail called');

	currTrack = null;
	ui.trackLoadFail();
	showTrackDetails();
};

const tournamentLoadDone = (obj) => {
	console.log('client.tournamentLoadDone called');

	currTournament = obj;
	playerList = clone(obj.players);
	mancheList = clone(obj.manches);

	mancheCount = mancheList.length; // save original manche count, without finals
	currTournament.mancheCount = mancheCount;

	if (obj.finals) {
		mancheList.push(...clone(obj.finals));
	}

	storage.set('tournament', currTournament);

	freeRound = false;
	ui.tournamentLoadDone(currTournament);
	initTimeList();
};

const tournamentLoadFail = () => {
	console.log('client.tournamentLoadFail called');

	currTournament = null;
	ui.tournamentLoadFail();
};

// ==========================================================================
// ==== race status

// timer task to check for cars out of track
const checkRace = () => {
	console.log('client.checkRace called');

	let redraw = chrono.checkOutCars();
	if (chrono.isRaceFinished()) {
		raceFinished();
		redraw = true;
	}
	if (redraw) updateRace();
};

// timer task to invalidate cars not passed in 3 seconds
const checkStart = () => {
	console.log('client.checkStart called');

	let redraw = chrono.checkNotStartedCars();
	if (chrono.isRaceFinished()) {
		raceFinished();
		redraw = true;
	}
	if (redraw) updateRace();
};

// called when the current round has completed. Saves times and handles UI changes
const raceFinished = () => {
	console.log('client.raceFinished called');

	// kill race check task
	clearInterval(checkRaceTask);

	let cars = chrono.getCars();
	ledManager.roundFinish(cars);

	if (currTournament && !freeRound) {
		if (cars[0].playerId > -1) {
			playerTimes[cars[0].playerId][currManche] = cars[0].currTime;
		}
		if (cars[1].playerId > -1) {
			playerTimes[cars[1].playerId][currManche] = cars[1].currTime;
		}
		if (cars[2].playerId > -1) {
			playerTimes[cars[2].playerId][currManche] = cars[2].currTime;
		}
		storage.set('playerTimes', playerTimes);

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

const showTrackDetails = () => {
	console.log('client.showTrackDetails called');

	ui.showTrackDetails(currTrack);
	ui.showThresholds();
	chronoInit();
	ui.initRace(freeRound);
	updateRace();
};

const showTournamentDetails = () => {
	console.log('client.showTournamentDetails called');

	ui.showTournamentDetails(currTournament);
	ui.initRace(freeRound);
	updateRace();
};

const updateRace = () => {
	console.log('client.updateRace called');

	let cars = (raceRunning || freeRound) ? chrono.getCars() : storage.loadRound(currManche, currRound);
	cars = cars || chrono.getCars(); // if loaded round was undefined
	ui.drawRace(cars, raceRunning);

	// stop timers
	_.each(cars, (car, i) => {
		if (car.outOfBounds || car.lapCount > storage.get('roundLaps')) {
			stopTimer(i);
		}
		else if (car.lapCount == 1) {
			startTimer(i);
		}
	});
};

const startTimer = (lane) => {
	if (timerIntervals[lane] == null) {
		timerSeconds[lane] = 0;
		timerIntervals[lane] = setInterval(timer, 100, lane);
	}
};

const stopTimer = (lane) => {
	clearInterval(timerIntervals[lane]);
};

const timer = (lane) => {
	pageTimerSeconds[lane].text((timerSeconds[lane]++ / 10).toFixed(3));
};

// ==========================================================================
// ==== export excel

const saveXls = () => {
	if (currTournament) {
		xls.geneateXls(mancheList.length, playerList, playerTimes);
	}
};

// ==========================================================================
// ==== listen to arduino events

const sensorRead = (lane) => {
	if (raceRunning)
		addLap(lane);
};

const addLap = (lane) => {
	console.log('client.addLap called');

	chrono.addLap(lane);
	if (chrono.isRaceFinished()) {
		raceFinished();
	}
	updateRace();
}

module.exports = {
	init: init,
	reset: reset,
	sensorRead: sensorRead,
	keydown: keydown,
	loadTrack: loadTrack,
	setTrackManual: setTrackManual,
	loadTournament: loadTournament,
	saveXls: saveXls,
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
