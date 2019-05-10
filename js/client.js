'use strict';

const { dialog } = require('electron').remote
const Utils = require('./utils');
const configuration = require('./configuration');
const chrono = require('./chrono');
const xls = require('./export');

let currTrack, currTournament;
let playerList, mancheList, playerTimesList, mancheTimesList;
let currManche = 0, currRound = 0, raceStarted = false;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
let checkRaceTask;

const init = () => {
	// populate ui fields
	$('#js-title').text(configuration.readSettings('title'));
	$('#js-race-mode-' + configuration.readSettings('raceMode')).click();
	$('#js-settings-time-threshold').val(configuration.readSettings('timeThreshold'));
	$('#js-settings-speed-threshold').val(configuration.readSettings('speedThreshold'));
	$('#js-settings-start-delay').val(configuration.readSettings('startDelay'));

	$('#js-config-sensor-pin-1').val(configuration.readSettings('sensorPin1'));
	$('#js-config-sensor-pin-2').val(configuration.readSettings('sensorPin2'));
	$('#js-config-sensor-pin-3').val(configuration.readSettings('sensorPin3'));
	$('#js-config-led-pin-1').val(configuration.readSettings('ledPin1'));
	$('#js-config-led-pin-2').val(configuration.readSettings('ledPin2'));
	$('#js-config-led-pin-3').val(configuration.readSettings('ledPin3'));
	$('#js-config-piezo-pin').val(configuration.readSettings('piezoPin'));
	$('#js-config-sensor-threshold').val(configuration.readSettings('sensorThreshold'));
	$('#js-config-title').val(configuration.readSettings('title'));
	$('#js-config-usb-port').val(configuration.readSettings('usbPort'));

	$('#js-about-version').text('Version ' + process.env.npm_package_version);

	// read stuff from settings
	mancheTimesList = configuration.readSettings('mancheTimes') || [];
	playerTimesList = configuration.readSettings('playerTimes') || [];
	currManche = configuration.readSettings('currManche') || 0;
	currRound = configuration.readSettings('currRound') || 0;

	// load track from settings
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
	raceStarted = false;
};

const reset = () => {
	mancheTimesList = [];
	playerTimesList = [];
	playerList = [];
	mancheList = [];
	currManche = 0;
	currRound = 0;
	currTrack = null;
	currTournament = null;
	raceStarted = false;

	configuration.deleteSettings('mancheTimes');
	configuration.deleteSettings('playerTimes');
	configuration.deleteSettings('track');
	configuration.deleteSettings('tournament');
	configuration.deleteSettings('race');
	configuration.saveSettings('currManche', currManche);
	configuration.saveSettings('currRound', currRound);

	$('#js-input-track-code').removeClass('is-danger');
	$('#js-input-track-code').val('');
	$('#js-input-tournament-code').removeClass('is-danger');
	$('#js-input-tournament-code').val('');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text('not loaded');
	$('#tag-tournament-status').addClass('is-danger');
	$('#tag-tournament-status').removeClass('is-success');
	$('#tag-tournament-status').text('not loaded');

	showTrackDetails();
	showTournamentDetails();
	showPlayerList();
	showMancheList();
	guiInit();
};

const guiInit = () => {
	$('#curr-manche').text(currManche+1);
	$('#curr-round').text(currRound+1);

	if (currTournament == null) {
		$('#name-lane0').text('_');
		$('#name-lane1').text('_');
		$('#name-lane2').text('_');
	}
	else {
		$('#name-lane0').text(playerList[mancheList[currManche][currRound][0]] || '_');
		$('#name-lane1').text(playerList[mancheList[currManche][currRound][1]] || '_');
		$('#name-lane2').text(playerList[mancheList[currManche][currRound][2]] || '_');
		showMancheList();
	}

	drawRace();
};

const chronoInit = (reset) => {
	let cars = null;
	if (reset == null) {
		// existing round
		cars = configuration.loadRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound], cars);
	}
	else {
		// new blank round
		configuration.deleteRound(currManche, currRound);
		chrono.init(currTrack, mancheList[currManche][currRound]);
	}
};

const showTrackDetails = () => {
	if (currTrack) {
		$('#js-track-length').text('Length: ' + currTrack.length);
		$('#js-track-order').text('Lane order: ' + currTrack.order + ',1');
		$('#js-link-track').attr('href', currTrack.view_url);
	}
	else {
		$('#js-track-length').text('-');
		$('#js-track-order').text('-');
		$('#js-link-track').attr('href', '#');
	}
	showThresholds();
};

const showTournamentDetails = () => {
	if (currTournament) {
		$('#js-tournament-players').text('Players: ' + currTournament.players.length);
		$('#js-tournament-manches').text('Manches: ' + currTournament.manches.length);
		$('#js-link-tournament').attr('href', currTournament.url);
		showPlayerList();
		showMancheList();
		guiInit();
	}
	else {
		$('#js-tournament-players').text('-');
		$('#js-tournament-manches').text('-');
		$('#js-link-tournament').attr('href', '#');
	}
};

const showThresholds = () => {
	if (currTrack) {
		let rTrackLength = currTrack.length;
		let rSpeedThreshold = configuration.readSettings('speedThreshold');
		let rTimeThreshold = configuration.readSettings('timeThreshold')/100;
		let estimatedTime = rTrackLength / rSpeedThreshold;
		let estimatedCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold);
		let estimatedCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold);
		$('#js-settings-estimated-time').show();
		$('#js-settings-estimated-time').text('ESTIMATED ROUND TIME: ' + estimatedTime.toFixed(3) + ' sec');
		$('#js-settings-estimated-cutoff').show();
		$('#js-settings-estimated-cutoff').text('ESTIMATED CUTOFF TIME: min ' + estimatedCutoffMin.toFixed(3) + ' sec, max ' + estimatedCutoffMax.toFixed(3) + ' sec');
	}
	else {
		$('#js-settings-estimated-time').hide();
		$('#js-settings-estimated-cutoff').hide();
	}
};

// render the player list tab
const showPlayerList = () => {
	$('#tablePlayerList').empty();
	if (playerList.length > 0) {

		// title row
		let titleCells = _.map(currTournament.manches, (_,mindex) => {
			return '<td>Manche ' + (mindex+1) + '</td>';
		});
		$('#tablePlayerList').append('<tr class="is-selected"><td colspan="2"><strong>' + playerList.length + ' RACERS</strong></td>' + titleCells + '</tr>');

		// player rows
		_.each(playerList, (name, pindex) => {
			let playerTimes = playerTimesList[pindex] || [];
			let bestTime =  _.min(_.filter(playerTimes, (t) => { return t > 0 && t < 99999; }));
			let timeCells = _.map(currTournament.manches, (_,mindex) => {
				let playerTime = playerTimes[mindex] || 0;
				let highlight = '';
				if (playerTime == 0) {
					highlight = 'has-text-grey-light';
				}
				else if (playerTime == bestTime) {
					highlight = 'has-text-danger';
				}
				else if (playerTime < 99999) {
					highlight = 'has-text-info';
				}
				return '<td class="' + highlight + '">' + Utils.prettyTime(playerTime) + '</td>';
			});
			$('#tablePlayerList').append('<tr><td>' + (pindex+1) + '</td><td><p class="has-text-centered is-uppercase">' + name + '</p></td>' + timeCells + '</tr>');
		});
	}
};

// render the manches list tab
const showMancheList = () => {
	$('#tableMancheList').empty();
	let mancheText, playerName, playerTime, playerForm, highlight;
	_.each(mancheList, (manche, mindex) => {
		$('#tableMancheList').append('<tr class="is-selected"><td><strong>MANCHE ' + (mindex+1) + '</strong></td><td>Lane 1</td><td>Lane 2</td><td>Lane 3</td></tr>');
		_.each(manche, (group, rindex) => {
			mancheText = _.map(group, (id, pindex) => {
				playerName = '<p class="has-text-centered is-uppercase">' + (playerList[id] || '') + '</p>';
				playerTime = (mancheTimesList[mindex] && mancheTimesList[mindex][rindex]) ? mancheTimesList[mindex][rindex][pindex] : 0;
				if (playerList[id]) {
					playerForm = '<div class="field"><div class="control"><input class="input is-small js-time-form" type="text" data-manche="' + mindex + '" data-round="' + rindex + '" data-player="' + pindex + '" value="' + Utils.prettyTime(playerTime) + '"></div></div>';
				}
				else {
					playerForm = '';
				}
				return '<td>' + playerName + playerForm + '</td>';
			}).join();
			highlight = (mindex == currManche && rindex == currRound) ? 'class="is-highlighted"' : '';
			$('#tableMancheList').append('<tr ' + highlight + '><td>Round ' + (rindex+1) + '</td>' + mancheText + '</tr>');
		});
	});
};

const saveXls = () => {
	if (currTournament) {
		xls.geneateXls(currTournament.manches.length, playerList, playerTimesList);
	}
};

const overrideTimes = () => {
	var time;
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			_.each(round, (player, pindex) => {
				time = $("input[data-manche='" + mindex + "'][data-round='" + rindex + "'][data-player='" + pindex + "']").val();
				if (time) {
					time = parseInt(time.replace('.',''));
					if (time > 0) {
						debugger;
						mancheTimesList[mindex] = mancheTimesList[mindex] || [];
						mancheTimesList[mindex][rindex] = mancheTimesList[mindex][rindex] || [];
						mancheTimesList[mindex][rindex][pindex] = time;
						playerTimesList[player] = playerTimesList[player] || [];
						playerTimesList[player][mindex] = time;
					}
				}
			});
		});
	});
	configuration.saveSettings('mancheTimes', mancheTimesList);
	configuration.saveSettings('playerTimes', playerTimesList);
};

// ==========================================================================
// ==== handle interface buttons

const startRound = () => {
	timerIntervals = [];
	timerSeconds = [];

	// run tasks periodically
	checkRaceTask = setInterval(checkRace, 1000);
	setTimeout(checkStart, configuration.readSettings('startDelay') * 1000);

	raceStarted = true;
	chronoInit(true);
	guiInit();
	$('#button-start').attr('disabled', true);

	if (configuration.readSettings('raceMode') == 1) {
		startTimer(0);
		startTimer(1);
		startTimer(2);
	}
};

const prevRound = () => {
	if (currTournament == null || currTrack == null) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: "Track/tournament not loaded."});
		return;
	}
	if (currManche == 0 && currRound == 0) {
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: "Change round?", buttons: ['Ok', 'Cancel']}) == 0) {
		currRound--;
		if (currRound < 0) {
			currManche--;
			currRound = mancheList[0].length-1;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		guiInit();
	}
};

const nextRound = () => {
	if (currTournament == null || currTrack == null) {
		dialog.showMessageBox({ type: 'error', title: 'Error', message: "Track/tournament not loaded."});
		return;
	}
	if (currManche == (mancheList.length-1) && currRound == (mancheList[0].length-1)) {
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: "Change round?", buttons: ['Ok', 'Cancel']}) == 0) {
		currRound++;
		if (currRound == mancheList[0].length) {
			currManche++;
			currRound = 0;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		guiInit();
	}
};

// keyboard shortcuts for debug
const keydown = (keyCode) => {
	if (raceStarted) {
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

// load track info from API
const loadTrack = () => {
	let code = $('#js-input-track-code').val();
	$('#js-input-track-code').removeClass('is-danger');
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

// load tournament info from API
const loadTournament = () => {
	let code = $('#js-input-tournament-code').val();
	$('#js-input-tournament-code').removeClass('is-danger');
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
	currTrack = obj;
	$('#tag-track-status').removeClass('is-danger');
	$('#tag-track-status').addClass('is-success');
	$('#tag-track-status').text(obj.code);
	$('#js-input-track-code').val(obj.code);
	showTrackDetails();
};

const trackLoadFail = () => {
	currTrack = null;
	$('#js-input-track-code').addClass('is-danger');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text('not loaded');
	showTrackDetails();
};

const tournamentLoadDone = (obj) => {
	currTournament = obj;
	playerList = obj.players;
	mancheList = obj.manches;
	$('#tag-tournament-status').removeClass('is-danger');
	$('#tag-tournament-status').addClass('is-success');
	$('#tag-tournament-status').text(obj.code);
	$('#js-input-tournament-code').val(obj.code);
};

const tournamentLoadFail = () => {
	currTournament = null;
	$('#js-input-tournament-code').addClass('is-danger');
	$('#tag-tournament-status').addClass('is-danger');
	$('#tag-tournament-status').removeClass('is-success');
	$('#tag-tournament-status').text('not loaded');
};

// ==========================================================================
// ==== write to interface

// timer task to check for cars out of track
const checkRace = () => {
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
	let redraw = chrono.checkNotStartedCars();
	if (chrono.isRaceFinished()) {
		raceFinished();
		redraw = true;
	}
	if (redraw) drawRace();
};

// called when the current round has completed. Saves times
const raceFinished = () => {
	let cars = chrono.getCars();

	mancheTimesList[currManche] = mancheTimesList[currManche] || [];
	mancheTimesList[currManche][currRound] = [cars[0].currTime, cars[1].currTime, cars[2].currTime];
	configuration.saveSettings('mancheTimes', mancheTimesList);

	playerTimesList[cars[0].playerId] = playerTimesList[cars[0].playerId] || [];
	playerTimesList[cars[0].playerId][currManche] = cars[0].currTime;
	playerTimesList[cars[1].playerId] = playerTimesList[cars[1].playerId] || [];
	playerTimesList[cars[1].playerId][currManche] = cars[1].currTime;
	playerTimesList[cars[2].playerId] = playerTimesList[cars[2].playerId] || [];
	playerTimesList[cars[2].playerId][currManche] = cars[2].currTime;
	configuration.saveSettings('playerTimes', playerTimesList);

	configuration.saveRound(currManche, currRound, cars);

	showPlayerList();
	showMancheList();
	raceStarted = false;
	$('#button-start').removeAttr('disabled');
};

const drawRace = () => {
	$('.js-place').removeClass('is-dark is-light is-primary is-warning');
	$('.js-delay').removeClass('is-danger');
	$('.js-timer').removeClass('is-danger is-success');

	let cars = chrono.getCars();
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
			$('#lap-lane' + i).text('finish');
		}
		else {
			$('#lap-lane' + i).text('lap ' + car.lapCount);
		}

		// split times
		$('#laps-lane' + i).empty();
		_.each(car.splitTimes, (t,ii) => {
			$('#laps-lane' + i).append('<li class="is-size-3">partial ' + (ii+1) + ' - <strong>' + Utils.prettyTime(t) + ' s</strong></li>');
		});

		// place
		if (car.outOfBounds) {
			$('#place-lane' + i).text('out');
			$('#place-lane' + i).addClass('is-dark');
		}
		else if (car.lapCount == 0) {
			if (raceStarted) {
				$('#place-lane' + i).text('ready');
			}
			else {
				$('#place-lane' + i).text('stopped');
			}
			$('#place-lane' + i).addClass('is-light');
		}
		else if (car.lapCount == 1) {
			$('#place-lane' + i).text('started');
			$('#place-lane' + i).addClass('is-light');
		}
		else {
			$('#place-lane' + i).text(car.position + ' position');
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
			$('#timer-lane' + i).text(Utils.prettyTime(car.currTime));
		}
		else if (car.lapCount == 0) {
			$('#timer-lane' + i).text(Utils.prettyTime(0));
		}
		else if (car.lapCount == 1) {
			startTimer(i);
		}
		else if (car.lapCount == 4) {
			stopTimer(i);
			$('#timer-lane' + i).addClass('is-success');
			$('#timer-lane' + i).text(Utils.prettyTime(car.currTime));
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
// ==== listen to arduino events

const sensorRead1 = () => {
	if (raceStarted)
		addLap(0);
};

const sensorRead2 = () => {
	if (raceStarted) 
		addLap(1);
};

const sensorRead3 = () => {
	if (raceStarted) 
		addLap(2);
};

const addLap = (lane) => {
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
	loadTournament: loadTournament,
	saveXls: saveXls,
	overrideTimes: overrideTimes,
	startRound: startRound,
	prevRound: prevRound,
	nextRound: nextRound,
	showMancheList: showMancheList,
	showPlayerList: showPlayerList,
	showThresholds: showThresholds
};
