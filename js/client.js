'use strict';

const { dialog } = require('electron').remote
const serialport = require('serialport');
const utils = require('./utils');
const configuration = require('./configuration');
const chrono = require('./chrono');
const xls = require('./export');
const i18n = new(require('../i18n/i18n'));
const clone = require('clone');

var currTrack, currTournament;
var playerList, mancheList, mancheCount, playerTimes;
var currManche = 0, currRound = 0, raceRunning = false, freeRound = true;

var timerIntervals = [], timerSeconds = [];
var pageTimerSeconds = [$('#timer-lane0'), $('#timer-lane1'), $('#timer-lane2')];
var checkRaceTask;

const init = () => {
	console.log('client.init called');

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
	$('#js-config-title').val(configuration.readSettings('title'));

	$('#button-toggle-free-round').hide();

	serialport.list(function (err, ports) {
		ports.forEach(function(port) {
			$('#js-config-usb-port').append($('<option>', {
				value: port.comName,
				text: port.comName
			}));
			console.log(port.comName);
		});
		$('#js-config-usb-port').val(configuration.readSettings('usbPort'));
	});

	// translate ui
	$('.tn').each(function(index) {
		$(this).text(i18n.__($(this).data('tn')));
	});

	// read stuff from settings
	playerTimes = configuration.readSettings('playerTimes') || [];
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

	playerTimes = [];
	playerList = [];
	mancheList = [];
	currManche = 0;
	currRound = 0;
	currTrack = null;
	currTournament = null;
	raceRunning = false;

	configuration.deleteSettings('mancheTimes');
	configuration.deleteSettings('playerTimes');
	configuration.deleteSettings('track');
	configuration.deleteSettings('tournament');
	configuration.deleteSettings('race');
	configuration.saveSettings('currManche', currManche);
	configuration.saveSettings('currRound', currRound);

	$('#js-input-track-code').removeClass('is-danger');
	$('#js-input-track-code').val('');
	$('#js-track-order-manual').val('');
	$('#js-track-length-manual').val('');
	$('#js-input-tournament-code').removeClass('is-danger');
	$('#js-input-tournament-code').val('');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text(i18n.__('tag-not-loaded'));
	$('#tag-tournament-status').addClass('is-danger');
	$('#tag-tournament-status').removeClass('is-success');
	$('#tag-tournament-status').text(i18n.__('tag-not-loaded'));

	initTimeList();
	showTrackDetails();
	showTournamentDetails();
};

const guiInit = () => {
	console.log('client.guiInit called');

	$('.js-show-on-race-started').hide();
	$('.js-hide-on-race-started').show();

	if (currTrack == null) {
		$('.js-show-on-no-track').show();
		$('.js-hide-on-no-track').hide();
	}
	else {
		$('.js-show-on-no-track').hide();
		$('.js-hide-on-no-track').show();
	}

	if (currTournament == null) {
		$('.js-show-on-no-tournament').show();
		$('.js-hide-on-no-tournament').hide();
		$('#name-lane0').text(' ');
		$('#name-lane1').text(' ');
		$('#name-lane2').text(' ');
		$('#curr-manche').text('0');
		$('#curr-round').text('0');
	}
	else if (freeRound) {
		$('.js-show-on-free-round').show();
		$('.js-hide-on-free-round').hide();
		$('#name-lane0').text(' ');
		$('#name-lane1').text(' ');
		$('#name-lane2').text(' ');
		$('#curr-manche').text('0');
		$('#curr-round').text('0');
		showPlayerList();
		showMancheList();
	}
	else {
		$('.js-show-on-no-tournament').hide();
		$('.js-hide-on-no-tournament').show();
		$('#name-lane0').text(playerList[mancheList[currManche][currRound][0]] || '//');
		$('#name-lane1').text(playerList[mancheList[currManche][currRound][1]] || '//');
		$('#name-lane2').text(playerList[mancheList[currManche][currRound][2]] || '//');
		$('#curr-manche').text(mancheName());
		$('#curr-round').text(`ROUND ${currRound+1}`);
		showNextRoundNames();
		showPlayerList();
		showMancheList();
		drawRace(true);
	}
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
	let cars = configuration.loadRound(mindex, rindex);
	cars[pindex].currTime = 99999;
	configuration.saveRound(mindex, rindex, cars);
	// $('#invalidate-' + pindex).attr('disabled', true); TODO

	rebuildTimeList();
	guiInit();
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
	guiInit();
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

const getSortedPlayerList = () => {
	// calculate best time sums
	let sums = [], times, pTimes, bestTimes, bestSum;
	_.each(playerList, (_player,pindex) => {
		pTimes = playerTimes[pindex] || [];
		bestTimes = _.filter(pTimes, (t) => { return t > 0; }).sort().slice(0,2);
		bestSum = (bestTimes[0] || 99999) + (bestTimes[1] || 99999);
		sums[pindex] = bestSum;
	});

	// sort list by sum desc
	times = _.map(playerTimes, (times, index) => {
		return {
			id: index,
			times: times || [],
			best: sums[index]
		};
	});
	return _.sortBy(times, 'best');
};

const initFinal = () => {
	console.log('client.initFinal called');

	let ids = _.map(getSortedPlayerList(), (t) => { return t.id });

	// remove any previously generated finals
	mancheList = mancheList.slice(0, mancheCount);
	currTournament.finals = []

	// generate semifinal manche rounds
	if (playerList.length >= 5) {
		let semifinalPlayerIds = ids.slice(3,6);
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
	let finalPlayerIds = ids.slice(0,3);
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
		// tournament not loaded
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded')});
		return;
	}
	if (currManche == 0 && currRound == 0) {
		// first round, can't go back
		return;
	}

	if (dialog.showMessageBox({ type: 'warning', message: i18n.__('dialog-change-round'), buttons: ['Ok', 'Cancel']}) == 0) {
		currRound--;
		if (currRound < 0) {
			currManche--;
			currRound = mancheList[currManche].length-1;
		}

		configuration.saveSettings('currManche', currManche);
		configuration.saveSettings('currRound', currRound);
		chronoInit();
		guiInit();
	}
};

const nextRound = () => {
	console.log('client.nextRound called');

	if (currTournament == null || currTrack == null) {
		// tournament not loaded
		dialog.showMessageBox({ type: 'error', title: 'Error', message: i18n.__('dialog-tournament-not-loaded')});
		return;
	}

	if (currTournament.finals && currManche == (mancheCount+currTournament.finals.length-1) && currRound == 2) {
		// end of finals
		return;
	}

	let dialogText = (currManche == (mancheCount-1) && currRound == (mancheList[currManche].length-1)) ? i18n.__('dialog-enter-final') : i18n.__('dialog-change-round');
	if (dialog.showMessageBox({ type: 'warning', message: dialogText, buttons: ['Ok', 'Cancel']}) == 0) {
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
		guiInit();
	}
};

const isFreeRound = () => freeRound;

const toggleFreeRound = () => {
	if (freeRound) {
		freeRound = false;
		$('#button-toggle-free-round').text(i18n.__('button-goto-free'));
		$('#button-prev').show();
		$('#button-next').show();
		chronoInit();
	}
	else {
		freeRound = true;
		$('#button-toggle-free-round').text(i18n.__('button-goto-race'));
		$('#button-prev').hide();
		$('#button-next').hide();
		chronoInit(true);
	}
	guiInit();
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
	console.log('client.trackLoadDone called');

	currTrack = obj;
	$('#js-input-track-code').removeClass('is-danger');
	$('#tag-track-status').removeClass('is-danger');
	$('#tag-track-status').addClass('is-success');
	$('#tag-track-status').text(obj.code);
	showTrackDetails();
};

const trackLoadFail = () => {
	console.log('client.trackLoadFail called');

	currTrack = null;
	$('#js-input-track-code').addClass('is-danger');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text(i18n.__('tag-not-loaded'));
	showTrackDetails();
};

const tournamentLoadDone = (obj) => {
	console.log('client.tournamentLoadDone called');

	currTournament = obj;
	playerList = clone(obj.players);
	mancheList = clone(obj.manches);
	mancheCount = mancheList.length;

	if (obj.finals) {
		mancheList.push(...clone(obj.finals));
	}

	freeRound = false;
	$('#button-toggle-free-round').show();
	initTimeList();
	$('#tag-tournament-status').removeClass('is-danger');
	$('#tag-tournament-status').addClass('is-success');
	$('#tag-tournament-status').text(obj.code);
	$('#js-input-tournament-code').val(obj.code);
};

const tournamentLoadFail = () => {
	console.log('client.tournamentLoadFail called');

	currTournament = null;
	$('#js-input-tournament-code').addClass('is-danger');
	$('#tag-tournament-status').addClass('is-danger');
	$('#tag-tournament-status').removeClass('is-success');
	$('#tag-tournament-status').text(i18n.__('tag-not-loaded'));
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

// called when a round is started. Handles UI changes
const raceStarted = () => {
	$('.js-show-on-race-started').show();
	$('.js-hide-on-race-started').hide();
	$('.js-disable-on-race-started').attr('disabled', true);
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

		showPlayerList();
		showMancheList();
	}

	raceRunning = false;
	$('.js-show-on-race-started').hide();
	$('.js-hide-on-race-started').show();
	$('.js-disable-on-race-started').removeAttr('disabled');
};

// ==========================================================================
// ==== write to interface

const showTrackDetails = () => {
	console.log('client.showTrackDetails called');

	if (currTrack) {
		if (currTrack.manual) {
			$('#js-input-track-code').val('');
			$('#js-track-length').text('-');
			$('#js-track-order').text('-');
			$('#js-link-track').attr('href', 'https://mini4wd-track-editor.pimentoso.com/');
			$('#js-track-length-manual').val(currTrack.length);
			$('#js-track-order-manual').val(currTrack.order.join('-'));
		}
		else {
			$('#js-input-track-code').val(currTrack.url);
			$('#js-track-length').text(i18n.__('label-track-length') + ': ' + currTrack.length + ' m');
			$('#js-track-order').text(i18n.__('label-track-lane-order') + ': ' + currTrack.order + ',1');
			$('#js-link-track').attr('href', currTrack.view_url);
			$('#js-track-length-manual').val('');
			$('#js-track-order-manual').val('');
		}
	}
	else {
		$('#js-track-length').text('-');
		$('#js-track-order').text('-');
		$('#js-link-track').attr('href', 'https://mini4wd-track-editor.pimentoso.com/');
	}
	showThresholds();
	chronoInit(true);
	guiInit();
	drawRace();
};

const showTournamentDetails = () => {
	console.log('client.showTournamentDetails called');

	if (currTournament) {
		$('#js-input-tournament-code').val(currTournament.url);
		$('#js-tournament-players').text(i18n.__('label-tournament-players') + ': ' + currTournament.players.length);
		$('#js-tournament-manches').text(i18n.__('label-tournament-manches') + ': ' + currTournament.manches.length);
		$('#js-link-tournament').attr('href', currTournament.url);
	}
	else {
		$('#js-tournament-players').text('-');
		$('#js-tournament-manches').text('-');
		$('#js-link-tournament').attr('href', 'https://mini4wd-tournament.pimentoso.com/');
	}
	guiInit();
};

const showThresholds = () => {
	console.log('client.showThresholds called');

	if (currTrack) {
		let rTrackLength = currTrack.length;
		let rSpeedThreshold = configuration.readSettings('speedThreshold');
		let rTimeThreshold = configuration.readSettings('timeThreshold')/100;
		let estimatedTime = rTrackLength / rSpeedThreshold;
		let estimatedCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold);
		let estimatedCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold);
		$('#js-settings-estimated-time').show();
		$('#js-settings-estimated-time').text(i18n.__('label-time-estimated') + ': ' + estimatedTime.toFixed(3) + ' sec');
		$('#js-settings-estimated-cutoff').show();
		$('#js-settings-estimated-cutoff').text(i18n.__('label-time-estimated-cutoff') + ': min ' + estimatedCutoffMin.toFixed(3) + ' sec, max ' + estimatedCutoffMax.toFixed(3) + ' sec');
	}
	else {
		$('#js-settings-estimated-time').hide();
		$('#js-settings-estimated-cutoff').hide();
	}
};

// render the player list tab
const showPlayerList = () => {
	console.log('client.showPlayerList called');

	$('#tablePlayerList').empty();
	if (playerList.length > 0) {
		let times = getSortedPlayerList();

		// draw title row
		let titleCells = _.map(currTournament.manches, (_manche,mindex) => {
			return '<td>Manche ' + (mindex+1) + '</td>';
		});
		titleCells.push('<td>' + i18n.__('label-best-2-times') + '</td>');
		titleCells.push('<td>' + i18n.__('label-best-speed') + '</td>');
		$('#tablePlayerList').append('<tr class="is-selected"><td colspan="2"><strong>' + playerList.length + ' RACERS</strong></td>' + titleCells + '</tr>');

		// draw player rows
		_.each(times, (info) => {
			let bestTime =  _.min(_.filter(info.times, (t) => { return t > 0 && t < 99999; }));
			let bestSpeed = currTrack.length / (bestTime/1000);
			let timeCells = _.map(currTournament.manches, (_manche,mindex) => {
				let playerTime = info.times[mindex] || 0;
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
				return '<td class="' + highlight + '">' + utils.prettyTime(playerTime) + '</td>';
			});
			timeCells.push('<td>' + utils.prettyTime(info.best) + '</td>');
			timeCells.push('<td>' + bestSpeed.toFixed(2) + ' m/s</td>');
			$('#tablePlayerList').append('<tr><td>' + (info.id+1) + '</td><td><p class="has-text-centered is-uppercase">' + playerList[info.id] + '</p></td>' + timeCells + '</tr>');
		});
	}
};

// render the manches list tab
const showMancheList = () => {
	console.log('client.showManchesList called');

	$('#tableMancheList').empty();
	let cars, mancheText, playerName, playerTime, playerPosition, playerForm, highlight;
	_.each(mancheList, (manche, mindex) => {
		$('#tableMancheList').append(`<tr class="is-selected"><td><strong>${mancheName(mindex)}</strong></td><td>Lane 1</td><td>Lane 2</td><td>Lane 3</td></tr>`);
		_.each(manche, (group, rindex) => {
			cars = configuration.loadRound(mindex, rindex);
			mancheText = _.map(group, (id, pindex) => {
				if (cars) {
					playerTime = cars[pindex].currTime;
					playerPosition = cars[pindex].position;
				}
				else {
					playerTime = 0;
					playerPosition = null;
				}
				if (playerList[id]) {
					if (playerPosition && playerPosition > 0) {
						playerPosition = `<span class="tag is-warning is-rounded">${playerPosition}</span>`;
					}
					playerName = `<p class="has-text-centered is-uppercase">${playerList[id] || ''} ${playerPosition || ''}</p>`;
					playerForm = `<div class="field"><div class="control"><input class="input is-large js-time-form" type="text" data-manche="${mindex}" data-round="${rindex}" data-player="${pindex}" value="${utils.prettyTime(playerTime)}"></div></div>`;
				}
				else {
					playerName = '';
					playerForm = '';
				}
				return `<td>${playerName}${playerForm}</td>`;
			}).join();
			highlight = (mindex == currManche && rindex == currRound) ? 'class="is-highlighted"' : '';
			$('#tableMancheList').append(`<tr ${highlight}><td>Round ${rindex+1}</td>${mancheText}</tr>`);
		});
	});
};

const showNextRoundNames = () => {
	let r = currRound, m = currManche, text;
	r += 1;
	if (r == mancheList[m].length) {
		m++;
		r = 0;
	}

	if (m == mancheList.length) {
		text = '-';
	}
	else {
		text = _.filter([playerList[mancheList[m][r][0]], playerList[mancheList[m][r][1]], playerList[mancheList[m][r][2]]], (n) => {
			return n;
		}).join(', ');
	}

	$('#next-round-names').text(text);
};

const mancheName = (mindex) => {
	mindex = mindex || currManche;

	if (mindex == mancheCount) {
		return (mindex < mancheList.length) ? 'FINAL 4-5-6 PLACE' : 'FINAL 1-2-3 PLACE';
	}
	else if (mindex == mancheCount+1) {
		return 'FINAL 1-2-3 PLACE';
	}
	else {
		return `MANCHE ${mindex+1}`;
	}
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
		xls.geneateXls(currTournament.manches.length, playerList, playerTimes);
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

	chrono.addLap(lane-1);
	if (chrono.isRaceFinished()) {
		raceFinished();
	}
	drawRace();
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
	raceStarted: raceStarted,
	initRound: initRound,
	startRound: startRound,
	stopRound: stopRound,
	prevRound: prevRound,
	nextRound: nextRound,
	isFreeRound: isFreeRound,
	toggleFreeRound: toggleFreeRound,
	showMancheList: showMancheList,
	showPlayerList: showPlayerList,
	showThresholds: showThresholds
};
