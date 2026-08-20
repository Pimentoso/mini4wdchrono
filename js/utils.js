'use strict';

let appLocale = null;

// Initialize locale (call once at startup)
const initLocale = async () => {
    try {
        appLocale = await window.electronAPI.getAppLocale();
    } catch (err) {
        console.warn('[Locale] Could not get app locale; using default:', err);
        appLocale = 'en-US';
    }
};

// converts a milliseconds integer in a readable string like '12.345'
const prettyTime = (millis) => {
    const locale = appLocale || 'en-US'; // fallback to en-US if not initialized yet
    return ((millis || 0) / 1000).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

// converts a string like '12,345' or '12.345' into a milliseconds integer like 12345
const safeTime = (timeStr) => {
    return Math.round(parseFloat(timeStr.replace(',', '.')) * 1000);
};

module.exports = {
    initLocale: initLocale,
    prettyTime: prettyTime,
    safeTime: safeTime
};
