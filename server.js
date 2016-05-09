var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ip = require('ip');

var port = 7000;

app.use(express.static('public'));
server.listen(port);

var PW = 50;
var PH = 50;
var FW = 100;
var FH = 100;

var CW = 1523;
var CH = 907;
var CX = 8;
var CY = 8;

var MAX_PLAYERS = 8;

var ips = [];
var clients = {};

var food = {
  "x": null,
  "y": null,
  "width": FW,
  "height": FH
};

var noFood = true;
var validate = false;

function Player(x, y, username, color) {
  this.x = x;
  this.y = y;
  this.width = PW;
  this.height = PH;
  this.username = username;
  this.color = color
  this.points = 0;
}

function doesCollide(rect1, rect2) {
    var x1 = rect1.x;
    var y1 = rect1.y;
    var h1 = rect1.height;
    var w1 = rect1.width;
    var b1 = y1 + h1;
    var r1 = x1 + w1;
    var x2 = rect2.x;
    var y2 = rect2.y;
    var h2 = rect2.height;
    var w2 = rect2.width;
    var b2 = y2 + h2;
    var r2 = x2 + w2;

    if (b1 < y2 || y1 > b2 || r1 < x2 || x1 > r2) return false;

    return true;
}

function collision(id) {
  var player = clients[id];
  return doesCollide(food, player);
}

function showGameTo(id) {
  io.to(id).emit("showPlayers", clients);
  io.to(id).emit("createFood", food);
}

function random(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomColor() {
  return "rgb(" + random(0,255) + "," + random(0,255) + "," + random(0,255) + ")";
}

function getVector(width, height, food) {
    var vector = {
        "x": random(CX, CX + CW - width),
        "y": random(CY, CY + CH - height),
        "width": width,
        "height": height
    };

    var checked = false;
    while (!checked) {
      var collides = false;
      for (var user in clients) {
        // console.log(clients[user], vector);
        if (doesCollide(clients[user], vector) || (!food && collision(user))) {
          vector.x = random(CX, CX + CW - width);
          vector.y = random(CY, CY + CH - height);
          collides = true;
        }
      }

      if (!collides) {
        checked = true;
      }
    }

    return { "x": vector.x, "y": vector.y };
}

function setFood() {
  var vector = getVector(FW, FH, true);
  food.x = vector.x;
  food.y = vector.y;
}

setFood();

io.on('connection', function (socket) {

  // console.log(io.engine.clientsCount)
  // console.log(socket.id);
  // console.log(socket.request.connection.remoteAddress);

  if (ips.indexOf(socket.request.connection.remoteAddress) > -1) {
    io.to(socket.id).emit("error", "You are already in game.");
    showGameTo(socket.id);
  } else if (Object.keys(clients).length < MAX_PLAYERS) {
    socket.emit("clientConnected");
  } else {
    io.to(socket.id).emit("error", "Server is full.");
    showGameTo(socket.id);
  }

  socket.on("createUser", function (username) {
    if (/^[a-z0-9]+$/i.test(username) && (username.length > 0) && (username.length <= 8)) {
      for (var client in clients) {
        if (clients[client].username === username) {
          io.to(socket.id).emit("error", "That username is taken.");
          showGameTo(socket.id);
          return 0;
        }
      }
      socket.user = username;
      var color = randomColor();
      var vector = getVector(PH, PW);
      var player = new Player(vector.x, vector.y, username, color);
      clients[socket.id] = player;

      io.to(socket.id).emit("showPlayers", clients);
      socket.broadcast.emit("addUser", player);
      io.to(socket.id).emit("addDrag", username);
      io.emit("messageOut", username + " has joined the game.");

      if (Object.keys(clients).length === 0) {
        io.emit("createFood", food);
      } else {
        io.to(socket.id).emit("createFood", food);
      }

      ips.push(socket.request.connection.remoteAddress);
    } else {
      io.to(socket.id).emit("error", "Signup failed.");
      showGameTo(socket.id);
    }
  });

  socket.on("disconnect", function () {
    if (clients.hasOwnProperty(socket.id)) {
      var username = clients[socket.id].username;
      ips.splice(ips.indexOf(socket.request.connection.remoteAddress), 1);
      delete clients[socket.id];
      io.emit("deleteUser", username);
      io.emit("messageOut", username + " has disconnected.");
      if (Object.keys(clients).length === 0) noFood = true;
    }
  });

  socket.on('move', function (data) {
    // console.log('move', data);
    clients[socket.id].x = data.x;
    clients[socket.id].y = data.y;
    socket.broadcast.emit('move', data);
  });

  socket.on("show", function (data) {
    socket.broadcast.emit("move", data);
  });

  socket.on("messageIn", function (msg) {
    // console.log(msg);
    if (msg) {
     io.emit("messageOut", (socket.user || "anon") + ": " + msg);
    }
  });

  socket.on("removeFood", function () {
    if (collision(socket.id)) {
      validate = true;
      io.emit("removeFood");
    }
  });

  socket.on("createFood", function () {
    // console.log(data);
    if (validate || noFood) {
      validate = false;
      setFood();
      setTimeout(function () {
        io.emit("createFood", food);
      }, 250);
      if (noFood) noFood = false;
    }
  });

  socket.on("updatePoints", function (name) {
    if (collision(socket.id)) {
      var p = clients[socket.id].points + 1;
      clients[socket.id].points = p;
      io.emit("updatePoints", { name: name, points: p });
    }
  });
});

console.log(
  '\n' +
  'Server is running\n' +
  'In this machine: http://localhost:' + port + '\n' +
  'In local network: http://' + ip.address() + ':' + port + '\n' +
  'To stop server, press Ctrl+C\n'

)