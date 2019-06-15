'use strict';

const electron = require('electron');
const path     = require('path');





const nconf = require('nconf').file({file: userHome + '/mini4wdchrono-settings.json'});

nconf.defaults({
	'sensorPin1': 'A0',
	'sensorPin2': 'A1',
	'sensorPin3': 'A2',
	'ledPin1': 11,
	'ledPin2': 12,
	'ledPin3': 13,
	'piezoPin': 2,
	'usbPort': 'COM3',
	'sensorThreshold': 10,
	'timeThreshold': 40,
	'speedThreshold': 5,
	'startDelay': 3,
	'title': 'MINI4WD CHRONO',
	'raceMode': 0
});

const getConfigFilePath = () => {

	var app = electron.app;
	// const userHome = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
	
	var fileName = 'settings.json';
	var appName = app.getName();
	var homeDir = os.homedir ? os.homedir() : process.env.HOME;
	
	var dir;
	switch (process.platform) {
		case 'darwin': {
			dir = [homeDir, 'Library', 'Application Support', appName];
			break;
		}
	
		case 'win32': {
			dir = [homeDir, 'AppData', 'Roaming/', appName];
			break;
		}
	
		default: {
			dir = [homeDir, '.config', appName];
			break;
		}
	}
	
	if (dir) {
		return path.join(dir.join('/'), fileName);
	}
};

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

module.exports = {
    saveSettings: saveSettings,
		readSettings: readSettings,
		deleteSettings: deleteSettings,
		saveRound: saveRound,
		loadRound: loadRound,
		deleteRound: deleteRound
};
