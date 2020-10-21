'use strict';

const { app, dialog } = require('electron').remote;
const fs = require('fs');
const path = require('path');

const LedManagerMock = require('./led_managers/led_manager_mock');
const LedManagerRgbStrip = require('./led_managers/led_manager_rgb_strip');
const LedManagerLilypad = require('./led_managers/led_manager_lilypad');

// %APPDATA% on Windows
// $XDG_CONFIG_HOME or ~/.config on Linux
// ~/Library/Application Support on macOS
var dir = app.getPath('userData');
var filepath = path.join(dir, 'settings.json');
var globalConf;

const init = () => {
	globalConf = require('nconf').file('global', { file: filepath });

	globalConf.defaults({
		'ledType': 0,
		'sensorPin1': 6,
		'sensorPin2': 7,
		'sensorPin3': 8,
		'ledPin1': 3,
		'ledPin2': 4,
		'ledPin3': 5,
		'piezoPin': 2,
		'startButtonPin': 9,
		// 'usbPort': 'COM3',
		'title': 'MINI4WD CHRONO'
	});
};

const reset = () => {
	let backup_filepath = path.join(dir, 'settings.json.bak');
	fs.copyFileSync(filepath, backup_filepath);
	fs.unlinkSync(filepath);
	init();
	return backup_filepath;
};

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

// Get the right LedManager instance.
// Doesn't set anything, so it only works if it's been instantiated before.
const ledManager = () => {
	if (get('ledType') == 0) {
		return LedManagerLilypad.getInstance();
	}
	else if (get('ledType') == 1) {
		return LedManagerRgbStrip.getInstance();
	}
	else {
		return LedManagerMock.getInstance();
	}
};

module.exports = {
	init: init,
	reset: reset,
	set: set,
	get: get,
	del: del,
	ledManager: ledManager
};
