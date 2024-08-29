

// Rendering
const canvas = document.getElementById("ab");
const ctx = canvas.getContext("2d");

canvas.width = 1600;
canvas.height = 900;

// Game constants
const PLAYER_SPEED = 5;
const GRAVITY = 0.5;
const JUMP_STRENGTH = 8;
const MAX_JUMP_HOLD = 15;
const MAX_HEALTH = 100;

// Game variables
const keyboard = [];
const players = {};
let px = 50;
let py = canvas.height;
const pw = 25;
const ph = 25;
let vy = 0;
let jumpHoldTime = 0;
let moving = false;
let animationFrame;
let health = MAX_HEALTH;
let direction = 1;

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
    document.addEventListener('keydown', (e) => { keyboard[e.keyCode] = true });
    document.addEventListener('keyup', (e) => { keyboard[e.keyCode] = false });
    chatForm.addEventListener('submit', (e) => {
        e.preventDefault();
        if (chatInput.value.trim() !== '') {
            socket.emit('chatMessage', { roomId, name: activeCharacter.name, message: chatInput.value.trim() });
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
        drawPlayer(player.x, player.y, player.health, 'blue');
    }

    // Draw current player
    drawPlayer(px, py, health, 'white');
    movement();

    if (moving) {
        emitMovement();
    }
}

function drawPlayer(x, y, playerHealth, color) {
    // Draw player
    ctx.fillStyle = color;
    ctx.fillRect(x, y, pw, ph);

    // Draw healthbar
    const healthBarWidth = pw;
    const healthBarHeight = 5;
    const healthPercentage = playerHealth / MAX_HEALTH;

    ctx.fillStyle = 'red';
    ctx.fillRect(x, y - healthBarHeight - 2, healthBarWidth, healthBarHeight);

    ctx.fillStyle = 'green';
    ctx.fillRect(x, y - healthBarHeight - 2, healthBarWidth * healthPercentage, healthBarHeight);
}

function emitMovement() {
    socket.emit('move', { roomId, x: px, y: py });
}

function movement() {
    let ix = px;
    let iy = py;

    // Horizontal movement
    if (keyboard[37]) {
        px -= PLAYER_SPEED;
        direction = -1;
    }
    if (keyboard[39]) {
        px += PLAYER_SPEED;
        direction = 1;
    }

    // Jumping
    if (keyboard[38] || keyboard[90]) { // Up arrow key
        if (isOnGround()) {
            vy = -JUMP_STRENGTH;
            jumpHoldTime = 0;
        } else if (jumpHoldTime < MAX_JUMP_HOLD) {
            vy -= 0.5;
            jumpHoldTime++;
        }
    } else {
        jumpHoldTime = MAX_JUMP_HOLD;
    }

    // Apply gravity
    vy += GRAVITY;
    py += vy;

    // Collision detection
    handleCollisions();

    if (ix == px && iy == py) {
        moving = false;
    } else {
        moving = true;
    }

    // Check if player is dead
    if (health <= 0) {
        resetPlayer();
    }
}

function resetPlayer() {
    health = MAX_HEALTH;
    px = 50;
    py = canvas.height - ph;
    vy = 0;
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
socket.on('move', ({ x, y, health, playerId }) => {
    players[playerId] = { x, y, health };
});

socket.on('playerJoined', (playerId) => {
    players[playerId] = { x: 0, y: 0, health: MAX_HEALTH };
    emitMovement();
});

socket.on('playerLeft', (playerId) => {
    delete players[playerId];
});

socket.on('currentPlayers', (users) => {
    for (let user of users) {
        if (user.id !== socket.id) {
            players[user.id] = { x: user.x, y: user.y, health: user.health };
        }
    }
});

socket.on('chatMessage', ({ name, message }) => {
    const messageElement = document.createElement('div');
    messageElement.textContent = `${name}: ${message}`;
    chatMessages.appendChild(messageElement);
    chatMessages.scrollTop = chatMessages.scrollHeight;
});

function toggleChat() {
    chatContainer.classList.toggle('chat-minimized');
    chatToggle.textContent = chatToggle.textContent == 'hide' ? 'show' : 'hide'; 
}

function handleCollisions() {
    // Ground collision
    if (py + ph > canvas.height) {
        py = canvas.height - ph;
        vy = 0;
    }

    if(px + pw > canvas.width) {
        px = canvas.width - ph;
        vx = 0;
    }

    if(px < 0) {
        px = 0;
        vx = 0;
    }

    // Obstacle collisions
    for (let obstacle of obstacles) {
        if (px < obstacle.x + obstacle.width &&
            px + pw > obstacle.x &&
            py < obstacle.y + obstacle.height &&
            py + ph > obstacle.y) {
            
            // Collision detected, resolve it
            let overlapLeft = (px + pw) - obstacle.x;
            let overlapRight = (obstacle.x + obstacle.width) - px;
            let overlapTop = (py + ph) - obstacle.y;
            let overlapBottom = (obstacle.y + obstacle.height) - py;

            // Find the smallest overlap
            let minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);

            if (minOverlap === overlapLeft) {
                px = obstacle.x - pw;
            } else if (minOverlap === overlapRight) {
                px = obstacle.x + obstacle.width;
            } else if (minOverlap === overlapTop) {
                py = obstacle.y - ph;
                vy = 0;
            } else if (minOverlap === overlapBottom) {
                py = obstacle.y + obstacle.height;
                jumpHoldTime = MAX_JUMP_HOLD;
                vy = Math.max(0, vy);
                
            }
        }
    }
}

function isOnGround() {
    if (py + ph >= canvas.height) {
        return true;
    }
    for (let obstacle of obstacles) {
        if (px < obstacle.x + obstacle.width &&
            px + pw > obstacle.x &&
            py + ph === obstacle.y) {
            return true;
        }
    }
    return false;
}