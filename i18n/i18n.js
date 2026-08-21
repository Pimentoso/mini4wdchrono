'use strict';

const fs = require('fs');
const path = require('path');
let loadedLanguage;

module.exports = i18n;

function i18n() {
    // Load English by default, we'll try to get the proper locale asynchronously
    loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'));

    // Try to load the correct locale asynchronously
    if (window.electronAPI && window.electronAPI.getAppLocale) {
        window.electronAPI.getAppLocale().then(locale => {
            const tnpath = path.join(__dirname, locale.substring(0, 2) + '.json');
            // const tnpath = path.join(__dirname, 'it.json'); // uncomment this line to force italian language
            if (fs.existsSync(tnpath)) {
                loadedLanguage = JSON.parse(fs.readFileSync(tnpath), 'utf8');
            }
        }).catch(err => {
            console.warn('Could not load locale, using English:', err);
        });
    }
}

i18n.prototype.__ = function (phrase) {
    let translation = loadedLanguage[phrase];
    if (translation === undefined) {
        translation = phrase;
    }
    return translation;
};
