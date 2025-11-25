import { gsap } from 'gsap'; // For UI animations if not handled by ui.js directly
import { PLAYER_CONFIG, PIPE_CONFIG, BACKGROUND_CONFIG, SOUND_ASSETS, IMAGE_ASSETS_LIST, EPIC_SCORE_THRESHOLD, EPIC_BACKGROUND_COLOR, EPIC_MUSIC_KEY, MAIN_MENU_MUSIC_KEY, LEVELS, SLINGSHOT_CONFIG, TUTORIAL_COMPLETED_KEY, ENEMY_CONFIG } from './config.js'; // Removed GAME_WIDTH, GAME_HEIGHT, TUTORIAL_COMPLETED_KEY
import { Player } from './player.js';
import { Pipe, managePipes, drawAllPipes } from './pipe.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';
import { Enemy, checkEnemyCollision } from './enemy.js';

let canvas, ctx;
let renderCanvas, renderCtx; // For pixelation effect
const RENDER_WIDTH = 320;
const RENDER_HEIGHT = 480;

let gameWidth, gameHeight; // These will be dynamic
let player;
let pipes = [];
let enemies = [];
let assets = {}; // To store loaded images
let backgroundVideo; // For video background

// --- Multiplayer variables ---
let room = null;
let peersPresence = {}; // latest presence snapshot cached locally
let peersInfo = {}; // info like username/avatar from room.peers
let avatarImages = {}; // cache Image objects for peer avatars
// -------------------------------

let scale = 1; // For scaling canvas
let canvasBounds = { left: 0, top: 0 }; // For input coordinate conversion

let score = 0;
let highScore = 0;
const HIGH_SCORE_KEY = 'flappyPiggy2HighScore';

let gameState = 'loading'; // 'loading', 'start', 'levelSelect', 'readyToLaunch', 'playing', 'levelPlaying', 'gameOver'
let frameCount = 0;
let gameSpeed = 0; // Master game speed, pixels per frame
let baseGameSpeed = 1; // The speed set by the slingshot launch
const BOOST_MULTIPLIER = 1.8; // How much faster the game gets when boosting
let gravityDirection = 1; // 1 for normal, -1 for inverted
let isEpicMode = false; // To track if high-score mode is active
let gameLoopRunning = false; // To track if gameLoop has been initiated
let bgX = 0; // For background scrolling

// Slingshot related
let isDraggingSlingshot = false;
let dragStartX = 0, dragStartY = 0;
let stretchX = 0, stretchY = 0;

// Tutorial related
let tutorialCompleted = false;
let currentTutorialStep = 0;
const tutorialSteps = [
    { text: "Welcome to Flappy Piggy 2! Click or Press Space to Flap your wings. Try it now!", awaitsFlap: true, showNextButton: false },
    { text: "Good job! Keep flapping to stay airborne. In the main game, avoid hitting edges, pipes, or the ground.", awaitsFlap: false, showNextButton: true },
    { text: "You'll fly through pipe gaps to score points. That's it!", awaitsFlap: false, showNextButton: true },
    { text: "You're ready. Click 'Start Game!' below or press Space to begin the real challenge.", awaitsFlap: false, showNextButton: false, showStartGameButton: true }
];

// Level Play related
let currentLevel = null; // Will store the object from LEVELS array
let levelFrameCount = 0;
let nextLevelEventIndex = 0;


function loadHighScore() {
    // Do not read from localStorage — high score is not persisted.
    // Default to 100 to preserve the prior "special" display behavior.
    highScore = 100;
    UI.updateHighScoreDisplay(highScore);
}

function saveHighScore() {
    // No-op: intentionally disabled persistence of high score.
    // Kept for compatibility so other code can call it without side effects.
}

function loadTutorialCompletion() {
    tutorialCompleted = localStorage.getItem(TUTORIAL_COMPLETED_KEY) === 'true';
}

function saveTutorialCompletion() {
    localStorage.setItem(TUTORIAL_COMPLETED_KEY, 'true');
    tutorialCompleted = true;
}

async function loadAssets() {
    const imagePromises = IMAGE_ASSETS_LIST.map(src => {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.src = src;
            img.onload = () => {
                assets[src] = img; 
                resolve(img);
            };
            img.onerror = (err) => {
                console.error(`Failed to load image: ${src}`, err);
                // Resolve instead of reject so a single missing image doesn't abort loading
                // and allows the game to show fallback visuals.
                resolve(null);
            };
        });
    });
    
    // Only attempt to wait for the video if it actually has a src set.
    let videoPromise = Promise.resolve();
    try {
        const videoSrc = backgroundVideo && backgroundVideo.getAttribute && backgroundVideo.getAttribute('src');
        if (backgroundVideo && videoSrc) {
            videoPromise = new Promise((resolve, reject) => {
                if (backgroundVideo.readyState >= 4) { // HAVE_ENOUGH_DATA
                    resolve();
                } else {
                    const onCanPlay = () => {
                        cleanup();
                        resolve();
                    };
                    const onError = (e) => {
                        cleanup();
                        console.error("Video loading error:", e);
                        // Do not reject — allow game to continue without video.
                        resolve();
                    };
                    const cleanup = () => {
                        backgroundVideo.removeEventListener('canplaythrough', onCanPlay);
                        backgroundVideo.removeEventListener('error', onError);
                    };
                    backgroundVideo.addEventListener('canplaythrough', onCanPlay, { once: true });
                    backgroundVideo.addEventListener('error', onError, { once: true });
                    try { backgroundVideo.load(); } catch(e) { /* ignore load errors */ }
                }
            });
        }
    } catch (e) {
        // If anything goes wrong inspecting the video, continue without blocking.
        console.warn("Video check failed, continuing without waiting for video.", e);
        videoPromise = Promise.resolve();
    }
    
    await Promise.all([...imagePromises, videoPromise]);
    assets.playerNormalImage = assets[PLAYER_CONFIG.normalImageSrc] || null;
    assets.playerShipImage = assets[PLAYER_CONFIG.shipImageSrc] || null;
    assets.pipeTopImage = assets[PIPE_CONFIG.topImageSrc] || null; 
    assets.pipeBottomImage = assets[PIPE_CONFIG.bottomImageSrc] || null; 
    // The image background is no longer primary, but keep asset for potential fallback
    if (assets[BACKGROUND_CONFIG.imageSrc]) {
        assets.backgroundImage = assets[BACKGROUND_CONFIG.imageSrc];
    }
    assets.enemyStandImage = assets[ENEMY_CONFIG.standImageSrc] || null;
    assets.enemyPunchImage = assets[ENEMY_CONFIG.punchImageSrc] || null;

    console.log("All assets (images and optional video) processed.");
}

function setGameSpeedMultiplier(val) {
    // This function is now obsolete as speed is handled differently.
    // It's kept for compatibility with any remaining portal logic, but does nothing.
}

function setGameGravityDirection(val) {
    gravityDirection = val;
    // UI update if visual indication of gravity changes
}

function resetCommonState() {
    frameCount = 0;
    gameSpeed = 0;
    baseGameSpeed = 1;
    gravityDirection = 1;
    isEpicMode = false;
    if(player) player.reset(RENDER_HEIGHT / 2); // Reset with new center
    pipes.length = 0;
    enemies.length = 0;
    bgX = 0;
    // Level specific state is now handled by the functions that call this.
}

function enterStartScreenState() {
    gameState = 'start';
    resetCommonState(); 
    currentLevel = null; // Explicitly reset level context
    UI.updateLevelNameDisplay(null);

    // Seek video to the specified frame for the background
    const targetTime = 467763 / 1000; // 467.763 seconds
    if (backgroundVideo && backgroundVideo.seekable.length > 0) {
        // Ensure not already seeking
        if (Math.abs(backgroundVideo.currentTime - targetTime) > 0.1) {
             backgroundVideo.currentTime = targetTime;
        }
    } else if (backgroundVideo) {
        // If not seekable yet, wait for it
        backgroundVideo.onseeked = null; // Clear previous handler
        const seekOnCanPlay = () => {
            if (backgroundVideo.seekable.length > 0) {
                backgroundVideo.currentTime = targetTime;
            }
        };
        backgroundVideo.addEventListener('canplaythrough', seekOnCanPlay, { once: true });
    }

    UI.showStartScreen(highScore);

    Audio.stopAllMusic();
    if (Audio.getAudioContext()) {
        Audio.playMusic(MAIN_MENU_MUSIC_KEY, true, 0.2); 
    }

    if (canvas && canvas.getContext('2d')) {
        const currentCtx = canvas.getContext('2d');
        currentCtx.clearRect(0, 0, gameWidth, gameHeight);
        if (assets.backgroundImage && assets.backgroundImage.complete) {
            currentCtx.drawImage(assets.backgroundImage, 0, 0, gameWidth, gameHeight);
        } else {
            currentCtx.fillStyle = '#70c5ce'; // Fallback color
            currentCtx.fillRect(0, 0, gameWidth, gameHeight);
        }
    }
}

function enterLevelSelectState() {
    gameState = 'levelSelect';
    resetCommonState();
    currentLevel = null; // Explicitly reset level context
    UI.updateLevelNameDisplay(null);
    UI.populateLevelList(LEVELS, startLevel); // Pass startLevel as callback
    UI.showLevelSelectScreen();
    // Menu music might continue or change here if desired
}


function startTutorial() {
    gameState = 'tutorial';
    resetCommonState(); 
    currentLevel = null; // Explicitly reset level context
    UI.updateLevelNameDisplay(null);
    currentTutorialStep = 0;

    UI.showTutorialScreen();
    UI.updateTutorialText(tutorialSteps[currentTutorialStep].text, tutorialSteps[currentTutorialStep].showNextButton, tutorialSteps[currentTutorialStep].showStartGameButton);
    
    Audio.stopAllMusic(); 
    Audio.playMusic('background_music'); 
}

function advanceTutorialStep() {
    currentTutorialStep++;
    if (currentTutorialStep < tutorialSteps.length) {
        UI.updateTutorialText(tutorialSteps[currentTutorialStep].text, tutorialSteps[currentTutorialStep].showNextButton, tutorialSteps[currentTutorialStep].showStartGameButton);
    } else {
        completeTutorialAndStartGame();
    }
}

function completeTutorialAndStartGame() {
    saveTutorialCompletion();
    UI.hideTutorialScreen();
    startGameRandom(); // Start the actual game (random mode)
}

function resetGame(isLevelMode = false) {
    score = 0;
    resetCommonState(); // This handles most resets
    player.x = SLINGSHOT_CONFIG.x;
    player.y = SLINGSHOT_CONFIG.y;
    player.velocityY = 0;

    if (isLevelMode && currentLevel) {
         UI.updateLevelNameDisplay(currentLevel.name);
    } else {
         UI.updateLevelNameDisplay(null);
         currentLevel = null; // Ensure level is cleared for random mode.
    }


    UI.updateScoreDisplay(score);
    UI.hideStartScreen();
    UI.hideGameOverScreen();
    UI.hideLevelSelectScreen();
    UI.showGameHUD();
    
    gameState = 'readyToLaunch';
}

function initialGameSetupAndStart() { 
    if (!player) {
        console.warn("Initial setup called before player initialization.");
        return;
    }
    Audio.stopAllMusic(); 

    if (!tutorialCompleted) {
        startTutorial();
    } else {
        startGameRandom();
    }
}

function startGameRandom() { // This is for starting the *random* game
    if (!player) {
        console.warn("startGameRandom called before player initialization.");
        return;
    }
    
    const doResetAndPlayMusic = () => {
        resetGame(false); // false for isLevelMode
        if (Audio.getAudioContext()) { 
             Audio.stopAllMusic(); 
             Audio.playMusic('background_music'); 
        }
    };

    if (Audio.getAudioContext()) { 
        doResetAndPlayMusic();
    } else { 
        Audio.setupAudio(SOUND_ASSETS).then(() => {
            doResetAndPlayMusic();
        }).catch(err => {
            console.error("Audio setup failed, starting game without sound...", err);
            resetGame(false); 
        });
    }
}

function startLevel(levelIndex) {
    if (!player) {
        console.warn("startLevel called before player initialization.");
        return;
    }
    if (levelIndex < 0 || levelIndex >= LEVELS.length) {
        console.error("Invalid level index:", levelIndex);
        enterLevelSelectState(); // Go back to selection
        return;
    }
    currentLevel = LEVELS[levelIndex];
    
    const doResetAndPlayMusic = () => {
        resetGame(true); // true for isLevelMode
        levelFrameCount = 0;
        nextLevelEventIndex = 0;

        if (Audio.getAudioContext()) {
             Audio.stopAllMusic();
             Audio.playMusic('background_music'); // Or level-specific music
        }
    };
    
    if (Audio.getAudioContext()) {
        doResetAndPlayMusic();
    } else {
         Audio.setupAudio(SOUND_ASSETS).then(() => {
            doResetAndPlayMusic();
        }).catch(err => {
            console.error("Audio setup failed, starting level without sound...", err);
            resetGame(true);
        });
    }
}

function endLevel() {
    // Called when a predefined level is completed
    // Similar to endGame but for level success
    Audio.playSound('level_complete'); // Or a more celebratory sound
    Audio.stopMusic('background_music');
    Audio.stopMusic(EPIC_MUSIC_KEY);

    // For now, just go back to level select screen
    // Could add a "Level Complete" screen later
    UI.hideGameHUD();
    enterLevelSelectState();
}


function endGame() {
    if (gameState === 'gameOver') return;
    const wasLevelPlaying = gameState === 'levelPlaying';
    gameState = 'gameOver';

    Audio.playSound('hit');
    Audio.stopAllMusic();

    let isNewHighScore = false;
    if (!wasLevelPlaying && score > highScore) { // Only update high score for random mode for now
        highScore = score;
        // persistence disabled: do not call saveHighScore() or write to localStorage
        isNewHighScore = true;
    }

    if (isNewHighScore) {
        Audio.playSound('new_high_score');
    } else {
        Audio.playSound('game_over');
    }

    UI.showGameOverScreen(score, highScore, isNewHighScore);
    UI.hideGameHUD();
}

function handlePlayerInputStart(e) {
    // Normalize pointer/touch/mouse event to a single `point` object to avoid
    // accessing properties on undefined (e.g., keyboard events).
    let point = null;
    if (e.touches && e.touches.length > 0) {
        point = e.touches[0];
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        point = e.changedTouches[0];
    } else if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        point = e;
    } else {
        // Not a pointer event (e.g., keyboard). Provide a safe fallback.
        point = null;
    }

    if (gameState === 'readyToLaunch') {
        // For slingshot we need pointer coords; if none, ignore the input.
        if (!point) return;
        e.preventDefault();
        isDraggingSlingshot = true;
        const rect = canvas.getBoundingClientRect();
        dragStartX = (point.clientX - canvasBounds.left) / scale;
        dragStartY = (point.clientY - canvasBounds.top) / scale;
        player.x = dragStartX;
        player.y = dragStartY;
        return;
    }

    if (gameState === 'playing' || gameState === 'levelPlaying') {
        e.preventDefault();
        if (player.mode === 'normal') {
            player.flap(gravityDirection);
        } else if (player.mode === 'ship') {
            player.startThrust();
        }
    } else if (gameState === 'start') {
        // We don't preventDefault here, to allow clicks on UI buttons on the start screen
        // But we need to check if the click was on a button or not.
        // The buttons have their own listeners, so this handler should only fire for the background/image.
        const targetId = e.target && e.target.id;
        if (targetId === 'startButton' || (e.target && e.target.closest && e.target.closest('button'))) {
            // Let the button's own click handler do the work.
            return;
        }
        e.preventDefault();
        if (Audio.getAudioContext()) {
            startGameRandom();
        } else {
            Audio.setupAudio(SOUND_ASSETS).then(() => {
                startGameRandom();
            }).catch(err => {
                console.error("Audio setup failed on spacebar start:", err);
                startGameRandom();
            });
        }
    } else if (gameState === 'tutorial') {
        e.preventDefault();
        const currentStepConf = tutorialSteps[currentTutorialStep];
        if (currentStepConf.awaitsFlap) {
            player.flap(gravityDirection);
        } else if (currentStepConf.showStartGameButton) {
            completeTutorialAndStartGame();
        }
    }
}

function handlePlayerInputMove(e) {
    if (!isDraggingSlingshot || gameState !== 'readyToLaunch') return;
    e.preventDefault();

    // Normalize pointer event (mouse or touch) and guard against missing data
    let point = null;
    if (e.touches && e.touches.length > 0) {
        point = e.touches[0];
    } else if (e.changedTouches && e.changedTouches.length > 0) {
        point = e.changedTouches[0];
    } else if (typeof e.clientX === 'number' && typeof e.clientY === 'number') {
        point = e;
    }

    if (!point) return;

    const mouseX = (point.clientX - canvasBounds.left) / scale;
    const mouseY = (point.clientY - canvasBounds.top) / scale;

    let dx = mouseX - SLINGSHOT_CONFIG.x;
    let dy = mouseY - SLINGSHOT_CONFIG.y;

    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > SLINGSHOT_CONFIG.maxStretch) {
        dx = (dx / dist) * SLINGSHOT_CONFIG.maxStretch;
        dy = (dy / dist) * SLINGSHOT_CONFIG.maxStretch;
    }

    player.x = SLINGSHOT_CONFIG.x + dx;
    player.y = SLINGSHOT_CONFIG.y + dy;

    stretchX = dx;
    stretchY = dy;
}


function handlePlayerInputEnd() {
    if (isDraggingSlingshot && gameState === 'readyToLaunch') {
        isDraggingSlingshot = false;
        const launchVelX = -stretchX * SLINGSHOT_CONFIG.launchPower;
        const launchVelY = -stretchY * SLINGSHOT_CONFIG.launchPower;

        player.velocityX = launchVelX;
        player.velocityY = launchVelY;
        baseGameSpeed = launchVelX * (PIPE_CONFIG.baseSpeed / 5); // Scale down for pipe speed
        
        if (baseGameSpeed < 1) baseGameSpeed = 1; // Minimum speed

        gameState = currentLevel ? 'levelPlaying' : 'playing';
        
        // Reset player's horizontal movement ability but keep vertical
        player.x = SLINGSHOT_CONFIG.x; // Put player back on correct X axis
        player.velocityX = 0; // Player itself doesn't move horizontally, the world does
        stretchX = 0;
        stretchY = 0;
        Audio.playSound('flap'); // Re-using flap for launch sound

        Audio.stopAllMusic();
        Audio.playMusic('speed_music');

        return;
    }

    if ((gameState === 'playing' || gameState === 'levelPlaying') && player.mode === 'ship') {
        player.endThrust();
    }
}

function resizeGame() {
    gameWidth = window.innerWidth;
    gameHeight = window.innerHeight;

    if (canvas) {
        canvas.width = gameWidth;
        canvas.height = gameHeight;
    }

    const wrapper = document.getElementById('gameAndUiWrapper');
    if (wrapper) {
        wrapper.style.width = `${gameWidth}px`;
        wrapper.style.height = `${gameHeight}px`;
    }

    if (player) {
        player.gameHeight = gameHeight; // Update player with new height
    }
    
    // Since we are full-screen, the canvas starts at (0,0) of the window.
    canvasBounds = { left: 0, top: 0 };
    scale = 1;
}

function setupInputHandlers() {
    // We listen on the document/window now to capture events even if the cursor is slightly off the canvas
    const getEvent = (e) => e.touches ? e.touches[0] : e;

    const inputStart = (e) => {
        const event = getEvent(e);
        // Only trigger if the click is within the canvas bounds
        const rect = document.getElementById('gameAndUiWrapper').getBoundingClientRect();
        if (event.clientX >= rect.left && event.clientX <= rect.right &&
            event.clientY >= rect.top && event.clientY <= rect.bottom) {
            handlePlayerInputStart(e);
        }
    };

    const inputMove = (e) => {
        if(isDraggingSlingshot){
            e.preventDefault();
            handlePlayerInputMove(e);
        }
    };
    
    const inputEnd = (e) => {
        if(isDraggingSlingshot || player.isThrusting){
            e.preventDefault();
            handlePlayerInputEnd();
        }
    };

    document.addEventListener('mousemove', inputStart);
    document.addEventListener('touchstart', inputStart, { passive: false });
    document.addEventListener('mousemove', inputMove);
    document.addEventListener('touchmove', inputMove, { passive: false });
    document.addEventListener('mouseup', inputEnd);
    document.addEventListener('touchend', inputEnd);

    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            // Space bar can't be used for slingshot, so we only handle non-slingshot states.
             if (gameState === 'start' || gameState === 'playing' || gameState === 'levelPlaying') {
                handlePlayerInputStart(e); // Pass event for context
            } else if (gameState === 'gameOver') { 
                // Determine what to restart: if previous was level, maybe restart level?
                // For now, restartButton on UI is more specific. Space could go to main menu or restart random.
                // Let's make space on game over restart the last mode (if it was random) or go to main menu
                if (currentLevel) { // If game over happened during a level, go to main menu
                    goToMainMenu();
                } else { // If game over was from random mode
                    startGameRandom(); 
                }
            }
        }
        if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') {
            if (player) player.stopBoosting();
        }
    });

    // Boosting keys
    document.addEventListener('keydown', (e) => {
        if (e.key === 'z' || e.key === 'Z' || e.key === 'x' || e.key === 'X') {
            if (player && (gameState === 'playing' || gameState === 'levelPlaying')) {
                player.startBoosting();
            }
        }
    });
}

function updateGameLogic() { 
    // Update game speed based on boost state
    if (player.isBoosting) {
        gameSpeed = baseGameSpeed * BOOST_MULTIPLIER;
    } else {
        gameSpeed = baseGameSpeed;
    }

    const horizontalSpeed = PIPE_CONFIG.baseSpeed * gameSpeed;
    player.update(gravityDirection, gameState, horizontalSpeed);
    player.updateBoost();
    UI.updateBoostDisplay(player.boostFuel, player.maxBoostFuel, player.isBoosting);


    if (player.checkBoundaryCollision(RENDER_HEIGHT)) { // Pass render height for boundary check
        endGame();
        return;
    }

    // Adjust music playback rate based on game's horizontal speed
    if (gameState === 'playing' || gameState === 'levelPlaying') {
        // gameSpeed is a value that's set on launch. A higher launch speed means higher gameSpeed.
        // Let's assume a typical gameSpeed range is between 1 and 5.
        // We'll map this to a playback rate, e.g., between 0.9 and 1.5.
        const minRate = 0.9;
        const maxRate = 1.5;
        const baseSpeedForMinRate = 1.0;
        const maxSpeedForScaling = 5.0; // The gameSpeed at which we'll hit maxRate.
        
        let rate = minRate + ((gameSpeed - baseSpeedForMinRate) / (maxSpeedForScaling - baseSpeedForMinRate)) * (maxRate - minRate);
        
        // Clamp the rate to a reasonable range to avoid extreme audio distortion.
        rate = Math.max(0.7, Math.min(rate, 2.0));
        
        // The 'speed_music' is played after launching from the slingshot in both game modes.
        Audio.setMusicPlaybackRate('speed_music', rate);
    }

    const pipeAssets = { pipeTopImage: assets.pipeTopImage, pipeBottomImage: assets.pipeBottomImage };

    // Enemy spawn in random mode
    if (gameState === 'playing') {
        if (frameCount % ENEMY_CONFIG.spawnIntervalFrames === 0) {
            const enemy = new Enemy(RENDER_WIDTH, RENDER_HEIGHT, {
                standImage: assets.enemyStandImage,
                punchImage: assets.enemyPunchImage
            });
            enemy.setConfig({
                idleDurationFrames: ENEMY_CONFIG.idleDurationFrames,
                punchSpeed: ENEMY_CONFIG.punchSpeed,
                width: ENEMY_CONFIG.width,
                height: ENEMY_CONFIG.height
            });
            enemies.push(enemy);
        }
    }

    // Update enemies and check collision
    if (gameState === 'playing' || gameState === 'levelPlaying') {
        for (let i = enemies.length - 1; i >= 0; i--) {
            const enemy = enemies[i];

            // Ensure enemy horizontal movement matches pipe/game speed
            enemy.speed = PIPE_CONFIG.baseSpeed * gameSpeed;

            enemy.update();
            if (checkEnemyCollision(enemy, player.getCollisionRect())) {
                endGame();
                return;
            }
            if (enemy.isDone()) enemies.splice(i, 1);
        }
    }

    if (gameState === 'playing') { // Random mode
        if (managePipes(pipes, frameCount, gameSpeed, RENDER_WIDTH, RENDER_HEIGHT, player, () => {
            // previously: score++;
            // Score is now accumulated from gameSpeed each frame, so no-op here.
        }, pipeAssets, false)) { // false for isLevelMode
            endGame(); 
            return;
        }
    } else if (gameState === 'levelPlaying') { // Level mode
        levelFrameCount++;
        // Spawn objects based on level data
        if (currentLevel && nextLevelEventIndex < currentLevel.data.length) {
            const nextEvent = currentLevel.data[nextLevelEventIndex];
            if (levelFrameCount >= nextEvent.time) {
                if (nextEvent.type === 'pipe') {
                    const yPos = nextEvent.y !== undefined ? nextEvent.y : null; // null will use Pipe's default random y
                    pipes.push(new Pipe(RENDER_WIDTH, RENDER_HEIGHT, pipeAssets, yPos));
                }
                nextLevelEventIndex++;
            }
        }

        // Update existing pipes and portals (movement, collision)
        // ManagePipes/Portals will handle movement and collision, but not spawning for level mode
        if (managePipes(pipes, frameCount, gameSpeed, RENDER_WIDTH, RENDER_HEIGHT, player, () => {
            // previously: score++; // removed: scoring now derives from gameSpeed per-frame
        }, pipeAssets, true)) { // true for isLevelMode
            endGame();
            return;
        }

        // Check for level completion
        if (currentLevel && nextLevelEventIndex >= currentLevel.data.length && pipes.length === 0) {
            endLevel();
            return;
        }
    }

    // Accumulate score based on horizontal game speed while the game is actively playing.
    if (gameState === 'playing' || gameState === 'levelPlaying') {
        // Only add when the game has actually started (baseGameSpeed > 0)
        if (gameSpeed > 0) {
            // Slower scoring: add a reduced amount and only every 3 frames to slow rate.
            if (frameCount % 3 === 0) {
                score += gameSpeed * 0.7;
            }
        }
    }

    UI.updateScoreDisplay(Math.floor(score));
}


function drawBackground() {
    const currentCtx = renderCtx; // Draw to the off-screen canvas
    
    const source = (backgroundVideo && backgroundVideo.readyState >= 2) ? backgroundVideo : (assets.backgroundImage && assets.backgroundImage.complete ? assets.backgroundImage : null);

    if (source) {
        const sourceWidth = source.videoWidth || source.width;
        const sourceHeight = source.videoHeight || source.height;
        const canvasWidth = RENDER_WIDTH; // Use render canvas dimensions
        const canvasHeight = RENDER_HEIGHT;

        const sourceAspectRatio = sourceWidth / sourceHeight;
        const canvasAspectRatio = canvasWidth / canvasHeight;

        let renderWidth, renderHeight, sX, sY, sWidth, sHeight;

        if (sourceAspectRatio > canvasAspectRatio) {
            // Source is wider than canvas: 'cover' by matching height and cropping width.
            renderHeight = canvasHeight;
            renderWidth = renderHeight * sourceAspectRatio;
            sHeight = sourceHeight;
            sWidth = sHeight * canvasAspectRatio;
            sX = (sourceWidth - sWidth) / 2;
            sY = 0;
        } else {
            // Source is taller or same aspect: 'cover' by matching width and cropping height.
            renderWidth = canvasWidth;
            renderHeight = renderWidth / sourceAspectRatio;
            sWidth = sourceWidth;
            sHeight = sWidth / canvasAspectRatio;
            sX = 0;
            sY = (sourceHeight - sHeight) / 2;
        }

        // Draw the background twice for seamless scrolling
        currentCtx.drawImage(source, sX, sY, sWidth, sHeight, bgX, 0, canvasWidth, canvasHeight);
        currentCtx.drawImage(source, sX, sY, sWidth, sHeight, bgX + canvasWidth, 0, canvasWidth, canvasHeight);
    } else {
        // Fallback to solid color if no background is available at all
        currentCtx.fillStyle = isEpicMode && (gameState === 'playing' || gameState === 'levelPlaying') ? 'darkblue' : '#ffffffff'; 
        currentCtx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
    }

    // Removed blue-to-green gradient overlay effect
    // const gradient = currentCtx.createLinearGradient(0, 0, 0, RENDER_HEIGHT);
    // gradient.addColorStop(0, 'rgba(0, 0, 255, 0.25)');
    // gradient.addColorStop(1, 'rgba(0, 255, 0, 0.25)');
    // currentCtx.fillStyle = gradient;
    // currentCtx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);

    if (isEpicMode && (gameState === 'playing' || gameState === 'levelPlaying')) { 
        currentCtx.fillStyle = EPIC_BACKGROUND_COLOR;
        currentCtx.fillRect(0, 0, RENDER_WIDTH, RENDER_HEIGHT);
    }
}

function drawSlingshot(ctx) {
    const { x, y, bandColor, bandWidth, postWidth, postHeight, postColor } = SLINGSHOT_CONFIG;

    // Draw posts
    ctx.fillStyle = postColor;
    ctx.fillRect(x - postWidth / 2, y - postHeight, postWidth, postHeight);
    ctx.fillRect(x - postWidth / 2, y, postWidth, postHeight);

    // Draw bands
    ctx.strokeStyle = bandColor;
    ctx.lineWidth = bandWidth;
    ctx.beginPath();
    ctx.moveTo(x, y - postHeight / 2);
    ctx.lineTo(player.x - player.width / 4, player.y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y + postHeight / 2);
    ctx.lineTo(player.x - player.width / 4, player.y);
    ctx.stroke();
}


let fatalError = false; // new flag to indicate unrecoverable error
let lastAnimationFrameHandle = null; // store requestAnimationFrame handle so we can cancel

// Keep original console.error so we can forward messages
const __originalConsoleError = console.error.bind(console);

/**
 * If an asset loading related error is logged to console.error, surface it
 * in the fatal overlay so the player sees the message (mirrors DevTools).
 * We look for common phrases produced by our own load handlers and browser
 * network/image errors. This is best-effort and will still call through to
 * the original console.error.
 */
function consoleErrorHandler(...args) {
    try {
        __originalConsoleError(...args);
        const joined = args.map(a => (typeof a === 'string' ? a : (a && a.message) ? a.message : String(a))).join(' ');
        // heuristics for asset failures
        const triggers = [
            'Failed to load image',
            'Failed to load critical asset',
            'Video loading error',
            '404',
            'NetworkError',
            'Failed to fetch',
            'decodeAudioData',
            'error loading sound',
            'Failed to load sound',
            'Failed to load'
        ];
        const lowered = joined.toLowerCase();
        for (const t of triggers) {
            if (lowered.includes(t.toLowerCase())) {
                // surface the error overlay with the raw console message
                showFatalErrorOverlay(joined);
                break;
            }
        }
    } catch (e) {
        // If our wrapper throws, at least call original
        try { __originalConsoleError('Error in consoleErrorHandler', e); } catch(_) {}
    }
}

// patch console.error
console.error = consoleErrorHandler;

function showFatalErrorOverlay(message) {
    try {
        // Stop audio and any ongoing music
        Audio.stopAllMusic();
    } catch (e) { /* ignore */ }

    // Stop multiplayer if present
    try {
        if (room && room.clientId && typeof room.initialize === 'function') {
            // best-effort: don't throw if not supported
            room = null;
            window.room = null;
        }
    } catch (e) {}

    // Set fatal flag so game loop won't continue
    fatalError = true;

    // Remove input handlers by replacing with no-op listeners
    document.body.style.pointerEvents = 'none';
    // But allow interactions with the overlay
    const overlay = document.getElementById('fatalErrorOverlay');
    const fatalImage = document.getElementById('fatalErrorImage');
    const fatalText = document.getElementById('fatalErrorText');
    if (overlay && fatalText) {
        fatalText.textContent = String(message || 'Unknown error (see console).');
        // Ensure overlay captures pointer events
        overlay.style.display = 'flex';
        // Allow pointer events on overlay so user can see content (but game inputs are disabled)
        overlay.style.pointerEvents = 'all';
        // show image if it failed to load previously
        if (fatalImage && !fatalImage.complete) {
            fatalImage.src = '/R_FALL.png';
        }
    }
    // Stop the animation frame loop
    if (lastAnimationFrameHandle) {
        cancelAnimationFrame(lastAnimationFrameHandle);
        lastAnimationFrameHandle = null;
    }
}

// Global unhandled error handler: show overlay with the error text and stop everything.
window.addEventListener('error', (evt) => {
    try {
        const message = evt && (evt.message || (evt.error && evt.error.toString())) || String(evt);
        __originalConsoleError('Captured fatal error:', message);
        showFatalErrorOverlay(message);
    } catch (e) {
        // If overlay code fails, at least log to console
        __originalConsoleError('Error while handling fatal error:', e);
    }
});

// Handle unhandled promise rejections similarly
window.addEventListener('unhandledrejection', (evt) => {
    try {
        const reason = evt && (evt.reason && (evt.reason.message || evt.reason.toString())) || String(evt);
        __originalConsoleError('Captured unhandledrejection:', reason);
        showFatalErrorOverlay(`Unhandled Rejection: ${reason}`);
    } catch (e) {
        __originalConsoleError('Error while handling unhandledrejection:', e);
    }
});

function gameLoop() {
    if (fatalError) {
        // If fatal error flagged, draw nothing else and bail out (overlay is shown by handler)
        return;
    }

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
    
    lastAnimationFrameHandle = requestAnimationFrame(gameLoop); 
}

function goToMainMenu() { 
    Audio.stopAllMusic(); 
    enterStartScreenState(); 
}

export async function initGame() {
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');
    backgroundVideo = document.getElementById('backgroundVideo');

    // Setup the off-screen canvas for low-res rendering
    renderCanvas = document.createElement('canvas');
    renderCanvas.width = RENDER_WIDTH;
    renderCanvas.height = RENDER_HEIGHT;
    renderCtx = renderCanvas.getContext('2d');

    window.addEventListener('resize', resizeGame);
    resizeGame(); // Initial size calculation

    // Mute and pause the video by default. We control it manually.
    backgroundVideo.muted = true;
    backgroundVideo.pause();

    Audio.stopAllMusic(); 

    UI.initUI({
        onStartRandomGame: startGameRandom,
        onRestartGame: () => { // Restart depends on what mode was last played
            if (currentLevel && (gameState === 'gameOver' || gameState === 'levelPlaying')) { // if game over from level or trying to restart a level
                startLevel(LEVELS.findIndex(l => l.id === currentLevel.id));
            } else {
                startGameRandom();
            }
        },
        onGoToMainMenu: goToMainMenu,
        onShowLevelSelect: enterLevelSelectState,
        // onSelectLevel will be set via populateLevelList -> startLevel
    }); 
    
    UI.showLoadingScreen(); 
    gameState = 'loading';

    loadHighScore();
    loadTutorialCompletion();

    try {
        await loadAssets(); 
        const playerAssets = {
            normalImage: assets.playerNormalImage,
            shipImage: assets.playerShipImage,
        };
        player = new Player(RENDER_HEIGHT, playerAssets); // Use render height for player logic
        player.y = RENDER_HEIGHT / 2; // Start player in the middle of new screen height
        setupInputHandlers();
        
        UI.hideLoadingScreen(); 
        enterStartScreenState(); 

    } catch (error) {
        console.error("Failed to load critical assets. Game may not run correctly.", error);
        UI.hideLoadingScreen(); 
        const startScreenElem = document.getElementById('startScreen');
        if (startScreenElem) {
            let errorMsg = startScreenElem.querySelector('.error-message');
            if (!errorMsg) {
                errorMsg = document.createElement('p');
                errorMsg.className = 'error-message';
                errorMsg.style.color = 'red';
                startScreenElem.appendChild(errorMsg); // Append to start screen itself
            }
            errorMsg.textContent = "Error loading game assets. Please refresh.";
        }
         enterStartScreenState(); // Show start screen even with error
        return; 
    }
    
    if (!gameLoopRunning) { 
        gameLoop();
        gameLoopRunning = true;
    }
}

async function initMultiplayer() {
    if (typeof WebsimSocket === 'undefined') return;
    try {
        room = new WebsimSocket();
        await room.initialize();

        // expose room globally for debugging / UI access
        window.room = room;

        // Keep local caches of presence & peers details
        peersPresence = { ...room.presence };
        peersInfo = { ...room.peers };

        // Update UI with initial list
        try { UI.updateMultiplayerList(peersPresence, peersInfo); } catch(e){}

        // Subscribe to presence updates to keep up-to-date
        room.subscribePresence((currentPresence) => {
            peersPresence = { ...currentPresence };
            try { UI.updateMultiplayerList(peersPresence, peersInfo); } catch(e){}
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
            try { UI.updateMultiplayerList(peersPresence, peersInfo); } catch(e){}
        });

        console.log("Multiplayer initialized, client id:", room.clientId);
    } catch (err) {
        console.warn("Multiplayer not available:", err);
        room = null;
        window.room = null;
    }
}

// Add missing multiplayer helper functions so gameLoop can call them safely.
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

function drawRemotePlayers(ctx) {
    if (!room) return;
    const clientId = room.clientId;
    const cameraX = RENDER_WIDTH / 2;
    Object.keys(peersPresence).forEach(id => {
        if (id === clientId) return;
        const p = peersPresence[id];
        if (!p) return;
        const drawX = cameraX;
        const drawY = (typeof p.y === 'number') ? p.y : RENDER_HEIGHT / 2;
        const avatar = avatarImages[id];
        const size = 28;
        if (avatar && avatar.complete && avatar.naturalWidth > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatar, drawX - size / 2, drawY - size / 2, size, size);
            ctx.restore();
            ctx.strokeStyle = 'rgba(0,0,0,0.6)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
            ctx.stroke();
        } else {
            ctx.save();
            ctx.fillStyle = '#ffcc66';
            ctx.beginPath();
            ctx.arc(drawX, drawY, 14, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#222';
            ctx.font = '12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            let initial = '?';
            if (peersInfo[id] && peersInfo[id].username) initial = peersInfo[id].username.charAt(0).toUpperCase();
            ctx.fillText(initial, drawX, drawY);
            ctx.restore();
        }
    });
}