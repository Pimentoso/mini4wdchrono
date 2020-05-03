'use strict';

class RaceManager {
	constructor() {
		this.mancheList = [];
		this.playerTimes = [];
		this.mancheCount = 0;
	}

	// Initializes playerTimes
	initTimeList(mancheIndex) {
		let manchesToInit = [];
		if (mancheIndex == null) {
			manchesToInit = this.mancheList;
		}
		else {
			manchesToInit = [this.mancheList[mancheIndex]];
		}
		_.each(manchesToInit, (_manche, mindex) => {
			_.each(playerList, (_playerId, pindex) => {
				playerTimes[pindex] = playerTimes[pindex] || [];
				playerTimes[pindex][mindex] = playerTimes[pindex][mindex] || 0;
			});
		});
		storage.set('playerTimes', playerTimes);
	}
}

module.exports = RaceManager;
