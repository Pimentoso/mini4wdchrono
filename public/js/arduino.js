(function() {

  'use strict';

  const j5 = require('johnny-five');
  // const temporal = require('temporal');
  var connected = false;
  var led1, sensor1;
  var pingTimer;

  module.exports = (socket) => {
    const board = new j5.Board();

    board.on('ready', () => {

      // ==== ping board_ready event every 3 sec
      pingTimer = setInterval(function() { 
        if (connected) {
          console.log('ping');
          socket.emit('board_ready', true);
        }
      }, 3000);

      // ==== hardware init
      sensor1 = new j5.Sensor.Digital(5);
      led1 = new j5.Led(13);

      // ==== emit events to client
      sensor1.on('change', (e) => {
        socket.emit('sensor', e);
      });
    });

    board.on("exit", () => {
      socket.emit('board_exit', true);
      if (led1) {
        led1.stop().off();
      }
      clearInterval(pingTimer);
    });

    socket.sockets.on('connection', (socket) => {
      console.log('socket connected');
      connected = true;

      // ==== listen to client events
      socket.on('down', () => led1.on());
      socket.on('up', () => led1.stop().off());
      socket.on('hold', () => led1.blink(200));
    });
  };

})();