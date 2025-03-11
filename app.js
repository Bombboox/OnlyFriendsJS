const express = require('express');
const dotenv = require('dotenv');

const app = express();
const PORT = process.env.PORT || 3000;

const http = require("http");
const {Server} = require("socket.io");

const server = http.createServer(app);
const io = new Server(server);

app.set('view engine', 'ejs');
app.use(express.static(__dirname + '/styles'));

app.use('/', require('./routes/pages.js').router);

const rooms = {}; //Stores rooms for players to join <3
const MAX_PLAYERS = 5;

io.on('connection', (socket) => {
    socket.on('randomSearch', () => {
        let availableRoomId = null;

        for(const roomId in rooms) {
            const room = rooms[roomId];
            if(room.users.length < MAX_PLAYERS) {
                availableRoomId = roomId;
                break
            }
        }

        if(!availableRoomId) {
            const newRoomId = Math.random().toString(30).substring(7);
            rooms[newRoomId] = {users: [socket.id]};
            socket.join(newRoomId);
            socket.emit('roomCreated', newRoomId); 
        } else {
            socket.emit('currentPlayers', rooms[availableRoomId].users);
            rooms[availableRoomId].users.push(socket.id);
            socket.join(availableRoomId);
            socket.emit('roomJoined', availableRoomId);
        }

        socket.broadcast.to(availableRoomId).emit('playerJoined', socket.id);
    });

    socket.on('disconnect', () => {
        for(const roomId in rooms) {
            const room = rooms[roomId];
            const index = room.users.indexOf(socket.id);
            if(index !== -1) {
                room.users.splice(index, 1); // Remove the user from the room
                socket.to(roomId).emit('playerLeft', socket.id) //Notify room that player has left

                if(room.users.length === 0) {
                    delete rooms[roomId]; // Delete the room if empty
                } else {
                    // Notify the other user that their partner has left
                    socket.to(roomId).emit('partnerLeft');
                }
                break; // Exit the loop after handling the disconnect
            }
        }
    });

    socket.on('move', ({roomId, x, y, health, character}) => {
        socket.to(roomId).emit('move', {
            x, 
            y, 
            playerId: socket.id,
            health,
            character
        });
    });

    socket.on('leaveRoom', (roomId) => {
        if (rooms[roomId]) {
            const index = rooms[roomId].users.indexOf(socket.id);
            if (index !== -1) {
                rooms[roomId].users.splice(index, 1);
                socket.leave(roomId);
                socket.to(roomId).emit('playerLeft', socket.id);

                if (rooms[roomId].users.length === 0) {
                    delete rooms[roomId];
                }
            }
        }
    });

    socket.on('chatMessage', ({ roomId, name, message, x, y }) => {
        io.to(roomId).emit('chatMessage', { name: name, playerId: socket.id, message, x, y });
    });

    // Voice chat handlers
    socket.on('voiceChatStart', ({ roomId }) => {
        socket.to(roomId).emit('voiceChatStart', { playerId: socket.id });
    });

    socket.on('voiceChatEnd', ({ roomId }) => {
        socket.to(roomId).emit('voiceChatEnd', { playerId: socket.id });
    });

    socket.on('voiceOffer', ({ roomId, targetId, offer }) => {
        if (targetId) {
            socket.to(targetId).emit('voiceOffer', { 
                playerId: socket.id, 
                offer 
            });
        } else {
            socket.to(roomId).emit('voiceOffer', { 
                playerId: socket.id, 
                offer 
            });
        }
    });

    socket.on('voiceAnswer', ({ roomId, targetId, answer }) => {
        socket.to(targetId).emit('voiceAnswer', { 
            playerId: socket.id, 
            answer 
        });
    });

    socket.on('voiceIceCandidate', ({ roomId, targetId, candidate }) => {
        socket.to(targetId).emit('voiceIceCandidate', {
            playerId: socket.id,
            candidate
        });
    });
});

server.listen(PORT, () => {
    console.log(`Listening on port ${PORT}...`);
});
