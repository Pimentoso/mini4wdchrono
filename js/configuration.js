'use strict';

const userHome = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
const nconf = require('nconf').file({file: userHome + '/mini4wdchrono-settings.json'});

nconf.defaults({
	'sensorPin1': 'A0',
	'sensorPin2': 'A1',
	'sensorPin3': 'A2',
	'ledPin1': 11,
	'ledPin2': 12,
	'ledPin3': 13,
	'piezoPin': 2,
	'sensorThreshold': 20,
	'timeThreshold': 40,
	'speedThreshold': 5,
	'startDelay': 3
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
	return nconf.get('race:' + manche + '-' + round);
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
