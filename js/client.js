'use strict';

var chrono = require('./chrono');
var settings = require('./configuration');
const debugMode = true;

let connected = false;
let currTrack, currTournament, currTimes, playerList, mancheList;
let currManche = 0, currRound = 0;

let timerIntervals = [], timerSeconds = [];
let pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];

const init = () => {
	// TODO
	currTrack = configuration.readSettings('track');
	currTournament = configuration.readSettings('tournament');
};

const guiInit = () => {

	$('#curr-manche').text(currManche+1);
	$('#curr-round').text(currRound+1);

	$('#name-lane0').text(playerList[mancheList[currManche][currRound][0]] || '-');
	$('#name-lane1').text(playerList[mancheList[currManche][currRound][1]] || '-');
	$('#name-lane2').text(playerList[mancheList[currManche][currRound][2]] || '-');
};

const showTrackDetails = (o) => {
	$('#js-track-length').val(o.length || '-');
	$('#js-track-changers').val(o.changers || '-');
	$('#js-track-order').val(o.order || '-');
};

const showTournamentDetails = (o) => {
	$('#js-tournament-players').val(o.players.length || '-');
	$('#js-tournament-manches').val(o.manches.length || '-');
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

	chrono.init(mancheList[currManche][currRound], currTrack);
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

	chrono.init(mancheList[currManche][currRound], currTrack);
	guiInit();
});

// keyboard shortcuts for debug
if (debugMode) {
	document.onkeydown = (e) => {
		if (e.keyCode == 49 || e.keyCode == 97) {
			// pressed 1
			chronoAddLap(0);
		}
		else if (e.keyCode == 50 || e.keyCode == 98) {
			// pressed 2
			chronoAddLap(1);
		}
		else if (e.keyCode == 51 || e.keyCode == 99) {
			// pressed 3
			chronoAddLap(2);
		}
	};
}

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
		currTrack = obj;
		$('#tag-track-status').removeClass('is-danger');
		$('#tag-track-status').addClass('is-success');
		$('#tag-track-status').text(obj.code);
		configuration.saveSettings('track', currTrack);
	})
	.fail(() => {
		$('#js-input-track-code').addClass('is-danger');
		$('#tag-track-status').addClass('is-danger');
		$('#tag-track-status').removeClass('is-success');
		$('#tag-track-status').text('not loaded');
		currTrack = null;
	})
	.always(() => {
		showTrackDetails(currTrack);
		if (currTournament != null && currTrack != null) {
			chrono.init(mancheList[0][0], currTrack);
			guiInit();
		}
	});
});

// load tournament info from API
$('#js-load-tournament').on('click', (e) => {
	let code = $('#js-input-tournament-code').val();
	$('#js-input-tournament-code').removeClass('is-danger');
	$.getJSON('https://mini4wd-tournament.pimentoso.com/api/tournament/' + code)
	.done((obj) => {
		currTournament = obj;
		playerList = obj.players;
		mancheList = obj.manches;
		currTimes = []; // mirror of currTournament but holds the times
		$('#tag-tournament-status').removeClass('is-danger');
		$('#tag-tournament-status').addClass('is-success');
		$('#tag-tournament-status').text(obj.code);
		configuration.saveSettings('tournament', currTournament);
	})
	.fail(() => {
		$('#js-input-tournament-code').addClass('is-danger');
		$('#tag-tournament-status').addClass('is-danger');
		$('#tag-tournament-status').removeClass('is-success');
		$('#tag-tournament-status').text('not loaded');
		currTournament = null;
	})
	.always(() => {
		showTournamentDetails(currTournament);
		showPlayerList();
		showMancheList();
		if (currTournament != null && currTrack != null) {
			chrono.init(mancheList[0][0], currTrack);
			guiInit();
		}
	});
});

// ==========================================================================
// ==== write to interface

const updateRace = (cars) => {
	if (_.every(cars, (c) => { return c.outOfBounds || c.lapCount == 4; })) {
		// race finished
		if (currTimes[currManche] == null) {
			currTimes[currManche] = [];
		}
		currTimes[currManche][currRound] = [cars[0].currTime, cars[1].currTime, cars[2].currTime];
		saveRace();
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

const saveRace = () => {
	// TODO SALVARE SU LOCALSTORAGE
	// TRACK
	// TOURNAMENT
	// TIMES
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
};

const boardDisconnected = (msg) => {
	console.log('board_exit');
	connected = false;
	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
};

const sensorRead1 = (obj) => {
	if (obj == 0) {
		chronoAddLap(0);
	}
};

const sensorRead2 = (obj) => {
	if (obj == 0) {
		chronoAddLap(1);
	}
};

const sensorRead3 = (obj) => {
	if (obj == 0) {
		chronoAddLap(2);
	}
};

module.exports = {
	boardConnected: boardConnected,
	boardDisconnected: boardDisconnected,
	sensorRead1: sensorRead1,
	sensorRead2: sensorRead2,
	sensorRead3: sensorRead3,
	updateRace: updateRace,
	drawRace: drawRace,
	saveRace: saveRace
};
