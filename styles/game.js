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
const VOICE_KEY = 75; // K key code

// Game variables
const keyboard = [];
const players = {};
let animationFrame;
let localStream = null;
let peerConnections = {};
let isVoiceChatActive = false;

// Chat elements
const chatContainer = document.getElementById('chat-container');
const chatToggle = document.getElementById('chat-toggle');
const chatContent = document.getElementById('chat-content');
const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatForm = document.getElementById('chat-form');

// Voice chat image
const voiceIndicatorImg = new Image();
voiceIndicatorImg.src = 'images/audio.png';

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
        
        // Start voice chat when K is pressed
        if (e.keyCode === VOICE_KEY && !isVoiceChatActive) {
            startVoiceChat();
        }
    });
    
    document.addEventListener('keyup', (e) => { 
        keyboard[e.keyCode] = false;
        
        // Stop voice chat when K is released
        if (e.keyCode === VOICE_KEY && isVoiceChatActive) {
            stopVoiceChat();
        }
    });
    
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

function startVoiceChat() {
    if (!isVoiceChatActive) {
        isVoiceChatActive = true;
        
        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(stream => {
                localStream = stream;
                socket.emit('voiceChatStart', { roomId });
                
                // For each player in the room, create a peer connection
                for (const playerId in players) {
                    if (!peerConnections[playerId]) {
                        createPeerConnection(playerId, true);
                    }
                }
            })
            .catch(error => {
                console.error('Error accessing microphone:', error);
                isVoiceChatActive = false;
                activeCharacter.showMessage("❌ Mic access denied");
            });
    }
}

function stopVoiceChat() {
    if (isVoiceChatActive) {
        isVoiceChatActive = false;
        
        // Stop all audio tracks
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
            localStream = null;
        }
        
        // Close all peer connections
        for (const playerId in peerConnections) {
            if (peerConnections[playerId]) {
                peerConnections[playerId].close();
                delete peerConnections[playerId];
            }
        }
        
        socket.emit('voiceChatEnd', { roomId });
    }
}

function createPeerConnection(playerId, isInitiator) {
    console.log(`Creating ${isInitiator ? 'initiator' : 'receiver'} peer connection for ${playerId}`);
    
    // ICE servers configuration (STUN)
    const configuration = { 
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
        ] 
    };
    
    const pc = new RTCPeerConnection(configuration);
    peerConnections[playerId] = pc;
    
    // Add local stream tracks to the connection
    if (localStream) {
        localStream.getTracks().forEach(track => {
            pc.addTrack(track, localStream);
        });
    }
    
    // Handle ICE candidates
    pc.onicecandidate = event => {
        if (event.candidate) {
            socket.emit('voiceIceCandidate', {
                roomId,
                targetId: playerId,
                candidate: event.candidate
            });
        }
    };
    
    // Handle connection state changes
    pc.oniceconnectionstatechange = () => {
        console.log(`ICE connection state for ${playerId}: ${pc.iceConnectionState}`);
    };
    
    // Handle incoming tracks
    pc.ontrack = event => {
        console.log(`Received remote track from ${playerId}`);
        
        // Create audio element to play the remote stream
        let audioElement = document.getElementById(`voice-${playerId}`);
        if (!audioElement) {
            audioElement = document.createElement('audio');
            audioElement.id = `voice-${playerId}`;
            audioElement.autoplay = true;
            document.body.appendChild(audioElement);
        }
        
        audioElement.srcObject = event.streams[0];
        
        // Mark player as speaking
        if (players[playerId]) {
            players[playerId].isSpeaking = true;
        }
    };
    
    // If we're the initiator, create and send an offer
    if (isInitiator) {
        pc.createOffer()
            .then(offer => pc.setLocalDescription(offer))
            .then(() => {
                socket.emit('voiceOffer', {
                    roomId,
                    targetId: playerId,
                    offer: pc.localDescription
                });
            })
            .catch(error => {
                console.error('Error creating voice chat offer:', error);
            });
    }
    
    return pc;
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
    
    // Show voice indicator for speaking players
    if (isVoiceChatActive) {
        drawVoiceIndicator(activeCharacter.x + 12, activeCharacter.y - 10);
    }
    
    for (const playerId in players) {
        if (players[playerId].isSpeaking) {
            drawVoiceIndicator(players[playerId].x + 12, players[playerId].y - 10);
        }
    }
}

function drawVoiceIndicator(x, y) {
    ctx.drawImage(voiceIndicatorImg, x - 8, y - 8, 16, 16);
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
    
    // Ensure voice chat is stopped when leaving
    if (isVoiceChatActive) {
        stopVoiceChat();
    }
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
    
    // If we're currently voice chatting, create a connection with the new player
    if (isVoiceChatActive && localStream) {
        createPeerConnection(playerId, true);
    }
});

socket.on('playerLeft', (playerId) => {
    // Clean up voice connection if exists
    if (peerConnections[playerId]) {
        peerConnections[playerId].close();
        delete peerConnections[playerId];
        
        // Remove audio element if exists
        const audioElement = document.getElementById(`voice-${playerId}`);
        if (audioElement) {
            audioElement.remove();
        }
    }
    
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

// Voice chat socket handlers
socket.on('voiceChatStart', ({ playerId }) => {
    if (players[playerId]) {
        players[playerId].isSpeaking = true;
        
        // If we're also voice chatting, establish a connection
        if (isVoiceChatActive && localStream && !peerConnections[playerId]) {
            createPeerConnection(playerId, true);
        }
    }
});

socket.on('voiceChatEnd', ({ playerId }) => {
    if (players[playerId]) {
        players[playerId].isSpeaking = false;
        
        // Clean up connection
        if (peerConnections[playerId]) {
            peerConnections[playerId].close();
            delete peerConnections[playerId];
            
            // Remove audio element
            const audioElement = document.getElementById(`voice-${playerId}`);
            if (audioElement) {
                audioElement.remove();
            }
        }
    }
});

socket.on('voiceOffer', ({ playerId, offer }) => {
    console.log(`Received voice offer from ${playerId}`);
    
    // Create peer connection if it doesn't exist
    if (!peerConnections[playerId]) {
        const pc = createPeerConnection(playerId, false);
        
        // Set remote description and create answer
        pc.setRemoteDescription(new RTCSessionDescription(offer))
            .then(() => pc.createAnswer())
            .then(answer => pc.setLocalDescription(answer))
            .then(() => {
                socket.emit('voiceAnswer', {
                    roomId,
                    targetId: playerId,
                    answer: pc.localDescription
                });
            })
            .catch(error => {
                console.error('Error handling voice offer:', error);
            });
    }
});

socket.on('voiceAnswer', ({ playerId, answer }) => {
    console.log(`Received voice answer from ${playerId}`);
    
    if (peerConnections[playerId]) {
        peerConnections[playerId].setRemoteDescription(new RTCSessionDescription(answer))
            .catch(error => console.error('Error setting remote description:', error));
    }
});

socket.on('voiceIceCandidate', ({ playerId, candidate }) => {
    console.log(`Received ICE candidate from ${playerId}`);
    
    if (peerConnections[playerId]) {
        peerConnections[playerId].addIceCandidate(new RTCIceCandidate(candidate))
            .catch(error => console.error('Error adding ICE candidate:', error));
    }
});

function toggleChat() {
    chatContainer.classList.toggle('chat-minimized');
    chatToggle.textContent = chatToggle.textContent == 'hide' ? 'show' : 'hide'; 
}