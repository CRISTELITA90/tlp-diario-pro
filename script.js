/* ============================================================
   TLP Diario Pro — script.js
   Clinical MVP: emotion tracking, history, crisis mode, stats
   ============================================================ */

// ── Emotion metadata ──────────────────────────────────────────
const EMOTIONS = {
  'ansiedad':          { icon: '😰', color: '#7c6cfc' },
  'vacío':             { icon: '🕳️', color: '#8892b0' },
  'ira':               { icon: '🔥', color: '#ef4444' },
  'tristeza':          { icon: '💧', color: '#60a5fa' },
  'miedo al abandono': { icon: '👻', color: '#a78bfa' },
  'impulsividad':      { icon: '⚡', color: '#f59e0b' },
  'disociación':       { icon: '🌫️', color: '#94a3b8' },
  'calma':             { icon: '🌊', color: '#14b8a6' },
};

// ── Data layer (localStorage) ─────────────────────────────────
const DB = {
  KEY: 'tlp_entries_v2',
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); }
    catch { return []; }
  },
  save(entry) {
    const entries = this.load();
    const newEntry = { id: Date.now(), timestamp: new Date().toISOString(), ...entry };
    entries.unshift(newEntry);
    localStorage.setItem(this.KEY, JSON.stringify(entries.slice(0, 500)));
    return newEntry;
  },
};

// ── App state ─────────────────────────────────────────────────
let selectedEmotion = null;

// ── Toast ─────────────────────────────────────────────────────
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

// ── Navigation ────────────────────────────────────────────────
function navigate(screen) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('screen-' + screen).classList.add('active');
  document.getElementById('nav-' + screen).classList.add('active');
  if (screen === 'historial')  renderHistory();
  if (screen === 'stats')      renderStats();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.screen));
});

// ── Emotion selection ─────────────────────────────────────────
document.getElementById('emotionGrid').addEventListener('click', e => {
  const btn = e.target.closest('.emotion-btn');
  if (!btn) return;
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
  btn.classList.add('selected');
  selectedEmotion = btn.dataset.emotion;
});

// ── Intensity slider ──────────────────────────────────────────
const slider = document.getElementById('intensitySlider');
const intensityDisplay = document.getElementById('intensityDisplay');

function intensityColor(v) {
  if (v <= 3) return '#14b8a6';
  if (v <= 6) return '#7c6cfc';
  if (v <= 8) return '#f59e0b';
  return '#ef4444';
}

slider.addEventListener('input', () => {
  const v = parseInt(slider.value);
  intensityDisplay.textContent = v;
  const c = intensityColor(v);
  intensityDisplay.style.color = c;
  slider.style.setProperty('--thumb-color', c);
});

// ── Save entry ────────────────────────────────────────────────
document.getElementById('saveBtn').addEventListener('click', () => {
  if (!selectedEmotion) { showToast('Selecciona cómo te sientes'); return; }

  const intensity = parseInt(slider.value);
  const trigger   = document.getElementById('triggerSelect').value;
  const notes     = document.getElementById('notesInput').value.trim();

  DB.save({ emotion: selectedEmotion, intensity, trigger, notes });

  // Reset
  document.querySelectorAll('.emotion-btn').forEach(b => b.classList.remove('selected'));
  selectedEmotion = null;
  slider.value = 5;
  intensityDisplay.textContent = '5';
  intensityDisplay.style.color = '';
  document.getElementById('triggerSelect').value = '';
  document.getElementById('notesInput').value = '';

  showToast('✓ Registro guardado');
  if (intensity >= 8) setTimeout(() => showToast('⚠️ Intensidad alta — considera el Modo Crisis'), 2000);
  updateStreak();
});

// ── Streak badge ──────────────────────────────────────────────
function updateStreak() {
  const entries = DB.load();
  if (!entries.length) return;

  const days = new Set(entries.map(e => e.timestamp.slice(0, 10)));
  let streak = 0;
  let d = new Date();
  while (true) {
    const key = d.toISOString().slice(0, 10);
    if (!days.has(key)) break;
    streak++;
    d.setDate(d.getDate() - 1);
  }

  const badge = document.getElementById('streakBadge');
  if (streak > 0) {
    badge.textContent = `🔥 ${streak}d`;
    badge.style.display = 'block';
  }
}

// ── Render history ────────────────────────────────────────────
function renderHistory() {
  const entries = DB.load();
  const count   = document.getElementById('entryCount');
  const list    = document.getElementById('entriesList');

  count.textContent = entries.length + (entries.length === 1 ? ' registro' : ' registros');

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📖</div>
        <div class="empty-title">Sin registros aún</div>
        <div class="empty-sub">Cuando guardes tu primera entrada,<br>aparecerá aquí.</div>
      </div>`;
    return;
  }

  list.innerHTML = entries.map(e => {
    const d    = new Date(e.timestamp);
    const time = d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
               + ' · ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const meta = EMOTIONS[e.emotion] || { icon: '💭' };
    const cls  = e.emotion === 'calma' ? 'calm-e' : e.intensity >= 8 ? 'high' : '';
    return `
      <div class="entry-card ${cls}">
        <div class="entry-icon">${meta.icon}</div>
        <div class="entry-body">
          <div class="entry-top">
            <div class="entry-emotion">${e.emotion}</div>
            <div class="entry-badge">${e.intensity}/10</div>
          </div>
          <div class="entry-time">${time}</div>
          ${e.trigger ? `<div class="entry-trigger">↳ ${e.trigger}</div>` : ''}
          ${e.notes   ? `<div class="entry-notes">${escHtml(e.notes)}</div>` : ''}
        </div>
      </div>`;
  }).join('');
}

function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Render stats ──────────────────────────────────────────────
function renderStats() {
  const entries = DB.load();

  document.getElementById('statTotal').textContent   = entries.length;
  document.getElementById('statCrisis').textContent  = entries.filter(e => e.intensity >= 8).length;

  const weekAgo = Date.now() - 7 * 864e5;
  document.getElementById('statWeek').textContent = entries.filter(e => +new Date(e.timestamp) > weekAgo).length;

  if (entries.length) {
    const avg = entries.reduce((s, e) => s + e.intensity, 0) / entries.length;
    document.getElementById('statAvg').textContent = avg.toFixed(1);
  } else {
    document.getElementById('statAvg').textContent = '—';
  }

  // Emotion frequency bars
  const eCounts = {};
  entries.forEach(e => { eCounts[e.emotion] = (eCounts[e.emotion] || 0) + 1; });
  const eMax    = Math.max(...Object.values(eCounts), 1);
  const eSorted = Object.entries(eCounts).sort((a, b) => b[1] - a[1]);

  document.getElementById('emotionBars').innerHTML = eSorted.length
    ? eSorted.map(([em, n]) => {
        const meta = EMOTIONS[em] || { icon: '💭', color: '#7c6cfc' };
        return `
          <div class="bar-row">
            <div class="bar-label">${meta.icon} ${em}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(n/eMax)*100}%;background:${meta.color}"></div></div>
            <div class="bar-count">${n}</div>
          </div>`;
      }).join('')
    : '<p style="color:var(--muted);font-size:14px;">Sin datos aún</p>';

  // Trigger bars
  const tCounts = {};
  entries.filter(e => e.trigger).forEach(e => { tCounts[e.trigger] = (tCounts[e.trigger] || 0) + 1; });
  const tMax    = Math.max(...Object.values(tCounts), 1);
  const tSorted = Object.entries(tCounts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  document.getElementById('triggerBars').innerHTML = tSorted.length
    ? tSorted.map(([tr, n]) => `
        <div class="bar-row">
          <div class="bar-label" style="font-size:11px;">${tr}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${(n/tMax)*100}%;background:var(--crisis)"></div></div>
          <div class="bar-count">${n}</div>
        </div>`).join('')
    : '<p style="color:var(--muted);font-size:14px;">Sin datos aún</p>';

  // Average intensity per emotion
  const eIntensity = {};
  const eCnt2      = {};
  entries.forEach(e => {
    eIntensity[e.emotion] = (eIntensity[e.emotion] || 0) + e.intensity;
    eCnt2[e.emotion]      = (eCnt2[e.emotion]      || 0) + 1;
  });
  const eAvg = Object.keys(eIntensity).map(k => [k, eIntensity[k] / eCnt2[k]]);
  eAvg.sort((a, b) => b[1] - a[1]);

  document.getElementById('intensityBars').innerHTML = eAvg.length
    ? eAvg.map(([em, avg]) => {
        const meta = EMOTIONS[em] || { icon: '💭', color: '#7c6cfc' };
        const c    = intensityColor(Math.round(avg));
        return `
          <div class="bar-row">
            <div class="bar-label">${meta.icon} ${em}</div>
            <div class="bar-track"><div class="bar-fill" style="width:${(avg/10)*100}%;background:${c}"></div></div>
            <div class="bar-count">${avg.toFixed(1)}</div>
          </div>`;
      }).join('')
    : '<p style="color:var(--muted);font-size:14px;">Sin datos aún</p>';
}

// ── Crisis mode ───────────────────────────────────────────────
const overlay = document.getElementById('crisisOverlay');

document.getElementById('crisisFab').addEventListener('click', openCrisis);
document.getElementById('crisisClose').addEventListener('click', closeCrisis);

function openCrisis() {
  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
  resetGrounding();
}

function closeCrisis() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
  breathStop();
  impulseStop();
}

// ── Breathing (4-4-6 cycle) ───────────────────────────────────
let breathTimer   = null;
let breathPhase   = null;
let breathSeconds = 0;

const PHASES = [
  { name: 'inhaling', label: 'Inhala',  duration: 4 },
  { name: 'holding',  label: 'Mantén',  duration: 4 },
  { name: 'exhaling', label: 'Exhala',  duration: 6 },
];
let phaseIdx = 0;

document.getElementById('breathStart').addEventListener('click', breathStart);
document.getElementById('breathStop').addEventListener('click',  breathStop);

function breathStart() {
  breathStop();
  phaseIdx = 0;
  runPhase();
}

function runPhase() {
  const p = PHASES[phaseIdx % PHASES.length];
  breathSeconds = p.duration;

  const circle  = document.getElementById('breathCircle');
  const instr   = document.getElementById('breathInstruction');
  const counter = document.getElementById('breathCounter');

  circle.className = 'breath-circle ' + p.name;
  circle.textContent = '';
  instr.textContent  = p.label;
  counter.textContent = breathSeconds;

  breathTimer = setInterval(() => {
    breathSeconds--;
    counter.textContent = breathSeconds;
    if (breathSeconds <= 0) {
      clearInterval(breathTimer);
      phaseIdx++;
      runPhase();
    }
  }, 1000);
}

function breathStop() {
  clearInterval(breathTimer);
  breathTimer = null;
  const circle = document.getElementById('breathCircle');
  circle.className    = 'breath-circle';
  circle.textContent  = 'Listo';
  document.getElementById('breathInstruction').textContent = 'Presiona para empezar';
  document.getElementById('breathCounter').textContent = '';
}

// ── Grounding 5-4-3-2-1 ──────────────────────────────────────
let gStep = 0;

function resetGrounding() {
  gStep = 0;
  document.querySelectorAll('.g-step').forEach((el, i) => {
    el.classList.toggle('active', i === 0);
    el.classList.remove('done');
  });
  document.getElementById('groundingNext').textContent = 'Siguiente paso →';
}

document.getElementById('groundingNext').addEventListener('click', () => {
  const steps = document.querySelectorAll('.g-step');
  if (gStep < steps.length) {
    steps[gStep].classList.remove('active');
    steps[gStep].classList.add('done');
    gStep++;
    if (gStep < steps.length) {
      steps[gStep].classList.add('active');
    } else {
      document.getElementById('groundingNext').textContent = '✓ Completado — reiniciar';
      showToast('✓ Grounding completado. Bien hecho.');
      gStep = 0;
      setTimeout(resetGrounding, 1500);
    }
  }
});

// ── Impulse timer (10 min) ────────────────────────────────────
const TOTAL_IMPULSE = 600;
let impulseRemaining = TOTAL_IMPULSE;
let impulseTimer     = null;
let impulseMsgTimer  = null;

const IMPULSE_MSGS = [
  '"Puedo tolerar este malestar."',
  '"Esta sensación pasará."',
  '"Soy más que este impulso."',
  '"Un momento antes de actuar."',
  '"Mi cerebro está en alerta, no en peligro real."',
  '"Puedo elegir mi respuesta."',
];

document.getElementById('impulseStart').addEventListener('click', impulseStart);
document.getElementById('impulseReset').addEventListener('click', impulseReset);

function impulseStart() {
  impulseStop();
  if (impulseRemaining <= 0) impulseRemaining = TOTAL_IMPULSE;
  renderImpulse();

  impulseTimer = setInterval(() => {
    impulseRemaining--;
    renderImpulse();
    if (impulseRemaining <= 0) {
      impulseStop();
      document.getElementById('impulseMsg').textContent = '✓ Lo lograste. Decide ahora con calma.';
    }
  }, 1000);

  let msgIdx = 1;
  impulseMsgTimer = setInterval(() => {
    document.getElementById('impulseMsg').textContent = IMPULSE_MSGS[msgIdx % IMPULSE_MSGS.length];
    msgIdx++;
  }, 25000);
}

function impulseStop() {
  clearInterval(impulseTimer);
  clearInterval(impulseMsgTimer);
  impulseTimer = impulseMsgTimer = null;
}

function impulseReset() {
  impulseStop();
  impulseRemaining = TOTAL_IMPULSE;
  renderImpulse();
  document.getElementById('impulseMsg').textContent = IMPULSE_MSGS[0];
}

function renderImpulse() {
  const m = Math.floor(impulseRemaining / 60).toString().padStart(2, '0');
  const s = (impulseRemaining % 60).toString().padStart(2, '0');
  document.getElementById('impulseTime').textContent = `${m}:${s}`;
  document.getElementById('impulseFill').style.width = `${(impulseRemaining / TOTAL_IMPULSE) * 100}%`;
}

// ── Header clock ──────────────────────────────────────────────
function updateClock() {
  document.getElementById('headerTime').textContent =
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── Greeting ──────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  const g = h < 6 ? 'Buenas noches' : h < 12 ? 'Buenos días' : h < 20 ? 'Buenas tardes' : 'Buenas noches';
  document.getElementById('greeting').textContent = g;
}

// ── Service worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────
setGreeting();
updateClock();
setInterval(updateClock, 30000);
updateStreak();
renderImpulse();
