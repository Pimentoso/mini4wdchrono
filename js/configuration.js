'use strict';

const { app } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const storage = require('electron-settings');
const filename = 'settings.json';

const getConfigFilePath = () => {
	// %APPDATA% on Windows
	// $XDG_CONFIG_HOME or ~/.config on Linux
	// ~/Library/Application Support on macOS
	let dir = app.getPath('userData');
	return path.join(dir, filename);
};

////// global config methods

const globalConf = require('nconf').file('global', { file: getConfigFilePath() });

globalConf.defaults({
	'sensorPin1': 6,
	'sensorPin2': 7,
	'sensorPin3': 8,
	'ledPin1': 3,
	'ledPin2': 4,
	'ledPin3': 5,
	'piezoPin': 2,
	// 'usbPort': 'COM3',
	'title': 'MINI4WD CHRONO',
	'raceMode': 0,
	'raceFile': '',

	'timeThreshold': 40, // race specific, move to the other file if needed
	'speedThreshold': 5, // race specific, move to the other file if needed
	'startDelay': 3, // race specific, move to the other file if needed
});

const set = (settingKey, settingValue) => {
	globalConf.set(settingKey, settingValue);
	globalConf.save();
};

const get = (settingKey) => {
	globalConf.load();
	return globalConf.get(settingKey);
};

const del = (settingKey) => {
	globalConf.clear(settingKey);
	globalConf.save();
};

////// race storage methods

const newRace = () => {
	let userdir = app.getPath('userData');

	let storagedir = path.join(userdir, 'races');
	if (!fs.existsSync(storagedir)) {
		fs.mkdirSync(storagedir);
	}

	let filename = `${parseInt(new Date().getTime() / 1000)}.json`;
	let filepath = path.join(userdir, 'races', filename);
	globalConf.set('raceFile', filepath);
	globalConf.save();
	fs.closeSync(fs.openSync(filepath, 'w')); // create empty file
	storage.setPath(filepath);

	storage.set('currManche', 0);
	storage.set('currRound', 0);
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

const loadTrack = () => {
	return storage.get('track');
};

const loadTournament = () => {
	return storage.get('tournament');
};

const loadMancheList = () => {
	let tournament = loadTournament();
	let mancheList = tournament.manches;
	if (tournament.finals) {
		mancheList.push(...tournament.finals);
	}
	return mancheList;
};

const loadPlayerList = () => {
	let tournament = loadTournament();
	let playerList = tournament.players;
	return playerList;
};

module.exports = {
	newRace: newRace,
	set: set,
	get: get,
	del: del,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	loadTrack: loadTrack,
	loadTournament: loadTournament,
	loadMancheList: loadMancheList,
	loadPlayerList: loadPlayerList
};
