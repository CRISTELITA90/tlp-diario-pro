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

// ── Notifications ─────────────────────────────────────────────
const NOTIF_KEY    = 'tlp_notif_time';
const NOTIF_SHOWN  = 'tlp_notif_shown_date';

function notifSupported() {
  return 'Notification' in window;
}

function initNotifUI() {
  if (!notifSupported()) return;

  const perm      = Notification.permission;
  const banner    = document.getElementById('notifBanner');
  const settings  = document.getElementById('notifSettings');
  const timeInput = document.getElementById('notifTimeInput');

  if (perm === 'default') {
    banner.style.display = 'flex';
  } else if (perm === 'granted') {
    banner.style.display = 'none';
    settings.style.display = 'flex';
    const saved = localStorage.getItem(NOTIF_KEY) || '20:00';
    timeInput.value = saved;
    updateNotifDesc(saved);
  }
}

function updateNotifDesc(time) {
  document.getElementById('notifSettingsDesc').textContent = `Recordatorio a las ${time}`;
}

document.getElementById('notifEnableBtn').addEventListener('click', async () => {
  if (!notifSupported()) return;
  const perm = await Notification.requestPermission();
  if (perm === 'granted') {
    localStorage.setItem(NOTIF_KEY, '20:00');
    initNotifUI();
    showToast('🔔 Recordatorio activado a las 20:00');
    scheduleNotifCheck();
  } else {
    showToast('Permiso denegado. Actívalo en ajustes del navegador.');
  }
});

document.getElementById('notifTimeInput').addEventListener('change', e => {
  localStorage.setItem(NOTIF_KEY, e.target.value);
  updateNotifDesc(e.target.value);
  showToast(`🔔 Recordatorio actualizado a las ${e.target.value}`);
});

function scheduleNotifCheck() {
  const savedTime = localStorage.getItem(NOTIF_KEY) || '20:00';
  const [h, m]   = savedTime.split(':').map(Number);
  const now       = new Date();
  const target    = new Date(now);
  target.setHours(h, m, 0, 0);
  if (target <= now) target.setDate(target.getDate() + 1);

  const msUntil = target - now;
  setTimeout(() => {
    fireReminder();
    setInterval(fireReminder, 24 * 60 * 60 * 1000);
  }, msUntil);
}

function fireReminder() {
  if (Notification.permission !== 'granted') return;
  const today   = new Date().toISOString().slice(0, 10);
  const entries = DB.load();
  const hasToday = entries.some(e => e.timestamp.startsWith(today));
  if (!hasToday) {
    new Notification('TLP Diario', {
      body: '¿Cómo te sientes hoy? Tómate un momento para registrarlo.',
      icon: '/manifest.json',
      badge: '/manifest.json',
      tag: 'daily-reminder',
    });
  }
}

function checkMissedToday() {
  if (Notification.permission !== 'granted') return;
  const today       = new Date().toISOString().slice(0, 10);
  const lastShown   = localStorage.getItem(NOTIF_SHOWN);
  if (lastShown === today) return;

  const entries    = DB.load();
  const hasToday   = entries.some(e => e.timestamp.startsWith(today));
  const h          = new Date().getHours();
  if (!hasToday && h >= 12) {
    showToast('📝 Aún no has registrado nada hoy');
    localStorage.setItem(NOTIF_SHOWN, today);
  }
}

// ── Service worker registration ───────────────────────────────
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(() => {});
}

// ── Voice Diary ───────────────────────────────────────────────
let voiceRecorder  = null;
let voiceStream    = null;
let voiceRecTimerId = null;
let voiceSeconds   = 0;

const voiceRecordBtn   = document.getElementById('voiceRecordBtn');
const voiceRecordLabel = document.getElementById('voiceRecordLabel');
const voiceTimerEl     = document.getElementById('voiceTimer');
const voiceTranscript  = document.getElementById('voiceTranscript');
const analyzeBtn       = document.getElementById('analyzeBtn');

// Speech Recognition
let speechRec   = null;
let speechFinal = '';

function initSpeechRec() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return;
  speechRec = new SR();
  speechRec.continuous     = true;
  speechRec.interimResults = true;
  speechRec.lang           = 'es-ES';

  speechRec.onresult = e => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      if (e.results[i].isFinal) speechFinal += e.results[i][0].transcript + ' ';
      else interim = e.results[i][0].transcript;
    }
    voiceTranscript.value = speechFinal + interim;
    checkAnalyzable();
  };
  speechRec.onerror = e => { if (e.error !== 'no-speech') console.warn('SR:', e.error); };
}

function checkAnalyzable() {
  const ok = voiceTranscript.value.trim().length >= 10;
  analyzeBtn.style.opacity      = ok ? '1' : '.4';
  analyzeBtn.style.pointerEvents = ok ? 'auto' : 'none';
}

voiceTranscript.addEventListener('input', checkAnalyzable);

voiceRecordBtn.addEventListener('click', async () => {
  if (voiceRecorder && voiceRecorder.state !== 'inactive') {
    stopVoiceRecording();
  } else {
    await startVoiceRecording();
  }
});

async function startVoiceRecording() {
  try {
    voiceStream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true }
    });
  } catch {
    showToast('Permiso de micrófono denegado. Actívalo en ajustes.');
    return;
  }

  speechFinal = '';
  voiceTranscript.value = '';
  voiceSeconds = 0;
  checkAnalyzable();

  voiceRecorder = new MediaRecorder(voiceStream);
  voiceRecorder.start(500);

  voiceRecordBtn.classList.add('active');
  voiceRecordLabel.textContent = 'Parar';
  voiceTimerEl.style.opacity   = '1';

  voiceRecTimerId = setInterval(() => {
    voiceSeconds++;
    const m = Math.floor(voiceSeconds / 60).toString().padStart(2, '0');
    const s = (voiceSeconds % 60).toString().padStart(2, '0');
    voiceTimerEl.textContent = `${m}:${s}`;
  }, 1000);

  if (speechRec) { try { speechRec.start(); } catch {} }
}

function stopVoiceRecording() {
  if (voiceRecorder?.state !== 'inactive') voiceRecorder?.stop();
  if (speechRec) { try { speechRec.stop(); } catch {} }
  if (voiceStream) voiceStream.getTracks().forEach(t => t.stop());

  clearInterval(voiceRecTimerId);
  voiceRecordBtn.classList.remove('active');
  voiceRecordLabel.textContent = 'Grabar';
  voiceTimerEl.style.opacity   = '0';

  if (!voiceTranscript.value.trim() && voiceSeconds > 2) {
    showToast('Escribe tu diario manualmente si prefires');
  }
  checkAnalyzable();
}

// ── Local keyword analysis (fallback) ─────────────────────────
const KW = {
  ansiedad:           ['ansiedad','ansioso','ansiosa','nervioso','nerviosa','agitado','tenso','preocupado','angustia','angustiado','agobia'],
  ira:                ['ira','rabia','enfadado','enfadada','furioso','furiosa','odio','exploto','explosión','enojo','enojado'],
  tristeza:           ['triste','tristeza','llorar','lloro','llorando','deprimido','vacío','nada','sin ganas'],
  'miedo al abandono':['abandonado','sola','solo','nadie','rechazo','rechazado','rechazada','me dejaron','me dejó','me fui'],
  impulsividad:       ['no pude','actué','impulso','sin pensar','arrepiento','arrepentida','hice algo','me arrepiento'],
  disociación:        ['desconectado','desconectada','no soy yo','irreal','extraño','confuso','nublado','como si','flotando'],
  calma:              ['bien','tranquilo','tranquila','calmado','mejor','feliz','contento','paz','alegría','descansado'],
};

const EXERCISES_LOCAL = {
  ansiedad:           { nombre:'Respiración 4-4-6', descripcion:'Activa el sistema parasimpático y reduce la activación.', pasos:['Inhala lentamente 4 segundos','Mantén 4 segundos','Exhala despacio 6 segundos — repite 5 veces'] },
  ira:                { nombre:'TIP — Temperatura', descripcion:'Baja la activación fisiológica rápidamente.', pasos:['Pon agua fría en la cara 30 segundos','O sostén hielo en las manos','Respira despacio mientras lo haces'] },
  tristeza:           { nombre:'Autocompasión activa', descripcion:'Trata tus emociones con amabilidad y sin juicio.', pasos:['Pon una mano en el pecho','Di: "Es normal sentir esto"','Pregunta: ¿qué necesito ahora?'] },
  'miedo al abandono':{ nombre:'Grounding 5-4-3-2-1', descripcion:'Ancla tu atención al momento presente seguro.', pasos:['5 cosas que puedes VER','4 que puedes TOCAR','3 que oyes, 2 que hueles, 1 que saboreas'] },
  impulsividad:       { nombre:'STOP + Timer 10 min', descripcion:'Pausa antes de actuar desde el impulso.', pasos:['Para lo que estás haciendo','Activa el temporizador de 10 minutos','Decide con calma cuando acabe'] },
  disociación:        { nombre:'Grounding físico', descripcion:'Reconecta con el cuerpo y el entorno.', pasos:['Pisa el suelo con fuerza varias veces','Frota las palmas hasta sentir calor','Nombra 5 objetos que ves ahora mismo'] },
  calma:              { nombre:'Consolidar el momento', descripcion:'Ancla esta experiencia positiva en la memoria.', pasos:['Observa qué generó esta calma','Respira y disfruta el momento','Anota qué lo hizo posible'] },
};

const AUDIO_MAP = {
  ansiedad: 'calma', ira: 'regulacion', tristeza: 'calma',
  'miedo al abandono': 'equilibrio', impulsividad: 'respiracion',
  disociación: 'equilibrio', calma: 'calma',
};

function analyzeLocally(text) {
  const lower = text.toLowerCase();
  const found = {};
  for (const [emotion, words] of Object.entries(KW)) {
    const hits = words.filter(w => lower.includes(w));
    if (hits.length) found[emotion] = hits.length;
  }
  const sorted   = Object.entries(found).sort((a, b) => b[1] - a[1]);
  const emotions = sorted.map(([e]) => e).slice(0, 3);
  const primary  = emotions[0] || 'ansiedad';
  const intensity = Math.min(10, Math.max(1, sorted.reduce((s, [, n]) => s + n, 0) * 2 + 2));

  return {
    emociones: emotions.length ? emotions : ['neutro'],
    keywords:  sorted.flatMap(([e]) => KW[e] ? KW[e].filter(w => lower.includes(w)).slice(0,2) : []).slice(0,5),
    intensidad: intensity,
    insight:   emotions.length
      ? `Tu relato refleja principalmente ${primary}. Reconocer esto es el primer paso para regularte.`
      : 'Tu diario muestra una experiencia variada. Bien por tomarte este espacio.',
    ejercicio: EXERCISES_LOCAL[primary] || EXERCISES_LOCAL.ansiedad,
    audio_recomendado: AUDIO_MAP[primary] || 'calma',
    source: 'local',
  };
}

// ── AI Analysis ───────────────────────────────────────────────
let lastAnalysis = null;

analyzeBtn.addEventListener('click', async () => {
  const transcript = voiceTranscript.value.trim();
  if (!transcript) return;

  analyzeBtn.textContent        = '⌛ Analizando…';
  analyzeBtn.style.opacity      = '.6';
  analyzeBtn.style.pointerEvents = 'none';

  let result;
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript }),
    });
    if (!res.ok) throw new Error('http ' + res.status);
    result = await res.json();
    if (result.error) throw new Error(result.error);
  } catch {
    result = analyzeLocally(transcript);
  }

  lastAnalysis = { ...result, transcript, timestamp: new Date().toISOString() };
  renderAnalysis(result);

  analyzeBtn.textContent        = '🤖 Analizar de nuevo';
  analyzeBtn.style.opacity      = '1';
  analyzeBtn.style.pointerEvents = 'auto';
});

function renderAnalysis(r) {
  // Emotion tags
  document.getElementById('aiEmotionTags').innerHTML =
    (r.emociones || []).map(e => {
      const m = EMOTIONS[e.toLowerCase()] || { icon: '💭' };
      return `<span class="e-tag">${m.icon} ${e}</span>`;
    }).join('');

  // Intensity
  const v = r.intensidad || 5;
  document.getElementById('aiIntensityLabel').textContent = `Intensidad estimada: ${v}/10`;
  document.getElementById('aiIntensityBar').style.width      = `${v * 10}%`;
  document.getElementById('aiIntensityBar').style.background = intensityColor(v);

  // Insight
  document.getElementById('aiInsight').textContent = r.insight || '';

  // Exercise
  const ex = r.ejercicio || {};
  document.getElementById('exerciseName').textContent = ex.nombre || '';
  document.getElementById('exerciseDesc').textContent = ex.descripcion || '';
  document.getElementById('exerciseSteps').innerHTML  =
    (ex.pasos || []).map(p => `<li>${escHtml(p)}</li>`).join('');

  // Recommended audio
  if (r.audio_recomendado) {
    const LABELS = { calma:'Calma Alpha 432Hz', equilibrio:'Equilibrio 528Hz', regulacion:'Regulación Theta', respiracion:'Respiración guiada' };
    const btn = document.getElementById('audioRecBtn');
    btn.textContent    = `▶ ${LABELS[r.audio_recomendado] || 'Audio terapéutico'}`;
    btn.dataset.prog   = r.audio_recomendado;
    btn.onclick = () => {
      therapyAudio.toggle(r.audio_recomendado);
      btn.textContent = therapyAudio.isPlaying(r.audio_recomendado)
        ? '⏹ Parar audio'
        : `▶ ${LABELS[r.audio_recomendado]}`;
    };
    document.getElementById('audioRec').style.display = 'block';
  }

  // Source note
  document.getElementById('aiSourceNote').textContent =
    r.source === 'claude' ? 'Análisis por Claude (Anthropic)' : 'Análisis local · configura ANTHROPIC_API_KEY en Vercel para IA completa';

  document.getElementById('aiResults').style.display  = 'block';
  document.getElementById('saveVoiceBtn').style.display = 'block';
  setTimeout(() => document.getElementById('aiResults').scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
}

document.getElementById('saveVoiceBtn').addEventListener('click', () => {
  if (!lastAnalysis) return;
  const emotion = (lastAnalysis.emociones || [])[0] || 'vacío';
  DB.save({
    emotion,
    intensity: lastAnalysis.intensidad || 5,
    trigger:   '',
    notes:     `[Diario de voz] ${lastAnalysis.transcript.slice(0, 200)}`,
    voiceDiary: true,
  });
  showToast('✓ Guardado en historial');
  document.getElementById('saveVoiceBtn').style.display = 'none';
  updateStreak();
});

// ── Therapy Audio (Web Audio API) ─────────────────────────────
const therapyAudio = (() => {
  let ctx = null;
  let currentProg = null;
  let nodes = [];
  let masterGain = null;

  function getCtx() {
    if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
    return ctx;
  }

  const PROGRAMS = {
    calma: {
      label: 'Calma Alpha',
      build(c, master) {
        // 3 detuned oscillators → rich pad + 10Hz LFO (alpha entrainment)
        [[432, .25], [432.7, .18], [431.3, .18]].forEach(([f, g]) => {
          const o = c.createOscillator(), gain = c.createGain();
          o.type = 'sine'; o.frequency.value = f; gain.gain.value = g;
          o.connect(gain); gain.connect(master); o.start();
          nodes.push(o, gain);
        });
        addLFO(c, master, 10, .15);
      }
    },
    equilibrio: {
      label: 'Equilibrio 528Hz',
      build(c, master) {
        [[528, .25], [527.4, .18], [528.6, .18]].forEach(([f, g]) => {
          const o = c.createOscillator(), gain = c.createGain();
          o.type = 'sine'; o.frequency.value = f; gain.gain.value = g;
          o.connect(gain); gain.connect(master); o.start();
          nodes.push(o, gain);
        });
        addLFO(c, master, 2.5, .1);
      }
    },
    regulacion: {
      label: 'Regulación Theta',
      build(c, master) {
        [[396, .28], [395.4, .18]].forEach(([f, g]) => {
          const o = c.createOscillator(), gain = c.createGain();
          o.type = 'sine'; o.frequency.value = f; gain.gain.value = g;
          o.connect(gain); gain.connect(master); o.start();
          nodes.push(o, gain);
        });
        addLFO(c, master, 6, .2);
      }
    },
    respiracion: {
      label: 'Respiración guiada',
      build(c, master) {
        const o = c.createOscillator();
        o.type = 'sine'; o.frequency.value = 200;
        o.connect(master); o.start();
        nodes.push(o);
        // Rising/falling tone: inhale 4s → hold 4s → exhale 6s
        let t = c.currentTime + .1;
        const cycle = () => {
          if (!nodes.includes(o)) return;
          o.frequency.setValueAtTime(200, t);
          o.frequency.linearRampToValueAtTime(370, t + 4);   // inhale
          o.frequency.setValueAtTime(370, t + 8);             // hold
          o.frequency.linearRampToValueAtTime(200, t + 14);  // exhale
          t += 14;
          setTimeout(cycle, (t - c.currentTime - 1) * 1000);
        };
        cycle();
      }
    },
  };

  function addLFO(c, master, freq, depth) {
    const lfo = c.createOscillator(), lfoG = c.createGain();
    lfo.type = 'sine'; lfo.frequency.value = freq; lfoG.gain.value = depth;
    lfo.connect(lfoG); lfoG.connect(master.gain);
    lfo.start(); nodes.push(lfo, lfoG);
  }

  function stop() {
    if (!masterGain || !ctx) return;
    masterGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 1.2);
    const snapshot = [...nodes];
    setTimeout(() => {
      snapshot.forEach(n => { try { n.stop?.(); n.disconnect(); } catch {} });
    }, 1300);
    nodes = []; masterGain = null; currentProg = null;
    updateAudioUI(null);
  }

  function play(progId) {
    const prog = PROGRAMS[progId];
    if (!prog) return;
    const wasPlaying = !!currentProg;
    stop();

    setTimeout(() => {
      const c = getCtx();
      if (c.state === 'suspended') c.resume();
      masterGain = c.createGain();
      masterGain.gain.setValueAtTime(0, c.currentTime);
      masterGain.gain.linearRampToValueAtTime(0.32, c.currentTime + 2);
      masterGain.connect(c.destination);
      nodes = [masterGain];
      prog.build(c, masterGain);
      currentProg = progId;
      updateAudioUI(progId);
    }, wasPlaying ? 1350 : 0);
  }

  function toggle(progId) {
    currentProg === progId ? stop() : play(progId);
  }

  function isPlaying(progId) { return currentProg === progId; }

  function updateAudioUI(progId) {
    document.querySelectorAll('.audio-prog-btn').forEach(b =>
      b.classList.toggle('playing', b.dataset.prog === progId)
    );
    const bar = document.getElementById('audioPlayerBar');
    if (progId) {
      document.getElementById('audioProgName').textContent =
        PROGRAMS[progId]?.label || progId;
      bar.style.display = 'flex';
    } else {
      bar.style.display = 'none';
    }
  }

  // Wire crisis mode buttons
  document.querySelectorAll('.audio-prog-btn').forEach(b =>
    b.addEventListener('click', () => toggle(b.dataset.prog))
  );
  document.getElementById('audioStopBtn').addEventListener('click', stop);

  // Stop audio when crisis overlay closes
  document.getElementById('crisisClose').addEventListener('click', stop, { capture: true });

  return { play, stop, toggle, isPlaying };
})();

// ── Init ──────────────────────────────────────────────────────
setGreeting();
updateClock();
setInterval(updateClock, 30000);
updateStreak();
renderImpulse();
initNotifUI();
checkMissedToday();
initSpeechRec();
if (notifSupported() && Notification.permission === 'granted') {
  scheduleNotifCheck();
}
