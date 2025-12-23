// Simple sound manager for game effects
const SOUNDS = {
    splash: "https://cdn.jsdelivr.net/gh/JimLynchCodes/Game-Sound-Effects/Sounds/Splash_Small.wav",
    move: "https://assets.mixkit.co/active_storage/sfx/2073/2073-preview.mp3", // Soft wood click
    capture: "https://assets.mixkit.co/active_storage/sfx/2072/2072-preview.mp3", // Capture/Hit
    start: "https://cdn.jsdelivr.net/gh/JimLynchCodes/Game-Sound-Effects/Sounds/Splash_Small.wav", // Game start (CDN to avoid 403)
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
            const moveEnabled = localStorage.getItem('damcash_sound_move') !== 'false';
            const captureEnabled = localStorage.getItem('damcash_sound_capture') !== 'false';
            const notifyEnabled = localStorage.getItem('damcash_sound_notify') !== 'false';

            if (name === 'move' && !moveEnabled) return;
            if (name === 'capture' && !captureEnabled) return;
            if ((name === 'notify' || name === 'win' || name === 'loss') && !notifyEnabled) return;
        }
        
        try {
            if (typeof Audio === 'undefined') return;
            const audio = this.audioCache[name] || (() => { const a = new Audio(); try { a.crossOrigin = 'anonymous'; } catch(_) {} a.src = SOUNDS[name]; return a; })();
            this.audioCache[name] = audio; // Cache it for next time
            audio.volume = 0.5;
            audio.currentTime = 0;
            audio.play().catch(e => {
                // Autoplay blocked or format/network issue: wait for first user interaction then retry once
                const beep = () => {
                    try {
                        const Ctx = window.AudioContext || window.webkitAudioContext;
                        if (!Ctx) return;
                        const ctx = new Ctx();
                        const o = ctx.createOscillator();
                        const g = ctx.createGain();
                        o.type = 'sine';
                        o.frequency.value = 660;
                        o.connect(g); g.connect(ctx.destination);
                        const now = ctx.currentTime;
                        g.gain.setValueAtTime(0.0001, now);
                        g.gain.exponentialRampToValueAtTime(0.2, now + 0.02);
                        o.start(now);
                        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
                        o.stop(now + 0.2);
                    } catch(_) {}
                };
                const unlock = () => {
                    audio.currentTime = 0;
                    audio.play().catch(() => {
                        // If still blocked or unsupported, do a tiny WebAudio beep so the user hears feedback
                        beep();
                    });
                    window.removeEventListener('pointerdown', unlock);
                    window.removeEventListener('touchstart', unlock);
                    window.removeEventListener('click', unlock);
                    window.removeEventListener('keydown', unlock);
                    window.removeEventListener('mousedown', unlock);
                };
                // On any error (autoplay, network, unsupported), attach unlock handlers and provide a gentle fallback beep
                window.addEventListener('pointerdown', unlock, { once: true });
                window.addEventListener('touchstart', unlock, { once: true });
                window.addEventListener('click', unlock, { once: true });
                window.addEventListener('keydown', unlock, { once: true });
                window.addEventListener('mousedown', unlock, { once: true });
                // Try a short beep after a moment; if blocked it will be ignored until the next gesture triggers unlock
                setTimeout(beep, 400);
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