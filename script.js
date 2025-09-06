// Pac-Man 4 Jugadores (Local) - JavaScript Mejorado
'use strict';

// Configuración básica
const TILE = 24;                 // Tamaño de celda en px
const ROWS = 21;                 // Filas del laberinto
const COLS = 28;                 // Columnas del laberinto
const CANVAS_W = COLS * TILE;
const CANVAS_H = ROWS * TILE;
const PELLET_SCORE = 10;
const POWER_PELLET_SCORE = 50;
const PAC_SPEED = 120;          // px/s
const GHOST_SPEED = 110;        // px/s
const GHOST_FRIGHT_SPEED = 80;  // px/s
const FRIGHT_TIME = 8;          // s

/** @type {HTMLCanvasElement} */
const canvas = document.getElementById('game');
canvas.width = CANVAS_W;
canvas.height = CANVAS_H;
const ctx = canvas.getContext('2d');
/** @type {HTMLDivElement} */
const hud = document.getElementById('hud');
const scoreHud = document.getElementById('scoreHud');
const btnEdit = document.getElementById('btnEdit');
const editorPanel = document.getElementById('editorPanel');
const editorOverlay = document.getElementById('editorOverlay');
const editorClose = document.getElementById('editorClose');
const gameWrap = document.getElementById('gameWrap');
const toolInfo = document.getElementById('toolInfo');

// Direcciones
const DIRS = {
  STOP: {x:0,y:0},
  LEFT: {x:-1,y:0}, RIGHT: {x:1,y:0}, UP: {x:0,y:-1}, DOWN: {x:0,y:1}
};

// Teclas por jugador
const KEYMAP = {
  // Pac‑Man con teclado numérico 8-4-5-6 (UP, LEFT, DOWN, RIGHT)
  pac: {
    'Numpad8':'UP', 'Numpad4':'LEFT', 'Numpad5':'DOWN', 'Numpad6':'RIGHT',
    // Fallback si el navegador reporta dígitos o no hay numpad
    '8':'UP', '4':'LEFT', '5':'DOWN', '6':'RIGHT'
  },
  g1:  { a:'LEFT', d:'RIGHT', w:'UP', s:'DOWN', A:'LEFT', D:'RIGHT', W:'UP', S:'DOWN' },
  g2:  { j:'LEFT', l:'RIGHT', i:'UP', k:'DOWN', J:'LEFT', L:'RIGHT', I:'UP', K:'DOWN' },
  // Fantasma 3 con flechas
  g3:  { ArrowLeft: 'LEFT', ArrowRight: 'RIGHT', ArrowUp: 'UP', ArrowDown: 'DOWN' },
};

// Laberinto: 0 = camino, 1 = pared
const grid = createGrid(ROWS, COLS, 0);
addBorders(grid);
addMazeGeometry(grid);

// Zona sin pellets (casa de fantasmas)
const ghostHouse = { r0: Math.floor(ROWS/2)-1, c0: Math.floor(COLS/2)-2, r1: Math.floor(ROWS/2)+1, c1: Math.floor(COLS/2)+2 };

// Pellets y super-pellets
const pellets = createGrid(ROWS, COLS, false);
const power = createGrid(ROWS, COLS, false);
seedPellets(pellets, power, grid);

let remainingPellets = countTrue(pellets) + countTrue(power);

// Baseline del mapa y pellets (para reinicios / guardar)
let baseGrid = cloneGrid(grid);
let basePellets = cloneGrid(pellets);
let basePower = cloneGrid(power);

// Entidades
function makeEntity(type, color, startR, startC, speed){
  return {
    type, color,
    x: startC * TILE + TILE/2,
    y: startR * TILE + TILE/2,
    startR, startC,
    dir: DIRS.STOP,
    next: DIRS.STOP,
    speed,
    score: 0,
    eatenAt: 0,
    trail: [], // Para efectos de estela
  };
}

// Posiciones iniciales
const pac = makeEntity('pac', '#FFEB3B', ROWS-3, Math.floor(COLS/2), PAC_SPEED);
const ghost1 = makeEntity('ghost', '#F44336', Math.floor(ROWS/2), Math.floor(COLS/2)-1, GHOST_SPEED);
const ghost2 = makeEntity('ghost', '#E91E63', Math.floor(ROWS/2), Math.floor(COLS/2), GHOST_SPEED);
const ghost3 = makeEntity('ghost', '#00BCD4', Math.floor(ROWS/2), Math.floor(COLS/2)+1, GHOST_SPEED);
ghost1.label = '1'; ghost2.label = '2'; ghost3.label = '3';
/** @type {Array<typeof pac>} */
const ghosts = [ghost1, ghost2, ghost3];
const players = [pac, ...ghosts];

// Estado del juego
let lastTime = performance.now();
let gameOver = false;
let winner = '';
let frightenedUntil = 0;
let editorMode = false;
let currentTool = 'wall';
let mouseDown = false;
let draftGrid = null, draftPellets = null, draftPower = null;

// Efectos visuales
let particles = [];
let scorePopups = [];

// Clase para partículas de efectos
class Particle {
  constructor(x, y, color, size = 2, life = 1) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 100;
    this.vy = (Math.random() - 0.5) * 100;
    this.color = color;
    this.size = size;
    this.life = life;
    this.maxLife = life;
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

// Clase para popups de puntuación
class ScorePopup {
  constructor(x, y, score) {
    this.x = x;
    this.y = y;
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

// Función para crear efectos de partículas
function createParticleEffect(x, y, color, count = 8) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color, Math.random() * 3 + 1, Math.random() * 0.5 + 0.5));
  }
}

// Función para añadir popup de puntuación
function addScorePopup(x, y, score) {
  scorePopups.push(new ScorePopup(x, y, score));
}

// Entrada
window.addEventListener('keydown', (e) => {
  // Prevenir scroll con teclas de flecha
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    e.preventDefault();
  }
  
  if (e.key === 'r' || e.key === 'R') { resetGame(); return; }
  if (e.key === 'e' || e.key === 'E') { toggleEditor(); return; }
  if (gameOver) return;
  if (editorMode) return; // sin controles de juego en modo editor
  const dirFromEvent = (map, ev) => {
    if (map[ev.key])  return DIRS[map[ev.key]];
    if (map[ev.code]) return DIRS[map[ev.code]];
    return null;
  };
  const pd = dirFromEvent(KEYMAP.pac, e);
  if (pd) { pac.next = pd; return; }
  const d1 = dirFromEvent(KEYMAP.g1, e); if (d1) { ghost1.next = d1; return; }
  const d2 = dirFromEvent(KEYMAP.g2, e); if (d2) { ghost2.next = d2; return; }
  const d3 = dirFromEvent(KEYMAP.g3, e); if (d3) { ghost3.next = d3; return; }
});

function resetGame(){
  // Recolocar entidades y restaurar pellets
  players.forEach(p => {
    p.x = p.startC * TILE + TILE/2;
    p.y = p.startR * TILE + TILE/2;
    p.dir = DIRS.STOP; p.next = DIRS.STOP; p.eatenAt = 0;
    p.trail = [];
  });
  frightenedUntil = 0;
  particles = [];
  scorePopups = [];
  // Restaurar desde baseline
  copyInto(baseGrid, grid);
  copyInto(basePellets, pellets);
  copyInto(basePower, power);
  remainingPellets = countTrue(pellets) + countTrue(power);
  gameOver = false; winner='';
}

// Bucle principal
function tick(now){
  const dt = Math.min(0.033, (now - lastTime)/1000);
  lastTime = now;
  update(dt, now/1000);
  draw(now/1000);
  requestAnimationFrame(tick);
}

function update(dt, t){
  if (editorMode) return;
  if (gameOver) return;
  
  // Actualizar efectos
  particles = particles.filter(p => p.update(dt));
  scorePopups = scorePopups.filter(p => p.update(dt));
  
  // Actualizar jugadores
  updateMover(pac, dt);
  for (const g of ghosts){ updateMover(g, dt, t); }
  
  // Actualizar estelas
  players.forEach(p => {
    p.trail.push({x: p.x, y: p.y, time: t});
    p.trail = p.trail.filter(point => t - point.time < 0.3);
  });
  
  // Comer pellets
  const [pr, pc] = toCell(pac.x, pac.y);
  if (power[pr][pc]) { 
    power[pr][pc] = false; 
    remainingPellets--; 
    pac.score += POWER_PELLET_SCORE; 
    frightenedUntil = t + FRIGHT_TIME;
    createParticleEffect(pac.x, pac.y, '#FFD700', 12);
    addScorePopup(pac.x, pac.y, POWER_PELLET_SCORE);
  }
  else if (pellets[pr][pc]) { 
    pellets[pr][pc] = false; 
    remainingPellets--; 
    pac.score += PELLET_SCORE;
    createParticleEffect(pac.x, pac.y, '#FFA500', 4);
    addScorePopup(pac.x, pac.y, PELLET_SCORE);
  }
  
  // Condición de victoria
  if (remainingPellets <= 0){ gameOver = true; winner = 'Pac‑Man'; }
  
  // Colisiones
  for (const g of ghosts){
    const d2 = (pac.x-g.x)*(pac.x-g.x) + (pac.y-g.y)*(pac.y-g.y);
    if (d2 < (TILE*0.6)*(TILE*0.6)){
      if (t < frightenedUntil){
        pac.score += 200;
        createParticleEffect(g.x, g.y, g.color, 15);
        addScorePopup(g.x, g.y, 200);
        respawn(g);
      } else {
        gameOver = true; winner = 'Fantasmas';
        createParticleEffect(pac.x, pac.y, '#FF0000', 20);
      }
    }
  }
}

function respawn(entity){
  entity.x = entity.startC * TILE + TILE/2;
  entity.y = entity.startR * TILE + TILE/2;
  entity.dir = DIRS.STOP;
  entity.next = DIRS.STOP;
  entity.eatenAt = performance.now()/1000;
}

function isFrightened(t){ return t < frightenedUntil; }

function updateMover(e, dt, t=performance.now()/1000){
  // Lógica de movimiento original...
  const [r, c] = toCell(e.x, e.y);
  const centerX = c*TILE + TILE/2;
  const centerY = r*TILE + TILE/2;
  const nearCenter = Math.abs(e.x-centerX) < 0.5 && Math.abs(e.y-centerY) < 0.5;
  if (nearCenter){ e.x = centerX; e.y = centerY; }

  if (nearCenter && e.next !== e.dir && canGo(r, c, e.next)){
    e.dir = e.next;
  }
  if (nearCenter && !canGo(r, c, e.dir)){
    e.dir = DIRS.STOP;
  }

  let speed = e.speed;
  if (e.type==='ghost' && isFrightened(t)) speed = GHOST_FRIGHT_SPEED;

  const dx = e.dir.x * speed * dt;
  const dy = e.dir.y * speed * dt;

  if (!nearCenter){
    e.x += dx; e.y += dy;
  } else {
    let nr = r + e.dir.y;
    let nc = c + e.dir.x;
    if (nc < 0) nc = COLS-1;
    if (nc >= COLS) nc = 0;
    if (nr < 0) nr = 0;
    if (nr >= ROWS) nr = ROWS-1;
    if (grid[nr][nc] === 0){
      e.x += dx; e.y += dy;
    }
  }

  if (e.x < -TILE/2) e.x = COLS*TILE - TILE/2;
  if (e.x > COLS*TILE + TILE/2) e.x = TILE/2;
}

function canGo(r,c,dir){
  let nr = r + dir.y;
  let nc = c + dir.x;
  if (nc < 0) nc = COLS-1;
  if (nc >= COLS) nc = 0;
  if (nr < 0 || nr >= ROWS) return false;
  return grid[nr][nc] === 0;
}

function toCell(x,y){
  const c = Math.floor(x / TILE);
  const r = Math.floor(y / TILE);
  return [clamp(r,0,ROWS-1), clamp(c,0,COLS-1)];
}

function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }

// Renderizado mejorado
function draw(t){
  // Fondo con gradiente
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, '#000814');
  gradient.addColorStop(0.5, '#001122');
  gradient.addColorStop(1, '#000814');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawGrid();
  drawPellets(t);
  
  // Dibujar estelas
  drawTrails();
  
  // Fantasmas
  for (const g of ghosts){ drawGhost(g, isFrightened(t), t); }
  // Pac-Man
  drawPac(pac, t);
  
  // Efectos
  particles.forEach(p => p.draw(ctx));
  scorePopups.forEach(p => p.draw(ctx));

  // HUD
  hud.innerHTML = renderHUD();
  scoreHud.innerHTML = renderScoreHUD();
  
  // Overlay del editor (grilla)
  if (editorMode) { 
    drawEditorOverlay();
    drawCursorPreview();
  }

  if (gameOver){
    drawGameOverOverlay();
  }
}

function drawTrails() {
  players.forEach(p => {
    if (p.trail.length < 2) return;
    
    ctx.globalAlpha = 0.3;
    ctx.strokeStyle = p.color;
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    
    for (let i = 0; i < p.trail.length; i++) {
      const point = p.trail[i];
      if (i === 0) {
        ctx.moveTo(point.x, point.y);
      } else {
        ctx.lineTo(point.x, point.y);
      }
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  });
}

function drawGrid(){
  // Paredes con efectos de brillo
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (grid[r][c]===1){
        // Relleno base
        const gradient = ctx.createLinearGradient(c*TILE, r*TILE, (c+1)*TILE, (r+1)*TILE);
        gradient.addColorStop(0, '#1a4a8a');
        gradient.addColorStop(0.5, '#0b2545');
        gradient.addColorStop(1, '#051829');
        ctx.fillStyle = gradient;
        ctx.fillRect(c*TILE, r*TILE, TILE, TILE);
        
        // Borde brillante
        ctx.strokeStyle = '#00d4ff';
        ctx.lineWidth = 1;
        ctx.strokeRect(c*TILE+0.5, r*TILE+0.5, TILE-1, TILE-1);
        
        // Efecto de brillo interno
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)';
        ctx.lineWidth = 0.5;
        ctx.strokeRect(c*TILE+1.5, r*TILE+1.5, TILE-3, TILE-3);
      }
    }
  }
}

function drawPellets(t){
  // Pellets normales con animación
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (pellets[r][c]){
        const cx = c*TILE + TILE/2;
        const cy = r*TILE + TILE/2;
        const pulse = 1 + Math.sin(t * 8) * 0.2;
        const glow = 1 + Math.sin(t * 6) * 0.3;
        
        // Brillo
        ctx.shadowColor = '#ffd8a6';
        ctx.shadowBlur = 5 * glow;
        ctx.fillStyle = '#ffd8a6';
        ctx.beginPath(); 
        ctx.arc(cx, cy, 3 * pulse, 0, Math.PI*2); 
        ctx.fill();
        ctx.shadowBlur = 0;
      }
    }
  }
  
  // Super-pellets con animación intensa
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (power[r][c]){
        const cx = c*TILE + TILE/2;
        const cy = r*TILE + TILE/2;
        const pulse = 1 + Math.sin(t * 10) * 0.4;
        const rotation = t * 5;
        
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(rotation);
        
        // Brillo intenso
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        
        // Estrella de poder
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const angle = (i / 8) * Math.PI * 2;
          const radius = (i % 2 === 0) ? 8 * pulse : 4 * pulse;
          const x = Math.cos(angle) * radius;
          const y = Math.sin(angle) * radius;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
  }
}

function drawPac(p, t){
  const angle = Math.sin(t * 8) * 0.3 + 0.45;
  let start = 0.0, end = Math.PI*2;
  
  if (p.dir === DIRS.RIGHT) { start = angle; end = Math.PI*2 - angle; }
  if (p.dir === DIRS.LEFT)  { start = Math.PI + angle; end = Math.PI - angle; }
  if (p.dir === DIRS.UP)    { start = 1.5*Math.PI + angle; end = 1.5*Math.PI - angle; }
  if (p.dir === DIRS.DOWN)  { start = 0.5*Math.PI + angle; end = 0.5*Math.PI - angle; }
  
  // Brillo alrededor de Pac-Man
  ctx.shadowColor = p.color;
  ctx.shadowBlur = 20;
  
  ctx.fillStyle = p.color;
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  ctx.arc(p.x, p.y, TILE*0.45, start, end);
  ctx.closePath();
  ctx.fill();
  
  ctx.shadowBlur = 0;
}

function drawGhost(g, frightened, t){
  const body = frightened ? '#4ade80' : g.color;
  const r = TILE*0.45;
  
  // Brillo del fantasma
  if (frightened) {
    ctx.shadowColor = '#4ade80';
    ctx.shadowBlur = 15;
  } else {
    ctx.shadowColor = body;
    ctx.shadowBlur = 8;
  }
  
  // Cuerpo del fantasma con ondulación
  const wave = Math.sin(t * 10 + g.x * 0.1) * 2;
  ctx.fillStyle = body;
  ctx.beginPath();
  ctx.arc(g.x, g.y + wave, r, Math.PI, 0);
  ctx.lineTo(g.x + r, g.y + r*0.8 + wave);
  
  // Ondas inferiores animadas
  const waves = 4;
  for(let i=waves;i>=0;i--){
    const wx = g.x + (i/waves*2-1)*r;
    const wy = g.y + r*0.8 + (i%2?0.0:0.2)*r + wave + Math.sin(t * 8 + i) * 2;
    ctx.lineTo(wx, wy);
  }
  ctx.closePath();
  ctx.fill();
  
  // Ojos con animación
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff';
  const ox = g.dir.x*4, oy = g.dir.y*4;
  const eyeBlink = Math.sin(t * 20) > 0.9 ? 0.3 : 1;
  
  ctx.beginPath(); ctx.arc(g.x-7, g.y-2, 5*eyeBlink, 0, Math.PI*2); ctx.fill();
  ctx.beginPath(); ctx.arc(g.x+7, g.y-2, 5*eyeBlink, 0, Math.PI*2); ctx.fill();
  
  if (eyeBlink > 0.5) {
    ctx.fillStyle = '#1b2a4a';
    ctx.beginPath(); ctx.arc(g.x-7+ox, g.y-2+oy, 2.5, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(g.x+7+ox, g.y-2+oy, 2.5, 0, Math.PI*2); ctx.fill();
  }
  
  // Etiqueta del fantasma
  if (g.label){
    ctx.font = 'bold 14px Orbitron, monospace';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(g.label, g.x, g.y - r - 6);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(g.label, g.x, g.y - r - 6);
  }
}

function drawGameOverOverlay(){
  // Fondo semi-transparente
  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(0,0,canvas.width, canvas.height);
  
  // Panel central
  const centerX = canvas.width/2;
  const centerY = canvas.height/2;
  
  ctx.fillStyle = 'rgba(15, 25, 45, 0.95)';
  ctx.strokeStyle = '#00d4ff';
  ctx.lineWidth = 3;
  const panelW = 400, panelH = 150;
  ctx.fillRect(centerX - panelW/2, centerY - panelH/2, panelW, panelH);
  ctx.strokeRect(centerX - panelW/2, centerY - panelH/2, panelW, panelH);
  
  // Texto del ganador
  ctx.font = 'bold 32px Orbitron, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#FFD700';
  ctx.fillText(`🎉 ${winner} GANA! 🎉`, centerX, centerY - 20);
  
  ctx.font = '18px Space Mono, monospace';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText('Pulsa R para reiniciar', centerX, centerY + 20);
}

function renderScoreHUD(){
  return `🏆 Puntos: <span style="color: var(--accent-yellow);">${pac.score}</span> • 🟡 Pellets restantes: <span style="color: var(--accent-blue);">${remainingPellets}</span>`;
}

function renderHUD(){
  return [
    `<h3>🎮 Controles</h3>`,
    `<div class="row"><span class="player-info player-pacman">🟡 Pac‑Man</span> numpad: <span class="kbd">8</span> <span class="kbd">4</span> <span class="kbd">5</span> <span class="kbd">6</span></div>`,
    `<div class="row"><span class="player-info player-ghost1">🔴 Fantasma 1</span> <span class="kbd">W</span><span class="kbd">A</span><span class="kbd">S</span><span class="kbd">D</span></div>`,
    `<div class="row"><span class="player-info player-ghost2">🟣 Fantasma 2</span> <span class="kbd">I</span><span class="kbd">J</span><span class="kbd">K</span><span class="kbd">L</span></div>`,
    `<div class="row"><span class="player-info player-ghost3">🔵 Fantasma 3</span> flechas: <span class="kbd">↑</span> <span class="kbd">↓</span> <span class="kbd">←</span> <span class="kbd">→</span></div>`,
    `<div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid rgba(0, 212, 255, 0.2);">`,
    `<div class="row">⭐ <strong>Super‑pellet:</strong> fantasmas asustados ${FRIGHT_TIME}s</div>`,
    `<div class="row">🎨 <span class="kbd">E</span> - Activar editor de mapas</div>`,
    `<div class="row">🔄 <span class="kbd">R</span> - Reiniciar juego</div>`,
    `</div>`
  ].join('');
}

// Resto de funciones (sin cambios significativos)...
function createGrid(r,c,fill){
  return Array.from({length:r}, ()=>Array.from({length:c}, ()=>fill));
}

function countTrue(m){
  let n=0; for(let r=0;r<m.length;r++){ for(let c=0;c<m[0].length;c++){ if (m[r][c]) n++; }} return n;
}

// Contar pellets/super‑pellets excluyendo un rectángulo (e.g., casa de fantasmas)
function countPelletsExcludingRect(pel, pow, rect){
  let n = 0;
  for (let r = 0; r < pel.length; r++){
    for (let c = 0; c < pel[0].length; c++){
      if (r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1) continue;
      if (pel[r][c] || pow[r][c]) n++;
    }
  }
  return n;
}

function hasPelletsOutsideGhostHouse(){
  return countPelletsExcludingRect(pellets, power, ghostHouse) > 0;
}

function updateSaveButtonState(){
  const btn = document.getElementById('btnSaveEdit');
  if (!btn) return;
  const ok = hasPelletsOutsideGhostHouse();
  btn.disabled = !ok;
  btn.title = ok
    ? 'Guardar cambios'
    : 'Agrega al menos un pellet o súper‑pellet fuera de la casa de fantasmas para poder guardar';
}

function cloneGrid(src){
  return src.map(row => row.slice());
}

function copyInto(src, dst){
  for (let r=0;r<src.length;r++){
    for (let c=0;c<src[0].length;c++) dst[r][c] = src[r][c];
  }
}

// Editor con mejoras visuales
function toggleEditor(){ setEditorMode(!editorMode); }

function setEditorMode(on){
  editorMode = on;
  if (on){
    draftGrid = cloneGrid(grid);
    draftPellets = cloneGrid(pellets);
    draftPower = cloneGrid(power);
  }
  
  // Activar/desactivar el sidebar
  editorPanel.classList.toggle('active', on);
  editorOverlay.classList.toggle('active', on);
  gameWrap.classList.toggle('editor-active', on);
  canvas.classList.toggle('editor-active', on);
  toolInfo.classList.toggle('active', on);
  
  canvas.style.cursor = on ? 'crosshair' : 'default';
  
  if (on) {
    toolInfo.textContent = `🛠️ Modo editor activo • Herramienta: ${currentTool}`;
  } else {
    toolInfo.textContent = '';
  }
  
  // Actualizar botones activos
  updateToolButtons();
  if (on) updateSaveButtonState();
}

function updateToolButtons() {
  document.querySelectorAll('.toolBtn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tool === currentTool);
  });
}

// Event listeners del editor
btnEdit.addEventListener('click', () => toggleEditor());

// Botón de cerrar del sidebar
editorClose.addEventListener('click', () => {
  // Cerrar como "Cancelar": restaurar borrador y salir
  if (draftGrid && draftPellets && draftPower){
    copyInto(draftGrid, grid);
    copyInto(draftPellets, pellets);
    copyInto(draftPower, power);
    remainingPellets = countTrue(pellets) + countTrue(power);
  }
  setEditorMode(false);
});

// Cerrar al hacer click en el overlay (se trata como Cancelar)
editorOverlay.addEventListener('click', () => {
  if (draftGrid && draftPellets && draftPower){
    copyInto(draftGrid, grid);
    copyInto(draftPellets, pellets);
    copyInto(draftPower, power);
    remainingPellets = countTrue(pellets) + countTrue(power);
  }
  setEditorMode(false);
});

document.getElementById('btnCancelEdit').addEventListener('click', () => {
  if (draftGrid && draftPellets && draftPower){
    copyInto(draftGrid, grid);
    copyInto(draftPellets, pellets);
    copyInto(draftPower, power);
  }
  // Recalcular contador y cerrar
  remainingPellets = countTrue(pellets) + countTrue(power);
  setEditorMode(false);
});

document.getElementById('btnSaveEdit').addEventListener('click', () => {
  // Validar que exista al menos un pellet/súper‑pellet útil (fuera de la casa)
  if (!hasPelletsOutsideGhostHouse()){
    alert('No puedes guardar: coloca al menos un pellet o súper‑pellet fuera de la casa de fantasmas.');
    updateSaveButtonState();
    return;
  }

  addBorders(grid);
  clearPelletsInRect(pellets, power, ghostHouse);
  baseGrid = cloneGrid(grid);
  basePellets = cloneGrid(pellets);
  basePower = cloneGrid(power);
  setEditorMode(false);
  resetGame();
});

document.getElementById('btnClearWalls').addEventListener('click', () => {
  for (let r=1;r<ROWS-1;r++){
    for (let c=1;c<COLS-1;c++) grid[r][c] = 0;
  }
});

document.getElementById('btnClearPellets').addEventListener('click', () => {
  for (let r=0;r<ROWS;r++){ for (let c=0;c<COLS;c++){ pellets[r][c]=false; power[r][c]=false; }}
  remainingPellets = 0;
  updateSaveButtonState();
});

for (const b of document.querySelectorAll('.toolBtn')){
  b.addEventListener('click', (ev) => {
    currentTool = ev.currentTarget.getAttribute('data-tool');
    
    // Mapear nombres de herramientas más descriptivos
    const toolNames = {
      'wall': 'Pared 🧱',
      'empty': 'Vacío ⭕', 
      'pellet': 'Pellet 🟡',
      'power': 'Súper Pellet ⭐'
    };
    
    toolInfo.textContent = `🛠️ Modo editor activo • Herramienta: ${toolNames[currentTool]}`;
    updateToolButtons();
  });
}

canvas.addEventListener('mousedown', (e) => { if (!editorMode) return; mouseDown=true; paintFromEvent(e); });
window.addEventListener('mouseup', () => { mouseDown=false; });
canvas.addEventListener('mousemove', (e) => { 
  if (mouseDown && editorMode) paintFromEvent(e); 
  if (editorMode) showCursorPreview(e);
});
canvas.addEventListener('mouseleave', () => { hideCursorPreview(); });

// Preview del cursor
let cursorPreview = null;

function showCursorPreview(e) {
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  const c = Math.floor(mx / TILE);
  const r = Math.floor(my / TILE);
  
  // Verificar si está en una celda válida para editar
  if (r<=0 || r>=ROWS-1 || c<=0 || c>=COLS-1) {
    hideCursorPreview();
    return;
  }
  
  cursorPreview = { r, c };
}

function hideCursorPreview() {
  cursorPreview = null;
}

function drawCursorPreview() {
  if (!editorMode || !cursorPreview) return;
  
  const { r, c } = cursorPreview;
  const x = c * TILE;
  const y = r * TILE;
  
  // Color según la herramienta
  let color = 'rgba(255, 255, 255, 0.3)';
  if (currentTool === 'wall') color = 'rgba(0, 212, 255, 0.4)';
  else if (currentTool === 'empty') color = 'rgba(255, 0, 0, 0.3)';
  else if (currentTool === 'pellet') color = 'rgba(255, 215, 0, 0.4)';
  else if (currentTool === 'power') color = 'rgba(255, 215, 0, 0.6)';
  
  ctx.fillStyle = color;
  ctx.fillRect(x, y, TILE, TILE);
  
  // Borde del preview
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
  ctx.lineWidth = 2;
  ctx.strokeRect(x+1, y+1, TILE-2, TILE-2);
}

function paintFromEvent(e){
  const rect = canvas.getBoundingClientRect();
  const mx = (e.clientX - rect.left) * (canvas.width / rect.width);
  const my = (e.clientY - rect.top) * (canvas.height / rect.height);
  const c = Math.floor(mx / TILE);
  const r = Math.floor(my / TILE);
  
  // Mantener anillo del borde sin editar
  if (r<=0 || r>=ROWS-1 || c<=0 || c>=COLS-1) return;
  
  // Aplicar la herramienta
  if (currentTool === 'wall'){
    if (grid[r][c] !== 1) {
      grid[r][c] = 1; 
      pellets[r][c] = false; 
      power[r][c] = false;
      // Actualizar contador de pellets
      remainingPellets = countTrue(pellets) + countTrue(power);
      updateSaveButtonState();
    }
  } else if (currentTool === 'empty'){
    if (grid[r][c] !== 0) {
      grid[r][c] = 0;
    }
  } else if (currentTool === 'pellet'){
    if (grid[r][c] === 0 && !pellets[r][c]) { 
      pellets[r][c] = true; 
      power[r][c] = false;
      remainingPellets = countTrue(pellets) + countTrue(power);
      updateSaveButtonState();
    }
  } else if (currentTool === 'power'){
    if (grid[r][c] === 0 && !power[r][c]) { 
      power[r][c] = true; 
      pellets[r][c] = false;
      remainingPellets = countTrue(pellets) + countTrue(power);
      updateSaveButtonState();
    }
  }
}

function drawEditorOverlay(){
  // Solo mostrar la grilla cuando estamos en modo editor
  if (!editorMode) return;
  
  // NO aplicar overlay oscuro, solo la grilla
  // Grilla visible para ayudar en la edición
  ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  
  for (let r=1;r<ROWS-1;r++){
    ctx.beginPath(); 
    ctx.moveTo(0, r*TILE); 
    ctx.lineTo(COLS*TILE, r*TILE); 
    ctx.stroke();
  }
  for (let c=1;c<COLS-1;c++){
    ctx.beginPath(); 
    ctx.moveTo(c*TILE, 0); 
    ctx.lineTo(c*TILE, ROWS*TILE); 
    ctx.stroke();
  }
  
  ctx.setLineDash([]); // Resetear el patrón de líneas
  
  // Resaltar las celdas no editables (bordes)
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 2;
  // Borde superior
  ctx.strokeRect(0, 0, COLS*TILE, TILE);
  // Borde inferior  
  ctx.strokeRect(0, (ROWS-1)*TILE, COLS*TILE, TILE);
  // Borde izquierdo
  ctx.strokeRect(0, 0, TILE, ROWS*TILE);
  // Borde derecho
  ctx.strokeRect((COLS-1)*TILE, 0, TILE, ROWS*TILE);
}

// Funciones de generación del laberinto (sin cambios)
function addBorders(g){
  for (let r=0;r<ROWS;r++){ g[r][0]=1; g[r][COLS-1]=1; }
  for (let c=0;c<COLS;c++){ g[0][c]=1; g[ROWS-1][c]=1; }
}

function addRect(g, r0,c0,r1,c1){
  for (let r=r0;r<=r1;r++){
    for (let c=c0;c<=c1;c++) g[r][c]=1;
  }
}

// ====== TU MAPA PERSONALIZADO ======
// Puedes modificar esta función para crear el mapa que quieras
function addMazeGeometry(g){
  const cr = Math.floor(ROWS/2);
  const cc = Math.floor(COLS/2);

  const hWall = (r, c0, c1) => { for(let c=c0;c<=c1;c++) g[r][c]=1; };
  const vWall = (c, r0, r1) => { for(let r=r0;r<=r1;r++) g[r][c]=1; };
  const open  = (r,c) => { if (r>=0&&r<ROWS&&c>=0&&c<COLS) g[r][c]=0; };
  const rect  = (r0,c0,r1,c1)=>{ for(let r=r0;r<=r1;r++)for(let c=c0;c<=c1;c++)g[r][c]=1; };

  // 1) Bordes exteriores
  hWall(0, 0, COLS-1);
  hWall(ROWS-1, 0, COLS-1);
  vWall(0, 0, ROWS-1);
  vWall(COLS-1, 0, ROWS-1);

  // 2) Anillo interior (rectángulo hueco)
  //   ####### 
  //   #     #   → deja 2 celdas de margen entre borde exterior e interior
  //   #######
  hWall(2, 2, COLS-3);
  hWall(ROWS-3, 2, COLS-3);
  vWall(2, 2, ROWS-3);
  vWall(COLS-3, 2, ROWS-3);

  // 3) Ejes centrales (cruz)
  hWall(cr, 3, COLS-4);
  vWall(cc, 3, ROWS-4);

  // 4) Casa de fantasmas en el centro (5x7) con salida HORIZONTAL
  rect(cr-2, cc-3, cr+2, cc+3);

  // Abrimos boquita horizontal: cc-2..cc+2 en la FILA central
  for (let c = cc-2; c <= cc+2; c++) open(cr, c);

  // 5) Conectar la casa a los pasillos laterales (corredores horizontales)
  // abrimos un corredor continuo por la fila central
  for (let c = 1; c < COLS-1; c++) open(cr, c);

  // 6) Túneles laterales (wrap)
  open(cr, 0);
  open(cr, COLS-1);

  // 7) Salas de las esquinas (bloques con una abertura)
  rect(3, 3, 5, 6);          open(4, 6);
  rect(3, COLS-7, 5, COLS-4); open(4, COLS-7);
  rect(ROWS-6, 3, ROWS-4, 6); open(ROWS-5, 6);
  rect(ROWS-6, COLS-7, ROWS-4, COLS-4); open(ROWS-5, COLS-7);

  // 8) Pasillos verticales adicionales (para loops)
  vWall(6, 6, ROWS-7); open(cr, 6);
  vWall(COLS-7, 6, ROWS-7); open(cr, COLS-7);

  // 9) Pequeños bloques simétricos en la mitad inferior
  rect(cr+3, cc-9, cr+4, cc-7);
  rect(cr+3, cc-2, cr+4, cc);
  rect(cr+3, cc+7, cr+4, cc+9);

  // 10) Limpia un par de pasos verticales para que no queden cul-de-sacs
  open(cr-4, cc);
  open(cr+4, cc);
}

function seedPellets(pel, pow, g){
  // limpia
  for (let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){ pel[r][c]=false; pow[r][c]=false; }

  // desde la posición inicial de Pac-Man calculamos alcanzables
  const startR = ROWS-3;
  const startC = Math.floor(COLS/2);
  const reach = computeReachable(g, startR, startC);

  // pellets en todos los caminos alcanzables
  for (let r=0;r<ROWS;r++){
    for (let c=0;c<COLS;c++){
      if (g[r][c]===0 && reach[r][c]) pel[r][c] = true;
    }
  }

  // quita pellets dentro de la casa de fantasmas
  clearPelletsInRect(pel, pow, ghostHouse);

  // SÚPER-PELLETS: 4 esquinas interiores + 2 en el corredor central
  const corners = [
    [3,3], [3, COLS-4], [ROWS-4, 3], [ROWS-4, COLS-4]
  ];
  const midLane = [
    [Math.floor(ROWS/2), 5], [Math.floor(ROWS/2), COLS-6]
  ];

  for (const [rr,cc] of [...corners, ...midLane]){
    if (rr>=0 && rr<ROWS && cc>=0 && cc<COLS && g[rr][cc]===0 && reach[rr][cc]) {
      pow[rr][cc] = true;
      pel[rr][cc] = false;
    }
  }
}

function computeReachable(g, sr, sc){
  const vis = createGrid(ROWS, COLS, false);
  const q = [[sr,sc]]; vis[sr][sc]=true;
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  while(q.length){
    const [r,c] = q.shift();
    for (const [dy,dx] of dirs){
      const nr = r+dy, nc = c+dx;
      if (nr<0||nr>=ROWS||nc<0||nc>=COLS) continue;
      if (vis[nr][nc]) continue;
      if (g[nr][nc]!==0) continue;
      vis[nr][nc] = true; q.push([nr,nc]);
    }
  }
  return vis;
}

function clearPelletsInRect(pel, pow, rect){
  for (let r=rect.r0;r<=rect.r1;r++){
    for (let c=rect.c0;c<=rect.c1;c++){
      pel[r][c] = false; pow[r][c] = false;
    }
  }
}

// Inicializar herramienta por defecto
document.addEventListener('DOMContentLoaded', () => {
  updateToolButtons();
});

// Iniciar juego
requestAnimationFrame(tick);
