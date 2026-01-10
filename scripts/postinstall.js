const { execSync } = require('child_process');
const path = require('path');

// Note: Electron 37+ requires Python 3.7+ for native module compilation
// Make sure python3 is available on your systemconst electron_version = execSync(path.join('node_modules', '.bin', 'electron -v')).toString().trim();
execSync(path.join('node_modules', '.bin', 'electron-rebuild -v ' + electron_version));    