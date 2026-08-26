  'use strict';

  const {
      after,
      beforeEach,
      describe,
      test
  } = require('node:test');
  const assert = require('node:assert/strict');

  const storage = require('../js/storage');

  const settings = {
      timeThreshold: 40,
      speedThreshold: 5,
      roundLaps: 3
  };

  const track = {
      length: 30,
      order: [1, 2, 3]
  };

  const originalStorageGet = storage.get;

  // Supplies deterministic settings without initializing renderer persistence.
  storage.get = (key) => settings[key];

  const chrono = require('../js/chrono');

  // Passes one car through all sensors for a three-lap race.
  const finishFirstCar = () => {
      chrono.addLap(0, 10000);
      chrono.addLap(1, 12000);
      chrono.addLap(2, 14000);
      chrono.addLap(0, 16000);
  };

  describe('chrono', () => {
      beforeEach(() => {
          chrono.init(track, [10, 20, 30]);
      });

      after(() => {
          storage.get = originalStorageGet;
          delete global._;
      });

      test('initializes one fresh car for each lane', () => {
          const cars = chrono.getCars();

          assert.equal(cars.length, 3);
          assert.deepEqual(
              cars.map((car) => car.playerId),
              [10, 20, 30]
          );
          assert.deepEqual(
              cars.map((car) => car.startLane),
              [0, 1, 2]
          );
          assert.deepEqual(
              cars.map((car) => car.nextLane),
              [0, 1, 2]
          );
          assert.ok(cars.every((car) => car.lapCount === 0));
      });

      test('starts a car on its first sensor crossing', () => {
          chrono.addLap(0, 10000);

          const car = chrono.getCars()[0];

          assert.equal(car.startTimestamp, 10000);
          assert.equal(car.currTimestamp, 10000);
          assert.equal(car.currTime, 0);
          assert.equal(car.lapCount, 1);
          assert.equal(car.nextLane, 1);
          assert.equal(car.speed, 0);
      });

      test('records split times using supplied timestamps', () => {
          chrono.addLap(0, 10000);
          chrono.addLap(1, 12000);
          chrono.addLap(2, 14000);

          const car = chrono.getCars()[0];

          assert.equal(car.lapCount, 3);
          assert.equal(car.currTime, 4000);
          assert.deepEqual(car.splitTimes, [2000, 2000]);
          assert.equal(car.speed, 5);
      });

      test('accepts a crossing exactly at the minimum cutoff', () => {
          // Expected split is 2000 ms. At 40%, the minimum is 1200 ms.
          chrono.addLap(0, 10000);
          chrono.addLap(1, 11200);

          const car = chrono.getCars()[0];

          assert.equal(car.lapCount, 2);
          assert.deepEqual(car.splitTimes, [1200]);
      });

      test('accepts a crossing exactly at the maximum cutoff', () => {
          // Expected split is 2000 ms. At 40%, the maximum is 2800 ms.
          chrono.addLap(0, 10000);
          chrono.addLap(1, 12800);

          const car = chrono.getCars()[0];

          assert.equal(car.lapCount, 2);
          assert.deepEqual(car.splitTimes, [2800]);
      });

      test('rejects a crossing outside the cutoff interval', () => {
          chrono.addLap(0, 10000);
          chrono.addLap(1, 12801);

          const car = chrono.getCars()[0];

          assert.equal(car.lapCount, 1);
          assert.deepEqual(car.splitTimes, []);
      });

      test('finishes after the configured number of laps', () => {
          finishFirstCar();

          const car = chrono.getCars()[0];

          assert.equal(car.lapCount, 4);
          assert.equal(car.currTime, 6000);
          assert.equal(car.endTimestamp, 16000);
          assert.equal(car.speed, 5);
          assert.equal(car.position, 1);
      });

      test('marks a started car out after its split timeout', () => {
          chrono.addLap(0, 10000);

          const changed = chrono.checkOutCars(12801);
          const car = chrono.getCars()[0];

          assert.equal(changed, true);
          assert.equal(car.outOfBounds, true);
          assert.equal(car.currTime, 99999);
      });

      test('does not time out a car exactly at the maximum cutoff', () => {
          chrono.addLap(0, 10000);

          const changed = chrono.checkOutCars(12800);
          const car = chrono.getCars()[0];

          assert.equal(changed, false);
          assert.equal(car.outOfBounds, false);
      });

      test('marks cars that did not start as out only once', () => {
          const firstCheck = chrono.checkNotStartedCars();
          const secondCheck = chrono.checkNotStartedCars();

          assert.equal(firstCheck, true);
          assert.equal(secondCheck, false);
          assert.ok(
              chrono.getCars().every((car) => car.outOfBounds)
          );
      });

      test('reports the race finished when every car finished or went out', () => {
          finishFirstCar();
          chrono.checkNotStartedCars();

          assert.equal(chrono.isRaceFinished(), true);
      });

      test('stops every car that is still racing', () => {
          chrono.addLap(0, 10000);

          const changed = chrono.stopRace();
          const cars = chrono.getCars();

          assert.equal(changed, true);
          assert.ok(cars.every((car) => car.outOfBounds));
          assert.ok(cars.every((car) => car.currTime === 99999));
          assert.equal(chrono.isRaceFinished(), true);
      });

      test('returns car snapshots that cannot mutate internal state', () => {
          const cars = chrono.getCars();

          cars[0].lapCount = 99;
          cars[0].splitTimes.push(1234);

          const freshCars = chrono.getCars();

          assert.equal(freshCars[0].lapCount, 0);
          assert.deepEqual(freshCars[0].splitTimes, []);
      });
  });