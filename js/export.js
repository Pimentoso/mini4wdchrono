'use strict';

// Excel generation stays in renderer since it's DOM-related

const XlsxPopulate = require('xlsx-populate');
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

        const workbook = await XlsxPopulate.fromBlankAsync();
        workbook.properties().set('creator', 'Mini4wd Chrono');

        const worksheet = workbook.sheet(0);
        worksheet.name('Racers data');

        const headerRow = [
            '',
            '',
            '',
            Array.from({ length: tournament.manches.length }, (_value, i) => { return `Manche ${i + 1}`; }),
            i18n.__('label-best-time'),
            i18n.__('label-best-2-times'),
            i18n.__('label-best-speed'),
            i18n.__('label-best-speed-km')
        ];
        const rows = [headerRow.flat()];

        times.forEach((info, pos) => {
            const bestTime = Math.min(...info.times.filter((t) => { return t > 0 && t < 99999; }));
            const bestSpeed = track.length / (bestTime / 1000);

            const row = [];
            row.push(pos + 1);
            row.push(playerList[info.id].toUpperCase());
            row.push('');
            Array.from({ length: tournament.manches.length }, (_value, i) => {
                row.push(utils.prettyTime(info.times[i] || 0));
            });
            row.push(utils.prettyTime(bestTime));
            row.push(utils.prettyTime(info.best));
            row.push(bestSpeed.toFixed(2));
            row.push((bestSpeed * 3.6).toFixed(2));
            rows.push(row);
        });

        const dir = await createDir();
        const filename = dir + `/mini4wd_race_${strftime('%Y-%m-%d_%H-%M-%S', new Date())}.xlsx`;

        // Write Excel file
        worksheet.cell('A1').value(rows);
        await workbook.toFileAsync(filename);

        return filename;
    } catch (error) {
        console.error('[Export] Failed to generate Excel file:', error);
        throw error;
    }
};

module.exports = {
    generateXls: generateXls,
    createDir: createDir
};
