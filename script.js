/* ============================================================
   TLP Diario Pro — script.js
   Mi Mapa Emocional: morning/night check-in, dual notifications,
   crisis mode, history, stats.
   ============================================================ */

// ── Utility ───────────────────────────────────────────────────
function escHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ── Mapa data layer (localStorage) ───────────────────────────
const MapaDB = {
  KEY: 'tlp_mapa_v1',
  load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '[]'); } catch { return []; }
  },
  getTodayEntry(period) {
    const today = new Date().toISOString().slice(0, 10);
    return this.load().find(e => e.date === today && e.period === period) || null;
  },
  save(period, data) {
    const entries = this.load();
    const today = new Date().toISOString().slice(0, 10);
    const filtered = entries.filter(e => !(e.date === today && e.period === period));
    const entry = { id: Date.now(), timestamp: new Date().toISOString(), date: today, period, ...data };
    filtered.unshift(entry);
    localStorage.setItem(this.KEY, JSON.stringify(filtered.slice(0, 365)));
    return entry;
  },
};

// ── App state ─────────────────────────────────────────────────
let currentPeriod = 'manana';

// ── Scale values ──────────────────────────────────────────────
const scaleValues = { scaleSueno: 0, scaleEnergia: 0, scaleEmocion: 0 };

function buildScaleRow(containerId, field) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  for (let i = 1; i <= 10; i++) {
    const btn = document.createElement('button');
    btn.className = 'scale-btn';
    btn.textContent = i;
    btn.dataset.v = i;
    btn.addEventListener('click', () => {
      scaleValues[field] = i;
      el.querySelectorAll('.scale-btn').forEach(b => b.className = 'scale-btn');
      btn.className = 'scale-btn ' + (i <= 3 ? 'sel-low' : i <= 6 ? 'sel-mid' : 'sel-high');
    });
    el.appendChild(btn);
  }
}

function setScaleValue(containerId, field, value) {
  if (!value) return;
  scaleValues[field] = value;
  const el = document.getElementById(containerId);
  if (!el) return;
  el.querySelectorAll('.scale-btn').forEach(b => {
    b.className = 'scale-btn';
    if (parseInt(b.dataset.v) === value) {
      b.className = 'scale-btn ' + (value <= 3 ? 'sel-low' : value <= 6 ? 'sel-mid' : 'sel-high');
    }
  });
}

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
  if (screen === 'historial') renderHistory();
  if (screen === 'stats')     renderStats();
}

document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => navigate(btn.dataset.screen));
});

// ── Greeting ──────────────────────────────────────────────────
function setGreeting() {
  const h = new Date().getHours();
  let greeting, emoji;
  if (h >= 5 && h < 12)  { greeting = '¡Buenos días!';   emoji = '🌸'; }
  else if (h >= 12 && h < 20) { greeting = '¡Buenas tardes!'; emoji = '☀️'; }
  else                   { greeting = '¡Buenas noches!';  emoji = '🌙'; }
  document.getElementById('mapaGreeting').textContent = emoji + ' ' + greeting;

  const now = new Date();
  document.getElementById('mapaDate').textContent = now.toLocaleDateString('es-ES', {
    weekday: 'long', day: 'numeric', month: 'long'
  });
}

// ── Header clock ──────────────────────────────────────────────
function updateClock() {
  document.getElementById('headerTime').textContent =
    new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

// ── Streak badge ──────────────────────────────────────────────
function updateStreak() {
  const entries = MapaDB.load();
  if (!entries.length) return;

  const days = new Set(entries.map(e => e.date));
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

// ── Completion badges ─────────────────────────────────────────
function updateCompletionBadges() {
  const m = MapaDB.getTodayEntry('manana');
  const n = MapaDB.getTodayEntry('noche');
  const mb = document.getElementById('compManana');
  const nb = document.getElementById('compNoche');
  mb.textContent = m ? '✓ Mañana completa' : '⭕ Mañana pendiente';
  mb.className = 'comp-badge' + (m ? ' done' : '');
  nb.textContent = n ? '✓ Noche completa' : '⭕ Noche pendiente';
  nb.className = 'comp-badge' + (n ? ' done' : '');
}

// ── Period toggle ─────────────────────────────────────────────
function switchPeriod(period) {
  currentPeriod = period;
  document.getElementById('formManana').style.display = period === 'manana' ? 'block' : 'none';
  document.getElementById('formNoche').style.display  = period === 'noche'  ? 'block' : 'none';
  document.getElementById('periodBtnManana').classList.toggle('active', period === 'manana');
  document.getElementById('periodBtnNoche').classList.toggle('active', period === 'noche');

  // Load existing saved values into form
  if (period === 'manana') {
    loadMananaForm();
  } else {
    loadNocheForm();
  }
}

document.getElementById('periodBtnManana').addEventListener('click', () => switchPeriod('manana'));
document.getElementById('periodBtnNoche').addEventListener('click',  () => switchPeriod('noche'));

// ── Load morning form ─────────────────────────────────────────
function loadMananaForm() {
  const entry = MapaDB.getTodayEntry('manana');
  if (!entry) return;

  setScaleValue('scaleSueno',   'scaleSueno',   entry.sueno);
  setScaleValue('scaleEnergia', 'scaleEnergia', entry.energia);
  setScaleValue('scaleEmocion', 'scaleEmocion', entry.emocion);

  const fields = ['Necesito','Meta','PrimerPaso','Mantra','PensamientoLimitante','CambioPensamiento'];
  fields.forEach(f => {
    const el = document.getElementById('input' + f);
    if (el) el.value = entry[f.toLowerCase()] || '';
  });
}

// ── Load night form ───────────────────────────────────────────
function loadNocheForm() {
  const entry = MapaDB.getTodayEntry('noche');
  if (!entry) return;

  const fields = [
    'DialogoError','SituacionEstres','Reaccion','Diferente','Comunicar',
    'Asertividad','Vinculo','Logro','Cualidad','Actitud',
    'EmocionPredomino','PensamientoEmocion','Gratitud'
  ];
  fields.forEach(f => {
    const el = document.getElementById('input' + f);
    if (el) el.value = entry[f.toLowerCase()] || '';
  });
}

// ── Save morning ──────────────────────────────────────────────
document.getElementById('saveManana').addEventListener('click', () => {
  const data = {
    sueno:                scaleValues.scaleSueno,
    energia:              scaleValues.scaleEnergia,
    emocion:              scaleValues.scaleEmocion,
    necesito:             document.getElementById('inputNecesito').value.trim(),
    meta:                 document.getElementById('inputMeta').value.trim(),
    primerpaso:           document.getElementById('inputPrimerPaso').value.trim(),
    mantra:               document.getElementById('inputMantra').value.trim(),
    pensamientolimitante: document.getElementById('inputPensamientoLimitante').value.trim(),
    cambioPensamiento:    document.getElementById('inputCambioPensamiento').value.trim(),
  };

  MapaDB.save('manana', data);
  showToast('☀️ Mañana guardada');
  updateCompletionBadges();
  updateStreak();
});

// ── Save night ────────────────────────────────────────────────
document.getElementById('saveNoche').addEventListener('click', () => {
  const data = {
    dialogoerror:         document.getElementById('inputDialogoError').value.trim(),
    situacionestres:      document.getElementById('inputSituacionEstres').value.trim(),
    reaccion:             document.getElementById('inputReaccion').value.trim(),
    diferente:            document.getElementById('inputDiferente').value.trim(),
    comunicar:            document.getElementById('inputComunicar').value.trim(),
    asertividad:          document.getElementById('inputAsertividad').value.trim(),
    vinculo:              document.getElementById('inputVinculo').value.trim(),
    logro:                document.getElementById('inputLogro').value.trim(),
    cualidad:             document.getElementById('inputCualidad').value.trim(),
    actitud:              document.getElementById('inputActitud').value.trim(),
    emocionpredomino:     document.getElementById('inputEmocionPredomino').value.trim(),
    pensamientoemocion:   document.getElementById('inputPensamientoEmocion').value.trim(),
    gratitud:             document.getElementById('inputGratitud').value.trim(),
  };

  MapaDB.save('noche', data);
  showToast('🌙 Noche guardada');
  updateCompletionBadges();
  updateStreak();
});

// ── Render history ────────────────────────────────────────────
function renderHistory() {
  const entries = MapaDB.load();
  const count   = document.getElementById('entryCount');
  const list    = document.getElementById('entriesList');

  count.textContent = entries.length + (entries.length === 1 ? ' registro' : ' registros');

  if (!entries.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🗺️</div>
        <div class="empty-title">Sin registros aún</div>
        <div class="empty-sub">Completa tu primer mapa emocional<br>y aparecerá aquí.</div>
      </div>`;
    return;
  }

  // Group by date
  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = {};
    byDate[e.date][e.period] = e;
  });

  const sortedDates = Object.keys(byDate).sort((a, b) => b.localeCompare(a));

  list.innerHTML = sortedDates.map(date => {
    const dateLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const m = byDate[date]['manana'];
    const n = byDate[date]['noche'];

    let html = `<div class="entry-date-header">${dateLabel}</div>`;

    if (m) {
      const scores = [];
      if (m.sueno)   scores.push(`🌙 Sueño: ${m.sueno}`);
      if (m.energia) scores.push(`⚡ Energía: ${m.energia}`);
      if (m.emocion) scores.push(`💜 Emoción: ${m.emocion}`);
      const snippet = m.mantra || m.meta || '';
      html += `
        <div class="entry-period-card">
          <div class="entry-period-title">☀️ Mañana</div>
          ${scores.length ? `<div class="entry-scores">${scores.map(s => `<span class="entry-score-chip">${s}</span>`).join('')}</div>` : ''}
          ${snippet ? `<div class="entry-snippet">"${escHtml(snippet.slice(0,80))}"</div>` : ''}
        </div>`;
    }

    if (n) {
      const emotion = n.emocionpredomino || '';
      const snippet = n.logro || n.gratitud || '';
      html += `
        <div class="entry-period-card">
          <div class="entry-period-title">🌙 Noche</div>
          ${emotion ? `<div class="entry-scores"><span class="entry-score-chip">💜 ${escHtml(emotion.slice(0,30))}</span></div>` : ''}
          ${snippet ? `<div class="entry-snippet">"${escHtml(snippet.slice(0,80))}"</div>` : ''}
        </div>`;
    }

    return html;
  }).join('');
}

// ── Render stats ──────────────────────────────────────────────
function renderStats() {
  const entries = MapaDB.load();
  const allDays = new Set(entries.map(e => e.date));

  document.getElementById('statTotal').textContent = allDays.size;

  // Days with BOTH periods
  const byDate = {};
  entries.forEach(e => {
    if (!byDate[e.date]) byDate[e.date] = new Set();
    byDate[e.date].add(e.period);
  });
  const fullDays = Object.values(byDate).filter(s => s.has('manana') && s.has('noche')).length;
  document.getElementById('statCrisis').textContent = fullDays;

  // This week
  const weekAgo = Date.now() - 7 * 864e5;
  const weekEntries = entries.filter(e => +new Date(e.timestamp) > weekAgo);
  const weekDays = new Set(weekEntries.map(e => e.date));
  document.getElementById('statWeek').textContent = weekDays.size;

  // Average emotional score from morning entries
  const mananaEntries = entries.filter(e => e.period === 'manana' && e.emocion);
  if (mananaEntries.length) {
    const avg = mananaEntries.reduce((s, e) => s + e.emocion, 0) / mananaEntries.length;
    document.getElementById('statAvg').textContent = avg.toFixed(1);
  } else {
    document.getElementById('statAvg').textContent = '—';
  }

  // Sleep bars (last 7 manana entries)
  const sleepEntries = entries.filter(e => e.period === 'manana' && e.sueno).slice(0, 7).reverse();
  document.getElementById('sleepBars').innerHTML = sleepEntries.length
    ? sleepEntries.map(e => {
        const label = new Date(e.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        const pct = (e.sueno / 10) * 100;
        const color = e.sueno <= 3 ? '#db2777' : e.sueno <= 6 ? '#7c3aed' : '#059669';
        return `<div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="bar-count">${e.sueno}/10</div>
        </div>`;
      }).join('')
    : '<p style="color:var(--muted);font-size:14px;">Sin datos aún</p>';

  // Energy bars (last 7 manana entries)
  const energyEntries = entries.filter(e => e.period === 'manana' && e.energia).slice(0, 7).reverse();
  document.getElementById('energyBars').innerHTML = energyEntries.length
    ? energyEntries.map(e => {
        const label = new Date(e.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        const pct = (e.energia / 10) * 100;
        const color = e.energia <= 3 ? '#db2777' : e.energia <= 6 ? '#7c3aed' : '#059669';
        return `<div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="bar-count">${e.energia}/10</div>
        </div>`;
      }).join('')
    : '<p style="color:var(--muted);font-size:14px;">Sin datos aún</p>';

  // Emotion bars (last 7 manana entries)
  const emotionEntries = entries.filter(e => e.period === 'manana' && e.emocion).slice(0, 7).reverse();
  document.getElementById('emotionBars').innerHTML = emotionEntries.length
    ? emotionEntries.map(e => {
        const label = new Date(e.date + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric' });
        const pct = (e.emocion / 10) * 100;
        const color = e.emocion <= 3 ? '#db2777' : e.emocion <= 6 ? '#7c3aed' : '#059669';
        return `<div class="bar-row">
          <div class="bar-label">${label}</div>
          <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${color}"></div></div>
          <div class="bar-count">${e.emocion}/10</div>
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

  circle.className    = 'breath-circle ' + p.name;
  circle.textContent  = '';
  instr.textContent   = p.label;
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

// ── Notifications (DUAL: morning + night) ─────────────────────
const NOTIF_KEY_MORNING = 'tlp_notif_morning';
const NOTIF_KEY_NIGHT   = 'tlp_notif_night';

function notifSupported() {
  return 'Notification' in window;
}

function scheduleAllNotifs() {
  if (Notification.permission !== 'granted') return;
  scheduleSingleNotif(localStorage.getItem(NOTIF_KEY_MORNING) || '08:00', 'morning');
  scheduleSingleNotif(localStorage.getItem(NOTIF_KEY_NIGHT)   || '21:00', 'night');
}

function scheduleSingleNotif(timeStr, type) {
  const [h, m] = timeStr.split(':').map(Number);
  const now = new Date(), target = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);
  setTimeout(() => {
    fireNotif(type);
    setInterval(() => fireNotif(type), 24 * 60 * 60 * 1000);
  }, target - now);
}

function fireNotif(type) {
  if (Notification.permission !== 'granted') return;
  const already = MapaDB.getTodayEntry(type === 'morning' ? 'manana' : 'noche');
  if (!already) {
    new Notification('Mi Mapa Emocional 💜', {
      body: type === 'morning'
        ? '🌸 Buenos días — ¿Cómo amaneciste hoy? Completa tu mapa matutino.'
        : '🌙 Buenas noches — ¿Cómo fue tu día? Completa tu mapa nocturno.',
      tag: 'mapa-' + type,
    });
  }
}

function initNotifUI() {
  if (!notifSupported()) return;

  const perm   = Notification.permission;
  const banner = document.getElementById('notifBanner');
  const times  = document.getElementById('notifTimes');

  if (perm === 'default') {
    banner.style.display = 'flex';
    times.style.display  = 'none';
  } else if (perm === 'granted') {
    banner.style.display = 'none';
    times.style.display  = 'block';
    document.getElementById('notifMorningInput').value =
      localStorage.getItem(NOTIF_KEY_MORNING) || '08:00';
    document.getElementById('notifNightInput').value =
      localStorage.getItem(NOTIF_KEY_NIGHT) || '21:00';
  } else {
    // denied
    banner.style.display = 'none';
    times.style.display  = 'none';
  }
}

document.getElementById('notifEnableBtn').addEventListener('click', async () => {
  if (!notifSupported()) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem(NOTIF_KEY_MORNING, '08:00');
    localStorage.setItem(NOTIF_KEY_NIGHT, '21:00');
    initNotifUI();
    showToast('🔔 Recordatorios activados: 8:00 y 21:00');
    scheduleAllNotifs();
  } else {
    showToast('Permiso denegado. Actívalo en ajustes del navegador.');
  }
});

document.getElementById('notifMorningInput').addEventListener('change', e => {
  localStorage.setItem(NOTIF_KEY_MORNING, e.target.value);
  showToast(`☀️ Recordatorio mañana: ${e.target.value}`);
});

document.getElementById('notifNightInput').addEventListener('change', e => {
  localStorage.setItem(NOTIF_KEY_NIGHT, e.target.value);
  showToast(`🌙 Recordatorio noche: ${e.target.value}`);
});

// ── Service worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Init ──────────────────────────────────────────────────────
buildScaleRow('scaleSueno',   'scaleSueno');
buildScaleRow('scaleEnergia', 'scaleEnergia');
buildScaleRow('scaleEmocion', 'scaleEmocion');
setGreeting();
updateClock();
setInterval(updateClock, 30000);
updateCompletionBadges();
updateStreak();
renderImpulse();
initNotifUI();

// Auto-switch to night form if it's after 18:00
if (new Date().getHours() >= 18) {
  switchPeriod('noche');
} else {
  loadMananaForm();
}

if (notifSupported() && Notification.permission === 'granted') {
  scheduleAllNotifs();
}

// ── Voice diary (Voz screen) ──────────────────────────────────
// MediaRecorder captures audio; Web Speech API provides live
// transcription (Chrome/Edge only). AudioContext is created LAZILY
// on the first user click — browsers block it before a user gesture.
(function initVoz() {
  let mediaRecorder = null;
  let audioChunks   = [];
  let isRecording   = false;
  let recognition   = null;
  let transcript    = '';
  let timerInterval = null;
  let timerSeconds  = 0;

  // ── DOM refs — IDs match index.html ──────────────────────────
  const recordBtn    = document.getElementById('vozRecordBtn');
  const micIcon      = document.getElementById('vozMicIcon');
  const stopIcon     = document.getElementById('vozStopIcon');
  const statusEl     = document.getElementById('vozStatus');
  const timerEl      = document.getElementById('vozTimer');
  const transcriptEl = document.getElementById('vozTranscript');
  const fallbackEl   = document.getElementById('vozFallback');
  const errorEl      = document.getElementById('vozError');
  const saveBtn      = document.getElementById('vozSaveBtn');
  const copyBtn      = document.getElementById('vozCopyBtn');
  const clearBtn     = document.getElementById('vozClearBtn');

  // ── Web Speech API availability check ────────────────────────
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  // Show fallback message if speech recognition unavailable
  if (!SpeechRec && fallbackEl) {
    fallbackEl.style.display = 'block';
  }

  // ── Timer helpers ─────────────────────────────────────────────
  function startTimer() {
    timerSeconds = 0;
    clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      timerSeconds++;
      const m = Math.floor(timerSeconds / 60).toString().padStart(2, '0');
      const s = (timerSeconds % 60).toString().padStart(2, '0');
      if (timerEl) timerEl.textContent = m + ':' + s;
    }, 1000);
  }

  function stopTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
  }

  // ── Speech recognition ────────────────────────────────────────
  function startSpeech() {
    if (!SpeechRec) return;
    try {
      recognition = new SpeechRec();
      recognition.lang            = 'es-ES';
      recognition.continuous      = true;
      recognition.interimResults  = true;
      recognition.maxAlternatives = 1;

      recognition.onresult = e => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const chunk = e.results[i][0].transcript;
          if (e.results[i].isFinal) { transcript += chunk + ' '; }
          else { interim += chunk; }
        }
        if (transcriptEl) transcriptEl.value = (transcript + interim).trim();
      };

      recognition.onerror = ev => {
        if (ev.error === 'no-speech') return;
        if (ev.error === 'not-allowed') {
          showBannerError('Permiso de micrófono denegado para la transcripción.');
        }
      };

      recognition.onend = () => {
        if (isRecording && recognition) {
          try { recognition.start(); } catch (_) {}
        }
      };

      recognition.start();
    } catch (e) {
      // Transcription start failed — show fallback, recording continues
      if (fallbackEl) fallbackEl.style.display = 'block';
    }
  }

  function stopSpeech() {
    if (recognition) {
      try { recognition.stop(); } catch (_) {}
      recognition = null;
    }
  }

  // ── Banner helpers ────────────────────────────────────────────
  function showBannerError(msg) {
    if (errorEl) {
      errorEl.textContent  = '⚠️ ' + msg;
      errorEl.style.display = 'block';
    }
    showToast('⚠️ ' + msg.slice(0, 60));
  }

  function clearBanners() {
    if (errorEl) errorEl.style.display = 'none';
  }

  // ── Recording UI state ────────────────────────────────────────
  function setRecUI(recording) {
    if (micIcon)  micIcon.style.display  = recording ? 'none' : '';
    if (stopIcon) stopIcon.style.display = recording ? ''     : 'none';
    if (statusEl) statusEl.textContent   = recording
      ? '⏺ Grabando... toca para detener'
      : 'Toca para grabar';
    if (recordBtn) recordBtn.classList.toggle('recording', recording);
    if (timerEl) {
      timerEl.style.color = recording ? '#db2777' : '';
      if (!recording) { timerEl.textContent = ''; timerSeconds = 0; }
    }
  }

  // ── Record button — single toggle ─────────────────────────────
  async function startRecording() {
    clearBanners();

    // HTTPS / mediaDevices check (required for getUserMedia)
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      showBannerError('Tu navegador no soporta grabación de audio. Usa Chrome, Edge o Firefox con HTTPS.');
      return;
    }

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true }
      });
    } catch (err) {
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        showBannerError('Permiso de micrófono denegado. Ve a Ajustes → Permisos → Micrófono → Permitir para este sitio.');
      } else if (err.name === 'NotFoundError') {
        showBannerError('No se encontró ningún micrófono. Conecta uno e inténtalo de nuevo.');
      } else {
        showBannerError('Error al acceder al micrófono: ' + err.message);
      }
      return;
    }

    audioChunks = [];
    transcript  = '';
    if (transcriptEl) transcriptEl.value = '';

    // Pick best supported MIME type
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg', '']
      .find(m => m === '' || MediaRecorder.isTypeSupported(m));

    try {
      mediaRecorder = new MediaRecorder(stream, mime ? { mimeType: mime } : {});
    } catch (e) {
      showBannerError('MediaRecorder no disponible en este navegador: ' + e.message);
      stream.getTracks().forEach(t => t.stop());
      return;
    }

    mediaRecorder.ondataavailable = ev => {
      if (ev.data && ev.data.size > 0) audioChunks.push(ev.data);
    };

    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      // Add clip to saved list
      if (audioChunks.length) {
        const blob = new Blob(audioChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
        addClipToUI(blob);
      }
      showToast('🎙️ Grabación completada');
    };

    mediaRecorder.onerror = ev => {
      showBannerError('Error durante la grabación: ' + (ev.error?.message || 'desconocido'));
      stopRecording();
    };

    mediaRecorder.start(250);
    isRecording = true;
    setRecUI(true);
    startTimer();
    startSpeech();
  }

  function stopRecording() {
    if (!isRecording) return;
    isRecording = false;
    stopTimer();
    stopSpeech();
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      try { mediaRecorder.stop(); } catch (_) {}
    }
    setRecUI(false);
  }

  if (recordBtn) {
    recordBtn.addEventListener('click', () => {
      if (isRecording) { stopRecording(); } else { startRecording(); }
    });
  }

  // ── Save clip to clips panel using stylesheet classes ─────────
  function addClipToUI(blob) {
    const clipsSection = document.getElementById('vozClipsSection');
    const clipsList    = document.getElementById('vozClipsList');
    if (!clipsSection || !clipsList) return;

    const url  = URL.createObjectURL(blob);
    const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dur  = timerSeconds >= 60
      ? Math.floor(timerSeconds / 60) + 'm ' + (timerSeconds % 60) + 's'
      : timerSeconds + 's';

    const item = document.createElement('div');
    item.className = 'voz-clip-item';
    item.innerHTML =
      `<audio controls src="${url}"></audio>` +
      `<span class="voz-clip-meta">${time}<br>${dur}</span>` +
      `<button class="voz-clip-del" aria-label="Eliminar clip" title="Eliminar">✕</button>`;

    item.querySelector('.voz-clip-del').addEventListener('click', () => {
      URL.revokeObjectURL(url);
      item.remove();
      if (!clipsList.children.length) clipsSection.style.display = 'none';
    });

    clipsList.insertBefore(item, clipsList.firstChild);
    clipsSection.style.display = 'block';
  }

  // ── Copy / Clear buttons ──────────────────────────────────────
  if (copyBtn) {
    copyBtn.addEventListener('click', () => {
      const text = (transcriptEl && transcriptEl.value.trim()) || '';
      if (!text) { showToast('No hay texto para copiar'); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
          .then(() => showToast('📋 Copiado al portapapeles'))
          .catch(() => showToast('No se pudo copiar'));
      } else {
        if (transcriptEl) {
          transcriptEl.select();
          try { document.execCommand('copy'); showToast('📋 Copiado'); }
          catch (_) { showToast('No se pudo copiar'); }
        }
      }
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      transcript = '';
      if (transcriptEl) transcriptEl.value = '';
      showToast('Transcripción limpiada');
    });
  }

  // ── Save button ───────────────────────────────────────────────
  if (saveBtn) saveBtn.addEventListener('click', () => {
    showToast('Los clips se guardan automáticamente al detener');
  });

  // ── Analyze button ────────────────────────────────────────────
  const analyzeBtn = document.getElementById('vozAnalyzeBtn');
  if (analyzeBtn) {
    analyzeBtn.addEventListener('click', async () => {
      const text = transcriptEl ? transcriptEl.value.trim() : '';
      if (!text) { showToast('Escribe o graba algo primero.'); return; }
      showToast('Analizando...');
      try {
        const res = await fetch('/api/analyze', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ text }),
        });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.json();
        showToast(data.message || '✓ Análisis completado');
      } catch (_) {
        showToast('El análisis no está disponible ahora mismo.');
      }
    });
  }
})();

// ── Therapy audio (Web Audio API) ────────────────────────────
(function initTherapyAudio() {
  // AudioContext created lazily on first user gesture
  let audioCtx  = null;
  let nodes     = [];   // all active audio nodes (oscillators, gains)
  let breathTmr = null; // setTimeout for breathing cycle loop
  let activeBtn = null; // currently playing button element

  function getCtx() {
    if (!audioCtx || audioCtx.state === 'closed') {
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      } catch (e) {
        showToast('Audio no disponible en este dispositivo');
        return null;
      }
    }
    if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    return audioCtx;
  }

  function stopAll() {
    clearTimeout(breathTmr);
    breathTmr = null;
    nodes.forEach(n => {
      try { n.stop(); } catch (_) {}
      try { n.disconnect(); } catch (_) {}
    });
    nodes = [];
    document.querySelectorAll('.therapy-btn').forEach(b => b.classList.remove('playing'));
    activeBtn = null;
  }

  // Adds a low-frequency oscillator (LFO) that modulates the master gain
  function addLFO(ctx, masterGain, lfoFreq, lfoDepth) {
    try {
      const lfo  = ctx.createOscillator();
      const lfoG = ctx.createGain();
      lfo.type            = 'sine';
      lfo.frequency.value = lfoFreq;
      lfoG.gain.value     = lfoDepth;
      lfo.connect(lfoG);
      lfoG.connect(masterGain.gain);
      lfo.start();
      nodes.push(lfo, lfoG);
    } catch (_) {}
  }

  // Breathing program: 4-4-6 tones (inhale/hold/exhale), loops automatically
  function startBreathingTones(ctx) {
    const t = ctx.currentTime;

    function phase(freqStart, freqEnd, tStart, dur) {
      try {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqStart, t + tStart);
        osc.frequency.linearRampToValueAtTime(freqEnd, t + tStart + dur);
        gain.gain.setValueAtTime(0, t + tStart);
        gain.gain.linearRampToValueAtTime(0.14, t + tStart + 0.1);
        gain.gain.setValueAtTime(0.14, t + tStart + dur - 0.1);
        gain.gain.linearRampToValueAtTime(0, t + tStart + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t + tStart);
        osc.stop(t + tStart + dur);
        nodes.push(osc, gain);
      } catch (_) {}
    }

    phase(176, 220, 0, 4);   // inhale: rising
    phase(196, 196, 4, 4);   // hold: steady
    phase(196, 148, 8, 6);   // exhale: falling

    breathTmr = setTimeout(() => {
      if (activeBtn && activeBtn.dataset.program === 'respiracion') {
        // Clear old nodes so new cycle starts fresh
        nodes.forEach(n => { try { n.stop(); } catch (_) {} try { n.disconnect(); } catch (_) {} });
        nodes = [];
        startBreathingTones(ctx);
      }
    }, 14000);
  }

  function playProgram(btn) {
    const ctx     = getCtx();
    if (!ctx) return;
    const program = btn.dataset.program;
    stopAll();
    activeBtn = btn;
    btn.classList.add('playing');

    const master = ctx.createGain();
    master.gain.value = 0.18;
    master.connect(ctx.destination);
    nodes.push(master);

    if (program === 'calma') {
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = 432;
        osc.connect(master); osc.start(); nodes.push(osc);
        addLFO(ctx, master, 10, 0.12);
      } catch (_) {}

    } else if (program === 'equilibrio') {
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = 528;
        osc.connect(master); osc.start(); nodes.push(osc);
        addLFO(ctx, master, 2.5, 0.1);
      } catch (_) {}

    } else if (program === 'regulacion') {
      try {
        const osc = ctx.createOscillator();
        osc.type = 'sine'; osc.frequency.value = 396;
        osc.connect(master); osc.start(); nodes.push(osc);
        addLFO(ctx, master, 6, 0.15);
      } catch (_) {}

    } else if (program === 'respiracion') {
      master.disconnect();  // breathing uses per-phase gains
      nodes = nodes.filter(n => n !== master);
      startBreathingTones(ctx);
    }

    showToast('🎵 ' + btn.firstChild.textContent.trim() + ' iniciado');
  }

  document.querySelectorAll('.therapy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn === activeBtn) { stopAll(); showToast('Audio detenido'); return; }
      playProgram(btn);
    });
  });

  const stopAllBtn = document.getElementById('toneStopAll');
  if (stopAllBtn) stopAllBtn.addEventListener('click', () => { stopAll(); showToast('Audio detenido'); });
})();
