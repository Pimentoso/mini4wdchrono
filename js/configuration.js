'use strict';

const app = require('electron').remote.app;
const path = require('path')
const filename = 'settings.json';

const getConfigFilePath = () => {
	// %APPDATA% on Windows
	// $XDG_CONFIG_HOME or ~/.config on Linux
	// ~/Library/Application Support on macOS
	let dir = app.getPath('userData');
	return path.join(dir, filename);
};

const nconf = require('nconf').file({ file: getConfigFilePath() });

nconf.defaults({
	'sensorPin1': 6,
	'sensorPin2': 7,
	'sensorPin3': 8,
	'ledPin1': 3,
	'ledPin2': 4,
	'ledPin3': 5,
	'piezoPin': 2,
	// 'usbPort': 'COM3',
	'timeThreshold': 40,
	'speedThreshold': 5,
	'startDelay': 3,
	'title': 'MINI4WD CHRONO',
	'raceMode': 0
});

const saveSettings = (settingKey, settingValue) => {
	nconf.set(settingKey, settingValue);
	nconf.save();
};

const readSettings = (settingKey) => {
	nconf.load();
	return nconf.get(settingKey);
};

const deleteSettings = (settingKey) => {
	nconf.clear(settingKey);
	nconf.save();
};

const saveRound = (manche, round, cars) => {
	nconf.set('race:' + manche + '-' + round, cars);
	nconf.save();
};

const loadRound = (manche, round) => {
	if (manche == null)
		manche = readSettings('currManche');
	if (round == null)
		round = readSettings('currRound');
	return readSettings('race:' + manche + '-' + round);
};

const deleteRound = (manche, round) => {
	nconf.clear('race:' + manche + '-' + round);
	nconf.save();
};

const reset = () => {
	deleteSettings('mancheTimes'); // legacy
	deleteSettings('playerTimes');
	deleteSettings('track');
	deleteSettings('tournament');
	deleteSettings('race');
	saveSettings('currManche', 0);
	saveSettings('currRound', 0);
};

module.exports = {
	saveSettings: saveSettings,
	readSettings: readSettings,
	deleteSettings: deleteSettings,
	saveRound: saveRound,
	loadRound: loadRound,
	deleteRound: deleteRound,
	reset: reset
};
