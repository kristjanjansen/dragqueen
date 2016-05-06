var socket = io.connect();

var draggable = $('.draggable').draggabilly();
var draggie = draggable.data('draggabilly');

draggable.on('dragMove', function() {

    socket.emit('move', {x: draggie.position.x, y: draggie.position.y});

});

socket.on('move', function (data) {

    draggable.css({'left': data.x, 'top': data.y})

});
