class Character {
    constructor(name, headColor, torsoColor, legsColor, eyesColor) {
        this.name = name;
        this.headColor = headColor;
        this.torsoColor = torsoColor;
        this.legsColor = legsColor;
        this.eyesColor = eyesColor;
        this.direction = 1; // Initialize direction to face right
        
        // Movement properties
        this.x = 50;
        this.y = 900;
        this.vy = 0;
        this.jumpHoldTime = 0;
        this.moving = false;
        this.width = 25;
        this.height = 45;

        // Message properties
        this.message = null;
        this.messageTimeout = null;
    }

    move(keyboard, obstacles, deltaTime) {
        let initialX = this.x;
        let initialY = this.y;

        // Calculate time factor for frame-rate independent movement
        const timeFactor = deltaTime / (1000 / 60); // Normalize to 60 FPS

        // Horizontal movement
        if (keyboard[37]) { // Left arrow
            this.x -= PLAYER_SPEED * timeFactor;
            this.direction = -1;
        }
        if (keyboard[39]) { // Right arrow
            this.x += PLAYER_SPEED * timeFactor;
            this.direction = 1;
        }

        // Jumping
        if (keyboard[38] || keyboard[90]) { // Up arrow or Z
            if (this.isOnGround(obstacles)) {
                this.vy = -JUMP_STRENGTH;
                this.jumpHoldTime = 0;
            } else if (this.jumpHoldTime < MAX_JUMP_HOLD) {
                this.vy -= 0.5 * timeFactor;
                this.jumpHoldTime++;
            }
        } else {
            this.jumpHoldTime = MAX_JUMP_HOLD;
        }

        // Apply gravity
        this.vy += GRAVITY * timeFactor;
        this.y += this.vy * timeFactor;

        // Handle collisions
        this.handleCollisions(obstacles);

        // Check if moved
        this.moving = (initialX !== this.x || initialY !== this.y);
    }

    handleCollisions(obstacles) {
        // Floor collision
        if (this.y + this.height > canvas.height) {
            this.y = canvas.height - this.height;
            this.vy = 0;
        }

        // Obstacle collisions
        for (let obstacle of obstacles) {
            if (this.x + this.width > obstacle.x && 
                this.x < obstacle.x + obstacle.width &&
                this.y + this.height > obstacle.y && 
                this.y < obstacle.y + obstacle.height) {
                
                // Vertical collision
                if (this.vy > 0 && this.y + this.height - this.vy <= obstacle.y) {
                    this.y = obstacle.y - this.height;
                    this.vy = 0;
                }
                else if (this.vy < 0 && this.y - this.vy >= obstacle.y + obstacle.height) {
                    this.y = obstacle.y + obstacle.height;
                    this.vy = 0;
                }
                // Horizontal collision
                else if (this.x + this.width - obstacle.x < 20) {
                    this.x = obstacle.x - this.width;
                }
                else if (obstacle.x + obstacle.width - this.x < 20) {
                    this.x = obstacle.x + obstacle.width;
                }
            }
        }
    }

    isOnGround(obstacles) {
        // Check floor
        if (this.y + this.height >= canvas.height) {
            return true;
        }
        
        // Check obstacles
        for (let obstacle of obstacles) {
            if (this.x + this.width > obstacle.x &&
                this.x < obstacle.x + obstacle.width &&
                Math.abs((this.y + this.height) - obstacle.y) < 2) {
                return true;
            }
        }
        return false;
    }

    showMessage(message) {
        this.message = message;
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        this.messageTimeout = setTimeout(() => {
            this.message = null;
        }, MESSAGE_DURATION);
    }

    render(ctx, x, y) {
        // Save context state
        ctx.save();

        // Draw message if exists
        if (this.message) {
            drawSpeechBubble(this.message, x + this.width/2, y);
        }

        // Flip character if facing left
        if (this.direction === -1) {
            ctx.scale(-1, 1);
            x = -x - 25; // 25 is character width
        }

        const HEAD_WIDTH = 15;
        const HEAD_HEIGHT = 15;
        const LIMB_WIDTH = HEAD_WIDTH / 3;
        const TORSO_WIDTH = (HEAD_WIDTH * 2) / 3;

        // Head (centered on torso)
        ctx.fillStyle = '#' + this.headColor;
        const headX = x + 5 + (TORSO_WIDTH + LIMB_WIDTH * 2 - HEAD_WIDTH) / 2;
        ctx.fillRect(headX, y, HEAD_WIDTH, HEAD_HEIGHT);

        // Eyes (adjusted for centered head)
        ctx.fillStyle = '#' + this.eyesColor;
        ctx.fillRect(headX + 3, y + 5, 3, 3);
        ctx.fillRect(headX + 9, y + 5, 3, 3);

        // Arms and Torso
        ctx.fillStyle = '#' + this.torsoColor;
        ctx.fillRect(x + 5, y + HEAD_HEIGHT, LIMB_WIDTH, HEAD_HEIGHT); // Left arm
        ctx.fillRect(x + 5 + LIMB_WIDTH, y + HEAD_HEIGHT, TORSO_WIDTH, HEAD_HEIGHT); // Torso
        ctx.fillRect(x + 5 + LIMB_WIDTH + TORSO_WIDTH, y + HEAD_HEIGHT, LIMB_WIDTH, HEAD_HEIGHT); // Right arm

        // Legs (spread out along torso width)
        ctx.fillStyle = '#' + this.legsColor;
        ctx.fillRect(x + 2.5 + LIMB_WIDTH, y + HEAD_HEIGHT * 2, LIMB_WIDTH, HEAD_HEIGHT); // Left leg
        ctx.fillRect(x + 2.5 + LIMB_WIDTH + TORSO_WIDTH, y + HEAD_HEIGHT * 2, LIMB_WIDTH, HEAD_HEIGHT); // Right leg

        // Restore context state
        ctx.restore();
    }
}