let audioContext;
const soundBuffers = {};
const activeMusicSources = {}; // To keep track of playing music sources and their gain nodes

async function loadSound(url, key) {
    if (!audioContext) return null;
    try {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers[key] = buffer;
        return buffer;
    } catch (error) {
        console.error(`Error loading sound ${key} (${url}):`, error);
        return null;
    }
}

export async function setupAudio(soundAssetPaths) {
    if (audioContext) return;
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (!audioContext) {
        console.warn("Web Audio API not supported.");
        return;
    }

    const loadPromises = [];
    for (const key in soundAssetPaths) {
        loadPromises.push(loadSound(soundAssetPaths[key], key));
    }
    await Promise.all(loadPromises);
    console.log("Audio setup complete, buffers loaded:", Object.keys(soundBuffers));
}

export function playSound(key, volume = 1.0) {
    if (!audioContext || !soundBuffers[key]) {
        // console.warn(`Sound not found or audio context not ready: ${key}`);
        return;
    }
    const source = audioContext.createBufferSource();
    source.buffer = soundBuffers[key];

    const gainNode = audioContext.createGain();
    gainNode.gain.value = volume;

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);
}

export function playMusic(key, loop = true, volume = 0.3) {
    if (!audioContext || !soundBuffers[key]) {
        console.warn(`Music track not found or audio context not ready: ${key}`);
        return;
    }

    stopMusic(key); // Stop if already playing to prevent overlap or multiple instances

    const source = audioContext.createBufferSource();
    source.buffer = soundBuffers[key];
    source.loop = loop;

    const gainNode = audioContext.createGain();
    gainNode.gain.setValueAtTime(volume, audioContext.currentTime);

    source.connect(gainNode);
    gainNode.connect(audioContext.destination);
    source.start(0);

    activeMusicSources[key] = { source, gainNode };
}

export function setMusicPlaybackRate(key, rate) {
    if (activeMusicSources[key] && activeMusicSources[key].source) {
        // Clamp rate to a reasonable range to avoid audio artifacts
        const clampedRate = Math.max(0.5, Math.min(rate, 4)); 
        activeMusicSources[key].source.playbackRate.setValueAtTime(clampedRate, audioContext.currentTime);
    }
}

export function stopMusic(key) {
    if (activeMusicSources[key]) {
        try {
            activeMusicSources[key].source.stop();
        } catch (e) {
            // Can throw if already stopped or not playing; suppress error
        }
        activeMusicSources[key].source.disconnect();
        activeMusicSources[key].gainNode.disconnect();
        delete activeMusicSources[key];
    }
}

export function stopAllMusic() {
    Object.keys(activeMusicSources).forEach(key => {
        stopMusic(key);
    });
}

export function getAudioContext() {
    return audioContext;
}