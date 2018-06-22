'use strict';

var rCar0 = {}, rCar1 = {}, rCar2 = {}, rCars = []; 
var rLaneOrder = [0,1,2]; // TODO from interface
var rTrackLength = 150; // TODO from interface
var rTimeThreshold = 0.4; // TODO from interface
var rSpeedThreshold = 6; // speed in m/s to calculate cutoff
var rTimeCutoffMin = 0; // min lap cutoff
var rTimeCutoffMax = 0; // max lap cutoff
var checkTask;

const chronoInit = (playerIds) => {
    rTimeCutoffMin = rTrackLength / 3 / rSpeedThreshold * (1-rTimeThreshold) * 1000;
    rTimeCutoffMax = rTrackLength / 3 / rSpeedThreshold * (1+rTimeThreshold) * 1000;
    rCar0 = {
        playerId: playerIds[0],
        startLane: 0,
        nextLane: 0,
        lapCount: 0,
        startTime: 0,
        currTime: 0,
        endTime: 0,
        totalTime: 0,
        outOfBounds: false
    };
    rCar1 = {
        playerId: playerIds[1],
        startLane: 1,
        nextLane: 1,
        lapCount: 0,
        startTime: 0,
        currTime: 0,
        endTime: 0,
        totalTime: 0,
        outOfBounds: false
    };
    rCar2 = {
        playerId: playerIds[2],
        startLane: 2,
        nextLane: 2,
        lapCount: 0,
        startTime: 0,
        currTime: 0,
        endTime: 0,
        totalTime: 0,
        outOfBounds: false
    };
    rCars = [rCar0, rCar1, rCar2];

    checkTask = setInterval(checkCars, 1000);
};

// TODO ping function to stop race if no one finishes

const chronoAddLap = (currLane) => {
    var rTempTime = new Date().getTime();
    var rTempCars = _.filter(rCars, (c) => { 
        return c.outOfBounds == false && currLane == c.nextLane; 
    });

    // find the right car removing the ones not validating thresholds
    var rTempCar = _.find(rTempCars, (c) => {
        return c.outOfBounds == false && (c.startTime == 0 || ((rTempTime - c.currTime < rTimeCutoffMax) && (rTempTime - c.currTime > rTimeCutoffMin)));
    });

    if (rTempCar == null) {
        console.log('Error: no valid car for this signal');
        return;
    }

    // handle the car
    if (rTempCar.lapCount < 4) {
        if (rTempCar.lapCount == 0) {
            // start
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
        addLap(rTempCar);
    }
};

const nextLane = (currLane) => {
    return rLaneOrder[(rLaneOrder.indexOf(currLane) + 1) % rLaneOrder.length];
};

const checkCars = () => {
    if (_.every(rCars, (c) => { return c.outOfBounds || c.lapCount == 4; })) {
        // race finished, stop task
        clearInterval(checkTask);
        return;
    }

    // check cars over max time limit and set them as out
    var rCurrTime = new Date().getTime();
    _.each(_.filter(rCars, (c) => { 
        return c.startTime > 0 && !c.outOfBounds && (rCurrTime - c.currTime) > rTimeCutoffMax; 
    }), (c) => {
        c.totalTime = 99999;
        c.outOfBounds = true;
        addLap(c);
    });
};
