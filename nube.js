/* ============================================================
   Rendimientos — sincronización con Supabase

   Es el MISMO proyecto de Supabase que usan las apps de reportes y de litros,
   con dos tablas nuevas: `estudios` y `rendimientos_ajustes`. Por eso no hay
   nada que configurar acá; solo hay que correr una vez `esquema.sql` desde el
   panel.

   Lo local manda para trabajar. La app funciona completa sin señal, con lo que
   haya guardado en el aparato —que es como se usa en obra—, y esto solo empareja
   esa copia con la nube cuando hay internet.

   ⚠️ La clave de abajo es la pública de Supabase, la misma de reportes. Viaja
   dentro de la página, así que cualquiera que abra la app la puede leer. Como
   esto va sin login, esa clave es lo único que hay entre los datos y el mundo,
   y no alcanza: quien la tenga puede leer, cambiar y borrar los estudios.

   Se acepta el mismo riesgo que ya se aceptó en reportes: son datos de proceso,
   no datos personales ni contraseñas; cada aparato conserva su copia completa;
   y el .xlsx que exporta la app es el respaldo de verdad.

   ⚠️ La clave que empieza con «sb_secret_» NO va acá ni en ningún otro archivo.
   Esa se salta hasta las reglas de la base.
   ============================================================ */
'use strict';

const URL_BASE      = 'https://vlbrnrjdqzjwegcakguo.supabase.co';
const CLAVE_PUBLICA = 'sb_publishable_Qz7jMd4dYIJRSHVS-OiBuw_IAdMddoX';

/* La fila única de los ajustes. Es una gaveta, no una tabla de verdad. */
const ID_AJUSTES = 'global';

const Nube = (() => {

  const estado = { sincronizando:false, ultima:null, error:'' };

  /* app.js llena esto en el arranque. La nube no sabe nada de cómo se guardan
     las cosas en el aparato; solo pide y entrega. */
  let api = null;

  function enlazar(nuevaApi){ api = nuevaApi; }

  /* ---------- Traducción de errores ----------
     Los mensajes crudos de PostgREST no le dicen nada a nadie. Los tres casos
     de abajo son los que de verdad pasan, y cada uno tiene un arreglo distinto. */
  function mensajeDeError(cuerpo, estadoHttp){
    const crudo = String((cuerpo && (cuerpo.msg || cuerpo.message ||
      cuerpo.error_description || cuerpo.error || cuerpo.hint)) || '');

    if(/could not find the table|PGRST205|does not exist/i.test(crudo)){
      return 'Falta la tabla en Supabase. Hay que correr esquema.sql una vez.';
    }
    if(/invalid api key/i.test(crudo)){
      return 'La clave de la nube no sirve. Revisar CLAVE_PUBLICA en nube.js.';
    }
    if(estadoHttp === 401 || estadoHttp === 403){
      return 'La nube no dejó pasar. Revisar las reglas de acceso del esquema.';
    }
    if(crudo) return crudo;
    return 'La nube respondió con un error (' + estadoHttp + ').';
  }

  /* Un fetch que distingue «no hay internet» de «la nube dijo que no». Son dos
     cosas distintas: la primera es normal en obra y no hay nada que arreglar. */
  function pedir(ruta, opciones){
    const config = opciones || {};
    return fetch(URL_BASE + '/rest/v1/' + ruta, {
      method: config.metodo || 'GET',
      headers: Object.assign({
        apikey: CLAVE_PUBLICA,
        'Content-Type': 'application/json',
        Prefer: config.prefer || 'return=minimal'
      }, config.cabeceras || {}),
      body: config.cuerpo === undefined ? undefined : JSON.stringify(config.cuerpo)
    }).catch(() => {
      throw new Error('Sin conexión. Se sigue trabajando con lo guardado en el aparato.');
    }).then(respuesta => {
      if(respuesta.status === 204) return null;
      return respuesta.json().catch(() => null).then(cuerpo => {
        if(!respuesta.ok) throw new Error(mensajeDeError(cuerpo, respuesta.status));
        return cuerpo;
      });
    });
  }

  /* ---------- Estudios: la tabla usa guión bajo; la app, los de siempre ---------- */

  function deSupabase(f){
    return {
      id: f.uid,
      fecha: f.fecha,
      proyecto: f.proyecto || '',
      caracteristicas: f.caracteristicas || '',
      actividad: f.actividad || '',
      subactividad: f.subactividad || '',
      cuadrilla: f.cuadrilla || '',
      personas: f.personas == null ? null : Number(f.personas),
      tramos: Array.isArray(f.tramos) ? f.tramos : [],
      produccion: f.produccion == null ? null : Number(f.produccion),
      unidad: f.unidad || '',
      cerrado: f.cerrado === true,
      nota: f.nota || '',
      borrado: f.borrado === true,
      guardado: f.guardado,
      tocado: f.tocado
    };
  }

  function aSupabase(e){
    return {
      uid: e.id,
      fecha: e.fecha,
      proyecto: e.proyecto || '',
      caracteristicas: e.caracteristicas || '',
      actividad: e.actividad || '',
      subactividad: e.subactividad || '',
      cuadrilla: e.cuadrilla || '',
      personas: Number.isFinite(e.personas) ? e.personas : null,
      tramos: e.tramos || [],
      produccion: Number.isFinite(e.produccion) ? e.produccion : null,
      unidad: e.unidad || '',
      cerrado: e.cerrado === true,
      nota: e.nota || '',
      borrado: e.borrado === true,
      guardado: e.guardado,
      tocado: e.tocado || e.guardado
    };
  }

  const leerEstudios = () =>
    pedir('estudios?select=*', { prefer:'return=representation' })
      .then(lista => (lista || []).map(deSupabase));

  /* Repetible: la llave es el uid del aparato, así que subir dos veces el mismo
     estudio lo actualiza en vez de duplicarlo. */
  function subirEstudios(lista){
    if(!lista.length) return Promise.resolve(null);
    return pedir('estudios', {
      metodo:'POST',
      cabeceras:{ Prefer:'resolution=merge-duplicates,return=minimal' },
      cuerpo: lista.map(aSupabase)
    });
  }

  /* ---------- Ajustes ----------
     Una sola fila con un jsonb adentro. Acá sí gana el más nuevo completo, sin
     fusionar lista por lista: son listas cortas que casi nunca se tocan, y
     fusionarlas haría imposible borrar nada —lo borrado en un aparato volvería
     desde el otro—. Si dos personas las editan el mismo día, gana la última. */
  const leerAjustesNube = () =>
    pedir('rendimientos_ajustes?id=eq.' + ID_AJUSTES + '&select=*',
          { prefer:'return=representation' })
      .then(filas => (filas && filas[0]) || null);

  const subirAjustes = (datos, tocado) =>
    pedir('rendimientos_ajustes', {
      metodo:'POST',
      cabeceras:{ Prefer:'resolution=merge-duplicates,return=minimal' },
      cuerpo:[{ id:ID_AJUSTES, datos, tocado }]
    });

  /* ---------- Fusión ----------
     Gana, estudio por estudio, la versión tocada más recientemente. Como borrar
     también actualiza esa fecha, un borrado le gana a una copia vieja en vez de
     que la copia vieja lo reviva. */
  const cuando = e => e.tocado || e.guardado || '';

  function fusionar(locales, remotas){
    const mapa = new Map();
    locales.forEach(e => mapa.set(e.id, e));
    remotas.forEach(r => {
      const local = mapa.get(r.id);
      if(!local || cuando(r) > cuando(local)) mapa.set(r.id, r);
    });
    return Array.from(mapa.values());
  }

  /* ---------- La sincronización ---------- */

  function sincronizar(silencioso){
    if(!api) return Promise.resolve();
    if(estado.sincronizando) return Promise.resolve();

    estado.sincronizando = true;
    estado.error = '';
    api.alCambiarEstado();

    let subidas = 0;

    return leerEstudios()
      .then(remotas => {
        const locales = api.leerEstudios();
        api.escribirEstudios(fusionar(locales, remotas));

        /* Se sube solo lo que la nube no tiene, o lo que acá está más fresco. */
        const enNube = new Map(remotas.map(r => [r.id, r]));
        const pendientes = api.leerEstudios().filter(e => {
          const r = enNube.get(e.id);
          return !r || cuando(e) > cuando(r);
        });
        subidas = pendientes.length;
        return subirEstudios(pendientes);
      })
      .then(() => leerAjustesNube())
      .then(fila => {
        const local = api.leerAjustes();          // { datos, tocado }
        const remotoMasNuevo = fila && (!local.tocado || String(fila.tocado) > String(local.tocado));

        if(remotoMasNuevo){
          api.escribirAjustes(fila.datos, fila.tocado);
        } else if(local.tocado && (!fila || String(local.tocado) > String(fila.tocado))){
          return subirAjustes(local.datos, local.tocado);
        }
      })
      .then(() => {
        estado.ultima = new Date().toISOString();
        estado.error  = '';
        api.alTerminar(subidas);
        if(!silencioso){
          api.avisar(subidas ? 'Sincronizado · ' + subidas + ' subidos' : 'Sincronizado');
        }
      })
      .catch(e => {
        estado.error = e.message;
        if(!silencioso) api.avisar(e.message);
      })
      .then(() => {
        estado.sincronizando = false;
        api.alCambiarEstado();
      });
  }

  function haceCuanto(iso){
    const seg = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
    if(seg < 60)    return 'hace un momento';
    if(seg < 3600)  return 'hace ' + Math.floor(seg / 60) + ' min';
    if(seg < 86400) return 'hace ' + Math.floor(seg / 3600) + ' h';
    return 'hace ' + Math.floor(seg / 86400) + ' d';
  }

  /* Cómo se ve el estado: clase del punto y texto para el title y para Ajustes. */
  function describir(){
    if(estado.sincronizando) return { clase:'punto trabajando', texto:'Sincronizando…',       tono:'' };
    if(estado.error)         return { clase:'punto mal',        texto:estado.error,           tono:'error' };
    if(estado.ultima)        return { clase:'punto bien',       texto:'Al día · ' + haceCuanto(estado.ultima), tono:'ok' };
    return { clase:'punto', texto:'Todavía no ha sincronizado. Se sincroniza sola al abrir la app.', tono:'' };
  }

  return { enlazar, sincronizar, describir, estado, cuando };
})();
