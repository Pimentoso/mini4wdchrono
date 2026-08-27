'use strict';

const strftime = require('strftime');
const utils = require('./utils');
const i18n = new (require('../i18n/i18n'))();
const configuration = require('./configuration');
const storage = require('./storage');

// Updates the board status UI after a successful connection.
const boardConnected = () => {
    $('#tag-board-status').removeClass('is-danger');
    $('#tag-board-status').addClass('is-success');
    $('#tag-board-status').text(i18n.__('tag-connected'));
    $('#hardware-loading').hide();
    $('#main').show();
};

// Shows the application without a hardware connection in debug mode.
const debugModeEnabled = () => {
    $('#tag-board-status').removeClass('is-danger is-success');
    $('#tag-board-status').addClass('is-warning');
    $('#tag-board-status').text(i18n.__('tag-debug-mode'));
    $('#hardware-loading').hide();
    $('#main').show();
};

// Updates the board status UI after a disconnection.
const boardDisconnected = () => {
    $('#tag-board-status').removeClass('is-success is-warning');
    $('#tag-board-status').addClass('is-danger');
    $('#tag-board-status').text(i18n.__('tag-disconnected'));
    $('#main').hide();
    $('#hardware-loading').show();
};

// Translates all elements marked for localization.
const translate = () => {
    $('.tn').each(function () {
        $(this).html(i18n.__($(this).data('tn')));
    });
};

// Activates the requested application tab.
const gotoTab = (tab) => {
    $('.tabs li').removeClass('is-active');
    $(`li[data-tab=${tab}]`).addClass('is-active');

    $('div[data-tab]').hide();
    $(`div[data-tab=${tab}]`).show();
};

// Initializes UI controls from cached configuration and race data.
const init = () => {
    translate();

    const title_text = [configuration.get('title'), storage.get('name')]
        .filter((value) => value !== null && value !== undefined && value !== '')
        .join(' - ');
    $('#js-title').text(title_text);

    $('#js-race-name').text(storage.get('name') || i18n.__('label-untitled'));
    $('#js-race-created').text(`${i18n.__('label-created')} ${strftime('%Y-%m-%d, %H:%M', new Date(storage.get('created') * 1000))}`);
    $('#js-settings-time-threshold').val(storage.get('timeThreshold') || 40);
    $('#js-settings-speed-threshold').val(storage.get('speedThreshold') || 5);
    $('#js-settings-start-delay').val(storage.get('startDelay') || 3);
    $('#js-settings-round-laps').val(storage.get('roundLaps') || 3);
    showRaceModeDetails();

    $('.js-led-animation').removeClass('is-primary');
    $(`#js-led-animation-${configuration.get('ledAnimation')}`).addClass('is-primary');
    $('#js-config-reverse').prop('checked', configuration.get('reverse') > 0);
    $('#js-config-sensor-pin-1').val(configuration.get('sensorPin1'));
    $('#js-config-sensor-pin-2').val(configuration.get('sensorPin2'));
    $('#js-config-sensor-pin-3').val(configuration.get('sensorPin3'));
    $('#js-config-led-pin-1').val(configuration.get('ledPin1'));
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
    updateRaceStatus();

    disableRaceInput(false);
    if (storage.get('race')) {
        disableRaceInput(true);
    }

    window.electronAPI.hardwareListPorts().then(ports => {
        ports.forEach(function (port) {
            $('#js-config-usb-port').append($('<option>', {
                value: port.path,
                text: port.manufacturer ? `${port.path} (${port.manufacturer})` : port.path
            }));
        });
        $('#js-config-usb-port').val(configuration.get('usbPort'));
    });
};

// Counts all rounds that have already recorded a result.
const completedRoundCount = (mancheList) => {
    return mancheList.reduce((total, manche, mindex) => {
        return total + manche.reduce((roundTotal, _round, rindex) => {
            return roundTotal + (storage.loadRound(mindex, rindex) ? 1 : 0);
        }, 0);
    }, 0);
};

// Finds the best valid round time using the same data as the ranking table.
const findBestLap = () => {
    const tournament = storage.get('tournament');
    if (!tournament) return null;

    let bestLap = null;
    const times = storage.getSortedPlayerList();
    times.forEach((info) => {
        info.times.forEach((time) => {
            if (time > 0 && time < 99999 && (!bestLap || time < bestLap.time)) {
                bestLap = { time: time, playerId: info.id };
            }
        });
    });

    return bestLap;
};

// Updates the persistent tournament progress and best-lap badges.
const updateRaceStatus = () => {
    const tournament = storage.get('tournament');
    if (!tournament) {
        $('#race-status-badges').hide();
        return;
    }

    const mancheList = storage.getManches() || [];
    const totalRounds = mancheList.reduce((total, manche) => { return total + manche.length; }, 0);
    const completedRounds = completedRoundCount(mancheList);
    if (!completedRounds) {
        $('#race-status-badges').hide();
        return;
    }

    const progress = totalRounds ? Math.round(completedRounds / totalRounds * 100) : 0;
    const bestLap = findBestLap();

    $('#race-status-badges').show();
    $('#tag-race-progress').text(`${completedRounds} / ${totalRounds} (${progress}%)`);
    $('#tag-best-lap').text(bestLap ? `${utils.prettyTime(bestLap.time)} · ${tournament.players[bestLap.playerId] || '//'}` : '-');
};

// Prepares the contents of the requested modal.
const initModal = (modalId) => {
    if (modalId === 'modal-new') {
        $('#modal-new-name').val('');
        $('#modal-new-name').focus();
    }
    if (modalId === 'modal-open') {
        $('#modal-open-files').empty();
        const data = storage.getRecentFiles(50);
        if (data.length) {
            const currentRaceFile = configuration.get('raceFile');
            data.forEach((race) => {
                if (race.filename === currentRaceFile) {
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
            $('#modal-open-files').append('<tr><td><span class="is-uppercase has-text-grey">No files</span></td><tr>');
        }
    }
};

// Updates the free-round toggle and dependent UI state.
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

// Shows a successfully loaded track in the UI.
const trackLoadDone = (track) => {
    $('#js-input-track-code').removeClass('is-danger');
    $('#tag-track-status').removeClass('is-danger');
    $('#tag-track-status').addClass('is-success');
    $('#tag-track-status').text(track.code);
};

// Shows a failed track-load state in the UI.
const trackLoadFail = () => {
    $('#js-input-track-code').addClass('is-danger');
    $('#tag-track-status').addClass('is-danger');
    $('#tag-track-status').removeClass('is-success');
    $('#tag-track-status').text(i18n.__('tag-not-loaded'));
};

// Shows a successfully loaded tournament in the UI.
const tournamentLoadDone = (tournament) => {
    $('#button-toggle-free-round').show();
    $('#tag-tournament-status').removeClass('is-danger');
    $('#tag-tournament-status').addClass('is-success');
    $('#tag-tournament-status').text(tournament.code);
    $('#js-input-tournament-code').removeClass('is-danger');
    $('#js-input-tournament-code').val(tournament.code);
};

// Shows a failed tournament-load state in the UI.
const tournamentLoadFail = () => {
    $('#js-input-tournament-code').addClass('is-danger');
    $('#tag-tournament-status').addClass('is-danger');
    $('#tag-tournament-status').removeClass('is-success');
    $('#tag-tournament-status').text(i18n.__('tag-not-loaded'));
};

// Updates UI controls for a race that has started.
const raceStarted = (freeRound) => {
    updateUiState(freeRound);
    $('.js-show-on-race-running').show();
    $('.js-hide-on-race-running').hide();
};

// Updates UI controls after a race finishes.
const raceFinished = (freeRound) => {
    $('.js-show-on-race-running').hide();
    $('.js-hide-on-race-running').show();
    updateUiState(freeRound);
    const tournament = storage.get('tournament');
    if (tournament) {
        disableRaceInput(true);
    }
    updateRaceStatus();
};

// Renders the selected track's details.
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

// Renders the selected tournament's details.
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

// Calculates and renders race-time threshold estimates.
const showThresholds = (timeThreshold, speedThreshold, roundLaps) => {
    const track = storage.get('track');
    if (track) {
        const rTrackLength = track.length;
        const rLaps = roundLaps || storage.get('roundLaps');
        const rTimeThreshold = (timeThreshold || storage.get('timeThreshold')) / 100;
        const rSpeedThreshold = speedThreshold || storage.get('speedThreshold');
        const estimatedTime = rTrackLength / rSpeedThreshold / 3 * rLaps;
        let estimatedCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold);
        if (estimatedCutoffMin < 1) estimatedCutoffMin = 1;
        const estimatedCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold);
        $('#js-settings-estimated-time').show();
        $('#js-settings-estimated-time').text(`${i18n.__('label-time-estimated')}: ${estimatedTime.toFixed(2)} sec`);
        $('#js-settings-estimated-cutoff-min').show();
        $('#js-settings-estimated-cutoff-max').show();
        $('#js-settings-estimated-cutoff-min').text(`${i18n.__('label-time-estimated-cutoff-min')} ${estimatedCutoffMin.toFixed(2)} sec`);
        $('#js-settings-estimated-cutoff-max').text(`${i18n.__('label-time-estimated-cutoff-max')} ${estimatedCutoffMax.toFixed(2)} sec`);

        const worstCaseTime = estimatedCutoffMax * rLaps;
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

// Renders the selected race mode and its description.
const showRaceModeDetails = () => {
    const race_mode = storage.get('raceMode');
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

// Renders the tournament ranking table.
const showPlayerList = () => {
    const track = storage.get('track');
    const tournament = storage.get('tournament');
    if (!track) return;
    if (!tournament) return;

    const playerList = tournament.players;
    const racerLabel = playerList.length === 1 ? i18n.__('label-racer') : i18n.__('label-racers');
    $('#js-racers-count').text(`${playerList.length} ${racerLabel}`);
    let tableHtml = '';
    if (playerList.length > 0) {
        const times = storage.getSortedPlayerList();
        const validRaceTimes = times.flatMap((info) => { return info.times.filter((t) => { return t > 0 && t < 99999; }); });
        const raceBestTime = validRaceTimes.length > 0 ? Math.min(...validRaceTimes) : null;

        // draw title row
        const titleCells = Array.from({ length: tournament.manches.length }, (_value, i) => {
            return `<th scope="col" class="has-text-centered racers-time-column">M${i + 1}</th>`;
        });
        titleCells.push(`<th scope="col" class="has-text-centered racers-summary-column"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-stopwatch"></i></span> ${i18n.__('label-best-2-times')}</th>`);
        titleCells.push(`<th scope="col" class="has-text-centered racers-speed-column"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-gauge-high"></i></span> ${i18n.__('label-best-speed')}</th>`);
        tableHtml = `<thead><tr><th scope="col" class="has-text-centered racers-rank-column"><span class="icon" aria-hidden="true"><i class="fa-solid fa-ranking-star"></i></span><span class="is-sr-only">${i18n.__('label-rank')}</span></th><th scope="col" class="racers-name-column"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-user"></i></span> ${i18n.__('label-racer')}</th>${titleCells.join('')}</tr></thead><tbody>`;

        // draw player rows
        times.forEach((info, pos) => {
            const validPlayerTimes = info.times.filter((t) => { return t > 0 && t < 99999; });
            const bestTime = validPlayerTimes.length > 0 ? Math.min(...validPlayerTimes) : null;
            const bestSpeed = bestTime ? track.length / (bestTime / 1000) : null;
            const cells = [];
            const rankClass = pos < 3 ? ` is-podium is-podium-${pos + 1}` : '';
            const rankIcon = pos === 0 ? 'fa-trophy' : 'fa-medal';
            const podiumIcon = pos < 3 ? `<i class="fa-solid ${rankIcon}" aria-hidden="true"></i>` : '';
            cells.push(`<td class="has-text-centered racers-rank"><span class="racers-rank-badge${rankClass}">${podiumIcon}<span>${pos + 1}</span></span></td>`);
            cells.push(`<th scope="row" class="racers-name is-uppercase">${utils.escapeHtml(playerList[info.id])}</th>`);
            cells.push(Array.from({ length: tournament.manches.length }, (_value, i) => {
                const playerTime = info.times[i] || 0;
                let highlight = '';
                let timeContent = utils.prettyTime(playerTime);
                if (playerTime === 0 || playerTime === 99999) {
                    highlight = 'has-text-grey-light is-out';
                    timeContent = playerTime === 99999 ? `<span class="is-light">${timeContent}</span>` : '<span aria-hidden="true">&mdash;</span>';
                }
                else if (playerTime === raceBestTime) {
                    highlight = 'is-race-best';
                    timeContent = `<span class="icon is-small" title="${i18n.__('label-race-best')}" aria-hidden="true"><i class="fa-solid fa-trophy"></i></span> ${timeContent}`;
                }
                else if (playerTime === bestTime) {
                    highlight = 'is-player-best';
                    timeContent = `<span class="icon is-small" title="${i18n.__('label-personal-best')}" aria-hidden="true"><i class="fa-solid fa-star"></i></span> ${timeContent}`;
                }
                return `<td class="has-text-centered racers-time ${highlight}">${timeContent}</td>`;
            }));
            const bestSum = validPlayerTimes.length >= 2 ? utils.prettyTime(info.best) : '<span aria-hidden="true">&mdash;</span>';
            const speed = bestSpeed ? `<strong>${bestSpeed.toFixed(2)} m/s</strong><span>${(bestSpeed * 3.6).toFixed(2)} km/h</span>` : '<span aria-hidden="true">&mdash;</span>';
            cells.push(`<td class="has-text-centered racers-time racers-best-sum">${bestSum}</td>`);
            cells.push(`<td class="has-text-centered racers-speed">${speed}</td>`);
            tableHtml += `<tr>${cells.join('')}</tr>`;
        });
        tableHtml += '</tbody>';
    }
    $('#tablePlayerList').html(tableHtml);
};

// Renders every tournament round and its recorded results.
const showMancheList = () => {
    const track = storage.get('track');
    const tournament = storage.get('tournament');
    if (!track) return;
    if (!tournament) return;

    const currManche = storage.get('currManche');
    const currRound = storage.get('currRound');
    const playerList = tournament.players;
    const mancheList = storage.getManches();

    const roundCount = mancheList.reduce((count, manche) => { return count + manche.length; }, 0);
    const roundLabel = roundCount === 1 ? i18n.__('label-round') : i18n.__('label-rounds');
    $('#js-rounds-count').text(`${roundCount} ${roundLabel}`);

    let tableHtml = `<thead><tr><th scope="col" class="has-text-centered manches-round-column"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-flag-checkered"></i></span>${i18n.__('label-round')}</th><th scope="col" class="has-text-centered"><span class="manches-lane-dot manches-lane-dot-1" aria-hidden="true"></span>${i18n.__('label-lane-1')}</th><th scope="col" class="has-text-centered"><span class="manches-lane-dot manches-lane-dot-2" aria-hidden="true"></span>${i18n.__('label-lane-2')}</th><th scope="col" class="has-text-centered"><span class="manches-lane-dot manches-lane-dot-3" aria-hidden="true"></span>${i18n.__('label-lane-3')}</th></tr></thead>`;
    mancheList.forEach((manche, mindex) => {
        tableHtml += `<tbody class="manches-group"><tr class="manches-section"><th colspan="4" scope="rowgroup"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-flag"></i></span> ${utils.escapeHtml(mancheName(mindex))}</th></tr>`;
        manche.forEach((group, rindex) => {
            const cars = storage.loadRound(mindex, rindex);
            const mancheText = group.map((id, pindex) => {
                const playerName = playerList[id];
                if (playerName) {
                    const car = cars ? cars[pindex] : null;
                    const playerTime = car ? car.currTime : 0;
                    const playerPosition = car ? car.position : null;
                    const playerOut = car ? car.outOfBounds : false;
                    let playerPositionTag = '';

                    if (playerPosition !== null && playerPosition !== undefined) {
                        if (car.originalTime) {
                            playerPositionTag = `<span class="tag is-danger is-light"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-pen"></i></span><span>${i18n.__('label-modified')}</span></span>`;
                        }
                        else if (playerOut) {
                            playerPositionTag = `<span class="tag is-dark"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-ban"></i></span><span>${i18n.__('label-car-out')}</span></span>`;
                        }
                        else if (playerPosition === 1) {
                            playerPositionTag = `<span class="tag is-warning"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-trophy"></i></span><span>${playerPosition}</span></span>`;
                        }
                        else {
                            playerPositionTag = `<span class="tag is-light"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-medal"></i></span><span>${playerPosition}</span></span>`;
                        }
                    }

                    const playerHeader = `<div class="manches-racer-header"><strong class="is-uppercase">${utils.escapeHtml(playerName)}</strong>${playerPositionTag}</div>`;
                    const playerForm = `<div class="field manches-time-field"><div class="control has-icons-left"><input class="input is-medium js-time-form" type="text" aria-label="${utils.escapeHtml(playerName)}" data-manche="${mindex}" data-round="${rindex}" data-player="${pindex}" value="${utils.prettyTime(playerTime)}" /><span class="icon is-small is-left has-text-grey-light" aria-hidden="true"><i class="fa-solid fa-stopwatch"></i></span></div></div>`;

                    return `<td class="manches-lane-cell">${playerHeader}${playerForm}</td>`;
                }
                else {
                    return '<td class="manches-lane-cell is-empty"><span aria-hidden="true">&mdash;</span></td>';
                }
            }).join('');
            const isCurrentRound = (mindex === currManche && rindex === currRound);
            const rowClass = isCurrentRound ? ' class="is-current-round"' : '';
            const roundAction = isCurrentRound ? `<span class="tag is-info is-light"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-circle-play"></i></span><span>${i18n.__('label-current-round')}</span></span>` : `<button class="button is-small is-info is-light js-goto-round" data-manche="${mindex}" data-round="${rindex}"><span class="icon is-small" aria-hidden="true"><i class="fa-solid fa-play"></i></span><span>${i18n.__('button-goto-round')}</span></button>`;
            tableHtml += `<tr${rowClass}><th scope="row" class="has-text-centered manches-round"><strong>${i18n.__('label-round')} ${mindex + 1}-${rindex + 1}</strong>${roundAction}</th>${mancheText}</tr>`;
        });
        tableHtml += '</tbody>';
    });
    $('#tableMancheList').html(tableHtml);
};

// Displays the players scheduled for the next round.
const showNextRoundNames = () => {
    const currManche = storage.get('currManche');
    const currRound = storage.get('currRound');
    const tournament = storage.get('tournament');
    const playerList = tournament.players;
    const mancheList = storage.getManches();

    let r = currRound, m = currManche, names;
    let label = i18n.__('label-next-round');
    r += 1;
    if (r === mancheList[currManche].length) {
        m++;
        r = 0;
        label = i18n.__('label-next-round-end');
    }

    if (m === mancheList.length) {
        names = ['-'];
    }
    else {
        names = [playerList[mancheList[m][r][0]], playerList[mancheList[m][r][1]], playerList[mancheList[m][r][2]]].filter((n) => { return n; });
    }

    $('#next-round-names').text(`${label} ${names.join(', ').toUpperCase()}`);
};

// Returns the display name for a manche or final.
const mancheName = (mindex) => {
    const tournament = storage.get('tournament');
    const mancheList = storage.getManches();

    if (mindex === tournament.mancheCount) {
        return (mindex < mancheList.length) ? 'FINAL 4-5-6 PLACE' : 'FINAL 1-2-3 PLACE';
    }
    else if (mindex === tournament.mancheCount + 1) {
        return 'FINAL 1-2-3 PLACE';
    }
    else {
        return `MANCHE ${mindex + 1}`;
    }
};

// Initializes the race screen for the current round.
const initRace = (freeRound) => {
    const tournament = storage.get('tournament');
    const currManche = storage.get('currManche');
    const currRound = storage.get('currRound');

    updateUiState(freeRound);
    $('.js-show-on-race-running').hide();

    if (!tournament || freeRound) {
        $('#name-lane0').text(' ');
        $('#name-lane1').text(' ');
        $('#name-lane2').text(' ');
        $('#curr-manche').text('');
        $('#curr-round').text('');
        $('#next-round-names').text('-');
    }
    else {
        const playerList = tournament.players;
        const mancheList = storage.getManches();
        const round = mancheList[currManche][currRound];
        round.forEach((playerId, lane) => {
            const playerName = playerId === -1 ? i18n.__('label-car-empty') : playerList[playerId] || '//';
            $(`#name-lane${lane}`).text(playerName);
        });
        $('#curr-manche').text(mancheName(currManche));
        $('#curr-round').text(`ROUND ${currRound + 1}`);
        showNextRoundNames();
        showPlayerList();
        showMancheList();
    }
    updateRaceStatus();
};

// Renders lane positions, laps, split times, and timers.
const drawRace = (cars, running) => {
    $('.js-place').removeClass('is-dark is-light is-primary is-warning');
    $('.js-delay').removeClass('is-danger');
    $('.js-timer').removeClass('is-danger is-success');
    $('.race-lane-card').removeClass('race-lane-winner race-lane-dnf');
    $('.race-result-icon').empty();

    const track = storage.get('track');
    const laps = storage.get('roundLaps');
    updateRaceStatus();

    cars.forEach((car, i) => {
        const isEmpty = car.playerId === -1;
        $(`.race-lane-card-${i}`).toggleClass('race-lane-empty', isEmpty);

        if (isEmpty) {
            $(`#name-lane${i}`).text(i18n.__('label-car-empty'));
            return;
        }

        // delay + speed
        if (car.outOfBounds) {
            $(`#delay-lane${i}`).text('—');
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
        const fastestLap = Math.min(...car.splitTimes);
        car.splitTimes.forEach((t, ii) => {
            const time = utils.prettyTime(t);
            const speed = (track.length / 3) / (t / 1000);
            const fastestClass = t === fastestLap ? 'is-fastest-lap' : '';
            $(`#laps-lane${i}`).append(`<li class="${fastestClass}"><span>${i18n.__('label-car-lap')} ${ii + 1}</span><strong>${time}s</strong><span>${speed.toFixed(2)} m/s</span></li>`);
        });

        // place
        if (car.outOfBounds) {
            $(`#place-lane${i}`).text(i18n.__('label-car-dnf'));
            $(`#result-icon-lane${i}`).html('<i class="fa-solid fa-ban"></i>');
            $(`.race-lane-card-${i}`).addClass('race-lane-dnf');
        }
        else if (car.lapCount === 0) {
            if (running) {
                $(`#place-lane${i}`).text(i18n.__('label-car-ready'));
            }
            else {
                $(`#place-lane${i}`).text(i18n.__('label-car-stopped'));
            }
            $(`#place-lane${i}`).addClass('is-light');
        }
        else if (car.lapCount === 1) {
            $(`#place-lane${i}`).text(i18n.__('label-car-started'));
            $(`#place-lane${i}`).addClass('is-light');
        }
        else {
            const isWinner = !running && car.lapCount > laps && car.position === 1;
            $(`#place-lane${i}`).text(isWinner ? i18n.__('label-car-winner') : `${car.position} ${i18n.__('label-car-position')}`);
            if (isWinner) {
                $(`#result-icon-lane${i}`).html('<i class="fa-solid fa-trophy"></i>');
                $(`.race-lane-card-${i}`).addClass('race-lane-winner');
            }
            else if (car.position === 1) {
                $(`#place-lane${i}`).addClass('is-warning');
            }
            else {
                $(`#place-lane${i}`).addClass('is-primary');
            }
        }

        // timer
        if (car.outOfBounds) {
            $(`#timer-lane${i}`).text(utils.prettyTime(car.currTime));
        }
        else if (car.lapCount === 0) {
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

// Enables or disables controls that change race setup.
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

// Updates visibility for the loaded track, tournament, and race mode.
const updateUiState = (freeRound) => {
    const track = storage.get('track');
    const tournament = storage.get('tournament');

    if (track === null) {
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

// Registers UI event handlers using the supplied renderer dependencies.
const setupEventHandlers = (deps) => {
    const { client, storage, configuration, startRaceCallback } = deps;

    // tabs
    $('.tabs a').on('click', (e) => {
        const $this = $(e.currentTarget);
        const tab = $this.closest('li').data('tab');
        gotoTab(tab);
    });

    // modals
    // Opens a modal and prevents page scrolling.
    const openModal = (modal) => {
        $(`#${modal}`).addClass('is-active');
        $(document.documentElement).addClass('is-clipped');
    };

    // Closes every modal and restores page scrolling.
    const closeAllModals = () => {
        $('.modal').removeClass('is-active');
        $(document.documentElement).removeClass('is-clipped');
    };

    $('.open-modal').on('click', (e) => {
        const $this = $(e.currentTarget);
        openModal($this.data('modal'));
        initModal($this.data('modal'));
    });

    $('.close-modal').on('click', closeAllModals);

    // Load race
    $(document).on('click', '.js-load-race', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const filename = $this.data('filename');
        console.log('[Race setup] Opening race', { filename: filename });
        client.openRace(filename, closeAllModals);
    });

    // Delete race
    $(document).on('click', '.js-delete-race', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const result = window.electronAPI.showMessageBoxSync({
            type: 'warning',
            message: i18n.__('dialog-delete-race'),
            buttons: ['Ok', 'Cancel']
        });
        if (result === 0) {
            const filename = $this.data('filename');
            storage.deleteRace(filename);
            closeAllModals();
        }
    });

    // Load track
    $('#js-load-track').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const code = $('#js-input-track-code').val().slice(-6);
        console.log('[Race setup] Loading remote track', { code: code });
        client.loadTrack(code);
    });

    // Save manual track
    $('#js-track-save-manual').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const $length = $('#js-track-length-manual');
        const $order = $('#js-track-order-manual');
        const $orderSelect = $order.parent('.select');
        const hasLength = $length.val().trim();
        const hasOrder = $order.val();

        $length.removeClass('is-danger');
        $orderSelect.removeClass('is-danger');
        if (!hasLength || !hasOrder) {
            if (!hasLength) $length.addClass('is-danger');
            if (!hasOrder) $orderSelect.addClass('is-danger');
            return;
        }
        const result = window.electronAPI.showMessageBoxSync({
            type: 'warning',
            message: i18n.__('dialog-save-track'),
            buttons: ['Ok', 'Cancel']
        });
        if (result === 0) {
            const length = parseFloat(hasLength.replace(',', '.'));
            const order = hasOrder.split('-').map((i) => { return parseInt(i); });
            console.log('[Race setup] Saving manual track', { length: length, order: order });
            client.setTrackManual(length, order);
        }
    });

    // Load tournament
    $('#js-load-tournament').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const code = $('#js-input-tournament-code').val().slice(-6);
        console.log('[Race setup] Loading remote tournament', { code: code });
        client.loadTournament(code);
    });

    // New race
    $('#button-new-race').on('click', () => {
        const name = $('#modal-new-name').val().trim();
        if (name === '') return false;
        console.log('[Race setup] Creating new race', { name: name });
        client.reset(name, closeAllModals);
    });

    // Start race
    $('#button-start').on('click', startRaceCallback);

    // Stop race
    $('#button-stop').on('click', () => {
        client.stopRace();
    });

    // Previous round
    $('#button-prev').on('click', () => {
        client.prevRound();
    });

    // Next round
    $('#button-next').on('click', () => {
        client.nextRound();
    });

    // Toggle free round
    $('#button-toggle-free-round').on('click', () => {
        client.toggleFreeRound();
    });

    // Requests the native print dialog for the current window.
    $('#button-print').on('click', () => {
        window.electronAPI.print();
    });

    // Export XLS
    $('#button-xls').on('click', () => {
        client.saveXls();
        $('#button-xls').attr('disabled', true);
    });

    // Open XLS folder
    $('#button-xls-folder').on('click', async () => {
        const xls = require('./export');
        const dir = await xls.createDir();
        window.electronAPI.openPath(dir);
    });

    // Open log file
    $('#button-log-file').on('click', () => {
        const log = require('electron-log');
        window.electronAPI.openPath(log.transports.file.findLogPath());
    });

    // Updates threshold estimates from the settings form.
    const updateThresholds = () => {
        const timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
        const speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
        const roundLaps = parseInt($('#js-settings-round-laps').val());
        if (isNaN(timeThreshold) || isNaN(speedThreshold)) return;
        showThresholds(timeThreshold, speedThreshold, roundLaps);
    };

    $('#js-settings-speed-threshold').on('keyup', updateThresholds);
    $('#js-settings-time-threshold').on('keyup', updateThresholds);
    $('#js-settings-round-laps').on('change', updateThresholds);

    // Save settings
    $('#button-save-settings').on('click', (e) => {
        const timeThreshold = parseFloat($('#js-settings-time-threshold').val().replace(',', '.'));
        const speedThreshold = parseFloat($('#js-settings-speed-threshold').val().replace(',', '.'));
        const startDelay = parseFloat($('#js-settings-start-delay').val().replace(',', '.'));
        const roundLaps = parseInt($('#js-settings-round-laps').val());
        console.log('[Race setup] Saving race settings', {
            timeThreshold: timeThreshold,
            speedThreshold: speedThreshold,
            startDelay: startDelay,
            roundLaps: roundLaps
        });
        storage.set('timeThreshold', timeThreshold);
        storage.set('speedThreshold', speedThreshold);
        storage.set('startDelay', startDelay);
        storage.set('roundLaps', roundLaps);
        showThresholds();
        e.preventDefault();
    });

    // Save configuration
    $('#button-save-config').on('click', (e) => {
        configuration.set('reverse', $('#js-config-reverse').is(':checked') ? 1 : 0);
        configuration.set('sensorPin1', parseInt($('#js-config-sensor-pin-1').val()));
        configuration.set('sensorPin2', parseInt($('#js-config-sensor-pin-2').val()));
        configuration.set('sensorPin3', parseInt($('#js-config-sensor-pin-3').val()));
        configuration.set('ledPin1', parseInt($('#js-config-led-pin-1').val()));
        configuration.set('piezoPin', parseInt($('#js-config-piezo-pin').val()));
        configuration.set('startButtonPin', parseInt($('#js-config-start-button-pin').val()));
        configuration.set('title', $('#js-config-title').val());
        configuration.set('tab', $('#js-config-starting-tab').val());
        configuration.set('usbPort', $('#js-config-usb-port').val());
        window.electronAPI.showMessageBoxSync({
            type: 'warning',
            message: i18n.__('dialog-restart'),
            buttons: ['Ok']
        });
        location.reload();
        e.preventDefault();
    });

    // Save manches
    $('#button-manches-save').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        client.overrideTimes();
        window.electronAPI.showMessageBoxSync({
            type: 'warning',
            message: i18n.__('dialog-saved'),
            buttons: ['Ok']
        });
    });

    // Go to round
    $(document).on('click', '.js-goto-round', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const mindex = $this.data('manche');
        const rindex = $this.data('round');
        client.gotoRound(mindex, rindex);
    });

    // LED animation selection
    $('.js-led-animation').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        $('.js-led-animation').removeClass('is-primary');
        $this.addClass('is-primary');
        const type = $this.data('led-animation');
        configuration.set('ledAnimation', type);
    });

    // Race mode selection
    $('.js-race-mode').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        $('.js-race-mode').removeClass('is-primary');
        $this.addClass('is-primary');
        const mode = $this.data('race-mode');
        storage.set('raceMode', mode);
        showRaceModeDetails();
    });

    // Invalidate/disqualify
    $('.js-invalidate').on('click', (e) => {
        const $this = $(e.currentTarget);
        if ($this.attr('disabled')) return;
        const result = window.electronAPI.showMessageBoxSync({
            type: 'warning',
            message: i18n.__('dialog-disqualify'),
            buttons: ['Ok', 'Cancel']
        });
        if (result === 0) {
            client.disqualify(null, null, parseInt($this.data('lane')));
        }
    });
};

module.exports = {
    boardConnected: boardConnected,
    debugModeEnabled: debugModeEnabled,
    boardDisconnected: boardDisconnected,
    translate: translate,
    gotoTab: gotoTab,
    init: init,
    initModal: initModal,
    setupEventHandlers: setupEventHandlers,
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
    drawRace: drawRace,
    updateRaceStatus: updateRaceStatus
};
