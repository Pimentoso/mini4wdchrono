'use strict';

let appLocale = null;

// Initialize locale (call once at startup)
const initLocale = async () => {
    try {
        appLocale = await window.electronAPI.getAppLocale();
    } catch (err) {
        console.warn('Could not get app locale, using default:', err);
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

/* Chainable timeout function
 *
 * Reference:
 * https://stackoverflow.com/questions/6921275/is-it-possible-to-chain-settimeout-functions-in-javascript
 */
const delay = (fn, t) => {
    // private instance variables
    let queue = [], timer;

    function schedule(fn, t) {
        timer = setTimeout(function () {
            timer = null;
            fn();
            if (queue.length) {
                const item = queue.shift();
                schedule(item.fn, item.t);
            }
        }, t);
    }

    const self = {
        delay: function (fn, t) {
            // if already queuing things or running a timer,
            //   then just add to the queue
            if (queue.length || timer) {
                queue.push({ fn: fn, t: t });
            } else {
                // no queue or timer yet, so schedule the timer
                schedule(fn, t);
            }
            return self;
        },
        cancel: function () {
            clearTimeout(timer);
            queue = [];
            return self;
        }
    };
    
    return self.delay(fn, t);
};

module.exports = {
    initLocale: initLocale,
    prettyTime: prettyTime,
    delay: delay,
    safeTime: safeTime
};
