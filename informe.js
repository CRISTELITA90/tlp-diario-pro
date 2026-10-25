/* ============================================================================
   informe.js — TLP Diario Pro
   Informe de progreso cada 40 dias.

   Como funciona:
   - Guarda una instantanea (como mucho una al dia) de las partes que no tienen
     fecha propia: los textos del yo ideal / yo real y las puntuaciones de la
     tabla comparativa. Sin eso no hay forma de saber que cambio.
   - El resto (episodios, valores, diario, Mapa manana y noche) ya lleva fecha,
     asi que se calcula directamente por ventanas de 40 dias.
   - Cada 40 dias aparece un aviso en la pestana Yo. Tambien puedes pedirlo
     a mano cuando quieras.

   Todo el calculo es local y deterministico: las cifras y las citas salen de
   tus datos, no de un modelo. La lectura narrativa por IA es opcional, va
   aparte y solo recibe el resumen ya calculado.

   Cargar DESPUES de identidad.js.
   ========================================================================= */

(function () {
  'use strict';

  if (window.__informeCargado) return;
  window.__informeCargado = true;

  var K_IDENT   = 'tlp_identidad_v1';
  var K_MAPA    = 'tlp_mapa_v1';
  var K_SNAPS   = 'tlp_snapshots_v1';
  var K_INFORMES= 'tlp_informes_v1';
  var K_ULTIMO  = 'tlp_informe_ultimo';

  var DIAS = 40;
  var TOPE_ARCHIVO = 300000;   // caracteres: por encima, archivamos sin el diario

  /* ── Utilidades ────────────────────────────────────────────────────── */

  function $(id) { return document.getElementById(id); }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function leer(clave, porDefecto) {
    try {
      var v = JSON.parse(localStorage.getItem(clave) || 'null');
      return v === null ? porDefecto : v;
    } catch (e) { return porDefecto; }
  }

  function escribir(clave, valor) {
    try { localStorage.setItem(clave, JSON.stringify(valor)); return true; }
    catch (e) { return false; }
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function diasEntre(a, b) {
    return Math.round((new Date(b + 'T12:00:00') - new Date(a + 'T12:00:00')) / 86400000);
  }

  function restaDias(iso, n) {
    var d = new Date(iso + 'T12:00:00');
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
  }

  function fechaBonita(iso) {
    try {
      return new Date(iso + 'T12:00:00')
        .toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch (e) { return iso; }
  }

  function media(nums) {
    var v = nums.filter(function (n) { return typeof n === 'number' && !isNaN(n); });
    if (!v.length) return null;
    return v.reduce(function (a, b) { return a + b; }, 0) / v.length;
  }

  function red1(n) { return n === null ? null : Math.round(n * 10) / 10; }

  function num(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return null;
    return Math.min(10, Math.max(1, n));
  }

  function enRango(fecha, desde, hasta) {
    return !!fecha && fecha >= desde && fecha <= hasta;
  }

  /* Diferencia descrita en palabras, nunca como aprobado o suspenso. */
  function flecha(antes, ahora, masEsMejor) {
    if (antes === null || ahora === null) return '';
    var d = ahora - antes;
    if (Math.abs(d) < 0.3) return ' (se mantiene)';
    var sube = d > 0;
    var bueno = masEsMejor ? sube : !sube;
    return ' (' + (sube ? 'sube' : 'baja') + ' ' + Math.abs(red1(d)) +
           (bueno ? ', en la buena direccion' : '') + ')';
  }

  /* ── Instantaneas ──────────────────────────────────────────────────── */

  function tomarInstantanea() {
    var ident = leer(K_IDENT, null);
    if (!ident) return;

    var snaps = leer(K_SNAPS, []);
    var ultima = snaps.length ? snaps[snaps.length - 1] : null;
    if (ultima && ultima.fecha === hoy()) {
      snaps.pop();                   // una por dia: la del dia se reemplaza
    }

    snaps.push({
      fecha: hoy(),
      ideal: Object.assign({}, ident.ideal),
      real:  Object.assign({}, ident.real),
      ancla: Object.assign({}, ident.ancla),
      criticos: (ident.criticos || []).length,
      comparativa: (ident.comparativa || []).map(function (f) {
        return { rasgo: f.rasgo, real: f.real, ideal: f.ideal,
                 segunYo: f.segunYo, segunDemas: f.segunDemas };
      })
    });

    // Guardamos como mucho 40 instantaneas: suficiente para varios informes.
    escribir(K_SNAPS, snaps.slice(-40));
  }

  function instantaneaCercaDe(fechaObjetivo) {
    var snaps = leer(K_SNAPS, []);
    if (!snaps.length) return null;
    var mejor = null, mejorDist = Infinity;
    snaps.forEach(function (s) {
      var d = Math.abs(diasEntre(s.fecha, fechaObjetivo));
      if (d < mejorDist) { mejorDist = d; mejor = s; }
    });
    return mejorDist <= 12 ? mejor : null;   // si no hay nada cercano, no comparamos
  }

  /* ── Calculo de metricas ───────────────────────────────────────────── */

  function calcular(desde, hasta) {
    var ident = leer(K_IDENT, null) || {};
    var mapa  = leer(K_MAPA, []) || [];

    var desdePrev = restaDias(desde, DIAS);
    var hastaPrev = restaDias(desde, 1);

    function mapaEn(d, h) {
      return mapa.filter(function (e) { return enRango(e.date, d, h); });
    }

    var act  = mapaEn(desde, hasta);
    var prev = mapaEn(desdePrev, hastaPrev);

    function escalas(lista) {
      return {
        sueno:   red1(media(lista.map(function (e) { return e.sueno; }))),
        energia: red1(media(lista.map(function (e) { return e.energia; }))),
        emocion: red1(media(lista.map(function (e) { return e.emocion; })))
      };
    }

    var diasConRegistro = {};
    act.forEach(function (e) { diasConRegistro[e.date] = true; });

    /* Logros y cualidades, en sus propias palabras.
       Deduplicamos: si alguien escribe "fui a trabajar" diez veces, repetirlo
       diez veces en el informe no celebra nada, lo diluye. Nos quedamos con la
       version mas reciente de cada texto distinto. */
    function cosecha(lista, campo, tope) {
      var vistos = {};
      var salida = [];
      lista.slice()
        .sort(function (a, b) { return (b.date || '').localeCompare(a.date || ''); })
        .forEach(function (e) {
          var t = e[campo] ? String(e[campo]).trim() : '';
          if (t.length <= 2) return;
          var clave = t.toLowerCase().replace(/[^a-z0-9áéíóúñü ]/gi, '').replace(/\s+/g, ' ');
          if (vistos[clave]) { vistos[clave].veces++; return; }
          var item = { fecha: e.date, texto: t, veces: 1 };
          vistos[clave] = item;
          salida.push(item);
        });
      return salida.slice(0, tope);
    }

    var episodios     = (ident.episodios || []).filter(function (e) { return enRango(e.fecha, desde, hasta); });
    var episodiosPrev = (ident.episodios || []).filter(function (e) { return enRango(e.fecha, desdePrev, hastaPrev); });
    var valores       = (ident.valores   || []).filter(function (v) { return enRango(v.fecha, desde, hasta); });
    var diario        = (ident.diario    || []).filter(function (d) { return enRango(d.fecha, desde, hasta); });

    // Tabla comparativa: estado actual y el de hace 40 dias
    var snapPrevio = instantaneaCercaDe(desde);

    function distancias(filas) {
      if (!filas) return [];
      return filas.map(function (f) {
        var r = num(f.real), i = num(f.ideal);
        return (r !== null && i !== null) ? { rasgo: f.rasgo, d: Math.abs(i - r) } : null;
      }).filter(Boolean);
    }

    var distAhora = distancias(ident.comparativa);
    var distAntes = snapPrevio ? distancias(snapPrevio.comparativa) : [];

    var mapaAntes = {};
    distAntes.forEach(function (x) { mapaAntes[x.rasgo] = x.d; });

    var movimientos = distAhora.map(function (x) {
      var antes = mapaAntes[x.rasgo];
      return {
        rasgo: x.rasgo,
        ahora: x.d,
        antes: (antes === undefined ? null : antes),
        cambio: (antes === undefined ? null : antes - x.d)   // positivo = te has acercado
      };
    });

    // Textos que ha reescrito desde la instantanea previa
    var reescritos = [];
    if (snapPrevio) {
      var etiquetas = {
        'ideal.calmado': 'Tu yo calmado', 'ideal.racional': 'Tu yo racional',
        'ideal.armonico': 'Tu yo armonico', 'ideal.vida': 'Como seria tu vida',
        'ideal.relaciones': 'Como serian tus relaciones',
        'real.comoSoy': 'Como eres', 'real.virtudes': 'Tus virtudes',
        'real.defectos': 'Tus defectos', 'real.impulsividad': 'Tu impulsividad',
        'real.valores': 'Tus valores', 'real.detonantes': 'Que te hace detonar',
        'real.disparadores': 'Tus disparadores'
      };
      Object.keys(etiquetas).forEach(function (ruta) {
        var p = ruta.split('.');
        var antes = (snapPrevio[p[0]] || {})[p[1]] || '';
        var ahora = ((ident[p[0]] || {})[p[1]]) || '';
        if (ahora && ahora !== antes) {
          reescritos.push({ etiqueta: etiquetas[ruta], vacioAntes: !antes });
        }
      });
    }

    return {
      desde: desde, hasta: hasta, desdePrev: desdePrev, hastaPrev: hastaPrev,
      diasCubiertos: diasEntre(desde, hasta) + 1,
      diasConRegistro: Object.keys(diasConRegistro).length,
      registros: act.length,
      registrosPrev: prev.length,
      escalas: escalas(act),
      escalasPrev: escalas(prev),
      logros:    cosecha(act, 'logro', 6),
      cualidades:cosecha(act, 'cualidad', 4),
      gratitudes:cosecha(act, 'gratitud', 4),
      episodios: episodios.length,
      episodiosPrev: episodiosPrev.length,
      intensidad:     red1(media(episodios.map(function (e) { return num(e.intensidad); }))),
      intensidadPrev: red1(media(episodiosPrev.map(function (e) { return num(e.intensidad); }))),
      valores: valores,
      jubiladas: valores.filter(function (v) { return v.veredicto === 'obsoleta'; }).length,
      revisadas: valores.filter(function (v) { return v.veredicto === 'revisar'; }).length,
      diario: diario.length,
      movimientos: movimientos,
      hayComparacion: !!snapPrevio,
      fechaSnapPrevio: snapPrevio ? snapPrevio.fecha : null,
      reescritos: reescritos,
      distMediaAhora: distAhora.length ? red1(media(distAhora.map(function (x) { return x.d; }))) : null,
      distMediaAntes: distAntes.length ? red1(media(distAntes.map(function (x) { return x.d; }))) : null
    };
  }

  /* ── Redaccion del informe ─────────────────────────────────────────── */

  function redactar(m) {
    var L = [];
    var hayAlgo = m.registros || m.episodios || m.diario || m.valores.length;

    L.push('# Informe de 40 dias');
    L.push('_Del ' + fechaBonita(m.desde) + ' al ' + fechaBonita(m.hasta) + '_');
    L.push('');

    if (!hayAlgo) {
      L.push('En estos 40 dias no hay registros suficientes para comparar nada.');
      L.push('');
      L.push('Eso no es un reproche. Hay temporadas en las que una no puede, y el diario ' +
             'es una herramienta, no una obligacion mas con la que fallar. Cuando vuelvas, ' +
             'el informe vuelve contigo.');
      return L.join('\n');
    }

    /* 1. Constancia */
    L.push('## Lo que has sostenido');
    L.push('Registraste algo en **' + m.diasConRegistro + ' de ' + m.diasCubiertos +
           ' dias** (' + m.registros + ' entradas en total' +
           (m.registrosPrev ? ', frente a ' + m.registrosPrev + ' en los 40 dias anteriores' : '') + ').');
    if (m.diario) L.push('Escribiste **' + m.diario + '** entradas en el diario libre.');
    L.push('');
    L.push('Aparecer es la parte dificil. Lo demas se construye encima de esto.');
    L.push('');

    /* 2. Como te has sentido */
    var e = m.escalas, ep = m.escalasPrev;
    if (e.sueno !== null || e.energia !== null || e.emocion !== null) {
      L.push('## Como te has sentido');
      if (e.sueno   !== null) L.push('- Sueno: **' + e.sueno + '/10**' + flecha(ep.sueno, e.sueno, true));
      if (e.energia !== null) L.push('- Energia: **' + e.energia + '/10**' + flecha(ep.energia, e.energia, true));
      if (e.emocion !== null) L.push('- Estado emocional: **' + e.emocion + '/10**' + flecha(ep.emocion, e.emocion, true));
      L.push('');
    }

    /* 3. Logros, en sus palabras */
    if (m.logros.length || m.cualidades.length) {
      L.push('## Tus logros, con tus palabras');
      L.push('Esto no lo escribio la aplicacion. Lo escribiste tu, en su dia:');
      L.push('');
      m.logros.forEach(function (l) {
        L.push('> ' + l.texto + '  \n> _' + fechaBonita(l.fecha) +
               (l.veces > 1 ? ' · lo anotaste ' + l.veces + ' veces' : '') + '_');
        L.push('');
      });
      if (m.cualidades.length) {
        L.push('Y cualidades que te reconociste:');
        m.cualidades.forEach(function (c) {
          L.push('- ' + c.texto + (c.veces > 1 ? ' (' + c.veces + ' veces)' : ''));
        });
        L.push('');
      }
      L.push('Leelos seguidos. Por separado parecian pequenos; juntos son cuarenta dias ' +
             'de alguien que no se rindio.');
      L.push('');
    }

    /* 4. Impulsos */
    L.push('## Impulsos');
    if (!m.episodios) {
      L.push('No registraste ningun episodio impulsivo en este periodo.');
      L.push('');
      L.push('Puede significar dos cosas distintas: que hubo menos, o que no llegaste a ' +
             'anotarlos. Solo tu sabes cual de las dos.');
    } else {
      L.push('Registraste **' + m.episodios + '** episodios' +
             (m.episodiosPrev ? ' (antes: ' + m.episodiosPrev + ')' : '') + '.');
      if (m.intensidad !== null) {
        L.push('Intensidad media del impulso: **' + m.intensidad + '/10**' +
               flecha(m.intensidadPrev, m.intensidad, false) + '.');
      }
      L.push('');
      if (m.episodiosPrev && m.episodios > m.episodiosPrev) {
        L.push('**Mas episodios registrados no significa que estes peor.** Casi siempre ' +
               'significa que te estas observando mejor y que ahora reconoces como impulso ' +
               'cosas que antes se te pasaban. Mira la intensidad antes que el numero.');
        L.push('');
      }
    }

    /* 5. Mapa de identidad */
    L.push('## Tu mapa de identidad');
    if (!m.hayComparacion) {
      L.push('Este es tu punto de partida: todavia no hay una foto anterior con la que ' +
             'comparar. El proximo informe ya podra decirte que se movio.');
      if (m.distMediaAhora !== null) {
        L.push('');
        L.push('Distancia media a tu yo ideal ahora mismo: **' + m.distMediaAhora + '**.');
      }
      L.push('');
    } else {
      if (m.distMediaAntes !== null && m.distMediaAhora !== null) {
        L.push('Distancia media a tu yo ideal: **' + m.distMediaAntes + ' → ' +
               m.distMediaAhora + '**' + flecha(m.distMediaAntes, m.distMediaAhora, false) + '.');
        L.push('');
      }
      var acercados = m.movimientos.filter(function (x) { return x.cambio !== null && x.cambio > 0; })
                                   .sort(function (a, b) { return b.cambio - a.cambio; });
      var alejados  = m.movimientos.filter(function (x) { return x.cambio !== null && x.cambio < 0; })
                                   .sort(function (a, b) { return a.cambio - b.cambio; });

      if (acercados.length) {
        L.push('**Te has acercado en:**');
        acercados.slice(0, 4).forEach(function (x) {
          L.push('- ' + x.rasgo + ' (' + x.antes + ' → ' + x.ahora + ')');
        });
        L.push('');
      }
      if (alejados.length) {
        L.push('**Se ha abierto distancia en:**');
        alejados.slice(0, 3).forEach(function (x) {
          L.push('- ' + x.rasgo + ' (' + x.antes + ' → ' + x.ahora + ')');
        });
        L.push('');
        L.push('Ojo con esto: a veces un rasgo "empeora" porque te has vuelto mas exigente ' +
               'o mas honesta al puntuarte, no porque hayas retrocedido.');
        L.push('');
      }
      if (!acercados.length && !alejados.length) {
        L.push('Las puntuaciones estan practicamente igual que hace 40 dias. Eso tambien es ' +
               'informacion: significa que el trabajo de este periodo fue de sostener, no de mover.');
        L.push('');
      }
    }

    if (m.reescritos.length) {
      L.push('**Reescribiste** ' + m.reescritos.length + ' de tus descripciones: ' +
             m.reescritos.map(function (r) {
               return r.etiqueta + (r.vacioAntes ? ' (antes estaba vacio)' : '');
             }).join(', ') + '.');
      L.push('');
      L.push('Cambiar como te describes es, muchas veces, el primer cambio real.');
      L.push('');
    }

    /* 6. Valores */
    if (m.valores.length) {
      L.push('## Valores revisados');
      L.push('Pusiste sobre la mesa **' + m.valores.length + '** ensenanzas recibidas: ' +
             '**' + m.jubiladas + '** jubiladas, **' + m.revisadas + '** en revision.');
      L.push('');
      m.valores.slice(0, 5).forEach(function (v) {
        var et = v.veredicto === 'obsoleta' ? 'jubilada'
               : v.veredicto === 'revisar'  ? 'en revision' : 'conservada';
        L.push('- _"' + v.ensenanza + '"_ — ' + et);
      });
      L.push('');
    }

    /* 7. Siguiente foco */
    L.push('## En que seguir');
    var foco = m.movimientos.slice().sort(function (a, b) { return b.ahora - a.ahora; })[0];
    if (foco) {
      L.push('El rasgo con mas distancia ahora mismo es **' + foco.rasgo +
             '** (' + foco.ahora + ').');
      L.push('');
      L.push('Uno cada vez. Cuarenta dias dan para mover uno bien, no cinco a medias.');
    } else {
      L.push('Rellena la tabla comparativa para que el proximo informe pueda senalarte un foco.');
    }
    L.push('');

    L.push('---');
    L.push('_Este informe lo calcula tu propio movil con tus datos. No sustituye a tu ' +
           'terapeuta: llevatelo a consulta si te sirve._');

    return L.join('\n');
  }

  /* ── Archivo del export completo ───────────────────────────────────── */

  function exportCompleto() {
    // Reutilizamos el exportador de identidad.js si esta disponible.
    var ident = leer(K_IDENT, null);
    if (!ident) return '';
    var txt = JSON.stringify(ident, null, 1);
    if (txt.length > TOPE_ARCHIVO) {
      var copia = Object.assign({}, ident);
      copia.diario = '[' + (ident.diario || []).length + ' entradas no archivadas por tamano]';
      txt = JSON.stringify(copia, null, 1);
    }
    return txt;
  }

  /* ── Generacion y guardado ─────────────────────────────────────────── */

  function generar(desde, hasta) {
    var m = calcular(desde, hasta);
    var texto = redactar(m);

    var informes = leer(K_INFORMES, []);
    informes.unshift({
      id: Date.now() + '',
      creado: new Date().toISOString(),
      desde: desde, hasta: hasta,
      texto: texto,
      metricas: m,
      archivo: exportCompleto()
    });
    escribir(K_INFORMES, informes.slice(0, 12));
    escribir(K_ULTIMO, hasta);

    return { metricas: m, texto: texto };
  }

  /* ── Interfaz ──────────────────────────────────────────────────────── */

  var CSS = '' +
    '.inf-banner{background:var(--accent-dim);border:1px solid var(--accent);' +
      'border-radius:var(--r);padding:16px 18px;margin-bottom:14px;}' +
    '.inf-banner h4{font-size:15px;margin-bottom:4px;}' +
    '.inf-banner p{font-size:13px;color:var(--muted);line-height:1.5;margin-bottom:12px;}' +
    '.inf-ov{position:fixed;inset:0;z-index:900;background:var(--bg);overflow-y:auto;' +
      'display:none;}' +
    '.inf-ov.on{display:block;}' +
    '.inf-head{position:sticky;top:0;background:var(--surface);border-bottom:1px solid var(--border);' +
      'padding:16px 20px;display:flex;align-items:center;justify-content:space-between;gap:10px;}' +
    '.inf-head b{font-size:16px;}' +
    '.inf-x{background:none;border:none;font-size:20px;color:var(--muted);cursor:pointer;}' +
    '.inf-body{padding:20px;max-width:480px;margin:0 auto;padding-bottom:60px;}' +
    '.inf-body h1{font-size:22px;margin:0 0 4px;}' +
    '.inf-body h2{font-size:16px;margin:26px 0 8px;color:var(--accent);}' +
    '.inf-body p{font-size:14px;line-height:1.65;margin-bottom:10px;}' +
    '.inf-body ul{margin:0 0 12px 18px;}' +
    '.inf-body li{font-size:14px;line-height:1.6;margin-bottom:5px;}' +
    '.inf-body em{color:var(--muted);font-style:normal;font-size:13px;}' +
    '.inf-body blockquote{border-left:3px solid var(--accent-light);background:var(--surface2);' +
      'border-radius:0 10px 10px 0;padding:12px 14px;margin:0 0 12px;font-size:14px;' +
      'line-height:1.6;}' +
    '.inf-body hr{border:none;border-top:1px solid var(--border);margin:24px 0 14px;}' +
    '.inf-acc{display:flex;gap:8px;flex-wrap:wrap;margin-top:20px;}' +
    '.inf-acc button{flex:1;min-width:130px;padding:12px;border-radius:12px;border:none;' +
      'font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;' +
      'background:var(--accent);color:#fff;}' +
    '.inf-acc button.ghost{background:transparent;color:var(--accent);' +
      'border:1px solid var(--border);}' +
    '.inf-ia{margin-top:16px;padding:14px;border-radius:var(--rs);background:var(--surface2);' +
      'border:1px solid var(--border);font-size:13px;line-height:1.6;}' +
    '.inf-hist{font-size:13px;color:var(--muted);margin-top:18px;}' +
    '.inf-hist a{color:var(--accent);text-decoration:none;display:block;padding:8px 0;' +
      'border-bottom:1px solid var(--border);}';

  function inyectarCSS() {
    var s = document.createElement('style');
    s.id = 'informe-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* Markdown minimo: solo lo que genera redactar(). */
  function aHtml(md) {
    var lineas = md.split('\n');
    var out = [], enLista = false, enCita = false;

    function cerrar() {
      if (enLista) { out.push('</ul>'); enLista = false; }
      if (enCita)  { out.push('</blockquote>'); enCita = false; }
    }

    lineas.forEach(function (l) {
      var t = l.trim();
      if (!t) { cerrar(); return; }

      if (t === '---') { cerrar(); out.push('<hr>'); return; }

      if (t.indexOf('# ') === 0 && t.indexOf('## ') !== 0) {
        cerrar(); out.push('<h1>' + inline(t.slice(2)) + '</h1>'); return;
      }
      if (t.indexOf('## ') === 0) {
        cerrar(); out.push('<h2>' + inline(t.slice(3)) + '</h2>'); return;
      }
      if (t.indexOf('> ') === 0) {
        if (enLista) { out.push('</ul>'); enLista = false; }
        if (!enCita) { out.push('<blockquote>'); enCita = true; }
        out.push(inline(t.slice(2)) + '<br>');
        return;
      }
      if (t.indexOf('- ') === 0) {
        if (enCita) { out.push('</blockquote>'); enCita = false; }
        if (!enLista) { out.push('<ul>'); enLista = true; }
        out.push('<li>' + inline(t.slice(2)) + '</li>');
        return;
      }
      cerrar();
      out.push('<p>' + inline(t) + '</p>');
    });
    cerrar();
    return out.join('');
  }

  function inline(s) {
    return esc(s)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/_([^_]+)_/g, '<em>$1</em>');
  }

  function crearOverlay() {
    var d = document.createElement('div');
    d.className = 'inf-ov';
    d.id = 'infOv';
    d.innerHTML =
      '<div class="inf-head"><b>Informe de 40 dias</b>' +
      '<button class="inf-x" id="infCerrar" aria-label="Cerrar">✕</button></div>' +
      '<div class="inf-body" id="infBody"></div>';
    document.body.appendChild(d);
    $('infCerrar').addEventListener('click', function () {
      d.classList.remove('on');
      document.body.style.overflow = '';
    });
  }

  var informeEnPantalla = null;

  function mostrar(res) {
    informeEnPantalla = res;
    var body = $('infBody');
    body.innerHTML = aHtml(res.texto) +
      '<div class="inf-acc">' +
      '<button id="infDescargar">Descargar informe</button>' +
      '<button class="ghost" id="infIA">Lectura con IA</button>' +
      '</div>' +
      '<div id="infIABox"></div>' +
      historialHtml();

    $('infDescargar').addEventListener('click', function () {
      descargar(res.texto, 'informe-40dias-' + res.metricas.hasta + '.md');
    });
    $('infIA').addEventListener('click', pedirIA);
    engancharHistorial();

    $('infOv').classList.add('on');
    document.body.style.overflow = 'hidden';
    $('infOv').scrollTop = 0;
  }

  function historialHtml() {
    var informes = leer(K_INFORMES, []);
    if (informes.length < 2) return '';
    return '<div class="inf-hist"><b>Informes anteriores</b>' +
      informes.slice(1).map(function (i) {
        return '<a href="#" data-inf="' + esc(i.id) + '">' + fechaBonita(i.hasta) + '</a>';
      }).join('') + '</div>';
  }

  function engancharHistorial() {
    document.querySelectorAll('[data-inf]').forEach(function (a) {
      a.addEventListener('click', function (ev) {
        ev.preventDefault();
        var id = a.getAttribute('data-inf');
        var i = leer(K_INFORMES, []).find(function (x) { return String(x.id) === id; });
        if (i) mostrar({ texto: i.texto, metricas: i.metricas });
      });
    });
  }

  function descargar(texto, nombre) {
    var blob = new Blob([texto], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = nombre;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  /* ── Lectura opcional con IA ───────────────────────────────────────── */

  function pedirIA() {
    var caja = $('infIABox');
    if (!informeEnPantalla) return;
    caja.innerHTML = '<div class="inf-ia">Pensando...</div>';

    fetch('/api/informe-40', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ informe: informeEnPantalla.texto })
    })
      .then(function (r) {
        if (!r.ok) throw new Error(r.status === 503
          ? 'La lectura con IA no esta configurada en el servidor.'
          : 'No se pudo generar (error ' + r.status + ').');
        return r.json();
      })
      .then(function (j) {
        caja.innerHTML = '<div class="inf-ia"><b>Lectura</b><br>' +
          esc(j.lectura || '').replace(/\n/g, '<br>') +
          '<br><br><span style="color:var(--muted);font-size:11px;">Generado por IA a ' +
          'partir del informe de arriba. Si algo no te cuadra, fiate del informe.</span></div>';
      })
      .catch(function (e) {
        caja.innerHTML = '<div class="inf-ia">' + esc(e.message) + '</div>';
      });
  }

  /* ── Aviso cada 40 dias ────────────────────────────────────────────── */

  function primeraFecha() {
    var mapa = leer(K_MAPA, []) || [];
    var ident = leer(K_IDENT, null) || {};
    var fechas = mapa.map(function (e) { return e.date; })
      .concat((ident.episodios || []).map(function (e) { return e.fecha; }))
      .concat((ident.diario || []).map(function (d) { return d.fecha; }))
      .filter(Boolean).sort();
    return fechas.length ? fechas[0] : hoy();
  }

  /* El informe cubre SIEMPRE los ultimos 40 dias. Si hace mas que no se genera
     uno, no alargamos la ventana: un informe de 80 dias mezcla dos periodos y
     deja de poder compararse con el anterior. */
  function ventana() { return restaDias(hoy(), DIAS - 1); }

  function tocaInforme() {
    var ultimo = leer(K_ULTIMO, null);
    if (!ultimo) {
      // Primer informe: a los 40 dias del primer registro que exista.
      return diasEntre(primeraFecha(), hoy()) >= DIAS;
    }
    return diasEntre(ultimo, hoy()) >= DIAS;
  }

  function montarBoton() {
    var barra = document.querySelector('#screen-yo .id-bar');
    if (!barra) return;
    var b = document.createElement('button');
    b.className = 'id-btn ghost';
    b.id = 'infVer';
    b.textContent = 'Ver informe';
    b.addEventListener('click', function () {
      mostrar(generar(ventana(), hoy()));
    });
    barra.appendChild(b);
  }

  function montarBanner() {
    if (!tocaInforme()) return;
    var pantalla = $('screen-yo');
    if (!pantalla) return;

    var desde = ventana();

    var div = document.createElement('div');
    div.className = 'inf-banner';
    div.innerHTML =
      '<h4>Han pasado 40 dias</h4>' +
      '<p>Hay un informe esperandote: que has trabajado, que se ha movido y que toca ahora.</p>' +
      '<button class="id-btn" id="infAbrir" style="width:100%;">Ver mi informe</button>';
    pantalla.insertBefore(div, pantalla.firstChild);

    $('infAbrir').addEventListener('click', function () {
      mostrar(generar(desde, hoy()));
      div.remove();
    });
  }

  /* ── Arranque ──────────────────────────────────────────────────────── */

  function iniciar() {
    inyectarCSS();
    crearOverlay();
    tomarInstantanea();
    montarBoton();
    montarBanner();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { setTimeout(iniciar, 0); });
  } else {
    setTimeout(iniciar, 0);
  }

  window.Informe = {
    generarAhora: function (dias) {
      return mostrar(generar(restaDias(hoy(), (dias || DIAS) - 1), hoy()));
    },
    metricas: function (dias) {
      return calcular(restaDias(hoy(), (dias || DIAS) - 1), hoy());
    },
    instantaneas: function () { return leer(K_SNAPS, []); }
  };

})();
