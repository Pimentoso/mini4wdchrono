var keypress = require("keypress");
var five = require("johnny-five");
var Tessel = require("tessel-io");
var board = new five.Board({
  io: new Tessel(),
  repl: false,
});

keypress(process.stdin);

board.on("ready", function() {
  var register = new five.ShiftRegister({
    pins: [ "a3", "a5", "a4" ],
    isAnode: true,
  });
  var number = 0;

  register.display(number);

  process.stdin.on("keypress", (character, key) => {
    if (key) {
     if (key.name === "q") {
         process.exit(0);
      }

      if (key.name === "up") {
        number++;
      }

      if (key.name === "down") {
        number--;
      }

      if (number > 9) {
        number = 0;
      }

      if (number < 0) {
         number = 9
      }

    } else {
      number = character;
    }

    register.display(number);
  });

  process.stdin.setRawMode(true);
  process.stdin.resume();

  console.log("Press 'q' to quit.");
});



var five = require("johnny-five");
var keypress = require("keypress");

keypress(process.stdin);
process.stdin.resume();

var board = new five.Board();

board.on("ready", function() {
	var forward = new five.Led(13);
	var back = new five.Led(7);
	var left = new five.Led(12);
	var right = new five.Led(8);

	forward.on();
	back.on();
	left.on();
	right.on();

	process.stdin.on("keypress", function(_, key) {
		if (!key) {
			return;
		}

		switch (key.name) {
			case "up":
				forward.toggle();
				back.on();
				break;

			case "down":
				back.toggle();
				forward.on();
				break;

			case "left":
				left.toggle();
				right.on();
				break;

			case "right":
				right.toggle();
				left.on();
				break;

			case "c":
				if (key.ctrl) {
					process.exit();
				}
				break;
		}
	});

	this.repl.inject({
		forward: forward,
		back: back,
		left: left,
		right: right
	});
});