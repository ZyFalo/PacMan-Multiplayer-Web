// Pac-Man 4 Jugadores (Local) – Código reestructurado para escalabilidad y mantenibilidad
// Autor original: (tu equipo)
// Refactor: estructura por módulos (Game, Physics, Render, Editor, Input, Utils)
// ────────────────────────────────────────────────────────────────────────────────
/* eslint no-undef: 0 */
(() => {
  'use strict';

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ CONFIGURACIÓN Y DOM                                                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const CONFIG = Object.freeze({
    TILE: 24,
    ROWS: 21,
    COLS: 28,
    PELLET_SCORE: 10,
    POWER_PELLET_SCORE: 50,
    PAC_SPEED: 120,            // px/s
    GHOST_SPEED: 110,          // px/s
    GHOST_FRIGHT_SPEED: 80,    // px/s
    FRIGHT_TIME: 8,            // s
    DEBUG_COLLISIONS: false,
    TRAIL_LIFETIME: 0.3,       // s
    COLLISION_RADIUS: 0.25,    // radio (en múltiplos de TILE)
  });

  /** @type {HTMLCanvasElement} */
  const canvas = document.getElementById('game');
  const CANVAS_W = CONFIG.COLS * CONFIG.TILE;
  const CANVAS_H = CONFIG.ROWS * CONFIG.TILE;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  const ctx = canvas.getContext('2d');

  /** HUD y controles del Editor */
  const hud = document.getElementById('hud');
  const scoreHud = document.getElementById('scoreHud');
  const btnEdit = document.getElementById('btnEdit');
  const editorPanel = document.getElementById('editorPanel');
  const editorOverlay = document.getElementById('editorOverlay');
  const editorClose = document.getElementById('editorClose');
  const gameWrap = document.getElementById('gameWrap');
  const toolInfo = document.getElementById('toolInfo');

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ CONSTANTES DE DIRECCIÓN E INPUT                                         ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const DIRS = Object.freeze({
    STOP: { x: 0, y: 0 },
    LEFT: { x: -1, y: 0 },
    RIGHT: { x: 1, y: 0 },
    UP: { x: 0, y: -1 },
    DOWN: { x: 0, y: 1 }
  });

  const KEYMAP = {
    pac: {
      Numpad8: 'UP', Numpad4: 'LEFT', Numpad5: 'DOWN', Numpad6: 'RIGHT',
      '8': 'UP', '4': 'LEFT', '5': 'DOWN', '6': 'RIGHT'
    },
    g1: { a: 'LEFT', d: 'RIGHT', w: 'UP', s: 'DOWN', A: 'LEFT', D: 'RIGHT', W: 'UP', S: 'DOWN' },
    g2: { j: 'LEFT', l: 'RIGHT', i: 'UP', k: 'DOWN', J: 'LEFT', L: 'RIGHT', I: 'UP', K: 'DOWN' },
    g3: { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN' },
  };

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ UTILIDADES                                                              ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const Utils = {
    clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
    createGrid(r, c, fill) { return Array.from({ length: r }, () => Array.from({ length: c }, () => fill)); },
    cloneGrid(src) { return src.map(row => row.slice()); },
    copyInto(src, dst) { for (let r = 0; r < src.length; r++) for (let c = 0; c < src[0].length; c++) dst[r][c] = src[r][c]; },
    countTrue(m) { let n = 0; for (let r = 0; r < m.length; r++) for (let c = 0; c < m[0].length; c++) if (m[r][c]) n++; return n; },
    toCell(x, y) {
      const c = Math.floor(x / CONFIG.TILE);
      const r = Math.floor(y / CONFIG.TILE);
      return [Utils.clamp(r, 0, CONFIG.ROWS - 1), Utils.clamp(c, 0, CONFIG.COLS - 1)];
    },
  };

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ ESTADO DE MAPA Y PELLETS                                                ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const grid = Utils.createGrid(CONFIG.ROWS, CONFIG.COLS, 0);
  addBorders(grid);
  addMazeGeometry(grid);

  const ghostHouse = {
    r0: Math.floor(CONFIG.ROWS / 2) - 1,
    c0: Math.floor(CONFIG.COLS / 2) - 2,
    r1: Math.floor(CONFIG.ROWS / 2) + 1,
    c1: Math.floor(CONFIG.COLS / 2) + 2
  };

  const pellets = Utils.createGrid(CONFIG.ROWS, CONFIG.COLS, false);
  const power = Utils.createGrid(CONFIG.ROWS, CONFIG.COLS, false);
  seedPellets(pellets, power, grid);

  let remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);

  // Baselines (para reset/guardar)
  let baseGrid = Utils.cloneGrid(grid);
  let basePellets = Utils.cloneGrid(pellets);
  let basePower = Utils.cloneGrid(power);

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ ENTIDADES Y ESTADO DE JUEGO                                             ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  function makeEntity(type, color, startR, startC, speed) {
    return {
      type, color,
      x: startC * CONFIG.TILE + CONFIG.TILE / 2,
      y: startR * CONFIG.TILE + CONFIG.TILE / 2,
      startR, startC,
      dir: DIRS.STOP,
      next: DIRS.STOP,
      speed,
      score: 0,
      eatenAt: 0,
      trail: [],
      label: undefined,
    };
  }

  const pac = makeEntity('pac', '#FFEB3B', CONFIG.ROWS - 3, Math.floor(CONFIG.COLS / 2), CONFIG.PAC_SPEED);
  const ghost1 = makeEntity('ghost', '#F44336', Math.floor(CONFIG.ROWS / 2), Math.floor(CONFIG.COLS / 2) - 1, CONFIG.GHOST_SPEED);
  const ghost2 = makeEntity('ghost', '#E91E63', Math.floor(CONFIG.ROWS / 2), Math.floor(CONFIG.COLS / 2), CONFIG.GHOST_SPEED);
  const ghost3 = makeEntity('ghost', '#00BCD4', Math.floor(CONFIG.ROWS / 2), Math.floor(CONFIG.COLS / 2) + 1, CONFIG.GHOST_SPEED);
  ghost1.label = '1'; ghost2.label = '2'; ghost3.label = '3';
  const ghosts = [ghost1, ghost2, ghost3];
  const players = [pac, ...ghosts];

  const State = {
    lastTime: performance.now(),
    gameOver: false,
    winner: '',
    frightenedUntil: 0,
    particles: [],
    scorePopups: [],
    editorMode: false,
    currentTool: 'wall',
    mouseDown: false,
    draftGrid: null, draftPellets: null, draftPower: null,
    canGoCache: {},
    cacheFrame: 0,
  };

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ EFECTOS: Partículas y Popups                                            ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  class Particle {
    constructor(x, y, color, size = 2, life = 1) {
      this.x = x; this.y = y;
      this.vx = (Math.random() - 0.5) * 100;
      this.vy = (Math.random() - 0.5) * 100;
      this.color = color; this.size = size;
      this.life = life; this.maxLife = life;
      this.gravity = 50;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vy += this.gravity * dt;
      this.life -= dt;
      return this.life > 0;
    }
    draw(ctx) {
      const alpha = this.life / this.maxLife;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size * alpha, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  class ScorePopup {
    constructor(x, y, score) {
      this.x = x; this.y = y;
      this.score = score;
      this.life = 2;
      this.vy = -30;
    }
    update(dt) {
      this.y += this.vy * dt;
      this.life -= dt;
      return this.life > 0;
    }
    draw(ctx) {
      const alpha = Math.min(1, this.life);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 16px Orbitron, monospace';
      ctx.fillStyle = '#FFD700';
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.textAlign = 'center';
      ctx.strokeText(`+${this.score}`, this.x, this.y);
      ctx.fillText(`+${this.score}`, this.x, this.y);
      ctx.globalAlpha = 1;
    }
  }

  function createParticleEffect(x, y, color, count = 8) {
    for (let i = 0; i < count; i++) {
      State.particles.push(new Particle(x, y, color, Math.random() * 3 + 1, Math.random() * 0.5 + 0.5));
    }
  }
  function addScorePopup(x, y, score) { State.scorePopups.push(new ScorePopup(x, y, score)); }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ FÍSICA Y COLISIONES                                                     ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const Physics = {
    isOpposite(a, b) { return a.x === -b.x && a.y === -b.y; },

    isFrightened(t) { return t < State.frightenedUntil; },

    checkPlayerCollision(p1, p2) {
      const dx = p1.x - p2.x, dy = p1.y - p2.y;
      const distance = Math.hypot(dx, dy);
      const collisionDistance = CONFIG.TILE * 0.7;
      return distance < collisionDistance;
    },

    isPointValid(x, y) {
      // Wrap horizontal
      let checkX = x;
      const maxX = CONFIG.COLS * CONFIG.TILE;
      if (checkX < 0) checkX += maxX;
      if (checkX >= maxX) checkX -= maxX;

      const [r, c] = Utils.toCell(checkX, y);
      if (r < 0 || r >= CONFIG.ROWS || c < 0 || c >= CONFIG.COLS) return false;
      return grid[r][c] === 0;
    },

    isPositionValid(x, y, radiusPx) {
      const r = radiusPx;
      const pts = [
        { x, y },
        { x: x - r * 0.8, y },
        { x: x + r * 0.8, y },
        { x, y: y - r * 0.8 },
        { x, y: y + r * 0.8 },
      ];
      for (const p of pts) if (!Physics.isPointValid(p.x, p.y)) return false;
      return true;
    },

    canGo(r, c, dir, entityRadius = CONFIG.TILE * CONFIG.COLLISION_RADIUS) {
      const key = `${r},${c},${dir.x},${dir.y},${entityRadius}`;
      const cached = State.canGoCache[key];
      if (cached && cached.frame === State.cacheFrame) return cached.result;

      let nr = r + dir.y;
      let nc = c + dir.x;
      if (nc < 0) nc = CONFIG.COLS - 1;
      if (nc >= CONFIG.COLS) nc = 0;
      if (nr < 0 || nr >= CONFIG.ROWS) {
        State.canGoCache[key] = { result: false, frame: State.cacheFrame };
        return false;
      }
      if (grid[nr][nc] !== 0) {
        State.canGoCache[key] = { result: false, frame: State.cacheFrame };
        return false;
      }
      const centerX = nc * CONFIG.TILE + CONFIG.TILE / 2;
      const centerY = nr * CONFIG.TILE + CONFIG.TILE / 2;
      const result = Physics.isPositionValid(centerX, centerY, entityRadius);
      State.canGoCache[key] = { result, frame: State.cacheFrame };
      return result;
    },

    canGoToPosition(fromX, fromY, toX, toY, radius = CONFIG.TILE * CONFIG.COLLISION_RADIUS) {
      if (!Physics.isPositionValid(toX, toY, radius)) return false;
      const steps = Math.max(Math.abs(toX - fromX), Math.abs(toY - fromY)) / 2;
      for (let i = 0; i <= steps; i++) {
        const t = steps ? (i / steps) : 1;
        const x = fromX + (toX - fromX) * t;
        const y = fromY + (toY - fromY) * t;
        if (!Physics.isPositionValid(x, y, radius)) return false;
      }
      return true;
    },

    calculateSafeMovement(entity, dx, dy) {
      const currentX = entity.x, currentY = entity.y;
      let newX = currentX + dx, newY = currentY + dy;
      const radiusPx = CONFIG.TILE * CONFIG.COLLISION_RADIUS;

      // Wrap horizontal provisional
      if (newX < -CONFIG.TILE / 2) newX = CONFIG.COLS * CONFIG.TILE - CONFIG.TILE / 2;
      if (newX > CONFIG.COLS * CONFIG.TILE + CONFIG.TILE / 2) newX = CONFIG.TILE / 2;

      if (!Physics.isPositionValid(newX, newY, radiusPx)) {
        const safeX = Physics.findSafePositionX(currentX, currentY, dx, radiusPx);
        const safeY = Physics.findSafePositionY(currentX, currentY, dy, radiusPx);
        if (Math.abs(safeX - newX) < Math.abs(safeY - newY)) return { x: safeX, y: currentY };
        return { x: currentX, y: safeY };
      }
      return { x: newX, y: newY };
    },

    findSafePositionX(currentX, currentY, dx, radiusPx) {
      if (dx === 0) return currentX;
      const step = dx > 0 ? 1 : -1;
      let testX = currentX;
      for (let i = 0; i < Math.abs(dx); i += step) {
        const nextX = testX + step;
        if (Physics.isPositionValid(nextX, currentY, radiusPx)) testX = nextX;
        else break;
      }
      return testX;
    },

    findSafePositionY(currentX, currentY, dy, radiusPx) {
      if (dy === 0) return currentY;
      const step = dy > 0 ? 1 : -1;
      let testY = currentY;
      for (let i = 0; i < Math.abs(dy); i += step) {
        const nextY = testY + step;
        if (Physics.isPositionValid(currentX, nextY, radiusPx)) testY = nextY;
        else break;
      }
      return testY;
    },

    validateEntityPosition(entity) {
      const radiusPx = CONFIG.TILE * CONFIG.COLLISION_RADIUS;
      if (Physics.isPositionValid(entity.x, entity.y, radiusPx)) return;

      const [r, c] = Utils.toCell(entity.x, entity.y);
      const centerX = c * CONFIG.TILE + CONFIG.TILE / 2;
      const centerY = r * CONFIG.TILE + CONFIG.TILE / 2;

      if (Physics.isPositionValid(centerX, centerY, radiusPx)) {
        entity.x = centerX; entity.y = centerY; entity.dir = DIRS.STOP; return;
      }
      const best = Physics.findNearestValidCell(entity.x, entity.y, radiusPx);
      if (best) {
        entity.x = best.x; entity.y = best.y; entity.dir = DIRS.STOP;
      }
    },

    findNearestValidCell(x, y, radiusPx) {
      const [cr, cc] = Utils.toCell(x, y);
      const sr = 3;
      let bestDist = Infinity, best = null;
      for (let dr = -sr; dr <= sr; dr++) {
        for (let dc = -sr; dc <= sr; dc++) {
          const r = cr + dr, c = cc + dc;
          if (r < 0 || r >= CONFIG.ROWS || c < 0 || c >= CONFIG.COLS) continue;
          if (grid[r][c] !== 0) continue;
          const cx = c * CONFIG.TILE + CONFIG.TILE / 2;
          const cy = r * CONFIG.TILE + CONFIG.TILE / 2;
          if (!Physics.isPositionValid(cx, cy, radiusPx)) continue;
          const d = Math.hypot(cx - x, cy - y);
          if (d < bestDist) { bestDist = d; best = { x: cx, y: cy }; }
        }
      }
      return best;
    },
  };

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ RENDER                                                                  ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const Render = {
    draw(t) {
      // Fondo
      const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
      gradient.addColorStop(0, '#000814');
      gradient.addColorStop(0.5, '#001122');
      gradient.addColorStop(1, '#000814');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      Render.drawGrid();
      Render.drawPellets(t);
      Render.drawTrails();

      // Entidades
      for (const g of ghosts) Render.drawGhost(g, Physics.isFrightened(t), t);
      Render.drawPac(pac, t);

      // Efectos
      State.particles.forEach(p => p.draw(ctx));
      State.scorePopups.forEach(p => p.draw(ctx));

      if (CONFIG.DEBUG_COLLISIONS) Render.drawCollisionDebug();

      // HUD
      hud.innerHTML = Render.renderHUD();
      scoreHud.innerHTML = Render.renderScoreHUD();

      // Editor
      if (State.editorMode) {
        Editor.drawOverlay();
        Editor.drawCursorPreview();
      }
      if (State.gameOver) Render.drawGameOverOverlay();
    },

    drawGrid() {
      for (let r = 0; r < CONFIG.ROWS; r++) {
        for (let c = 0; c < CONFIG.COLS; c++) {
          if (grid[r][c] === 1) {
            const grad = ctx.createLinearGradient(c * CONFIG.TILE, r * CONFIG.TILE, (c + 1) * CONFIG.TILE, (r + 1) * CONFIG.TILE);
            grad.addColorStop(0, '#1a4a8a'); grad.addColorStop(0.5, '#0b2545'); grad.addColorStop(1, '#051829');
            ctx.fillStyle = grad;
            ctx.fillRect(c * CONFIG.TILE, r * CONFIG.TILE, CONFIG.TILE, CONFIG.TILE);
            ctx.strokeStyle = '#00d4ff';
            ctx.lineWidth = 1;
            ctx.strokeRect(c * CONFIG.TILE + 0.5, r * CONFIG.TILE + 0.5, CONFIG.TILE - 1, CONFIG.TILE - 1);
            ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
            ctx.lineWidth = 0.5;
            ctx.strokeRect(c * CONFIG.TILE + 1.5, r * CONFIG.TILE + 1.5, CONFIG.TILE - 3, CONFIG.TILE - 3);
          }
        }
      }
    },

    drawPellets(t) {
      // Pellets
      for (let r = 0; r < CONFIG.ROWS; r++) {
        for (let c = 0; c < CONFIG.COLS; c++) {
          if (!pellets[r][c]) continue;
          const cx = c * CONFIG.TILE + CONFIG.TILE / 2;
          const cy = r * CONFIG.TILE + CONFIG.TILE / 2;
          const pulse = 1 + Math.sin(t * 8) * 0.2;
          const glow = 1 + Math.sin(t * 6) * 0.3;
          ctx.shadowColor = '#ffd8a6';
          ctx.shadowBlur = 5 * glow;
          ctx.fillStyle = '#ffd8a6';
          ctx.beginPath();
          ctx.arc(cx, cy, 3 * pulse, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }
      // Súper-pellets
      for (let r = 0; r < CONFIG.ROWS; r++) {
        for (let c = 0; c < CONFIG.COLS; c++) {
          if (!power[r][c]) continue;
          const cx = c * CONFIG.TILE + CONFIG.TILE / 2;
          const cy = r * CONFIG.TILE + CONFIG.TILE / 2;
          const pulse = 1 + Math.sin(t * 10) * 0.4;
          const rot = t * 5;
          ctx.save();
          ctx.translate(cx, cy);
          ctx.rotate(rot);
          ctx.shadowColor = '#FFD700';
          ctx.shadowBlur = 15;
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          for (let i = 0; i < 8; i++) {
            const ang = (i / 8) * Math.PI * 2;
            const rad = (i % 2 === 0) ? 8 * pulse : 4 * pulse;
            const x = Math.cos(ang) * rad;
            const y = Math.sin(ang) * rad;
            if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.shadowBlur = 0;
          ctx.restore();
        }
      }
    },

    drawTrails() {
      players.forEach(p => {
        if (p.trail.length < 2) return;
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        for (let i = 0; i < p.trail.length; i++) {
          const point = p.trail[i];
          if (i === 0) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
        }
        ctx.stroke();
        ctx.globalAlpha = 1;
      });
    },

    drawPac(p, t) {
      const angle = Math.sin(t * 8) * 0.3 + 0.45;
      let start = 0.0, end = Math.PI * 2;
      if (p.dir === DIRS.RIGHT) { start = angle; end = Math.PI * 2 - angle; }
      if (p.dir === DIRS.LEFT) { start = Math.PI + angle; end = Math.PI - angle; }
      if (p.dir === DIRS.UP) { start = 1.5 * Math.PI + angle; end = 1.5 * Math.PI - angle; }
      if (p.dir === DIRS.DOWN) { start = 0.5 * Math.PI + angle; end = 0.5 * Math.PI - angle; }
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 20;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.arc(p.x, p.y, CONFIG.TILE * 0.45, start, end);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
    },

    drawGhost(g, frightened, t) {
      const body = frightened ? '#4ade80' : g.color;
      const r = CONFIG.TILE * 0.45;
      ctx.shadowColor = frightened ? '#4ade80' : body;
      ctx.shadowBlur = frightened ? 15 : 8;

      const wave = Math.sin(t * 10 + g.x * 0.1) * 2;
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(g.x, g.y + wave, r, Math.PI, 0);
      ctx.lineTo(g.x + r, g.y + r * 0.8 + wave);

      const waves = 4;
      for (let i = waves; i >= 0; i--) {
        const wx = g.x + (i / waves * 2 - 1) * r;
        const wy = g.y + r * 0.8 + (i % 2 ? 0.0 : 0.2) * r + wave + Math.sin(t * 8 + i) * 2;
        ctx.lineTo(wx, wy);
      }
      ctx.closePath();
      ctx.fill();

      ctx.shadowBlur = 0;
      ctx.fillStyle = '#fff';
      const ox = g.dir.x * 4, oy = g.dir.y * 4;
      const eyeBlink = Math.sin(t * 20) > 0.9 ? 0.3 : 1;
      ctx.beginPath(); ctx.arc(g.x - 7, g.y - 2, 5 * eyeBlink, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(g.x + 7, g.y - 2, 5 * eyeBlink, 0, Math.PI * 2); ctx.fill();
      if (eyeBlink > 0.5) {
        ctx.fillStyle = '#1b2a4a';
        ctx.beginPath(); ctx.arc(g.x - 7 + ox, g.y - 2 + oy, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(g.x + 7 + ox, g.y - 2 + oy, 2.5, 0, Math.PI * 2); ctx.fill();
      }
      if (g.label) {
        ctx.font = 'bold 14px Orbitron, monospace';
        ctx.textAlign = 'center';
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(0,0,0,0.8)';
        ctx.strokeText(g.label, g.x, g.y - r - 6);
        ctx.fillStyle = '#ffffff';
        ctx.fillText(g.label, g.x, g.y - r - 6);
      }
    },

    drawCollisionDebug() {
      const radius = CONFIG.TILE * CONFIG.COLLISION_RADIUS;
      players.forEach(p => {
        ctx.strokeStyle = p.type === 'pac' ? '#FF0000' : '#00FF00';
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.stroke();

        const checkPoints = [
          { x: p.x - radius * 0.8, y: p.y },
          { x: p.x + radius * 0.8, y: p.y },
          { x: p.x, y: p.y - radius * 0.8 },
          { x: p.x, y: p.y + radius * 0.8 },
        ];
        ctx.fillStyle = ctx.strokeStyle;
        checkPoints.forEach(pt => { ctx.beginPath(); ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2); ctx.fill(); });
      });
      ctx.globalAlpha = 1;
    },

    drawGameOverOverlay() {
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const centerX = canvas.width / 2, centerY = canvas.height / 2;
      ctx.fillStyle = 'rgba(15,25,45,0.95)';
      ctx.strokeStyle = '#00d4ff';
      ctx.lineWidth = 3;
      const panelW = 400, panelH = 150;
      ctx.fillRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH);
      ctx.strokeRect(centerX - panelW / 2, centerY - panelH / 2, panelW, panelH);
      ctx.font = 'bold 32px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFD700';
      ctx.fillText(`🎉 ${State.winner} GANA! 🎉`, centerX, centerY - 20);
      ctx.font = '18px Space Mono, monospace';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Pulsa R para reiniciar', centerX, centerY + 20);
    },

    renderScoreHUD() {
      return `🏆 Puntos: <span style="color: var(--accent-yellow);">${pac.score}</span> • 🟡 Pellets restantes: <span style="color: var(--accent-blue);">${remainingPellets}</span>`;
    },

    renderHUD() {
      return [
        `<h3>🎮 Controles</h3>`,
        `<div class="row"><span class="player-info player-pacman">🟡 Pac-Man</span> numpad: <span class="kbd">8</span> <span class="kbd">4</span> <span class="kbd">5</span> <span class="kbd">6</span></div>`,
        `<div class="row"><span class="player-info player-ghost1">🔴 Fantasma 1</span> <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span></div>`,
        `<div class="row"><span class="player-info player-ghost2">🟣 Fantasma 2</span> <span class="kbd">I</span><span class="kbd">J</span><span class="kbd">K</span><span class="kbd">L</span></div>`,
        `<div class="row"><span class="player-info player-ghost3">🔵 Fantasma 3</span> flechas: <span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">←</span> <span class="kbd">→</span></div>`,
        `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(0, 212, 255, 0.2);">`,
        `<div class="row">⭐ <strong>Super-pellet:</strong> fantasmas asustados ${CONFIG.FRIGHT_TIME}s</div>`,
        `<div class="row">🎨 <span class="kbd">E</span> - Activar editor de mapas</div>`,
        `<div class="row">🔄 <span class="kbd">R</span> - Reiniciar juego</div>`,
        `</div>`
      ].join('');
    },
  };

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ LÓGICA DE MOVIMIENTO Y JUEGO                                            ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  function tryImmediateDirectionChange(entity, newDir) {
    const [r, c] = Utils.toCell(entity.x, entity.y);
    const radiusPx = CONFIG.TILE * CONFIG.COLLISION_RADIUS;

    if (Physics.canGo(r, c, newDir, radiusPx)) {
      const fx = entity.x + newDir.x * CONFIG.TILE / 4;
      const fy = entity.y + newDir.y * CONFIG.TILE / 4;
      if (Physics.canGoToPosition(entity.x, entity.y, fx, fy, radiusPx)) {
        entity.dir = newDir; return;
      }
    }
    if (!Physics.canGo(r, c, entity.dir, radiusPx) && Physics.canGo(r, c, newDir, radiusPx)) {
      entity.dir = newDir; return;
    }
    if (entity.dir !== DIRS.STOP && Physics.isOpposite(entity.dir, newDir)) {
      const rx = entity.x + newDir.x * 2, ry = entity.y + newDir.y * 2;
      if (Physics.isPositionValid(rx, ry, radiusPx)) entity.dir = newDir;
    }
  }

  function respawn(e) {
    e.x = e.startC * CONFIG.TILE + CONFIG.TILE / 2;
    e.y = e.startR * CONFIG.TILE + CONFIG.TILE / 2;
    e.dir = DIRS.STOP; e.next = DIRS.STOP;
    e.eatenAt = performance.now() / 1000;
  }

  function updateMover(e, dt, t = performance.now() / 1000) {
    const [r, c] = Utils.toCell(e.x, e.y);
    const centerX = c * CONFIG.TILE + CONFIG.TILE / 2;
    const centerY = r * CONFIG.TILE + CONFIG.TILE / 2;

    const tolerance = CONFIG.TILE * 0.3;
    const nearCenter = Math.abs(e.x - centerX) < tolerance && Math.abs(e.y - centerY) < tolerance;

    if (Math.abs(e.x - centerX) < 1 && Math.abs(e.y - centerY) < 1) {
      e.x = centerX; e.y = centerY;
    }
    if (nearCenter && e.next !== e.dir && Physics.canGo(r, c, e.next)) e.dir = e.next;
    if (nearCenter && !Physics.canGo(r, c, e.dir)) e.dir = DIRS.STOP;

    let speed = e.speed;
    if (e.type === 'ghost' && Physics.isFrightened(t)) speed = CONFIG.GHOST_FRIGHT_SPEED;

    const dx = e.dir.x * speed * dt;
    const dy = e.dir.y * speed * dt;

    if (e.dir !== DIRS.STOP) {
      const np = Physics.calculateSafeMovement(e, dx, dy);
      e.x = np.x; e.y = np.y;
    }
    // Teletransporte horizontal final
    if (e.x < -CONFIG.TILE / 2) e.x = CONFIG.COLS * CONFIG.TILE - CONFIG.TILE / 2;
    if (e.x > CONFIG.COLS * CONFIG.TILE + CONFIG.TILE / 2) e.x = CONFIG.TILE / 2;
  }

  function fixPacManStartPosition() {
    const pacR = Math.floor(pac.y / CONFIG.TILE);
    const pacC = Math.floor(pac.x / CONFIG.TILE);
    if (grid[pacR] && grid[pacR][pacC] === 1) {
      grid[pacR][pacC] = 0;
      baseGrid[pacR][pacC] = 0;
      if (!pellets[pacR][pacC] && !power[pacR][pacC]) {
        pellets[pacR][pacC] = true;
        basePellets[pacR][pacC] = true;
        remainingPellets++;
      }
      const adj = [
        { r: pacR - 1, c: pacC }, { r: pacR + 1, c: pacC },
        { r: pacR, c: pacC - 1 }, { r: pacR, c: pacC + 1 }
      ];
      let hasPath = adj.some(pos => pos.r >= 0 && pos.r < CONFIG.ROWS && pos.c >= 0 && pos.c < CONFIG.COLS && grid[pos.r][pos.c] === 0);
      if (!hasPath) {
        const safeR = Math.min(pacR + 1, CONFIG.ROWS - 2);
        if (grid[safeR] && grid[safeR][pacC] === 1) {
          grid[safeR][pacC] = 0; baseGrid[safeR][pacC] = 0;
          if (!pellets[safeR][pacC] && !power[safeR][pacC]) {
            pellets[safeR][pacC] = true; basePellets[safeR][pacC] = true; remainingPellets++;
          }
        }
      }
    }
    ghosts.forEach((g) => {
      const gr = Math.floor(g.y / CONFIG.TILE);
      const gc = Math.floor(g.x / CONFIG.TILE);
      if (grid[gr] && grid[gr][gc] === 1) { grid[gr][gc] = 0; baseGrid[gr][gc] = 0; }
    });
  }

  function resetGame() {
    players.forEach(p => {
      p.x = p.startC * CONFIG.TILE + CONFIG.TILE / 2;
      p.y = p.startR * CONFIG.TILE + CONFIG.TILE / 2;
      p.dir = DIRS.STOP; p.next = DIRS.STOP; p.eatenAt = 0; p.trail = [];
    });
    State.frightenedUntil = 0;
    State.particles = [];
    State.scorePopups = [];
    Utils.copyInto(baseGrid, grid);
    Utils.copyInto(basePellets, pellets);
    Utils.copyInto(basePower, power);
    remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);
    State.gameOver = false; State.winner = '';
    fixPacManStartPosition();
  }

  function update(dt, t) {
    if (State.editorMode || State.gameOver) return;

    State.cacheFrame++;
    if (State.cacheFrame % 1000 === 0) State.canGoCache = {};

    State.particles = State.particles.filter(p => p.update(dt));
    State.scorePopups = State.scorePopups.filter(p => p.update(dt));

    updateMover(pac, dt, t);
    Physics.validateEntityPosition(pac);
    for (const g of ghosts) { updateMover(g, dt, t); Physics.validateEntityPosition(g); }

    // Estelas
    players.forEach(p => {
      p.trail.push({ x: p.x, y: p.y, time: t });
      p.trail = p.trail.filter(pt => t - pt.time < CONFIG.TRAIL_LIFETIME);
    });

    // Comer pellets
    const [pr, pc] = Utils.toCell(pac.x, pac.y);
    if (power[pr][pc]) {
      power[pr][pc] = false; remainingPellets--; pac.score += CONFIG.POWER_PELLET_SCORE;
      State.frightenedUntil = t + CONFIG.FRIGHT_TIME;
      createParticleEffect(pac.x, pac.y, '#FFD700', 12);
      addScorePopup(pac.x, pac.y, CONFIG.POWER_PELLET_SCORE);
    } else if (pellets[pr][pc]) {
      pellets[pr][pc] = false; remainingPellets--; pac.score += CONFIG.PELLET_SCORE;
      createParticleEffect(pac.x, pac.y, '#FFA500', 4);
      addScorePopup(pac.x, pac.y, CONFIG.PELLET_SCORE);
    }

    if (remainingPellets <= 0) { State.gameOver = true; State.winner = 'Pac-Man'; }

    for (const g of ghosts) {
      if (Physics.checkPlayerCollision(pac, g)) {
        if (Physics.isFrightened(t)) {
          pac.score += 200;
          createParticleEffect(g.x, g.y, g.color, 15);
          addScorePopup(g.x, g.y, 200);
          respawn(g);
        } else {
          State.gameOver = true; State.winner = 'Fantasmas';
          createParticleEffect(pac.x, pac.y, '#FF0000', 20);
        }
      }
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ EDITOR DE MAPAS                                                         ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  const Editor = {
    cursorPreview: null,
    toolNames: {
      wall: 'Pared 🧱',
      empty: 'Vacío ⭕',
      pellet: 'Pellet 🟡',
      power: 'Súper Pellet ⭐'
    },

    toggle() { Editor.setMode(!State.editorMode); },

    setMode(on) {
      State.editorMode = on;
      if (on) {
        State.draftGrid = Utils.cloneGrid(grid);
        State.draftPellets = Utils.cloneGrid(pellets);
        State.draftPower = Utils.cloneGrid(power);
      }
      editorPanel.classList.toggle('active', on);
      editorOverlay.classList.toggle('active', on);
      gameWrap.classList.toggle('editor-active', on);
      canvas.classList.toggle('editor-active', on);
      toolInfo.classList.toggle('active', on);
      canvas.style.cursor = on ? 'crosshair' : 'default';
      toolInfo.textContent = on ? `🛠️ Modo editor activo • Herramienta: ${Editor.toolNames[State.currentTool] ?? State.currentTool}` : '';
      Editor.updateToolButtons();
      if (on) Editor.updateSaveButtonState();
    },

    updateToolButtons() {
      document.querySelectorAll('.toolBtn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === State.currentTool);
      });
    },

    onToolClick(ev) {
      State.currentTool = ev.currentTarget.getAttribute('data-tool');
      toolInfo.textContent = `🛠️ Modo editor activo • Herramienta: ${Editor.toolNames[State.currentTool] ?? State.currentTool}`;
      Editor.updateToolButtons();
    },

    drawOverlay() {
      ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      for (let r = 1; r < CONFIG.ROWS - 1; r++) { ctx.beginPath(); ctx.moveTo(0, r * CONFIG.TILE); ctx.lineTo(CONFIG.COLS * CONFIG.TILE, r * CONFIG.TILE); ctx.stroke(); }
      for (let c = 1; c < CONFIG.COLS - 1; c++) { ctx.beginPath(); ctx.moveTo(c * CONFIG.TILE, 0); ctx.lineTo(c * CONFIG.TILE, CONFIG.ROWS * CONFIG.TILE); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
      ctx.lineWidth = 2;
      ctx.strokeRect(0, 0, CONFIG.COLS * CONFIG.TILE, CONFIG.TILE);
      ctx.strokeRect(0, (CONFIG.ROWS - 1) * CONFIG.TILE, CONFIG.COLS * CONFIG.TILE, CONFIG.TILE);
      ctx.strokeRect(0, 0, CONFIG.TILE, CONFIG.ROWS * CONFIG.TILE);
      ctx.strokeRect((CONFIG.COLS - 1) * CONFIG.TILE, 0, CONFIG.TILE, CONFIG.ROWS * CONFIG.TILE);
    },

    showCursorPreview(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const c = Math.floor(mx / CONFIG.TILE);
      const r = Math.floor(my / CONFIG.TILE);
      if (r <= 0 || r >= CONFIG.ROWS - 1 || c <= 0 || c >= CONFIG.COLS - 1) { Editor.hideCursorPreview(); return; }
      Editor.cursorPreview = { r, c };
    },

    hideCursorPreview() { Editor.cursorPreview = null; },

    drawCursorPreview() {
      if (!State.editorMode || !Editor.cursorPreview) return;
      const { r, c } = Editor.cursorPreview;
      const x = c * CONFIG.TILE, y = r * CONFIG.TILE;
      let color = 'rgba(255, 255, 255, 0.3)';
      if (State.currentTool === 'wall') color = 'rgba(0, 212, 255, 0.4)';
      else if (State.currentTool === 'empty') color = 'rgba(255, 0, 0, 0.3)';
      else if (State.currentTool === 'pellet') color = 'rgba(255, 215, 0, 0.4)';
      else if (State.currentTool === 'power') color = 'rgba(255, 215, 0, 0.6)';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, CONFIG.TILE, CONFIG.TILE);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, CONFIG.TILE - 2, CONFIG.TILE - 2);
    },

    paintFromEvent(e) {
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
      const my = (e.clientY - rect.top) * (canvas.height / rect.height);
      const c = Math.floor(mx / CONFIG.TILE);
      const r = Math.floor(my / CONFIG.TILE);
      if (r <= 0 || r >= CONFIG.ROWS - 1 || c <= 0 || c >= CONFIG.COLS - 1) return;

      if (State.currentTool === 'wall') {
        if (grid[r][c] !== 1) {
          grid[r][c] = 1; pellets[r][c] = false; power[r][c] = false;
          remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);
          Editor.updateSaveButtonState();
        }
      } else if (State.currentTool === 'empty') {
        if (grid[r][c] !== 0) grid[r][c] = 0;
      } else if (State.currentTool === 'pellet') {
        if (grid[r][c] === 0 && !pellets[r][c]) {
          pellets[r][c] = true; power[r][c] = false;
          remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);
          Editor.updateSaveButtonState();
        }
      } else if (State.currentTool === 'power') {
        if (grid[r][c] === 0 && !power[r][c]) {
          power[r][c] = true; pellets[r][c] = false;
          remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);
          Editor.updateSaveButtonState();
        }
      }
    },

    updateSaveButtonState() {
      const btn = document.getElementById('btnSaveEdit');
      if (!btn) return;
      const ok = Editor.hasPelletsOutsideGhostHouse();
      btn.disabled = !ok;
      btn.title = ok
        ? 'Guardar cambios'
        : 'Agrega al menos un pellet o súper-pellet fuera de la casa de fantasmas para poder guardar';
    },

    countPelletsExcludingRect(pel, pow, rect) {
      let n = 0;
      for (let r = 0; r < pel.length; r++) {
        for (let c = 0; c < pel[0].length; c++) {
          if (r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1) continue;
          if (pel[r][c] || pow[r][c]) n++;
        }
      }
      return n;
    },

    hasPelletsOutsideGhostHouse() { return Editor.countPelletsExcludingRect(pellets, power, ghostHouse) > 0; },

    preventPlayersOnWalls() {
      const pacR = pac.startR, pacC = pac.startC;
      if (grid[pacR][pacC] === 1) grid[pacR][pacC] = 0;
      ghosts.forEach((g) => {
        const r = g.startR, c = g.startC;
        if (grid[r][c] === 1) grid[r][c] = 0;
      });
    },

    // Botones de acción del editor
    bindUI() {
      btnEdit.addEventListener('click', () => Editor.toggle());
      editorClose.addEventListener('click', () => Editor.cancelAndClose());
      editorOverlay.addEventListener('click', () => Editor.cancelAndClose());
      document.getElementById('btnCancelEdit').addEventListener('click', () => Editor.cancelAndClose());
      document.getElementById('btnSaveEdit').addEventListener('click', () => Editor.saveAndClose());
      document.getElementById('btnClearWalls').addEventListener('click', () => {
        for (let r = 1; r < CONFIG.ROWS - 1; r++) for (let c = 1; c < CONFIG.COLS - 1; c++) grid[r][c] = 0;
      });
      document.getElementById('btnClearPellets').addEventListener('click', () => {
        for (let r = 0; r < CONFIG.ROWS; r++) for (let c = 0; c < CONFIG.COLS; c++) { pellets[r][c] = false; power[r][c] = false; }
        remainingPellets = 0;
        Editor.updateSaveButtonState();
      });
      for (const b of document.querySelectorAll('.toolBtn')) b.addEventListener('click', Editor.onToolClick);
    },

    cancelAndClose() {
      if (State.draftGrid && State.draftPellets && State.draftPower) {
        Utils.copyInto(State.draftGrid, grid);
        Utils.copyInto(State.draftPellets, pellets);
        Utils.copyInto(State.draftPower, power);
      }
      remainingPellets = Utils.countTrue(pellets) + Utils.countTrue(power);
      Editor.setMode(false);
    },

    saveAndClose() {
      if (!Editor.hasPelletsOutsideGhostHouse()) {
        alert('No puedes guardar: coloca al menos un pellet o súper-pellet fuera de la casa de fantasmas.');
        Editor.updateSaveButtonState();
        return;
      }
      addBorders(grid);
      clearPelletsInRect(pellets, power, ghostHouse);
      Editor.preventPlayersOnWalls();
      baseGrid = Utils.cloneGrid(grid);
      basePellets = Utils.cloneGrid(pellets);
      basePower = Utils.cloneGrid(power);
      Editor.setMode(false);
      resetGame();
    },
  };

  // Eventos de canvas para el editor
  canvas.addEventListener('mousedown', (e) => { if (!State.editorMode) return; State.mouseDown = true; Editor.paintFromEvent(e); });
  window.addEventListener('mouseup', () => { State.mouseDown = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (State.editorMode) {
      if (State.mouseDown) Editor.paintFromEvent(e);
      Editor.showCursorPreview(e);
    }
  });
  canvas.addEventListener('mouseleave', () => { Editor.hideCursorPreview(); });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ INPUT                                                                   ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  function dirFromEvent(map, e) {
    if (map[e.key]) return DIRS[map[e.key]];
    if (map[e.code]) return DIRS[map[e.code]];
    return null;
  }

  window.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
    if (e.key === 'r' || e.key === 'R') { resetGame(); return; }
    if (e.key === 'e' || e.key === 'E') { Editor.toggle(); return; }
    if (State.gameOver || State.editorMode) return;

    const pd = dirFromEvent(KEYMAP.pac, e);
    if (pd) { pac.next = pd; tryImmediateDirectionChange(pac, pd); return; }

    const d1 = dirFromEvent(KEYMAP.g1, e);
    if (d1) { ghost1.next = d1; tryImmediateDirectionChange(ghost1, d1); return; }

    const d2 = dirFromEvent(KEYMAP.g2, e);
    if (d2) { ghost2.next = d2; tryImmediateDirectionChange(ghost2, d2); return; }

    const d3 = dirFromEvent(KEYMAP.g3, e);
    if (d3) { ghost3.next = d3; tryImmediateDirectionChange(ghost3, d3); return; }
  });

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ BUCLE PRINCIPAL                                                         ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  function tick(now) {
    const dt = Math.min(0.016, (now - State.lastTime) / 1000); // ~60 FPS
    State.lastTime = now;
    const t = now / 1000;
    update(dt, t);
    Render.draw(t);
    requestAnimationFrame(tick);
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ GENERACIÓN DE LABERINTO Y PELLETS                                       ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  function addBorders(g) {
    for (let r = 0; r < CONFIG.ROWS; r++) { g[r][0] = 1; g[r][CONFIG.COLS - 1] = 1; }
    for (let c = 0; c < CONFIG.COLS; c++) { g[0][c] = 1; g[CONFIG.ROWS - 1][c] = 1; }
    const cr = Math.floor(CONFIG.ROWS / 2);
    g[cr][0] = 0; g[cr][CONFIG.COLS - 1] = 0; // túneles
  }

  function addMazeGeometry(g) {
    const cr = Math.floor(CONFIG.ROWS / 2);
    const cc = Math.floor(CONFIG.COLS / 2);
    const hWall = (r, c0, c1) => { for (let c = c0; c <= c1; c++) g[r][c] = 1; };
    const vWall = (c, r0, r1) => { for (let r = r0; r <= r1; r++) g[r][c] = 1; };
    const open = (r, c) => { if (r >= 0 && r < CONFIG.ROWS && c >= 0 && c < CONFIG.COLS) g[r][c] = 0; };
    const rect = (r0, c0, r1, c1) => { for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) g[r][c] = 1; };

    // 1) Bordes exteriores
    hWall(0, 0, CONFIG.COLS - 1);
    hWall(CONFIG.ROWS - 1, 0, CONFIG.COLS - 1);
    vWall(0, 0, CONFIG.ROWS - 1);
    vWall(CONFIG.COLS - 1, 0, CONFIG.ROWS - 1);

    // 2) Anillo interior
    hWall(2, 2, CONFIG.COLS - 3);
    hWall(CONFIG.ROWS - 3, 2, CONFIG.COLS - 3);
    vWall(2, 2, CONFIG.ROWS - 3);
    vWall(CONFIG.COLS - 3, 2, CONFIG.ROWS - 3);

    // 3) Ejes centrales
    hWall(cr, 3, CONFIG.COLS - 4);
    vWall(cc, 3, CONFIG.ROWS - 4);

    // 4) Casa de fantasmas 5x7 con salida horizontal
    rect(cr - 2, cc - 3, cr + 2, cc + 3);
    for (let c = cc - 2; c <= cc + 2; c++) open(cr, c);

    // 5) Corredor central
    for (let c = 1; c < CONFIG.COLS - 1; c++) open(cr, c);

    // 6) Túneles (ya abiertos por addBorders, reforzamos)
    open(cr, 0); open(cr, CONFIG.COLS - 1);

    // 7) Salas esquinas
    rect(3, 3, 5, 6); open(4, 6);
    rect(3, CONFIG.COLS - 7, 5, CONFIG.COLS - 4); open(4, CONFIG.COLS - 7);
    rect(CONFIG.ROWS - 6, 3, CONFIG.ROWS - 4, 6); open(CONFIG.ROWS - 5, 6);
    rect(CONFIG.ROWS - 6, CONFIG.COLS - 7, CONFIG.ROWS - 4, CONFIG.COLS - 4); open(CONFIG.ROWS - 5, CONFIG.COLS - 7);

    // 8) Pasillos verticales extra
    vWall(6, 6, CONFIG.ROWS - 7); open(cr, 6);
    vWall(CONFIG.COLS - 7, 6, CONFIG.ROWS - 7); open(cr, CONFIG.COLS - 7);

    // 9) Bloques inferiores
    rect(cr + 3, cc - 9, cr + 4, cc - 7);
    rect(cr + 3, cc - 2, cr + 4, cc);
    rect(cr + 3, cc + 7, cr + 4, cc + 9);

    // 10) Limpiar pasos
    open(cr - 4, cc);
    open(cr + 4, cc);
  }

  function computeReachable(g, sr, sc) {
    const vis = Utils.createGrid(CONFIG.ROWS, CONFIG.COLS, false);
    const q = [[sr, sc]]; vis[sr][sc] = true;
    const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    while (q.length) {
      const [r, c] = q.shift();
      for (const [dy, dx] of dirs) {
        const nr = r + dy, nc = c + dx;
        if (nr < 0 || nr >= CONFIG.ROWS || nc < 0 || nc >= CONFIG.COLS) continue;
        if (vis[nr][nc]) continue;
        if (g[nr][nc] !== 0) continue;
        vis[nr][nc] = true; q.push([nr, nc]);
      }
    }
    return vis;
  }

  function clearPelletsInRect(pel, pow, rect) {
    for (let r = rect.r0; r <= rect.r1; r++) for (let c = rect.c0; c <= rect.c1; c++) { pel[r][c] = false; pow[r][c] = false; }
  }

  function seedPellets(pel, pow, g) {
    for (let r = 0; r < CONFIG.ROWS; r++) for (let c = 0; c < CONFIG.COLS; c++) { pel[r][c] = false; pow[r][c] = false; }
    const startR = CONFIG.ROWS - 3, startC = Math.floor(CONFIG.COLS / 2);
    const reach = computeReachable(g, startR, startC);

    for (let r = 0; r < CONFIG.ROWS; r++) {
      for (let c = 0; c < CONFIG.COLS; c++) {
        if (g[r][c] === 0 && reach[r][c]) pel[r][c] = true;
      }
    }
    clearPelletsInRect(pel, pow, ghostHouse);

    const corners = [[3, 3], [3, CONFIG.COLS - 4], [CONFIG.ROWS - 4, 3], [CONFIG.ROWS - 4, CONFIG.COLS - 4]];
    const midLane = [[Math.floor(CONFIG.ROWS / 2), 5], [Math.floor(CONFIG.ROWS / 2), CONFIG.COLS - 6]];
    for (const [rr, cc] of [...corners, ...midLane]) {
      if (rr >= 0 && rr < CONFIG.ROWS && cc >= 0 && cc < CONFIG.COLS && g[rr][cc] === 0 && reach[rr][cc]) {
        pow[rr][cc] = true; pel[rr][cc] = false;
      }
    }
  }

  // ╔══════════════════════════════════════════════════════════════════════════╗
  // ║ INICIALIZACIÓN                                                          ║
  // ╚══════════════════════════════════════════════════════════════════════════╝
  document.addEventListener('DOMContentLoaded', () => {
    Editor.bindUI();
    Editor.updateToolButtons();
    fixPacManStartPosition();
  });

  // Comenzar juego
  requestAnimationFrame(tick);

})();
