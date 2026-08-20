'use strict';

let appLocale = null;

// Sets the locale used when formatting elapsed times.
const setLocale = (locale) => {
    appLocale = locale || 'en-US';
};

// Formats milliseconds as a localized seconds value.
const prettyTime = (millis) => {
    const locale = appLocale || 'en-US'; // fallback to en-US if not initialized yet
    return ((millis || 0) / 1000).toLocaleString(locale, { minimumFractionDigits: 3, maximumFractionDigits: 3 });
};

// Converts a localized seconds value to milliseconds.
const safeTime = (timeStr) => {
    return Math.round(parseFloat(timeStr.replace(',', '.')) * 1000);
};

module.exports = {
    setLocale: setLocale,
    prettyTime: prettyTime,
    safeTime: safeTime
};
