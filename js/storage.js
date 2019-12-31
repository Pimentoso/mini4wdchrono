'use strict';

const { app } = require('electron').remote;
const fs = require('fs');
const storage = require('electron-settings');
const configuration = require('./configuration');

var filepath = configuration.get('raceFile');
if (filepath) {
	storage.setPath(filepath);
}
else {
	configuration.newRace();
}

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

const getTrack = () => {
	return storage.get('track');
};

const getTournament = () => {
	return storage.get('tournament');
};

const getMancheList = () => {
	let tournament = loadTournament();
	let mancheList = tournament.manches;
	if (tournament.finals) {
		mancheList.push(...tournament.finals);
	}
	return mancheList;
};

const getPlayerList = () => {
	let tournament = loadTournament();
	return tournament.players;
};

module.exports = {
	newRace: newRace,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	getTrack: getTrack,
	getTournament: getTournament,
	getMancheList: getMancheList,
	getPlayerList: getPlayerList
};
