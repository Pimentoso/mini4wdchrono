const path = require('path')
const electron = require('electron')
const fs = require('fs');
let loadedLanguage;
let app = electron.app ? electron.app : electron.remote.app

module.exports = i18n;

function i18n() {
     let tnpath = path.join(__dirname, 'it.json');
     // let tnpath = path.join(__dirname, app.getLocale().substring(0, 2) + '.json');
     if (fs.existsSync(tnpath)) {
          loadedLanguage = JSON.parse(fs.readFileSync(tnpath), 'utf8');
     }
     else {
          loadedLanguage = JSON.parse(fs.readFileSync(path.join(__dirname, 'en.json'), 'utf8'));
     }
}

i18n.prototype.__ = function (phrase) {
     let translation = loadedLanguage[phrase]
     if (translation === undefined) {
          translation = phrase
     }
     return translation
}