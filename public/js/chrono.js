'use strict';

var rCar0 = {}, rCar1 = {}, rCar2 = {}, rCars = []; 
var rLaneOrder = [0,1,2];

var rTrackLength = 150; // TODO
var rTimeThreshold = 0.4; // TODO
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

const chronoAddLap = (currLane) => {
    var rTempTime = new Date().getTime();
    var rTempCars = _.filter(rCars, function(c){ return currLane == c.nextLane; });
    var rTempCar;
    if (_.size(rTempCars) == 1) {
        rTempCar = rTempCars[0];
    }
    else {
        // TODO FILTER BY THRESHOLD

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
    // TODO filter min threshold
    cars = _.filter(cars, function(c){ return true; });
    // TODO filter max threshold and set outOfBounds and totalTime = 99999
    cars = _.filter(cars, function(c){ return true; });
};

