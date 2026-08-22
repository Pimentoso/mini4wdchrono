'use strict';

// Excel generation stays in renderer since it's DOM-related

const xls = require('exceljs');
const utils = require('./utils');
const storage = require('./storage');
const strftime = require('strftime');

// Retrieves the base directory used for race exports.
const getXlsFilePath = async () => {
    try {
        return await window.electronAPI.getAppPath('home');
    } catch (error) {
        console.error('[Export] Failed to get export path:', error);
        throw error;
    }
};

// Ensures the application's export directory exists.
const createDir = async () => {
    try {
        const dir = await getXlsFilePath();
        const exportDir = dir + '/Mini4wdChrono';
        await window.electronAPI.ensureDir(exportDir);
        return exportDir;
    } catch (error) {
        console.error('[Export] Failed to create export directory:', error);
        throw error;
    }
};

// Generates and saves an Excel workbook for the current tournament.
const generateXls = async () => {
    try {
        const track = await storage.get('track');
        const tournament = await storage.get('tournament');
        const playerList = tournament.players;
        const times = await storage.getSortedPlayerList();

        const workbook = new xls.Workbook();
        workbook.creator = 'Mini4wd Chrono';
        workbook.created = new Date();
        workbook.modified = new Date();

        const worksheet = workbook.addWorksheet('Racers data');

        const headerRow = [
            '',
            '',
            '',
            _.times(tournament.manches.length, (i) => { return `Manche ${i + 1}`; }),
            i18n.__('label-best-time'),
            i18n.__('label-best-2-times'),
            i18n.__('label-best-speed'),
            i18n.__('label-best-speed-km')
        ];
        worksheet.addRow(_.flatten(headerRow));

        _.each(times, (info, pos) => {
            const bestTime = _.min(_.filter(info.times, (t) => { return t > 0 && t < 99999; }));
            const bestSpeed = track.length / (bestTime / 1000);

            const row = [];
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

        const dir = await createDir();
        const filename = dir + `/mini4wd_race_${strftime('%Y-%m-%d_%H-%M-%S', new Date())}.xlsx`;

        // Write Excel file
        await workbook.xlsx.writeFile(filename);

        // Update UI
        $('#button-xls').removeAttr('disabled');
        $('#status-xls').text(`saved ${filename}`);

        return filename;
    } catch (error) {
        console.error('[Export] Failed to generate Excel file:', error);
        $('#button-xls').removeAttr('disabled');
        $('#status-xls').text(`Error: ${error.message}`);
        throw error;
    }
};

module.exports = {
    generateXls: generateXls,
    createDir: createDir
};
