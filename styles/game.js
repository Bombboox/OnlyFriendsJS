// Rendering
const canvas = document.getElementById("ab");
const ctx = canvas.getContext("2d");

canvas.width = 1600;
canvas.height = 900;

// Game constants
const PLAYER_SPEED = 5;
const GRAVITY = 0.5;
const JUMP_STRENGTH = 8;
const MAX_JUMP_HOLD = 16;
const MAX_HEALTH = 100;
const MESSAGE_DURATION = 4000; // 4 seconds in milliseconds

// Game variables
const keyboard = [];
const players = {};
let animationFrame;
let currentMessage = null;
let messageTimeout = null;

// Chat elements
const chatContainer = document.getElementById('chat-container');
const chatToggle = document.getElementById('chat-toggle');
const chatContent = document.getElementById('chat-content');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');

// Obstacles
const obstacles = [
    {x: 200, y: 800, width: 400, height: 50},
    {x: 675, y: 625, width: 100, height: 100},
    {x: 800, y: 500, width: 300, height: 50},
    {x: 800, y: 300, width: 300, height: 50},
    {x: 600, y: 300, width: 50, height: 50},
    {x: 400, y: 300, width: 50, height: 50},
    {x: 200, y: 300, width: 50, height: 50},
    {x: 0, y: 150, width: 50, height: 50},
    {x: 1200, y: 400, width: 200, height: 50}
];

function initialize() {
    document.addEventListener('keydown', (e) => { 
        keyboard[e.keyCode] = true;
        // Focus chat input when Enter is pressed
        if (e.keyCode === 13 && !chatInput.matches(':focus')) {
            e.preventDefault();
            chatInput.focus();
        }
    });
    document.addEventListener('keyup', (e) => { keyboard[e.keyCode] = false });
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (chatInput.value.trim() !== '') {
            const message = chatInput.value.trim();
            socket.emit('chatMessage', { roomId, name: activeCharacter.name, message, x: activeCharacter.x, y: activeCharacter.y });
            showFloatingMessage(message, activeCharacter.x, activeCharacter.y);
            chatInput.value = '';
        }
    });

    chatToggle.addEventListener('click', toggleChat);

    animationFrame = requestAnimationFrame(draw);
}

function draw() {
    animationFrame = requestAnimationFrame(draw);

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw obstacles
    ctx.fillStyle = 'gray';
    for (let obstacle of obstacles) {
        ctx.fillRect(obstacle.x, obstacle.y, obstacle.width, obstacle.height);
    }

    // Draw other players
    for (const playerId in players) {
        const player = players[playerId];
        if (player && player.character) {
            player.character.x = player.x;
            player.character.y = player.y;
            drawPlayer(player.character);
            if (player.message) {
                drawFloatingMessage(player.message, player.x, player.y);
            }
        }
    }

    // Draw current player
    activeCharacter.move(keyboard, obstacles);
    drawPlayer(activeCharacter);
    if (currentMessage) {
        drawFloatingMessage(currentMessage, activeCharacter.x, activeCharacter.y);
    }

    if (activeCharacter.moving) {
        emitMovement();
    }
}

function drawFloatingMessage(message, x, y) {
    ctx.font = '14px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(message, x + 12, y - 10); // Position above character's head
}

function showFloatingMessage(message, x, y) {
    currentMessage = message;
    if (messageTimeout) {
        clearTimeout(messageTimeout);
    }
    messageTimeout = setTimeout(() => {
        currentMessage = null;
    }, MESSAGE_DURATION);
}

function drawPlayer(character) {
    if (character && character.render) {
        character.render(ctx, character.x, character.y);
    } else {
        // Fallback if no render method
        ctx.fillStyle = 'blue';
        ctx.fillRect(character.x, character.y, 25, 45);
    }
}

function emitMovement() {
    socket.emit('move', { 
        roomId,
        x: activeCharacter.x, 
        y: activeCharacter.y,
        health: activeCharacter.health,
        character: {
            name: activeCharacter.name,
            headColor: activeCharacter.headColor,
            torsoColor: activeCharacter.torsoColor,
            legsColor: activeCharacter.legsColor,
            eyesColor: activeCharacter.eyesColor
        }
    });
}

function resetPlayer() {
    activeCharacter.health = MAX_HEALTH;
    activeCharacter.x = 50;
    activeCharacter.y = canvas.height - activeCharacter.height;
    activeCharacter.vy = 0;
    emitMovement();
}

function leaveMatch() {
    socket.emit('leaveRoom', roomId);
    cancelAnimationFrame(animationFrame);
    switchScene('match-making');
    roomId = null;
    // Clear players and reset game state
    for (let player in players) {
        delete players[player];
    }
    resetPlayer();
    chatMessages.innerHTML = '';
}

// Socket event handlers
socket.on('move', ({ x, y, health, character, playerId }) => {
    players[playerId] = { 
        x, 
        y, 
        health,
        character: new Character(
            character.name,
            character.headColor,
            character.torsoColor,
            character.legsColor,
            character.eyesColor
        )
    };
});

socket.on('playerJoined', (playerId) => {
    players[playerId] = { 
        x: 0, 
        y: 0, 
        health: MAX_HEALTH,
        character: new Character("Player") // Create default character
    };
    emitMovement();
});

socket.on('playerLeft', (playerId) => {
    delete players[playerId];
});

socket.on('currentPlayers', (users) => {
    for (let user of users) {
        if (user.id !== socket.id) {
            players[user.id] = { 
                x: user.x, 
                y: user.y, 
                health: user.health,
                character: new Character(
                    user.character.name,
                    user.character.headColor,
                    user.character.torsoColor, 
                    user.character.legsColor,
                    user.character.eyesColor
                )
            };
        }
    }
});

socket.on('chatMessage', ({ name, message, x, y, playerId }) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${name}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    // Show floating message for other players
    if (playerId && players[playerId]) {
        players[playerId].message = message;
        setTimeout(() => {
            if (players[playerId]) {
                players[playerId].message = null;
            }
        }, MESSAGE_DURATION);
    }
});

function toggleChat() {
    chatContainer.classList.toggle('chat-minimized');
    chatToggle.textContent = chatToggle.textContent == 'hide' ? 'show' : 'hide'; 
}