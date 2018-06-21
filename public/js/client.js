(function() {

  'use strict';

  const lapThreshold = 1000;

  let socket = window.io.connect('localhost:3000');

  const titleListening = $('#title-listening');
  const titleSuccess = $('#title-success');
  const buttonStart = $('#button-start');
  const lapList = $('#laps');

  const playerList = [];

  const addLap = (lane) => {
    if (startTime == 0) {
      startTime = new Date().getTime();
      lapList.append('<li>Start</li>'); 
    }
    else {
      tempTime = new Date().getTime();
      if (tempTime > startTime + lapThreshold) {
        lapTime = tempTime - startTime;
        startTime = tempTime;
        lapList.append('<li>' + (lapTime/1000) + '</li>'); 
      }
    }
  };

  const init = () => {
    chronoInit([1,2,3]); // TODO pass player ids
  };

  // ==== handle interface buttons

  buttonStart.on('click', (e) => {
    // socket.emit('start', true);
    lapList.empty();
    init();
  });

  // ==== listen to arduino events

  socket.on('connect', () => {
    console.log('connect');
    // socket.emit('join', 'Client is connected!');
  });

  socket.on('board_ready', (msg) => {
    console.log('board_ready');
    titleListening.addClass('is-off');
    titleSuccess.removeClass('is-off');
    buttonStart.removeClass('is-loading');
  });

  socket.on('board_exit', (msg) => {
    console.log('board_exit');
    titleListening.removeClass('is-off');
    titleSuccess.addClass('is-off');
  });

  socket.on('s1', (obj) => {
    if (obj == 0) {
      addLap(0);
    }
  });
  socket.on('s2', (obj) => {
    if (obj == 0) {
      addLap(1);
    }
  });
  socket.on('s3', (obj) => {
    if (obj == 0) {
      addLap(2);
    }
  });
})();