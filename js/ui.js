'use strict';

const serialport = require('serialport');
const strftime = require('strftime');
const utils = require('./utils');
const i18n = new (require('../i18n/i18n'))();
const configuration = require('./configuration');
configuration.init();
const storage = require('./storage');

const boardConnected = () => {
	$('#tag-board-status').removeClass('is-danger');
	$('#tag-board-status').addClass('is-success');
	$('#tag-board-status').text(i18n.__('tag-connected'));
};

const boardDisonnected = () => {
	$('#tag-board-status').removeClass('is-success');
	$('#tag-board-status').addClass('is-danger');
	$('#tag-board-status').text(i18n.__('tag-disconnected'));
};

const translate = () => {
	$('.tn').each(function () {
		$(this).html(i18n.__($(this).data('tn')));
	});
};

const gotoTab = (tab) => {
	$('.tabs li').removeClass('is-active');
	$(`li[data-tab=${tab}]`).addClass('is-active');

	$('div[data-tab]').hide();
	$(`div[data-tab=${tab}]`).show();
};

const init = () => {
	let title_text = _.compact([configuration.get('title'), storage.get('name')]).join(' - ');
	$('#js-title').text(title_text);

	$('#js-race-name').text(storage.get('name') || i18n.__('label-untitled'));
	$('#js-race-created').text(`${i18n.__('label-created')} ${strftime('%Y-%m-%d, %H:%M', new Date(storage.get('created') * 1000))}`);
	$('#js-settings-time-threshold').val(storage.get('timeThreshold'));
	$('#js-settings-speed-threshold').val(storage.get('speedThreshold'));
	$('#js-settings-start-delay').val(storage.get('startDelay'));
	$('#js-settings-round-laps').val(storage.get('roundLaps'));
	showRaceModeDetails();

	$('.js-led-animation').removeClass('is-primary');
	$(`#js-led-animation-${configuration.get('ledAnimation')}`).addClass('is-primary');
	$('.js-led-type').removeClass('is-primary');
	$(`#js-led-type-${configuration.get('ledType')}`).addClass('is-primary');
	$('#js-config-reverse').prop('checked', configuration.get('reverse') > 0);
	$('#js-config-sensor-pin-1').val(configuration.get('sensorPin1'));
	$('#js-config-sensor-pin-2').val(configuration.get('sensorPin2'));
	$('#js-config-sensor-pin-3').val(configuration.get('sensorPin3'));
	$('#js-config-led-pin-1').val(configuration.get('ledPin1'));
	$('#js-config-led-pin-2').val(configuration.get('ledPin2'));
	$('#js-config-led-pin-3').val(configuration.get('ledPin3'));
	$('#js-config-piezo-pin').val(configuration.get('piezoPin'));
	$('#js-config-start-button-pin').val(configuration.get('startButtonPin'));
	$('#js-config-title').val(configuration.get('title'));
	$('#js-config-starting-tab').val(configuration.get('tab'));

	$('#button-toggle-free-round').hide();
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

	disableRaceInput(false);
	if (storage.get('race')) {
		disableRaceInput(true);
	}

	serialport.list().then(ports => {
		ports.forEach(function (port) {
			$('#js-config-usb-port').append($('<option>', {
				value: port.path,
				text: port.manufacturer ? `${port.path} (${port.manufacturer})` : port.path
			}));
			console.log(port.path);
		});
		$('#js-config-usb-port').val(configuration.get('usbPort'));
	});
};

const initModal = (modalId) => {
	if (modalId == 'modal-new') {
		$('#modal-new-name').val('');
		$('#modal-new-name').focus();
	}
	if (modalId == 'modal-open') {
		$('#modal-open-files').empty();
		let data = storage.getRecentFiles(50);
		if (data.length) {
			data.forEach((race) => {
				if (race.filename == configuration.get('raceFile')) {
					$('#modal-open-files').append(`
					<tr>
						<td style="width:165px;">${strftime('%Y-%m-%d, %H:%M', new Date(race.created * 1000))}</td>
						<td><span class="is-uppercase has-text-grey">${race.name || i18n.__('label-untitled')}</span></td>
						<td style="width:52px;"></td>
					<tr>`);
				}
				else {
					$('#modal-open-files').append(`
					<tr>
						<td style="width:165px;">${strftime('%Y-%m-%d, %H:%M', new Date(race.created * 1000))}</td>
						<td><a href="javascript:void(0)" class="js-load-race is-uppercase" data-filename="${race.filename}">${race.name || i18n.__('label-untitled')}</a></td>
						<td style="width:52px;"><a class="button is-small is-danger is-pulled-right js-delete-race is-uppercase" data-filename="${race.filename}">X</a></td>
					<tr>`);
				}
			});
		}
		else {
			$('#modal-open-files').append(`<tr><td><span class="is-uppercase has-text-grey">No files</span></td><tr>`);
		}
	}
};

const toggleFreeRound = (freeRound) => {
	if (freeRound) {
		$('#button-toggle-free-round').text(i18n.__('button-goto-race'));
	}
	else {
		$('#button-toggle-free-round').text(i18n.__('button-goto-free'));
	}
	updateUiState(freeRound);
	$('#button-toggle-free-round').trigger('blur');
};

const trackLoadDone = (track) => {
	$('#js-input-track-code').removeClass('is-danger');
	$('#tag-track-status').removeClass('is-danger');
	$('#tag-track-status').addClass('is-success');
	$('#tag-track-status').text(track.code);
};

const trackLoadFail = () => {
	$('#js-input-track-code').addClass('is-danger');
	$('#tag-track-status').addClass('is-danger');
	$('#tag-track-status').removeClass('is-success');
	$('#tag-track-status').text(i18n.__('tag-not-loaded'));
};

const tournamentLoadDone = (tournament) => {
	$('#button-toggle-free-round').show();
	$('#tag-tournament-status').removeClass('is-danger');
	$('#tag-tournament-status').addClass('is-success');
	$('#tag-tournament-status').text(tournament.code);
	$('#js-input-tournament-code').removeClass('is-danger');
	$('#js-input-tournament-code').val(tournament.code);
};

const tournamentLoadFail = () => {
	$('#js-input-tournament-code').addClass('is-danger');
	$('#tag-tournament-status').addClass('is-danger');
	$('#tag-tournament-status').removeClass('is-success');
	$('#tag-tournament-status').text(i18n.__('tag-not-loaded'));
};

const raceStarted = (freeRound) => {
	updateUiState(freeRound);
	$('.js-show-on-race-running').show();
	$('.js-hide-on-race-running').hide();
};

const raceFinished = (freeRound) => {
	updateUiState(freeRound);
	$('.js-show-on-race-running').hide();
	$('.js-hide-on-race-running').show();
	let tournament = storage.get('tournament');
	if (tournament) {
		disableRaceInput(true);
	}
};

const showTrackDetails = (track) => {
	if (track) {
		if (track.manual) {
			$('#js-input-track-code').val('');
			$('#js-track-length').text('-');
			$('#js-track-order').text('-');
			$('#js-link-track').attr('href', 'https://mini4wd-track-editor.pimentoso.com/');
			$('#js-track-length-manual').val(track.length);
			$('#js-track-order-manual').val(track.order.join('-'));
		}
		else {
			$('#js-input-track-code').val(track.url);
			$('#js-track-length').text(`${i18n.__('label-track-length')}: ${track.length} m`);
			$('#js-track-order').text(`${i18n.__('label-track-lane-order')}: ${track.order},1`);
			$('#js-link-track').attr('href', track.view_url);
			$('#js-track-length-manual').val('');
			$('#js-track-order-manual').val('');
		}
	}
	else {
		$('#js-track-length').text('-');
		$('#js-track-order').text('-');
		$('#js-link-track').attr('href', 'https://mini4wd-track-editor.pimentoso.com/');
	}
};

const showTournamentDetails = (tournament) => {
	if (tournament) {
		$('#js-input-tournament-code').val(tournament.url);
		$('#js-tournament-players').text(`${i18n.__('label-tournament-players')}: ${tournament.players.length}`);
		$('#js-tournament-manches').text(`${i18n.__('label-tournament-manches')}: ${tournament.manches.length}`);
		$('#js-link-tournament').attr('href', tournament.url);
	}
	else {
		$('#js-tournament-players').text('-');
		$('#js-tournament-manches').text('-');
		$('#js-link-tournament').attr('href', 'https://mini4wd-tournament.pimentoso.com/');
	}
};

const showThresholds = (timeThreshold, speedThreshold, roundLaps) => {
	let track = storage.get('track');
	if (track) {
		let rTrackLength = track.length;
		let rLaps = roundLaps || storage.get('roundLaps');
		let rTimeThreshold = (timeThreshold || storage.get('timeThreshold')) / 100;
		let rSpeedThreshold = speedThreshold || storage.get('speedThreshold');
		let estimatedTime = rTrackLength / rSpeedThreshold / 3 * rLaps;
		let estimatedCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold);
		if (estimatedCutoffMin < 1) estimatedCutoffMin = 1;
		let estimatedCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold);
		$('#js-settings-estimated-time').show();
		$('#js-settings-estimated-time').text(`${i18n.__('label-time-estimated')}: ${estimatedTime.toFixed(2)} sec`);
		$('#js-settings-estimated-cutoff-min').show();
		$('#js-settings-estimated-cutoff-max').show();
		$('#js-settings-estimated-cutoff-min').text(`${i18n.__('label-time-estimated-cutoff-min')} ${estimatedCutoffMin.toFixed(2)} sec`);
		$('#js-settings-estimated-cutoff-max').text(`${i18n.__('label-time-estimated-cutoff-max')} ${estimatedCutoffMax.toFixed(2)} sec`);

		let worstCaseTime = estimatedCutoffMax * rLaps;
		if (worstCaseTime >= 99.999) {
			$('#js-settings-time-warning').show();
		}
		else {
			$('#js-settings-time-warning').hide();
		}
	}
	else {
		$('#js-settings-estimated-time').hide();
		$('#js-settings-estimated-cutoff-min').hide();
		$('#js-settings-estimated-cutoff-max').hide();
		$('#js-settings-time-warning').hide();
	}
};

const showRaceModeDetails = () => {
	let race_mode = storage.get('raceMode');
	$('.js-race-mode').removeClass('is-primary');
	$(`#js-race-mode-${race_mode}`).addClass('is-primary');
	switch (race_mode) {
		case 0:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-time-attack-description'));
			break;
		case 1:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-final-description'));
			break;
		case 2:
			$('#js-race-mode-description').text(i18n.__('button-race-mode-endurance-description'));
			break;
	}
};

const showPlayerList = () => {
	let track = storage.get('track');
	let tournament = storage.get('tournament');
	let playerList = tournament.players;
	if (!track) return;
	if (!tournament) return;

	$('#tablePlayerList').empty();
	if (playerList.length > 0) {
		let times = storage.getSortedPlayerList();
		let raceBestTime = _.min(_.flatten(_.map(times, (info) => { return _.filter(info.times, (t) => { return t > 0 && t < 99999; }) })));

		// draw title row
		let titleCells = _.times(tournament.manches.length, (i) => {
			return `<td class="has-text-centered">Manche ${i + 1}</td>`;
		});
		titleCells.push(`<td class="has-text-centered">${i18n.__('label-best-2-times')}</td>`);
		titleCells.push(`<td class="has-text-centered">${i18n.__('label-best-speed')}</td>`);
		titleCells.push(`<td class="has-text-centered">${i18n.__('label-best-speed-km')}</td>`);
		$('#tablePlayerList').append(`<tr class="is-selected"><td colspan="2"><strong>${playerList.length} RACERS</strong></td>${titleCells}</tr>`);

		// draw player rows
		_.each(times, (info, pos) => {
			let bestTime = _.min(_.filter(info.times, (t) => { return t > 0 && t < 99999; }));
			let bestSpeed = track.length / (bestTime / 1000);
			let cells = [];
			cells.push(`<td class="has-text-centered"><span class="tag is-large ${_.contains([0, 1, 2], pos) ? 'is-warning' : _.contains([3, 4, 5], pos) ? 'is-success' : ''}">${pos + 1}</span></td>`);
			cells.push(`<td><p class="is-uppercase">${playerList[info.id]}</p></td>`);
			cells.push(_.times(tournament.manches.length, (i) => {
				let playerTime = info.times[i] || 0;
				let highlight = '';
				if (playerTime == 0 || playerTime == 99999) {
					highlight = 'has-text-grey-light is-out';
				}
				else if (playerTime == raceBestTime) {
					highlight = 'has-background-danger has-text-white is-race-best';
				}
				else if (playerTime == bestTime) {
					highlight = 'has-text-danger is-player-best';
				}
				return `<td class="has-text-centered ${highlight}">${utils.prettyTime(playerTime)}</td>`;
			}));
			cells.push(`<td class="has-text-centered">${utils.prettyTime(info.best)}</td>`);
			cells.push(`<td class="has-text-centered">${bestSpeed.toFixed(2)}</td>`);
			cells.push(`<td class="has-text-centered">${(bestSpeed * 3.6).toFixed(2)}</td>`);
			$('#tablePlayerList').append(`<tr>${cells}</tr>`);
		});
	}
};

const showMancheList = () => {
	let track = storage.get('track');
	let tournament = storage.get('tournament');
	if (!track) return;
	if (!tournament) return;

	let currManche = storage.get('currManche');
	let currRound = storage.get('currRound');
	let playerList = tournament.players;
	let mancheList = storage.getManches();

	$('#tableMancheList').empty();
	let cars, mancheText, playerName, playerTime, playerPosition, playerOut, playerNameTag, playerPositionTag, playerHeader, playerForm, highlight, isCurrentRound, gotoButton;
	_.each(mancheList, (manche, mindex) => {
		$('#tableMancheList').append(`<tr class="is-selected"><td><strong>${mancheName(mindex)}</strong></td><td>Lane 1</td><td>Lane 2</td><td>Lane 3</td></tr>`);
		_.each(manche, (group, rindex) => {
			cars = storage.loadRound(mindex, rindex);
			mancheText = _.map(group, (id, pindex) => {

				playerName = playerList[id];
				if (playerName) {
					if (cars) {
						playerTime = cars[pindex].currTime;
						playerPosition = cars[pindex].position;
						playerOut = cars[pindex].outOfBounds;
					}
					else {
						playerTime = 0;
						playerPosition = null;
						playerOut = false;
					}

					playerNameTag = `<span class="tag is-large is-uppercase">${playerList[id] || ''}</span>`;
					playerPositionTag = ``;

					if (playerPosition != null) {
						if (cars[pindex].originalTime != null) {
							playerPositionTag = `<span class="tag is-danger is-large">mod</span>`;
						}
						else if (playerOut) {
							playerPositionTag = `<span class="tag is-dark is-large">out</span>`;
						}
						else if (playerPosition == 1) {
							playerPositionTag = `<span class="tag is-warning is-large">${playerPosition}</span>`;
						}
						else {
							playerPositionTag = `<span class="tag is-large">${playerPosition}</span>`;
						}
					}

					playerHeader = `<div style="display: flex; justify-content: center; margin-bottom: 5px;"><div class="tags has-addons">${playerNameTag}${playerPositionTag}</div></div>`;
					playerForm = `<div class="field"><div class="control"><input class="input is-large js-time-form" type="text" data-manche="${mindex}" data-round="${rindex}" data-player="${pindex}" value="${utils.prettyTime(playerTime)}" /></div></div>`;

					return `<td>${playerHeader}${playerForm}</td>`;
				}
				else {
					return `<td></td>`;
				}
			}).join();
			isCurrentRound = (mindex == currManche && rindex == currRound);
			highlight = isCurrentRound ? 'class="is-highlighted"' : '';
			gotoButton = isCurrentRound ? '' : `<button class="button is-small is-info is-light js-goto-round tn" data-tn="button-goto-round" data-manche="${mindex}" data-round="${rindex}">&lt; play this</button>`;
			$('#tableMancheList').append(`<tr ${highlight}><td class="has-text-centered">Round ${mindex + 1}-${rindex + 1}<br />${gotoButton}</td>${mancheText}</tr>`);
		});
	});
	translate();
};

const showNextRoundNames = () => {
	let currManche = storage.get('currManche');
	let currRound = storage.get('currRound');
	let tournament = storage.get('tournament');
	let playerList = tournament.players;
	let mancheList = storage.getManches();

	let r = currRound, m = currManche, names;
	let label = i18n.__('label-next-round');
	r += 1;
	if (r == mancheList[currManche].length) {
		m++;
		r = 0;
		label = i18n.__('label-next-round-end');
	}

	if (m == mancheList.length) {
		names = ['-'];
	}
	else {
		names = _.filter([playerList[mancheList[m][r][0]], playerList[mancheList[m][r][1]], playerList[mancheList[m][r][2]]], (n) => { return n; });
	}

	$('#next-round-names').text(`${label} ${names.join(', ').toUpperCase()}`);
};

const mancheName = (mindex) => {
	let tournament = storage.get('tournament');
	let mancheList = storage.getManches();

	if (mindex == tournament.mancheCount) {
		return (mindex < mancheList.length) ? 'FINAL 4-5-6 PLACE' : 'FINAL 1-2-3 PLACE';
	}
	else if (mindex == tournament.mancheCount + 1) {
		return 'FINAL 1-2-3 PLACE';
	}
	else {
		return `MANCHE ${mindex + 1}`;
	}
};

const initRace = (freeRound) => {
	let tournament = storage.get('tournament');
	let currManche = storage.get('currManche');
	let currRound = storage.get('currRound');

	updateUiState(freeRound);
	$('.js-show-on-race-running').hide();

	if (tournament == null) {
		$('#name-lane0').text(' ');
		$('#name-lane1').text(' ');
		$('#name-lane2').text(' ');
		$('#curr-manche').text('0');
		$('#curr-round').text('0');
	}
	else if (freeRound) {
		$('#name-lane0').text(' ');
		$('#name-lane1').text(' ');
		$('#name-lane2').text(' ');
	}
	else {
		let playerList = tournament.players;
		let mancheList = storage.getManches();
		$('#name-lane0').text(playerList[mancheList[currManche][currRound][0]] || '//');
		$('#name-lane1').text(playerList[mancheList[currManche][currRound][1]] || '//');
		$('#name-lane2').text(playerList[mancheList[currManche][currRound][2]] || '//');
		$('#curr-manche').text(mancheName(currManche));
		$('#curr-round').text(`ROUND ${currRound + 1}`);
		showNextRoundNames();
		showPlayerList();
		showMancheList();
	}
};

const drawRace = (cars, running) => {
	$('.js-place').removeClass('is-dark is-light is-primary is-warning');
	$('.js-delay').removeClass('is-danger');
	$('.js-timer').removeClass('is-danger is-success');

	let track = storage.get('track');
	let laps = storage.get('roundLaps');

	_.each(cars, (car, i) => {
		// delay + speed
		if (car.outOfBounds) {
			$(`#delay-lane${i}`).text('+99.999');
			// $(`#speed-lane${i}`).text('0.00 m/s');
		}
		else {
			$(`#delay-lane${i}`).text(`+${utils.prettyTime(car.delayFromFirst)}`);
			if (car.delayFromFirst > 0) {
				$(`#delay-lane${i}`).addClass('is-danger');
			}
			if (car.lapCount > 1) {
				$(`#speed-lane${i}`).text(`${car.speed.toFixed(2)} m/s`);
			}
			else {
				$(`#speed-lane${i}`).text('0.00 m/s');
			}
		}

		// lap count
		if (car.lapCount > laps) {
			$(`#lap-lane${i}`).text(i18n.__('label-car-finish'));
		}
		else {
			$(`#lap-lane${i}`).text(`${i18n.__('label-car-lap')} ${car.lapCount}`);
		}

		// split times
		$(`#laps-lane${i}`).empty();
		_.each(car.splitTimes, (t, ii) => {
			let time = utils.prettyTime(t);
			let speed = (track.length / 3) / (t / 1000);
			$(`#laps-lane${i}`).append(`<li class="is-size-5">${i18n.__('label-car-lap')} ${ii + 1} - <strong>${time}s</strong> - ${speed.toFixed(2)}m/s</li>`);
		});

		// place
		if (car.outOfBounds) {
			$(`#place-lane${i}`).text(i18n.__('label-car-out'));
			$(`#place-lane${i}`).addClass('is-dark');
		}
		else if (car.lapCount == 0) {
			if (running) {
				$(`#place-lane${i}`).text(i18n.__('label-car-ready'));
			}
			else {
				$(`#place-lane${i}`).text(i18n.__('label-car-stopped'));
			}
			$(`#place-lane${i}`).addClass('is-light');
		}
		else if (car.lapCount == 1) {
			$(`#place-lane${i}`).text(i18n.__('label-car-started'));
			$(`#place-lane${i}`).addClass('is-light');
		}
		else {
			$(`#place-lane${i}`).text(`${car.position} ${i18n.__('label-car-position')}`);
			if (car.position == 1) {
				$(`#place-lane${i}`).addClass('is-warning');
			}
			else {
				$(`#place-lane${i}`).addClass('is-primary');
			}
		}

		// timer
		if (car.outOfBounds) {
			$(`#timer-lane${i}`).addClass('is-danger');
			$(`#timer-lane${i}`).text(utils.prettyTime(car.currTime));
		}
		else if (car.lapCount == 0) {
			$(`#timer-lane${i}`).text(utils.prettyTime(0));
		}
		else if (car.lapCount > laps) {
			$(`#timer-lane${i}`).addClass('is-success');
			$(`#timer-lane${i}`).text(utils.prettyTime(car.currTime));
		}

		// scroll to bottom
		if (running) {
			window.scrollTo(0, document.body.scrollHeight);
		}
	});
};

const disableRaceInput = (disabled) => {
	$('#js-input-tournament-code').prop('disabled', disabled);
	$('#js-load-tournament').prop('disabled', disabled);
	$('#js-input-track-code').prop('disabled', disabled);
	$('#js-load-track').prop('disabled', disabled);
	$('#js-track-length-manual').prop('disabled', disabled);
	$('#js-track-order-manual').prop('disabled', disabled);
	$('#js-track-save-manual').prop('disabled', disabled);
	$('#js-settings-round-laps').prop('disabled', disabled);
};

const updateUiState = (freeRound) => {
	let track = storage.get('track');
	let tournament = storage.get('tournament');

	if (track == null) {
		$('.js-show-on-no-track').show();
		$('.js-hide-on-no-track').hide();
		$('.js-show-on-no-tournament').show();
		$('.js-hide-on-no-tournament').hide();
	}
	else {
		$('.js-show-on-no-track').hide();
		$('.js-hide-on-no-track').show();

		if (tournament) {
			$('.js-show-on-no-tournament').hide();
			$('.js-hide-on-no-tournament').show();
		}
		else {
			$('.js-show-on-no-tournament').show();
			$('.js-hide-on-no-tournament').hide();
		}

		if (freeRound === true) {
			$('.js-show-on-free-round').show();
			$('.js-hide-on-free-round').hide();
		}
		else if (freeRound === false) {
			$('.js-show-on-free-round').hide();
			$('.js-hide-on-free-round').show();
		}
	}
};

module.exports = {
	boardConnected: boardConnected,
	boardDisonnected: boardDisonnected,
	translate: translate,
	gotoTab: gotoTab,
	init: init,
	initModal: initModal,
	toggleFreeRound: toggleFreeRound,
	trackLoadDone: trackLoadDone,
	trackLoadFail: trackLoadFail,
	tournamentLoadDone: tournamentLoadDone,
	tournamentLoadFail: tournamentLoadFail,
	raceStarted: raceStarted,
	raceFinished: raceFinished,
	showTrackDetails: showTrackDetails,
	showTournamentDetails: showTournamentDetails,
	showThresholds: showThresholds,
	showRaceModeDetails: showRaceModeDetails,
	showPlayerList: showPlayerList,
	showMancheList: showMancheList,
	showNextRoundNames: showNextRoundNames,
	initRace: initRace,
	drawRace: drawRace
};
