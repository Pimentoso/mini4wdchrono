(function() {

  'use strict';

  let express = require('express');
  let http = require('http');
  let socket = require('socket.io');

  const app = module.exports = express();

  let server = http.createServer(app);
  let socketIo = socket.listen(server);

  app.set('port', 3000);
  app.use(express.static(__dirname + '/public'));

  const port = app.get('port');

  require('./public/js/arduino')(socketIo);

  server.listen(port, () => {
    console.warn(`Listening on http://localhost:${port}`);
  });

})();