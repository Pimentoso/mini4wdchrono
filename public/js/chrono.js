'use strict';

var rCar0 = {}, rCar1 = {}, rCar2 = {}, rCars = []; 
var rLaneOrder = [0,1,2]; // TODO from interface
var rTrackLength = 150; // TODO from interface
var rTimeThreshold = 0.4; // TODO from interface
var rSpeedThreshold = 6; // speed in m/s to calculate cutoff
var rTimeCutoffMin = 0; // min lap cutoff
var rTimeCutoffMax = 0; // max lap cutoff

const chronoInit = (playerIds) => {
    rTimeCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1-rTimeThreshold);
    rTimeCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1+rTimeThreshold);
    rCar0 = {
        playerId = playerIds[0],
        startLane = 0,
        nextLane = 0,
        lapCount = 0,
        startTime = 0,
        currTime = 0,
        endTime = 0,
        totalTime = 0,
        outOfBounds = false
    };
    rCar1 = {
        playerId = playerIds[1],
        startLane = 1,
        nextLane = 1,
        lapCount = 0,
        startTime = 0,
        currTime = 0,
        endTime = 0,
        totalTime = 0,
        outOfBounds = false
    };
    rCar2 = {
        playerId = playerIds[2],
        startLane = 2,
        nextLane = 2,
        lapCount = 0,
        startTime = 0,
        currTime = 0,
        endTime = 0,
        totalTime = 0,
        outOfBounds = false
    };
    rCars = [rCar0, rCar1, rCar2];
};

// TODO ping function to stop race if no one finishes

const chronoAddLap = (currLane) => {
    var rTempTime = new Date().getTime();
    var rTempCars = _.filter(rCars, (c) => { currLane == c.nextLane });
    var rTempCar;
    if (_.size(rTempCars) == 1) {
        rTempCar = rTempCars[0];
    }
    else {
        markCarsOutOfBounds(rTempCars, rTempTime);
        rTempCar = filterCarsByThreshold(rTempCars, rTempTime);
    }

    // handle the car
    if (rTempCar.lapCount == 0) {
        rTempCar.startTime = rTempTime;
    }
    rTempCar.lapCount += 1;
    rTempCar.nextLane = nextLane(rTempCar.nextLane);
    rTempCar.currTime = rTempTime;
    if (rTempCar.lapCount == 4) {
        // finish
        rTempCar.endTime = rTempTime;
        rTempCar.totalTime = rTempCar.endTime - rTempCar.startTime;
    }
};

const nextLane = (currLane) => {
    rLaneOrder[(rLaneOrder.indexOf(currLane) + 1) % rLaneOrder.length];
};

const filterCarsByThreshold = (cars, currTime) => {
    return _.find(cars, (c) => { 
        (currTime - c.currTime > rTimeCutoffMax) && (currTime - c.currTime < rTimeCutoffMin);
    });
};

const markCarsOutOfBounds = (cars, currTime) => {
    _.each(_.filter(cars, (c) => { currTime - c.currTime > rTimeCutoffMax; }), (c) => {
        c.totalTime = 99999;
        c.outOfBounds = true;
    });
};

