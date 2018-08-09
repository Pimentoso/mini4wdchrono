'use strict';

const nconf = require('nconf').file({file: getUserHome() + '/mini4wdchrono-settings.json'});

// TODO
nconf.defaults({
	'sensorPin1': 8,
	'sensorPin2': 9,
	'sensorPin3': 10,
	'timeThreshold': 0.4,
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

function getUserHome() {
    return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'];
}

module.exports = {
    saveSettings: saveSettings,
    readSettings: readSettings
};
