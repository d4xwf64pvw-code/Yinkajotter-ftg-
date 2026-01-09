// Yinkajotter ftg - Pong-like football game with sound, difficulty and touch support

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const W = canvas.width;
const H = canvas.height;

// Game objects
const paddleWidth = 12;
const paddleHeight = 90;
const player = { x: 12, y: (H - paddleHeight) / 2, w: paddleWidth, h: paddleHeight, baseSpeed: 6 };
const ai =     { x: W - paddleWidth - 12, y: (H - paddleHeight) / 2, w: paddleWidth, h: paddleHeight, baseSpeed: 4 };

const ballRadius = 9;
let ball = { x: W/2, y: H/2, vx: 5, vy: 3, r: ballRadius };

// Score
let leftScore = 0, rightScore = 0;
const leftScoreEl = document.getElementById('leftScore');
const rightScoreEl = document.getElementById('rightScore');

// UI
const difficultySelect = document.getElementById('difficulty');
const soundToggle = document.getElementById('soundToggle');

// Input state
let upPressed = false;
let downPressed = false;
let touching = false;

// Difficulty settings
const difficulties = {
  easy:       { aiSpeed: 3.0, aiReaction: 0.12, ballSpeed: 4.5 },
  normal:     { aiSpeed: 4.2, aiReaction: 0.15, ballSpeed: 5.0 },
  hard:       { aiSpeed: 5.0, aiReaction: 0.2,  ballSpeed: 5.6 },
  impossible: { aiSpeed: 8.0, aiReaction: 0.28, ballSpeed: 6.4 }
};

function getDifficulty(){
  return localStorage.getItem('yinkajotter:difficulty') || 'normal';
}
function setDifficulty(key){
  difficultySelect.value = key;
  localStorage.setItem('yinkajotter:difficulty', key);
}
setDifficulty(getDifficulty());
difficultySelect.addEventListener('change', ()=> {
  setDifficulty(difficultySelect.value);
  resetBall(true);
});

// Sound - lightweight WebAudio tones
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
}
function playTone(type='blip', freq=440, duration=0.06, gain=0.08) {
  if (!soundToggle.checked) return;
  try {
    ensureAudio();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type === 'blip' ? 'sine' : 'square';
    o.frequency.value = freq;
    g.gain.value = gain;
    o.connect(g);
    g.connect(audioCtx.destination);
    o.start();
    g.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    o.stop(audioCtx.currentTime + duration + 0.02);
  } catch (e) {
    // WebAudio may be blocked until user gesture. Ignore gracefully.
  }
}

// Draw helpers
function drawRoundedRect(x,y,w,h, r=6){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y, x+w,y+h, r);
  ctx.arcTo(x+w,y+h, x,y+h, r);
  ctx.arcTo(x,y+h, x,y, r);
  ctx.arcTo(x,y, x+w,y, r);
  ctx.closePath();
  ctx.fill();
}

function draw() {
  // background
  ctx.clearRect(0,0,W,H);
  ctx.fillStyle = '#071a2a';
  ctx.fillRect(0,0,W,H);

  // center dashed line
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 12]);
  ctx.beginPath();
  ctx.moveTo(W/2, 0);
  ctx.lineTo(W/2, H);
  ctx.stroke();
  ctx.setLineDash([]);

  // paddles
  ctx.fillStyle = '#e2b24a';
  drawRoundedRect(player.x, player.y, player.w, player.h, 6);
  ctx.fillStyle = '#9cc3ff';
  drawRoundedRect(ai.x, ai.y, ai.w, ai.h, 6);

  // ball (football look - simple)
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI*2);
  ctx.fill();

  // stitches
  ctx.strokeStyle = '#222';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(ball.x - 3, ball.y - 5);
  ctx.lineTo(ball.x + 5, ball.y);
  ctx.stroke();
}

// Paddle collision detection helper (AABB vs circle)
function paddleCollide(p){
  const closestX = Math.max(p.x, Math.min(ball.x, p.x + p.w));
  const closestY = Math.max(p.y, Math.min(ball.y, p.y + p.h));
  const distX = ball.x - closestX;
  const distY = ball.y - closestY;
  return (distX*distX + distY*distY) <= (ball.r * ball.r);
}

// Game loop & logic
let running = true;
function update() {
  const diff = difficulties[getDifficulty()];

  // Player movement by keys
  if (upPressed) player.y -= player.baseSpeed;
  if (downPressed) player.y += player.baseSpeed;

  // Keep player inside
  player.y = Math.max(0, Math.min(H - player.h, player.y));

  // AI
  const aiCenter = ai.y + ai.h / 2;
  const dy = ball.y - aiCenter;
  const aiMaxMove = diff.aiSpeed;
  if (Math.abs(dy) > 6) {
    ai.y += Math.sign(dy) * Math.min(aiMaxMove, Math.abs(dy) * diff.aiReaction);
  }
  ai.y = Math.max(0, Math.min(H - ai.h, ai.y));

  // Ball movement
  ball.x += ball.vx;
  ball.y += ball.vy;

  // Wall collision
  if (ball.y - ball.r <= 0) {
    ball.y = ball.r;
    ball.vy *= -1;
    playTone('square', 420, 0.08, 0.06); // wall bounce sound
  }
  if (ball.y + ball.r >= H) {
    ball.y = H - ball.r;
    ball.vy *= -1;
    playTone('square', 420, 0.08, 0.06);
  }

  // Left paddle collision
  if (paddleCollide(player) && ball.vx < 0) {
    const rel = (ball.y - (player.y + player.h/2)) / (player.h/2);
    const bounceAngle = rel * (Math.PI / 3);
    const speed = Math.hypot(ball.vx, ball.vy) * 1.05;
    ball.vx = Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle);
    ball.x = player.x + player.w + ball.r + 0.5;
    playTone('sine', 560 + Math.abs(ball.vy)*10, 0.06, 0.08); // paddle hit
  }

  // Right paddle collision
  if (paddleCollide(ai) && ball.vx > 0) {
    const rel = (ball.y - (ai.y + ai.h/2)) / (ai.h/2);
    const bounceAngle = rel * (Math.PI / 3);
    const speed = Math.hypot(ball.vx, ball.vy) * 1.03;
    ball.vx = -Math.abs(speed * Math.cos(bounceAngle));
    ball.vy = speed * Math.sin(bounceAngle);
    ball.x = ai.x - ball.r - 0.5;
    playTone('sine', 420 + Math.abs(ball.vy)*8, 0.06, 0.07);
  }

  // Score
  if (ball.x - ball.r <= 0) {
    rightScore++;
    rightScoreEl.textContent = rightScore;
    playTone('square', 220, 0.35, 0.12); // score tone
    resetAfterScore();
  } else if (ball.x + ball.r >= W) {
    leftScore++;
    leftScoreEl.textContent = leftScore;
    playTone('square', 660, 0.35, 0.12);
    resetAfterScore();
  }
}

let scoreTimeout = null;
function resetAfterScore(){
  running = false;
  if (scoreTimeout) clearTimeout(scoreTimeout);
  scoreTimeout = setTimeout(() => {
    resetBall(Math.random() > 0.5);
    running = true;
    loop();
  }, 900);
}

function resetBall(servingRight = true){
  const diff = difficulties[getDifficulty()];
  ball.x = W/2;
  ball.y = H/2;
  const angle = (Math.random() * Math.PI/3) - (Math.PI/6); // -30°..30°
  const speed = diff.ballSpeed;
  ball.vx = (servingRight ? 1 : -1) * Math.abs(Math.cos(angle)) * speed;
  ball.vy = Math.sin(angle) * speed;
}

// Input handlers
canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const y = e.clientY - rect.top;
  player.y = y - player.h / 2;
  player.y = Math.max(0, Math.min(H - player.h, player.y));
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp') { upPressed = true; e.preventDefault(); }
  if (e.key === 'ArrowDown') { downPressed = true; e.preventDefault(); }
  // resume audio on user gesture
  if (e.key === ' ' || e.key === 'Enter') ensureAudio();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp') upPressed = false;
  if (e.key === 'ArrowDown') downPressed = false;
});

// Touch support: drag to move paddle
canvas.addEventListener('touchstart', (e) => {
  touching = true;
  ensureAudio();
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const y = t.clientY - rect.top;
  player.y = y - player.h / 2;
  player.y = Math.max(0, Math.min(H - player.h, player.y));
  e.preventDefault();
}, {passive:false});
canvas.addEventListener('touchmove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const t = e.touches[0];
  const y = t.clientY - rect.top;
  player.y = y - player.h / 2;
  player.y = Math.max(0, Math.min(H - player.h, player.y));
  e.preventDefault();
}, {passive:false});
canvas.addEventListener('touchend', (e) => { touching = false; });

// On-screen buttons for mobile
const btnUp = document.getElementById('btnUp');
const btnDown = document.getElementById('btnDown');

function holdButton(el, onPress, onRelease){
  let timer = null;
  function start(e){
    onPress();
    timer = setInterval(onPress, 60);
    e.preventDefault();
  }
  function end(){
    if (timer) clearInterval(timer);
    onRelease();
  }
  el.addEventListener('touchstart', start, {passive:false});
  el.addEventListener('mousedown', start);
  window.addEventListener('touchend', end);
  window.addEventListener('mouseup', end);
}

holdButton(btnUp, ()=>{ player.y -= player.baseSpeed; player.y = Math.max(0, player.y); }, ()=>{});
holdButton(btnDown, ()=>{ player.y += player.baseSpeed; player.y = Math.min(H-player.h, player.y); }, ()=>{});

// Make canvas focusable
canvas.addEventListener('click', ()=>{ canvas.focus(); ensureAudio(); });

// Loop
function loop(){
  if (!running) return;
  update();
  draw();
  requestAnimationFrame(loop);
}

// Init
resetBall(Math.random() > 0.5);
loop();

// Sound toggle persistence
soundToggle.checked = localStorage.getItem('yinkajotter:sound') !== 'false';
soundToggle.addEventListener('change', ()=> {
  localStorage.setItem('yinkajotter:sound', soundToggle.checked ? 'true' : 'false');
  if (soundToggle.checked) ensureAudio();
});

// Expose simple restart (optional)
window.Yinkajotter = {
  resetScores: () => { leftScore = 0; rightScore = 0; leftScoreEl.textContent = '0'; rightScoreEl.textContent = '0'; resetBall(true); }
};
