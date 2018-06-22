(function() {

  'use strict';

  let socket = window.io.connect('localhost:3000');

  const titleListening = $('#title-listening');
  const titleSuccess = $('#title-success');
  const buttonStart = $('#button-start');
  const lapList0 = $('#laps0');
  const lapList1 = $('#laps1');
  const lapList2 = $('#laps2');

  // FOR DEBUG
  // import from API at https://mini4wd-tournament.pimentoso.com/
  var playerList = ["bardotti","frati","guicciardi","landozzi","cardella","gagliardi","dardozzi","vignoli","ferri","menegatti","scopelliti","froli","foresio"];
  var mancheList = [[[11,2,12],[-1,7,6],[8,0,5],[9,4,3],[10,1,-1]],[[1,3,0],[12,6,8],[2,5,10],[7,-1,4],[-1,9,11]],[[3,8,11],[4,6,5],[0,12,10],[-1,1,2],[7,-1,9]]];
  // FOR DEBUG

  var boardConnected = false;
  var currManche = 0;
  var currRound = 0;
  var currLap;

  const init = () => {
    currManche = 0;
    currRound = 0;
    chronoInit(mancheList[currManche][currRound]);
  };

  const addLap = (lane, lapTimeMillis) => {
    // called from chrono.js
    $('#laps' + lane).append('<li>' + (lapTimeMillis/1000) + '</li>'); 
  };

  // ==========================================================================
  // ==== handle interface buttons

  buttonStart.on('click', (e) => {
    if (!boardConnected) 
      return;

    // socket.emit('start', true);
    lapList0.empty();
    lapList0.append('<li>' + (playerList[mancheList[currManche][currRound][0]] || '-') + '</li>'); 
    lapList1.empty();
    lapList0.append('<li>' + (playerList[mancheList[currManche][currRound][1]] || '-') + '</li>'); 
    lapList2.empty();
    lapList0.append('<li>' + (playerList[mancheList[currManche][currRound][2]] || '-') + '</li>'); 
    init();
  });

  // keyboard shortcuts for debug
  document.onkeydown = (e) => {
    if (e.keyCode == 49 || e.keyCode == 97) {
      // pressed 1
      currLap = chronoAddLap(0);
      addLap(currLap.lane, currLap.time);
    }
    else if (e.keyCode == 50 || e.keyCode == 98) {
      // pressed 2
      currLap = chronoAddLap(1);
      addLap(currLap.lane, currLap.time);
    }
    else if (e.keyCode == 51 || e.keyCode == 99) {
      // pressed 3
      currLap = chronoAddLap(2);
      addLap(currLap.lane, currLap.time);
    }
  };

  // ==========================================================================
  // ==== listen to arduino events

  socket.on('board_ready', (msg) => {
    console.log('board_ready');
    boardConnected = true;
    titleListening.addClass('is-off');
    titleSuccess.removeClass('is-off');
    buttonStart.removeClass('is-loading');
  });

  socket.on('board_exit', (msg) => {
    console.log('board_exit');
    boardConnected = false;
    titleListening.removeClass('is-off');
    titleSuccess.addClass('is-off');
  });

  socket.on('s1', (obj) => {
    if (obj == 0) {
      currLap = chronoAddLap(0);
      addLap(currLap.lane, currLap.time);
    }
  });
  socket.on('s2', (obj) => {
    if (obj == 0) {
      currLap = chronoAddLap(1);
      addLap(currLap.lane, currLap.time);
    }
  });
  socket.on('s3', (obj) => {
    if (obj == 0) {
      currLap = chronoAddLap(2);
      addLap(currLap.lane, currLap.time);
    }
  });
})();