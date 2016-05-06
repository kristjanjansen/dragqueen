var socket = io.connect();

var draggable = $('.draggable').draggabilly();
var draggie = draggable.data('draggabilly');

var draggable2 = $('.draggable2').draggabilly();
var draggie2 = draggable2.data('draggabilly');

draggable.on('dragMove', function() {

    socket.emit('move', {x: draggie.position.x, y: draggie.position.y});

});

socket.on('move', function (data) {

    draggable.css({'left': data.x, 'top': data.y})

});




draggable2.on('dragMove2', function() {

    socket.emit('move2', {x: draggie2.position.x, y: draggie2.position.y});

});

socket.on('move2', function (data) {

    draggable2.css({'left': data.x, 'top': data.y})

});
