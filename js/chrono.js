'use strict';

const storage = require('./storage');

const DEFAULT_LANE_ORDER = [0, 1, 2];
const DEFAULT_TIME_THRESHOLD = 40;
const DEFAULT_SPEED_THRESHOLD = 5;
const DEFAULT_LAPS = 3;
const MIN_SPLIT_TIME_MS = 1000;
const MAX_RACE_TIME_MS = 99999;

const state = {
    cars: [],
    laneOrder: [...DEFAULT_LANE_ORDER],
    trackLength: 0,
    expectedSplitTime: 0,
    timeThreshold: DEFAULT_TIME_THRESHOLD / 100,
    speedThreshold: DEFAULT_SPEED_THRESHOLD,
    timeCutoffMin: 0,
    timeCutoffMax: 0,
    laps: DEFAULT_LAPS
};

// Creates fresh timing state for one car.
const createCar = (startLane, playerId = 0) => ({
    playerId: playerId,
    startLane: startLane,
    nextLane: startLane,
    lapCount: 0,
    startTimestamp: 0,
    currTimestamp: 0,
    endTimestamp: 0,
    currTime: 0,
    splitTimes: [],
    position: 0,
    delayFromFirst: 0,
    speed: 0,
    outOfBounds: false
});

// Restores a saved car while supplying defaults for missing fields.
const restoreCar = (car, lane) => ({
    ...createCar(lane),
    ...car,
    splitTimes: [...(car.splitTimes || [])]
});

// Initializes the timing engine for a new or restored race.
const init = (track, playerIds, cars) => {
    state.trackLength = track ? track.length : 0;
    state.laneOrder = track ? track.order.map((lane) => lane - 1) : [...DEFAULT_LANE_ORDER];

    state.timeThreshold = (storage.get('timeThreshold') || DEFAULT_TIME_THRESHOLD) / 100;
    state.speedThreshold = storage.get('speedThreshold') || DEFAULT_SPEED_THRESHOLD;
    state.laps = storage.get('roundLaps') || DEFAULT_LAPS;

    state.expectedSplitTime = state.trackLength / 3 / state.speedThreshold * 1000;

    state.timeCutoffMin = Math.max(
        MIN_SPLIT_TIME_MS,
        state.expectedSplitTime * (1 - state.timeThreshold)
    );

    state.timeCutoffMax = Math.max(
        state.timeCutoffMin,
        state.expectedSplitTime * (1 + state.timeThreshold)
    );

    if (cars === undefined) {
        state.cars = DEFAULT_LANE_ORDER.map((lane) => {
            // playerId will be zero on a free round
            const playerId = playerIds ? playerIds[lane] : 0;
            return createCar(lane, playerId);
        });
        return;
    }

    state.cars = cars.map((car, lane) => restoreCar(car, lane));
    calculateRace();
};

// Calculates the expected next split for a car.
const getExpectedSplitTime = (car) => {
    if (car.splitTimes.length === 0) {
        return state.expectedSplitTime;
    }

    const totalSplitTime = car.splitTimes.reduce((total, splitTime) => {
        return total + splitTime;
    }, 0);

    return totalSplitTime / car.splitTimes.length;
};

// Selects the most likely car for a sensor crossing.
const selectCandidate = (lane, timestamp) => {
    const candidates = state.cars
        .filter((car) => !car.outOfBounds && car.nextLane === lane)
        .map((car) => {
            if (car.startTimestamp === 0) {
                return {
                    car: car,
                    timingError: -1
                };
            }

            const elapsed = timestamp - car.currTimestamp;
            const expected = getExpectedSplitTime(car);

            return {
                car: car,
                elapsed: elapsed,
                timingError: Math.abs(elapsed - expected)
            };
        })
        .filter((candidate) => {
            if (candidate.car.startTimestamp === 0) {
                return true;
            }

            return candidate.elapsed >= state.timeCutoffMin &&
                  candidate.elapsed <= state.timeCutoffMax;
        })
        .sort((left, right) => {
            return left.timingError - right.timingError;
        });

    return candidates.length > 0 ? candidates[0].car : undefined;
};

// Records a sensor crossing using its main-process timestamp.
const addLap = (lane, timestamp) => {
    console.log('[Chrono] Sensor triggered', {
        timestamp: timestamp,
        lane: lane
    });

    const car = selectCandidate(lane, timestamp);

    if (!car) {
        console.warn('[Chrono] No valid car found', {
            timestamp: timestamp,
            lane: lane
        });
        return false;
    }

    console.log('[Chrono] Valid car found', {
        timestamp: timestamp,
        lane: lane,
        startLane: car.startLane
    });

    calculateCar(car, timestamp);
    return true;
};

// Updates one car after an accepted sensor crossing.
const calculateCar = (car, timestamp) => {
    if (car.lapCount > state.laps) {
        return;
    }

    if (car.lapCount === 0) {
        car.startTimestamp = timestamp;
    } else {
        car.splitTimes.push(timestamp - car.currTimestamp);
    }

    car.lapCount += 1;
    car.nextLane = nextLane(car.nextLane);
    car.currTimestamp = timestamp;
    car.currTime = timestamp - car.startTimestamp;

    const completedDistance = (state.trackLength / 3) * (car.lapCount - 1);
    car.speed = car.currTime > 0 ? completedDistance / (car.currTime / 1000) : 0;

    if (car.lapCount === state.laps + 1) {
        car.endTimestamp = timestamp;
    }

    calculateRace();
};

// Recalculates positions and same-checkpoint delays.
const calculateRace = () => {
    state.cars.forEach((car) => {
        car.position = 0;
        car.delayFromFirst = 0;
    });

    // Rank cars by highest lap count first, then lowest time
    const rankedCars = state.cars
        .filter((car) => {
            return !car.outOfBounds && car.lapCount >= 2;
        })
        .sort((left, right) => {
            return right.lapCount - left.lapCount ||
                  left.currTime - right.currTime;
        });

    rankedCars.forEach((car, index) => {
        car.position = index + 1;
    });

    if (rankedCars.length === 0) {
        return;
    }

    const leader = rankedCars[0];

    rankedCars.forEach((car) => {
        if (car.lapCount === leader.lapCount) {
            car.delayFromFirst = car.currTime - leader.currTime;
        }
    });
};

// Finds the next lane in the configured track order.
const nextLane = (lane) => {
    const currentIndex = state.laneOrder.indexOf(lane);
    const nextIndex = (currentIndex + 1) % state.laneOrder.length;

    return state.laneOrder[nextIndex];
};

// Reports whether every car has finished or left the track.
const isRaceFinished = () => {
    return state.cars.every((car) => {
        return car.outOfBounds || car.lapCount > state.laps;
    });
};

// Forcefully stops every car that is still racing.
const stopRace = () => {
    const runningCars = state.cars.filter((car) => {
        return !car.outOfBounds && car.lapCount <= state.laps;
    });

    runningCars.forEach((car) => {
        car.currTime = MAX_RACE_TIME_MS;
        car.outOfBounds = true;
    });

    if (runningCars.length > 0) {
        calculateRace();
    }

    return runningCars.length > 0;
};

// Marks cars that have exceeded their timing limits.
const checkOutCars = (timestamp) => {
    const timedOutCars = state.cars.filter((car) => {
        const splitTimedOut = timestamp - car.currTimestamp > state.timeCutoffMax;
        const raceTimedOut = timestamp - car.startTimestamp > MAX_RACE_TIME_MS;

        return car.startTimestamp > 0 &&
              !car.outOfBounds &&
              car.lapCount <= state.laps &&
              (splitTimedOut || raceTimedOut);
    });

    timedOutCars.forEach((car) => {
        car.currTime = MAX_RACE_TIME_MS;
        car.outOfBounds = true;
    });

    if (timedOutCars.length > 0) {
        calculateRace();
    }

    return timedOutCars.length > 0;
};

// Marks cars that did not cross their starting sensor.
const checkNotStartedCars = () => {
    const notStartedCars = state.cars.filter((car) => {
        return car.lapCount === 0 && !car.outOfBounds;
    });

    notStartedCars.forEach((car) => {
        car.currTime = MAX_RACE_TIME_MS;
        car.outOfBounds = true;
    });

    if (notStartedCars.length > 0) {
        calculateRace();
    }

    return notStartedCars.length > 0;
};

// Returns an isolated snapshot of the current car states.
const getCars = () => {
    return state.cars.map((car) => ({
        ...car,
        splitTimes: [...car.splitTimes]
    }));
};

module.exports = {
    init,
    addLap,
    getCars,
    stopRace,
    checkOutCars,
    checkNotStartedCars,
    isRaceFinished
};
