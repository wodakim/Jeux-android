import { GameData } from './utils.js';
import { audioController } from './audio.js';

export const UI = {
    buttons: [],
    sliders: [],
    heldButton: null,
    holdTimer: 0,

    drawButton(ctx, text, x, y, w, h, color, action) {
        ctx.fillStyle = color;
        ctx.fillRect(x, y, w, h);
        ctx.lineWidth = 2;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(text, x + w/2, y + h/2);

        this.buttons.push({ x, y, w, h, action });
    },

    drawSlider(ctx, label, value, x, y, w, h, onChange) {
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(x, y, w, h);

        ctx.fillStyle = '#0f0';
        ctx.fillRect(x, y, w * value, h);

        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`${label}: ${Math.round(value*100)}%`, x, y - 15);

        this.sliders.push({ x, y, w, h, onChange });
    },

    drawSelector(ctx, label, options, currentValue, x, y, w, h, onChange) {
        ctx.textAlign = 'left';
        ctx.fillStyle = '#fff';
        ctx.font = '24px monospace';
        ctx.fillText(label, x, y - 15);

        const optW = w / options.length;
        options.forEach((opt, i) => {
            const optX = x + (i * optW);
            const isSelected = opt === currentValue;

            ctx.fillStyle = isSelected ? '#0a0' : '#333';
            ctx.fillRect(optX, y, optW, h);
            ctx.strokeStyle = '#fff';
            ctx.strokeRect(optX, y, optW, h);

            ctx.fillStyle = isSelected ? '#fff' : '#aaa';
            ctx.textAlign = 'center';
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
