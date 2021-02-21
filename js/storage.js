'use strict';

const { app } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const jsonfile = require('jsonfile');
const storage = require('electron-settings');
const configuration = require('./configuration');
configuration.init();

const setDefaults = () => {
	let timestamp = parseInt(new Date().getTime() / 1000);
	storage.set('created', timestamp);
	storage.set('currManche', 0);
	storage.set('currRound', 0);
	storage.set('raceMode', 0);
	storage.set('timeThreshold', 40);
	storage.set('speedThreshold', 5);
	storage.set('startDelay', 3);
	storage.set('roundLaps', 3);
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
	storage.set('name', raceName);
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
		if (storage.get('created') == null) {
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
  return extName === '.json'; // change to whatever extensions you want
};

const getRecent = (num) => {
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

const saveRound = (manche, round, cars) => {
	storage.set(`race.m${manche}.r${round}`, cars);
};

const loadRound = (manche, round) => {
	if (manche == null)
		manche = storage.get('currManche');
	if (round == null)
		round = storage.get('currRound');

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
	loadRace:	loadRace,
	deleteRace:	deleteRace,
	getRecent: getRecent,
	set: set,
	get: get,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	getManches: getManches
};
