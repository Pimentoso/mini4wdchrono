'use strict';

const nconf = require('nconf').file({file: getUserHome() + '/mini4wdchrono-settings.json'});

nconf.defaults({
	'sensorPin1': 8,
	'sensorPin2': 9,
	'sensorPin3': 10,
	'ledPin1': 11,
	'ledPin2': 12,
	'ledPin3': 13,
	'piezoPin': 3,
	'timeThreshold': 40,
	'speedThreshold': 5
});

function saveSettings(settingKey, settingValue) {
  nconf.set(settingKey, settingValue);
  nconf.save();
}

function readSettings(settingKey) {
  nconf.load();
  return nconf.get(settingKey);
}

function deleteSettings(settingKey) {
	nconf.clear(settingKey);
	nconf.save();
}

function saveRound(manche, round, cars) {
	nconf.set('race:' + manche + '-' + round, cars);
	nconf.save();
}

function loadRound(manche, round) {
	return nconf.get('race:' + manche + '-' + round);
}

function deleteRound(manche, round) {
	nconf.clear('race:' + manche + '-' + round);
	nconf.save();
}

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

module.exports = {
    saveSettings: saveSettings,
		readSettings: readSettings,
		deleteSettings: deleteSettings,
		saveRound: saveRound,
		loadRound: loadRound,
		deleteRound: deleteRound
};
