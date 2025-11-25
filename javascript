// ... existing code ...

// Initialize lightweight multiplayer using the global WebsimSocket if available.
async function initMultiplayer() {
    if (typeof WebsimSocket === 'undefined') return;
    try {
        room = new WebsimSocket();
        await room.initialize();

        // Keep local caches of presence & peers details
        peersPresence = { ...room.presence };
        peersInfo = { ...room.peers };

        // Subscribe to presence updates to keep up-to-date
        room.subscribePresence((currentPresence) => {
            peersPresence = { ...currentPresence };
        });

        // Update peersInfo whenever room peer list changes
        room.subscribePresence((/*noop*/) => {
            peersInfo = { ...room.peers };
            // ensure avatar images are cached
            Object.keys(peersInfo).forEach(id => {
                const p = peersInfo[id];
                if (p && p.avatarUrl && !avatarImages[id]) {
                    const img = new Image();
                    img.crossOrigin = "anonymous";
                    img.src = p.avatarUrl;
                    avatarImages[id] = img;
                }
            });
        });

        // Optionally handle incoming requests/events (not required now)
        room.onmessage = (event) => {
            // handle custom events if you add them later
        };

        console.log("Multiplayer initialized, client id:", room.clientId);
    } catch (err) {
        console.warn("Multiplayer not available:", err);
        room = null;
    }
}

// Broadcast our presence (position, mode, score)
function broadcastPresence() {
    if (!room || !player) return;
    try {
        room.updatePresence({
            x: player.x,
            y: player.y,
            mode: player.mode,
            score: score
        });
    } catch (e) {
        // ignore transient errors
    }
}

// Draw all remote players (peers) on the renderCtx at a camera-relative X
function drawRemotePlayers(ctx) {
    if (!room) return;
    const clientId = room.clientId;
    const cameraX = RENDER_WIDTH / 2; // place other players near center (camera X)
    Object.keys(peersPresence).forEach(id => {
        if (id === clientId) return; // skip ourselves
        const p = peersPresence[id];
        if (!p) return;
        // Map their reported y (which uses render coords) directly
        const drawX = cameraX; 
        const drawY = typeof p.y === 'number' ? p.y : RENDER_HEIGHT / 2;

        // Try to draw avatar if available
        const avatar = avatarImages[id];
        const size = 28;
        if (avatar && avatar.complete && avatar.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, drawX - size / 2, drawY - size / 2, size, size);
            ctx.restore();
            // small outline
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            // Fallback: colored circle and a letter (first char of username)
            ctx.save();
            ctx.fillStyle = id === clientId ? 'lime' : '#ffcc66';
            ctx.beginPath();
            ctx.arc(drawX, drawY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#222';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            // get initial from peersInfo if present
            let initial = '?';
            if (peersInfo[id] && peersInfo[id].username) initial = peersInfo[id].username.charAt(0).toUpperCase();
            ctx.fillText(initial, drawX, drawY);
            ctx.restore();
        }
    });
}

// ... existing code ...

// ... inside initGame() after player is created and setupInputHandlers(); ...
        setupInputHandlers();

        // initialize multiplayer (best-effort)
        initMultiplayer().catch(err => console.warn("Multiplayer init error:", err));

        UI.hideLoadingScreen(); 
        enterStartScreenState(); 
// ... existing code ...

function gameLoop() {
    frameCount++; // Global frame count for random mode spawning interval
    renderCtx.clearRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    if (gameState === 'playing' || gameState === 'levelPlaying') {
        bgX -= BACKGROUND_CONFIG.baseSpeed * gameSpeed;
        if (bgX <= -RENDER_WIDTH) {
            bgX = 0;
        }
    }

    drawBackground();

    if (gameState === 'playing' || gameState === 'levelPlaying') {
        updateGameLogic(); 
        // Draw Rascal enemies
        enemies.forEach(e => e.draw(renderCtx));
        drawAllPipes(renderCtx, pipes);
        player.drawTrail(renderCtx); 
        player.draw(renderCtx, gravityDirection); 

        // Draw remote players from multiplayer presence
        drawRemotePlayers(renderCtx);

        // Broadcast our updated presence
        broadcastPresence();

    } else if (gameState === 'readyToLaunch') {
        // No game logic update, just draw slingshot and player
        drawSlingshot(renderCtx);
        player.draw(renderCtx, gravityDirection);
        // still broadcast a presence (so others can see our pre-launch Y)
        broadcastPresence();
    } else if (gameState === 'gameOver') {
        enemies.forEach(e => e.draw(renderCtx));
        drawAllPipes(renderCtx, pipes); 
        player.drawTrail(renderCtx); 
        player.draw(renderCtx, gravityDirection); 
        drawRemotePlayers(renderCtx);
    } else if (gameState === 'start' || gameState === 'levelSelect') {
        // Background is drawn. UI layer handles screen content.
        // broadcast minimal presence so peers can see you're on menu
        broadcastPresence();
    }
    
    // Now, draw the low-res canvas to the main, visible canvas
    ctx.clearRect(0, 0, gameWidth, gameHeight);
    ctx.imageSmoothingEnabled = false; // Crucial for pixelated look
    ctx.drawImage(renderCanvas, 0, 0, gameWidth, gameHeight);
    
    requestAnimationFrame(gameLoop); 
}

