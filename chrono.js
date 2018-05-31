var five = require("johnny-five"),
  board, photoresistor, timeStart, 
  timeCurr1, timeLast1, t1, v1;

const sensorThreshold = 100;
const ignoreTimeMillis = 1000;

board = new five.Board();

board.on("ready", function() {

  timeStart = Date.now();
  timeLast1 = timeStart - ignoreTimeMillis;

  // Create a new `photoresistor` hardware instance.
  photoresistor = new five.Sensor({
    pin: "A2",
    freq: 2
  });

  // Inject the `sensor` hardware into
  // the Repl instance's context;
  // allows direct command line access
  board.repl.inject({
    pot: photoresistor
  });

  // "data" get the current reading from the photoresistor
  photoresistor.on("data", function() {
    t1 = Date.now();
    v1 = this.value;
    if (v1 >= sensorThreshold && t1 >= timeCurr1+ignoreTimeMillis) {
      console.log(t1);
      timeCurr1 = t1;
    }

  });
});
