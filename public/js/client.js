(function() {

  'use strict';

  let socket = window.io.connect('localhost:3000');

  const debugMode = true;
  const buttonStart = $('#button-start');
  const lapList0 = $('#laps0');
  const lapList1 = $('#laps1');
  const lapList2 = $('#laps2');

  var boardConnected = false;
  var currTrack, currTournament, playerList, mancheList;
  var currManche = 0, currRound = 0;

  const init = () => {
    if (currTrack == null) {
      return;
    }
    currManche = 0;
    currRound = 0;
    chronoInit(mancheList[currManche][currRound], currTrack);
  };

  // ==========================================================================
  // ==== handle interface buttons

  buttonStart.on('click', (e) => {
    if (!boardConnected && !debugMode) {
      console.log('Error: board not connected');
      return;
    }

    // socket.emit('start', true);
    lapList0.empty();
    lapList0.append('<li>' + (playerList[mancheList[currManche][currRound][0]] || '-') + '</li>'); 
    lapList1.empty();
    lapList1.append('<li>' + (playerList[mancheList[currManche][currRound][1]] || '-') + '</li>'); 
    lapList2.empty();
    lapList2.append('<li>' + (playerList[mancheList[currManche][currRound][2]] || '-') + '</li>'); 
    init();
  });

  // keyboard shortcuts for debug
  if (debugMode) {
    document.onkeydown = (e) => {
      if (e.keyCode == 49 || e.keyCode == 97) {
        // pressed 1
        chronoAddLap(0);
      }
      else if (e.keyCode == 50 || e.keyCode == 98) {
        // pressed 2
        chronoAddLap(1);
      }
      else if (e.keyCode == 51 || e.keyCode == 99) {
        // pressed 3
        chronoAddLap(2);
      }
    };
  }

  // tabs
  $('.tabs a').on('click', (e) => {
    var $this = $(e.currentTarget);
    $('.tabs li').removeClass('is-active');
    $this.closest('li').addClass('is-active');
    var tab = $this.closest('li').data('tab');
    $('div[data-tab]').hide();
    $('div[data-tab=' + tab + ']').show();
  });

  // load track info from API
  $('#js-load-track').on('click', (e) => {
    var code = $('#js-input-track-code').val();
    $('#js-input-track-code').removeClass('is-danger');
    $.getJSON('https://mini4wd-track-editor.pimentoso.com/api/track/' + code)
    .done((obj) => {
      currTrack = obj;
      $('#tag-track-status').removeClass('is-danger');
      $('#tag-track-status').addClass('is-success');
      $('#tag-track-status').text(obj.code);
    })
    .fail(() => {
      $('#js-input-track-code').addClass('is-danger');
      $('#tag-track-status').addClass('is-danger');
      $('#tag-track-status').removeClass('is-success');
      $('#tag-track-status').text('not loaded');
      currTrack = null;
    })
    .always(() => {
      showTrackDetails(currTrack);
    });
  });

  // load tournament info from API
  $('#js-load-tournament').on('click', (e) => {
    var code = $('#js-input-tournament-code').val();
    $('#js-input-tournament-code').removeClass('is-danger');
    $.getJSON('https://mini4wd-tournament.pimentoso.com/api/tournament/' + code)
    .done((obj) => {
      currTournament = obj;
      $('#tag-tournament-status').removeClass('is-danger');
      $('#tag-tournament-status').addClass('is-success');
      $('#tag-tournament-status').text(obj.code);
      playerList = obj.players;
      mancheList = obj.manches;
    })
    .fail(() => {
      $('#js-input-tournament-code').addClass('is-danger');
      $('#tag-tournament-status').addClass('is-danger');
      $('#tag-tournament-status').removeClass('is-success');
      $('#tag-tournament-status').text('not loaded');
      currTournament = null;
    })
    .always(() => {
      showTournamentDetails(currTournament);
    });
  });

  // ==========================================================================
  // ==== listen to arduino events

  socket.on('board_ready', (msg) => {
    console.log('board_ready');
    boardConnected = true;
    $('#tag-board-status').removeClass('is-danger');
    $('#tag-board-status').addClass('is-success');
  });

  socket.on('board_exit', (msg) => {
    console.log('board_exit');
    boardConnected = false;
    $('#tag-board-status').removeClass('is-success');
    $('#tag-board-status').addClass('is-danger');
  });

  socket.on('s1', (obj) => {
    if (obj == 0) {
      chronoAddLap(0);
    }
  });
  socket.on('s2', (obj) => {
    if (obj == 0) {
      chronoAddLap(1);
    }
  });
  socket.on('s3', (obj) => {
    if (obj == 0) {
      chronoAddLap(2);
    }
  });
})();

// ==========================================================================
// ==== write to interface

const addLap = (car) => {
  var text = '';
  if (car.outOfBounds) {
    text = (car.totalTime/1000) + ' OUT';
  }
  else if (car.lapCount == 1) {
    text = 'START';
  }
  else if (car.lapCount == 4) {
    text = (car.totalTime/1000) + ' FINISH';
  }
  else {
    text = (car.currTime - car.startTime)/1000;
  }
  $('#laps' + car.startLane).append('<li>' + text + '</li>'); 
};

const showTrackDetails = (o) => {
  $('#js-track-code').text(o.code || '-');
  $('#js-track-length').text(o.length || '-');
  $('#js-track-changers').text(o.changers || '-');
  $('#js-track-order').text(o.order || '-');
};

const showTournamentDetails = (o) => {
  $('#js-tournament-code').text(o.code || '-');
  $('#js-tournament-players').text(o.players.length || '-');
  $('#js-tournament-manches').text(o.manches.length || '-');
};