var temporal = require("temporal");
var five = require("johnny-five");
var board, sensor, piezo, led;

board = new five.Board();

board.on("ready", function() {

  // Create hardware instances.
  sensor1 = new five.Sensor.Digital(8);
  sensor2 = new five.Sensor.Digital(9);
  sensor3 = new five.Sensor.Digital(10);
  piezo = new five.Piezo(3);
  led = new five.Led(13);

  board.repl.inject({
    s1: sensor1,
    s2: sensor2,
    s3: sensor3,
    p1: piezo,
    l1: led,
  });

  sensor1.on("change", function() {
    handleInput(1, this.value);
  });
  sensor2.on("change", function() {
    handleInput(2, this.value);
  });
  sensor3.on("change", function() {
    handleInput(3, this.value);
  });
});

board.on("exit", function() {
  led.off();
  piezo.noTone();
});

var playSound = function() {
  piezo.noTone();
  piezo.frequency(1000, 100);
};

var blinkLed = () => {
  led.on();
  temporal.queue([{
    wait: 200,
    task: () => {
      led.off();
    }
  }]);
};

var handleInput = function(lane, data) {
  if (data == 0) {
		console.log('CORSIA ' + lane);
    led.on();
    // playSound();
  }
  else {
    led.off();
    // piezo.noTone();
  }
};
