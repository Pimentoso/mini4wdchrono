'use strict';

const { app } = require('electron').remote;
const fs = require('fs');
const storage = require('electron-settings');
const configuration = require('./configuration');

const newRace = () => {
	let userdir = app.getPath('userData');

	let storagedir = path.join(userdir, 'races');
	if (!fs.existsSync(storagedir)) {
		fs.mkdirSync(storagedir);
	}

	let filename = `${parseInt(new Date().getTime() / 1000)}.json`;
	let filepath = path.join(userdir, 'races', filename);
	configuration.set('raceFile', filepath);
	fs.closeSync(fs.openSync(filepath, 'w')); // create empty file
	storage.setPath(filepath);

	// defaults
	storage.set('raceMode', 0);
	storage.set('timeThreshold', 40);
	storage.set('speedThreshold', 5);
	storage.set('startDelay', 3);
};

var filepath = configuration.get('raceFile');
if (filepath) {
	storage.setPath(filepath);
}
else {
	newRace();
}

const set = (key, value) => {
	storage.set(key, value);
};

const get = (key) => {
	return storage.get(key);
};

const saveRound = (manche, round, cars) => {
	storage.set(`race.m${manche}.r${round}`, cars);
};

const loadRound = (manche, round) => {
	manche = manche || storage.get('currManche');
	round = round || storage.get('currRound');
	return storage.get(`race.m${manche}.r${round}`);
};

const deleteRound = (manche, round) => {
	storage.delete(`race.m${manche}.r${round}`);
};

const getManches = () => {
	let tournament = get('tournament');
	let mancheList = tournament.manches;
	if (tournament.finals) {
		mancheList.push(...tournament.finals);
	}
	return mancheList;
};

module.exports = {
	newRace: newRace,
	set: set,
	get: get,
	del: del,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	getManches: getManches
};
