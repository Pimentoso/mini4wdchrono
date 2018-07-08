(function(window) {

	'use strict';

	let rCar0, rCar1, rCar2, rCars;
	let rLaneOrder = [0, 1, 2];
	let rTrackLength = 100;
	let rTimeThreshold = 0.4; // TODO from interface
	let rSpeedThreshold = 5; // speed in m/s to calculate cutoff
	let rTimeCutoffMin = 0; // min lap cutoff
	let rTimeCutoffMax = 0; // max lap cutoff
	let rCheckTask;

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

	window.chronoInit = (playerIds, track) => {
		// cutoff time calculation
		rTrackLength = track.length;
		rLaneOrder = track.order;
		rTimeCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1 - rTimeThreshold) * 1000;
		rTimeCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1 + rTimeThreshold) * 1000;

		console.log('track length ' + rTrackLength);
		console.log('track order ' + rLaneOrder);
		console.log('time cutoff min ' + rTimeCutoffMin);
		console.log('time cutoff max ' + rTimeCutoffMax);

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

		// run checkTask every 1 second
		rCheckTask = setInterval(checkCars, 1000);

		drawRace(rCars);
	};

	// method called when a sensor receives a signal
	window.chronoAddLap = (currLane) => {
		// current time in milliseconds
		let timestamp = new Date().getTime();

		// find all cars that may have passes under this lane sensor
		let rTempCars = _.filter(rCars, (c) => {
			return c.outOfBounds == false && currLane == c.nextLane;
		});

		// find the correct car removing the ones not validating thresholds
		let rTempCar = _.find(rTempCars, (c) => {
			return c.outOfBounds == false && (c.startTimestamp == 0 || ((timestamp - c.currTimestamp < rTimeCutoffMax) && (timestamp - c.currTimestamp > rTimeCutoffMin)));
		});

		// false sensor read
		if (rTempCar == null) {
			console.log('Error: no valid car for signal on lane ' + currLane);
			return;
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
			updateRace(rCars);
			drawRace(rCars);
		}
	};

	const calculateRace = () => {
		let bestTime = 0;
		let filteredCars = _.filter(rCars, (c) => { return c.currTime > 0; })
		_.each(_.sortBy(filteredCars, 'currTime'), (car,i) => {
			// TODO NON TIENE CONTO DEI GIRI FATTI
			if (i == 0) {
				bestTime = car.currTime;
				car.delayFromFirst = 0;
			}
			else {
				car.delayFromFirst = car.currTime - bestTime;
			}
			car.position = i+1;
		});
	};

	// find next lane following the right order (1-2-3 or 1-3-2)
	const nextLane = (currLane) => {
		return rLaneOrder[(rLaneOrder.indexOf(currLane) + 1) % rLaneOrder.length];
	};

	// timer task to check for cars out of track
	const checkCars = () => {
		if (_.every(rCars, (c) => { return c.outOfBounds || c.lapCount == 4; })) {
			// race finished, kill this task
			clearInterval(rCheckTask);
			return;
		}

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
		if (dirty) {
			calculateRace();
			drawRace(rCars);
		}
	};

})(window);
