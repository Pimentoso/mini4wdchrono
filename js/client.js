'use strict';

var chrono = require('./chrono');
var configuration = require('./configuration');
const debugMode = true;

let connected = false;
let currTrack, currTournament, currTimes, playerList, mancheList;
let currManche = 0, currRound = 0, raceStarted = false;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];

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

	currTimes = configuration.readSettings('times') || [];
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

$('#button-start').on('click', (e) => {
	if (!connected && !debugMode) {
		console.log('Error: board not connected');
		return;
	}
	if (currTournament == null || currTrack == null) {
		console.log('Error: data not loaded');
		return;
	}

	// socket.emit('start', true);
	raceStarted = true;
	chrono.init(mancheList[currManche][currRound], currTrack);
	chrono.start();
});

$('#button-prev').on('click', (e) => {
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
});

$('#button-next').on('click', (e) => {
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
});

// keyboard shortcuts for debug
document.onkeydown = (e) => {
	if (debugMode && raceStarted) {
		if (e.keyCode == 49 || e.keyCode == 97) {
			// pressed 1
			chrono.addLap(0);
		}
		else if (e.keyCode == 50 || e.keyCode == 98) {
			// pressed 2
			chrono.addLap(1);
		}
		else if (e.keyCode == 51 || e.keyCode == 99) {
			// pressed 3
			chrono.addLap(2);
		}
	}
};

// tabs
$('.tabs a').on('click', (e) => {
	let $this = $(e.currentTarget);
	$('.tabs li').removeClass('is-active');
	$this.closest('li').addClass('is-active');
	let tab = $this.closest('li').data('tab');
	$('div[data-tab]').hide();
	$('div[data-tab=' + tab + ']').show();
});

// load track info from API
$('#js-load-track').on('click', (e) => {
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
});

// load tournament info from API
$('#js-load-tournament').on('click', (e) => {
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
});

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
	currTimes = []; // mirror of currTournament but holds the times
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

const updateRace = (cars) => {
	if (_.every(cars, (c) => { return c.outOfBounds || c.lapCount == 4; })) {
		// race finished
		if (currTimes[currManche] == null) {
			currTimes[currManche] = [];
		}
		currTimes[currManche][currRound] = [cars[0].currTime, cars[1].currTime, cars[2].currTime];
		configuration.saveSettings('times', currTimes);
		raceStarted = false;
	}
};

const drawRace = (cars) => {
	$('.js-place').removeClass('is-dark is-light is-primary is-warning');
	$('.js-delay').removeClass('is-danger');
	$('.js-timer').removeClass('is-danger is-success');

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
	console.log('board_ready');
	connected = true;
	$('#tag-board-status').removeClass('is-danger');
	$('#tag-board-status').addClass('is-success');
	$('#tag-board-status').text('CONNECTED');
};

const boardDisconnected = (msg) => {
	console.log('board_exit');
	connected = false;
	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text('NOT CONNECTED');
};

const sensorRead1 = (obj) => {
	if (raceStarted && obj == 0) {
		chrono.addLap(0);
	}
};

const sensorRead2 = (obj) => {
	if (raceStarted && obj == 0) {
		chrono.addLap(1);
	}
};

const sensorRead3 = (obj) => {
	if (raceStarted && obj == 0) {
		chrono.addLap(2);
	}
};

module.exports = {
	init: init,
	boardConnected: boardConnected,
	boardDisconnected: boardDisconnected,
	sensorRead1: sensorRead1,
	sensorRead2: sensorRead2,
	sensorRead3: sensorRead3,
	updateRace: updateRace,
	drawRace: drawRace
};
