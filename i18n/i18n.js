const { app } = require('electron').remote;
const fs = require('fs');
const path = require('path')
let loadedLanguage;

module.exports = i18n;

function i18n() {
     let tnpath = path.join(__dirname, app.getLocale().substring(0, 2) + '.json');
     // tnpath = path.join(__dirname, 'it.json'); // uncomment this line to force italian language
     if (fs.existsSync(tnpath)) {
          loadedLanguage = JSON.parse(fs.readFileSync(tnpath), 'utf8');
     }
     else {
          loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'));
     }
}

i18n.prototype.__ = function (phrase) {
     let translation = loadedLanguage[phrase];
     if (translation === undefined) {
          translation = phrase;
     }
     return translation;
}
