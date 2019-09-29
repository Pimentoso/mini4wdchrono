'use strict';

const { dialog } = require('electron').remote;
const ui = require('./ui');
const utils = require('./utils');
const configuration = require('./configuration');
const chrono = require('./chrono');
const xls = require('./export');
const i18n = new (require('../i18n/i18n'));
const clone = require('clone');

var currTrack, currTournament;
var playerList, mancheList, mancheCount, playerTimes;
var currManche = 0, currRound = 0, raceRunning = false, freeRound = true;

var timerIntervals = [], timerSeconds = [];
var pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
var checkRaceTask;

const init = () => {
	console.log('client.init called');

	ui.initialize();

	// translate ui
	$('.tn').each(function () {
		$(this).text(i18n.__($(this).data('tn')));
	});

	// read stuff from settings
	playerTimes = configuration.readSettings('playerTimes') || [];
	currManche = configuration.readSettings('currManche') || 0;
	currRound = configuration.readSettings('currRound') || 0;

	// load track from settings (do this before tournament)
	let savedTrack = configuration.loadTrack();
	if (savedTrack) {
		trackLoadDone(savedTrack);
	}
	else {
		trackLoadFail();
	}
	showTrackDetails();

	// load tournament from settings
	let savedTournament = configuration.loadTournament();
	if (savedTournament) {
		tournamentLoadDone(savedTournament);
	}
	else {
		tournamentLoadFail();
	}
	showTournamentDetails();

	// other init variables
	raceRunning = false;
};

const reset = () => {
	console.log('client.reset called');

	playerTimes = [];
	playerList = [];
	mancheList = [];
	currManche = 0;
	currRound = 0;
	currTrack = null;
	currTournament = null;
	raceRunning = false;

	configuration.reset();
	ui.reset();

	initTimeList();
	showTrackDetails();
	showTournamentDetails();
};

const chronoInit = (reset) => {
	console.log('client.chronoInit called');

	if (reset) {
		// new blank round, or replay a past round
		configuration.deleteRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound]);
	}
	else if (currTournament == null || freeRound) {
		// free round
		chrono.init(currTrack);
	}
	else {
		// load existing round
		let cars = configuration.loadRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound], cars);
	}
};

// ==========================================================================
// ==== time list handling

const disqualify = (mindex, rindex, pindex) => {
	console.log('client.disqualify called');

	mindex = mindex || currManche;
	rindex = rindex || currRound;
	let cars = configuration.loadRound(mindex, rindex);
	cars[pindex].currTime = 99999;
	configuration.saveRound(mindex, rindex, cars);

	rebuildTimeList();
	ui.initRace(freeRound);
	updateRace();
};

// Reads all input fields in the manches tab and rebuilds time list
const overrideTimes = () => {
	console.log('client.overrideTimes called');

	let time, cars;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = configuration.loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (_playerId, pindex) => {
					time = $(`input[data-manche='${mindex}'][data-round='${rindex}'][data-player='${pindex}']`).val();
					if (time) {
						cars[pindex].currTime = utils.safeTime(time);
					}
				});
			}
			configuration.saveRound(mindex, rindex, cars);
		});
	});

	rebuildTimeList();
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
	configuration.saveSettings('playerTimes', playerTimes);
};

// Rebuilds playerTimes starting from saved race results
const rebuildTimeList = () => {
	console.log('client.rebuildTimeList called');

	let time, cars;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = configuration.loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (playerId, pindex) => {
					time = cars[pindex].currTime;
					playerTimes[playerId] = playerTimes[playerId] || [];
					playerTimes[playerId][mindex] = time;
				});
			}
		});
	});
	configuration.saveSettings('playerTimes', playerTimes);
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
	configuration.saveSettings('tournament', currTournament);
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
	setTimeout(checkStart, configuration.readSettings('startDelay') * 1000);

	raceRunning = true;

	if (configuration.readSettings('raceMode') == 1) {
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

const prevRound = () => {
	console.log('client.prevRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded') });
		return;
	}
	if (currManche == 0 && currRound == 0) {
		// first round, can't go back
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel'] }) == 0) {
		currRound--;
		if (currRound < 0) {
			currManche--;
			currRound = mancheList[currManche].length - 1;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		ui.initRace(freeRound);
		updateRace();
	}
};

const nextRound = () => {
	console.log('client.nextRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded') });
		return;
	}

	if (currTournament.finals && currManche == (mancheCount + currTournament.finals.length - 1) && currRound == 2) {
		// end of finals
		return;
	}

	let dialogText = (currManche == (mancheCount - 1) && currRound == (mancheList[currManche].length - 1)) ? i18n.__('dialog-enter-final') : i18n.__('dialog-change-round');
	if (dialog.showMessageBox({ type: 'warning', message: dialogText, buttons: ['Ok', 'Cancel'] }) == 0) {
		currRound++;
		if (currRound == mancheList[currManche].length) {
			currManche++;
			currRound = 0;

			if (currManche >= mancheCount) {
				// manche index is higher than the original count: final mode
				if (!currTournament.finals) {
					// generate final rounds only once
					// TODO maybe add a 'regenerate final' button
					initFinal();
				}
			}
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		ui.initRace(freeRound);
		updateRace();
	}
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
	configuration.saveSettings('track', obj);
	trackLoadDone(obj);
};

const loadTournament = (code) => {
	console.log('client.loadTournament called');

	$.getJSON(`https://mini4wd-tournament.pimentoso.com/api/tournament/${code}`)
		.done((obj) => {
			tournamentLoadDone(obj);
		})
		.fail(tournamentLoadFail)
		.always(() => {
			showTournamentDetails(currTournament);
		});
};

const trackLoadDone = (obj) => {
	console.log('client.trackLoadDone called');

	currTrack = obj;
	configuration.saveSettings('track', currTrack);

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

	configuration.saveSettings('tournament', currTournament);

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

	let redraw = false;
	if (chrono.isRaceFinished()) {
		// race finished, kill this task
		raceFinished();
		clearInterval(checkRaceTask);
		redraw = true;
	}
	else {
		redraw = chrono.checkOutCars();
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

	if (currTournament && !freeRound) {
		let cars = chrono.getCars();

		if (cars[0].playerId > -1) {
			playerTimes[cars[0].playerId][currManche] = cars[0].currTime;
		}
		if (cars[1].playerId > -1) {
			playerTimes[cars[1].playerId][currManche] = cars[1].currTime;
		}
		if (cars[2].playerId > -1) {
			playerTimes[cars[2].playerId][currManche] = cars[2].currTime;
		}
		configuration.saveSettings('playerTimes', playerTimes);

		configuration.saveRound(currManche, currRound, cars);

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

	let cars = (raceRunning || freeRound) ? chrono.getCars() : configuration.loadRound(currManche, currRound);
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
	pageTimerSeconds[lane].text(`${timerSeconds[lane]++ / 10}00`);
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
	prevRound: prevRound,
	nextRound: nextRound,
	isFreeRound: isFreeRound,
	toggleFreeRound: toggleFreeRound
};
