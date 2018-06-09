(function() {

  'use strict';

  let socket = window.io.connect('localhost:3000');

  const listening = document.querySelector('#title-listening');
  const success = document.querySelector('#title-success');
  const subSuccess = document.querySelector('#subtitle-success');

  const up = document.querySelector('.up');
  const down = document.querySelector('.down');
  const hold = document.querySelector('.hold');
  const btns = document.querySelectorAll('.button');

  const turnOn = document.querySelector('#turn-on');
  const turnOff = document.querySelector('#turn-off');
  const shake = document.querySelector('#shake');

  const proximity = document.querySelector('#proximity');

  // ==== handle interface buttons

  turnOn.addEventListener('click', (e) => {
    socket.emit('down', true);

    e.target.classList.toggle('is-outlined');

    up.classList.remove('js-active');
    hold.classList.remove('js-active');

    down.classList.add('js-active');
  });

  turnOff.addEventListener('click', (e) => {
    socket.emit('up', true);

    e.target.classList.toggle('is-outlined');

    down.classList.remove('js-active');
    hold.classList.remove('js-active');

    up.classList.add('js-active');
  });

  shake.addEventListener('click', (e) => {
    socket.emit('hold', true);

    e.target.classList.toggle('is-outlined');

    down.classList.remove('js-active');
    up.classList.remove('js-active');

    hold.classList.add('js-active');
  });

  // ==== listen to arduino events

  socket.on('connect', () => {
    console.log('socket connected');
    // socket.emit('join', 'Client is connected!');
  });

  socket.on('board_ready', (msg) => {
    console.log('board_ready');
    listening.classList.add('is-off');
    success.classList.remove('is-off');
    subSuccess.classList.remove('is-off');

    btns.forEach((i) => {
      return i.classList.remove('is-loading');
    });
  });

  socket.on('board_exit', (msg) => {
    console.log('board_exit');
    listening.classList.remove('is-off');
    success.classList.add('is-off');
    subSuccess.classList.add('is-off');

    btns.forEach((i) => {
      return i.classList.add('is-loading');
    });
  });

  socket.on('down', (msg) => {
    turnOn.classList.toggle('is-outlined');
  });

  socket.on('hold', (msg) => {
    shake.classList.toggle('is-outlined');
  });

  socket.on('up', (msg) => {
    turnOff.classList.toggle('is-outlined');
  });

  // proximity
  socket.on('sensor', (obj) => {
    // if (Math.floor(obj.cm) < 5) {
    //   proximity.innerHTML = `Está bem perto, ${obj.cm}cm`;
    // } else if (Math.floor(obj.cm) > 15) {
    //   proximity.innerHTML = `Está afastado, ${obj.cm}cm`;
    // } else if (Math.floor(obj.cm) > 20) {
    //   proximity.innerHTML = `Está longe, ${obj.cm}cm`;
    // }
    proximity.innerHTML = obj;
  });
})();