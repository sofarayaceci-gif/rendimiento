/* ══════════════════════════════════════════════════════════════════════════
   Rendimientos — la tabla en Supabase

   Va en el MISMO proyecto de Supabase que las apps de reportes y de litros.
   No hace falta crear un proyecto nuevo ni una clave nueva: esta app usa la
   misma clave pública, y lo único que agrega es la tabla `estudios`.

   Se corre desde el panel de Supabase:
     SQL Editor → New query → borrar lo que haya → pegar todo esto → Run

   Se puede correr las veces que haga falta: está escrito para no romper nada
   si la tabla ya existe. No borra datos.

   ⚠️ LEER ESTO, QUE NO ES UN DETALLE

   Esta base va SIN login, igual que reportes y litros, y por la misma
   decisión. La tabla queda abierta a quien tenga la clave pública de la app,
   y esa clave está dentro de `nube.js`. Cualquiera que la encuentre puede
   leer, cambiar y borrar los estudios.

   Se acepta ese riesgo porque:
     · son datos de proceso, no datos personales ni contraseñas;
     · cada aparato conserva su copia completa, así que vaciar la nube no
       borra el trabajo de nadie;
     · el .xlsx que exporta la app es el respaldo de verdad.

   Si algún día se quiere cerrar: se agrega una columna `user_id uuid default
   auth.uid()`, se cambian las reglas de `to anon` a `to authenticated` con
   `user_id = auth.uid()`, y se le pone formulario de entrar a la app.
   ══════════════════════════════════════════════════════════════════════════ */

/* ── Los estudios ──────────────────────────────────────────────────────────
   Una fila por estudio de tiempos. El encabezado va en columnas —para poder
   filtrar y agrupar desde SQL si algún día hace falta— y las lecturas van en
   un solo `jsonb`, porque son una lista de largo variable que solo tiene
   sentido completa: nadie va a consultar «el tercer tramo» por separado.

   La llave es un uid que genera el aparato al crear el estudio, no un número
   que ponga la base. Así el mismo estudio tiene la misma identidad en la
   compu, en el celular y en la nube, y sincronizar se vuelve repetible:
   subir dos veces el mismo estudio lo actualiza en vez de duplicarlo.       */
create table if not exists public.estudios (
  uid             text primary key,

  /* Encabezado */
  fecha           date not null,
  proyecto        text not null default '',
  caracteristicas text not null default '',
  actividad       text not null default '',
  subactividad    text not null default '',
  cuadrilla       text not null default '',
  personas        integer,

  /* Las lecturas.

     Cada elemento del arreglo es un tramo, y los tramos son contiguos: el
     `hasta` de uno es el `desde` del siguiente. Se guarda así, y no como una
     lista de horas sueltas, porque es lo que la app necesita para pintar y
     porque hace imposible el estado inconsistente de tener una hora sin
     saber a qué tramo pertenece.

       [{ id, desde, hasta, descripcion, tipo, personas, obs }]

     `tipo` es uno de: 'Fijo', 'Variable', 'Externo', 'N/A'.
     `hasta` en null es el tramo que está corriendo ahora mismo.
     `personas` en null significa «las mismas del encabezado».                */
  tramos          jsonb not null default '[]'::jsonb,

  /* Cierre */
  produccion      numeric,
  unidad          text not null default '',
  cerrado         boolean not null default false,
  nota            text not null default '',

  /* La fila NO se borra al borrar el estudio: se marca acá y se le pone fecha
     nueva en `tocado`. Es la única forma de que borrar se propague. Si se
     borrara la fila, cualquier aparato que todavía la tuviera guardada la
     volvería a subir al abrir la app y el estudio reaparecería en todos lados.

     Con la marca puesta hay algo que comparar, y gana la fecha más nueva: la
     última vez que alguien lo tocó. Guardar y borrar pesan igual. */
  borrado         boolean not null default false,

  guardado        timestamptz not null,
  tocado          timestamptz not null,

  creado          timestamptz not null default now()
);

/* El historial se ordena por lo último que se tocó. */
create index if not exists estudios_por_tocado on public.estudios (tocado desc);

/* La pantalla de Rendimientos agrupa por esto. */
create index if not exists estudios_por_trabajo
  on public.estudios (cuadrilla, actividad, subactividad);

/* ── Los ajustes compartidos ───────────────────────────────────────────────
   Las listas que se editan en la pestaña Ajustes —cuadrillas, elementos por
   cuadrilla, unidades, actividades— viajan también, para que agregar una
   cuadrilla en la compu la deje puesta en el celular de quien anda en obra.

   Es una sola fila, con un id fijo. No es una tabla de verdad: es una gaveta
   con un `jsonb` adentro. Se hizo así porque son listas cortas que se leen
   y se escriben siempre completas, y porque una tabla por lista habría sido
   cuatro tablas para guardar treinta palabras.                              */
create table if not exists public.rendimientos_ajustes (
  id              text primary key,
  datos           jsonb not null default '{}'::jsonb,
  tocado          timestamptz not null
);

/* ── Acceso ───────────────────────────────────────────────────────────────
   Hacen falta LAS DOS COSAS, y son distintas:

     · el GRANT dice si el rol puede tocar la tabla;
     · la POLICY dice qué filas puede ver de esa tabla.

   Sin el GRANT, la policy no sirve de nada: PostgREST contesta «permission
   denied for table». Supabase pone el GRANT solo cuando las tablas se crean
   desde su interfaz; creándola con «create table» acá, hay que ponerlo a mano.

   El rol `anon` es el que usa la app, porque va sin login.

   Las reglas son deliberadamente permisivas: es lo que significa «sin login». */
grant select, insert, update, delete on public.estudios to anon, authenticated;
grant select, insert, update, delete on public.rendimientos_ajustes to anon, authenticated;

/* RLS queda encendido igual: sin encenderlo, PostgREST no expone la tabla. */
alter table public.estudios enable row level security;
alter table public.rendimientos_ajustes enable row level security;

/* El «drop policy if exists» es lo que permite correr este archivo de nuevo
   sin que reviente por nombre repetido. */
drop policy if exists "abierto" on public.estudios;
create policy "abierto" on public.estudios for all to anon, authenticated
  using (true) with check (true);

drop policy if exists "abierto" on public.rendimientos_ajustes;
create policy "abierto" on public.rendimientos_ajustes for all to anon, authenticated
  using (true) with check (true);
