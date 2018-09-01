'use strict';

const Excel = require('exceljs');
const Utils = require('./utils');

const geneateXls = (mancheCount, playerData, playerTimes) => {

	var workbook = new Excel.Workbook();
	workbook.creator = 'Mini4wd Chrono';
	workbook.created = new Date();
	workbook.modified = new Date();

	var worksheet = workbook.addWorksheet('My Sheet');

	debugger;
	_.each(playerTimes, (pdata, pindex) => {
		let row = [playerData[pindex].toUpperCase()];
		pdata = pdata || [];
		_.times(mancheCount, (i) => {
			row[i+1] = Utils.prettyTime(pdata[i]);
		});
		worksheet.addRow(row);
	});

	let filename = 'mini4wd_race_' + Utils.strftime('%Y%m%d_%H%M%S', new Date()) + '.xlsx';
	workbook.xlsx.writeFile(filename)
		.then(function() {
			// done
			$('#button-xls').removeAttr('disabled');
			$('#status-xls').text('saved ' + filename);
		});
};

module.exports = {
	geneateXls: geneateXls
};
