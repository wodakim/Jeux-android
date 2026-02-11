import { GameData } from './utils.js';
import { audioController } from './audio.js';

export const UI = {
    buttons: [],
    sliders: [],
    heldButton: null,
    holdTimer: 0,

    // --- UTILS ---
    drawPanel(ctx, x, y, w, h, color = '#222', title = null) {
        // Base Panel
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.8;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1.0;

        // Border (Cyberpunk style)
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#444';
        ctx.strokeRect(x, y, w, h);

        // Corner Accents
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 3;
        const cornerSize = 10;

        // TL
        ctx.beginPath(); ctx.moveTo(x, y + cornerSize); ctx.lineTo(x, y); ctx.lineTo(x + cornerSize, y); ctx.stroke();
        // TR
        ctx.beginPath(); ctx.moveTo(x + w - cornerSize, y); ctx.lineTo(x + w, y); ctx.lineTo(x + w, y + cornerSize); ctx.stroke();
        // BL
        ctx.beginPath(); ctx.moveTo(x, y + h - cornerSize); ctx.lineTo(x, y + h); ctx.lineTo(x + cornerSize, y + h); ctx.stroke();
        // BR
        ctx.beginPath(); ctx.moveTo(x + w - cornerSize, y + h); ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y + h - cornerSize); ctx.stroke();

        // Title
        if (title) {
            ctx.fillStyle = '#0ff';
            ctx.font = '24px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            // Background for title
            const textW = ctx.measureText(title).width + 20;
            ctx.fillStyle = '#000';
            ctx.fillRect(x + w/2 - textW/2, y - 12, textW, 24);
            ctx.strokeRect(x + w/2 - textW/2, y - 12, textW, 24);

            ctx.fillStyle = '#0ff';
            ctx.fillText(title, x + w/2, y + 8);
        }
    },

    drawButton(ctx, text, x, y, w, h, color, action, type = 'normal') {
        // Button Styles
        const isHover = false; // We can detect hover if we tracked pointer pos globally, but simple visual style first.

        // Base Fill
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.9;
        ctx.fillRect(x, y, w, h);
        ctx.globalAlpha = 1.0;

        // Border
        ctx.lineWidth = 2;
        ctx.strokeStyle = (type === 'primary') ? '#fff' : '#888';
        ctx.strokeRect(x, y, w, h);

        // Inner Highlight
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.fillRect(x, y, w, h/2);

        // Text
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 20px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Text Shadow
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 4;
        ctx.fillText(text, x + w/2, y + h/2);
        ctx.shadowBlur = 0;

        // Register Interaction
        this.buttons.push({ x, y, w, h, action });
    },

    drawSlider(ctx, label, value, x, y, w, h, onChange) {
        // Label
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`${label}: ${Math.round(value*100)}%`, x, y - 10);

        // Track
        ctx.fillStyle = '#222';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#555';
        ctx.strokeRect(x, y, w, h);

        // Fill
        const fillW = Math.max(0, Math.min(w, w * value));
        const gradient = ctx.createLinearGradient(x, y, x + w, y);
        gradient.addColorStop(0, '#0a0');
        gradient.addColorStop(1, '#0f0');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, fillW, h);

        // Handle/Thumb (Visual only)
        ctx.fillStyle = '#fff';
        ctx.fillRect(x + fillW - 5, y - 5, 10, h + 10);

        this.sliders.push({ x, y, w, h, onChange });
    },

    drawSelector(ctx, label, options, currentValue, x, y, w, h, onChange) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = '20px monospace';
        ctx.fillText(label, x, y - 10);

        const optW = w / options.length;
        options.forEach((opt, i) => {
            const optX = x + (i * optW);
            const isSelected = opt === currentValue;

            // Box
            ctx.fillStyle = isSelected ? '#0a0' : '#222';
            ctx.fillRect(optX, y, optW, h);
            ctx.strokeStyle = isSelected ? '#fff' : '#555';
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(optX, y, optW, h);

            // Text
            ctx.fillStyle = isSelected ? '#fff' : '#888';
            ctx.textAlign = 'center';
            ctx.font = isSelected ? 'bold 18px monospace' : '18px monospace';
            ctx.fillText(opt, optX + optW/2, y + h/2);

            this.buttons.push({ x: optX, y, w: optW, h, action: () => onChange(opt) });
        });
    },

    drawToggle(ctx, label, value, x, y, w, h, onToggle) {
        this.drawSelector(ctx, label, ['OFF', 'ON'], value ? 'ON' : 'OFF', x, y, w, h, (val) => onToggle(val === 'ON'));
    },

    registerArea(x, y, w, h, action) {
        this.buttons.push({ x, y, w, h, action });
    },

    handleInput(input) {
        // Handle Taps (Single Click)
        for (const btn of this.buttons) {
            if (input.checkTap(btn)) {
                audioController.playPing();
                btn.action();
            }
        }

        // Handle Long Press (Auto-Buy)
        if (input.pointerDown) {
            let activeBtn = null;
            for (const btn of this.buttons) {
                if (input.pointerX >= btn.x && input.pointerX <= btn.x + btn.w &&
                    input.pointerY >= btn.y && input.pointerY <= btn.y + btn.h) {
                    activeBtn = btn;
                    break;
                }
            }

            if (activeBtn) {
                if (this.heldButton === activeBtn) {
                    this.holdTimer += 0.016; // Approx 60fps frame time
                    if (this.holdTimer > 0.5) { // 500ms delay before auto-buy starts
                        if (Math.floor(this.holdTimer * 10) % 2 === 0) { // Trigger every few frames
                             // Rate limit: 5 times per second
                             audioController.playPing();
                             activeBtn.action();
                             this.holdTimer += 0.1; // Skip ahead to regulate speed
                        }
                    }
                } else {
                    this.heldButton = activeBtn;
                    this.holdTimer = 0;
                }
            } else {
                this.heldButton = null;
                this.holdTimer = 0;
            }
        } else {
            this.heldButton = null;
            this.holdTimer = 0;
        }

        for (const sld of this.sliders) {
            const touches = input.taps;
            for (const t of touches) {
                if (t.x >= sld.x && t.x <= sld.x + sld.w && t.y >= sld.y && t.y <= sld.y + sld.h) {
                    const val = Math.max(0, Math.min(1, (t.x - sld.x) / sld.w));
                    sld.onChange(val);
                }
            }
        }
        this.buttons = [];
        this.sliders = [];
    }
};
