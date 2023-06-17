'use strict';

const { app } = require('@electron/remote');
const fs = require('fs');
const path = require('path');
const jsonfile = require('jsonfile');
const storage = require('electron-settings');
const configuration = require('./configuration');
configuration.init();

const setDefaults = () => {
	let timestamp = parseInt(new Date().getTime() / 1000);
	set('created', timestamp);
	set('currManche', 0);
	set('currRound', 0);
	set('raceMode', 0);
	set('timeThreshold', 40);
	set('speedThreshold', 5);
	set('startDelay', 3);
	set('roundLaps', 3);
};

const newRace = (raceName) => {
	let userdir = app.getPath('userData');
	let storagedir = path.join(userdir, 'races');
	if (!fs.existsSync(storagedir)) {
		fs.mkdirSync(storagedir);
	}

	let timestamp = parseInt(new Date().getTime() / 1000);
	let filename = `${timestamp}.json`;
	let filepath = path.join(userdir, 'races', filename);
	configuration.set('raceFile', filename);
	fs.closeSync(fs.openSync(filepath, 'w')); // create empty file
	storage.setPath(filepath);
	set('name', raceName);
	setDefaults();
};

const loadRace = (filename) => {
	filename = filename || configuration.get('raceFile');
	if (filename) {
		filename = filename.substr(filename.length - 15); // retrocompatibility
		let userdir = app.getPath('userData');
		let filepath = path.join(userdir, 'races', filename);
		configuration.set('raceFile', filename);
		storage.setPath(filepath);
		if (get('created') == null) {
			setDefaults();
		}
	}
	else {
		newRace();
	}
};

const deleteRace = (filename) => {
	let userdir = app.getPath('userData');
	let filepath = path.join(userdir, 'races', filename);
	fs.unlinkSync(filepath);
};

const extension = (element) => {
	var extName = path.extname(element);
	return extName === '.json';
};

const getRecentFiles = (num) => {
	num = num || 10
	let userdir = app.getPath('userData');
	let storagedir = path.join(userdir, 'races');
	let files = fs.readdirSync(storagedir);
	files = files.filter(extension).slice(0, num);
	let recent = [];
	files.forEach((filename) => {
		let data = jsonfile.readFileSync(path.join(storagedir, filename));
		recent.push({
			filename: filename,
			name: data.name,
			created: data.created
		});
	});
	return recent.reverse();
};

const set = (key, value) => {
	storage.set(key, value);
};

const get = (key) => {
	return storage.get(key);
};

const remove = (key) => {
	return storage.delete(key);
};

const saveRound = (manche, round, cars) => {
	set(`race.m${manche}.r${round}`, cars);
};

const loadRound = (manche, round) => {
	if (manche == null)
		manche = get('currManche');
	if (round == null)
		round = get('currRound');

	return get(`race.m${manche}.r${round}`);
};

const deleteRound = (manche, round) => {
	remove(`race.m${manche}.r${round}`);
};

const getManches = () => {
	let tournament = get('tournament');
	if (!tournament) return null;

	let mancheList = tournament.manches;
	if (tournament.finals) {
		mancheList.push(...tournament.finals);
	}
	return mancheList;
};

const getPlayers = () => {
	let tournament = get('tournament');
	if (!tournament) return null;

	return tournament.players;
};

/*
	Builds a structure like the following
	[
		(1 entry for each player)
		[
			(1 entry for each manche)
			{ time: 99999, position: 3, outOfBounds: true }
		]
	]
	@return [Array]
*/
const getPlayerData = () => {
	let cars, playerTimes = [], mancheList = getManches();
	_.each(mancheList, (manche, mindex) => {
		_.each(manche, (round, rindex) => {
			cars = loadRound(mindex, rindex);
			if (cars) {
				_.each(round, (playerId, pindex) => {
					playerTimes[playerId] = playerTimes[playerId] || [];
					playerTimes[playerId][mindex] = {
						time: cars[pindex].currTime,
						position: cars[pindex].position,
						outOfBounds: cars[pindex].outOfBounds
					};
				});
			}
		});
	});
	return playerTimes;
};

const getSortedPlayerList = () => {
	let playerList = getPlayers();
	let playerData = getPlayerData();

	// calculate best time sums
	let sums = [], times, pData, bestTimes, bestSum;
	_.each(playerList, (_player, pindex) => {
		pData = playerData[pindex] || [];
		bestTimes = _.sortBy(_.filter(pData, (i) => { return i && i.time > 0; }), 'time').slice(0, 2);
		bestSum = (bestTimes[0] ? bestTimes[0].time : 99999) + (bestTimes[1] ? bestTimes[1].time : 99999);
		sums[pindex] = bestSum;
	});

	// sort list by sum desc
	times = _.map(playerData, (data, index) => {
		return {
			id: index,
			times: _.map(data, (i) => { return i ? i.time : null; }),
			best: sums[index]
		};
	});
	return _.sortBy(times, 'best');
};

module.exports = {
	newRace: newRace,
	loadRace: loadRace,
	deleteRace: deleteRace,
	getRecentFiles: getRecentFiles,
	set: set,
	get: get,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	getManches: getManches,
	getPlayers: getPlayers,
	getPlayerData: getPlayerData,
	getSortedPlayerList: getSortedPlayerList
};
