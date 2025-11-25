document.addEventListener('DOMContentLoaded', () => {
    import('./game.js').then(({ initGame }) => {
        initGame();
    }).catch(err => console.error("Failed to load game module:", err));
});