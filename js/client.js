'use strict';

const configuration = require('./configuration');
const chrono = require('./chrono');

let currTrack, currTournament;
let timesList, playerList, mancheList;
let currManche = 0, currRound = 0, raceStarted = false;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
let checkTask;

const init = () => {
	let savedTrack = configuration.readSettings('track');
	if (savedTrack) {
		trackLoadDone(savedTrack);
	}
	else {
		trackLoadFail();
	}
	showTrackDetails();

	let savedTournament = configuration.readSettings('tournament');
	if (savedTournament) {
		tournamentLoadDone(savedTournament);
	}
	else {
		tournamentLoadFail();
	}
	showTournamentDetails();

	timesList = configuration.readSettings('times') || [];
	currManche = configuration.readSettings('currManche') || 0;
	currRound = configuration.readSettings('currRound') || 0;

	raceStarted = false;
};

const guiInit = () => {
	if (currTournament == null) {
		return;
	}

	$('#curr-manche').text(currManche+1);
	$('#curr-round').text(currRound+1);

	$('#name-lane0').text(playerList[mancheList[currManche][currRound][0]] || '-');
	$('#name-lane1').text(playerList[mancheList[currManche][currRound][1]] || '-');
	$('#name-lane2').text(playerList[mancheList[currManche][currRound][2]] || '-');
};

const showTrackDetails = () => {
	if (currTrack) {
		$('#js-track-length').val(currTrack.length);
		$('#js-track-changers').val(currTrack.changers);
		$('#js-track-order').val(currTrack.order);
	}
	else {
		$('#js-track-length').val('-');
		$('#js-track-changers').val('-');
		$('#js-track-order').val('-');
	}
};

const showTournamentDetails = () => {
	if (currTournament) {
		$('#js-tournament-players').val(currTournament.players.length);
		$('#js-tournament-manches').val(currTournament.manches.length);
		showPlayerList();
		showMancheList();
		guiInit();
	}
	else {
		$('#js-tournament-players').val('-');
		$('#js-tournament-manches').val('-');
	}
};

const showPlayerList = () => {
	$('#tablePlayerList').empty();
	if (playerList.length > 0) {
		$('#tablePlayerList').append('<tr class="is-selected"><td colspan="2"><strong>' + playerList.length + ' RACERS</strong></td></tr>');
	}
	_.each(playerList, (name,i) => {
		$('#tablePlayerList').append('<tr><td><strong>' + (i+1) + '</strong></td><td>' + name + '</td></tr>');
	});
};

const showMancheList = () => {
	$('#tableMancheList').empty();
	let mancheText, playerName;
	_.each(mancheList, (manche, index) => {
		$('#tableMancheList').append('<tr class="is-selected"><td><strong>MANCHE ' + (index+1) + '</strong></td><td>Lane 1</td><td>Lane 2</td><td>Lane 3</td></tr>');
		_.each(manche, (group, index) => {
			mancheText = _.map(group, (id) => {
				playerName = playerList[id] || '-';
				return '<td><p class="has-text-centered is-capitalized">' + playerName + '</p><div class="field"><div class="control"><input class="input is-small" type="text" placeholder="0.000"></div></div></td>'
			}).join();
			$('#tableMancheList').append('<tr><td>Round ' + (index+1) + '</td>' + mancheText + '</tr>');
		});
	});
};

// ==========================================================================
// ==== handle interface buttons

const startRound = () => {
	if (currTournament == null || currTrack == null) {
		console.log('Error: data not loaded');
		return;
	}

	// start chrono
	chrono.start(mancheList[currManche][currRound], currTrack);

	// run checkTask every 1 second
	checkTask = setInterval(checkRace, 1000);

	raceStarted = true;
	drawRace();
};

const prevRound = () => {
	if (currTournament == null || currTrack == null) {
		console.log('Error: data not loaded');
		return;
	}
	if (currManche == 0 && currRound == 0) {
		return;
	}
	currRound--;
	if (currRound < 0) {
		currManche--;
		currRound = mancheList[0].length-1;
	}

	configuration.saveSettings('currManche', currManche);
	configuration.saveSettings('currRound', currRound);
	guiInit();
};

const nextRound = () => {
	if (currTournament == null || currTrack == null) {
		console.log('Error: data not loaded');
		return;
	}
	if (currManche == (mancheList.length-1) && currRound == (mancheList[0].length-1)) {
		return;
	}
	currRound++;
	if (currRound == mancheList[0].length) {
		currManche++;
		currRound = 0;
	}

	configuration.saveSettings('currManche', currManche);
	configuration.saveSettings('currRound', currRound);
	guiInit();
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
	showTrackDetails(currTrack);
};

const trackLoadFail = () => {
	currTrack = null;
	$('#js-input-track-code').addClass('is-danger');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text('not loaded');
	showTrackDetails(currTrack);
};

const tournamentLoadDone = (obj) => {
	currTournament = obj;
	playerList = obj.players;
	mancheList = obj.manches;
	timesList = []; // mirror of currTournament but holds the times
	$('#tag-tournament-status').removeClass('is-danger');
	$('#tag-tournament-status').addClass('is-success');
	$('#tag-tournament-status').text(obj.code);
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
	if (chrono.isRaceFinished()) {
		// race finished, kill this task
		raceFinished();
		clearInterval(checkTask);
		return;
	}

	chrono.checkOutCars();
	drawRace();
};

const raceFinished = () => {
	let cars = chrono.getCars();
	if (timesList[currManche] == null) {
		timesList[currManche] = [];
	}
	debugger;
	timesList[currManche][currRound] = [cars[0].currTime, cars[1].currTime, cars[2].currTime];
	configuration.saveSettings('times', timesList);
	raceStarted = false;
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
		}
		else {
			$('#delay-lane' + i).text('+' + (car.delayFromFirst/1000));
			if (car.delayFromFirst > 0) {
				$('#delay-lane' + i).addClass('is-danger');
			}
			if (car.lapCount > 1) {
				$('#speed-lane' + i).text(car.speed.toFixed(2) + ' m/s');
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
		_.each(car.splitTimes, (t) => { 
			$('#laps-lane' + i).append('<li>' + (t/1000).toFixed(3) + '</li>');
		});
		
		// place
		if (car.outOfBounds) {
			$('#place-lane' + i).text('out');
			$('#place-lane' + i).addClass('is-dark');
		}
		else if (car.lapCount == 0) {
			$('#place-lane' + i).text('waiting');
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
			$('#timer-lane' + i).text((car.currTime/1000).toFixed(3));
		}
		else if (car.lapCount == 1) {
			startTimer(i);
		}
		else if (car.lapCount == 4) {
			stopTimer(i);
			$('#timer-lane' + i).addClass('is-success');
			$('#timer-lane' + i).text((car.currTime/1000).toFixed(3));
		}
	});
};

const startTimer = (lane) => {
	// TODO non funziona la seconda volta
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

const boardConnected = (msg) => {
	$('#tag-board-status').removeClass('is-danger');
	$('#tag-board-status').addClass('is-success');
	$('#tag-board-status').text('CONNECTED');
};

const boardDisconnected = (msg) => {
	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text('NOT CONNECTED');
};

const sensorRead1 = (obj) => {
	if (raceStarted && obj == 0) {
		addLap(0);
	}
};

const sensorRead2 = (obj) => {
	if (raceStarted && obj == 0) {
		addLap(1);
	}
};

const sensorRead3 = (obj) => {
	if (raceStarted && obj == 0) {
		addLap(2);
	}
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
	boardConnected: boardConnected,
	boardDisconnected: boardDisconnected,
	sensorRead1: sensorRead1,
	sensorRead2: sensorRead2,
	sensorRead3: sensorRead3,
	keydown: keydown,
	loadTrack: loadTrack,
	loadTournament: loadTournament,
	startRound: startRound,
	prevRound: prevRound,
	nextRound: nextRound
};
