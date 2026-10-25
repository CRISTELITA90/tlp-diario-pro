/* ============================================================================
   pulso-sos.js — TLP Diario Pro
   1) Contactos de confianza con llamada a un toque dentro del Modo Crisis
   2) Guardian de pulso: lee la frecuencia cardiaca de una banda o reloj por
      Bluetooth y, si se mantiene alta, te pregunta si estas bien antes de
      abrir el Modo Crisis.

   LIMITES REALES, leelos antes de confiar en esto:
   - Usa Web Bluetooth. Funciona en Chrome/Edge en Android, Windows, macOS y
     Linux. NO funciona en iPhone ni iPad (Safari no implementa Web Bluetooth).
   - Requiere HTTPS (Vercel ya lo da) y que TU pulses el boton de emparejar:
     el navegador no puede conectarse solo.
   - Solo funciona con la pestana abierta. Si cierras la app o bloqueas el
     movil mucho rato, la conexion se cae. Esto NO es vigilancia continua.
   - Solo lee dispositivos que expongan el servicio Bluetooth estandar de
     frecuencia cardiaca (0x180D): bandas de pecho y relojes en modo difusion.
     Un Apple Watch o un Fitbit normales no lo exponen a terceros.
   - NUNCA llama a nadie por su cuenta. Un pulso alto no distingue una crisis
     de unas escaleras. Siempre te pregunta primero.

   Carga este fichero DESPUES de script.js.
   ========================================================================= */

(function () {
  'use strict';

  if (window.__pulsoSosCargado) return;
  window.__pulsoSosCargado = true;

  var KEY = 'tlp_sos_v1';

  var CFG = {
    contactos: [],     // { id, nombre, tel }
    umbral: 110,       // bpm a partir del cual cuenta
    segundos: 90,      // cuanto tiempo debe mantenerse por encima
    reposo: '',        // pulso en reposo declarado (informativo)
    avisar: true       // mostrar la pregunta "estas bien"
  };

  try {
    var g = JSON.parse(localStorage.getItem(KEY) || '{}');
    if (Array.isArray(g.contactos)) CFG.contactos = g.contactos;
    if (g.umbral)   CFG.umbral   = parseInt(g.umbral, 10)   || CFG.umbral;
    if (g.segundos) CFG.segundos = parseInt(g.segundos, 10) || CFG.segundos;
    if (typeof g.reposo === 'string') CFG.reposo = g.reposo;
    if (typeof g.avisar === 'boolean') CFG.avisar = g.avisar;
  } catch (e) { /* configuracion corrupta: usamos los valores por defecto */ }

  function guardar() {
    try { localStorage.setItem(KEY, JSON.stringify(CFG)); } catch (e) {}
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function telLimpio(t) { return String(t).replace(/[^0-9+]/g, ''); }

  function $(id) { return document.getElementById(id); }

  function avisar(msg) {
    if (typeof window.showToast === 'function') window.showToast(msg);
  }

  function vibrar(patron) {
    try { if (navigator.vibrate) navigator.vibrate(patron); } catch (e) {}
  }

  /* ── Estilos ───────────────────────────────────────────────────────── */

  var CSS = '' +
    '.sos-block{background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:var(--rs);padding:14px;}' +
    '.sos-title{font-size:14px;font-weight:700;margin-bottom:4px;display:flex;' +
      'align-items:center;gap:8px;}' +
    '.sos-sub{font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:10px;}' +
    '.sos-contact{display:flex;align-items:center;gap:10px;background:var(--surface);' +
      'border:1px solid var(--border);border-radius:var(--rs);padding:10px 12px;' +
      'margin-bottom:8px;}' +
    '.sos-contact .nm{flex:1;min-width:0;}' +
    '.sos-contact .nm b{display:block;font-size:14px;}' +
    '.sos-contact .nm span{font-size:12px;color:var(--muted);}' +
    '.sos-call{background:var(--calm);color:#fff;text-decoration:none;border-radius:10px;' +
      'padding:10px 16px;font-size:14px;font-weight:700;white-space:nowrap;}' +
    '.sos-x{background:none;border:none;color:var(--danger);font-size:16px;cursor:pointer;}' +
    '.sos-in{width:100%;background:var(--surface);border:1px solid var(--border);' +
      'border-radius:10px;padding:10px 12px;font-size:14px;color:var(--text);' +
      'font-family:inherit;}' +
    '.sos-row{display:flex;gap:8px;margin-bottom:8px;}' +
    '.sos-row>*{flex:1;}' +
    '.sos-btn{background:var(--accent);color:#fff;border:none;border-radius:10px;' +
      'padding:11px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}' +
    '.sos-btn.ghost{background:transparent;color:var(--accent);border:1px solid var(--border);}' +
    '.sos-btn.stop{background:var(--danger);}' +
    '.sos-btn[disabled]{opacity:.45;cursor:not-allowed;}' +
    '.sos-bpm{font-size:34px;font-weight:800;text-align:center;margin:10px 0 2px;' +
      'color:var(--accent);}' +
    '.sos-bpm.alta{color:var(--danger);}' +
    '.sos-state{font-size:12px;color:var(--muted);text-align:center;margin-bottom:10px;}' +
    '.sos-warn{font-size:11px;color:var(--muted);line-height:1.5;margin-top:10px;' +
      'padding-top:10px;border-top:1px solid var(--border);}' +
    '.sos-ask{position:fixed;inset:0;z-index:999;background:rgba(30,27,75,.93);' +
      'display:none;align-items:center;justify-content:center;padding:24px;}' +
    '.sos-ask.on{display:flex;}' +
    '.sos-ask-box{background:var(--surface);border-radius:var(--r);padding:26px 22px;' +
      'max-width:360px;width:100%;text-align:center;}' +
    '.sos-ask-box h3{font-size:20px;margin-bottom:8px;}' +
    '.sos-ask-box p{font-size:14px;color:var(--muted);line-height:1.55;margin-bottom:16px;}' +
    '.sos-count{font-size:40px;font-weight:800;color:var(--crisis);margin-bottom:14px;}' +
    '.sos-ask-btns{display:flex;flex-direction:column;gap:10px;}' +
    '.sos-ask-btns button{padding:14px;border-radius:12px;border:none;font-size:15px;' +
      'font-weight:700;cursor:pointer;font-family:inherit;}' +
    '.sos-ok{background:var(--calm);color:#fff;}' +
    '.sos-help{background:var(--danger);color:#fff;}';

  function inyectarCSS() {
    var s = document.createElement('style');
    s.id = 'pulso-sos-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Contactos de confianza ────────────────────────────────────────── */

  function pintarContactos() {
    var cont = $('sosContactos');
    if (!cont) return;
    if (!CFG.contactos.length) {
      cont.innerHTML = '<div class="sos-sub" style="text-align:center;padding:8px 0;">' +
        'Todavia no has guardado ningun contacto. Anade al menos uno: en mitad de ' +
        'una crisis no vas a querer buscar un numero.</div>';
      return;
    }
    cont.innerHTML = CFG.contactos.map(function (c) {
      return '<div class="sos-contact">' +
        '<div class="nm"><b>' + esc(c.nombre) + '</b><span>' + esc(c.tel) + '</span></div>' +
        '<a class="sos-call" href="tel:' + esc(telLimpio(c.tel)) + '">Llamar</a>' +
        '<button class="sos-x" data-del-c="' + esc(c.id) + '" aria-label="Eliminar">✕</button>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('[data-del-c]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-c');
        CFG.contactos = CFG.contactos.filter(function (x) { return String(x.id) !== id; });
        guardar(); pintarContactos();
      });
    });
  }

  function bloqueContactos() {
    return '<div class="sos-block" style="margin-bottom:16px;">' +
      '<div class="sos-title"><span>📞</span> Contactos de confianza</div>' +
      '<div class="sos-sub">Un toque y llamas. Guarda a quien de verdad coge el telefono.</div>' +
      '<div id="sosContactos"></div>' +
      '<div class="sos-row" style="margin-top:10px;">' +
      '<input class="sos-in" id="sosNombre" placeholder="Nombre">' +
      '<input class="sos-in" id="sosTel" type="tel" placeholder="Telefono">' +
      '</div>' +
      '<button class="sos-btn ghost" id="sosAddC" style="width:100%;">Anadir contacto</button>' +
      '</div>';
  }

  function engancharContactos() {
    var b = $('sosAddC');
    if (!b) return;
    b.addEventListener('click', function () {
      var n = $('sosNombre').value.trim();
      var t = $('sosTel').value.trim();
      if (!n || !t) { avisar('Falta el nombre o el telefono'); return; }
      CFG.contactos.push({ id: Date.now() + '', nombre: n, tel: t });
      guardar();
      $('sosNombre').value = ''; $('sosTel').value = '';
      pintarContactos();
    });
  }

  /* ── Guardian de pulso ─────────────────────────────────────────────── */

  var dispositivo = null;
  var caracteristica = null;
  var vigilando = false;
  var desdeCuando = null;   // timestamp en que se cruzo el umbral
  var wakeLock = null;
  var ultimoBpm = null;

  function soportado() {
    return typeof navigator !== 'undefined' &&
           navigator.bluetooth &&
           typeof navigator.bluetooth.requestDevice === 'function';
  }

  function bloquePulso() {
    if (!soportado()) {
      return '<div class="sos-block">' +
        '<div class="sos-title"><span>❤️</span> Guardian de pulso</div>' +
        '<div class="sos-sub">Este navegador no permite leer sensores por Bluetooth. ' +
        'En iPhone y iPad no es posible; Safari no lo implementa. ' +
        'Funciona en Chrome o Edge sobre Android, Windows, macOS o Linux.</div>' +
        '</div>';
    }
    return '<div class="sos-block">' +
      '<div class="sos-title"><span>❤️</span> Guardian de pulso <span style="font-size:11px;' +
        'font-weight:400;color:var(--muted);">beta</span></div>' +
      '<div class="sos-sub">Conecta una banda de pecho o un reloj que emita pulso por Bluetooth. ' +
      'Si tu frecuencia se mantiene alta, la app te pregunta si estas bien antes de hacer nada.</div>' +

      '<div class="sos-bpm" id="sosBpm">—</div>' +
      '<div class="sos-state" id="sosEstado">Sin conectar</div>' +

      '<div class="sos-row">' +
      '<button class="sos-btn" id="sosConectar">Conectar sensor</button>' +
      '<button class="sos-btn stop" id="sosParar" disabled>Parar</button>' +
      '</div>' +

      '<div class="sos-row">' +
      '<div><div class="sos-sub" style="margin:0 0 4px;">Pulso en reposo</div>' +
      '<input class="sos-in" id="sosReposo" type="number" min="30" max="140" ' +
        'placeholder="opcional" value="' + esc(CFG.reposo) + '"></div>' +
      '<div><div class="sos-sub" style="margin:0 0 4px;">Avisar por encima de</div>' +
      '<input class="sos-in" id="sosUmbral" type="number" min="60" max="200" ' +
        'value="' + esc(CFG.umbral) + '"></div>' +
      '</div>' +

      '<div class="sos-sub" style="margin:0 0 4px;">Durante al menos (segundos)</div>' +
      '<input class="sos-in" id="sosSegundos" type="number" min="15" max="600" ' +
        'value="' + esc(CFG.segundos) + '">' +

      '<div class="sos-warn">Solo funciona con la app abierta en pantalla. No sustituye a una ' +
      'persona ni a los servicios de emergencia. Si estas en peligro, llama al ' +
      '<a href="tel:112">112</a> o al <a href="tel:024">024</a>.</div>' +
      '</div>';
  }

  function estado(txt) {
    var el = $('sosEstado');
    if (el) el.textContent = txt;
  }

  function pintarBpm(bpm) {
    var el = $('sosBpm');
    if (!el) return;
    el.textContent = bpm === null ? '—' : bpm;
    el.classList.toggle('alta', bpm !== null && bpm >= CFG.umbral);
  }

  function leerConfigUI() {
    var u = $('sosUmbral'), s = $('sosSegundos'), r = $('sosReposo');
    if (u && parseInt(u.value, 10)) CFG.umbral = parseInt(u.value, 10);
    if (s && parseInt(s.value, 10)) CFG.segundos = parseInt(s.value, 10);
    if (r) CFG.reposo = r.value;
    guardar();
  }

  /* Parseo segun la especificacion Bluetooth Heart Rate Measurement (0x2A37):
     bit 0 de flags = formato del valor (0 -> uint8, 1 -> uint16 little endian) */
  function parseaHR(dataView) {
    var flags = dataView.getUint8(0);
    return (flags & 0x01) ? dataView.getUint16(1, true) : dataView.getUint8(1);
  }

  function alRecibir(ev) {
    var dv = ev.target.value;
    if (!dv || dv.byteLength < 2) return;
    var bpm = parseaHR(dv);
    if (!bpm || bpm < 20 || bpm > 250) return;   // lectura absurda: la ignoramos
    ultimoBpm = bpm;
    pintarBpm(bpm);

    if (!vigilando) return;

    if (bpm >= CFG.umbral) {
      if (desdeCuando === null) desdeCuando = Date.now();
      var seg = Math.round((Date.now() - desdeCuando) / 1000);
      estado('Por encima de ' + CFG.umbral + ' desde hace ' + seg + ' s');
      if (seg >= CFG.segundos) {
        desdeCuando = null;
        if (CFG.avisar) preguntar(bpm);
      }
    } else {
      if (desdeCuando !== null) estado('Pulso normalizado');
      else estado('Vigilando');
      desdeCuando = null;
    }
  }

  async function pedirWakeLock() {
    try {
      if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen');
    } catch (e) { /* no es critico */ }
  }

  function soltarWakeLock() {
    try { if (wakeLock) { wakeLock.release(); wakeLock = null; } } catch (e) {}
  }

  async function conectar() {
    leerConfigUI();
    try {
      estado('Buscando sensor...');
      dispositivo = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }]
      });

      dispositivo.addEventListener('gattserverdisconnected', function () {
        vigilando = false;
        caracteristica = null;
        desdeCuando = null;
        pintarBpm(null);
        estado('Sensor desconectado');
        soltarWakeLock();
        var c = $('sosConectar'), p = $('sosParar');
        if (c) c.disabled = false;
        if (p) p.disabled = true;
        avisar('Sensor de pulso desconectado');
      });

      var servidor = await dispositivo.gatt.connect();
      var servicio = await servidor.getPrimaryService('heart_rate');
      caracteristica = await servicio.getCharacteristic('heart_rate_measurement');
      await caracteristica.startNotifications();
      caracteristica.addEventListener('characteristicvaluechanged', alRecibir);

      vigilando = true;
      desdeCuando = null;
      estado('Vigilando');
      await pedirWakeLock();

      var c = $('sosConectar'), p = $('sosParar');
      if (c) c.disabled = true;
      if (p) p.disabled = false;
      avisar('Sensor conectado');

    } catch (e) {
      if (e && e.name === 'NotFoundError') {
        estado('No elegiste ningun dispositivo');
      } else {
        estado('No se pudo conectar: ' + (e && e.message ? e.message : 'error desconocido'));
      }
    }
  }

  async function parar() {
    vigilando = false;
    desdeCuando = null;
    try {
      if (caracteristica) {
        caracteristica.removeEventListener('characteristicvaluechanged', alRecibir);
        await caracteristica.stopNotifications();
      }
    } catch (e) {}
    try {
      if (dispositivo && dispositivo.gatt && dispositivo.gatt.connected) dispositivo.gatt.disconnect();
    } catch (e) {}
    caracteristica = null;
    pintarBpm(null);
    estado('Detenido');
    soltarWakeLock();
    var c = $('sosConectar'), p = $('sosParar');
    if (c) c.disabled = false;
    if (p) p.disabled = true;
  }

  /* ── Pregunta de confirmacion ──────────────────────────────────────── */

  var preguntaAbierta = false;
  var cuentaTimer = null;

  function crearPregunta() {
    var d = document.createElement('div');
    d.className = 'sos-ask';
    d.id = 'sosAsk';
    d.setAttribute('role', 'dialog');
    d.setAttribute('aria-modal', 'true');
    d.innerHTML =
      '<div class="sos-ask-box">' +
      '<h3>¿Estas bien?</h3>' +
      '<p id="sosAskTxt">Tu pulso lleva un rato alto. Puede no ser nada.</p>' +
      '<div class="sos-count" id="sosCount">30</div>' +
      '<div class="sos-ask-btns">' +
      '<button class="sos-ok" id="sosOk">Estoy bien</button>' +
      '<button class="sos-help" id="sosHelp">Necesito ayuda</button>' +
      '</div></div>';
    document.body.appendChild(d);

    $('sosOk').addEventListener('click', function () {
      cerrarPregunta();
      avisar('De acuerdo. Sigo vigilando.');
    });
    $('sosHelp').addEventListener('click', function () {
      cerrarPregunta();
      abrirCrisis();
    });
  }

  function preguntar(bpm) {
    if (preguntaAbierta) return;
    preguntaAbierta = true;

    var txt = $('sosAskTxt');
    if (txt) {
      txt.textContent = 'Tu pulso lleva ' + CFG.segundos + ' segundos por encima de ' +
        CFG.umbral + ' (ahora ' + bpm + '). Puede no ser nada: escaleras, cafe, prisa. ' +
        'Si no respondes, abrire el Modo Crisis.';
    }

    var restante = 30;
    var cEl = $('sosCount');
    if (cEl) cEl.textContent = restante;
    $('sosAsk').classList.add('on');
    vibrar([200, 100, 200]);

    clearInterval(cuentaTimer);
    cuentaTimer = setInterval(function () {
      restante--;
      if (cEl) cEl.textContent = restante;
      if (restante <= 0) {
        cerrarPregunta();
        abrirCrisis();
      }
    }, 1000);
  }

  function cerrarPregunta() {
    preguntaAbierta = false;
    clearInterval(cuentaTimer);
    var el = $('sosAsk');
    if (el) el.classList.remove('on');
  }

  function abrirCrisis() {
    vibrar([300, 150, 300, 150, 300]);
    if (typeof window.openCrisis === 'function') {
      window.openCrisis();
    } else {
      var ov = $('crisisOverlay');
      if (ov) {
        ov.classList.add('open');
        document.body.style.overflow = 'hidden';
      }
    }
    avisar('Modo Crisis abierto');
  }

  /* ── Montaje dentro del Modo Crisis ────────────────────────────────── */

  function montar() {
    inyectarCSS();

    var body = document.querySelector('.crisis-body');
    if (!body) {
      console.warn('[pulso-sos] no encuentro .crisis-body; el modulo no se monta');
      return;
    }

    // Contactos arriba del todo: es lo primero que hace falta en una crisis.
    var arriba = document.createElement('div');
    arriba.innerHTML = bloqueContactos();
    body.insertBefore(arriba, body.firstChild);

    // Guardian de pulso al final, antes del aviso legal.
    var abajo = document.createElement('div');
    abajo.innerHTML = '<div class="divider"></div>' + bloquePulso();
    var aviso = body.querySelector('.disclaimer');
    if (aviso) body.insertBefore(abajo, aviso.parentNode === body ? aviso : null);
    else body.appendChild(abajo);

    crearPregunta();
    engancharContactos();
    pintarContactos();

    var c = $('sosConectar'), p = $('sosParar');
    if (c) c.addEventListener('click', conectar);
    if (p) p.addEventListener('click', parar);

    ['sosUmbral', 'sosSegundos', 'sosReposo'].forEach(function (id) {
      var el = $(id);
      if (el) el.addEventListener('change', leerConfigUI);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', montar);
  } else {
    montar();
  }

  window.PulsoSOS = {
    ultimoPulso: function () { return ultimoBpm; },
    vigilando:   function () { return vigilando; },
    probarAviso: function () { preguntar(ultimoBpm || CFG.umbral); }
  };

})();
