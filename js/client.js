'use strict';

const { dialog } = require('electron').remote;
const ui = require('./ui');
const utils = require('./utils');
const configuration = require('./configuration');
const chrono = require('./chrono');
const xls = require('./export');
const i18n = new(require('../i18n/i18n'));

let currTrack, currTournament;
let playerList, mancheList, playerTimesList, mancheTimesList;
let currManche = 0, currRound = 0, raceRunning = false, freeRound = true;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
let checkRaceTask;

const init = () => {
	console.log('client.init called');

	ui.initialize();

	// translate ui
	$('.tn').each(function(index) {
		$(this).text(i18n.__($(this).data('tn')));
	});

	// read stuff from settings
	mancheTimesList = configuration.readSettings('mancheTimes') || [];
	playerTimesList = configuration.readSettings('playerTimes') || [];
	currManche = configuration.readSettings('currManche') || 0;
	currRound = configuration.readSettings('currRound') || 0;

	// load track from settings (do this before tournament)
	let savedTrack = configuration.readSettings('track');
	if (savedTrack) {
		trackLoadDone(savedTrack);
	}
	else {
		trackLoadFail();
	}
	showTrackDetails();

	// load tournament from settings
	let savedTournament = configuration.readSettings('tournament');
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

	mancheTimesList = [];
	playerTimesList = [];
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

	if (reset == null) {
		// existing round
		let cars = configuration.loadRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound], cars);
	}
	else {
		if (currTournament == null || freeRound) {
			// free round
			chrono.init(currTrack);
		}
		else {
			// new blank round
			configuration.deleteRound(currManche, currRound);
			chrono.init(currTrack, mancheList[currManche][currRound]);
		}
	}
};

// ==========================================================================
// ==== time list handling

const disqualify = (mindex, rindex, pindex) => {
	console.log('client.disqualify called');

	mindex = mindex || currManche;
	rindex = rindex || currRound;
	var cars = configuration.loadRound(mindex, rindex);
	cars[pindex].currTime = 99999;
	configuration.saveRound(mindex, rindex, cars);

	rebuildTimeList();
	ui.initRace(freeRound);
};

// Reads all input fields in the manches tab and rebuilds time list
const overrideTimes = () => {
	console.log('client.overrideTimes called');

	var time, cars;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = configuration.loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (playerId, pindex) => {
					time = $("input[data-manche='" + mindex + "'][data-round='" + rindex + "'][data-player='" + pindex + "']").val();
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
};

// Initializes playerTimes
const initTimeList = () => {
	console.log('client.initTimeList called');

	_.each(mancheList, (_manche, mindex) => {
		_.each(playerList, (_playerId, pindex) => {
			playerTimesList[pindex] = playerTimesList[pindex] || [];
			playerTimesList[pindex][mindex] = playerTimesList[pindex][mindex] || 0;
		});
	});
	configuration.saveSettings('playerTimes', playerTimesList);
};

// Rebuilds mancheTimes and playerTimes starting from saved race results
const rebuildTimeList = () => {
	console.log('client.rebuildTimeList called');

	var time, cars;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = configuration.loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (playerId, pindex) => {
					time = cars[pindex].currTime;
					mancheTimesList[mindex] = mancheTimesList[mindex] || [];
					mancheTimesList[mindex][rindex] = mancheTimesList[mindex][rindex] || [];
					mancheTimesList[mindex][rindex][pindex] = time;
					playerTimesList[playerId] = playerTimesList[playerId] || [];
					playerTimesList[playerId][mindex] = time;
				});
			}
		});
	});
	configuration.saveSettings('mancheTimes', mancheTimesList);
	configuration.saveSettings('playerTimes', playerTimesList);
};

// ==========================================================================
// ==== handle interface buttons

// called before the starting sequence
const initRound = () => {
	console.log('client.initRound called');
	
	chronoInit(true);
	drawRace();
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
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded')});
		return;
	}
	if (currManche == 0 && currRound == 0) {
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel']}) == 0) {
		currRound--;
		if (currRound < 0) {
			currManche--;
			currRound = mancheList[0].length-1;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		ui.initRace(freeRound);
	}
};

const nextRound = () => {
	console.log('client.nextRound called');

	if (currTournament == null || currTrack == null) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded')});
		return;
	}
	if (currManche == (mancheList.length-1) && currRound == (mancheList[0].length-1)) {
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel']}) == 0) {
		currRound++;
		if (currRound == mancheList[0].length) {
			currManche++;
			currRound = 0;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		ui.initRace(freeRound);
	}
};

const isFreeRound = () => freeRound;

const toggleFreeRound = () => {
	freeRound = !freeRound;
	chronoInit(freeRound);
	ui.toggleFreeRound(freeRound);
	ui.initRace(freeRound);
	drawRace();
};

// keyboard shortcuts for debug
const keydown = (keyCode) => {
	if (raceRunning) {
		if (keyCode == 49 || keyCode == 97) {
			// pressed 1
			addLap(0);
		}
		else if (keyCode == 50 || keyCode == 98) {
			// pressed 2
			addLap(1);
		}
		else if (keyCode == 51 || keyCode == 99) {
			// pressed 3
			addLap(2);
		}
	}
};

// ==========================================================================
// ==== API calls

const loadTrack = () => {
	console.log('client.loadTrack called');

	let code = $('#js-input-track-code').val().slice(-6);
	$.getJSON('https://mini4wd-track-editor.pimentoso.com/api/track/' + code)
	.done((obj) => {
		trackLoadDone(obj);
		configuration.saveSettings('track', currTrack);
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

const loadTournament = () => {
	console.log('client.loadTournament called');

	let code = $('#js-input-tournament-code').val().slice(-6);
	$.getJSON('https://mini4wd-tournament.pimentoso.com/api/tournament/' + code)
	.done((obj) => {
		tournamentLoadDone(obj);
		configuration.saveSettings('tournament', currTournament);
	})
	.fail(tournamentLoadFail)
	.always(() => {
		showTournamentDetails(currTournament);
	});
};

const trackLoadDone = (obj) => {
	console.log('client.trackLoadDone called');

	currTrack = obj;
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
	playerList = obj.players;
	mancheList = obj.manches;
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
	if (redraw) drawRace();
};

// timer task to invalidate cars not passed in 3 seconds
const checkStart = () => {
	console.log('client.checkStart called');

	let redraw = chrono.checkNotStartedCars();
	if (chrono.isRaceFinished()) {
		raceFinished();
		redraw = true;
	}
	if (redraw) drawRace();
};

// called when the current round has completed. Saves times and handles UI changes
const raceFinished = () => {
	console.log('client.raceFinished called');

	if (currTournament && !freeRound) {
		let cars = chrono.getCars();

		mancheTimesList[currManche] = mancheTimesList[currManche] || [];
		mancheTimesList[currManche][currRound] = [cars[0].currTime, cars[1].currTime, cars[2].currTime];
		configuration.saveSettings('mancheTimes', mancheTimesList);

		if (cars[0].playerId > -1) {
			playerTimesList[cars[0].playerId] = playerTimesList[cars[0].playerId] || [];
			playerTimesList[cars[0].playerId][currManche] = cars[0].currTime;
		}
		if (cars[1].playerId > -1) {
			playerTimesList[cars[1].playerId] = playerTimesList[cars[1].playerId] || [];
			playerTimesList[cars[1].playerId][currManche] = cars[1].currTime;
		}
		if (cars[2].playerId > -1) {
			playerTimesList[cars[2].playerId] = playerTimesList[cars[2].playerId] || [];
			playerTimesList[cars[2].playerId][currManche] = cars[2].currTime;
		}
		configuration.saveSettings('playerTimes', playerTimesList);

		configuration.saveRound(currManche, currRound, cars);

		ui.showPlayerList();
		ui.showMancheList();
	}

	raceRunning = false;
	ui.raceFinished();
};

// ==========================================================================
// ==== write to interface

const showTrackDetails = () => {
	console.log('client.showTrackDetails called');

	ui.showTrackDetails(currTrack);
	ui.showThresholds();
	chronoInit(true);
	ui.initRace(freeRound);
	drawRace();
};

const showTournamentDetails = () => {
	console.log('client.showTournamentDetails called');

	ui.showTournamentDetails(currTournament);
	ui.initRace(freeRound);
};

// @param [bool] fromSaved: pass true if you want to render a past round. It will be loaded from configuration.
// else it will be loaded from the chrono instance
const drawRace = (fromSaved) => {
	console.log('client.drawRace called');

	$('.js-place').removeClass('is-dark is-light is-primary is-warning');
	$('.js-delay').removeClass('is-danger');
	$('.js-timer').removeClass('is-danger is-success');

	let cars;
	if (fromSaved) {
		cars = configuration.loadRound(currManche, currRound);
	}
	cars = cars || chrono.getCars();
	_.each(cars, (car,i) => {
		// delay + speed
		if (car.outOfBounds) {
			$('#delay-lane' + i).text('+99.999');
			$('#speed-lane' + i).text('0.00 m/s');
		}
		else {
			$('#delay-lane' + i).text('+' + (car.delayFromFirst/1000));
			if (car.delayFromFirst > 0) {
				$('#delay-lane' + i).addClass('is-danger');
			}
			if (car.lapCount > 1) {
				$('#speed-lane' + i).text(car.speed.toFixed(2) + ' m/s');
			}
			else {
				$('#speed-lane' + i).text('0.00 m/s');
			}
		}

		// lap count
		if (car.lapCount == 4) {
			$('#lap-lane' + i).text(i18n.__('label-car-finish'));
		}
		else {
			$('#lap-lane' + i).text(i18n.__('label-car-lap') + ' ' + car.lapCount);
		}

		// split times
		$('#laps-lane' + i).empty();
		_.each(car.splitTimes, (t,ii) => {
			$('#laps-lane' + i).append('<li class="is-size-4">' + i18n.__('label-car-partial') + ' ' + (ii+1) + ' - <strong>' + utils.prettyTime(t) + ' s</strong></li>');
		});

		// place
		if (car.outOfBounds) {
			$('#place-lane' + i).text(i18n.__('label-car-out'));
			$('#place-lane' + i).addClass('is-dark');
		}
		else if (car.lapCount == 0) {
			if (raceRunning) {
				$('#place-lane' + i).text(i18n.__('label-car-ready'));
			}
			else {
				$('#place-lane' + i).text(i18n.__('label-car-stopped'));
			}
			$('#place-lane' + i).addClass('is-light');
		}
		else if (car.lapCount == 1) {
			$('#place-lane' + i).text(i18n.__('label-car-started'));
			$('#place-lane' + i).addClass('is-light');
		}
		else {
			$('#place-lane' + i).text(car.position + ' ' + i18n.__('label-car-position'));
			if (car.position == 1) {
				$('#place-lane' + i).addClass('is-warning');
			}
			else {
				$('#place-lane' + i).addClass('is-primary');
			}
		}

		// timer
		if (car.outOfBounds) {
			stopTimer(i);
			$('#timer-lane' + i).addClass('is-danger');
			$('#timer-lane' + i).text(utils.prettyTime(car.currTime));
		}
		else if (car.lapCount == 0) {
			$('#timer-lane' + i).text(utils.prettyTime(0));
		}
		else if (car.lapCount == 1) {
			startTimer(i);
		}
		else if (car.lapCount == 4) {
			stopTimer(i);
			$('#timer-lane' + i).addClass('is-success');
			$('#timer-lane' + i).text(utils.prettyTime(car.currTime));
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
		xls.geneateXls(currTournament.manches.length, playerList, playerTimesList);
	}
};

// ==========================================================================
// ==== listen to arduino events

const sensorRead1 = () => {
	if (raceRunning)
		addLap(0);
};

const sensorRead2 = () => {
	if (raceRunning) 
		addLap(1);
};

const sensorRead3 = () => {
	if (raceRunning) 
		addLap(2);
};

const addLap = (lane) => {
	console.log('client.addLap called');

	chrono.addLap(lane);
	if (chrono.isRaceFinished()) {
		raceFinished();
	}
	drawRace();
}

module.exports = {
	init: init,
	reset: reset,
	sensorRead1: sensorRead1,
	sensorRead2: sensorRead2,
	sensorRead3: sensorRead3,
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
