/* ============================================================
   AirWatch — Biratnagar Corridor | app.js
   Live detection, heatmap, alert system, sensor management
   ============================================================ */

'use strict';

// ============================================================
// STATE
// ============================================================
const STATE = {
  currentAQI: 247,
  aqiTarget: 247,
  reports: [],
  sentAlerts: [],
  selectedSmell: null,
  compassAngle: 45,
  scentCount: 18,
  heatmapMode: 'night',
};

const REPORT_TYPES = [
  { type: 'Burnt Rubber', icon: '🔥', loc: 'Khanar Z-3' },
  { type: 'Chemical Odour', icon: '⚗', loc: 'Khanar Z-3' },
  { type: 'Black Smoke', icon: '🌑', loc: 'Duhabi W-4' },
  { type: 'Eye Irritation', icon: '👁', loc: 'Khanar Z-2' },
  { type: 'Plastic Burning', icon: '🏭', loc: 'Tankisinuwari' },
  { type: 'Sulfur Smell', icon: '💨', loc: 'Khanar Z-3' },
];

// ============================================================
// PARTICLE BACKGROUND
// ============================================================
(function initParticles() {
  const canvas = document.getElementById('particleCanvas');
  const ctx = canvas.getContext('2d');
  let W, H, particles = [];

  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function makeParticle() {
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.5 + 0.5,
      vx: (Math.random() - 0.5) * 0.3,
      vy: -Math.random() * 0.4 - 0.1,
      alpha: Math.random() * 0.4 + 0.1,
      color: Math.random() > 0.7 ? '#ff3d5a' : '#00d4aa',
    };
  }

  resize();
  for (let i = 0; i < 120; i++) particles.push(makeParticle());
  window.addEventListener('resize', resize);

  (function loop() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p, i) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.globalAlpha = p.alpha;
      ctx.fill();
      p.x += p.vx; p.y += p.vy;
      if (p.y < -5 || p.x < -5 || p.x > W + 5) particles[i] = makeParticle();
    });
    ctx.globalAlpha = 1;
    requestAnimationFrame(loop);
  })();
})();

// ============================================================
// NAVIGATION
// ============================================================
function showSection(id) {
  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  const sec = document.getElementById('sec-' + id);
  if (sec) sec.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    if (n.dataset.section === id) n.classList.add('active');
  });
  // Close sidebar on mobile
  if (window.innerWidth < 900) document.getElementById('sidebar').classList.remove('open');
  // Init section-specific rendering
  if (id === 'heatmap') renderHeatmap();
  if (id === 'timeline') renderTimeline();
  if (id === 'report') renderNeighbourFeed(); renderScentTrailMini();
  if (id === 'sensor') renderCoverageMap();
}

document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    showSection(item.dataset.section);
  });
});

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('open');
}

// ============================================================
// CLOCK
// ============================================================
function updateClock() {
  const now = new Date();
  const t = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const d = now.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
  const el = document.getElementById('headerTime');
  if (el) el.textContent = `${d}  ·  ${t}`;
  const rt = document.getElementById('reportTime');
  if (rt) rt.textContent = t + ' NPT';
  const ts = document.getElementById('submitTimestamp');
  if (ts) ts.textContent = d + ' · ' + t;
}
setInterval(updateClock, 1000);
updateClock();

// ============================================================
// AQI DIAL (Canvas)
// ============================================================
function drawAQIDial(aqi) {
  const canvas = document.getElementById('aqiDial');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 110, cy = 110, R = 90;
  ctx.clearRect(0, 0, 220, 220);

  // Background arc
  ctx.beginPath();
  ctx.arc(cx, cy, R, Math.PI * 0.75, Math.PI * 2.25);
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Colour gradient arc
  const pct = Math.min(aqi / 300, 1);
  const startAngle = Math.PI * 0.75;
  const endAngle = startAngle + pct * Math.PI * 1.5;

  const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
  grad.addColorStop(0, '#00d4aa');
  grad.addColorStop(0.4, '#ffd700');
  grad.addColorStop(0.7, '#ff8c00');
  grad.addColorStop(1, '#ff3d5a');

  ctx.beginPath();
  ctx.arc(cx, cy, R, startAngle, endAngle);
  ctx.strokeStyle = grad;
  ctx.lineWidth = 14;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Glow
  ctx.shadowBlur = 20;
  ctx.shadowColor = '#ff3d5a';
  ctx.beginPath();
  ctx.arc(cx, cy, R, endAngle - 0.01, endAngle);
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Tick marks
  for (let i = 0; i <= 10; i++) {
    const angle = startAngle + (i / 10) * Math.PI * 1.5;
    const x1 = cx + (R - 18) * Math.cos(angle);
    const y1 = cy + (R - 18) * Math.sin(angle);
    const x2 = cx + (R - 12) * Math.cos(angle);
    const y2 = cy + (R - 12) * Math.sin(angle);
    ctx.beginPath();
    ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    ctx.stroke();
  }
}

// ============================================================
// LIVE AQI SIMULATION
// ============================================================
function lerpAQI() {
  const diff = STATE.aqiTarget - STATE.currentAQI;
  if (Math.abs(diff) < 0.5) return;
  STATE.currentAQI += diff * 0.05;
  const aqi = Math.round(STATE.currentAQI);
  const numEl = document.getElementById('aqiNumber');
  const catEl = document.getElementById('aqiCategory');
  const deviceAqi = document.getElementById('deviceAqi');
  if (numEl) numEl.textContent = aqi;
  if (deviceAqi) deviceAqi.textContent = aqi;
  if (catEl) {
    const cat = getAQICategory(aqi);
    catEl.textContent = cat.label;
    catEl.style.color = cat.color;
    numEl.style.color = cat.color;
    numEl.style.textShadow = `0 0 30px ${cat.color}88`;
  }
  drawAQIDial(aqi);
  // LED color on sensor device
  const led = document.getElementById('sensorLed');
  if (led) led.style.background = aqi > 150 ? 'var(--danger)' : aqi > 100 ? 'var(--warning)' : 'var(--accent)';
}

function getAQICategory(aqi) {
  if (aqi <= 50)  return { label: 'GOOD', color: '#00d4aa' };
  if (aqi <= 100) return { label: 'MODERATE', color: '#ffd700' };
  if (aqi <= 150) return { label: 'UNHEALTHY FOR SENSITIVE', color: '#ff8c00' };
  if (aqi <= 200) return { label: 'UNHEALTHY', color: '#ff6b35' };
  if (aqi <= 300) return { label: 'VERY UNHEALTHY', color: '#ff3d5a' };
  return { label: 'HAZARDOUS', color: '#8b0000' };
}

// Simulate AQI drifting realistically
function simulateAQIChange() {
  const hour = new Date().getHours();
  let base = 60;
  if (hour >= 1 && hour < 5) base = 220 + Math.random() * 80;
  else if (hour >= 5 && hour < 8) base = 120 + Math.random() * 60;
  else if (hour >= 22 || hour === 0) base = 140 + Math.random() * 50;
  const noise = (Math.random() - 0.5) * 30;
  STATE.aqiTarget = Math.max(20, Math.min(350, base + noise));

  // Update sub-metrics
  const pm25 = document.getElementById('pm25Val');
  const pm10 = document.getElementById('pm10Val');
  if (pm25) pm25.textContent = Math.round(STATE.aqiTarget * 0.8) + ' µg/m³';
  if (pm10) pm10.textContent = Math.round(STATE.aqiTarget * 1.27) + ' µg/m³';
}

setInterval(lerpAQI, 50);
setInterval(simulateAQIChange, 8000);
drawAQIDial(247);

// ============================================================
// TIMELINE CHART (Chart.js)
// ============================================================
let timelineChart;
function initTimelineChart() {
  const ctx = document.getElementById('timelineChart');
  if (!ctx) return;

  const labels = [];
  const pm25Data = [];
  const pm10Data = [];
  const whoLimit = [];

  // Simulate 24h data with midnight spike
  for (let i = 0; i < 24; i++) {
    labels.push(i.toString().padStart(2, '0') + ':00');
    let base = 40 + Math.random() * 20;
    if (i >= 2 && i <= 4) base = 200 + Math.random() * 80;
    else if (i >= 1 || i === 0) base = 100 + Math.random() * 40;
    if (i >= 8 && i <= 20) base = 35 + Math.random() * 25;
    pm25Data.push(Math.round(base));
    pm10Data.push(Math.round(base * 1.6));
    whoLimit.push(15);
  }

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'PM2.5',
          data: pm25Data,
          borderColor: '#ff3d5a',
          backgroundColor: 'rgba(255,61,90,0.08)',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 2,
          pointHoverRadius: 5,
        },
        {
          label: 'PM10 (÷2)',
          data: pm10Data.map(v => v / 2),
          borderColor: '#ff8c00',
          backgroundColor: 'rgba(255,140,0,0.05)',
          borderWidth: 1.5,
          fill: false,
          tension: 0.4,
          pointRadius: 1,
          borderDash: [3, 3],
        },
        {
          label: 'WHO Limit',
          data: whoLimit,
          borderColor: '#00d4aa',
          borderWidth: 1,
          fill: false,
          pointRadius: 0,
          borderDash: [6, 4],
        },
      ],
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#1a1d2a',
          borderColor: 'rgba(255,255,255,0.1)',
          borderWidth: 1,
          titleColor: '#e8eaf0',
          bodyColor: '#7b829a',
          padding: 10,
        },
      },
      scales: {
        x: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#4a5068', font: { family: 'Space Mono', size: 10 }, maxTicksLimit: 12 },
        },
        y: {
          grid: { color: 'rgba(255,255,255,0.04)' },
          ticks: { color: '#4a5068', font: { family: 'Space Mono', size: 10 } },
        },
      },
    },
  });
}

// Add live data point every 8s
let liveDataIdx = 0;
setInterval(() => {
  if (!timelineChart) return;
  const now = new Date();
  const label = now.getHours().toString().padStart(2,'0') + ':' + now.getMinutes().toString().padStart(2,'0');
  if (timelineChart.data.labels.length > 30) {
    timelineChart.data.labels.shift();
    timelineChart.data.datasets.forEach(d => d.data.shift());
  }
  timelineChart.data.labels.push(label);
  const newPM = Math.round(STATE.currentAQI * 0.8 + (Math.random()-0.5)*10);
  timelineChart.data.datasets[0].data.push(newPM);
  timelineChart.data.datasets[1].data.push(newPM * 0.8);
  timelineChart.data.datasets[2].data.push(15);
  timelineChart.update('none');
}, 8000);

// ============================================================
// HEATMAP
// ============================================================
function renderHeatmap() {
  const canvas = document.getElementById('heatmapCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);

  // Background map-like
  ctx.fillStyle = '#14161f';
  ctx.fillRect(0, 0, W, H);

  // Grid lines (streets)
  ctx.strokeStyle = 'rgba(255,255,255,0.04)';
  ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Heat sources (factories)
  const sources = [
    { x: W*0.38, y: H*0.42, intensity: 1.0, label: 'Mill-A' },
    { x: W*0.52, y: H*0.35, intensity: 0.85, label: 'Plastics' },
    { x: W*0.45, y: H*0.55, intensity: 0.7, label: 'Textile' },
  ];

  const mode = STATE.heatmapMode;
  const multiplier = mode === 'night' ? 1.0 : mode === 'morning' ? 0.6 : 0.3;

  sources.forEach(src => {
    const radius = 140 * src.intensity * multiplier;
    const grad = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, radius);
    grad.addColorStop(0, `rgba(255, 0, 30, ${0.75 * multiplier})`);
    grad.addColorStop(0.3, `rgba(255, 80, 0, ${0.5 * multiplier})`);
    grad.addColorStop(0.6, `rgba(255, 200, 0, ${0.3 * multiplier})`);
    grad.addColorStop(1, 'rgba(0, 212, 170, 0)');
    ctx.beginPath();
    ctx.arc(src.x, src.y, radius, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();
  });

  // Community report dots
  const reportDots = [
    { x: W*0.30, y: H*0.62 }, { x: W*0.28, y: H*0.67 }, { x: W*0.33, y: H*0.60 },
    { x: W*0.20, y: H*0.40 }, { x: W*0.22, y: H*0.43 }, { x: W*0.62, y: H*0.68 },
    { x: W*0.25, y: H*0.55 }, { x: W*0.35, y: H*0.70 }, { x: W*0.65, y: H*0.60 },
  ];
  reportDots.forEach(dot => {
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, 9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1; ctx.stroke();
  });

  // Wind direction arrows
  ctx.strokeStyle = 'rgba(0,212,170,0.3)';
  ctx.fillStyle = 'rgba(0,212,170,0.3)';
  ctx.lineWidth = 1;
  for (let x = 60; x < W; x += 80) {
    for (let y = 40; y < H; y += 70) {
      drawArrow(ctx, x, y, x + 20, y + 8);
    }
  }
}

function drawArrow(ctx, x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx+dy*dy);
  const ux = dx/len, uy = dy/len;
  ctx.beginPath(); ctx.moveTo(x1,y1); ctx.lineTo(x2,y2); ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - 6*ux + 3*uy, y2 - 6*uy - 3*ux);
  ctx.lineTo(x2 - 6*ux - 3*uy, y2 - 6*uy + 3*ux);
  ctx.closePath(); ctx.fill();
}

function setHeatmapTime(mode) {
  STATE.heatmapMode = mode;
  document.querySelectorAll('.ctrl-btn').forEach((b, i) => {
    b.classList.toggle('active', ['night','morning','day'][i] === mode);
  });
  renderHeatmap();
}

// ============================================================
// TIMELINE SECTION
// ============================================================
function renderTimeline() {
  const grid = document.getElementById('hourGrid');
  if (!grid || grid.children.length > 0) return;

  const hourlyData = [
    180, 220, 280, 265, 210, 140, 95, 65, 48, 42, 38, 35,
    32, 35, 38, 42, 55, 68, 72, 65, 80, 110, 155, 175
  ];

  hourlyData.forEach((val, i) => {
    const pct = val / 300;
    const color = val > 200 ? '#ff3d5a' : val > 150 ? '#ff6b35' : val > 100 ? '#ff8c00' : val > 50 ? '#ffd700' : '#00d4aa';
    const cell = document.createElement('div');
    cell.className = 'hour-cell';
    cell.innerHTML = `
      <div class="hour-bar-wrap">
        <div class="hour-bar" style="height:${Math.round(pct*100)}%; background:${color}; box-shadow: 0 0 8px ${color}44"
          title="${i.toString().padStart(2,'0')}:00 — AQI ${val}"></div>
      </div>
      <div class="hour-label">${i.toString().padStart(2,'0')}</div>
    `;
    grid.appendChild(cell);
  });

  // Hourly bar chart
  const barCtx = document.getElementById('hourlyBarChart');
  if (barCtx && !barCtx._chart) {
    barCtx._chart = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: hourlyData.map((_,i) => i.toString().padStart(2,'0') + 'h'),
        datasets: [{
          label: 'AQI',
          data: hourlyData,
          backgroundColor: hourlyData.map(v =>
            v > 200 ? 'rgba(255,61,90,0.7)' : v > 100 ? 'rgba(255,140,0,0.7)' : 'rgba(0,212,170,0.6)'
          ),
          borderRadius: 4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#4a5068', font: { family: 'Space Mono', size: 9 } } },
          y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#4a5068', font: { family: 'Space Mono', size: 9 } } },
        },
      },
    });
  }
}

// ============================================================
// COMMUNITY REPORTS FEED
// ============================================================
const MOCK_REPORTS = [
  { time: '2:18 AM', type: '🔥 Burnt Rubber', loc: 'Khanar Z-3' },
  { time: '2:21 AM', type: '🌑 Black Smoke', loc: 'Khanar Z-2' },
  { time: '2:24 AM', type: '⚗ Chemical', loc: 'Duhabi W-4' },
  { time: '2:31 AM', type: '👁 Eye Irritation', loc: 'Khanar Z-3' },
  { time: '2:38 AM', type: '💨 Sulfur', loc: 'Khanar Z-3' },
  { time: '2:45 AM', type: '🏭 Plastic Burning', loc: 'Tankisinuwari' },
  { time: '2:52 AM', type: '🔥 Burnt Rubber', loc: 'Khanar Z-1' },
  { time: '3:01 AM', type: '⚗ Chemical', loc: 'Khanar Z-3' },
];

function initReportsFeed() {
  const scroll = document.getElementById('reportsScroll');
  if (!scroll) return;
  MOCK_REPORTS.forEach(r => {
    const chip = document.createElement('div');
    chip.className = 'report-chip';
    chip.innerHTML = `<div class="rc-time">${r.time}</div><div class="rc-type">${r.type}</div><div class="rc-loc">📍 ${r.loc}</div>`;
    scroll.appendChild(chip);
  });
}

function renderNeighbourFeed() {
  const feed = document.getElementById('nrFeed');
  if (!feed || feed.children.length > 0) return;
  const now = new Date();
  const items = [
    { offset: 2, desc: 'Burnt rubber smell · Strong · NE direction' },
    { offset: 7, desc: 'Eye burning, kids coughing · from north' },
    { offset: 12, desc: 'Black smoke visible from window' },
    { offset: 18, desc: 'Sulfur smell · Moderate intensity' },
  ];
  items.forEach(item => {
    const t = new Date(now - item.offset * 60000);
    const time = t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
    const el = document.createElement('div');
    el.className = 'nr-item';
    el.innerHTML = `<div class="nr-time">${time} NPT — ${item.offset}min ago</div><div class="nr-desc">${item.desc}</div>`;
    feed.appendChild(el);
  });
}

// ============================================================
// SCENT TRAIL MINI MAP
// ============================================================
function renderScentTrailMini() {
  const canvas = document.getElementById('scentTrailMini');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 280, 180);
  ctx.fillStyle = '#0f1017';
  ctx.fillRect(0, 0, 280, 180);

  const trail = [
    {x:140,y:80}, {x:130,y:95}, {x:115,y:105}, {x:100,y:115},
    {x:88,y:120}, {x:75,y:130}, {x:60,y:140},
    {x:160,y:90}, {x:175,y:105}, {x:190,y:118},
    {x:150,y:72}, {x:145,y:65}, {x:152,y:58},
    {x:85,y:100}, {x:70,y:105}, {x:55,y:112},
    {x:200,y:100}, {x:210,y:115}
  ];

  // Factory source
  ctx.beginPath();
  ctx.arc(140, 80, 12, 0, Math.PI*2);
  ctx.fillStyle = 'rgba(255,140,0,0.3)';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(140, 80, 6, 0, Math.PI*2);
  ctx.fillStyle = '#ff8c00';
  ctx.fill();

  trail.forEach((pt, i) => {
    if (i === 0) return;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, 5, 0, Math.PI*2);
    const alpha = 0.3 + (i/trail.length)*0.6;
    ctx.fillStyle = `rgba(255,61,90,${alpha})`;
    ctx.fill();
  });

  // Labels
  ctx.fillStyle = 'rgba(123,130,154,0.8)';
  ctx.font = '9px Space Mono';
  ctx.fillText('🏭 Factory', 100, 76);
  ctx.fillText('📍 Khanar', 48, 155);
  ctx.fillText('📍 Duhabi', 195, 132);
}

// Animate scent count
setInterval(() => {
  const r = Math.random();
  if (r > 0.7) {
    STATE.scentCount++;
    const el = document.getElementById('scentCount');
    if (el) el.textContent = STATE.scentCount;
    const rc = document.getElementById('reportCount');
    if (rc) rc.textContent = STATE.scentCount + ' reports tonight';
  }
}, 15000);

// ============================================================
// REPORT SUBMISSION
// ============================================================
function selectSmell(btn, type) {
  document.querySelectorAll('.smell-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  STATE.selectedSmell = type;
}

function updateIntensity(val) {
  const labels = ['', 'Faint (1/5)', 'Light (2/5)', 'Moderate (3/5)', 'Strong (4/5)', 'Choking (5/5)'];
  const el = document.getElementById('intensityDisplay');
  if (el) el.textContent = labels[val];
}

// Compass interaction
const compass = document.getElementById('compass');
if (compass) {
  compass.addEventListener('click', (e) => {
    const rect = compass.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const angle = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90;
    STATE.compassAngle = angle;
    const needle = document.getElementById('compassNeedle');
    if (needle) needle.style.transform = `translateX(-50%) translateY(-100%) rotate(${angle}deg)`;
  });
}

function submitReport() {
  if (!STATE.selectedSmell) {
    showGlobalAlert('⚠', 'Select a Type', 'Please select what you detected before submitting.', 'warning');
    return;
  }
  STATE.scentCount++;
  const el = document.getElementById('scentCount');
  if (el) el.textContent = STATE.scentCount;

  // Add to NR feed
  const feed = document.getElementById('nrFeed');
  if (feed) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: false });
    const item = document.createElement('div');
    item.className = 'nr-item';
    item.style.borderLeft = '2px solid var(--accent)';
    item.innerHTML = `<div class="nr-time">${time} NPT — Just now (YOU)</div><div class="nr-desc">${STATE.selectedSmell} · Khanar Z-3</div>`;
    feed.insertBefore(item, feed.firstChild);
  }

  showGlobalAlert(
    '✓',
    'Report Submitted!',
    `Your "${STATE.selectedSmell}" observation has been timestamped at ${new Date().toLocaleTimeString()} and added to the community scent trail. Your data is now part of the evidence.`,
    'success'
  );
  document.querySelectorAll('.smell-btn').forEach(b => b.classList.remove('selected'));
  STATE.selectedSmell = null;
}

// ============================================================
// AUTHORITY ALERTS
// ============================================================
function sendAlert(target, btn) {
  btn.disabled = true;
  btn.textContent = 'Sending...';
  setTimeout(() => {
    btn.textContent = '✓ Sent!';
    btn.style.background = 'var(--accent-dim)';
    btn.style.borderColor = 'var(--accent)';
    btn.style.color = 'var(--accent)';

    // Log
    const logEmpty = document.getElementById('logEmpty');
    if (logEmpty) logEmpty.style.display = 'none';
    const logItems = document.getElementById('logItems');
    if (logItems) {
      const now = new Date();
      const time = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: false });
      const item = document.createElement('div');
      item.className = 'log-item';
      item.innerHTML = `<span class="log-item-time">${time}</span><span class="log-item-desc">Evidence package sent to <strong>${target}</strong> — 5 documents, 247 reports attached</span>`;
      logItems.appendChild(item);
    }

    showGlobalAlert(
      '📤',
      `Alert Sent to ${target}`,
      `Your complete evidence package — including 18-night data logs, 247 community reports, statistical pattern analysis, and heatmap — has been sent to ${target}. A case reference number will be generated within 24 hours.`,
      'success'
    );
    STATE.sentAlerts.push({ target, time: new Date() });
  }, 1800);
}

// ============================================================
// SENSOR SECTION
// ============================================================
function renderCoverageMap() {
  const canvas = document.getElementById('coverageCanvas');
  if (!canvas || canvas._drawn) return;
  canvas._drawn = true;
  const ctx = canvas.getContext('2d');
  const W = 500, H = 200;
  ctx.fillStyle = '#0f1017'; ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1;
  for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
  for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

  // Active sensors (green dots)
  const activeSensors = [
    {x:120,y:130},{x:140,y:110},{x:100,y:120},{x:160,y:140},{x:80,y:100},
    {x:200,y:90},{x:180,y:115},{x:220,y:130},{x:90,y:155},{x:150,y:95},
    {x:240,y:100},{x:260,y:120},{x:130,y:155},{x:170,y:130},{x:110,y:90},
    {x:280,y:95},{x:300,y:115},{x:70,y:130},{x:190,y:145},{x:210,y:80},
    {x:320,y:100},{x:230,y:155},{x:145,y:75},{x:95,y:80},{x:250,y:140},
  ];
  activeSensors.forEach(s => {
    // coverage radius
    const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, 40);
    grad.addColorStop(0, 'rgba(0,212,170,0.08)');
    grad.addColorStop(1, 'rgba(0,212,170,0)');
    ctx.beginPath(); ctx.arc(s.x, s.y, 40, 0, Math.PI*2);
    ctx.fillStyle = grad; ctx.fill();

    ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI*2);
    ctx.fillStyle = '#00d4aa'; ctx.fill();
  });

  // Pending sensors (dim)
  for (let i = 0; i < 20; i++) {
    const x = 350 + Math.random() * 120;
    const y = 30 + Math.random() * 160;
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fill();
  }

  // Factory markers
  [{x:200,y:90}, {x:240,y:75}, {x:220,y:110}].forEach(f => {
    ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(255,140,0,0.6)'; ctx.fill();
    ctx.beginPath(); ctx.arc(f.x, f.y, 7, 0, Math.PI*2);
    ctx.strokeStyle = 'var(--warning)'; ctx.lineWidth = 1.5; ctx.stroke();
  });

  // Labels
  ctx.fillStyle = 'rgba(0,212,170,0.7)';
  ctx.font = '10px Space Mono';
  ctx.fillText('● Active sensor', 12, H - 12);
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.fillText('○ Pending', 130, H - 12);
  ctx.fillStyle = 'rgba(255,140,0,0.7)';
  ctx.fillText('◉ Factory', 240, H - 12);
}

function openSensorForm(type) {
  const modal = document.getElementById('sensorModal');
  const title = document.getElementById('modalTitle');
  const titles = { grant: 'Apply for Free Community Grant', buy: 'Purchase AirWatch Node', pickup: 'Reserve Pickup Slot' };
  if (title) title.textContent = titles[type] || 'Get a Sensor';
  if (modal) modal.classList.add('open');
}
function closeSensorForm() {
  document.getElementById('sensorModal').classList.remove('open');
}
function submitSensorForm() {
  closeSensorForm();
  showGlobalAlert('✓', 'Application Received!', 'Your sensor application has been registered. You will be contacted within 48 hours for delivery or pickup details.', 'success');
}

// ============================================================
// GLOBAL ALERT MODAL
// ============================================================
function showGlobalAlert(icon, title, body, type) {
  const overlay = document.getElementById('globalAlertOverlay');
  const card = document.getElementById('globalAlertCard');
  document.getElementById('gaIcon').textContent = icon;
  document.getElementById('gaTitle').textContent = title;
  document.getElementById('gaBody').textContent = body;

  card.style.borderColor = type === 'success' ? 'rgba(0,212,170,0.3)' :
                           type === 'warning' ? 'rgba(255,140,0,0.3)' : 'rgba(255,61,90,0.3)';
  document.getElementById('gaIcon').style.background = type === 'success' ? 'var(--accent-dim)' :
                                                       type === 'warning' ? 'var(--warning-dim)' : 'var(--danger-dim)';
  document.getElementById('gaIcon').style.color = type === 'success' ? 'var(--accent)' :
                                                  type === 'warning' ? 'var(--warning)' : 'var(--danger)';
  overlay.classList.add('open');
}
function closeGlobalAlert() {
  document.getElementById('globalAlertOverlay').classList.remove('open');
}

// ============================================================
// LIVE REPORTS — auto-inject new reports
// ============================================================
function injectLiveReport() {
  const scroll = document.getElementById('reportsScroll');
  if (!scroll) return;
  const r = REPORT_TYPES[Math.floor(Math.random() * REPORT_TYPES.length)];
  const now = new Date();
  const t = now.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit', hour12: false });
  const chip = document.createElement('div');
  chip.className = 'report-chip';
  chip.style.borderColor = 'var(--accent)';
  chip.style.animation = 'fadeIn 0.4s ease';
  chip.innerHTML = `<div class="rc-time">${t} ← NEW</div><div class="rc-type">${r.type}</div><div class="rc-loc">📍 ${r.loc}</div>`;
  scroll.insertBefore(chip, scroll.firstChild);
  STATE.scentCount++;
  const rc = document.getElementById('reportCount');
  if (rc) rc.textContent = STATE.scentCount + ' reports tonight';
  // Remove after 5 items to avoid overflow
  while (scroll.children.length > 10) scroll.removeChild(scroll.lastChild);
}
setInterval(injectLiveReport, 25000 + Math.random() * 10000);

// ============================================================
// AQI CARD PULSING BORDER
// ============================================================
function updateCardPulse() {
  const card = document.getElementById('aqiMainCard');
  if (!card) return;
  const aqi = STATE.currentAQI;
  if (aqi > 200) {
    card.style.boxShadow = `0 0 30px rgba(255,61,90,${0.1 + 0.1 * Math.sin(Date.now()/500)})`;
  } else if (aqi > 100) {
    card.style.boxShadow = `0 0 20px rgba(255,140,0,0.15)`;
  } else {
    card.style.boxShadow = 'none';
  }
}
setInterval(updateCardPulse, 100);

// ============================================================
// INIT
// ============================================================
window.addEventListener('DOMContentLoaded', () => {
  initTimelineChart();
  initReportsFeed();
  renderHeatmap(); // preload
  showSection('dashboard');

  // Close modals on overlay click
  document.getElementById('globalAlertOverlay').addEventListener('click', function(e) {
    if (e.target === this) closeGlobalAlert();
  });
  document.getElementById('sensorModal').addEventListener('click', function(e) {
    if (e.target === this) closeSensorForm();
  });

  // Keyboard nav
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeGlobalAlert(); closeSensorForm(); }
  });
});
