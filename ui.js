import { gsap } from 'gsap';

let scoreDisplayElem, finalScoreDisplayElem, startScreenElem, gameOverScreenElem;
let startButtonElem, restartButtonElem, mainMenuButtonElem;
let highScoreStartDisplayElem, highScoreGameOverDisplayElem, newHighScoreMessageElem;
let loadingScreenElem;
let levelSelectScreenElem, levelListContainerElem, backToMainMenuButtonElem, playLevelsButtonElem;
let levelNameDisplayElem;
let tutorialScreenElem, tutorialTextElem, skipTutorialButtonElem, nextTutorialStepButtonElem, startTutorialGameButtonElem;
let boostMeterElem, boostBarElem, boostValueElem;
let boostCircleRadius = 0;

// Multiplayer UI
let multiplayerPanelElem, multiplayerListElem;


function setupButtonListeners(element, callback) {
    if (!element) return;
    element.addEventListener('click', callback);
    element.addEventListener('touchend', (e) => {
        e.preventDefault(); // Prevent firing click event as well
        callback(e);
    });
}


export function initUI(callbacks) { // Consolidated callbacks into an object
    scoreDisplayElem = document.getElementById('scoreDisplay');
    finalScoreDisplayElem = document.getElementById('finalScore');
    startScreenElem = document.getElementById('startScreen');
    gameOverScreenElem = document.getElementById('gameOverScreen');
    levelNameDisplayElem = document.getElementById('levelNameDisplay');
    
    startButtonElem = document.getElementById('startButton'); // For random game
    restartButtonElem = document.getElementById('restartButton');
    mainMenuButtonElem = document.getElementById('mainMenuButton');

    highScoreStartDisplayElem = document.getElementById('highScoreStartDisplay');
    highScoreGameOverDisplayElem = document.getElementById('highScoreGameOverDisplay');
    newHighScoreMessageElem = document.getElementById('newHighScoreMessage');

    loadingScreenElem = document.getElementById('loadingScreen');

    levelSelectScreenElem = document.getElementById('levelSelectScreen');
    levelListContainerElem = document.getElementById('levelListContainer');
    backToMainMenuButtonElem = document.getElementById('backToMainMenuButton');
    playLevelsButtonElem = document.getElementById('playLevelsButton');

    // Tutorial UI Elements
    tutorialScreenElem = document.getElementById('tutorialScreen');
    tutorialTextElem = document.getElementById('tutorialText');
    skipTutorialButtonElem = document.getElementById('skipTutorialButton');
    nextTutorialStepButtonElem = document.getElementById('nextTutorialStepButton');
    startTutorialGameButtonElem = document.getElementById('startTutorialGameButton');

    // Boost UI
    boostMeterElem = document.getElementById('boostMeter');
    boostBarElem = document.querySelector('.boost-bar');
    boostValueElem = document.getElementById('boostValue');
    if (boostBarElem) {
        boostCircleRadius = boostBarElem.r.baseVal.value;
    }

    // Multiplayer UI elements
    multiplayerPanelElem = document.getElementById('multiplayerPanel');
    multiplayerListElem = document.getElementById('multiplayerList');

    setupButtonListeners(startButtonElem, callbacks.onStartRandomGame);
    setupButtonListeners(restartButtonElem, callbacks.onRestartGame);
    setupButtonListeners(mainMenuButtonElem, callbacks.onGoToMainMenu);
    
    setupButtonListeners(playLevelsButtonElem, callbacks.onShowLevelSelect);
    setupButtonListeners(backToMainMenuButtonElem, callbacks.onGoToMainMenu);
    
    // Tutorial Button Listeners
    setupButtonListeners(skipTutorialButtonElem, callbacks.onSkipTutorial);
    setupButtonListeners(nextTutorialStepButtonElem, callbacks.onNextTutorialStep);
    setupButtonListeners(startTutorialGameButtonElem, callbacks.onStartTutorialGame);

    // Initial state
    hideGameHUD();
    hideGameOverScreen();
    hideLevelSelectScreen();
    hideTutorialScreen();
    // Loading screen is shown by default via CSS, will be hidden by game.js when ready
}

export function populateLevelList(levels, onSelectLevel) {
    if (!levelListContainerElem) return;
    levelListContainerElem.innerHTML = ''; // Clear existing
    levels.forEach((level, index) => {
        const button = document.createElement('button');
        button.classList.add('level-button');
        button.textContent = level.name;
        // The level buttons are dynamically created, so we add listeners here.
        setupButtonListeners(button, () => onSelectLevel(index));
        levelListContainerElem.appendChild(button);
    });
}


export function showLoadingScreen() {
    if (loadingScreenElem) loadingScreenElem.style.display = 'flex';
}

export function hideLoadingScreen() {
    if (loadingScreenElem) loadingScreenElem.style.display = 'none';
}

export function updateScoreDisplay(score) {
    if (scoreDisplayElem) scoreDisplayElem.textContent = `Score: ${score}`;
}

export function updateBoostDisplay(currentFuel, maxFuel, isBoosting) {
    if (!boostMeterElem || !boostBarElem || !boostValueElem) return;

    boostValueElem.textContent = Math.floor(currentFuel);

    const circumference = 2 * Math.PI * boostCircleRadius;
    const offset = circumference - (currentFuel / maxFuel) * circumference;
    boostBarElem.style.strokeDasharray = `${circumference} ${circumference}`;
    boostBarElem.style.strokeDashoffset = offset;

    if (isBoosting) {
        boostMeterElem.classList.add('boosting');
    } else {
        boostMeterElem.classList.remove('boosting');
    }
}

export function updateSpeedMultiplierDisplay(multiplier) {
    // This function is kept for compatibility but does nothing as the display is removed.
}

export function updateLevelNameDisplay(name) {
    if (levelNameDisplayElem) {
        if (name) {
            levelNameDisplayElem.textContent = name;
            levelNameDisplayElem.style.display = 'block';
        } else {
            levelNameDisplayElem.style.display = 'none';
        }
    }
}

export function updateHighScoreDisplay(highScore) {
    // If the special 100-high-score message is desired, show the phrase instead of just the number
    const startTextElem = highScoreStartDisplayElem;
    const gameOverTextElem = highScoreGameOverDisplayElem;

    if (startTextElem) {
        if (highScore === 100) {
            startTextElem.textContent = `You got 100 high scores`;
        } else {
            startTextElem.textContent = `High Score: ${highScore}`;
        }
    }

    if (gameOverTextElem) {
        if (highScore === 100) {
            gameOverTextElem.textContent = `You got 100 high scores`;
        } else {
            gameOverTextElem.textContent = `High Score: ${highScore}`;
        }
    }
}

export function updateMultiplayerList(peersPresence = {}, peersInfo = {}) {
    if (!multiplayerListElem) return;
    multiplayerListElem.innerHTML = '';
    const ids = Object.keys(peersPresence);
    if (ids.length === 0) {
        const el = document.createElement('div');
        el.className = 'multiplayer-entry';
        el.textContent = 'No players';
        multiplayerListElem.appendChild(el);
        return;
    }
    ids.forEach(id => {
        const p = peersPresence[id] || {};
        const info = peersInfo[id] || {};
        const entry = document.createElement('div');
        entry.className = 'multiplayer-entry';

        const img = document.createElement('img');
        img.src = info.avatarUrl || '/avatars-000829551670-zct489-t240x240-removebg-preview (1).png';
        img.alt = info.username || 'P';
        entry.appendChild(img);

        const name = document.createElement('div');
        name.className = 'mp-name';
        name.textContent = info.username ? info.username : (id === (window.room && window.room.clientId) ? 'You' : `Player ${id.slice(0,4)}`);
        entry.appendChild(name);

        const score = document.createElement('div');
        score.className = 'mp-score';
        score.textContent = (typeof p.score === 'number') ? p.score : '';
        entry.appendChild(score);

        multiplayerListElem.appendChild(entry);
    });
}

export function showStartScreen(highScore) {
    if (startScreenElem) {
        startScreenElem.style.display = 'flex';
        updateHighScoreDisplay(highScore);
    }
    hideLevelSelectScreen();
    hideGameOverScreen();
    hideGameHUD();
    hideTutorialScreen();
}

export function hideStartScreen() {
    if (startScreenElem) startScreenElem.style.display = 'none';
}

export function showLevelSelectScreen() {
    if (levelSelectScreenElem) levelSelectScreenElem.style.display = 'flex';
    hideStartScreen();
    hideGameOverScreen();
    hideGameHUD();
    hideTutorialScreen();
}

export function hideLevelSelectScreen() {
    if (levelSelectScreenElem) levelSelectScreenElem.style.display = 'none';
}

export function showGameOverScreen(score, highScore, isNewHighScore) {
    if (gameOverScreenElem) {
        gameOverScreenElem.style.display = 'flex';
        if (finalScoreDisplayElem) finalScoreDisplayElem.textContent = score;
        updateHighScoreDisplay(highScore);

        if (newHighScoreMessageElem) {
            newHighScoreMessageElem.style.display = isNewHighScore ? 'block' : 'none';
            if (isNewHighScore) {
                gsap.fromTo(newHighScoreMessageElem,
                    { scale: 0.5, opacity: 0, y: 20 },
                    { scale: 1, opacity: 1, y: 0, duration: 0.6, ease: "elastic.out(1, 0.6)", delay: 0.5 }
                );
            }
        }

        gsap.fromTo(gameOverScreenElem.querySelector('h2'),
            { scale: 0.5, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.5, ease: "elastic.out(1, 0.5)" }
        );
        gsap.fromTo(gameOverScreenElem.querySelector('#sadPigImage'),
            { y: -30, opacity: 0 },
            { y: 0, opacity: 1, duration: 0.5, delay: 0.2, ease: "bounce.out" }
        );
    }
    hideLevelSelectScreen();
    updateLevelNameDisplay(null); // Hide level name on game over
}

export function hideGameOverScreen() {
    if (gameOverScreenElem) {
        gameOverScreenElem.style.display = 'none';
        if (newHighScoreMessageElem) newHighScoreMessageElem.style.display = 'none'; 
    }
}

export function showGameHUD() {
    if (scoreDisplayElem) scoreDisplayElem.style.display = 'block';
    // Level name display is handled by updateLevelNameDisplay
    if (boostMeterElem) boostMeterElem.style.display = 'block';
}

export function hideGameHUD() {
    if (scoreDisplayElem) scoreDisplayElem.style.display = 'none';
    if (levelNameDisplayElem) levelNameDisplayElem.style.display = 'none';
    if (boostMeterElem) boostMeterElem.style.display = 'none';
}

export function showTutorialScreen() {
    if (tutorialScreenElem) tutorialScreenElem.style.display = 'flex';
    hideStartScreen();
    hideGameOverScreen();
    hideGameHUD();
    hideLevelSelectScreen();
}

export function hideTutorialScreen() {
    if (tutorialScreenElem) tutorialScreenElem.style.display = 'none';
}

export function updateTutorialText(text, showNext, showStart) {
    if (tutorialTextElem) tutorialTextElem.textContent = text;
    if (nextTutorialStepButtonElem) nextTutorialStepButtonElem.style.display = showNext ? 'inline-block' : 'none';
    if (startTutorialGameButtonElem) startTutorialGameButtonElem.style.display = showStart ? 'inline-block' : 'none';
}