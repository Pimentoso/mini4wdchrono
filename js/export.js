'use strict';

const xls = require('exceljs');
const utils = require('./utils');
const { app } = require('electron').remote;
const fs = require('fs');
const path = require('path');
const storage = require('./storage');
const strftime = require('strftime');

const getXlsFilePath = () => {
	// {user home dir}/Mini4wdChrono
	let dir = app.getPath('home');
	return path.join(dir, 'Mini4wdChrono');
};

const createDir = () => {
	let dir = getXlsFilePath();
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}
	return dir;
};

const generateXls = () => {
	let track = storage.get('track');
	let tournament = storage.get('tournament');
	let playerList = tournament.players;
	let times = storage.getSortedPlayerList();

	let workbook = new xls.Workbook();
	workbook.creator = 'Mini4wd Chrono';
	workbook.created = new Date();
	workbook.modified = new Date();

	let worksheet = workbook.addWorksheet('Racers data');

	let headerRow = [
		'',
		'',
		'',
		_.times(tournament.manches.length, (i) => { return `Manche ${i + 1}` }),
		i18n.__('label-best-time'),
		i18n.__('label-best-2-times'),
		i18n.__('label-best-speed'),
		i18n.__('label-best-speed-km')
	];
	worksheet.addRow(_.flatten(headerRow));

	_.each(times, (info, pos) => {
		let bestTime = _.min(_.filter(info.times, (t) => { return t > 0 && t < 99999; }));
		let bestSpeed = track.length / (bestTime / 1000);

		let row = [];
		row.push(pos + 1);
		row.push(playerList[info.id].toUpperCase());
		row.push('');
		_.times(tournament.manches.length, (i) => {
			row.push(utils.prettyTime(info.times[i] || 0));
		});
		row.push(utils.prettyTime(bestTime));
		row.push(utils.prettyTime(info.best));
		row.push(bestSpeed.toFixed(2));
		row.push((bestSpeed * 3.6).toFixed(2));
		worksheet.addRow(row);
	});

	let dir = createDir();
	let filename = path.join(dir, `mini4wd_race_${strftime('%Y-%m-%d_%H-%M-%S', new Date())}.xlsx`);
	workbook.xlsx.writeFile(filename)
		.then(() => {
			// done
			$('#button-xls').removeAttr('disabled');
			$('#status-xls').text(`saved ${filename}`);
		});
};

module.exports = {
	generateXls: generateXls,
	createDir: createDir
};
