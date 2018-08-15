var temporal = require("temporal");
var five = require("johnny-five");
var board, sensor, piezo, led;

board = new five.Board();

board.on("ready", function() {

  // Create hardware instances.
  sensor = new five.Sensor.Digital(8);
  piezo = new five.Piezo(3);
  led = new five.Led(13);

  board.repl.inject({
    s1: sensor,
    p1: piezo,
    l1: led,
  });

  sensor.on("change", function() {
    handleInput(this.value);
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

var handleInput = function(data) {
	console.log(data);
  if (data == 0) {
    led.on();
    // playSound();
  }
  else {
    led.off();
    // piezo.noTone();
  }
};
