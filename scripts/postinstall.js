const { exec } = require('child_process');

exec("./node_modules/.bin/electron -v", (_1, stdout, _2) => {
    var electron_version = stdout.trim();
    exec("./node_modules/.bin/electron-rebuild -v " + electron_version);
});