import { PLAYER_CONFIG } from './config.js';
import { playSound } from './audio.js';

export class Player {
    constructor(gameHeight, assets) {
        this.gameHeight = gameHeight;
        this.config = PLAYER_CONFIG;
        this.assets = assets; // { normalImage, shipImage }

        this.x = this.config.initialX;
        this.y = this.config.initialY;

        this.baseWidth = this.config.width;
        this.baseHeight = this.config.height;
        this.sizeMultiplier = 1; // 1 for normal, <1 for mini

        this.width = this.baseWidth * this.sizeMultiplier;
        this.height = this.baseHeight * this.sizeMultiplier;

        this.velocityY = 0;
        this.velocityX = 0; // Added for slingshot launch
        this.rotation = 0; // For character tilt
        this.mode = 'normal'; // 'normal' or 'ship'
        this.currentImage = this.assets.normalImage;
        this.isThrusting = false;

        this.trailParticles = [];
        this.trailMaxLength = 10; 
        this.trailParticleBaseSize = 5; 

        this.justFlapped = false; // For tutorial

        // Boost properties
        this.maxBoostFuel = 100;
        this.boostFuel = this.maxBoostFuel;
        this.isBoosting = false;
        this.boostConsumptionRate = 0.5; // per frame
        this.boostRegenRate = 0.1; // per frame
    }

    update(gravityDirection, gameState, horizontalSpeed = 0) {
        // Allow update in playing states
        if (gameState !== 'playing' && gameState !== 'levelPlaying') return;

        const prevX = this.x;
        const prevY = this.y;

        if (this.mode === 'ship') {
            if (this.isThrusting) {
                this.velocityY += this.config.thrustStrength * gravityDirection;
            }
            this.velocityY += this.config.gravity * gravityDirection; 
            this.y += this.velocityY;
            this.velocityY *= 0.99; 
            this.rotation = 0; // Ship doesn't rotate
        } else { 
            this.velocityY += this.config.gravity * gravityDirection;
            this.y += this.velocityY;
            
            // New "full direction" rotation logic based on movement vector.
            // The angle will be between -90 degrees (pointing up) and +90 degrees (pointing down).
            if (horizontalSpeed > 0) {
                this.rotation = Math.atan2(this.velocityY, horizontalSpeed);
            } else {
                this.rotation = 0; // No rotation if not moving forward.
            }
        }

        this.trailParticles.push({
            x: prevX, 
            y: prevY,
            alpha: 1.0,
            size: this.trailParticleBaseSize * this.sizeMultiplier * (this.mode === 'ship' ? 1.5 : 1)
        });

        if (this.trailParticles.length > this.trailMaxLength) {
            this.trailParticles.shift();
        }

        this.trailParticles.forEach(p => {
            p.alpha -= 0.1; 
            p.size *= 0.95; 
        });
        this.trailParticles = this.trailParticles.filter(p => p.alpha > 0 && p.size > 0.5);

        this.updateBoost();
    }

    updateBoost() {
        if (this.isBoosting && this.boostFuel > 0) {
            this.boostFuel -= this.boostConsumptionRate;
            if (this.boostFuel < 0) this.boostFuel = 0;
        } else {
            if (this.boostFuel < this.maxBoostFuel) {
                this.boostFuel += this.boostRegenRate;
                if (this.boostFuel > this.maxBoostFuel) this.boostFuel = this.maxBoostFuel;
            }
        }
        // if fuel runs out, stop boosting
        if (this.boostFuel <= 0) {
            this.isBoosting = false;
        }
    }

    draw(ctx, gravityDirection) {
        if (!this.currentImage || !this.currentImage.complete) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.mode === 'normal') {
            ctx.rotate(this.rotation * gravityDirection);
            ctx.scale(1, gravityDirection);
        }
        ctx.drawImage(this.currentImage, -this.width / 2, -this.height / 2, this.width, this.height);
        ctx.restore();
    }

    drawTrail(ctx) {
        ctx.save();
        this.trailParticles.forEach(particle => {
            ctx.beginPath();
            if (this.mode === 'ship') {
                ctx.fillStyle = `rgba(255, 100, 50, ${particle.alpha * 0.7})`; 
            } else {
                const r = this.sizeMultiplier < 1 ? 137 : 255; 
                const g = this.sizeMultiplier < 1 ? 207 : 192;
                const b = this.sizeMultiplier < 1 ? 240 : 203;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${particle.alpha * 0.5})`;
            }
            ctx.arc(particle.x, particle.y, Math.max(0, particle.size), 0, Math.PI * 2);
            ctx.fill();
        });
        ctx.restore();
    }

    flap(gravityDirection) {
        if (this.mode === 'normal') {
            this.velocityY = this.config.jumpStrength * gravityDirection;
            playSound('flap');
        }
    }

    consumeFlapState() {
        const flapped = this.justFlapped;
        this.justFlapped = false;
        return flapped;
    }

    startBoosting() {
        if (this.boostFuel > 10) { // Require a minimum amount to start
            this.isBoosting = true;
        }
    }

    stopBoosting() {
        this.isBoosting = false;
    }

    startThrust() {
        if (this.mode === 'ship') {
            this.isThrusting = true;
        }
    }

    endThrust() {
        if (this.mode === 'ship') {
            this.isThrusting = false;
        }
    }

    changeMode(newMode) {
        if (this.mode === newMode) return;

        this.mode = newMode;
        this.velocityY = 0; 
        this.velocityX = 0;
        this.rotation = 0;
        this.isThrusting = false;
        this.trailParticles = []; 

        if (newMode === 'ship') {
            this.currentImage = this.assets.shipImage;
        } else {
            this.currentImage = this.assets.normalImage;
        }
    }

    changeSize(newMultiplier) {
        if (this.sizeMultiplier === newMultiplier) return false; 

        this.sizeMultiplier = newMultiplier;
        this.width = this.baseWidth * this.sizeMultiplier;
        this.height = this.baseHeight * this.sizeMultiplier;
        return true; 
    }

    reset(newInitialY) {
        this.y = newInitialY;
        this.velocityY = 0;
        this.velocityX = 0;
        this.rotation = 0;
        this.mode = 'normal';
        this.currentImage = this.assets.normalImage;
        this.isThrusting = false;
        this.trailParticles = [];
        
        this.sizeMultiplier = 1;
        this.width = this.baseWidth * this.sizeMultiplier;
        this.height = this.baseHeight * this.sizeMultiplier;

        // Reset boost state
        this.boostFuel = this.maxBoostFuel;
        this.isBoosting = false;
    }

    getCollisionRect() {
        const padding = 5; 
        return {
            left: this.x - this.width / 2 + padding,
            right: this.x + this.width / 2 - padding,
            top: this.y - this.height / 2 + padding,
            bottom: this.y + this.height / 2 - padding,
        };
    }

    checkBoundaryCollision() {
        const playerRect = this.getCollisionRect(); 
        return playerRect.bottom > this.gameHeight || playerRect.top < 0;
    }
}