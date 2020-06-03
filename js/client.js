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
var currManche = 0, currRound = 0, raceRunning = false, freeRound = true;

var timerIntervals = [], timerSeconds = [];
var pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
var checkRaceTask;

const init = () => {
	console.log('client.init called');

	ledManager = configuration.ledManager();
	ui.init();

	// init variables
	playerTimes = []; // TODO move to race manager
	playerList = [];
	mancheList = []; // TODO move to race manager
	currManche = storage.get('currManche') || 0; // TODO move to race manager
	currRound = storage.get('currRound') || 0; // TODO move to race manager
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

	// TODO recreate race manager
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

	if (reset) {
		// new blank round, or replay a past round
		storage.deleteRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound]);
	}
	else if (currTournament == null || freeRound) {
		// free round
		chrono.init(currTrack);
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
	ui.initRace(freeRound);
	updateRace();
};

// Rebuilds playerTimes starting from saved race results.
// Used then a player time is manually changed by user from UI.
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

// ==========================================================================
// ==== handle interface buttons

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
	checkRaceTask = setInterval(checkRace, 1000);
	setTimeout(checkStart, storage.get('startDelay') * 1000);

	raceRunning = true;

	if (storage.get('raceMode') == 1) {
		startTimer(0);
		startTimer(1);
		startTimer(2);
	}
};

// called when the stop button is pressed
const stopRound = () => {
	console.log('client.stopRound called');

	chrono.stopRace();
	checkRace();
};

const isFreeRound = () => freeRound;

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
		if (car.outOfBounds || car.lapCount == 4) {
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

	chrono.addLap(lane - 1);
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
	initRound: initRound,
	startRound: startRound,
	stopRound: stopRound,
	isFreeRound: isFreeRound,
	toggleFreeRound: toggleFreeRound
};
