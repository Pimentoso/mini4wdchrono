'use strict';

const xls = require('exceljs');
const utils = require('./utils');
const { app } = require('electron').remote;
const fs = require('fs');
const path = require('path');

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

const geneateXls = (mancheCount, playerData, playerTimes) => {
	let workbook = new xls.Workbook();
	workbook.creator = 'Mini4wd Chrono';
	workbook.created = new Date();
	workbook.modified = new Date();

	let worksheet = workbook.addWorksheet('Racers data');

	_.each(playerTimes, (pdata, pindex) => {
		let row = [playerData[pindex].toUpperCase()];
		pdata = pdata || [];
		_.times(mancheCount, (i) => {
			row[i+1] = utils.prettyTime(pdata[i]);
		});
		worksheet.addRow(row);
	});

	let dir = createDir();
	let filename = path.join(dir, `mini4wd_race_${utils.strftime('%Y-%m-%d_%H-%M-%S', new Date())}.xlsx`);
	workbook.xlsx.writeFile(filename)
		.then(() =>  {
			// done
			$('#button-xls').removeAttr('disabled');
			$('#status-xls').text(`saved ${filename}`);
		});
};

module.exports = {
	geneateXls: geneateXls,
	createDir: createDir
};
