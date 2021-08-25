const { execSync } = require('child_process');
const path = require('path');

var electron_version = execSync(path.join('node_modules', '.bin', 'electron -v')).toString().trim();
execSync(path.join('node_modules', '.bin', 'electron-rebuild -v ' + electron_version));
    