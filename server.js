var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ip = require('ip');

var port = 7000

app.use(express.static('public'));
server.listen(port);

io.on('connection', function (socket) {

  socket.on('move', function (data) {
      socket.broadcast.emit('move', data);
  });

  socket.on('move2', function (data) {
      socket.broadcast.emit('move2', data);
  });

  socket.on("messageIn", function (msg) {
  	socket.emit("messageOut", msg);
  	socket.broadcast.emit("messageOut", msg);
  });

});

console.log(
  '\n' +
  'Server is running\n' +
  'In this machine: http://localhost:' + port + '\n' +
  'In local network: http://' + ip.address() + ':' + port + '\n' +
  'To stop server, press Ctrl+C\n'

)