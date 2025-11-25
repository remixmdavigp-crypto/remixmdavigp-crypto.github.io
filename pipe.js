import { PIPE_CONFIG } from './config.js';
import { playSound } from './audio.js';

export class Pipe {
    constructor(x, gameHeight, assets, yPosition = null) {
        this.x = x;
        // Use provided yPosition for the gap's top edge, or randomize if null
        this.y = yPosition !== null ? yPosition : Math.random() * (gameHeight - PIPE_CONFIG.gap - 150) + 75; // 150 is top/bottom margin
        
        this.topImage = assets.pipeTopImage;
        this.bottomImage = assets.pipeBottomImage;

        // Force width to exactly 3 grid tiles (3 * 32 = 96), independent of image size
        const tileWidth = 32;
        this.width = tileWidth * 3;

        this.gap = PIPE_CONFIG.gap;
        this.imageHeight = PIPE_CONFIG.imageHeight;
        this.passed = false;
        this.pattern = null; // For tiled rendering
    }

    update(speed) {
        this.x -= speed;
    }

    draw(ctx) {
        if (!this.pattern && this.topImage && this.topImage.complete) {
            const tileCanvas = document.createElement('canvas');
            const tileCtx = tileCanvas.getContext('2d');
            tileCanvas.width = 32;
            tileCanvas.height = 32;
            // Draw the source image onto the 32x32 canvas, stretching it to make a 32x32 tile.
            tileCtx.drawImage(this.topImage, 0, 0, 32, 32); 
            this.pattern = ctx.createPattern(tileCanvas, 'repeat');
        }

        if (this.pattern) {
            ctx.save();
            // Translate the context's origin to offset the pattern's position.
            // This makes the pattern appear static relative to the screen ("camera").
            ctx.translate(this.x, 0); 
            ctx.fillStyle = this.pattern;
            
            // Draw top pipe. Since the context is translated, we draw at x=0.
            ctx.fillRect(0, 0, this.width, this.y);
            
            // Draw bottom pipe.
            const gameHeight = ctx.canvas.height;
            ctx.fillRect(0, this.y + this.gap, this.width, gameHeight - (this.y + this.gap));
            
            ctx.restore();

        } else { // Fallback to old drawing method if pattern fails for some reason
            if (this.topImage && this.topImage.complete) {
                ctx.drawImage(this.topImage, this.x, 0, this.width, this.y);
            }
            if (this.bottomImage && this.bottomImage.complete) {
                const gameHeight = ctx.canvas.height;
                const bottomPipeTop = this.y + this.gap;
                ctx.drawImage(this.bottomImage, this.x, bottomPipeTop, this.width, gameHeight - bottomPipeTop);
            }
        }
    }

    isOffScreen() {
        return this.x + this.width < 0;
    }

    checkCollision(player) {
        const playerRect = player.getCollisionRect();
        
        const pipeTopRect = {
            left: this.x,
            right: this.x + this.width,
            top: 0, // Effectively from top of screen
            bottom: this.y
        };
        const pipeBottomRect = {
            left: this.x,
            right: this.x + this.width,
            top: this.y + this.gap,
            bottom: player.gameHeight // Effectively to bottom of screen
        };

        // Check collision with top pipe
        if (playerRect.right > pipeTopRect.left &&
            playerRect.left < pipeTopRect.right &&
            playerRect.bottom > pipeTopRect.top && // Not strictly needed as pipe top is from 0
            playerRect.top < pipeTopRect.bottom) {
            return true;
        }

        // Check collision with bottom pipe
        if (playerRect.right > pipeBottomRect.left &&
            playerRect.left < pipeBottomRect.right &&
            playerRect.bottom > pipeBottomRect.top &&
            playerRect.top < pipeBottomRect.bottom) { // Not strictly needed as pipe bottom is to gameHeight
            return true;
        }
        return false;
    }

    checkPassed(playerRect, onScore) {
        // Default behavior used elsewhere expects to pass a cameraX value,
        // but keep compatibility: if a third arg 'cameraX' is provided use it,
        // otherwise fall back to player's left edge.
        const cameraX = arguments.length >= 3 ? arguments[2] : playerRect.left;
        if (!this.passed && this.x + this.width < cameraX) {
            this.passed = true;
            onScore();
            // Score sound is intentionally not played here (handled by caller if desired).
        }
    }
}

export function managePipes(pipes, frameCount, gameSpeed, gameWidth, gameHeight, player, onScore, assets, isLevelMode = false) {
    // Spawn new pipes (only in random mode)
    if (!isLevelMode && frameCount % PIPE_CONFIG.spawnInterval === 0) {
        pipes.push(new Pipe(gameWidth, gameHeight, assets)); // Constructor uses random Y by default
    }

    // Update and draw existing pipes
    for (let i = pipes.length - 1; i >= 0; i--) {
        const pipe = pipes[i];
        pipe.update(PIPE_CONFIG.baseSpeed * gameSpeed);
        
        if (pipe.checkCollision(player)) {
            return true; // Collision detected
        }
        // Use camera X (center of screen) as the pass threshold so scoring triggers
        // when the pipe passes the camera rather than the player's hitbox.
        const cameraX = Math.floor(gameWidth / 2);
        pipe.checkPassed(player.getCollisionRect(), onScore, cameraX);

        if (pipe.isOffScreen()) {
            pipes.splice(i, 1);
        }
    }
    return false; // No collision
}

export function drawAllPipes(ctx, pipes) {
    pipes.forEach(pipe => pipe.draw(ctx));
}