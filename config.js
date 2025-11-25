export const GAME_WIDTH = 360;
export const GAME_HEIGHT = 540;

export const PLAYER_CONFIG = {
    initialX: 80,
    initialY: 270, // This is now just a fallback, game logic will center it.
    width: 45, // Base width, adjusted for SMG3
    height: 60, // Base height, adjusted for SMG3
    gravity: 0.3,
    jumpStrength: -6.5,
    thrustStrength: -0.6, 
    normalImageSrc: '/smg3_render__by_hugoofficiazd_dfsr6tw-pre.png',
    shipImageSrc: '/player_ship.png',
    miniSizeMultiplier: 0.6, 
};

export const PIPE_CONFIG = {
    width: 70,
    gap: 200,
    baseSpeed: 2,
    spawnInterval: 100, // frames
    topImageSrc: "/IMG_0357.png", 
    bottomImageSrc: "/IMG_0357.png", 
    imageHeight: 300, 
};

export const BACKGROUND_CONFIG = {
    imageSrc: '', // removed '/SunlessFT.jpeg' to force a blank/solid background
    baseSpeed: 0.5,
};

export const SLINGSHOT_CONFIG = {
    x: 60,
    y: 135, // Moved up to be in the sky area
    bandColor: 'rgba(45, 24, 6, 0.8)',
    bandWidth: 5,
    postWidth: 15,
    postHeight: 30,
    postColor: '#5C3317',
    maxStretch: 80,
    launchPower: 0.15
};

export const SOUND_ASSETS = {
    flap: '/flap_sound.mp3',
    score: '/score_sound.mp3',
    hit: '/hit_sound.mp3',
    background_music: '/background_music.mp3',
    speed_music: '/SpotiDownloader.com - Kill the Spider - Aiert Erkoreka.mp3',
    epic_music: '/TheoryOfEverything2 (1).mp3',
    main_menu_music: '/main_menu_music.mp3',
    level_complete: '/score_sound.mp3', // Placeholder, ideally a distinct sound
    new_high_score: '/24 Stage Clear.mp3',
    game_over: '/28 Game Over.mp3'
};

export const IMAGE_ASSETS_LIST = [
    PLAYER_CONFIG.normalImageSrc,
    PLAYER_CONFIG.shipImageSrc,
    PIPE_CONFIG.topImageSrc,
    PIPE_CONFIG.bottomImageSrc.trim(), 
    BACKGROUND_CONFIG.imageSrc,
    '/R_STAND.png',
    '/R_FALL.png'
].filter(src => src && src.trim() !== ''); 

export const TUTORIAL_COMPLETED_KEY = 'flappyPiggyTutorialCompleted_v1'; 
export const EPIC_SCORE_THRESHOLD = 30;
export const EPIC_BACKGROUND_COLOR = 'rgba(0, 0, 50, 0.4)';
export const EPIC_MUSIC_KEY = 'epic_music';
export const MAIN_MENU_MUSIC_KEY = 'main_menu_music'; 

export const LEVELS = [
    {
        name: "Level 1: The Basics",
        id: "level_1",
        data: [
            { time: 60, type: 'pipe' }, // y will be random based on pipe constructor default
            { time: 130, type: 'pipe', y: 270 - PIPE_CONFIG.gap / 2 + 30},
            { time: 260, type: 'pipe', y: 270 - PIPE_CONFIG.gap / 2 - 30 },
            { time: 330, type: 'pipe' },
            { time: 400, type: 'pipe' },
        ]
    },
    {
        name: "Level 2: Gravity Fun",
        id: "level_2",
        data: [
            { time: 100, type: 'pipe', y: 40 }, 
            
            { time: 240, type: 'pipe', y: 180 },
            
            { time: 380, type: 'pipe', y: 50 },
            
            { time: 520, type: 'pipe', y: 150 },
    
            { time: 660, type: 'pipe', y: 35 },
        ]
    }
];

export const ENEMY_CONFIG = {
    width: 46,
    height: 46,
    idleDurationFrames: 90,
    punchSpeed: 6, // pixels per frame
    spawnIntervalFrames: 450, // random mode spawn cadence
    standImageSrc: '/R_STAND.png',
    punchImageSrc: '/R_FALL.png'
};