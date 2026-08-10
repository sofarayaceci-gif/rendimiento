/* ============================================================
   Rendimientos — Adelante Desarrollos
   Estudios de tiempos en obra.

   La idea de fondo: un estudio es una tira de tramos contiguos. El `hasta` de
   un tramo es el `desde` del siguiente, y marcar una lectura es partir el
   tiempo en ese punto. Guardarlo así —y no como una lista de horas sueltas—
   hace imposible el estado inconsistente de tener una hora sin saber a qué
   tramo pertenece, y deja que corregir una hora sea una sola operación.

   Se marca lo que EMPIEZA, no lo que terminó: en campo uno ve arrancar la
   tarea. Al exportar sale al revés, con la hora cerrando el tramo, que es como
   estaba el Excel original. Es la misma información vista desde el otro lado.
   ============================================================ */
'use strict';

/* ============================================================
   Constantes
   ============================================================ */

const TIPOS = ['Fijo', 'Variable', 'Externo', 'N/A'];

const AYUDA_TIPO = {
  'Fijo':     'No depende de cuánto se produzca: montaje, aplome, acomodo.',
  'Variable': 'Crece con la cantidad producida: colar, pegar, repellar.',
  'Externo':  'Interrupción ajena a la cuadrilla: falta material, lluvia.',
  'N/A':      'No entra en la composición del ciclo.'
};

const CLAVE_ESTUDIOS = 'rend.estudios.v1';
const CLAVE_AJUSTES  = 'rend.ajustes.v1';
const CLAVE_ACTIVO   = 'rend.activo.v1';
const CLAVE_VISTA    = 'rend.vista.v1';

/* Las cuadrillas de la hoja `Val` del Excel original. Son solo el arranque:
   desde Ajustes se agregan y se quitan, y esa lista viaja a los demás
   aparatos. */
const AJUSTES_INICIALES = {
  cuadrillas: ['Losa', 'Aceros', 'Formaleta', 'Techos', 'Hojalatería',
               'Repellos', 'Gypsum', 'Pintura', 'Enchapes', 'Fontanería', 'Eléctrico'],
  actividades: [],
  subactividades: [],
  unidades: ['m²', 'ml', 'm³', 'unidades', 'sacos', 'kg'],
  /* Elementos por cuadrilla: { 'Formaleta': ['Acomodo telescópica', …] } */
  elementos: {}
};

/* Cada cuánto se sincroniza sola mientras la pestaña está a la vista. */
const CADA = 20000;

/* ============================================================
   Utilidades
   ============================================================ */

const $  = (sel, raiz) => (raiz || document).querySelector(sel);
const $$ = (sel, raiz) => Array.from((raiz || document).querySelectorAll(sel));
const id = x => document.getElementById(x);

const escapar = s => String(s == null ? '' : s).replace(/[&<>"]/g,
  c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

/* Para buscar sin que estorben tildes ni mayúsculas. `NFD` separa la tilde de
   la letra y esto se lleva la tilde: así «Hojalatería» encuentra «hojalateria». */
const TILDES = /[̀-ͯ]/g;
const norm = s => String(s == null ? '' : s).trim().toLowerCase()
  .normalize('NFD').replace(TILDES, '');

const num = v => {
  if(v === null || v === undefined) return NaN;
  const s = String(v).trim().replace(/\s+/g, '').replace(',', '.');
  if(s === '') return NaN;
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
};

const fmt = (n, dec) => (Number.isFinite(n)
  ? n.toLocaleString('es-CR', { minimumFractionDigits:dec, maximumFractionDigits:dec })
  : '—');

const dosDig = x => String(x).padStart(2, '0');

function fechaHoy(){
  const d = new Date();
  return d.getFullYear() + '-' + dosDig(d.getMonth() + 1) + '-' + dosDig(d.getDate());
}

function fechaCorta(iso){
  if(!iso) return '';
  const [a, m, d] = iso.split('-');
  return d + '-' + m + '-' + a.slice(2);
}

/* La hora del día de un instante, en hora local: 13:05. */
function horaDe(iso){
  if(!iso) return '';
  const d = new Date(iso);
  return dosDig(d.getHours()) + ':' + dosDig(d.getMinutes());
}

/* El mismo día, pero a otra hora. Sirve para corregir una lectura sin tocar
   la fecha: el input de hora solo devuelve HH:MM. */
function conHora(iso, hhmm){
  const base = iso ? new Date(iso) : new Date();
  const [h, m] = String(hhmm).split(':').map(Number);
  if(!Number.isFinite(h) || !Number.isFinite(m)) return null;
  const d = new Date(base.getFullYear(), base.getMonth(), base.getDate(), h, m, 0, 0);
  return d.toISOString();
}

/* Un instante «ahora», sin milisegundos: en un estudio de tiempos no aportan
   nada y ensucian el JSON que viaja a la nube. */
function ahora(){
  const d = new Date();
  d.setMilliseconds(0);
  return d.toISOString();
}

const horasEntre = (a, b) => Math.max(0, (new Date(b) - new Date(a)) / 3600000);

/* Horas decimales a 3:05. Es el formato del Excel y el que la gente lee. */
function hm(horas){
  if(!Number.isFinite(horas)) return '—';
  const total = Math.round(horas * 60);
  return Math.floor(total / 60) + ':' + dosDig(total % 60);
}

/* Lo mismo pero con segundos, para el cronómetro que va corriendo. */
function hms(segundos){
  const s = Math.max(0, Math.round(segundos));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return (h ? h + ':' + dosDig(m) : String(m)) + ':' + dosDig(s % 60);
}

function nuevoId(){
  if(window.crypto && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'e' + Date.now() + '-' + Math.round(Math.random() * 1e9);
}

let toastTimer = null;
function toast(msg){
  const t = id('toast');
  t.textContent = msg;
  t.classList.add('ver');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('ver'), 2600);
}

/* Sube el campo a la vista cuando queda tapado por el teclado del celular.
   Solo sube: si el campo ya está arriba no se mueve, que bajar la pantalla
   cuando uno toca algo desorienta más de lo que ayuda. */
function subirALaVista(el){
  if(!el) return;
  const vp = window.visualViewport;
  const alto = vp ? vp.height : window.innerHeight;
  const caja = el.getBoundingClientRect();
  const objetivo = Math.round(alto * (CELULAR.matches ? 0.38 : 0.30));
  const delta = Math.round(caja.top - objetivo);
  if(delta > 12) window.scrollBy({ top:delta, behavior:'smooth' });
}

/* ============================================================
   Almacenamiento

   Todo vive en el navegador. Cada guardado se comprueba: si el navegador se
   niega (sin espacio, ventana de incógnito) sale un aviso rojo en la pantalla
   en vez de fallar en silencio y que alguien pierda una mañana de lecturas.
   ============================================================ */

let storageOk = true;

function leer(llave, porDefecto){
  try{
    const raw = localStorage.getItem(llave);
    return raw ? JSON.parse(raw) : porDefecto;
  }catch(e){
    storageOk = false;
    return porDefecto;
  }
}

function escribir(llave, valor){
  try{
    localStorage.setItem(llave, JSON.stringify(valor));
    return true;
  }catch(e){
    storageOk = false;
    const aviso = id('sin-storage');
    if(aviso) aviso.hidden = false;
    return false;
  }
}

/* ============================================================
   Estado
   ============================================================ */

/* `estudios` guarda TODO, incluidos los borrados (marcados con borrado:true).
   Se conservan como lápida para que al sincronizar no revivan desde otro
   aparato. La pantalla solo muestra `vivos()`. */
let estudios = leer(CLAVE_ESTUDIOS, []);
if(!Array.isArray(estudios)) estudios = [];

let guardadoAjustes = leer(CLAVE_AJUSTES, null);
let ajustes = Object.assign({}, AJUSTES_INICIALES,
  (guardadoAjustes && guardadoAjustes.datos) || {});
if(!ajustes.elementos || typeof ajustes.elementos !== 'object') ajustes.elementos = {};
let ajustesTocado = (guardadoAjustes && guardadoAjustes.tocado) || '';

let activoId = leer(CLAVE_ACTIVO, '');
let vistaActual = leer(CLAVE_VISTA, 'estudio');

const vivos    = () => estudios.filter(e => !e.borrado);
const abiertos = () => vivos().filter(e => !e.cerrado);
const cuando   = e => e.tocado || e.guardado || '';

function guardarEstudios(){
  return escribir(CLAVE_ESTUDIOS, estudios);
}

function guardarAjustes(){
  ajustesTocado = ahora();
  escribir(CLAVE_AJUSTES, { datos:ajustes, tocado:ajustesTocado });
}

function buscarEstudio(idEst){
  return estudios.find(e => e.id === idEst) || null;
}

function estudioActivo(){
  const e = buscarEstudio(activoId);
  return e && !e.borrado ? e : null;
}

/* Subir a la nube después de cada tecla sería un pedido por letra. Se espera a
   que la persona pare de escribir; lo guardado en el aparato ya está a salvo
   desde el primer momento, así que la espera no arriesga nada. */
let temporizadorNube = null;
function sincronizarPronto(){
  clearTimeout(temporizadorNube);
  temporizadorNube = setTimeout(() => Nube.sincronizar(true), 1500);
}

/* Todo lo que cambia un estudio pasa por acá: pone la fecha de «tocado» —que
   es la que decide quién gana al sincronizar—, guarda y sube. */
function tocar(e){
  e.tocado = ahora();
  guardarEstudios();
  pintarTodo();
  sincronizarPronto();
}

/* ============================================================
   Cálculo del estudio de tiempos
   ============================================================ */

function calcular(e){
  const base = Number.isFinite(e.personas) && e.personas > 0 ? e.personas : null;
  const tramos = Array.isArray(e.tramos) ? e.tramos : [];

  const conPersonas = t =>
    (Number.isFinite(t.personas) && t.personas > 0) ? t.personas : base;

  const cerrados = tramos
    .filter(t => t.hasta)
    .map(t => Object.assign({}, t, {
      horas: horasEntre(t.desde, t.hasta),
      personasEfectivas: conPersonas(t)
    }));

  const corriendo = tramos.find(t => !t.hasta) || null;

  const suma = (lista, f) => lista.reduce((s, t) => s + (f(t) || 0), 0);
  const deTipo = tipo => cerrados.filter(t => t.tipo === tipo);

  const total    = suma(cerrados, t => t.horas);
  const externos = suma(deTipo('Externo'), t => t.horas);
  const fijo     = suma(deTipo('Fijo'), t => t.horas);
  const variable = suma(deTipo('Variable'), t => t.horas);
  const na       = suma(cerrados.filter(t => !t.tipo || t.tipo === 'N/A'), t => t.horas);
  const neto     = total - externos;

  /* Horas hombre: solo tiene sentido si se sabe cuánta gente había en cada
     tramo. Si falta el dato en alguno, no se inventa un promedio: se deja en
     blanco, que es más honesto que un número que nadie puede reproducir. */
  const faltaGente = cerrados.some(t => !Number.isFinite(t.personasEfectivas));
  const hhTotal = faltaGente ? null : suma(cerrados, t => t.horas * t.personasEfectivas);
  const hhNeto  = faltaGente ? null
    : suma(cerrados.filter(t => t.tipo !== 'Externo'), t => t.horas * t.personasEfectivas);

  const produccion = Number.isFinite(e.produccion) && e.produccion > 0 ? e.produccion : null;

  return {
    cerrados, corriendo,
    total, externos, neto, fijo, variable, na,
    hhTotal, hhNeto,
    produccion,
    /* El rendimiento del Excel: horas de cuadrilla por unidad producida, sin
       contar las interrupciones ajenas. */
    rendCuadrilla: produccion ? neto / produccion : null,
    /* El mismo, por persona. Es el que se puede comparar entre cuadrillas de
       distinto tamaño, y por eso se calcula aunque el Excel no lo pidiera. */
    rendHombre: (produccion && hhNeto != null) ? hhNeto / produccion : null,
    porHora: (produccion && neto > 0) ? produccion / neto : null,
    inicio: tramos.length ? tramos[0].desde : null,
    fin: cerrados.length ? cerrados[cerrados.length - 1].hasta : null
  };
}

/* Lo que hay que avisar de un estudio. Se calcula acá y se pinta en dos lados
   —la vista del estudio y el historial—, para que no se contradigan. */
function avisosDe(e, c){
  const av = [];

  const sinDescribir = c.cerrados.filter(t => !t.descripcion).length +
                       (c.corriendo && !c.corriendo.descripcion ? 1 : 0);
  if(sinDescribir){
    av.push(['aviso', sinDescribir === 1
      ? 'Hay <b>una lectura sin describir</b>. Tóquela para ponerle el elemento.'
      : 'Hay <b>' + sinDescribir + ' lecturas sin describir</b>. Tóquelas para ponerles el elemento.']);
  }

  if(c.na > 0){
    av.push(['aviso', 'Hay <b>' + hm(c.na) + ' h</b> marcadas como N/A. Cuentan en el ' +
      'tiempo neto pero no en la composición del ciclo, así que fijo y variable ' +
      'no van a sumar el neto.']);
  }

  if(e.cerrado && !c.produccion){
    av.push(['aviso', 'Falta la <b>producción medida</b>: sin ella no hay rendimiento ' +
      'y el estudio no entra en los promedios.']);
  }

  if(c.produccion && !e.unidad){
    av.push(['aviso', 'Falta la <b>unidad</b> de la producción. Sin ella no se puede ' +
      'comparar con otros estudios.']);
  }

  if(!e.cerrado && e.fecha && e.fecha < fechaHoy()){
    av.push(['error', 'Este estudio quedó <b>abierto desde el ' + fechaCorta(e.fecha) +
      '</b>. Ciérrelo o corrija la última hora.']);
  }

  if(c.hhNeto == null && c.cerrados.length){
    av.push(['aviso', 'Falta el número de personas, así que no se puede calcular el ' +
      'rendimiento por hombre.']);
  }

  return av;
}

/* ============================================================
   Sugerencias: lo de Ajustes más lo que ya se escribió alguna vez

   Que el historial alimente las listas es lo que evita que la misma casa
   quede escrita de tres maneras distintas y el comparativo no sirva.
   ============================================================ */

function juntar(delAjuste, delHistorial){
  const vistos = new Map();
  (delAjuste || []).forEach(v => { if(v) vistos.set(norm(v), v); });
  (delHistorial || []).forEach(v => { if(v && !vistos.has(norm(v))) vistos.set(norm(v), v); });
  return Array.from(vistos.values()).sort((a, b) => a.localeCompare(b, 'es'));
}

const usados = campo => vivos().map(e => e[campo]).filter(Boolean);

const sugerencias = {
  proyecto:      () => juntar([], usados('proyecto')),
  caracteristicas: () => juntar([], usados('caracteristicas')),
  actividad:     () => juntar(ajustes.actividades, usados('actividad')),
  subactividad:  () => juntar(ajustes.subactividades, usados('subactividad')),
  cuadrilla:     () => juntar(ajustes.cuadrillas, usados('cuadrilla')),
  unidad:        () => juntar(ajustes.unidades, usados('unidad'))
};

/* Los elementos que se ofrecen al marcar una lectura: primero los de la
   cuadrilla, después lo que ya se usó en estudios de esa misma cuadrilla. */
function elementosDe(cuadrilla){
  const deAjustes = (ajustes.elementos && ajustes.elementos[cuadrilla]) || [];
  const delHistorial = [];
  vivos().forEach(e => {
    if(cuadrilla && e.cuadrilla !== cuadrilla) return;
    (e.tramos || []).forEach(t => { if(t.descripcion) delHistorial.push(t.descripcion); });
  });
  return juntar(deAjustes, delHistorial);
}

/* ============================================================
   Combobox: escribir libre con lista de sugerencias

   En el celular la lista se abre hacia ARRIBA (ver styles.css), porque abajo
   del campo está el teclado. El alto lo calcula `ajustarAlto`, que es el
   único que sabe cuánto espacio quedó entre el campo y la barra de arriba.
   ============================================================ */

const CELULAR = window.matchMedia('(max-width: 699.98px)');
const MINIMO_LISTA = 140;   // px: si arriba no caben ~3 opciones, mejor hacia abajo

class Combobox{
  constructor(raiz, obtener, alElegir){
    this.raiz    = raiz;
    this.input   = $('.combo-input', raiz);
    this.lista   = $('.combo-list', raiz);
    this.limpiar = $('.combo-clear', raiz);
    this.obtener = obtener;
    this.alElegir = alElegir || (() => {});
    this.filtrado = [];
    this.activo = -1;

    this.input.addEventListener('focus', () => { subirALaVista(this.raiz); this.abrir(); });
    this.input.addEventListener('click', () => this.abrir());
    this.input.addEventListener('input', () => { this.abrir(); this.alElegir(this.valor()); });
    this.input.addEventListener('keydown', e => this.teclas(e));
    this.input.addEventListener('blur', () => setTimeout(() => this.cerrar(), 130));

    this.lista.addEventListener('mousedown', e => {
      const li = e.target.closest('li[data-valor]');
      if(!li) return;
      e.preventDefault();
      this.fijar(li.dataset.valor);
      this.alElegir(this.valor());
    });

    this.limpiar.addEventListener('mousedown', e => {
      e.preventDefault();
      this.fijar('');
      this.input.focus();
      this.alElegir('');
    });
  }

  valor(){ return this.input.value.trim(); }

  fijar(v){
    this.input.value = v || '';
    this.pintarEstado();
    this.cerrar();
  }

  pintarEstado(){
    const v = this.valor();
    this.raiz.classList.toggle('has-value', v !== '');
    this.raiz.classList.toggle('is-ok', v !== '');
  }

  abrir(){
    const texto = norm(this.input.value);
    const items = this.obtener() || [];

    this.pintarEstado();

    this.filtrado = texto
      ? items.map(i => ({ i, pos:norm(i).indexOf(texto) }))
             .filter(o => o.pos !== -1)
             .sort((a, b) => a.pos - b.pos || a.i.localeCompare(b.i, 'es'))
             .map(o => o.i)
      : items.slice();

    this.activo = this.filtrado.length ? 0 : -1;
    this.pintarLista(texto);
    this.lista.hidden = false;
    this.input.setAttribute('aria-expanded', 'true');
    Combobox.abierto = this;
    this.ajustarAlto();
  }

  cerrar(){
    this.lista.hidden = true;
    this.activo = -1;
    this.input.setAttribute('aria-expanded', 'false');
    if(Combobox.abierto === this) Combobox.abierto = null;
  }

  /** En el celular la lista está pegada al campo por abajo y crece hacia
      arriba, así que lo que no quepa entre el campo y la barra de arriba se
      iría de la pantalla, y para eso no hay scroll que alcance. El alto
      máximo es ese hueco; lo que sobre se scrollea adentro de la lista. */
  ajustarAlto(){
    if(!CELULAR.matches){
      this.lista.style.maxHeight = '';
      this.raiz.classList.remove('abre-abajo');
      return;
    }
    const barra = $('.topbar').getBoundingClientRect().bottom;
    const campo = this.input.getBoundingClientRect();
    const hueco = Math.round(campo.top - barra - 10);
    /* Si el campo quedó tan arriba que no cabe casi nada, esa vez se abre
       hacia abajo: una lista de 40 px no le sirve a nadie. */
    const abajo = hueco < MINIMO_LISTA;
    this.raiz.classList.toggle('abre-abajo', abajo);
    this.lista.style.maxHeight = abajo ? '' : Math.max(0, hueco) + 'px';
  }

  pintarLista(texto){
    if(!this.filtrado.length){
      const hay = (this.obtener() || []).length;
      this.lista.innerHTML = '<li class="vacio">' +
        (this.valor()
          ? 'Sin coincidencias · se guarda lo que escriba'
          : (hay ? 'Sin coincidencias' : 'Todavía no hay nada en la lista')) +
        '</li>';
      return;
    }
    this.lista.innerHTML = this.filtrado.map((item, i) => {
      let etiqueta = escapar(item);
      if(texto){
        const pos = norm(item).indexOf(texto);
        if(pos !== -1){
          etiqueta = escapar(item.slice(0, pos)) +
                     '<mark>' + escapar(item.slice(pos, pos + texto.length)) + '</mark>' +
                     escapar(item.slice(pos + texto.length));
        }
      }
      return '<li role="option" data-valor="' + escapar(item) + '"' +
             ' class="' + (i === this.activo ? 'is-active' : '') + '"' +
             ' aria-selected="' + (i === this.activo) + '"><span>' + etiqueta + '</span></li>';
    }).join('');
  }

  mover(paso){
    if(this.lista.hidden) return this.abrir();
    if(!this.filtrado.length) return;
    this.activo = (this.activo + paso + this.filtrado.length) % this.filtrado.length;
    this.pintarLista(norm(this.input.value));
    const li = this.lista.children[this.activo];
    if(li) li.scrollIntoView({ block:'nearest' });
  }

  teclas(e){
    switch(e.key){
      case 'ArrowDown': e.preventDefault(); this.mover(1); break;
      case 'ArrowUp':   e.preventDefault(); this.mover(-1); break;
      case 'Enter':
        if(!this.lista.hidden && this.activo >= 0 && this.filtrado[this.activo]){
          e.preventDefault();
          this.fijar(this.filtrado[this.activo]);
          this.alElegir(this.valor());
        }
        break;
      case 'Escape':
        if(!this.lista.hidden){ e.preventDefault(); this.cerrar(); }
        break;
    }
  }
}

/* Cuál lista está abierta (nunca hay dos a la vez), para poder recalcularle el
   alto. Hace falta porque al tocar el campo el teclado del celular aparece
   después: la pantalla se hace más chica y el campo se corre para arriba, así
   que la cuenta hecha al abrir queda vieja. `visualViewport` es lo único que
   se entera del teclado. */
Combobox.abierto = null;
const reajustar = () => { if(Combobox.abierto) Combobox.abierto.ajustarAlto(); };
window.addEventListener('scroll', reajustar, { passive:true });
window.addEventListener('resize', reajustar);
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', reajustar);
  window.visualViewport.addEventListener('scroll', reajustar);
}

const combos = {};
function armarCombos(){
  combos.proyecto        = new Combobox(id('combo-proyecto'),        sugerencias.proyecto);
  combos.caracteristicas = new Combobox(id('combo-caract'),          sugerencias.caracteristicas);
  combos.actividad       = new Combobox(id('combo-actividad'),       sugerencias.actividad);
  combos.subactividad    = new Combobox(id('combo-subactividad'),    sugerencias.subactividad);
  combos.cuadrilla       = new Combobox(id('combo-cuadrilla'),       sugerencias.cuadrilla);
  combos.unidad          = new Combobox(id('combo-unidad'),          sugerencias.unidad, () => {
    const e = estudioActivo();
    if(!e) return;
    e.unidad = combos.unidad.valor();
    tocar(e);
  });
}

/* ============================================================
   Hoja modal

   Una sola hoja para todo: marcar una lectura, corregirla, cambiar el
   encabezado. Se arma desde JavaScript porque cada uso tiene sus campos, y
   tener una hoja por caso en el HTML habría sido cuatro veces el mismo
   armazón.
   ============================================================ */

const Hoja = (() => {
  let alGuardar = null;

  function abrir({ titulo, cuerpo, guardar, textoGuardar, extra }){
    id('hoja-titulo').textContent = titulo;
    id('hoja-cuerpo').innerHTML = cuerpo;
    alGuardar = guardar;

    id('hoja-pie').innerHTML =
      (extra || '') +
      '<button type="button" class="btn" data-hoja="cancelar">Cancelar</button>' +
      '<button type="button" class="btn btn-verde" data-hoja="guardar">' +
      escapar(textoGuardar || 'Guardar') + '</button>';

    id('velo').hidden = false;
    document.body.style.overflow = 'hidden';

    /* El primer campo enfocado, salvo en el celular: ahí el teclado tapando
       media pantalla apenas se abre la hoja estorba más que ayudar. */
    const primero = $('input, textarea, select', id('hoja-cuerpo'));
    if(primero && !CELULAR.matches) primero.focus();
  }

  function cerrar(){
    id('velo').hidden = true;
    id('hoja-cuerpo').innerHTML = '';
    document.body.style.overflow = '';
    alGuardar = null;
  }

  id('b-cerrar-hoja').addEventListener('click', cerrar);
  id('velo').addEventListener('mousedown', e => { if(e.target === id('velo')) cerrar(); });
  document.addEventListener('keydown', e => {
    if(e.key === 'Escape' && !id('velo').hidden) cerrar();
  });

  id('hoja-pie').addEventListener('click', e => {
    const b = e.target.closest('[data-hoja]');
    if(!b) return;
    if(b.dataset.hoja === 'cancelar') return cerrar();
    if(b.dataset.hoja === 'guardar' && alGuardar){
      /* Si el guardado devuelve un texto, es un error: la hoja se queda
         abierta y lo muestra, en vez de cerrarse tragándose el problema. */
      const error = alGuardar();
      if(error){
        let caja = $('#hoja-error');
        if(!caja){
          caja = document.createElement('p');
          caja.id = 'hoja-error';
          caja.className = 'nota error';
          caja.style.marginTop = '12px';
          id('hoja-cuerpo').appendChild(caja);
        }
        caja.innerHTML = error;
        caja.scrollIntoView({ behavior:'smooth', block:'nearest' });
        return;
      }
      cerrar();
    }
  });

  return { abrir, cerrar };
})();

/* Trocitos de HTML para armar las hojas. */

function campoTexto(idc, etiqueta, valor, extra){
  return '<div class="campo" style="margin-bottom:13px">' +
    '<label for="' + idc + '">' + escapar(etiqueta) + '</label>' +
    '<input type="text" id="' + idc + '" autocomplete="off" value="' + escapar(valor || '') + '"' +
    (extra || '') + '></div>';
}

function campoNumero(idc, etiqueta, valor, extra, ayuda){
  return '<div class="campo" style="margin-bottom:13px">' +
    '<label for="' + idc + '">' + escapar(etiqueta) + '</label>' +
    '<input type="number" id="' + idc + '" inputmode="decimal" value="' +
    (valor == null ? '' : escapar(valor)) + '"' + (extra || '') + '>' +
    (ayuda ? '<span class="ayuda">' + ayuda + '</span>' : '') + '</div>';
}

function campoHora(idc, etiqueta, valor, ayuda){
  return '<div class="campo" style="margin-bottom:13px">' +
    '<label for="' + idc + '">' + escapar(etiqueta) + '</label>' +
    '<input type="time" id="' + idc + '" value="' + escapar(valor || '') + '" step="60">' +
    (ayuda ? '<span class="ayuda">' + ayuda + '</span>' : '') + '</div>';
}

/* El desplegable del tipo de elemento: las cuatro opciones de la hoja `Val`
   del Excel, en el mismo orden. */
function campoTipo(idc, valor){
  return '<div class="campo" style="margin-bottom:13px">' +
    '<label for="' + idc + '">Tipo de elemento</label>' +
    '<select id="' + idc + '">' +
    ['N/A'].concat(TIPOS.filter(t => t !== 'N/A')).map(t =>
      '<option value="' + t + '"' + (t === valor ? ' selected' : '') + '>' + t + '</option>'
    ).join('') +
    '</select>' +
    '<span class="ayuda" id="' + idc + '-ayuda"></span></div>';
}

/* Los elementos de la cuadrilla, como botones. En obra es más rápido tocar
   uno que escribirlo, y de paso todos quedan escritos igual. */
function chipsElementos(cuadrilla, idDestino){
  const lista = elementosDe(cuadrilla).slice(0, 14);
  if(!lista.length) return '';
  return '<div class="etiquetas" style="margin:-4px 0 13px">' +
    lista.map(v =>
      '<button type="button" class="chip" data-poner="' + escapar(v) + '"' +
      ' data-destino="' + idDestino + '">' + escapar(v) + '</button>'
    ).join('') + '</div>';
}

/* Los chips rellenan el campo de texto en vez de guardar de una: así se puede
   tocar uno y corregirlo antes de guardar. */
document.addEventListener('click', e => {
  const b = e.target.closest('[data-poner]');
  if(!b) return;
  const destino = id(b.dataset.destino);
  if(destino){ destino.value = b.dataset.poner; destino.focus(); }
});

/* La ayuda del tipo cambia según lo escogido. */
document.addEventListener('change', e => {
  if(!e.target.matches('select[id$="-tipo"]')) return;
  const ayuda = id(e.target.id + '-ayuda');
  if(ayuda) ayuda.textContent = AYUDA_TIPO[e.target.value] || '';
});

/* ============================================================
   Vista: Estudio
   ============================================================ */

function pintarEstudio(){
  const e = estudioActivo();
  const hayAbiertos = abiertos();

  /* La tira aparece en cuanto hay un estudio a la vista: es la manera de
     saltar entre los que estén abiertos y —sobre todo— de volver al
     formulario para arrancar otro. Sin estudio a la vista no hace falta,
     porque el formulario ya está en pantalla. */
  const tira = id('tira-abiertos');
  if(e){
    tira.hidden = false;
    tira.innerHTML = hayAbiertos.map(x =>
      '<button type="button" class="chip" data-ir="' + escapar(x.id) + '"' +
      ' aria-pressed="' + (e.id === x.id) + '">' +
      '<span class="pt"></span>' + escapar(x.proyecto || 'Sin proyecto') +
      ' · ' + escapar(x.cuadrilla || '—') + '</button>'
    ).join('') +
    (e.cerrado
      ? '<button type="button" class="chip" aria-pressed="true">' +
        escapar(e.proyecto || 'Sin proyecto') + ' · terminado</button>'
      : '') +
    '<button type="button" class="chip" data-ir="nuevo">+ Estudio nuevo</button>';
  }else{
    tira.hidden = true;
  }

  id('card-nuevo').hidden = !!e;
  id('estudio-activo').hidden = !e;

  if(!e){
    id('et-nuevo').textContent = hayAbiertos.length
      ? hayAbiertos.length + ' abierto' + (hayAbiertos.length === 1 ? '' : 's')
      : '';
    return;
  }

  const c = calcular(e);

  /* Encabezado */
  id('enc-p1').textContent = (e.proyecto || 'Sin proyecto') +
    (e.caracteristicas ? ' · ' + e.caracteristicas : '');
  id('enc-p2').innerHTML =
    escapar(e.actividad || '—') + ' · ' + escapar(e.subactividad || '—') +
    ' · <b>' + escapar(e.cuadrilla || '—') + '</b>' +
    (Number.isFinite(e.personas) ? ' · ' + e.personas + (e.personas === 1 ? ' persona' : ' personas') : '') +
    ' · ' + fechaCorta(e.fecha);

  pintarReloj(e, c);
  pintarTramos(e, c);
  pintarResultados(e, c);
}

/* El reloj y el tramo que va corriendo. Se refresca cada segundo desde el
   `setInterval` de abajo, así que acá no se pinta nada que sea caro. */
function pintarReloj(e, c){
  const corriendo = c.corriendo;
  const fin = corriendo ? Date.now() : (c.fin ? new Date(c.fin).getTime() : Date.now());
  const totalSeg = c.inicio ? (fin - new Date(c.inicio).getTime()) / 1000 : 0;

  id('reloj-total').innerHTML = hms(totalSeg) +
    '<small>' + (e.cerrado ? ' h · terminado' : ' h') + '</small>';
  id('reloj-desde').textContent = c.inicio
    ? 'Desde las ' + horaDe(c.inicio) + (c.fin && e.cerrado ? ' hasta las ' + horaDe(c.fin) : '')
    : '';

  const caja = id('actual');
  const nom  = id('actual-nom');
  const cro  = id('actual-cro');

  if(corriendo){
    caja.className = 'actual' + (corriendo.tipo === 'Externo' ? ' externo' : '') +
                     (!corriendo.descripcion ? ' sin-describir' : '');
    nom.className = 'nom' + (corriendo.descripcion ? '' : ' pendiente');
    nom.textContent = corriendo.descripcion || 'Sin describir · toque la lectura';
    cro.textContent = hms((Date.now() - new Date(corriendo.desde).getTime()) / 1000);
    $('.et', caja).textContent = 'Ahora mismo' +
      (corriendo.tipo && corriendo.tipo !== 'N/A' ? ' · ' + corriendo.tipo : '');
  }else{
    caja.className = 'actual';
    nom.className = 'nom';
    nom.textContent = e.cerrado ? 'Estudio terminado' : 'Sin nada corriendo';
    cro.textContent = hm(c.total);
    $('.et', caja).textContent = e.cerrado ? 'Total' : '—';
  }

  /* Con el estudio cerrado no hay nada que marcar: el botón grande pasa a
     ser el de reabrir, para no dejar sin salida a quien lo cerró de más. */
  const marcar = id('b-lectura');
  marcar.innerHTML = e.cerrado
    ? 'Reabrir estudio<small>Sigue corriendo desde ahora</small>'
    : 'Nueva lectura<small>Cambiaron de tarea</small>';
  id('b-interrupcion').hidden = e.cerrado;
  id('b-terminar').hidden = e.cerrado;
  id('b-agregar-lectura').hidden = false;
}

function pintarTramos(e, c){
  const lista = id('lista-tramos');
  const tramos = e.tramos || [];

  id('et-lecturas').textContent = tramos.length
    ? tramos.length + (tramos.length === 1 ? ' tramo' : ' tramos')
    : '';

  if(!tramos.length){
    lista.innerHTML = '<li style="cursor:default"><div class="vacio-estado" style="width:100%">' +
      '<p class="t">Todavía no hay lecturas</p>' +
      '<p>Toque «Nueva lectura» cuando la cuadrilla cambie de tarea.</p></div></li>';
    return;
  }

  lista.innerHTML = tramos.map((t, i) => {
    const abierto = !t.hasta;
    const horas = abierto ? horasEntre(t.desde, ahora()) : horasEntre(t.desde, t.hasta);
    const gente = Number.isFinite(t.personas) && t.personas > 0 ? t.personas : null;
    const clase = 'tipo-' + (t.tipo === 'N/A' ? 'NA' : (t.tipo || 'NA'));

    return '<li data-tramo="' + i + '"' +
      ' class="' + (abierto ? 'corriendo' : '') + (!t.descripcion ? ' pendiente' : '') + '">' +
      '<div class="hora">' + horaDe(t.desde) + '</div>' +
      '<div class="med">' +
        '<div class="d1' + (t.descripcion ? '' : ' sin') + '">' +
          escapar(t.descripcion || 'Sin describir') + '</div>' +
        '<div class="d2">' +
          '<span class="tipo ' + clase + '">' + escapar(t.tipo || 'N/A') + '</span>' +
          (gente ? '<span class="gente">' + gente + ' personas</span>' : '') +
          (abierto ? '<span class="gente">corriendo</span>' : '') +
        '</div>' +
        (t.obs ? '<div class="obs">' + escapar(t.obs) + '</div>' : '') +
      '</div>' +
      '<div class="dur">' + hm(horas) + '<small>' +
        (abierto ? 'va' : 'h') + '</small></div>' +
    '</li>';
  }).join('');
}

function pintarResultados(e, c){
  const u = e.unidad || 'unidad';

  const linea = (rot, valor, unidad, clase) =>
    '<tr' + (clase ? ' class="' + clase + '"' : '') + '>' +
      '<th>' + escapar(rot) + '</th>' +
      '<td>' + valor + '<span class="u">' + escapar(unidad) + '</span></td>' +
    '</tr>';

  const seccion = t => '<tr class="seccion"><th colspan="2">' + escapar(t) + '</th></tr>';

  id('tabla-resultados').innerHTML =
    linea('Producción medida', c.produccion ? fmt(c.produccion, 2) : '—', u) +
    linea('Tiempo total actividad', hm(c.total), 'h') +
    linea('Elementos externos', hm(c.externos), 'h') +
    linea('Tiempo neto', hm(c.neto), 'h') +
    seccion('Composición del ciclo') +
    linea('Productivo Fijo', hm(c.fijo), 'h') +
    linea('Productivo Variable', hm(c.variable), 'h') +
    (c.na > 0 ? linea('N/A', hm(c.na), 'h') : '') +
    seccion('Horas hombre') +
    linea('Horas hombre netas', c.hhNeto == null ? '—' : fmt(c.hhNeto, 2), 'h·hombre');

  /* El rendimiento, grande. Es el número por el que se hace todo esto. */
  const caja = id('rend-caja');
  if(c.rendCuadrilla == null){
    caja.innerHTML = '<div class="card-body"><p class="nota">' +
      'Anote la <b>producción medida</b> para ver el rendimiento.</p></div>';
  }else{
    caja.innerHTML =
      '<div class="rend-grande">' +
        '<div class="v">' + fmt(c.rendCuadrilla, 4) +
          ' <span class="u">h.cuadr/' + escapar(u) + '</span></div>' +
        '<div class="sub">' +
          (c.rendHombre != null
            ? '<b>' + fmt(c.rendHombre, 4) + '</b> h.hombre/' + escapar(u) + ' · '
            : '') +
          '<b>' + fmt(c.porHora, 2) + '</b> ' + escapar(u) + ' por hora de cuadrilla' +
        '</div>' +
        (c.externos > 0
          ? '<div class="sub">Con las interrupciones adentro serían <b>' +
            fmt(c.total / c.produccion, 4) + '</b>: los externos costaron <b>' +
            fmt((c.total - c.neto) / c.produccion, 4) + '</b> h.cuadr/' + escapar(u) + '.</div>'
          : '') +
      '</div>';
  }

  const avisos = avisosDe(e, c);
  id('avisos-estudio').innerHTML = avisos.length
    ? avisos.map(([t, m]) => '<p class="nota ' + t + '">' + m + '</p>').join('')
    : '<p class="nota ok">El estudio está completo.</p>';

  /* Los campos de cierre, sin pisar lo que la persona esté escribiendo. */
  const prod = id('i-produccion');
  if(document.activeElement !== prod){
    prod.value = Number.isFinite(e.produccion) ? e.produccion : '';
  }
  if(document.activeElement !== combos.unidad.input){
    combos.unidad.fijar(e.unidad || '');
  }
  const nota = id('i-nota');
  if(document.activeElement !== nota) nota.value = e.nota || '';
}

/* ---------- Acciones del estudio ---------- */

function crearEstudio(){
  const personas = num(id('i-personas').value);
  const fecha = id('i-fecha').value || fechaHoy();
  const hora  = id('i-inicio').value;

  const aviso = id('aviso-nuevo');
  const parar = mensaje => {
    aviso.innerHTML = '<p class="nota error" style="margin-top:13px">' + mensaje + '</p>';
    aviso.scrollIntoView({ behavior:'smooth', block:'nearest' });
  };

  const faltan = [];
  if(!combos.proyecto.valor())  faltan.push('el proyecto');
  if(!combos.cuadrilla.valor()) faltan.push('la cuadrilla');
  if(faltan.length) return parar('Falta ' + faltan.join(' y ') + '.');

  /* La hora de inicio se arma sobre la fecha escogida, no sobre hoy: así se
     puede anotar en la tarde un estudio que arrancó en la mañana. */
  const [a, m, d] = fecha.split('-').map(Number);
  let inicio;
  if(hora){
    const [h, mi] = hora.split(':').map(Number);
    inicio = new Date(a, m - 1, d, h, mi, 0, 0).toISOString();
  }else{
    inicio = ahora();
  }

  /* Un estudio no puede arrancar en el futuro: el cronómetro contaría para
     atrás y el primer tramo nacería con duración negativa. Se ataja acá,
     donde se escribió la hora, y no dos pantallas después. */
  if(new Date(inicio) > new Date()){
    return parar('El estudio arrancaría <b>' + horaDe(inicio) + ' del ' +
      fechaCorta(fecha) + '</b>, que todavía no ha llegado. Son las <b>' +
      horaDe(ahora()) + '</b>.');
  }

  aviso.innerHTML = '';

  const e = {
    id: nuevoId(),
    fecha,
    proyecto: combos.proyecto.valor(),
    caracteristicas: combos.caracteristicas.valor(),
    actividad: combos.actividad.valor(),
    subactividad: combos.subactividad.valor(),
    cuadrilla: combos.cuadrilla.valor(),
    personas: Number.isFinite(personas) && personas > 0 ? Math.round(personas) : null,
    tramos: [{ id:nuevoId(), desde:inicio, hasta:null, descripcion:'', tipo:'Fijo', personas:null, obs:'' }],
    produccion: null,
    unidad: '',
    cerrado: false,
    nota: '',
    borrado: false,
    guardado: ahora(),
    tocado: ahora()
  };

  estudios.unshift(e);
  activoId = e.id;
  escribir(CLAVE_ACTIVO, activoId);
  guardarEstudios();
  pintarTodo();
  Nube.sincronizar(true);

  /* Se pide de una qué están haciendo: el estudio ya está corriendo. */
  editarTramo(e, 0, { titulo:'¿Con qué empiezan?', primera:true });
}

/* Marcar una lectura: se cierra el tramo que corría y arranca uno nuevo. La
   hora se toma en el momento del toque, ANTES de preguntar nada: si alguien
   cierra la hoja sin llenarla, la hora ya quedó guardada y el tramo se puede
   describir después. Perder la hora sería perder el estudio. */
function marcarLectura(e, tipoInicial){
  const t = ahora();
  const tramos = e.tramos || (e.tramos = []);
  const corriendo = tramos.find(x => !x.hasta);

  if(corriendo){
    if(new Date(t) <= new Date(corriendo.desde)){
      toast('El reloj del aparato se fue para atrás. Corrija la hora a mano.');
      return;
    }
    corriendo.hasta = t;
  }

  tramos.push({
    id: nuevoId(),
    desde: t,
    hasta: null,
    descripcion: '',
    tipo: tipoInicial || 'Variable',
    personas: corriendo ? (corriendo.personas || null) : null,
    obs: ''
  });

  tocar(e);
  editarTramo(e, tramos.length - 1, {
    titulo: tipoInicial === 'Externo' ? 'Interrupción' : '¿Qué empiezan ahora?'
  });
}

function terminarEstudio(e){
  const corriendo = (e.tramos || []).find(t => !t.hasta);
  if(!corriendo){ e.cerrado = true; tocar(e); return; }

  const t = ahora();
  if(new Date(t) <= new Date(corriendo.desde)){
    toast('La hora de fin tiene que ser posterior al último tramo.');
    return;
  }
  corriendo.hasta = t;
  e.cerrado = true;
  tocar(e);

  toast('Estudio terminado · anote la producción');
  id('i-produccion').focus();
  subirALaVista(id('i-produccion').closest('.campo'));
}

function reabrirEstudio(e){
  e.cerrado = false;
  e.tramos.push({
    id: nuevoId(),
    desde: ahora(),
    hasta: null,
    descripcion: '',
    tipo: 'Variable',
    personas: null,
    obs: ''
  });
  tocar(e);
  editarTramo(e, e.tramos.length - 1, { titulo:'¿Qué empiezan ahora?' });
}

/* ---------- Editar un tramo ---------- */

function editarTramo(e, i, opciones){
  const op = opciones || {};
  const t = e.tramos[i];
  if(!t) return;

  const esPrimero = i === 0;
  const abierto = !t.hasta;

  const cuerpo =
    campoTexto('h-desc', 'Descripción del elemento', t.descripcion,
      ' placeholder="Acomodo telescópica"') +
    chipsElementos(e.cuadrilla, 'h-desc') +
    campoTipo('h-tipo', t.tipo || 'N/A') +
    campoHora('h-hora', esPrimero ? 'Hora de inicio del estudio' : 'Hora de esta lectura',
      horaDe(t.desde),
      esPrimero
        ? 'Cuándo arrancó el estudio.'
        : 'Cuándo cambiaron de tarea. Cambiarla mueve también el fin del tramo anterior.') +
    (abierto ? '' : campoHora('h-fin', 'Hora en que terminó este tramo', horaDe(t.hasta),
      'Es la hora de la lectura siguiente: cambiarla las mueve las dos.')) +
    campoNumero('h-personas', 'Personas en este tramo', t.personas,
      ' min="1" max="60" step="1" placeholder="' +
      (Number.isFinite(e.personas) ? e.personas : '') + '"',
      'Vacío significa las mismas del encabezado' +
      (Number.isFinite(e.personas) ? ' (' + e.personas + ')' : '') + '.') +
    '<div class="campo"><label for="h-obs">Observaciones</label>' +
    '<textarea id="h-obs" rows="2" placeholder="Lo que haya que aclarar">' +
    escapar(t.obs || '') + '</textarea></div>';

  const extra = (!op.primera && e.tramos.length > 1)
    ? '<button type="button" class="btn btn-rojo btn-chico" id="h-borrar" style="flex:0 0 auto">Borrar</button>'
    : '';

  Hoja.abrir({
    titulo: op.titulo || 'Lectura de las ' + horaDe(t.desde),
    cuerpo,
    extra,
    textoGuardar: op.primera ? 'Empezar' : 'Guardar',
    guardar(){
      const desc = id('h-desc').value.trim();
      const tipo = id('h-tipo').value;
      const pers = num(id('h-personas').value);
      const obs  = id('h-obs').value.trim();

      /* Las horas primero: si una no cuadra, no se guarda nada. */
      const nuevaDesde = conHora(t.desde, id('h-hora').value);
      if(!nuevaDesde) return 'La hora no es válida.';

      const anterior = e.tramos[i - 1];
      const siguiente = e.tramos[i + 1];

      let nuevaHasta = t.hasta;
      if(!abierto && id('h-fin')){
        nuevaHasta = conHora(t.hasta, id('h-fin').value);
        if(!nuevaHasta) return 'La hora de fin no es válida.';
      }

      if(anterior && new Date(nuevaDesde) <= new Date(anterior.desde)){
        return 'Esta lectura tiene que ser posterior a la de las <b>' +
               horaDe(anterior.desde) + '</b>.';
      }
      if(nuevaHasta && new Date(nuevaHasta) <= new Date(nuevaDesde)){
        return 'El tramo terminaría antes de empezar. Revise las horas.';
      }
      if(siguiente && siguiente.hasta && nuevaHasta &&
         new Date(nuevaHasta) >= new Date(siguiente.hasta)){
        return 'El tramo se comería el siguiente. Revise las horas.';
      }
      if(abierto && new Date(nuevaDesde) > new Date()){
        return 'Las <b>' + horaDe(nuevaDesde) + '</b> todavía no han llegado: ' +
               'son las <b>' + horaDe(ahora()) + '</b>.';
      }

      t.descripcion = desc;
      t.tipo = tipo;
      t.personas = Number.isFinite(pers) && pers > 0 ? Math.round(pers) : null;
      t.obs = obs;

      /* Mover una lectura mueve el borde, no el tramo: los tramos son
         contiguos y tienen que seguir siéndolo. */
      t.desde = nuevaDesde;
      if(anterior) anterior.hasta = nuevaDesde;
      if(nuevaHasta){
        t.hasta = nuevaHasta;
        if(siguiente) siguiente.desde = nuevaHasta;
      }

      /* Lo que se escribe a mano se guarda para la próxima, pero solo si es
         de una cuadrilla conocida: si no, la lista se llenaría de cosas
         sueltas que nadie va a volver a usar. */
      if(desc && e.cuadrilla){
        const lista = ajustes.elementos[e.cuadrilla] || (ajustes.elementos[e.cuadrilla] = []);
        if(!lista.some(x => norm(x) === norm(desc))){
          lista.push(desc);
          guardarAjustes();
        }
      }

      tocar(e);
      return null;
    }
  });

  /* La ayuda del tipo, ya con el valor puesto. */
  const sel = id('h-tipo');
  if(sel) id('h-tipo-ayuda').textContent = AYUDA_TIPO[sel.value] || '';

  const borrar = id('h-borrar');
  if(borrar){
    borrar.addEventListener('click', () => {
      if(!confirm('¿Borrar este tramo? El tiempo se le suma al tramo anterior.')) return;
      borrarTramo(e, i);
      Hoja.cerrar();
    });
  }
}

/* Borrar un tramo no borra su tiempo: se lo queda el tramo anterior. Si se
   descontara, el estudio dejaría de cuadrar con el reloj —la suma de los
   tramos tiene que dar siempre lo que va de la primera lectura a la última—. */
function borrarTramo(e, i){
  const t = e.tramos[i];
  const anterior = e.tramos[i - 1];

  if(e.tramos.length === 1){
    toast('Es el único tramo. Borre el estudio entero si no sirve.');
    return;
  }

  if(anterior){
    anterior.hasta = t.hasta;          // se traga el tramo borrado
  }
  e.tramos.splice(i, 1);
  tocar(e);
  toast('Tramo borrado');
}

/* Agregar una lectura que se pasó: parte en dos el tramo donde cae la hora.
   El pedazo nuevo es el de después, porque una lectura describe lo que
   EMPIEZA en ese momento. */
function agregarLecturaOlvidada(e){
  const c = calcular(e);
  if(!c.inicio){ toast('Primero hay que iniciar el estudio.'); return; }

  const cuerpo =
    '<p class="nota" style="margin-bottom:13px">Parte en dos el tramo donde caiga la ' +
    'hora. Lo que escriba acá es lo que <b>empezó</b> en ese momento.</p>' +
    campoHora('h-hora', 'Hora de la lectura', horaDe(ahora())) +
    campoTexto('h-desc', 'Descripción del elemento', '', ' placeholder="Aplome"') +
    chipsElementos(e.cuadrilla, 'h-desc') +
    campoTipo('h-tipo', 'Variable');

  Hoja.abrir({
    titulo: 'Lectura que se pasó',
    cuerpo,
    textoGuardar: 'Agregar',
    guardar(){
      const instante = conHora(c.inicio, id('h-hora').value);
      if(!instante) return 'La hora no es válida.';

      const marca = new Date(instante).getTime();
      const i = e.tramos.findIndex(t => {
        const desde = new Date(t.desde).getTime();
        const hasta = t.hasta ? new Date(t.hasta).getTime() : Date.now();
        return marca > desde && marca < hasta;
      });

      if(i === -1){
        return 'Esa hora cae fuera del estudio, o justo encima de una lectura ' +
               'que ya existe. El estudio va de las <b>' + horaDe(c.inicio) +
               '</b> a las <b>' + horaDe(c.fin || ahora()) + '</b>.';
      }

      const viejo = e.tramos[i];
      const nuevo = {
        id: nuevoId(),
        desde: instante,
        hasta: viejo.hasta,
        descripcion: id('h-desc').value.trim(),
        tipo: id('h-tipo').value,
        personas: viejo.personas || null,
        obs: ''
      };
      viejo.hasta = instante;
      e.tramos.splice(i + 1, 0, nuevo);

      tocar(e);
      toast('Lectura agregada a las ' + horaDe(instante));
      return null;
    }
  });

  id('h-tipo-ayuda').textContent = AYUDA_TIPO['Variable'];
}

/* ---------- Editar el encabezado ---------- */

function editarEncabezado(e){
  const opciones = (lista, valor) => lista.map(v =>
    '<option value="' + escapar(v) + '"' + (v === valor ? ' selected' : '') + '>' +
    escapar(v) + '</option>').join('');

  const cuerpo =
    campoTexto('h-proyecto', 'Proyecto', e.proyecto) +
    campoTexto('h-caract', 'Características', e.caracteristicas) +
    campoTexto('h-actividad', 'Actividad', e.actividad) +
    campoTexto('h-subactividad', 'Sub-actividad', e.subactividad) +
    '<div class="campo" style="margin-bottom:13px"><label for="h-cuadrilla">Cuadrilla</label>' +
    '<select id="h-cuadrilla"><option value="">—</option>' +
    opciones(sugerencias.cuadrilla(), e.cuadrilla) + '</select></div>' +
    campoNumero('h-personas', 'Personas en la cuadrilla', e.personas,
      ' min="1" max="60" step="1"',
      'Es el valor por defecto: un tramo puede tener otro.') +
    '<div class="campo"><label for="h-fecha">Fecha</label>' +
    '<input type="date" id="h-fecha" value="' + escapar(e.fecha || '') + '"></div>';

  Hoja.abrir({
    titulo: 'Encabezado del estudio',
    cuerpo,
    guardar(){
      const p = num(id('h-personas').value);
      e.proyecto = id('h-proyecto').value.trim();
      e.caracteristicas = id('h-caract').value.trim();
      e.actividad = id('h-actividad').value.trim();
      e.subactividad = id('h-subactividad').value.trim();
      e.cuadrilla = id('h-cuadrilla').value;
      e.personas = Number.isFinite(p) && p > 0 ? Math.round(p) : null;
      e.fecha = id('h-fecha').value || e.fecha;
      tocar(e);
      return null;
    }
  });
}

/* ============================================================
   Vista: Historial
   ============================================================ */

function estudiosFiltrados(){
  const texto = norm(id('i-buscar').value);
  const desde = id('i-desde').value;
  const hasta = id('i-hasta').value;

  return vivos().filter(e => {
    if(desde && (e.fecha || '') < desde) return false;
    if(hasta && (e.fecha || '') > hasta) return false;
    if(!texto) return true;
    const bolsa = norm([e.proyecto, e.caracteristicas, e.actividad, e.subactividad,
                        e.cuadrilla, e.unidad, e.nota].join(' '));
    return bolsa.indexOf(texto) !== -1;
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '') ||
                    cuando(b).localeCompare(cuando(a)));
}

function pintarHistorial(){
  const lista = estudiosFiltrados();
  const todos = vivos();

  id('pill-hist').textContent = todos.length;
  id('et-historial').textContent = lista.length === todos.length
    ? (todos.length + (todos.length === 1 ? ' estudio' : ' estudios'))
    : (lista.length + ' de ' + todos.length);
  id('b-excel-todos').disabled = lista.length === 0;

  const cont = id('lista-historial');

  if(!lista.length){
    cont.innerHTML = '<li style="cursor:default"><div class="vacio-estado" style="width:100%">' +
      '<p class="t">' + (todos.length ? 'Nada con ese filtro' : 'Todavía no hay estudios') + '</p>' +
      '<p>' + (todos.length
        ? 'Pruebe con otro texto o limpie las fechas.'
        : 'Arranque uno desde la pestaña Estudio.') + '</p></div></li>';
    return;
  }

  cont.innerHTML = lista.map(e => {
    const c = calcular(e);
    const u = e.unidad || 'unidad';
    return '<li data-est="' + escapar(e.id) + '"' +
      (e.cerrado ? '' : ' class="abierto"') + '>' +
      '<div class="txt">' +
        '<div class="l1">' + escapar(e.proyecto || 'Sin proyecto') +
          (e.caracteristicas ? ' · ' + escapar(e.caracteristicas) : '') + '</div>' +
        '<div class="l2">' + fechaCorta(e.fecha) + ' · ' +
          escapar(e.actividad || '—') + ' · ' + escapar(e.subactividad || '—') +
          ' · ' + escapar(e.cuadrilla || '—') +
          ' · ' + hm(c.neto) + ' h netas' +
          (e.cerrado ? '' : ' · <b>abierto</b>') + '</div>' +
      '</div>' +
      '<div class="der">' +
        (c.rendCuadrilla != null
          ? '<div class="rend">' + fmt(c.rendCuadrilla, 3) +
            '<small>h.cuadr/' + escapar(u) + '</small></div>'
          : '<div class="rend sin">sin producción</div>') +
      '</div>' +
    '</li>';
  }).join('');
}

/* ============================================================
   Vista: Rendimientos

   Un estudio suelto es una anécdota. El valor aparece al juntar varios de la
   misma cuadrilla y la misma tarea: ahí se ve el promedio, cuánto varía, y
   —lo que de verdad sirve para cotizar— cuánto del tiempo es montaje fijo y
   cuánto crece con la cantidad.
   ============================================================ */

const LLAVES_GRUPO = {
  cas: e => [e.cuadrilla, e.actividad, e.subactividad],
  cs:  e => [e.cuadrilla, e.subactividad],
  as:  e => [e.actividad, e.subactividad],
  c:   e => [e.cuadrilla]
};

function pintarRendimientos(){
  const modo = id('i-agrupar').value;
  const partes = LLAVES_GRUPO[modo] || LLAVES_GRUPO.cas;

  /* Solo estudios que de verdad tienen un rendimiento. */
  const utiles = vivos()
    .filter(e => e.cerrado)
    .map(e => ({ e, c:calcular(e) }))
    .filter(x => x.c.rendCuadrilla != null);

  const grupos = new Map();
  utiles.forEach(x => {
    const llave = partes(x.e).map(v => v || '—').join(' · ') +
                  ' | ' + (x.e.unidad || 'unidad');
    if(!grupos.has(llave)) grupos.set(llave, []);
    grupos.get(llave).push(x);
  });

  id('et-rend').textContent = grupos.size
    ? grupos.size + (grupos.size === 1 ? ' grupo' : ' grupos')
    : '';

  const cont = id('lista-rendimientos');

  if(!grupos.size){
    cont.innerHTML = '<div class="vacio-estado">' +
      '<p class="t">Todavía no hay nada que promediar</p>' +
      '<p>Hacen falta estudios terminados y con la producción medida.</p></div>';
    return;
  }

  /* Los grupos con más estudios primero: son los que ya dicen algo. */
  const ordenados = Array.from(grupos.entries())
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0], 'es'));

  cont.innerHTML = ordenados.map(([llave, lista]) => {
    const [titulo, unidad] = llave.split(' | ');

    const sumaNeto = lista.reduce((s, x) => s + x.c.neto, 0);
    const sumaProd = lista.reduce((s, x) => s + x.c.produccion, 0);
    const sumaFijo = lista.reduce((s, x) => s + x.c.fijo, 0);
    const sumaVar  = lista.reduce((s, x) => s + x.c.variable, 0);

    /* Ponderado por producción, no promedio de promedios: un estudio de 80 m²
       dice más que uno de 5, y promediar sus rendimientos por partes iguales
       le daría el mismo peso a los dos. */
    const rend = sumaNeto / sumaProd;

    const conHombre = lista.filter(x => x.c.rendHombre != null);
    const rendH = conHombre.length
      ? conHombre.reduce((s, x) => s + x.c.hhNeto, 0) /
        conHombre.reduce((s, x) => s + x.c.produccion, 0)
      : null;

    const valores = lista.map(x => x.c.rendCuadrilla);
    const min = Math.min.apply(null, valores);
    const max = Math.max.apply(null, valores);
    const dispersion = rend > 0 ? (max - min) / rend : 0;

    /* El modelo que sirve para cotizar: un montaje que se paga una vez por
       ciclo, más un tiempo que crece con la cantidad. */
    const fijoPorCiclo = sumaFijo / lista.length;
    const varPorUnidad = sumaVar / sumaProd;

    const detalle = lista
      .slice()
      .sort((a, b) => (b.e.fecha || '').localeCompare(a.e.fecha || ''))
      .map(x =>
        '<tr data-est="' + escapar(x.e.id) + '">' +
          '<td>' + fechaCorta(x.e.fecha) + '</td>' +
          '<td>' + escapar(x.e.proyecto || '—') + '</td>' +
          '<td class="n">' + fmt(x.c.produccion, 2) + '</td>' +
          '<td class="n">' + hm(x.c.neto) + '</td>' +
          '<td class="n">' + (Number.isFinite(x.e.personas) ? x.e.personas : '—') + '</td>' +
          '<td class="n"><b>' + fmt(x.c.rendCuadrilla, 4) + '</b></td>' +
        '</tr>'
      ).join('');

    return '<details class="grupo">' +
      '<summary>' +
        '<div class="txt">' +
          '<div class="g1">' + escapar(titulo) + '</div>' +
          '<div class="g2">' + lista.length +
            (lista.length === 1 ? ' estudio' : ' estudios') + ' · ' +
            fmt(sumaProd, 0) + ' ' + escapar(unidad) + ' medidos</div>' +
        '</div>' +
        '<div class="val"><div class="v">' + fmt(rend, 4) + '</div>' +
        '<div class="u">h.cuadr/' + escapar(unidad) + '</div></div>' +
      '</summary>' +
      '<div class="grupo-cuerpo">' +

        (lista.length > 1
          ? '<p class="modelo">Montaje <b>' + hm(fijoPorCiclo) + ' h</b> por estudio, ' +
            'más <b>' + fmt(varPorUnidad, 4) + ' h.cuadr</b> por ' + escapar(unidad) + '.' +
            '<span class="exp">El tiempo fijo se paga una vez, aunque el lote sea chico; ' +
            'el variable crece con la cantidad. Por eso un solo promedio se queda corto ' +
            'en lotes chicos y sobra en los grandes.</span></p>'
          : '<p class="nota" style="margin-bottom:12px">Con un solo estudio no hay ' +
            'promedio que valga. Haga dos o tres más de lo mismo.</p>') +

        (rendH != null
          ? '<p class="nota" style="margin-bottom:12px">Por persona: <b>' +
            fmt(rendH, 4) + '</b> h.hombre/' + escapar(unidad) + '.</p>'
          : '') +

        (lista.length > 1
          ? '<div class="barra-disp"><span>' + fmt(min, 4) + '</span>' +
            '<div class="bar"><i style="left:0;right:0"></i></div>' +
            '<span>' + fmt(max, 4) + '</span></div>' +
            '<p class="ayuda">Entre el mejor y el peor hay un ' +
            fmt(dispersion * 100, 0) + '% de diferencia.' +
            (dispersion > 0.5
              ? ' Es mucho: vale la pena ver qué pasó en los extremos.'
              : '') + '</p>'
          : '') +

        '<div class="tabla-wrap" style="margin-top:12px"><table class="datos">' +
        '<thead><tr><th>Fecha</th><th>Proyecto</th><th>Producción</th>' +
        '<th>Neto</th><th>Personas</th><th>h.cuadr/' + escapar(unidad) + '</th></tr></thead>' +
        '<tbody>' + detalle + '</tbody></table></div>' +
      '</div>' +
    '</details>';
  }).join('');
}

/* ============================================================
   Vista: Ajustes
   ============================================================ */

const LISTAS_AJUSTES = [
  ['cuadrillas',     'lista-cuadrillas',     'i-nueva-cuadrilla'],
  ['actividades',    'lista-actividades',    'i-nueva-actividad'],
  ['subactividades', 'lista-subactividades', 'i-nueva-subactividad'],
  ['unidades',       'lista-unidades',       'i-nueva-unidad']
];

function pintarEtiquetas(contenedor, lista, tipo, extra){
  const cont = id(contenedor);
  if(!lista.length){
    cont.innerHTML = '<p class="ayuda" style="margin:8px 0 0">La lista está vacía.</p>';
    return;
  }
  cont.innerHTML = lista.map(v =>
    '<span class="etiqueta">' + escapar(v) +
    '<button type="button" data-quitar="' + escapar(v) + '"' +
    ' data-de="' + tipo + '"' + (extra || '') +
    ' aria-label="Quitar ' + escapar(v) + '">&times;</button></span>'
  ).join('');
}

function pintarAjustes(){
  LISTAS_AJUSTES.forEach(([clave, contenedor]) => {
    pintarEtiquetas(contenedor, ajustes[clave] || [], clave);
  });

  /* El selector de cuadrilla de los elementos, sin perder la escogida. */
  const sel = id('i-cuadrilla-elem');
  const antes = sel.value;
  const cuadrillas = sugerencias.cuadrilla();
  sel.innerHTML = cuadrillas.length
    ? cuadrillas.map(v => '<option value="' + escapar(v) + '">' + escapar(v) + '</option>').join('')
    : '<option value="">— agregue una cuadrilla primero —</option>';
  if(antes && cuadrillas.indexOf(antes) !== -1) sel.value = antes;

  const cuad = sel.value;
  pintarEtiquetas('lista-elementos',
    (ajustes.elementos && ajustes.elementos[cuad]) || [], 'elementos',
    ' data-cuadrilla="' + escapar(cuad) + '"');

  /* Estado de la nube, con el detalle completo. */
  const d = Nube.describir();
  id('nube-detalle').innerHTML =
    '<p class="nota ' + d.tono + '">' + escapar(d.texto) + '</p>';

  id('cuenta-local').textContent = vivos().length;
}

function agregarA(clave, valor, cuadrilla){
  const v = String(valor || '').trim();
  if(!v) return;

  if(clave === 'elementos'){
    if(!cuadrilla){ toast('Escoja una cuadrilla primero.'); return; }
    const lista = ajustes.elementos[cuadrilla] || (ajustes.elementos[cuadrilla] = []);
    if(lista.some(x => norm(x) === norm(v))){ toast('Ya está en la lista.'); return; }
    lista.push(v);
  }else{
    const lista = ajustes[clave] || (ajustes[clave] = []);
    if(lista.some(x => norm(x) === norm(v))){ toast('Ya está en la lista.'); return; }
    lista.push(v);
  }

  guardarAjustes();
  pintarTodo();
  Nube.sincronizar(true);
  toast('Agregado');
}

function quitarDe(clave, valor, cuadrilla){
  const lista = clave === 'elementos'
    ? (ajustes.elementos[cuadrilla] || [])
    : (ajustes[clave] || []);
  const i = lista.findIndex(x => x === valor);
  if(i === -1) return;
  lista.splice(i, 1);
  guardarAjustes();
  pintarTodo();
  Nube.sincronizar(true);
}

/* ============================================================
   Pintar todo y cambiar de vista
   ============================================================ */

const VISTAS = ['estudio', 'historial', 'rendimientos', 'ajustes'];

function verVista(v){
  if(VISTAS.indexOf(v) === -1) v = 'estudio';
  vistaActual = v;
  escribir(CLAVE_VISTA, v);
  VISTAS.forEach(x => {
    id('vista-' + x).hidden = x !== v;
    id('tab-' + x).setAttribute('aria-selected', String(x === v));
  });
  window.scrollTo({ top:0, behavior:'smooth' });
  pintarTodo();
}

function pintarNube(){
  const d = Nube.describir();
  const punto = id('nube-punto');
  punto.className = d.clase;
  punto.title = d.texto;
  punto.setAttribute('aria-label', 'Sincronización: ' + d.texto);
}

let pintando = false;
function pintarTodo(){
  if(pintando) return;      // evita reentrar desde un pintado que dispara otro
  pintando = true;
  try{
    pintarNube();
    pintarEstudio();
    pintarHistorial();
    if(vistaActual === 'rendimientos') pintarRendimientos();
    if(vistaActual === 'ajustes') pintarAjustes();
  } finally {
    pintando = false;
  }
}

/* ============================================================
   Exportar
   ============================================================ */

function nombreArchivo(lista){
  const hoy = fechaHoy();
  if(lista.length === 1){
    const e = lista[0];
    const limpio = (e.proyecto || 'estudio').replace(/[^\wáéíóúñ.\- ]/gi, '').trim() || 'estudio';
    return 'Rendimiento ' + limpio + ' ' + (e.fecha || hoy) + '.xlsx';
  }
  return 'Rendimientos ' + hoy + '.xlsx';
}

function exportar(lista){
  if(!lista.length){ toast('No hay nada que exportar.'); return; }
  try{
    const n = Excel.exportar(lista, calcular, nombreArchivo(lista));
    toast(n === 1 ? 'Excel descargado · 1 estudio'
                  : 'Excel descargado · ' + n + ' estudios');
  }catch(err){
    toast('No se pudo armar el Excel: ' + err.message);
  }
}

/* ============================================================
   Eventos
   ============================================================ */

function conectar(){

  /* --- Pestañas --- */
  $$('.tab').forEach(t => t.addEventListener('click', () => verVista(t.dataset.vista)));

  /* --- Estudio nuevo --- */
  id('b-iniciar').addEventListener('click', crearEstudio);

  /* --- Tira de estudios abiertos --- */
  id('tira-abiertos').addEventListener('click', e => {
    const b = e.target.closest('[data-ir]');
    if(!b) return;
    activoId = b.dataset.ir === 'nuevo' ? '' : b.dataset.ir;
    escribir(CLAVE_ACTIVO, activoId);
    pintarTodo();
  });

  /* --- Botones del estudio --- */
  id('b-lectura').addEventListener('click', () => {
    const e = estudioActivo();
    if(!e) return;
    if(e.cerrado) reabrirEstudio(e);
    else marcarLectura(e, 'Variable');
  });

  id('b-interrupcion').addEventListener('click', () => {
    const e = estudioActivo();
    if(e) marcarLectura(e, 'Externo');
  });

  id('b-terminar').addEventListener('click', () => {
    const e = estudioActivo();
    if(!e) return;
    if(!confirm('¿Terminar el estudio? Se cierra el tramo que va corriendo.')) return;
    terminarEstudio(e);
  });

  id('b-agregar-lectura').addEventListener('click', () => {
    const e = estudioActivo();
    if(e) agregarLecturaOlvidada(e);
  });

  id('b-editar-enc').addEventListener('click', () => {
    const e = estudioActivo();
    if(e) editarEncabezado(e);
  });

  id('lista-tramos').addEventListener('click', ev => {
    const li = ev.target.closest('li[data-tramo]');
    if(!li) return;
    const e = estudioActivo();
    if(e) editarTramo(e, Number(li.dataset.tramo));
  });

  /* --- Cierre del estudio --- */
  const guardarCierre = () => {
    const e = estudioActivo();
    if(!e) return;
    const p = num(id('i-produccion').value);
    e.produccion = Number.isFinite(p) && p >= 0 ? p : null;
    e.nota = id('i-nota').value.trim();
    e.tocado = ahora();
    guardarEstudios();
    /* Se repinta solo lo que cambia: repintar todo mientras alguien escribe
       le movería el cursor. */
    pintarResultados(e, calcular(e));
    pintarHistorial();
    sincronizarPronto();
  };
  id('i-produccion').addEventListener('input', guardarCierre);
  id('i-nota').addEventListener('input', guardarCierre);
  id('i-produccion').addEventListener('focus', ev => subirALaVista(ev.target.closest('.campo')));
  id('i-nota').addEventListener('focus', ev => subirALaVista(ev.target.closest('.campo')));

  id('b-excel-uno').addEventListener('click', () => {
    const e = estudioActivo();
    if(e) exportar([e]);
  });

  id('b-borrar-estudio').addEventListener('click', () => {
    const e = estudioActivo();
    if(!e) return;
    if(!confirm('¿Borrar este estudio? Se borra también en los demás aparatos.')) return;
    /* No se saca del arreglo: se marca borrado y se le pone fecha nueva. Es la
       única forma de que el borrado se propague; si se sacara, el otro aparato
       lo volvería a subir al sincronizar y reaparecería en todos lados. */
    e.borrado = true;
    e.tocado = ahora();
    activoId = '';
    escribir(CLAVE_ACTIVO, '');
    guardarEstudios();
    pintarTodo();
    Nube.sincronizar(true);
    toast('Estudio borrado');
  });

  /* --- Historial --- */
  ['i-buscar', 'i-desde', 'i-hasta'].forEach(x =>
    id(x).addEventListener('input', pintarHistorial));

  id('b-limpiar-filtro').addEventListener('click', () => {
    id('i-buscar').value = '';
    id('i-desde').value = '';
    id('i-hasta').value = '';
    pintarHistorial();
  });

  id('b-excel-todos').addEventListener('click', () => exportar(estudiosFiltrados()));

  /* Abrir un estudio desde el historial o desde el detalle de un grupo. */
  document.addEventListener('click', ev => {
    const fila = ev.target.closest('[data-est]');
    if(!fila) return;
    activoId = fila.dataset.est;
    escribir(CLAVE_ACTIVO, activoId);
    verVista('estudio');
  });

  /* --- Rendimientos --- */
  id('i-agrupar').addEventListener('change', pintarRendimientos);

  /* --- Ajustes --- */
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-agregar]');
    if(!b) return;
    const clave = b.dataset.agregar;
    if(clave === 'elementos'){
      const campo = id('i-nuevo-elemento');
      agregarA('elementos', campo.value, id('i-cuadrilla-elem').value);
      campo.value = '';
      return;
    }
    const campo = id(LISTAS_AJUSTES.find(l => l[0] === clave)[2]);
    agregarA(clave, campo.value);
    campo.value = '';
  });

  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-quitar]');
    if(!b) return;
    quitarDe(b.dataset.de, b.dataset.quitar, b.dataset.cuadrilla);
  });

  /* Enter en los campos de agregar. */
  document.addEventListener('keydown', ev => {
    if(ev.key !== 'Enter') return;
    const campo = ev.target;
    const par = campo.closest('.agregar');
    if(!par) return;
    ev.preventDefault();
    $('[data-agregar]', par).click();
  });

  id('i-cuadrilla-elem').addEventListener('change', pintarAjustes);

  /* --- Nube --- */
  id('b-sincronizar').addEventListener('click', () => Nube.sincronizar(false));
  id('nube-punto').addEventListener('click', () => {
    verVista('ajustes');
    Nube.sincronizar(false);
  });
}

/* ============================================================
   Arranque
   ============================================================ */

function arrancar(){
  if(!storageOk) id('sin-storage').hidden = false;

  armarCombos();
  conectar();

  /* Valores por defecto del formulario de estudio nuevo. */
  id('i-fecha').value = fechaHoy();
  id('i-inicio').value = horaDe(ahora());

  /* La nube no sabe nada de cómo se guardan las cosas acá: se le pasa el
     acceso, no las variables. */
  Nube.enlazar({
    leerEstudios: () => estudios,
    escribirEstudios: lista => { estudios = lista; guardarEstudios(); },
    leerAjustes: () => ({ datos:ajustes, tocado:ajustesTocado }),
    escribirAjustes: (datos, tocado) => {
      ajustes = Object.assign({}, AJUSTES_INICIALES, datos || {});
      if(!ajustes.elementos || typeof ajustes.elementos !== 'object') ajustes.elementos = {};
      ajustesTocado = tocado;
      escribir(CLAVE_AJUSTES, { datos:ajustes, tocado:ajustesTocado });
    },
    alCambiarEstado: pintarNube,
    alTerminar: () => pintarTodo(),
    avisar: toast
  });

  verVista(vistaActual);

  /* El reloj. Solo mueve dos textos, así que puede ir cada segundo sin que se
     note; repintar la pantalla entera cada segundo sí se notaría. */
  setInterval(() => {
    if(vistaActual !== 'estudio') return;
    const e = estudioActivo();
    if(!e || e.cerrado) return;
    const c = calcular(e);
    if(!c.corriendo) return;
    pintarReloj(e, c);
  }, 1000);

  /* Sincronización: al abrir, cada rato mientras la pestaña esté a la vista, y
     apenas vuelva la señal. */
  Nube.sincronizar(true);
  setInterval(() => {
    if(document.visibilityState === 'visible') Nube.sincronizar(true);
  }, CADA);
  document.addEventListener('visibilitychange', () => {
    if(document.visibilityState === 'visible') Nube.sincronizar(true);
  });
  window.addEventListener('online', () => Nube.sincronizar(true));

  /* No hay «¿seguro que quiere salir?»: cada toque ya quedó guardado en el
     aparato, así que cerrar la pestaña no pierde nada, y un estudio abierto es
     el estado normal mientras se trabaja. Preguntar en cada recarga sería
     molestar por algo que no puede pasar. */

  if('serviceWorker' in navigator && location.protocol !== 'file:'){
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

document.addEventListener('DOMContentLoaded', arrancar);
