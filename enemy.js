export class Enemy {
    constructor(renderWidth, renderHeight, assets) {
        this.assets = assets; // { standImage, punchImage }
        this.state = 'idle'; // 'idle' -> 'punch' -> 'done'
        this.timer = 0;

        this.width = 46;
        this.height = 46;

        // Spawn at right edge, mid-height
        this.x = renderWidth + this.width;
        this.y = Math.max(40, Math.min(renderHeight - 40, renderHeight / 2));

        this.speed = 6;

        this.currentImage = this.assets.standImage;
    }

    update() {
        if (this.state === 'idle') {
            this.timer++;
            if (this.timer >= this.idleDuration) {
                this.state = 'punch';
                this.currentImage = this.assets.punchImage;
            }
        } else if (this.state === 'punch') {
            this.x -= this.speed;
            if (this.x + this.width < -40) {
                this.state = 'done';
            }
        }
    }

    draw(ctx) {
        if (!this.currentImage || !this.currentImage.complete) return;
        ctx.save();
        ctx.drawImage(
            this.currentImage,
            this.x - this.width / 2,
            this.y - this.height / 2,
            this.width,
            this.height
        );
        ctx.restore();
    }

    setConfig({ idleDurationFrames, punchSpeed, width, height }) {
        if (idleDurationFrames) this.idleDuration = idleDurationFrames;
        if (punchSpeed) this.speed = punchSpeed;
        if (width) this.width = width;
        if (height) this.height = height;
    }

    isDone() {
        return this.state === 'done';
    }

    getCollisionRect() {
        return {
            left: this.x - this.width / 2,
            right: this.x + this.width / 2,
            top: this.y - this.height / 2,
            bottom: this.y + this.height / 2
        };
    }
}

export function checkEnemyCollision(enemy, playerRect) {
    const e = enemy.getCollisionRect();
    const isHit = !(
        playerRect.right < e.left ||
        playerRect.left > e.right ||
        playerRect.bottom < e.top ||
        playerRect.top > e.bottom
    );

    // Switch sprite based on touch: punch when colliding, stand otherwise
    if (enemy.assets && enemy.assets.standImage && enemy.assets.punchImage) {
        enemy.currentImage = isHit ? enemy.assets.punchImage : enemy.assets.standImage;
    }

    return isHit;
}

