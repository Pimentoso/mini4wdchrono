'use strict';

const configuration = require('./configuration');

let rCar0, rCar1, rCar2, rCars;
let rLaneOrder = [0, 1, 2];
let rTrackLength = 0;
let rTimeThreshold = configuration.readSettings('timeThreshold'); // percentage of single lap time to calculate cutoff
let rSpeedThreshold = configuration.readSettings('speedThreshold'); // speed in m/s to calculate cutoff
let rTimeCutoffMin = 0; // min lap cutoff
let rTimeCutoffMax = 0; // max lap cutoff

// car object template
const carObj = {
	playerId: 0,
	startLane: 0,
	nextLane: 0,
	lapCount: 0,
	startTimestamp: 0, // start time UNIX TIMESTAMP
	currTimestamp: 0, // current lap time  UNIX TIMESTAMP
	endTimestamp: 0, // finish time UNIX TIMESTAMP
	currTime: 0, // current lap time millis
	splitTimes: [],
	position: 0,
	delayFromFirst: 0,
	speed: 0,
	outOfBounds: false
};

const init = (track, playerIds, cars) => {
	// cutoff time calculation
	rTrackLength = track.length;
	rLaneOrder = _.map(track.order, (i) => { return i-1; });
	rTimeCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold) * 1000;
	rTimeCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold) * 1000;

	// console.log('track length ' + rTrackLength);
	// console.log('track order ' + rLaneOrder);
	// console.log('time cutoff min ' + rTimeCutoffMin);
	// console.log('time cutoff max ' + rTimeCutoffMax);

	if (cars == null) {
		// init car 1
		rCar0 = JSON.parse(JSON.stringify(carObj));
		rCar0.playerId = playerIds[0];
		rCar0.startLane = 0;
		rCar0.nextLane = 0;

		// init car 2
		rCar1 = JSON.parse(JSON.stringify(carObj));
		rCar1.playerId = playerIds[1];
		rCar1.startLane = 1;
		rCar1.nextLane = 1;

		// init car 3
		rCar2 = JSON.parse(JSON.stringify(carObj));
		rCar2.playerId = playerIds[2];
		rCar2.startLane = 2;
		rCar2.nextLane = 2;

		// car array
		rCars = [rCar0, rCar1, rCar2];
	}
	else {
		rCars = cars;
	}
};

// method called when a sensor receives a signal
const addLap = (lane) => {
	// current time in milliseconds
	let timestamp = new Date().getTime();

	console.log("======= got signal " + lane + " time " + timestamp);
	// console.log(JSON.stringify(rCars, null, 2));

	// find all cars that may have passes under this lane sensor
	let rTempCars = _.filter(rCars, (c) => {
		return c.outOfBounds == false && lane == c.nextLane;
	});

	// console.log(JSON.stringify(rTempCars, null, 2));

	// find the correct car removing the ones not validating thresholds
	let rTempCar = _.find(rTempCars, (c) => {
		return c.outOfBounds == false && (c.startTimestamp == 0 || ((timestamp - c.currTimestamp < rTimeCutoffMax) && (timestamp - c.currTimestamp > rTimeCutoffMin)));
	});

	// false sensor read
	if (rTempCar == null) {
		console.log('Error: no valid car for signal on lane ' + lane);
		return;
	}
	else {
		console.log('valid car ' + rTempCar.startLane);
	}

	// handle the correct car
	calculateCar(rTempCar, timestamp);
};

const calculateCar = (car, timestamp) => {
	if (car.lapCount < 4) {
		if (car.lapCount == 0) {
			// start
			car.startTimestamp = timestamp;
		}
		car.lapCount += 1;
		car.nextLane = nextLane(car.nextLane);
		car.currTimestamp = timestamp;
		car.currTime = timestamp - car.startTimestamp;
		car.speed = (rTrackLength/3)*(car.lapCount-1)/(car.currTime/1000);
		car.splitTimes.push(car.currTime);
		if (car.lapCount == 4) {
			// finish
			car.endTimestamp = timestamp;
		}
		calculateRace();
	}
};

const calculateRace = () => {
	let bestTime = 0;
	let bestLap = _.max(rCars, (c) => { return c.lapCount; }).lapCount;
	let pos = 0;

	// first are the cars with the highest lap count,
	// then with same lapCount first is the one with lowest time
	_.each([4,3,2], (lap) => {
		let runningCars = _.filter(rCars, (c) => { return c.lapCount == lap; });
		_.each(_.sortBy(runningCars, 'currTime'), (c,i) => {
			if (lap == bestLap) {
				if (i == 0) {
					bestTime = c.currTime;
					c.delayFromFirst = 0;
				}
				else {
					c.delayFromFirst = c.currTime - bestTime;
				}
			}
			else {
				// azzerare c.delayFromFirst? provare
			}
			pos++;
			c.position = pos;
		});
	});
};

// find next lane following the right order (1-2-3 or 1-3-2)
const nextLane = (lane) => {
	return rLaneOrder[(rLaneOrder.indexOf(lane) + 1) % rLaneOrder.length];
};

const isRaceFinished = () => {
	return _.every(rCars, (c) => { return c.outOfBounds || c.lapCount == 4; });
};

// called by timer task
const checkOutCars = () => {
	// check cars over max time limit and set them as out
	let timestamp = new Date().getTime();
	let dirty = false;
	_.each(_.filter(rCars, (c) => {
		return c.startTimestamp > 0 && !c.outOfBounds && (timestamp - c.currTimestamp) > rTimeCutoffMax;
	}), (c) => {
		c.currTime = 99999;
		c.outOfBounds = true;
		dirty = true;
	});

	if (dirty) calculateRace();

	return dirty;
};

// called once after 5 seconds
const checkNotStartedCars = () => {
	// check cars not started and set them as out
	let dirty = false;
	_.each(_.filter(rCars, (c) => {
		return c.lapCount == 0;
	}), (c) => {
		c.currTime = 99999;
		c.outOfBounds = true;
		dirty = true;
	});

	if (dirty) calculateRace();

	return dirty;
};

const getCars = () => { return rCars; };

module.exports = {
	init: init,
	addLap: addLap,
	getCars: getCars,
	checkOutCars: checkOutCars,
	checkNotStartedCars: checkNotStartedCars,
	isRaceFinished: isRaceFinished
};
