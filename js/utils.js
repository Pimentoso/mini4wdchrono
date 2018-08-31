'use strict';

const prettyTime = (millis) => {
	return ((millis || 0)/1000).toFixed(3);
};

module.exports = {
	prettyTime: prettyTime
};
