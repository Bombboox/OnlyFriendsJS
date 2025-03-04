// Rendering
const canvas = document.getElementById("ab");
const ctx = canvas.getContext("2d");

canvas.width = 1600;
canvas.height = 900;

// Game constants
const PLAYER_SPEED = 6;
const GRAVITY = 0.5;
const JUMP_STRENGTH = 8;
const MAX_JUMP_HOLD = 20;
const MAX_HEALTH = 100;
const MESSAGE_DURATION = 4000; // 4 seconds in milliseconds
const MAX_MESSAGE_LENGTH = 50; // Maximum characters in chat message
const BUBBLE_PADDING = 10; // Padding inside speech bubble

// Game variables
const keyboard = [];
const players = {};
let animationFrame;

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
            const message = chatInput.value.trim().substring(0, MAX_MESSAGE_LENGTH);
            socket.emit('chatMessage', { roomId, name: activeCharacter.name, message, x: activeCharacter.x, y: activeCharacter.y });
            activeCharacter.showMessage(message);
            chatInput.value = '';
            chatInput.blur(); // Unfocus the chat input after sending
        }
    });

    chatToggle.addEventListener('click', toggleChat);

    animationFrame = requestAnimationFrame(draw);
}

var lastTimestamp;

function draw(timestamp) {
    let deltaTime;
    if (lastTimestamp) {
        deltaTime = timestamp - lastTimestamp;
    } else {
        deltaTime = 0;
    }
    lastTimestamp = timestamp;

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
        }
    }

    // Draw current player
    activeCharacter.move(keyboard, obstacles, deltaTime);
    drawPlayer(activeCharacter);

    if (activeCharacter.moving) {
        emitMovement();
    }
}

function drawSpeechBubble(message, x, y) {
    ctx.font = '14px Arial';
    
    // Measure text
    const textWidth = ctx.measureText(message).width;
    const bubbleWidth = textWidth + BUBBLE_PADDING * 2;
    const bubbleHeight = 30; // Fixed height for speech bubble
    const bubbleX = x - bubbleWidth/2; // Center bubble horizontally
    const bubbleY = y - 60; // Position above character
    const radius = 5; // Border radius for rounded corners

    // Draw bubble background
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.moveTo(bubbleX + radius, bubbleY);
    ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius);
    ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius);
    ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight);
    ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight);
    ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius);
    ctx.lineTo(bubbleX, bubbleY + radius);
    ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY);
    ctx.closePath();
    ctx.fill();

    // Draw pointer centered
    ctx.beginPath();
    ctx.moveTo(x - 10, bubbleY + bubbleHeight);
    ctx.lineTo(x, bubbleY + bubbleHeight + 10);
    ctx.lineTo(x + 10, bubbleY + bubbleHeight);
    ctx.closePath();
    ctx.fill();

    // Draw text
    ctx.fillStyle = 'black';
    ctx.textAlign = 'center';
    ctx.fillText(message, x, bubbleY + bubbleHeight/2 + 5);
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
        message: activeCharacter.message,
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
    activeCharacter.message = null;
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
socket.on('move', ({ x, y, health, message, character, playerId }) => {
    if (!players[playerId]) {
        // Only create character if player doesn't exist yet
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
    } else {
        // Just update position and health for existing player
        players[playerId].x = x;
        players[playerId].y = y;
        players[playerId].health = health;
    }
    
    if (message) {
        players[playerId].character.showMessage(message);
    }
});

socket.on('playerJoined', ({ playerId, character }) => {
    players[playerId] = { 
        x: 0, 
        y: 0, 
        health: MAX_HEALTH,
        character: new Character(
            character.name,
            character.headColor,
            character.torsoColor,
            character.legsColor,
            character.eyesColor
        )
    };
    emitMovement();
});

socket.on('playerLeft', (playerId) => {
    delete players[playerId];
});

socket.on('currentPlayers', (users) => {
    for (let user of users) {
        if (user.id !== socket.id) {
            const character = new Character(
                user.character.name,
                user.character.headColor,
                user.character.torsoColor, 
                user.character.legsColor,
                user.character.eyesColor
            );
            if (user.message) {
                character.showMessage(user.message);
            }
            players[user.id] = { 
                x: user.x, 
                y: user.y, 
                health: user.health,
                character
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
        players[playerId].character.showMessage(message);
    }
});

function toggleChat() {
    chatContainer.classList.toggle('chat-minimized');
    chatToggle.textContent = chatToggle.textContent == 'hide' ? 'show' : 'hide'; 
}