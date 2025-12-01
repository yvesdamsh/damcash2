// Simple sound manager for game effects
const SOUNDS = {
    move: "https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3", // Soft wood click
    capture: "https://assets.mixkit.co/active_storage/sfx/2072/2072-preview.mp3", // Capture/Hit
    start: "https://assets.mixkit.co/active_storage/sfx/1435/1435-preview.mp3", // Game start
    win: "https://assets.mixkit.co/active_storage/sfx/2019/2019-preview.mp3", // Success/Win
    loss: "https://assets.mixkit.co/active_storage/sfx/2018/2018-preview.mp3", // Fail/Loss
    notify: "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3" // Notification bell
};

class SoundManager {
    constructor() {
        this.enabled = true;
        if (typeof window !== 'undefined') {
            this.enabled = localStorage.getItem('soundEnabled') !== 'false';
        }
        this.audioCache = {};
        
        // Preload sounds
        if (typeof window !== 'undefined') {
            Object.keys(SOUNDS).forEach(key => {
                this.audioCache[key] = new Audio(SOUNDS[key]);
                this.audioCache[key].volume = 0.5;
            });
        }
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
        
        try {
            const audio = this.audioCache[name] || new Audio(SOUNDS[name]);
            audio.currentTime = 0;
            audio.play().catch(e => {
                // Ignore autoplay errors
                console.debug("Sound play failed", e);
            });
        } catch (e) {
            console.error("Audio error", e);
        }
    }
}

export const soundManager = new SoundManager();