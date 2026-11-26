// input.js — keyboard and mouse state for the cockpit.
// The game reads this each frame; nothing here knows about the game itself.

import { KEYS } from './config.js';

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.pressed = new Set(); // codes held down right now
    // codes pressed since the last frame was read
    this.tappedCodes = new Set(); // codes pressed since the last frame was read
    this.mouse = { x: 0, y: 0, down: false, clicked: false, inside: false };
    this._onKeyDown = (e) => this._key(e, true);
    this._onKeyUp = (e) => this._key(e, false);
    this._onBlur = () => this.pressed.clear();
    this._onMouseMove = (e) => this._mouse(e);
    this._onMouseDown = (e) => {
      this._mouse(e);
      this.mouse.down = true;
      this.mouse.clicked = true;
    };
    this._onMouseUp = () => {
      this.mouse.down = false;
    };
    this._onMouseLeave = () => {
      this.mouse.inside = false;
      this.mouse.down = false;
    };
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    canvas.addEventListener('mousemove', this._onMouseMove);
    canvas.addEventListener('mousedown', this._onMouseDown);
    window.addEventListener('mouseup', this._onMouseUp);
    canvas.addEventListener('mouseleave', this._onMouseLeave);
  }

  _key(e, down) {
    // Game keys never scroll the page or trigger browser shortcuts.
    if (Object.values(KEYS).flat().includes(e.code)) e.preventDefault();
    if (down) {
      if (!e.repeat) this.tappedCodes.add(e.code);
      this.pressed.add(e.code);
    } else {
      this.pressed.delete(e.code);
    }
  }

  _mouse(e) {
    const rect = this.canvas.getBoundingClientRect();
    this.mouse.x = e.clientX - rect.left;
    this.mouse.y = e.clientY - rect.top;
    this.mouse.inside = true;
  }

  held(action) {
    return KEYS[action].some((code) => this.pressed.has(code));
  }

  tapped(action) {
    return KEYS[action].some((code) => this.tappedCodes.has(code));
  }

  // Call once per frame after the game has read the taps.
  endFrame() {
    this.tappedCodes.clear();
    this.mouse.clicked = false;
  }

  destroy() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
    this.canvas.removeEventListener('mousemove', this._onMouseMove);
    this.canvas.removeEventListener('mousedown', this._onMouseDown);
    window.removeEventListener('mouseup', this._onMouseUp);
    this.canvas.removeEventListener('mouseleave', this._onMouseLeave);
  }
}
