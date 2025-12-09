// Simple sound manager for game effects
const SOUNDS = {
    move: "https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3", // Soft wood click
    capture: "https://assets.mixkit.co/active_storage/sfx/2072/2072-preview.mp3", // Capture/Hit
    start: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", // Game start
    win: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3", // Success/Win
    loss: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Fail/Loss
    notify: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3", // Notification bell
    check: "https://assets.mixkit.co/active_storage/sfx/2452/2452-preview.mp3", // Tension/Check
    castle: "https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3" // Slide sound
};

class SoundManager {
    constructor() {
        this.enabled = true;
        if (typeof window !== 'undefined') {
            this.enabled = localStorage.getItem('soundEnabled') !== 'false';
        }
        this.audioCache = {};
        
        // Preload removed to prevent Illegal Constructor errors in some environments
        // Sounds will be lazy-loaded in play()
    }

    toggle() {
        this.enabled = !this.enabled;
        if (typeof window !== 'undefined') {
            localStorage.setItem('soundEnabled', this.enabled);
        }
        return this.enabled;
    }

    isEnabled() {
        return this.enabled;
    }

    play(name) {
        if (!this.enabled || !SOUNDS[name]) return;

        // Granular control check
        if (typeof window !== 'undefined') {
            // Check Base44 user preferences if cached/available
            // We can't access Base44 auth synchronously easily here if it's a plain class
            // But we can check a local storage cache of preferences or rely on the caller to check
            
            // However, to keep it simple and robust:
            // The SoundManager.enabled toggles ALL sound.
            // But granular preferences might exist. 
            // We can rely on the calling code to check granular prefs?
            // Or we can try to read from localStorage if we sync granular prefs there too.
            // Let's assume we might store 'sound_move', 'sound_capture' in localStorage too for quick access?
            // Or just check if we have a user object attached to window or something? No.
            
            // For now, respect the global enabled.
        }
        
        try {
            if (typeof Audio === 'undefined') return;
            const audio = this.audioCache[name] || new Audio(SOUNDS[name]);
            this.audioCache[name] = audio; // Cache it for next time
            audio.volume = 0.5;
            audio.currentTime = 0;
            audio.play().catch(e => {
                console.debug("Sound play failed", e);
            });
        } catch (e) {
            console.error("Audio error", e);
        }
    }
}

// Lazy singleton to avoid instantiation issues
let instance;
const getInstance = () => {
    if (!instance) instance = new SoundManager();
    return instance;
};

export const soundManager = {
    play: (name) => getInstance().play(name),
    toggle: () => getInstance().toggle(),
    isEnabled: () => getInstance().isEnabled()
};

export const calculateElo = (ratingA, ratingB, actualScore, kFactor = 32) => {
    const expectedScore = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
    return Math.round(ratingA + kFactor * (actualScore - expectedScore));
};