var express = require('express');
var app = express();
var server = require('http').Server(app);
var io = require('socket.io')(server);
var ip = require('ip');

var port = 7000;

app.use(express.static('public'));
server.listen(port);

if (process.platform === "win32") {
  var rl = require("readline").createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.on("SIGINT", function () {
    process.emit("SIGINT");
  });
}

var PW = 50;
var PH = 50;
var FW = 100;
var FH = 100;

var CW = 1523;
var CH = 898;
var CX = 8;
var CY = 44;
var MAX_PLAYERS = 5;

var roundInterval;
var roundTime = 35;
var foodSpawn = 250;
var roundBreak = 2500;
var isBreak = false;

var ips = [];
var clients = {};

var food = {
  "x": null,
  "y": null,
  "width": FW,
  "height": FH
};

// var noFood = true;
// var validate = false;

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
  io.to(id).emit("showFood", food);
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
        if (doesCollide(clients[user], vector) || (!food && collision(user))) {
          vector.x = random(CX, CX + CW - width);
          vector.y = random(CY, CY + CH - height);
          collides = true;
        }
      }
      // console.log("INFINITE LOOP???");
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

function getWinner() {
  var biggest = -1;
  var winner = "";

  for (var user in clients) {
    if (clients[user].points > biggest) {
      biggest = clients[user].points;
      winner = clients[user].username;
    }
  }

  for (var user in clients) {
    var u = clients[user];
    if (u.points === biggest && u.username !== winner) {
      return "It's a tie!";
    }
  }

  return winner + " wins the round!";
}

function resetPlayers() {
  for (var user in clients) {
    clients[user].x = random(CX, CX + CW - PW);
    clients[user].y = random(CY, CY + CH - PH);
    clients[user].points = 0;
  }
}

function resetStuff() {
  io.emit("roundReset");
  io.emit("showWinner", getWinner());
  resetPlayers();
  setFood();
}

function showThings(socket) {
  io.emit("showPlayers", clients);
  for (var id in clients) {
    io.to(id).emit("addDrag", clients[id].username);
  }
  io.emit("showFood", food);
}

function startTimer(duration, socket) {
    var timer = duration;
    var minutes, seconds;
    isBreak = false;
    roundInterval = setInterval(function () {
        minutes = parseInt(timer / 60, 10);
        seconds = parseInt(timer % 60, 10);

        minutes = minutes < 10 ? "0" + minutes : minutes;
        seconds = seconds < 10 ? "0" + seconds : seconds;

        io.emit("countdown", minutes + ":" + seconds);

        timer--;
        if (timer < 0) {
            clearInterval(roundInterval);
            isBreak = true;
            resetStuff();
            setTimeout(function () {
              if (Object.keys(clients).length > 0) {
                io.emit("removeWinner");
                showThings(socket);
                startTimer(roundTime, socket);
              }
            }, roundBreak);
        }
    }, 1000);
}

setFood();

io.on('connection', function (socket) {
  // console.log(io.engine.clientsCount)
  // console.log(socket.id);
  // console.log(socket.request.connection.remoteAddress);
  // ips.indexOf(socket.request.connection.remoteAddress) > -1
  if (-10 > -1) {
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

      if (!isBreak) {
        io.to(socket.id).emit("showPlayers", clients);
        socket.broadcast.emit("addUser", player);
        io.to(socket.id).emit("addDrag", username);
      }
      io.emit("messageOut", username + " has joined the game.");

      if (Object.keys(clients).length === 1) {
        startTimer(roundTime, socket);
      }

      io.to(socket.id).emit("showFood", food);

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
      if (Object.keys(clients).length === 0) {
        // noFood = true;
        clearInterval(roundInterval);
        io.emit("clearStuff");
      }
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
    // if (collision(socket.id)) {
      // validate = true;
      // io.emit("removeFood");
      socket.broadcast.emit("removeFood");
    // }
  });

  socket.on("createFood", function () {
    // console.log(data);
    // if (validate || noFood) {
      // validate = false;
      if (!isBreak) {
        setFood();
        setTimeout(function () {
          io.emit("showFood", food);
        }, foodSpawn);
      }
      //if (noFood) noFood = false;
    // }
  });

  socket.on("updatePoints", function (name) {
    // if (collision(socket.id)) {
      var p = clients[socket.id].points + 1;
      clients[socket.id].points = p;
      io.emit("updatePoints", { name: name, points: p });
    // }
  });

  process.on("SIGINT", function () {
    //graceful shutdown
    io.emit("clearStuff");
    process.exit();
  });
});

console.log(
  '\n' +
  'Server is running\n' +
  'In this machine: http://localhost:' + port + '\n' +
  'In local network: http://' + ip.address() + ':' + port + '\n' +
  'To stop server, press Ctrl+C\n'

)