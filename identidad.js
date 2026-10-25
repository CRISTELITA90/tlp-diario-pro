/* ============================================================================
   identidad.js — TLP Diario Pro
   Apartado 1: Yo ideal / Yo real / Yo segun los demas / Tabla comparativa
   Apartado 2: Episodios impulsivos (situacion, sensaciones, pensamientos)
   Apartado 3: Valores dia a dia + personaje ancla
   Apartado 4: Diario personal TLP

   Modulo autonomo. Se carga DESPUES de script.js. No modifica nada existente:
   crea su propia pantalla, su boton de navegacion y sus estilos.

   Los datos se guardan SOLO en localStorage de este navegador. No se sincronizan
   con Supabase. Usa el boton de exportar como copia de seguridad.
   ========================================================================= */

(function () {
  'use strict';

  if (window.__identidadCargado) return;
  window.__identidadCargado = true;

  var KEY = 'tlp_identidad_v1';

  /* ── Modelo de datos ───────────────────────────────────────────────── */

  function plantilla() {
    return {
      ideal:  { calmado: '', racional: '', armonico: '', vida: '', relaciones: '' },
      real:   { comoSoy: '', virtudes: '', defectos: '', impulsividad: '',
                valores: '', detonantes: '', disparadores: '' },
      criticos: [],      // { id, nombre, relacion, comoMeVe, virtudes, defectos, fecha }
      comparativa: [],   // { id, rasgo, real, ideal, segunYo, segunDemas }
      episodios: [],     // { id, fecha, situacion, sensaciones, pensamientos, reaccion, consecuencia, intensidad }
      valores: [],       // { id, fecha, ensenanza, origen, veredicto, porque }
      ancla:  { persona: '', porque: '', admiro: '', frase: '' },
      diario: []         // { id, fecha, hora, emocion, texto }
    };
  }

  var RASGOS_SEMILLA = [
    'Calma / regulacion emocional',
    'Tolerancia a la frustracion',
    'Estabilidad en mis relaciones',
    'Control de la impulsividad',
    'Autoimagen estable',
    'Comunicacion asertiva',
    'Autocuidado'
  ];

  var DB = {
    load: function () {
      var base = plantilla();
      try {
        var guardado = JSON.parse(localStorage.getItem(KEY) || '{}');
        Object.keys(base).forEach(function (k) {
          if (guardado[k] === undefined || guardado[k] === null) return;
          if (Array.isArray(base[k])) {
            if (Array.isArray(guardado[k])) base[k] = guardado[k];
          } else if (typeof base[k] === 'object') {
            Object.keys(base[k]).forEach(function (sub) {
              if (typeof guardado[k][sub] === 'string') base[k][sub] = guardado[k][sub];
            });
          }
        });
      } catch (e) { /* datos corruptos: devolvemos la plantilla limpia */ }
      return base;
    },
    save: function (datos) {
      try {
        localStorage.setItem(KEY, JSON.stringify(datos));
        return true;
      } catch (e) {
        avisar('No se pudo guardar: almacenamiento lleno');
        return false;
      }
    }
  };

  var D = DB.load();

  /* ── Utilidades ────────────────────────────────────────────────────── */

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function hoy() { return new Date().toISOString().slice(0, 10); }

  function ahora() {
    var d = new Date();
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  }

  function fechaBonita(iso) {
    try {
      return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES',
        { weekday: 'short', day: 'numeric', month: 'short' });
    } catch (e) { return iso; }
  }

  function nuevoId() { return Date.now() + '-' + Math.random().toString(36).slice(2, 7); }

  function avisar(msg) {
    if (typeof window.showToast === 'function') { window.showToast(msg); return; }
    console.log('[identidad] ' + msg);
  }

  function $(id) { return document.getElementById(id); }

  var marcaTimer = null;
  function marcarGuardado() {
    var el = $('idSaveMark');
    if (!el) return;
    el.textContent = 'Guardado ' + ahora();
    el.classList.add('on');
    clearTimeout(marcaTimer);
    marcaTimer = setTimeout(function () { el.classList.remove('on'); }, 2000);
  }

  function persistir() { DB.save(D); marcarGuardado(); }

  var guardadoTimer = null;
  function persistirDiferido() {
    clearTimeout(guardadoTimer);
    guardadoTimer = setTimeout(persistir, 700);
  }

  /* ── Estilos ───────────────────────────────────────────────────────── */

  var CSS = '' +
    '#screen-yo .id-intro{background:var(--surface);border:1px solid var(--border);' +
      'border-radius:var(--r);padding:16px 18px;margin-bottom:14px;font-size:13px;' +
      'line-height:1.55;color:var(--muted);}' +
    '#screen-yo .id-bar{display:flex;align-items:center;justify-content:space-between;' +
      'gap:10px;margin-bottom:12px;}' +
    '#screen-yo .id-mark{font-size:12px;color:var(--calm);opacity:0;transition:opacity .25s;}' +
    '#screen-yo .id-mark.on{opacity:1;}' +
    '#screen-yo details.id-sec{background:var(--surface);border:1px solid var(--border);' +
      'border-radius:var(--r);margin-bottom:12px;overflow:hidden;}' +
    '#screen-yo details.id-sec>summary{list-style:none;cursor:pointer;padding:16px 18px;' +
      'font-weight:700;font-size:15px;color:var(--text);display:flex;align-items:center;' +
      'justify-content:space-between;gap:10px;}' +
    '#screen-yo details.id-sec>summary::-webkit-details-marker{display:none;}' +
    '#screen-yo details.id-sec>summary::after{content:"\\25BC";font-size:10px;color:var(--accent);' +
      'transition:transform .2s;}' +
    '#screen-yo details.id-sec[open]>summary::after{transform:rotate(180deg);}' +
    '#screen-yo details.id-sec>summary small{display:block;font-weight:400;font-size:12px;' +
      'color:var(--muted);margin-top:3px;}' +
    '#screen-yo .id-body{padding:0 18px 18px;}' +
    '#screen-yo .id-q{font-size:14px;font-weight:600;margin:14px 0 4px;color:var(--text);}' +
    '#screen-yo .id-hint{font-size:12px;color:var(--muted);margin-bottom:8px;line-height:1.5;}' +
    '#screen-yo textarea.id-in,#screen-yo input.id-in{width:100%;background:var(--surface2);' +
      'border:1px solid var(--border);border-radius:var(--rs);padding:12px 14px;font-size:14px;' +
      'color:var(--text);font-family:inherit;resize:vertical;}' +
    '#screen-yo textarea.id-in{min-height:80px;}' +
    '#screen-yo textarea.id-in:focus,#screen-yo input.id-in:focus{outline:none;' +
      'border-color:var(--accent);}' +
    '#screen-yo select.id-in{width:100%;background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:var(--rs);padding:12px 14px;font-size:14px;color:var(--text);' +
      'font-family:inherit;}' +
    '#screen-yo .id-btn{background:var(--accent);color:#fff;border:none;border-radius:var(--rs);' +
      'padding:12px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit;}' +
    '#screen-yo .id-btn.ghost{background:transparent;color:var(--accent);' +
      'border:1px solid var(--border);}' +
    '#screen-yo .id-btn.wide{width:100%;margin-top:12px;}' +
    '#screen-yo .id-card{background:var(--surface2);border:1px solid var(--border);' +
      'border-radius:var(--rs);padding:14px;margin-top:10px;}' +
    '#screen-yo .id-card h4{font-size:14px;margin-bottom:2px;}' +
    '#screen-yo .id-card .meta{font-size:11px;color:var(--muted);margin-bottom:8px;}' +
    '#screen-yo .id-card p{font-size:13px;line-height:1.55;margin-bottom:6px;}' +
    '#screen-yo .id-card p b{color:var(--muted);font-weight:600;}' +
    '#screen-yo .id-del{background:none;border:none;color:var(--danger);font-size:12px;' +
      'cursor:pointer;padding:4px 0;font-family:inherit;}' +
    '#screen-yo .id-empty{font-size:13px;color:var(--muted);text-align:center;padding:18px 8px;}' +
    '#screen-yo .id-scroll{overflow-x:auto;-webkit-overflow-scrolling:touch;margin-top:10px;}' +
    '#screen-yo table.id-tab{border-collapse:collapse;width:100%;min-width:430px;font-size:12px;}' +
    '#screen-yo table.id-tab th,#screen-yo table.id-tab td{border:1px solid var(--border);' +
      'padding:6px;text-align:center;}' +
    '#screen-yo table.id-tab th{background:var(--surface2);font-size:11px;color:var(--muted);' +
      'font-weight:600;}' +
    '#screen-yo table.id-tab td.rasgo{text-align:left;min-width:130px;font-size:12px;}' +
    '#screen-yo table.id-tab input{width:46px;background:var(--surface);border:1px solid var(--border);' +
      'border-radius:8px;padding:6px 2px;text-align:center;font-size:13px;color:var(--text);' +
      'font-family:inherit;}' +
    '#screen-yo .dist{font-weight:700;border-radius:8px;padding:4px 6px;display:inline-block;' +
      'min-width:28px;}' +
    '#screen-yo .dist.v{background:rgba(5,150,105,.14);color:var(--calm);}' +
    '#screen-yo .dist.a{background:var(--crisis-dim);color:var(--crisis);}' +
    '#screen-yo .dist.r{background:var(--danger-dim);color:var(--danger);}' +
    '#screen-yo .id-resumen{background:var(--accent-dim);border-radius:var(--rs);padding:14px;' +
      'margin-top:12px;font-size:13px;line-height:1.6;}' +
    '#screen-yo .id-row2{display:flex;gap:8px;}' +
    '#screen-yo .id-row2>*{flex:1;}' +
    '#screen-yo .id-nota{font-size:11px;color:var(--muted);line-height:1.5;margin-top:10px;}';

  function inyectarCSS() {
    var s = document.createElement('style');
    s.id = 'identidad-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ── Esqueleto de la pantalla ──────────────────────────────────────── */

  function campoTexto(ruta, etiqueta, pista, placeholder) {
    var partes = ruta.split('.');
    var valor = D[partes[0]][partes[1]] || '';
    return '<div class="id-q">' + etiqueta + '</div>' +
           '<div class="id-hint">' + pista + '</div>' +
           '<textarea class="id-in" data-ruta="' + ruta + '" placeholder="' + esc(placeholder) + '">' +
           esc(valor) + '</textarea>';
  }

  function construirPantalla() {
    var main = document.querySelector('main') || document.body;
    var sec = document.createElement('section');
    sec.className = 'screen';
    sec.id = 'screen-yo';
    sec.innerHTML =
      '<div class="id-intro">Este espacio es para mirarte con honestidad, no para juzgarte. ' +
      'Puedes dejar cosas a medias y volver. Todo se guarda solo en este dispositivo.</div>' +

      '<div class="id-bar"><span class="id-mark" id="idSaveMark"></span>' +
      '<button class="id-btn ghost" id="idExport">Exportar todo</button></div>' +

      /* ── 1.1 Yo ideal ── */
      '<details class="id-sec" open><summary><span>1.1 · Tu yo ideal' +
      '<small>Como serias sin el TLP</small></span></summary><div class="id-body">' +
      campoTexto('ideal.calmado', 'Tu yo calmado',
        'Cuando estas en calma, de verdad en calma: como respiras, como hablas, que haces con el tiempo.',
        'Cuando estoy en calma soy...') +
      campoTexto('ideal.racional', 'Tu yo racional',
        'Como piensas cuando la emocion no decide por ti. Como tomas decisiones.',
        'Cuando pienso con claridad...') +
      campoTexto('ideal.armonico', 'Tu yo armonico',
        'Esa version tuya en la que todo encaja: cuerpo, emocion y accion van en la misma direccion.',
        'Mi version armonica seria...') +
      campoTexto('ideal.vida', 'Como seria tu vida',
        'Tu dia, tu trabajo, tu casa, tus rutinas si el TLP no estuviera en medio.',
        'Mi vida seria...') +
      campoTexto('ideal.relaciones', 'Como serian tus relaciones',
        'Con tu pareja, tu familia, tus amistades, tus companeros. Que cambiaria.',
        'Mis relaciones serian...') +
      '</div></details>' +

      /* ── 1.2 Yo real ── */
      '<details class="id-sec"><summary><span>1.2 · Tu yo real' +
      '<small>Como eres, o como crees que eres</small></span></summary><div class="id-body">' +
      campoTexto('real.comoSoy', 'Como eres',
        'Sin maquillarlo y sin castigarte. Como te describirias a ti misma hoy.',
        'Soy una persona que...') +
      campoTexto('real.virtudes', 'Tus virtudes',
        'Lo bueno que tienes y que sabes que tienes. Cuesta escribirlo: hazlo igual.',
        'Lo bueno que tengo es...') +
      campoTexto('real.defectos', 'Tus defectos',
        'Lo que te cuesta, lo que repites, lo que sabes que haces dano.',
        'Me cuesta...') +
      campoTexto('real.impulsividad', 'Tu impulsividad',
        'Como se manifiesta: gastar, decir, irte, cortar, escribir de madrugada, lo que sea.',
        'Mi impulsividad aparece como...') +
      campoTexto('real.valores', 'Tus valores',
        'Lo que de verdad te importa, aunque no siempre lo cumplas.',
        'Lo que mas me importa es...') +
      campoTexto('real.detonantes', 'Que hace que detones en crisis',
        'El tipo de situacion, no el detalle concreto: abandono, humillacion, injusticia, descontrol.',
        'Detono cuando...') +
      campoTexto('real.disparadores', 'Tus disparadores concretos',
        'Las senales pequenas y especificas: un tono de voz, un mensaje sin responder, un plan que cambia.',
        'Mis disparadores son...') +
      '</div></details>' +

      /* ── 1.3 Criticos ── */
      '<details class="id-sec"><summary><span>1.3 · Tu yo ante los demas' +
      '<small>Pregunta a 3 personas que te quieren</small></span></summary><div class="id-body">' +
      '<div class="id-hint">Elige tres personas de confianza. Preguntales cuatro cosas: como te ven, ' +
      'como te describirian, que creen que son tus virtudes y que creen que son tus defectos. ' +
      'Copia aqui lo que te digan, lo mas literal que puedas. Resiste la tentacion de corregirlo.</div>' +
      '<div class="id-row2">' +
      '<input class="id-in" id="cNombre" placeholder="Nombre">' +
      '<input class="id-in" id="cRelacion" placeholder="Quien es (madre, pareja...)">' +
      '</div>' +
      '<div class="id-q">Como te ve / como te describe</div>' +
      '<textarea class="id-in" id="cComoMeVe" placeholder="Me dijo que..."></textarea>' +
      '<div class="id-q">Que virtudes ve en ti</div>' +
      '<textarea class="id-in" id="cVirtudes" placeholder="Lo bueno que ve en mi..."></textarea>' +
      '<div class="id-q">Que defectos ve en ti</div>' +
      '<textarea class="id-in" id="cDefectos" placeholder="Lo que cree que me cuesta..."></textarea>' +
      '<button class="id-btn wide" id="cAdd">Guardar testimonio</button>' +
      '<div id="cLista"></div>' +
      '</div></details>' +

      /* ── 1.4 Comparativa ── */
      '<details class="id-sec"><summary><span>1.4 · Tabla comparativa' +
      '<small>Que te separa de tu yo ideal</small></span></summary><div class="id-body">' +
      '<div class="id-hint">Puntua cada rasgo del 1 al 10 en las cuatro columnas. ' +
      '<b>Distancia</b> es cuanto te separa de tu yo ideal: cuanto mas alta, mas trabajo pide. ' +
      '<b>Brecha</b> es la diferencia entre como te ves tu y como te ven los demas: una brecha ' +
      'grande no significa que ellos tengan razon, significa que ahi hay algo que mirar.</div>' +
      '<div class="id-scroll"><table class="id-tab"><thead><tr>' +
      '<th class="rasgo">Rasgo</th><th>Yo<br>real</th><th>Yo<br>ideal</th>' +
      '<th>Segun<br>yo</th><th>Segun<br>los demas</th><th>Dist.</th><th>Brecha</th><th></th>' +
      '</tr></thead><tbody id="tabBody"></tbody></table></div>' +
      '<div class="id-row2" style="margin-top:12px;">' +
      '<input class="id-in" id="rasgoNuevo" placeholder="Anadir otro rasgo">' +
      '<button class="id-btn" id="rasgoAdd">Anadir</button></div>' +
      '<div id="tabResumen"></div>' +
      '</div></details>' +

      /* ── 2. Episodios ── */
      '<details class="id-sec"><summary><span>2 · Episodios impulsivos' +
      '<small>Que sentiste, que pensaste, que hiciste</small></span></summary><div class="id-body">' +
      '<div class="id-hint">Registra situaciones del pasado (o de hoy) que dispararon una reaccion ' +
      'impulsiva. El objetivo no es juzgar la reaccion: es que empieces a ver el patron entre lo que ' +
      'sientes en el cuerpo, lo que te dices y lo que acabas haciendo.</div>' +
      '<div class="id-q">Fecha del episodio</div>' +
      '<input class="id-in" type="date" id="epFecha">' +
      '<div class="id-q">La situacion</div>' +
      '<textarea class="id-in" id="epSituacion" placeholder="Que paso, donde, con quien..."></textarea>' +
      '<div class="id-q">Sensaciones en el cuerpo</div>' +
      '<div class="id-hint">Calor, presion en el pecho, nudo, temblor, vacio, taquicardia.</div>' +
      '<textarea class="id-in" id="epSensaciones" placeholder="Senti..."></textarea>' +
      '<div class="id-q">Pensamientos</div>' +
      '<div class="id-hint">La frase exacta que te pasó por la cabeza, aunque suene dura.</div>' +
      '<textarea class="id-in" id="epPensamientos" placeholder="Pense que..."></textarea>' +
      '<div class="id-q">Que hiciste</div>' +
      '<textarea class="id-in" id="epReaccion" placeholder="Reaccione..."></textarea>' +
      '<div class="id-q">Consecuencia</div>' +
      '<textarea class="id-in" id="epConsecuencia" placeholder="Despues paso que..."></textarea>' +
      '<div class="id-q">Intensidad del impulso (1-10)</div>' +
      '<input class="id-in" type="number" min="1" max="10" id="epIntensidad" placeholder="1-10">' +
      '<button class="id-btn wide" id="epAdd">Guardar episodio</button>' +
      '<div id="epLista"></div>' +
      '</div></details>' +

      /* ── 3. Valores + ancla ── */
      '<details class="id-sec"><summary><span>3 · Valores y personaje ancla' +
      '<small>Que te enseñaron y con que te quedas</small></span></summary><div class="id-body">' +
      '<div class="id-hint">Dia a dia, anota una ensenanza que recibiste de tus padres o tutores y ' +
      'decide que haces con ella: te la quedas, la revisas o la jubilas. No hace falta que sea ' +
      'profunda; las frases pequenas son las que mas pesan.</div>' +
      '<div class="id-q">La ensenanza</div>' +
      '<textarea class="id-in" id="vEnsenanza" placeholder="Me ensenaron que..."></textarea>' +
      '<div class="id-q">De quien viene</div>' +
      '<input class="id-in" id="vOrigen" placeholder="Madre, padre, abuela, colegio...">' +
      '<div class="id-q">Que haces con ella</div>' +
      '<select class="id-in" id="vVeredicto">' +
      '<option value="conservo">Me la quedo: me sirve</option>' +
      '<option value="revisar">La reviso: a medias</option>' +
      '<option value="obsoleta">La jubilo: no me ayuda</option>' +
      '</select>' +
      '<div class="id-q">Por que</div>' +
      '<textarea class="id-in" id="vPorque" placeholder="Porque..."></textarea>' +
      '<button class="id-btn wide" id="vAdd">Guardar en la tabla</button>' +
      '<div class="id-scroll"><table class="id-tab" style="min-width:380px;"><thead><tr>' +
      '<th>Fecha</th><th class="rasgo">Ensenanza</th><th>Origen</th><th>Veredicto</th><th></th>' +
      '</tr></thead><tbody id="vBody"></tbody></table></div>' +

      '<div class="id-q" style="margin-top:22px;">Tu personaje ancla</div>' +
      '<div class="id-hint">Alguien que te haya impactado de verdad. Da igual quien sea: una cantante, ' +
      'un cientifico, tu abuela. Lo que importa es que escribas por que te inspira, porque eso que ' +
      'admiras en esa persona ya esta en ti en alguna medida.</div>' +
      '<input class="id-in" data-ruta="ancla.persona" placeholder="Quien es" value="' + esc(D.ancla.persona) + '">' +
      '<div class="id-q">Por que te inspira</div>' +
      '<textarea class="id-in" data-ruta="ancla.porque" placeholder="Me inspira porque...">' + esc(D.ancla.porque) + '</textarea>' +
      '<div class="id-q">Que admiras de esa persona</div>' +
      '<textarea class="id-in" data-ruta="ancla.admiro" placeholder="Admiro que...">' + esc(D.ancla.admiro) + '</textarea>' +
      '<div class="id-q">Tu frase ancla</div>' +
      '<div class="id-hint">Una sola frase, corta, que puedas recordar en mitad de una crisis.</div>' +
      '<input class="id-in" data-ruta="ancla.frase" placeholder="Mi frase es..." value="' + esc(D.ancla.frase) + '">' +
      '</div></details>' +

      /* ── 4. Diario ── */
      '<details class="id-sec"><summary><span>4 · Diario personal TLP' +
      '<small>Escritura libre, sin formato</small></span></summary><div class="id-body">' +
      '<div class="id-hint">Aqui no hay preguntas. Escribe lo que necesites, cuando lo necesites.</div>' +
      '<input class="id-in" id="dEmocion" placeholder="Como te sientes ahora (una palabra)">' +
      '<textarea class="id-in" id="dTexto" style="min-height:150px;margin-top:10px;" ' +
      'placeholder="Hoy..."></textarea>' +
      '<button class="id-btn wide" id="dAdd">Guardar entrada</button>' +
      '<div id="dLista"></div>' +
      '</div></details>' +

      '<div class="id-nota">Estos apartados se guardan solo en este navegador y no se sincronizan ' +
      'con la nube. Si borras los datos del navegador, se pierden. Exporta de vez en cuando.</div>';

    main.appendChild(sec);
  }

  function construirNav() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav) return;
    var btn = document.createElement('button');
    btn.className = 'nav-btn';
    btn.id = 'nav-yo';
    btn.setAttribute('data-screen', 'yo');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>' +
      '<circle cx="12" cy="7" r="4"/></svg>Yo';
    btn.addEventListener('click', function () {
      if (typeof window.navigate === 'function') {
        window.navigate('yo');
      } else {
        document.querySelectorAll('.screen').forEach(function (s) { s.classList.remove('active'); });
        document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
        $('screen-yo').classList.add('active');
        btn.classList.add('active');
      }
      pintarTodo();
    });
    nav.appendChild(btn);
  }

  /* ── 1.1 / 1.2 / 3-ancla: autoguardado de campos con data-ruta ─────── */

  function engancharCamposDirectos() {
    document.querySelectorAll('#screen-yo [data-ruta]').forEach(function (el) {
      el.addEventListener('input', function () {
        var p = el.getAttribute('data-ruta').split('.');
        D[p[0]][p[1]] = el.value;
        persistirDiferido();
      });
    });
  }

  /* ── 1.3 Criticos ──────────────────────────────────────────────────── */

  function pintarCriticos() {
    var cont = $('cLista');
    if (!cont) return;
    if (!D.criticos.length) {
      cont.innerHTML = '<div class="id-empty">Todavia no has recogido ningun testimonio.</div>';
      return;
    }
    cont.innerHTML = D.criticos.map(function (c) {
      return '<div class="id-card">' +
        '<h4>' + esc(c.nombre || 'Sin nombre') + '</h4>' +
        '<div class="meta">' + esc(c.relacion || '') + ' · ' + fechaBonita(c.fecha) + '</div>' +
        (c.comoMeVe  ? '<p><b>Como me ve:</b> ' + esc(c.comoMeVe) + '</p>' : '') +
        (c.virtudes  ? '<p><b>Virtudes:</b> ' + esc(c.virtudes) + '</p>' : '') +
        (c.defectos  ? '<p><b>Defectos:</b> ' + esc(c.defectos) + '</p>' : '') +
        '<button class="id-del" data-del-critico="' + esc(c.id) + '">Eliminar</button>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('[data-del-critico]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-critico');
        D.criticos = D.criticos.filter(function (x) { return String(x.id) !== id; });
        persistir(); pintarCriticos();
      });
    });
  }

  function engancharCriticos() {
    var b = $('cAdd');
    if (!b) return;
    b.addEventListener('click', function () {
      var nombre = $('cNombre').value.trim();
      if (!nombre) { avisar('Pon al menos el nombre'); return; }
      D.criticos.unshift({
        id: nuevoId(), fecha: hoy(), nombre: nombre,
        relacion:  $('cRelacion').value.trim(),
        comoMeVe:  $('cComoMeVe').value.trim(),
        virtudes:  $('cVirtudes').value.trim(),
        defectos:  $('cDefectos').value.trim()
      });
      persistir();
      ['cNombre', 'cRelacion', 'cComoMeVe', 'cVirtudes', 'cDefectos'].forEach(function (id) {
        $(id).value = '';
      });
      pintarCriticos();
      avisar('Testimonio guardado');
    });
  }

  /* ── 1.4 Tabla comparativa ─────────────────────────────────────────── */

  function sembrarRasgos() {
    if (D.comparativa.length) return;
    D.comparativa = RASGOS_SEMILLA.map(function (r) {
      return { id: nuevoId(), rasgo: r, real: '', ideal: '', segunYo: '', segunDemas: '' };
    });
    DB.save(D);
  }

  function num(v) {
    var n = parseInt(v, 10);
    if (isNaN(n)) return null;
    return Math.min(10, Math.max(1, n));
  }

  function claseDist(d) { return d >= 5 ? 'r' : (d >= 3 ? 'a' : 'v'); }

  function pintarTabla() {
    var body = $('tabBody');
    if (!body) return;

    body.innerHTML = D.comparativa.map(function (f) {
      var r = num(f.real), i = num(f.ideal), sy = num(f.segunYo), sd = num(f.segunDemas);
      var dist   = (r !== null && i !== null)  ? Math.abs(i - r)   : null;
      var brecha = (sy !== null && sd !== null) ? Math.abs(sy - sd) : null;

      function celda(campo, val) {
        return '<td><input type="number" min="1" max="10" data-fila="' + esc(f.id) +
               '" data-campo="' + campo + '" value="' + esc(val === null ? '' : val) + '"></td>';
      }

      return '<tr>' +
        '<td class="rasgo">' + esc(f.rasgo) + '</td>' +
        celda('real', f.real) + celda('ideal', f.ideal) +
        celda('segunYo', f.segunYo) + celda('segunDemas', f.segunDemas) +
        '<td>' + (dist === null ? '—' :
          '<span class="dist ' + claseDist(dist) + '">' + dist + '</span>') + '</td>' +
        '<td>' + (brecha === null ? '—' :
          '<span class="dist ' + claseDist(brecha) + '">' + brecha + '</span>') + '</td>' +
        '<td><button class="id-del" data-del-fila="' + esc(f.id) + '">✕</button></td>' +
        '</tr>';
    }).join('');

    body.querySelectorAll('input[data-fila]').forEach(function (inp) {
      inp.addEventListener('input', function () {
        var fila = D.comparativa.find(function (x) {
          return String(x.id) === inp.getAttribute('data-fila');
        });
        if (!fila) return;
        fila[inp.getAttribute('data-campo')] = inp.value;
        persistirDiferido();
        pintarResumen();
      });
      inp.addEventListener('blur', pintarTabla);
    });

    body.querySelectorAll('[data-del-fila]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-fila');
        D.comparativa = D.comparativa.filter(function (x) { return String(x.id) !== id; });
        persistir(); pintarTabla(); pintarResumen();
      });
    });

    pintarResumen();
  }

  function pintarResumen() {
    var cont = $('tabResumen');
    if (!cont) return;

    var conDist = D.comparativa.map(function (f) {
      var r = num(f.real), i = num(f.ideal);
      return (r !== null && i !== null) ? { rasgo: f.rasgo, d: Math.abs(i - r) } : null;
    }).filter(Boolean);

    if (!conDist.length) {
      cont.innerHTML = '<div class="id-empty">Rellena al menos un rasgo con "yo real" y ' +
                       '"yo ideal" para ver el resumen.</div>';
      return;
    }

    var suma = conDist.reduce(function (a, b) { return a + b.d; }, 0);
    var media = (suma / conDist.length).toFixed(1);
    var orden = conDist.slice().sort(function (a, b) { return b.d - a.d; }).slice(0, 3);

    cont.innerHTML = '<div class="id-resumen">' +
      '<b>Distancia media a tu yo ideal: ' + media + ' / 9</b><br>' +
      'Rasgos con mas distancia ahora mismo:<br>' +
      orden.map(function (o, n) {
        return (n + 1) + '. ' + esc(o.rasgo) + ' <span class="dist ' + claseDist(o.d) + '">' +
               o.d + '</span>';
      }).join('<br>') +
      '<br><br>Trabaja sobre el primero. Uno cada vez.</div>';
  }

  function engancharTabla() {
    var b = $('rasgoAdd');
    if (!b) return;
    b.addEventListener('click', function () {
      var txt = $('rasgoNuevo').value.trim();
      if (!txt) return;
      D.comparativa.push({ id: nuevoId(), rasgo: txt, real: '', ideal: '', segunYo: '', segunDemas: '' });
      $('rasgoNuevo').value = '';
      persistir(); pintarTabla();
    });
  }

  /* ── 2. Episodios ──────────────────────────────────────────────────── */

  function pintarEpisodios() {
    var cont = $('epLista');
    if (!cont) return;
    if (!D.episodios.length) {
      cont.innerHTML = '<div class="id-empty">Sin episodios registrados.</div>';
      return;
    }
    cont.innerHTML = D.episodios.map(function (e) {
      return '<div class="id-card">' +
        '<h4>' + fechaBonita(e.fecha) +
        (e.intensidad ? ' · intensidad ' + esc(e.intensidad) + '/10' : '') + '</h4>' +
        '<div class="meta"></div>' +
        (e.situacion    ? '<p><b>Situacion:</b> ' + esc(e.situacion) + '</p>' : '') +
        (e.sensaciones  ? '<p><b>Cuerpo:</b> ' + esc(e.sensaciones) + '</p>' : '') +
        (e.pensamientos ? '<p><b>Pensamiento:</b> ' + esc(e.pensamientos) + '</p>' : '') +
        (e.reaccion     ? '<p><b>Hice:</b> ' + esc(e.reaccion) + '</p>' : '') +
        (e.consecuencia ? '<p><b>Despues:</b> ' + esc(e.consecuencia) + '</p>' : '') +
        '<button class="id-del" data-del-ep="' + esc(e.id) + '">Eliminar</button>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('[data-del-ep]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-ep');
        D.episodios = D.episodios.filter(function (x) { return String(x.id) !== id; });
        persistir(); pintarEpisodios();
      });
    });
  }

  function engancharEpisodios() {
    var b = $('epAdd');
    if (!b) return;
    if ($('epFecha')) $('epFecha').value = hoy();
    b.addEventListener('click', function () {
      var situacion = $('epSituacion').value.trim();
      if (!situacion) { avisar('Describe al menos la situacion'); return; }
      D.episodios.unshift({
        id: nuevoId(),
        fecha:        $('epFecha').value || hoy(),
        situacion:    situacion,
        sensaciones:  $('epSensaciones').value.trim(),
        pensamientos: $('epPensamientos').value.trim(),
        reaccion:     $('epReaccion').value.trim(),
        consecuencia: $('epConsecuencia').value.trim(),
        intensidad:   num($('epIntensidad').value) || ''
      });
      persistir();
      ['epSituacion', 'epSensaciones', 'epPensamientos', 'epReaccion',
       'epConsecuencia', 'epIntensidad'].forEach(function (id) { $(id).value = ''; });
      $('epFecha').value = hoy();
      pintarEpisodios();
      avisar('Episodio registrado');
    });
  }

  /* ── 3. Valores ────────────────────────────────────────────────────── */

  var ETIQUETA_VEREDICTO = {
    conservo: 'Me la quedo',
    revisar:  'La reviso',
    obsoleta: 'La jubilo'
  };

  function pintarValores() {
    var body = $('vBody');
    if (!body) return;
    if (!D.valores.length) {
      body.innerHTML = '<tr><td colspan="5" class="id-empty">Tabla vacia.</td></tr>';
      return;
    }
    body.innerHTML = D.valores.map(function (v) {
      return '<tr>' +
        '<td>' + esc(v.fecha) + '</td>' +
        '<td class="rasgo">' + esc(v.ensenanza) +
          (v.porque ? '<br><span style="color:var(--muted);">' + esc(v.porque) + '</span>' : '') +
        '</td>' +
        '<td>' + esc(v.origen || '—') + '</td>' +
        '<td>' + esc(ETIQUETA_VEREDICTO[v.veredicto] || v.veredicto) + '</td>' +
        '<td><button class="id-del" data-del-val="' + esc(v.id) + '">✕</button></td>' +
        '</tr>';
    }).join('');
    body.querySelectorAll('[data-del-val]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-val');
        D.valores = D.valores.filter(function (x) { return String(x.id) !== id; });
        persistir(); pintarValores();
      });
    });
  }

  function engancharValores() {
    var b = $('vAdd');
    if (!b) return;
    b.addEventListener('click', function () {
      var ensenanza = $('vEnsenanza').value.trim();
      if (!ensenanza) { avisar('Escribe la ensenanza'); return; }
      D.valores.unshift({
        id: nuevoId(), fecha: hoy(), ensenanza: ensenanza,
        origen:    $('vOrigen').value.trim(),
        veredicto: $('vVeredicto').value,
        porque:    $('vPorque').value.trim()
      });
      persistir();
      ['vEnsenanza', 'vOrigen', 'vPorque'].forEach(function (id) { $(id).value = ''; });
      pintarValores();
      avisar('Anotado');
    });
  }

  /* ── 4. Diario ─────────────────────────────────────────────────────── */

  function pintarDiario() {
    var cont = $('dLista');
    if (!cont) return;
    if (!D.diario.length) {
      cont.innerHTML = '<div class="id-empty">El diario esta vacio.</div>';
      return;
    }
    cont.innerHTML = D.diario.map(function (e) {
      return '<div class="id-card">' +
        '<h4>' + fechaBonita(e.fecha) + ' · ' + esc(e.hora) + '</h4>' +
        (e.emocion ? '<div class="meta">' + esc(e.emocion) + '</div>' : '<div class="meta"></div>') +
        '<p style="white-space:pre-wrap;">' + esc(e.texto) + '</p>' +
        '<button class="id-del" data-del-d="' + esc(e.id) + '">Eliminar</button>' +
        '</div>';
    }).join('');
    cont.querySelectorAll('[data-del-d]').forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-del-d');
        D.diario = D.diario.filter(function (x) { return String(x.id) !== id; });
        persistir(); pintarDiario();
      });
    });
  }

  function engancharDiario() {
    var b = $('dAdd');
    if (!b) return;
    b.addEventListener('click', function () {
      var texto = $('dTexto').value.trim();
      if (!texto) return;
      D.diario.unshift({
        id: nuevoId(), fecha: hoy(), hora: ahora(),
        emocion: $('dEmocion').value.trim(), texto: texto
      });
      persistir();
      $('dTexto').value = ''; $('dEmocion').value = '';
      pintarDiario();
      avisar('Entrada guardada');
    });
  }

  /* ── Exportacion ───────────────────────────────────────────────────── */

  function exportar() {
    var L = [];
    L.push('# Mi trabajo de identidad — TLP Diario Pro');
    L.push('Exportado el ' + new Date().toLocaleString('es-ES'));
    L.push('');

    L.push('## 1.1 Yo ideal');
    L.push('**Yo calmado:** ' + (D.ideal.calmado || '—'));
    L.push('**Yo racional:** ' + (D.ideal.racional || '—'));
    L.push('**Yo armonico:** ' + (D.ideal.armonico || '—'));
    L.push('**Mi vida:** ' + (D.ideal.vida || '—'));
    L.push('**Mis relaciones:** ' + (D.ideal.relaciones || '—'));
    L.push('');

    L.push('## 1.2 Yo real');
    L.push('**Como soy:** ' + (D.real.comoSoy || '—'));
    L.push('**Virtudes:** ' + (D.real.virtudes || '—'));
    L.push('**Defectos:** ' + (D.real.defectos || '—'));
    L.push('**Impulsividad:** ' + (D.real.impulsividad || '—'));
    L.push('**Valores:** ' + (D.real.valores || '—'));
    L.push('**Detonantes:** ' + (D.real.detonantes || '—'));
    L.push('**Disparadores:** ' + (D.real.disparadores || '—'));
    L.push('');

    L.push('## 1.3 Yo segun los demas');
    if (!D.criticos.length) L.push('_Sin testimonios._');
    D.criticos.forEach(function (c) {
      L.push('### ' + c.nombre + ' (' + (c.relacion || '—') + ') · ' + c.fecha);
      L.push('- Como me ve: ' + (c.comoMeVe || '—'));
      L.push('- Virtudes: ' + (c.virtudes || '—'));
      L.push('- Defectos: ' + (c.defectos || '—'));
    });
    L.push('');

    L.push('## 1.4 Tabla comparativa');
    L.push('| Rasgo | Yo real | Yo ideal | Segun yo | Segun los demas | Distancia | Brecha |');
    L.push('|---|---|---|---|---|---|---|');
    D.comparativa.forEach(function (f) {
      var r = num(f.real), i = num(f.ideal), sy = num(f.segunYo), sd = num(f.segunDemas);
      var dist   = (r !== null && i !== null)  ? Math.abs(i - r)   : '';
      var brecha = (sy !== null && sd !== null) ? Math.abs(sy - sd) : '';
      L.push('| ' + f.rasgo + ' | ' + (r || '') + ' | ' + (i || '') + ' | ' +
             (sy || '') + ' | ' + (sd || '') + ' | ' + dist + ' | ' + brecha + ' |');
    });
    L.push('');

    L.push('## 2 Episodios impulsivos');
    if (!D.episodios.length) L.push('_Sin episodios._');
    D.episodios.forEach(function (e) {
      L.push('### ' + e.fecha + (e.intensidad ? ' · intensidad ' + e.intensidad + '/10' : ''));
      L.push('- Situacion: ' + (e.situacion || '—'));
      L.push('- Sensaciones: ' + (e.sensaciones || '—'));
      L.push('- Pensamientos: ' + (e.pensamientos || '—'));
      L.push('- Reaccion: ' + (e.reaccion || '—'));
      L.push('- Consecuencia: ' + (e.consecuencia || '—'));
    });
    L.push('');

    L.push('## 3 Valores');
    L.push('| Fecha | Ensenanza | Origen | Veredicto | Por que |');
    L.push('|---|---|---|---|---|');
    D.valores.forEach(function (v) {
      L.push('| ' + v.fecha + ' | ' + v.ensenanza + ' | ' + (v.origen || '') + ' | ' +
             (ETIQUETA_VEREDICTO[v.veredicto] || v.veredicto) + ' | ' + (v.porque || '') + ' |');
    });
    L.push('');
    L.push('### Personaje ancla');
    L.push('**Quien:** ' + (D.ancla.persona || '—'));
    L.push('**Por que inspira:** ' + (D.ancla.porque || '—'));
    L.push('**Que admiro:** ' + (D.ancla.admiro || '—'));
    L.push('**Frase ancla:** ' + (D.ancla.frase || '—'));
    L.push('');

    L.push('## 4 Diario');
    if (!D.diario.length) L.push('_Diario vacio._');
    D.diario.forEach(function (e) {
      L.push('### ' + e.fecha + ' ' + e.hora + (e.emocion ? ' · ' + e.emocion : ''));
      L.push(e.texto);
      L.push('');
    });

    var blob = new Blob([L.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'identidad-tlp-' + hoy() + '.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    avisar('Exportado');
  }

  /* ── Arranque ──────────────────────────────────────────────────────── */

  function pintarTodo() {
    pintarCriticos();
    pintarTabla();
    pintarEpisodios();
    pintarValores();
    pintarDiario();
  }

  function iniciar() {
    inyectarCSS();
    sembrarRasgos();
    construirPantalla();
    construirNav();
    engancharCamposDirectos();
    engancharCriticos();
    engancharTabla();
    engancharEpisodios();
    engancharValores();
    engancharDiario();
    var ex = $('idExport');
    if (ex) ex.addEventListener('click', exportar);
    pintarTodo();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', iniciar);
  } else {
    iniciar();
  }

  /* Expuesto para el modulo de pulso y para depuracion */
  window.IdentidadDB = {
    leer: function () { return D; },
    recargar: function () { D = DB.load(); pintarTodo(); }
  };

})();
