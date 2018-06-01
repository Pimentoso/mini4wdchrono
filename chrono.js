var five = require("johnny-five"),
  board, photoresistor, piezo, led,
  timeStart, 
  timeCurr1, timeLast1, t1, v1;

const sensorThreshold = 160;
const ignoreTimeMillis = 1000;

board = new five.Board();

board.on("ready", function() {

  timeStart = Date.now();
  timeCurr1 = timeStart - ignoreTimeMillis;

  // Create a new `photoresistor` hardware instance.
  photoresistor = new five.Sensor({
    pin: "A0",
    freq: 5
  });

  piezo = new five.Piezo(3);

  led = new five.Led(13);

  // Inject the `sensor` hardware into
  // the Repl instance's context;
  // allows direct command line access
  board.repl.inject({
    pot: photoresistor,
    buzz: piezo,
    led: led
  });

  led.on();

  // "data" get the current reading from the photoresistor
  photoresistor.on("data", function() {
    t1 = Date.now();
    v1 = this.value;
    console.log(v1);
    if (v1 >= sensorThreshold && t1 >= timeCurr1+ignoreTimeMillis) {
      console.log(t1-timeStart);
      timeCurr1 = t1;
      piezo.frequency(750, 50);
    }
  });

  // piezo.play({
  //   // song is composed by a string of notes
  //   // a default beat is set, and the default octave is used
  //   // any invalid note is read as "no note"
  //   song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
  //   beats: 1 / 4,
  //   tempo: 100
  // });
});

board.on("exit", function() {
  led.off();
  piezo.noTone();
});