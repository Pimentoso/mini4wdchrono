'use strict';

class RaceManagerItalian {
	constructor() {
		super();
	}

	prevRound() {
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

			storage.set('currManche', currManche);
			storage.set('currRound', currRound);
			chronoInit();
			ui.initRace(freeRound);
			updateRace();
		}
	}

	nextRound() {
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

		let dialogText = (currManche == (mancheCount - 1) && currRound == (mancheList[currManche].length - 1) && !currTournament.finals) ? i18n.__('dialog-enter-final') : i18n.__('dialog-change-round');
		if (dialog.showMessageBox({ type: 'warning', message: dialogText, buttons: ['Ok', 'Cancel'] }) == 0) {
			currRound++;
			if (currRound == mancheList[currManche].length) {
				currManche++;
				currRound = 0;

				if (currManche >= mancheCount) {
					// manche index is higher than the original count: final mode
					if (!currTournament.finals) {
						// generate final rounds only once
						initFinal();
					}
				}
			}

			storage.set('currManche', currManche);
			storage.set('currRound', currRound);
			chronoInit();
			ui.initRace(freeRound);
			updateRace();
		}
	}

	initFinal() {
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
		storage.set('tournament', currTournament);
	}
}

module.exports = RaceManagerItalian;
