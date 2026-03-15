/**
 * DebashisGuruEye v2 — script.js
 *
 * New features vs v1:
 *  - WebGL backend forced for fastest GPU inference
 *  - detectBusy flag prevents overlapping model.detect() calls
 *  - Photo Scan: capture snapshot & analyse with drawn boxes
 *  - Object Info Panel: name, confidence, description, uses
 *  - Detection History: persisted to localStorage, max 50 entries
 *  - Voice interaction: Web Speech API — say "What is this?"
 *  - Glowing bounding boxes with corner accents + class-specific colors
 *  - Mobile-safe: plain {video:true} first, playsinline, no env constraint
 */

'use strict';

// ── OBJECT KNOWLEDGE BASE ────────────────────────────────────────
// Short descriptions & use-cases for COCO-SSD classes
const OBJECT_KB = {
  person:       { desc: 'A human being captured in the camera frame.',         uses: ['Identity', 'Crowd analysis', 'Pose estimation'] },
  bicycle:      { desc: 'A two-wheeled pedal-powered vehicle.',                uses: ['Transport', 'Fitness', 'Delivery'] },
  car:          { desc: 'A four-wheeled motor vehicle for road travel.',        uses: ['Transport', 'Navigation', 'Parking detection'] },
  motorcycle:   { desc: 'A two-wheeled motorised vehicle.',                    uses: ['Transport', 'Racing', 'Courier'] },
  airplane:     { desc: 'A powered fixed-wing aircraft for air travel.',       uses: ['Aviation', 'Travel', 'Cargo'] },
  bus:          { desc: 'A large road vehicle for carrying passengers.',        uses: ['Public transport', 'Tourism', 'School'] },
  train:        { desc: 'A rail vehicle running on tracks.',                   uses: ['Rail transport', 'Cargo', 'Commute'] },
  truck:        { desc: 'A large motor vehicle for carrying loads.',           uses: ['Freight', 'Construction', 'Logistics'] },
  boat:         { desc: 'A small watercraft for water travel.',                uses: ['Fishing', 'Recreation', 'Transport'] },
  'traffic light': { desc: 'A signalling device for controlling road traffic.',uses: ['Road safety', 'Autonomous driving', 'Traffic management'] },
  'fire hydrant':  { desc: 'A street-side water outlet for firefighting.',     uses: ['Fire safety', 'Emergency services'] },
  'stop sign':     { desc: 'A red octagonal road sign requiring vehicles to halt.', uses: ['Road safety', 'Traffic control'] },
  bench:        { desc: 'A long seat for multiple people, often outdoors.',    uses: ['Seating', 'Parks', 'Rest areas'] },
  bird:         { desc: 'A feathered warm-blooded vertebrate animal.',         uses: ['Wildlife monitoring', 'Birdwatching', 'Research'] },
  cat:          { desc: 'A small domesticated carnivorous mammal.',            uses: ['Pet care', 'Animal detection', 'Companionship'] },
  dog:          { desc: 'A domesticated canine, loyal companion to humans.',   uses: ['Pet care', 'Security', 'Service animal'] },
  horse:        { desc: 'A large four-legged mammal used for riding.',         uses: ['Equestrian', 'Racing', 'Agriculture'] },
  sheep:        { desc: 'A domesticated ruminant mammal reared for wool/meat.',uses: ['Agriculture', 'Livestock', 'Farming'] },
  cow:          { desc: 'A large domesticated bovine animal.',                 uses: ['Agriculture', 'Dairy', 'Beef production'] },
  elephant:     { desc: 'The largest land animal, known for its trunk.',       uses: ['Wildlife', 'Conservation', 'Tourism'] },
  bear:         { desc: 'A large, heavy mammal with thick fur.',               uses: ['Wildlife monitoring', 'Conservation'] },
  zebra:        { desc: 'An African wild horse with distinctive black-and-white stripes.', uses: ['Wildlife', 'Zoo', 'Safari'] },
  giraffe:      { desc: 'The tallest living terrestrial animal.',              uses: ['Wildlife', 'Zoo', 'Safari'] },
  backpack:     { desc: 'A bag carried on one\'s back with shoulder straps.',  uses: ['Travel', 'School', 'Hiking', 'Storage'] },
  umbrella:     { desc: 'A portable canopy for protection from rain or sun.',  uses: ['Rain protection', 'Sun shade', 'Events'] },
  handbag:      { desc: 'A bag carried in the hand or over the shoulder.',     uses: ['Fashion', 'Storage', 'Retail'] },
  tie:          { desc: 'A narrow piece of cloth worn around the neck.',       uses: ['Formal wear', 'Fashion', 'Business'] },
  suitcase:     { desc: 'A rigid or flexible luggage bag for travel.',         uses: ['Travel', 'Storage', 'Luggage detection'] },
  frisbee:      { desc: 'A plastic disc used for throwing games.',             uses: ['Recreation', 'Sports', 'Outdoor games'] },
  skis:         { desc: 'Long narrow runners used to glide over snow.',        uses: ['Winter sports', 'Recreation', 'Skiing'] },
  snowboard:    { desc: 'A board used for sliding down snow-covered slopes.',  uses: ['Winter sports', 'Recreation'] },
  'sports ball': { desc: 'A ball used in various sports like football/basketball.', uses: ['Sports', 'Recreation', 'Fitness'] },
  kite:         { desc: 'A light frame covered with cloth flown in the wind.', uses: ['Recreation', 'Sport', 'Outdoor activity'] },
  'baseball bat': { desc: 'A smooth wooden or metal club used in baseball.',   uses: ['Baseball', 'Sports', 'Recreation'] },
  'baseball glove': { desc: 'A leather glove used to catch baseballs.',        uses: ['Baseball', 'Sports'] },
  skateboard:   { desc: 'A narrow board with wheels ridden standing up.',      uses: ['Recreation', 'Transport', 'Skateboarding'] },
  surfboard:    { desc: 'A long board used for riding waves.',                 uses: ['Surfing', 'Water sports', 'Recreation'] },
  'tennis racket': { desc: 'A strung racket used to hit a tennis ball.',       uses: ['Tennis', 'Sports', 'Recreation'] },
  bottle:       { desc: 'A container with a narrow neck for storing liquids.', uses: ['Beverage', 'Storage', 'Hydration'] },
  'wine glass':  { desc: 'A tall glass with a stem used for drinking wine.',   uses: ['Dining', 'Entertainment', 'Hospitality'] },
  cup:          { desc: 'A small open container for drinking beverages.',      uses: ['Beverage', 'Dining', 'Office'] },
  fork:         { desc: 'A pronged utensil used for eating food.',             uses: ['Dining', 'Cooking', 'Cutlery'] },
  knife:        { desc: 'A sharp-edged tool used for cutting.',                uses: ['Cooking', 'Dining', 'Crafts'] },
  spoon:        { desc: 'A utensil with a round bowl used for eating/stirring.',uses: ['Dining', 'Cooking', 'Baking'] },
  bowl:         { desc: 'A round, deep dish used for food or liquid.',         uses: ['Dining', 'Cooking', 'Storage'] },
  banana:       { desc: 'A yellow curved tropical fruit.',                     uses: ['Nutrition', 'Snacking', 'Baking'] },
  apple:        { desc: 'A round fruit with red or green skin.',               uses: ['Nutrition', 'Snacking', 'Cooking'] },
  sandwich:     { desc: 'Food placed between two slices of bread.',            uses: ['Meal', 'Snacking', 'Lunch'] },
  orange:       { desc: 'A round citrus fruit with orange skin.',              uses: ['Nutrition', 'Juice', 'Vitamin C'] },
  broccoli:     { desc: 'A green vegetable with dense florets.',               uses: ['Nutrition', 'Cooking', 'Health food'] },
  carrot:       { desc: 'An orange root vegetable.',                           uses: ['Nutrition', 'Cooking', 'Snacking'] },
  'hot dog':    { desc: 'A cooked sausage served in a sliced bun.',            uses: ['Meal', 'Fast food', 'Snacking'] },
  pizza:        { desc: 'A flat dough topped with sauce, cheese and toppings.',uses: ['Meal', 'Fast food', 'Social dining'] },
  donut:        { desc: 'A fried ring-shaped dough pastry.',                   uses: ['Dessert', 'Snacking', 'Bakery'] },
  cake:         { desc: 'A sweet baked dessert, often layered with frosting.', uses: ['Celebration', 'Dessert', 'Baking'] },
  chair:        { desc: 'A separate seat for one person.',                     uses: ['Seating', 'Furniture', 'Office'] },
  couch:        { desc: 'A long upholstered seat for multiple people.',        uses: ['Furniture', 'Relaxation', 'Living room'] },
  'potted plant': { desc: 'A plant grown in a container.',                     uses: ['Decoration', 'Gardening', 'Indoor plants'] },
  bed:          { desc: 'A piece of furniture used for sleeping.',             uses: ['Sleep', 'Bedroom', 'Rest'] },
  'dining table': { desc: 'A table designed for eating meals.',                uses: ['Dining', 'Furniture', 'Family gathering'] },
  toilet:       { desc: 'A fixed bathroom fixture for waste disposal.',        uses: ['Sanitation', 'Bathroom', 'Plumbing'] },
  tv:           { desc: 'An electronic display device for watching video.',    uses: ['Entertainment', 'News', 'Gaming'] },
  laptop:       { desc: 'A portable personal computer.',                       uses: ['Work', 'Education', 'Entertainment'] },
  mouse:        { desc: 'A handheld pointing device for computers.',           uses: ['Computing', 'Gaming', 'Office'] },
  remote:       { desc: 'A handheld device for controlling electronics wirelessly.', uses: ['TV control', 'Home automation', 'Electronics'] },
  keyboard:     { desc: 'An input device with keys for typing text.',          uses: ['Computing', 'Gaming', 'Data entry'] },
  'cell phone': { desc: 'A portable wireless telephone and smart device.',     uses: ['Communication', 'Photography', 'Apps'] },
  microwave:    { desc: 'An appliance that heats food using microwave radiation.', uses: ['Cooking', 'Reheating', 'Kitchen'] },
  oven:         { desc: 'A thermally insulated chamber for cooking and baking.',uses: ['Cooking', 'Baking', 'Kitchen'] },
  toaster:      { desc: 'A small appliance that toasts slices of bread.',      uses: ['Breakfast', 'Kitchen', 'Cooking'] },
  sink:         { desc: 'A fixed basin with a water supply for washing.',      uses: ['Washing', 'Kitchen', 'Bathroom'] },
  refrigerator: { desc: 'A large appliance for chilling and storing food.',    uses: ['Food storage', 'Kitchen', 'Preservation'] },
  book:         { desc: 'A written or printed work bound between covers.',     uses: ['Reading', 'Education', 'Reference'] },
  clock:        { desc: 'A device for measuring and displaying time.',         uses: ['Timekeeping', 'Decoration', 'Scheduling'] },
  vase:         { desc: 'A decorative container for holding flowers.',         uses: ['Decoration', 'Flower arrangement', 'Art'] },
  scissors:     { desc: 'A cutting instrument with two crossed blades.',       uses: ['Cutting', 'Crafts', 'Sewing', 'Office'] },
  'teddy bear': { desc: 'A soft toy bear, commonly given to children.',        uses: ['Toy', 'Comfort object', 'Gift'] },
  'hair drier': { desc: 'An electric device for drying and styling hair.',     uses: ['Hair care', 'Grooming', 'Beauty'] },
  toothbrush:   { desc: 'A brush used for cleaning teeth.',                    uses: ['Dental hygiene', 'Cleaning', 'Healthcare'] },
};

function getObjectInfo(label) {
  const key = label.toLowerCase();
  return OBJECT_KB[key] || {
    desc: `A "${label}" detected by the COCO-SSD model. Part of the 80-class COCO dataset.`,
    uses: ['Object detection', 'AI classification', 'Computer vision']
  };
}

// ── DOM REFS ─────────────────────────────────────────────────────
const video          = document.getElementById('video');
const canvas         = document.getElementById('canvas');
const ctx            = canvas.getContext('2d');
const snapCanvas     = document.getElementById('snapCanvas');
const snapCtx        = snapCanvas.getContext('2d');

const startBtn       = document.getElementById('startBtn');
const stopBtn        = document.getElementById('stopBtn');
const scanBtn        = document.getElementById('scanBtn');
const voiceBtn       = document.getElementById('voiceBtn');
const clearHistoryBtn= document.getElementById('clearHistoryBtn');
const closeSnapshotBtn=document.getElementById('closeSnapshotBtn');

const placeholder    = document.getElementById('placeholder');
const loadingOverlay = document.getElementById('loadingOverlay');
const loaderLabel    = document.getElementById('loaderLabel');
const loaderSub      = document.getElementById('loaderSub');
const loaderProgress = document.getElementById('loaderProgress');
const scanLine       = document.getElementById('scanLine');
const liveBadge      = document.getElementById('liveBadge');
const snapFlash      = document.getElementById('snapFlash');

const predictionsEl  = document.getElementById('predictions');
const fpsDisplay     = document.getElementById('fpsDisplay');
const statCount      = document.getElementById('statCount');
const statConf       = document.getElementById('statConf');
const statBackend    = document.getElementById('statBackend');
const headerDot      = document.getElementById('header-status-dot');
const headerLabel    = document.getElementById('header-status-label');

const infoContent    = document.getElementById('infoContent');
const historyList    = document.getElementById('historyList');
const snapshotPanel  = document.getElementById('snapshotPanel');
const snapResults    = document.getElementById('snapResults');
const voiceToast     = document.getElementById('voiceToast');
const voiceToastText = document.getElementById('voiceToastText');

// ── STATE ────────────────────────────────────────────────────────
let model       = null;
let stream      = null;
let rafId       = null;
let isRunning   = false;
let detectBusy  = false;
let lastTime    = 0;
let fpsFilter   = 0;
let lastTopLabel= '';
let voiceActive = false;
let recognition = null;

// History array, persisted to localStorage
const HISTORY_KEY = 'dge_history_v2';
let history = [];
try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch(_){}

// ── COLOR PALETTE ────────────────────────────────────────────────
const COLORS = ['#00ffc8','#00aaff','#ff4f6a','#ffcc00','#b388ff','#69ff47','#ff6d00','#f48fb1'];
function classColor(label) {
  let h = 0;
  for (let i = 0; i < label.length; i++) h = (h * 31 + label.charCodeAt(i)) & 0xffffffff;
  return COLORS[Math.abs(h) % COLORS.length];
}
function hexToRgba(hex, a) {
  const r=parseInt(hex.slice(1,3),16), g=parseInt(hex.slice(3,5),16), b=parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${a})`;
}

// ── STATUS ───────────────────────────────────────────────────────
function setStatus(state) {
  headerDot.className = 'status-dot ' + state;
  headerLabel.textContent = {idle:'OFFLINE',loading:'LOADING',active:'LIVE',error:'ERROR'}[state]||'OFFLINE';
}
function showError(msg) {
  loaderLabel.textContent = '⚠ ERROR'; loaderSub.textContent = msg;
  loaderSub.style.color = '#ff4f6a';
  setTimeout(() => {
    loadingOverlay.classList.remove('visible');
    loaderSub.style.color = '';
    startBtn.disabled = false; setStatus('idle');
  }, 4000);
}

// ── MODEL LOADING ────────────────────────────────────────────────
async function loadModel() {
  if (model) return model;
  loadingOverlay.classList.add('visible');
  loaderLabel.textContent = 'INITIALISING AI ENGINE';
  loaderSub.textContent   = 'Forcing WebGL backend…';
  loaderProgress.style.width = '10%';
  setStatus('loading');

  // Step 1: Force WebGL for fastest GPU inference
  try {
    await tf.setBackend('webgl');
    await tf.ready();
    console.log('TF backend:', tf.getBackend());
    statBackend.textContent = tf.getBackend().toUpperCase();
  } catch(e) {
    console.warn('WebGL unavailable, falling back:', e);
    statBackend.textContent = tf.getBackend().toUpperCase();
  }

  loaderProgress.style.width = '35%';
  loaderSub.textContent = 'Downloading COCO-SSD weights…';

  // Step 2: Load COCO-SSD (lite = smaller, faster initial download)
  try {
    model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
  } catch(e) {
    showError('Model load failed: ' + e.message); throw e;
  }

  loaderProgress.style.width = '80%';
  loaderSub.textContent = 'Warming up inference engine…';

  // Step 3: Warm-up pass on a tiny blank tensor to pre-compile shaders
  const warmup = tf.zeros([1, 64, 64, 3]);
  try { await model.detect(warmup); } catch(_){}
  warmup.dispose();

  loaderProgress.style.width = '100%';
  loaderLabel.textContent = 'READY ✓';
  loaderSub.textContent   = 'Starting camera…';
  await sleep(400);
  loadingOverlay.classList.remove('visible');
  return model;
}

// ── CAMERA ───────────────────────────────────────────────────────
function waitForVideo(v) {
  return new Promise((res) => {
    if (v.readyState >= 2) { res(); return; }
    const fn = () => { v.removeEventListener('loadeddata', fn); res(); };
    v.addEventListener('loadeddata', fn);
    setTimeout(res, 5000); // safety
  });
}

async function startCamera() {
  startBtn.disabled = true;
  loadingOverlay.classList.add('visible');
  loaderLabel.textContent = 'REQUESTING CAMERA';
  loaderSub.textContent   = 'Please allow camera access…';
  loaderProgress.style.width = '0%';
  loaderSub.style.color = '';
  setStatus('loading');

  try {
    // Plain {video:true} first — works on all devices including laptops
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    } catch(_) {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width:{ideal:1280}, height:{ideal:720} }, audio: false
      });
    }

    video.srcObject = stream;
    video.setAttribute('playsinline','');
    video.muted = true;

    await loadModel();

    loadingOverlay.classList.add('visible');
    loaderLabel.textContent = 'SYNCING VIDEO FEED';
    loaderSub.textContent   = 'Waiting for first frame…';

    await video.play().catch(()=>{});
    await waitForVideo(video);

    // Set canvas to native video resolution
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;

    loadingOverlay.classList.remove('visible');
    video.classList.add('visible');
    placeholder.classList.add('hidden');
    scanLine.classList.add('active');
    liveBadge.classList.add('visible');

    stopBtn.disabled  = false;
    scanBtn.disabled  = false;
    voiceBtn.disabled = false;
    isRunning = true;
    setStatus('active');

    rafId = requestAnimationFrame(detectLoop);

  } catch(err) {
    console.error(err);
    let msg = err.message || String(err);
    if (err.name==='NotAllowedError')  msg = 'Camera permission denied.';
    if (err.name==='NotFoundError')    msg = 'No camera found on this device.';
    if (err.name==='NotReadableError') msg = 'Camera is in use by another app.';
    showError(msg);
  }
}

function stopCamera() {
  isRunning = false;
  cancelAnimationFrame(rafId);
  if (stream) { stream.getTracks().forEach(t=>t.stop()); stream=null; }
  video.srcObject = null;
  video.classList.remove('visible');
  placeholder.classList.remove('hidden');
  scanLine.classList.remove('active');
  liveBadge.classList.remove('visible');
  ctx.clearRect(0,0,canvas.width,canvas.height);
  clearPredictions();
  statCount.textContent = '0'; statConf.textContent = '—';
  fpsDisplay.textContent = '— FPS';
  lastTime=0; fpsFilter=0;
  startBtn.disabled=false; stopBtn.disabled=true;
  scanBtn.disabled=true; voiceBtn.disabled=true;
  setStatus('idle');
}

// ── DETECTION LOOP ───────────────────────────────────────────────
function detectLoop(timestamp) {
  if (!isRunning) return;

  if (lastTime) {
    const fps = 1000/(timestamp-lastTime);
    fpsFilter = fpsFilter ? fpsFilter*0.88 + fps*0.12 : fps;
    fpsDisplay.textContent = Math.round(fpsFilter)+' FPS';
  }
  lastTime = timestamp;

  if (!detectBusy && video.readyState===4 && video.videoWidth>0) {
    detectBusy = true;

    // Keep canvas dimensions synced to video
    if (canvas.width!==video.videoWidth || canvas.height!==video.videoHeight) {
      canvas.width=video.videoWidth; canvas.height=video.videoHeight;
    }

    model.detect(video).then(preds => {
      drawBoxes(preds);
      renderPredCards(preds);
      updateInfoPanel(preds);
      trackHistory(preds);
      detectBusy = false;
    }).catch(e => { console.warn('Detect err',e); detectBusy=false; });
  }

  rafId = requestAnimationFrame(detectLoop);
}

// ── BOUNDING BOXES ───────────────────────────────────────────────
function drawBoxes(preds) {
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const sx = canvas.width  / video.videoWidth;
  const sy = canvas.height / video.videoHeight;

  preds.forEach(p => {
    const [x,y,w,h] = p.bbox;
    const bx=x*sx, by=y*sy, bw=w*sx, bh=h*sy;
    const color = classColor(p.class);
    const pct   = (p.score*100).toFixed(1)+'%';
    const label = p.class.toUpperCase()+'  '+pct;

    // Glowing box
    ctx.shadowColor = color; ctx.shadowBlur = 14;
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.strokeRect(bx,by,bw,bh);

    // Fill
    ctx.shadowBlur = 0;
    ctx.fillStyle = hexToRgba(color,0.07);
    ctx.fillRect(bx,by,bw,bh);

    // Label background
    ctx.font = 'bold 11px "Share Tech Mono",monospace';
    const tw = ctx.measureText(label).width;
    const lh = 20;
    const ly = by > lh+2 ? by-lh : by+bh;
    ctx.shadowColor=color; ctx.shadowBlur=8;
    ctx.fillStyle=color;
    ctx.fillRect(bx-1,ly,tw+14,lh);
    ctx.shadowBlur=0;

    // Label text
    ctx.fillStyle='#030810';
    ctx.fillText(label, bx+6, ly+14);

    // Corner accents
    const cs=5;
    [[bx,by,'tl'],[bx+bw,by,'tr'],[bx,by+bh,'bl'],[bx+bw,by+bh,'br']].forEach(([cx,cy,c])=>{
      ctx.fillStyle=color;
      ctx.shadowColor=color; ctx.shadowBlur=6;
      const ox=c.includes('r')?-cs:0, oy=c.includes('b')?-cs:0;
      ctx.fillRect(cx+ox,cy+oy,cs,cs);
    });
    ctx.shadowBlur=0;
  });
}

// ── PREDICTION CARDS ─────────────────────────────────────────────
function renderPredCards(preds) {
  const sorted = [...preds].sort((a,b)=>b.score-a.score).slice(0,3);
  statCount.textContent = preds.length;
  statConf.textContent  = sorted.length ? (sorted[0].score*100).toFixed(1)+'%' : '—';

  if (!sorted.length) { clearPredictions(); return; }

  predictionsEl.innerHTML = sorted.map((p,i) => {
    const pct  = (p.score*100).toFixed(1);
    const color= classColor(p.class);
    const rankClass = ['','rank2','rank3'][i]||'rank3';
    return `<div class="pred-card ${rankClass}" onclick="showInfoFor('${p.class}',${p.score})" title="Click for details">
      <span class="pred-rank">#${i+1}</span>
      <div class="pred-info">
        <span class="pred-name">${p.class}</span>
        <div class="pred-bar-track">
          <div class="pred-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${color}99,${color})"></div>
        </div>
      </div>
      <span class="pred-pct" style="color:${color}">${pct}%</span>
    </div>`;
  }).join('');
}

function clearPredictions() {
  predictionsEl.innerHTML='<div class="prediction-empty">No detections yet — start the camera</div>';
}

// ── OBJECT INFO PANEL ────────────────────────────────────────────
function showInfoFor(label, score) {
  const info = getObjectInfo(label);
  const pct  = (score*100).toFixed(1);
  const color= classColor(label);

  infoContent.innerHTML = `
    <div class="info-card">
      <div class="info-name">${label}</div>
      <div class="info-conf-row">
        <div class="info-conf-bar-track">
          <div class="info-conf-bar-fill" style="width:${pct}%;background:linear-gradient(90deg,${color}99,${color})"></div>
        </div>
        <span class="info-conf-pct">${pct}%</span>
      </div>
      <hr class="info-divider"/>
      <div>
        <div class="info-section-label">DESCRIPTION</div>
        <p class="info-text">${info.desc}</p>
      </div>
      <div>
        <div class="info-section-label">POSSIBLE USES</div>
        <div class="info-uses">${info.uses.map(u=>`<span class="use-tag">${u}</span>`).join('')}</div>
      </div>
    </div>`;
}

function updateInfoPanel(preds) {
  if (!preds.length) return;
  const top = preds.reduce((a,b)=>a.score>b.score?a:b);
  if (top.class !== lastTopLabel) {
    lastTopLabel = top.class;
    showInfoFor(top.class, top.score);
  }
}

// ── HISTORY ──────────────────────────────────────────────────────
let lastHistoryLabel = '';
let lastHistoryTime  = 0;

function trackHistory(preds) {
  if (!preds.length) return;
  const top  = preds.reduce((a,b)=>a.score>b.score?a:b);
  const now  = Date.now();
  // De-dupe: only add if class changed or >4 seconds since last same-class entry
  if (top.class===lastHistoryLabel && now-lastHistoryTime<4000) return;
  lastHistoryLabel = top.class;
  lastHistoryTime  = now;

  const entry = {
    label: top.class,
    conf: (top.score*100).toFixed(1),
    time: new Date().toLocaleTimeString()
  };
  history.unshift(entry);
  if (history.length > 50) history = history.slice(0,50);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); } catch(_){}
  renderHistory();
}

function renderHistory() {
  if (!history.length) {
    historyList.innerHTML='<div class="info-empty"><p>No history yet</p></div>'; return;
  }
  historyList.innerHTML = history.map(e=>`
    <div class="history-item">
      <span class="history-label">${e.label}</span>
      <div class="history-meta">
        <span class="history-conf">${e.conf}%</span>
        <span class="history-time">${e.time}</span>
      </div>
    </div>`).join('');
}

function clearHistory() {
  history=[];
  try { localStorage.removeItem(HISTORY_KEY); } catch(_){}
  renderHistory();
}

// ── PHOTO SCAN ───────────────────────────────────────────────────
async function scanObject() {
  if (!isRunning || !model) return;
  scanBtn.disabled=true;

  // Flash effect
  snapFlash.classList.add('active');
  setTimeout(()=>snapFlash.classList.remove('active'),120);

  // Capture frame
  snapCanvas.width  = video.videoWidth  || 640;
  snapCanvas.height = video.videoHeight || 480;
  snapCtx.drawImage(video,0,0,snapCanvas.width,snapCanvas.height);

  // Run detection on snapshot
  const preds = await model.detect(snapCanvas);

  // Draw boxes on snap canvas
  const sx = snapCanvas.width  / video.videoWidth;
  const sy = snapCanvas.height / video.videoHeight;
  preds.forEach(p=>{
    const [x,y,w,h]=p.bbox;
    const color=classColor(p.class);
    snapCtx.strokeStyle=color; snapCtx.lineWidth=2;
    snapCtx.shadowColor=color; snapCtx.shadowBlur=10;
    snapCtx.strokeRect(x*sx,y*sy,w*sx,h*sy);
    snapCtx.shadowBlur=0;
    const label=p.class.toUpperCase()+' '+(p.score*100).toFixed(0)+'%';
    snapCtx.font='bold 11px "Share Tech Mono",monospace';
    const tw=snapCtx.measureText(label).width;
    snapCtx.fillStyle=color; snapCtx.fillRect(x*sx-1,(y*sy)-18,tw+12,18);
    snapCtx.fillStyle='#030810'; snapCtx.fillText(label,x*sx+5,(y*sy)-4);
  });

  // Show results
  snapshotPanel.style.display='block';
  if (!preds.length) {
    snapResults.innerHTML='<div class="info-empty"><p>No objects detected in snapshot</p></div>';
  } else {
    snapResults.innerHTML = preds.sort((a,b)=>b.score-a.score).map(p=>`
      <div class="snap-result-item">
        <span class="snap-result-name">${p.class}</span>
        <span class="snap-result-conf">${(p.score*100).toFixed(1)}%</span>
      </div>`).join('');
  }

  scanBtn.disabled=false;
}

// ── VOICE INTERACTION ────────────────────────────────────────────
function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    voiceBtn.title='Speech recognition not supported in this browser';
    return;
  }
  recognition = new SpeechRecognition();
  recognition.continuous   = true;
  recognition.interimResults= false;
  recognition.lang          = 'en-US';

  recognition.onresult = (e) => {
    const transcript = Array.from(e.results)
      .map(r=>r[0].transcript).join(' ').toLowerCase().trim();
    if (transcript.includes('what is this') || transcript.includes('what is that')
        || transcript.includes('identify') || transcript.includes('detect')) {
      speakTopObject();
    }
  };
  recognition.onerror = () => {
    voiceActive=false; voiceBtn.classList.remove('listening'); hideVoiceToast();
  };
}

function toggleVoice() {
  if (!recognition) { alert('Speech recognition not supported in this browser.'); return; }
  if (voiceActive) {
    recognition.stop(); voiceActive=false;
    voiceBtn.classList.remove('listening'); hideVoiceToast();
  } else {
    recognition.start(); voiceActive=true;
    voiceBtn.classList.add('listening');
    showVoiceToast('Listening… say "What is this?"');
  }
}

function speakTopObject() {
  if (!lastTopLabel) { speakText('Nothing detected yet.'); return; }
  const info = getObjectInfo(lastTopLabel);
  const utterance = `I can see a ${lastTopLabel}. ${info.desc}`;
  speakText(utterance);
  showVoiceToast('Saying: ' + lastTopLabel);
}

function speakText(text) {
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate=0.95; u.pitch=1; u.volume=1;
  synth.speak(u);
}

function showVoiceToast(msg) {
  voiceToastText.textContent=msg;
  voiceToast.classList.add('visible');
}
function hideVoiceToast() {
  voiceToast.classList.remove('visible');
}

// ── UTILITIES ────────────────────────────────────────────────────
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

// ── INIT ─────────────────────────────────────────────────────────
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener ('click', stopCamera);
scanBtn.addEventListener ('click', scanObject);
voiceBtn.addEventListener('click', toggleVoice);
clearHistoryBtn.addEventListener('click', clearHistory);
closeSnapshotBtn.addEventListener('click', ()=>{ snapshotPanel.style.display='none'; });

// Expose showInfoFor globally for inline onclick in pred cards
window.showInfoFor = showInfoFor;

// Boot: init voice, render persisted history
initVoice();
renderHistory();
