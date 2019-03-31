'use strict';

const nconf = require('nconf').file({file: getUserHome() + '/mini4wdchrono-settings.json'});

nconf.defaults({
	'sensorPin1': 'A2',
	'sensorPin2': 'A3',
	'sensorPin3': 'A4',
	'ledPin1': 5,
	'ledPin2': 4,
	'ledPin3': 3,
	'piezoPin': 7,
	'sensorThreshold': 10,
	'timeThreshold': 40,
	'speedThreshold': 5
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

const getUserHome = () => {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
};

module.exports = {
    saveSettings: saveSettings,
		readSettings: readSettings,
		deleteSettings: deleteSettings,
		saveRound: saveRound,
		loadRound: loadRound,
		deleteRound: deleteRound
};
