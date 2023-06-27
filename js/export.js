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
	let tournament = storage.get('tournament');
	let playerList = tournament.players;
	let mancheCount = tournament.manches.length;
	let playerData = storage.getPlayerData();

	let workbook = new xls.Workbook();
	workbook.creator = 'Mini4wd Chrono';
	workbook.created = new Date();
	workbook.modified = new Date();

	let worksheet = workbook.addWorksheet('Racers data');

	_.each(playerData, (pdata, pindex) => {
		let row = [playerList[pindex].toUpperCase()];
		pdata = pdata || [];
		_.times(mancheCount, (i) => {
			row[i + 1] = utils.prettyTime(pdata[i] ? pdata[i].time : null);
		});
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
