const { spawnSync } = require('child_process');

// Ensure Node version is recent enough for building native modules.
// serialport and modern electron require Node >= 16 on most systems.
const nodeMajor = parseInt(process.versions.node.split('.')[0], 10);
if (isNaN(nodeMajor) || nodeMajor < 20) {
    console.error('\nERROR: Unsupported Node.js version:', process.versions.node);
    console.error('This project requires Node.js >= 20.');
    console.error('Please upgrade your Node.js (use nodenv/nvm/asdf) and re-run `npm install`.\n');
    process.exitCode = 1;
} else {
    try {
    // Run electron-rebuild via npx to rebuild native modules for the installed Electron.
        console.log('Running electron-rebuild to compile native modules...');
        const res = spawnSync('npx', ['electron-rebuild', '--force', '--parallel'], { stdio: 'inherit' });
        if (res.error) {
            console.error('\npostinstall: failed to run electron-rebuild:', res.error.message);
            process.exitCode = 1;
        } else if (res.status !== 0) {
            console.error('\nelectron-rebuild failed with exit code', res.status);
            process.exitCode = res.status || 1;
        }
    } catch (error) {
        console.error('\npostinstall: failed to run electron-rebuild:', error.message || error);
        process.exitCode = 1;
    }
}
