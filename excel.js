/* ============================================================
   Rendimientos — exportar a Excel

   Genera un .xlsx de verdad, sin librerías. Un .xlsx por dentro es un zip con
   unos cuantos XML, y acá se arman a mano: el zip está en `zip()`, los estilos
   en `ESTILOS` y la estructura de cada hoja en `hojaEstudio` y `hojaResumen`.

   El archivo trae:
     · una hoja «Resumen» con una fila por estudio, para tabla dinámica;
     · una hoja por estudio, con la MISMA forma del Excel original —mismos
       rótulos, mismas filas, mismo orden—, en blanco, gris y verde
       institucional.

   Se hace a mano y no con una librería porque la app tiene que abrir sin
   internet y sin instalar nada: meter un .js de 900 KB para esto sería más
   peso que toda la app junta.
   ============================================================ */
'use strict';

const Excel = (() => {

  /* ── Zip ──────────────────────────────────────────────────────────────
     Se guarda sin comprimir (método «store»). Son unos pocos KB de XML, así
     que no vale la pena meter un compresor: el archivo abre igual en Excel. */

  const TABLA_CRC = (() => {
    const t = new Uint32Array(256);
    for(let n = 0; n < 256; n++){
      let c = n;
      for(let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes){
    let c = 0xFFFFFFFF;
    for(let i = 0; i < bytes.length; i++) c = TABLA_CRC[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function zip(archivos){
    const cod = new TextEncoder();
    const trozos = [];
    const central = [];
    let desplazamiento = 0;

    archivos.forEach(a => {
      const nombre = cod.encode(a.nombre);
      const datos  = cod.encode(a.contenido);
      const suma   = crc32(datos);
      const tam    = datos.length;

      const local = new Uint8Array(30 + nombre.length);
      const dv = new DataView(local.buffer);
      dv.setUint32(0, 0x04034b50, true);   // firma
      dv.setUint16(4, 20, true);           // versión necesaria
      dv.setUint32(14, suma, true);
      dv.setUint32(18, tam, true);         // tamaño comprimido
      dv.setUint32(22, tam, true);         // tamaño real
      dv.setUint16(26, nombre.length, true);
      local.set(nombre, 30);
      trozos.push(local, datos);

      const cen = new Uint8Array(46 + nombre.length);
      const dc = new DataView(cen.buffer);
      dc.setUint32(0, 0x02014b50, true);
      dc.setUint16(4, 20, true);
      dc.setUint16(6, 20, true);
      dc.setUint32(16, suma, true);
      dc.setUint32(20, tam, true);
      dc.setUint32(24, tam, true);
      dc.setUint16(28, nombre.length, true);
      dc.setUint32(42, desplazamiento, true);
      cen.set(nombre, 46);
      central.push(cen);

      desplazamiento += local.length + tam;
    });

    const tamCentral = central.reduce((s, c) => s + c.length, 0);
    const fin = new Uint8Array(22);
    const df = new DataView(fin.buffer);
    df.setUint32(0, 0x06054b50, true);
    df.setUint16(8,  archivos.length, true);
    df.setUint16(10, archivos.length, true);
    df.setUint32(12, tamCentral, true);
    df.setUint32(16, desplazamiento, true);

    return new Blob(trozos.concat(central, [fin]), {
      type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
  }

  /* ── Piezas sueltas ───────────────────────────────────────────────── */

  const xml = s => String(s == null ? '' : s).replace(/[&<>"]/g,
    c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));

  /* Excel cuenta los días desde el 30-12-1899. */
  function serieFecha(iso){
    if(!iso) return 0;
    const [a, m, d] = iso.split('-').map(Number);
    return Date.UTC(a, m - 1, d) / 86400000 + 25569;
  }

  /* La hora del día como fracción de día, que es como Excel guarda las horas.
     Se lee en hora local a propósito: en la obra son las 13:00, no las 19:00
     UTC, y el Excel lo van a leer personas, no un servidor. */
  function fraccionHora(iso){
    if(!iso) return 0;
    const d = new Date(iso);
    return (d.getHours()*3600 + d.getMinutes()*60 + d.getSeconds()) / 86400;
  }

  /* Una duración en horas decimales, en fracción de día. */
  const fraccionDur = horas => (Number.isFinite(horas) ? horas : 0) / 24;

  /* Letra de columna: 1→A, 2→B, 27→AA… */
  function letraCol(n){
    let s = '';
    while(n > 0){
      const r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }

  /* ── Estilos ──────────────────────────────────────────────────────────
     Calcado del Excel original: gris D9D9D9 en los rótulos, en la fila de
     títulos y en las barras de sección —allá el gris venía por tema, acá va
     resuelto—, y blanco en todo lo demás.

     El verde institucional se quedó en la app y no entra en el archivo: en el
     Excel de referencia no existía. Lo que se veía verde en la captura era el
     resaltado que Excel le pone al rango que tiene seleccionado, no un relleno.

     La única excepción es la celda del rendimiento, en verde muy suave. Esa
     celda en el original estaba vacía —el rótulo estaba puesto pero nunca se
     escribió la fórmula—, así que no hay nada que calcar y sí conviene que el
     número por el que se hace todo el estudio se distinga de un vistazo.      */

  const GRIS  = 'FFD9D9D9';
  const SUAVE = 'FFF4F9E0';

  const ESTILOS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<numFmts count="5">
<numFmt numFmtId="164" formatCode="hh:mm"/>
<numFmt numFmtId="165" formatCode="[h]:mm"/>
<numFmt numFmtId="166" formatCode="0.0000"/>
<numFmt numFmtId="167" formatCode="dd\\-mm\\-yyyy;@"/>
<numFmt numFmtId="168" formatCode="0.00"/>
</numFmts>
<fonts count="3">
<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><b/><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
<font><i/><sz val="10"/><color rgb="FF7B8078"/><name val="Calibri"/><family val="2"/><scheme val="minor"/></font>
</fonts>
<fills count="4">
<fill><patternFill patternType="none"/></fill>
<fill><patternFill patternType="gray125"/></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${GRIS}"/><bgColor indexed="64"/></patternFill></fill>
<fill><patternFill patternType="solid"><fgColor rgb="${SUAVE}"/><bgColor indexed="64"/></patternFill></fill>
</fills>
<borders count="2">
<border><left/><right/><top/><bottom/><diagonal/></border>
<border><left style="thin"><color indexed="64"/></left><right style="thin"><color indexed="64"/></right><top style="thin"><color indexed="64"/></top><bottom style="thin"><color indexed="64"/></bottom><diagonal/></border>
</borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="17">
<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf>
<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="164" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="1" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="166" fontId="1" fillId="3" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="167" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="168" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="1" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf>
<xf numFmtId="0" fontId="2" fillId="0" borderId="0" xfId="0" applyFont="1"/>
<xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center" wrapText="1"/></xf>
</cellXfs>
</styleSheet>`;

  /* Índices de `cellXfs`, con nombre para que se lea el código. */
  const E = {
    NORMAL:0,
    ROTULO:1,        // gris, negrita, borde   → los rótulos de la izquierda
    DATO_C:2,        // borde, centro          → los datos del encabezado
    CAB:3,           // gris, negrita, wrap    → la fila de títulos de la tabla
    BARRA:4,         // gris, negrita          → las barras de sección
    HORA:5,          // hh:mm
    DUR:6,           // [h]:mm
    TEXTO:7,         // borde, izquierda
    TEXTO_B:8,       // borde, izquierda, negrita
    TEXTO_C:9,       // borde, centro
    NUM4:10,         // 0.0000
    REND:11,         // verde muy suave, negrita, 0.0000 → el número del estudio
    FECHA:12,
    NUM2:13,         // 0.00
    ENTERO:14,
    PIE:15,          // itálica gris, sin borde
    TEXTO_W:16       // borde, izquierda, wrap
  };

  /* ── Celdas ───────────────────────────────────────────────────────── */

  const celdaTexto = (ref, s, v) =>
    '<c r="' + ref + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' +
    xml(v) + '</t></is></c>';

  const celdaNum = (ref, s, v) =>
    (Number.isFinite(v)
      ? '<c r="' + ref + '" s="' + s + '"><v>' + v + '</v></c>'
      : '<c r="' + ref + '" s="' + s + '"/>');

  /* Una celda que puede venir vacía: en blanco pero con su borde puesto, para
     que la cuadrícula no se rompa donde falta un dato. */
  const celda = (ref, s, v, numerica) =>
    (v === null || v === undefined || v === ''
      ? '<c r="' + ref + '" s="' + s + '"/>'
      : (numerica ? celdaNum(ref, s, Number(v)) : celdaTexto(ref, s, v)));

  const fila = (n, celdas, alto) =>
    '<row r="' + n + '"' + (alto ? ' ht="' + alto + '" customHeight="1"' : '') + '>' +
    celdas.join('') + '</row>';

  /* ── Hoja de un estudio ───────────────────────────────────────────────
     Misma estructura del Excel original: rótulos en la columna A, encabezado
     hasta la fila 6, la tabla de lecturas desde la 7, y el bloque del estudio
     de tiempos dos filas más abajo de la última lectura.                    */

  function hojaEstudio(e, c, primera){
    const filas = [];
    const merges = [];

    /* Encabezado */
    const enc = [
      ['Proyecto',        e.proyecto],
      ['Características', e.caracteristicas],
      ['Actividad',       e.actividad],
      ['Sub-actividad',   e.subactividad]
    ];
    enc.forEach(([rot, val], i) => {
      const n = i + 2;
      filas.push(fila(n, [
        celdaTexto('A' + n, E.ROTULO, rot),
        celda('B' + n, E.DATO_C, val, false),
        '<c r="C' + n + '" s="' + E.DATO_C + '"/>',
        '<c r="D' + n + '" s="' + E.DATO_C + '"/>',
        '<c r="E' + n + '" s="' + E.DATO_C + '"/>',
        '<c r="F' + n + '" s="' + E.DATO_C + '"/>'
      ]));
      merges.push('B' + n + ':F' + n);
    });

    /* Fila 6: cuadrilla y cuántas personas */
    const gente = Number.isFinite(e.personas)
      ? e.personas + (e.personas === 1 ? ' persona' : ' personas')
      : '';
    filas.push(fila(6, [
      celdaTexto('A6', E.ROTULO, 'Cuadrilla'),
      celda('B6', E.DATO_C, e.cuadrilla, false),
      celda('C6', E.DATO_C, gente, false),
      '<c r="D6" s="' + E.DATO_C + '"/>',
      '<c r="E6" s="' + E.DATO_C + '"/>',
      '<c r="F6" s="' + E.DATO_C + '"/>'
    ]));
    merges.push('C6:F6');

    /* Fila 7: títulos de la tabla */
    filas.push(fila(7, [
      celdaTexto('A7', E.CAB, 'Hora lectura'),
      celdaTexto('B7', E.CAB, 'Tiempo acumulado'),
      celdaTexto('C7', E.CAB, 'Duración (horas:minutos)'),
      celdaTexto('D7', E.CAB, 'Descripción del elemento'),
      celdaTexto('E7', E.CAB, 'Tipo de elemento'),
      celdaTexto('F7', E.CAB, 'Observaciones')
    ], 32));

    /* Fila 8: el inicio. Duración cero, igual que en el original. */
    filas.push(fila(8, [
      celdaNum('A8', E.HORA, fraccionHora(c.inicio)),
      celdaNum('B8', E.DUR, 0),
      celdaNum('C8', E.DUR, 0),
      celdaTexto('D8', E.TEXTO, 'Inicio'),
      celdaTexto('E8', E.TEXTO_C, 'N/A'),
      '<c r="F8" s="' + E.TEXTO + '"/>'
    ]));

    /* Una fila por tramo cerrado: la hora es la de su FIN, que es la lectura
       que lo cerró. Es lo mismo que hacía el Excel, donde cada fila guardaba
       la hora en que se anotó y describía lo que se venía haciendo. */
    let acumulado = 0;
    c.cerrados.forEach((t, i) => {
      const n = 9 + i;
      acumulado += t.horas;
      filas.push(fila(n, [
        celdaNum('A' + n, E.HORA, fraccionHora(t.hasta)),
        celdaNum('B' + n, E.DUR, fraccionDur(acumulado)),
        celdaNum('C' + n, E.DUR, fraccionDur(t.horas)),
        celdaTexto('D' + n, E.TEXTO, t.descripcion || 'Sin describir'),
        celdaTexto('E' + n, E.TEXTO_C, t.tipo || 'N/A'),
        celda('F' + n, E.TEXTO, t.obs, false)
      ]));
    });

    /* Bloque del estudio de tiempos: dos filas en blanco y arranca. */
    const R = 8 + c.cerrados.length + 3;
    const unidad = e.unidad || 'unidad';

    const barra = (n, texto) => {
      filas.push(fila(n, [
        celdaTexto('A' + n, E.BARRA, texto),
        '<c r="B' + n + '" s="' + E.BARRA + '"/>',
        '<c r="C' + n + '" s="' + E.BARRA + '"/>'
      ]));
      merges.push('A' + n + ':C' + n);
    };

    const linea = (n, rot, valor, estilo, unidadTxt) => {
      filas.push(fila(n, [
        rot ? celdaTexto('A' + n, E.TEXTO_B, rot) : '<c r="A' + n + '" s="' + E.TEXTO + '"/>',
        celda('B' + n, estilo, valor, true),
        celdaTexto('C' + n, E.TEXTO_C, unidadTxt)
      ]));
    };

    barra(R, 'Estudio de tiempos');
    linea(R + 1, 'Producción medida',      c.produccion,             E.NUM2, unidad);
    linea(R + 2, 'Tiempo total actividad', fraccionDur(c.total),     E.DUR,  'horas:minutos');
    linea(R + 3, 'Elementos externos',     fraccionDur(c.externos),  E.DUR,  'horas:minutos');
    linea(R + 4, 'Tiempo neto',            fraccionDur(c.neto),      E.DUR,  'horas:minutos');

    barra(R + 5, 'Composición del ciclo');
    linea(R + 6, 'Productivo Fijo',        fraccionDur(c.fijo),      E.DUR,  'horas:minutos');
    linea(R + 7, 'Productivo Variable',    fraccionDur(c.variable),  E.DUR,  'horas:minutos');

    barra(R + 8, 'Rendimiento');
    /* La fila del original: rótulo en blanco, valor y unidad. */
    linea(R + 9,  '',                          c.rendCuadrilla, E.REND, 'h.cuadr/' + unidad);
    linea(R + 10, 'Por persona',               c.rendHombre,    E.NUM4, 'h.hombre/' + unidad);
    linea(R + 11, 'Producción por hora',       c.porHora,       E.NUM4, unidad + '/h.cuadr');

    /* Pie: de dónde salió el archivo y cuándo. */
    const pie = R + 13;
    const f = new Date();
    const p = x => String(x).padStart(2, '0');
    filas.push(fila(pie, [
      celdaTexto('A' + pie, E.PIE,
        'Estudio del ' + (e.fecha || '') + '. Exportado el ' +
        p(f.getDate()) + '-' + p(f.getMonth() + 1) + '-' + f.getFullYear() +
        ' desde la app Rendimientos.')
    ]));
    if(e.nota){
      filas.push(fila(pie + 1, [celdaTexto('A' + (pie + 1), E.PIE, 'Nota: ' + e.nota)]));
    }

    const anchos =
      '<col min="1" max="1" width="19.89" customWidth="1"/>' +
      '<col min="2" max="2" width="11.55" customWidth="1"/>' +
      '<col min="3" max="3" width="14.89" customWidth="1"/>' +
      '<col min="4" max="4" width="24" customWidth="1"/>' +
      '<col min="5" max="5" width="14.33" customWidth="1"/>' +
      '<col min="6" max="6" width="22" customWidth="1"/>';

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView${primera ? ' tabSelected="1"' : ''} showGridLines="0" workbookViewId="0"/></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos}</cols>
<sheetData>${filas.join('')}</sheetData>
<mergeCells count="${merges.length}">${
  merges.map(r => '<mergeCell ref="' + r + '"/>').join('')
}</mergeCells>
</worksheet>`;
  }

  /* ── Hoja Resumen ─────────────────────────────────────────────────────
     Una fila por estudio. Es la que sirve para tabla dinámica: comparar
     rendimientos entre casas, cuadrillas y fechas es exactamente lo que el
     Excel de una hoja por estudio no dejaba hacer.                        */

  const COLS_RESUMEN = [
    ['Fecha',                  E.FECHA,   e => serieFecha(e.fecha), 12],
    ['Proyecto',               E.TEXTO,   e => e.proyecto, 14],
    ['Características',        E.TEXTO,   e => e.caracteristicas, 22],
    ['Actividad',              E.TEXTO,   e => e.actividad, 16],
    ['Sub-actividad',          E.TEXTO,   e => e.subactividad, 16],
    ['Cuadrilla',              E.TEXTO,   e => e.cuadrilla, 14],
    ['Personas',               E.ENTERO,  (e) => e.personas, 10],
    ['Producción medida',      E.NUM2,    (e, c) => c.produccion, 13],
    ['Unidad',                 E.TEXTO_C, e => e.unidad, 9],
    ['Tiempo total',           E.DUR,     (e, c) => fraccionDur(c.total), 12],
    ['Elementos externos',     E.DUR,     (e, c) => fraccionDur(c.externos), 12],
    ['Tiempo neto',            E.DUR,     (e, c) => fraccionDur(c.neto), 12],
    ['Productivo fijo',        E.DUR,     (e, c) => fraccionDur(c.fijo), 12],
    ['Productivo variable',    E.DUR,     (e, c) => fraccionDur(c.variable), 12],
    ['h.cuadr/unidad',         E.REND,    (e, c) => c.rendCuadrilla, 14],
    ['h.hombre/unidad',        E.NUM4,    (e, c) => c.rendHombre, 14],
    ['Unidad/h.cuadr',         E.NUM4,    (e, c) => c.porHora, 14],
    ['Horas hombre',           E.NUM2,    (e, c) => c.hhNeto, 12],
    ['Lecturas',               E.ENTERO,  (e, c) => c.cerrados.length, 10],
    ['Nota',                   E.TEXTO_W, e => e.nota, 30]
  ];

  function hojaResumen(lista, calcular){
    const filas = [];

    filas.push(fila(1, COLS_RESUMEN.map(([titulo], i) =>
      celdaTexto(letraCol(i + 1) + '1', E.CAB, titulo)), 32));

    lista.forEach((e, j) => {
      const n = j + 2;
      const c = calcular(e);
      filas.push(fila(n, COLS_RESUMEN.map(([, estilo, valor], i) => {
        const ref = letraCol(i + 1) + n;
        const v = valor(e, c);
        const numerica = estilo !== E.TEXTO && estilo !== E.TEXTO_C && estilo !== E.TEXTO_W;
        return celda(ref, estilo, v, numerica);
      })));
    });

    const anchos = COLS_RESUMEN.map(([, , , w], i) =>
      '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + w + '" customWidth="1"/>'
    ).join('');

    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<sheetViews><sheetView showGridLines="0" workbookViewId="0">
<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
</sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="15"/>
<cols>${anchos}</cols>
<sheetData>${filas.join('')}</sheetData>
<autoFilter ref="A1:${letraCol(COLS_RESUMEN.length)}${Math.max(1, lista.length + 1)}"/>
</worksheet>`;
  }

  /* ── Nombres de hoja ──────────────────────────────────────────────────
     Excel no acepta más de 31 caracteres, ni : \ / ? * [ ], ni dos hojas con
     el mismo nombre. Como varias casas se estudian más de una vez, el nombre
     lleva un número cuando se repite.                                      */
  function nombresDeHoja(lista){
    const usados = new Set(['Resumen']);
    return lista.map((e, i) => {
      let base = (e.proyecto || e.actividad || ('Estudio ' + (i + 1)))
        .replace(/[:\\\/?*\[\]]/g, '-')
        .trim()
        .slice(0, 28) || ('Estudio ' + (i + 1));
      let nombre = base;
      let n = 2;
      while(usados.has(nombre)){ nombre = base.slice(0, 27) + ' ' + n; n++; }
      usados.add(nombre);
      return nombre;
    });
  }

  /* ── Armar el archivo ─────────────────────────────────────────────── */

  function exportar(lista, calcular, nombreArchivo){
    if(!lista.length) return 0;

    const nombres = nombresDeHoja(lista);
    const hojas = [];

    /* Primero las hojas de los estudios, y el archivo abre en la primera de
       ellas. Es la hoja que la gente ya conoce —la misma forma del Excel de
       siempre—, así que es la que tiene que aparecer al abrir el archivo.

       El «Resumen» va al final y solo cuando hay más de un estudio: con uno
       solo sería una tabla de una fila, que no le sirve a nadie. */
    lista.forEach((e, i) => {
      hojas.push({ nombre:nombres[i], contenido:hojaEstudio(e, calcular(e), i === 0) });
    });
    if(lista.length > 1){
      hojas.push({ nombre:'Resumen', contenido:hojaResumen(lista, calcular) });
    }

    const overrides = hojas.map((h, i) =>
      '<Override PartName="/xl/worksheets/sheet' + (i + 1) +
      '.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    ).join('');

    const sheetsXml = hojas.map((h, i) =>
      '<sheet name="' + xml(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'
    ).join('');

    const relsHojas = hojas.map((h, i) =>
      '<Relationship Id="rId' + (i + 1) +
      '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet"' +
      ' Target="worksheets/sheet' + (i + 1) + '.xml"/>'
    ).join('');

    const archivos = [
      { nombre:'[Content_Types].xml', contenido:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${overrides}
<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>` },

      { nombre:'_rels/.rels', contenido:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>` },

      { nombre:'xl/workbook.xml', contenido:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${sheetsXml}</sheets>
</workbook>` },

      { nombre:'xl/_rels/workbook.xml.rels', contenido:`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${relsHojas}
<Relationship Id="rId${hojas.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>` },

      { nombre:'xl/styles.xml', contenido:ESTILOS }
    ];

    hojas.forEach((h, i) => {
      archivos.push({ nombre:'xl/worksheets/sheet' + (i + 1) + '.xml', contenido:h.contenido });
    });

    const url = URL.createObjectURL(zip(archivos));
    const a = document.createElement('a');
    a.href = url;
    a.download = nombreArchivo;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);

    return lista.length;
  }

  return { exportar };
})();
