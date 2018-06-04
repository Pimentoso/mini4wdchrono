var five = require("johnny-five"),
  board, photoresistor, piezo, led,
  timerState,
  timeStart, 
  timeCurr1, timeLast1, t1, v1;

const sensorThreshold = 160;
const ignoreTimeMillis = 1000;
const STATE_STOPPED = 0;
const STATE_RUNNING = 1;

board = new five.Board();

board.on("ready", function() {

  timerState = STATE_STOPPED;
  timeStart = Date.now();
  timeCurr1 = timeStart - ignoreTimeMillis;

  // Create hardware instances.
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

  process.stdin.on("keypress", function(_, key) {
		if (!key) {
			return;
    }
    
    console.log(key.name);

		switch (key.name) {
      case "l":
        led.on();
        break;
      case 's':
        startTimer();
        break;
      case 'p':
        playSong();
        break;
    }
  });

  // "data" get the current reading from the photoresistor
  photoresistor.on("data", function() {
    if (timerState != STATE_RUNNING) {
      return;
    }
    handleInput(this.value);
  });
});

board.on("exit", function() {
  led.off();
  piezo.noTone();
});

var startTimer = function() {
  timerState = STATE_RUNNING;
  playSong();
};

var playSong = function() {
  piezo.noTone();
  piezo.play({
    // song is composed by a string of notes
    // a default beat is set, and the default octave is used
    // any invalid note is read as "no note"
    song: "C D F D A - A A A A G G G G - - C D F D G - G G G G F F F F - -",
    beats: 1 / 4,
    tempo: 100
  });
};

var handleInput = function(data) {
  t1 = Date.now();
  // console.log(v1);
  if (data >= sensorThreshold && t1 >= timeCurr1+ignoreTimeMillis) {
    console.log(t1-timeStart);
    timeCurr1 = t1;
    piezo.frequency(750, 50);
  }
};