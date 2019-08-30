'use strict';

const serialport = require('serialport');
const utils = require('./utils');
const configuration = require('./configuration');
const i18n = new (require('../i18n/i18n'));

const initialize = () => {
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

    serialport.list(function (_err, ports) {
        ports.forEach(function (port) {
            $('#js-config-usb-port').append($('<option>', {
                value: port.comName,
                text: port.comName
            }));
            console.log(port.comName);
        });
        $('#js-config-usb-port').val(configuration.readSettings('usbPort'));
    });
};

const reset = () => {
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
};

const toggleFreeRound = (freeRound) => {
    if (freeRound) {
		$('#button-toggle-free-round').text(i18n.__('button-goto-free'));
		$('#button-prev').show();
		$('#button-next').show();
	}
	else {
		$('#button-toggle-free-round').text(i18n.__('button-goto-race'));
		$('#button-prev').hide();
		$('#button-next').hide();
	}
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

const raceStarted = () => {
	$('.js-show-on-race-started').show();
	$('.js-hide-on-race-started').hide();
	$('.js-disable-on-race-started').attr('disabled', true);
};

const raceFinished = () => {
	$('.js-show-on-race-started').hide();
	$('.js-hide-on-race-started').show();
	$('.js-disable-on-race-started').removeAttr('disabled');
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
			$('#js-track-length').text(i18n.__('label-track-length') + ': ' + track.length + ' m');
			$('#js-track-order').text(i18n.__('label-track-lane-order') + ': ' + track.order + ',1');
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
		$('#js-tournament-players').text(i18n.__('label-tournament-players') + ': ' + tournament.players.length);
		$('#js-tournament-manches').text(i18n.__('label-tournament-manches') + ': ' + tournament.manches.length);
		$('#js-link-tournament').attr('href', tournament.url);
	}
	else {
		$('#js-tournament-players').text('-');
		$('#js-tournament-manches').text('-');
		$('#js-link-tournament').attr('href', 'https://mini4wd-tournament.pimentoso.com/');
	}
};

const showThresholds = () => {
	let track = configuration.readSettings('track');
    if (track) {
		let rTrackLength = track.length;
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

const showPlayerList = () => {
	let track = configuration.readSettings('track');
	let tournament = configuration.readSettings('tournament');
    let playerList = tournament.players;

	$('#tablePlayerList').empty();
	if (playerList.length > 0) {
		let times = getSortedPlayerList();

		// draw title row
		let titleCells = _.map(tournament.manches, (_manche,mindex) => {
			return '<td>Manche ' + (mindex+1) + '</td>';
		});
		titleCells.push('<td>' + i18n.__('label-best-2-times') + '</td>');
		titleCells.push('<td>' + i18n.__('label-best-speed') + '</td>');
		$('#tablePlayerList').append('<tr class="is-selected"><td colspan="2"><strong>' + playerList.length + ' RACERS</strong></td>' + titleCells + '</tr>');

		// draw player rows
		_.each(times, (info) => {
			let bestTime =  _.min(_.filter(info.times, (t) => { return t > 0 && t < 99999; }));
			let bestSpeed = track.length / (bestTime/1000);
			let timeCells = _.map(tournament.manches, (_manche,mindex) => {
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

const showMancheList = () => {
	let tournament = configuration.readSettings('tournament');
	let currManche = configuration.readSettings('currManche');
    let currRound = configuration.readSettings('currRound');
    let playerList = tournament.players;
    let mancheList = tournament.manches;

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
	let tournament = configuration.readSettings('tournament');
	let currManche = configuration.readSettings('currManche');
    let currRound = configuration.readSettings('currRound');
    let playerList = tournament.players;
    let mancheList = tournament.manches;

	let r = currRound, m = currManche, text;
	r += 1;
	if (r == mancheList[0].length) {
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

// TODO move to client?
const getSortedPlayerList = () => {
	let playerTimes = configuration.readSettings('playerTimes');

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

const initRace = (freeRound) => {
	let track = configuration.readSettings('track');
	let tournament = configuration.readSettings('tournament');
	let currManche = configuration.readSettings('currManche');
    let currRound = configuration.readSettings('currRound');

	$('.js-show-on-race-started').hide();
	$('.js-hide-on-race-started').show();

	if (track == null) {
		$('.js-show-on-no-track').show();
		$('.js-hide-on-no-track').hide();
	}
	else {
		$('.js-show-on-no-track').hide();
		$('.js-hide-on-no-track').show();
	}

	if (tournament == null) {
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
        let playerList = tournament.players;
        let mancheList = tournament.manches;

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

const drawRace = (cars) => {
	$('.js-place').removeClass('is-dark is-light is-primary is-warning');
	$('.js-delay').removeClass('is-danger');
	$('.js-timer').removeClass('is-danger is-success');

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

module.exports = {
    initialize: initialize,
    reset: reset,
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
    showPlayerList: showPlayerList,
    showMancheList: showMancheList,
	showNextRoundNames: showNextRoundNames,
	getSortedPlayerList: getSortedPlayerList,
    initRace: initRace,
    drawRace: drawRace

};
