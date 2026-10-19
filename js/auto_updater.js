'use strict';

// Main-process automatic updates from the GitHub Releases of the chrono.
// Only the packaged Windows build updates itself: it is installed with the NSIS
// installer, while macOS needs a signed app and the Linux and development builds
// are not installed at all. A downloaded update is installed when the operator
// asks for it from the banner, or silently when the app quits.

// How often a running chrono looks for a newer release.
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

// Reports whether this build can update itself.
const isSupported = (app, platform) => app.isPackaged === true && platform === 'win32';

// Creates the updater; loadAutoUpdater returns electron-updater's autoUpdater
// and is only called on builds that can update, so other builds never load it.
const createAutoUpdater = ({ app, platform, log, loadAutoUpdater, notify }) => {
    let autoUpdater = null;
    let checkTimer = null;
    let downloadedVersion = null;

    // Looks for a newer release; failures (e.g. offline at the track) are only logged.
    const check = () => {
        autoUpdater.checkForUpdates().catch((error) => {
            log.warn('[Updater] Update check failed:', error);
        });
    };

    // Starts checking for updates when this build supports them.
    const start = () => {
        if (!isSupported(app, platform)) {
            log.info('[Updater] Automatic updates are not available for this build');
            return false;
        }

        autoUpdater = loadAutoUpdater();
        autoUpdater.logger = log;
        autoUpdater.autoDownload = true;
        autoUpdater.autoInstallOnAppQuit = true;

        autoUpdater.on('update-downloaded', (info) => {
            downloadedVersion = info.version;
            log.info(`[Updater] Version ${downloadedVersion} downloaded`);
            notify(downloadedVersion);
        });
        autoUpdater.on('error', (error) => {
            log.warn('[Updater] Update failed:', error);
        });

        check();
        checkTimer = setInterval(check, CHECK_INTERVAL_MS);
        return true;
    };

    // Stops the periodic update checks.
    const stop = () => {
        clearInterval(checkTimer);
        checkTimer = null;
    };

    // Returns the version waiting to be installed, if any.
    const getDownloadedVersion = () => downloadedVersion;

    // Restarts the app into the downloaded version; the renderer only offers
    // this when no race is running.
    const install = () => {
        if (!autoUpdater || !downloadedVersion) {
            return false;
        }

        log.info(`[Updater] Restarting to install version ${downloadedVersion}`);
        // Silent install, then relaunch the updated chrono.
        autoUpdater.quitAndInstall(true, true);
        return true;
    };

    return {
        start: start,
        stop: stop,
        getDownloadedVersion: getDownloadedVersion,
        install: install
    };
};

module.exports = {
    CHECK_INTERVAL_MS: CHECK_INTERVAL_MS,
    createAutoUpdater: createAutoUpdater
};
