# Rendimientos

Estudios de tiempos en obra. Es la conversión a app web de `Rendimientos.xlsx`
—la hoja «Plantilla»—, con los mismos rótulos, las mismas cuentas y la misma
tabla, más un cronómetro para tomar las lecturas en sitio y un historial que
permite comparar un estudio con los anteriores.

Adelante Desarrollos.

---

## Cómo se usa en obra

Se abre un estudio con el encabezado —proyecto, características, actividad,
sub-actividad, cuadrilla y cuánta gente hay— y a partir de ahí **el estudio
queda corriendo**. Arriba del reloj siempre dice en cuál de los dos estados
está: **En curso** o **Terminado**.

Cada vez que la cuadrilla cambia de tarea se toca el botón grande: la app anota
la hora, cierra el tramo anterior con su duración y arranca el siguiente.

| Botón | Para qué |
|---|---|
| **Cambiaron de tarea** | El botón grande, el que se toca sin mirar. Cierra el tramo que venía y empieza otro. |
| **Se pararon** | Lo mismo, pero el tramo nace ya marcado como **Externo**. Es el caso más frecuente —llegó tarde el material, empezó a llover, esperando la grúa— y así es un toque en vez de tres. |
| **Terminar estudio** | Pide la hora en que terminaron —ya puesta con la de ahora, corregible—, cierra el tramo que va corriendo y pasa a la producción medida. |

Lo de pedir la hora al terminar no es un trámite: es el único momento del
estudio donde uno casi nunca toca el botón justo cuando pasa la cosa. La
cuadrilla termina, uno mide, conversa, y se acuerda diez minutos después.

### Seguir con un estudio ya terminado

Con el estudio terminado, el botón grande pasa a ser **Seguir con el estudio**,
y pregunta desde qué hora sigue. La hora viene puesta con la del cierre, y de
ahí salen los dos casos reales:

- **Se cerró por error** y no habían terminado: se deja la hora como está y el
  cronómetro sigue de ahí, como si nada. El tramo que se había cerrado
  simplemente vuelve a correr.
- **Volvieron a trabajar más tarde**: se pone la hora en que volvieron, y el
  rato de por medio entra como una **parada** —un tramo `Externo` llamado
  «Parados», que después se puede describir mejor tocándolo—.

Ese segundo caso es la razón de que la pantalla pregunte en vez de dar por
hecho que es «ahora». Antes reabrir arrancaba un tramo nuevo con la hora del
momento y dejaba un hueco: estudio cerrado a las 11:00, reabierto a las 14:00,
y esas tres horas no quedaban dentro de ningún tramo. El reloj decía 6:00 y la
tabla sumaba 3:00. Ahora los tramos nunca dejan de estar pegados uno con otro,
que es de lo que dependen todas las cuentas.

Al final se anota **cuánto se produjo** y en qué unidad, y ahí sale el
rendimiento.

### Cuando no se midió nada

Rendimiento es tiempo dividido entre producción, así que sin producción no hay
división que hacer. Pero hay un caso donde no hace falta medir: cuando el
estudio cubrió **un elemento completo, de principio a fin** —un muro, una
columna, un tramo de losa—. Ahí la producción es ese elemento, y el botón
**«No la medí · fue un ciclo completo»** lo deja anotado como `1 ciclo` de un
toque.

El rendimiento sale entonces en **horas por ciclo** en vez de horas por m², que
es exactamente lo que su Excel llamaba *tiempo del ciclo neto*. No es un número
inventado: es lo que se observó. Y esos estudios se promedian entre ellos como
cualquier otro, en su propio grupo — la unidad forma parte del grupo, así que
los ciclos nunca se mezclan con los m².

Si midió pero no en metros, tampoco hace falta el botón: cuente elementos y
póngalo a mano —`3` `muros`, `12` `paneles`—. Es igual de válido.

### La hora se guarda antes de preguntar nada

Al tocar **Nueva lectura** la hora queda guardada en ese instante, *antes* de
que se abra la ventanita que pregunta qué empezaron. Si alguien la cierra sin
llenarla, el tramo queda como «Sin describir» —en ámbar, para que se note— y se
puede describir después. Perder la hora sería perder el estudio; perder la
descripción no.

### Se marca lo que EMPIEZA

En el Excel la hora de la fila **cierra** el tramo: `13:00 Inicio` y
`14:30 Acomodo telescópica` quieren decir que de 13:00 a 14:30 estuvieron en el
acomodo. En la app es al revés —se toca cuando **empieza** la tarea, que es lo
que uno ve en campo—, y al exportar sale otra vez como en el Excel. Es la misma
información vista desde el otro lado.

### Todo se puede corregir

Uno se distrae, marca tres minutos tarde, o se le pasa una lectura completa. Si
eso no se pudiera arreglar, el estudio se echaría a perder y nadie volvería a
usar la app. Entonces:

- **Tocar cualquier lectura** abre su ficha: hora, descripción, tipo, personas y
  observaciones. Cambiar la hora mueve el borde entre dos tramos, nunca deja un
  hueco ni un traslape.
- **+ Agregar una lectura que se pasó** parte en dos el tramo donde caiga la
  hora. Lo que se escriba ahí es lo que *empezó* en ese momento.
- **Borrar** un tramo le suma su tiempo al tramo anterior. No se descuenta, para
  que la suma de los tramos siga dando lo que va de la primera lectura a la
  última.

La app no deja guardar una lectura anterior a la de arriba, ni un tramo que
termine antes de empezar, ni una hora que todavía no ha llegado.

### Varios estudios a la vez

Se puede tener más de un estudio abierto —dos cuadrillas trabajando en paralelo
y una sola persona caminando entre las dos—. Salen en la tira de arriba y se
salta entre ellos tocándolos.

### La cuadrilla puede cambiar durante el estudio

El número del encabezado es el de siempre, pero si a media mañana se van dos
personas se cambia **en la lectura donde cambió** y de ahí en adelante cuenta
distinto. Las horas hombre son la suma de `duración × personas` tramo por tramo,
no una multiplicación al final.

---

## Qué calcula

Igual que el Excel:

| | |
|---|---|
| **Tiempo total actividad** | De la primera lectura a la última |
| **Elementos externos** | La suma de los tramos marcados `Externo` |
| **Tiempo neto** | Total − externos |
| **Productivo Fijo** | La suma de los tramos `Fijo` |
| **Productivo Variable** | La suma de los tramos `Variable` |

Y el rendimiento, que en el Excel estaba rotulado pero sin fórmula:

| | Cómo se calcula |
|---|---|
| **h.cuadr/unidad** | `tiempo neto ÷ producción`. Es el del Excel: horas de cuadrilla por unidad, sin contar interrupciones ajenas. |
| **h.hombre/unidad** | `Σ(duración × personas) ÷ producción`, sin externos. Es el que se puede comparar entre cuadrillas de distinto tamaño. |
| **unidad/h.cuadr** | Lo mismo al revés: cuánto se produce por hora. |

Debajo, la app dice también cuánto habría dado **con las interrupciones
adentro**. La diferencia entre los dos números *es* lo que costaron las
interrupciones, y ese dato solo se ve si está al lado.

### Los tipos de elemento

Son los cuatro de la hoja `Val` del Excel, en el mismo orden:

- **N/A** — no entra en la composición del ciclo.
- **Fijo** — no depende de cuánto se produzca: montaje, aplome, acomodo.
- **Variable** — crece con la cantidad: colar, pegar, repellar.
- **Externo** — interrupción ajena a la cuadrilla.

La diferencia entre fijo y variable es lo más útil que tiene el Excel y lo que
menos se estaba usando. Con varios estudios de lo mismo, la pestaña
**Rendimientos** la convierte en algo que sirve para cotizar:

> Montaje **1:23 h** por estudio, más **0,0344 h.cuadr** por m².

Un solo promedio se queda corto en lotes chicos y sobra en los grandes; esta
forma no.

---

## La pestaña Rendimientos

Empezó siendo dos pantallas —un historial con la lista de estudios y un
rendimientos con los promedios— y terminó siendo una sola, porque enseñaban los
mismos estudios con dos caras y obligaban a saltar de una a otra. Tiene tres
partes, de arriba abajo:

**El filtro.** Buscador por proyecto, actividad o cuadrilla, y un rango de
fechas. Manda sobre todo lo de abajo, incluido el botón de **Exportar a Excel**,
que baja exactamente los estudios que estén filtrados en ese momento.

**Rendimiento por grupo.** Junta los estudios del mismo trabajo —cuadrilla,
actividad y sub-actividad, o como se escoja en el desplegable— y de cada grupo
saca el rendimiento promedio, el modelo de montaje + variable y cuánto se
separan el mejor y el peor. Es la respuesta a *«¿cuánto se tarda normalmente en
esto?»*, que es la pregunta para cotizar.

Abriendo un grupo está el detalle: **una fila por estudio, con su fecha**,
proyecto, producción, tiempo neto, personas y rendimiento. Tocando una fila se
abre ese estudio completo, con todas sus lecturas, para revisarlo o corregirlo;
y la **✕** del final de la fila lo borra, para cuando uno quedó mal tomado y no
vale la pena arreglarlo. Pregunta antes, y borra en todos los aparatos.

El promedio va **ponderado por producción**, no promedio de promedios: un
estudio de 80 m² dice más que uno de 5.

**Todavía sin rendimiento.** Los que no se pueden promediar: los que están
abiertos y los que cerraron sin anotar la producción. Aparecen solo cuando hay
alguno, con su fecha y el motivo al lado, y también se abren tocándolos o se
borran con la **✕**. Están ahí a propósito: sin esa lista un estudio que cerró
sin medir la producción no saldría en ningún grupo y no habría manera de volver
a abrirlo para terminarlo.

## Ajustes, en la tuerca de arriba

No tiene pestaña: está en el icono de tuerca de la barra, a la par del punto de
sincronización, y se sale con la **flecha de volver** que está arriba a la
izquierda —que devuelve a la pantalla desde la que se entró— o tocando la tuerca
otra vez. Son listas que se tocan de vez en cuando, no todos los días, y así el
espacio de arriba queda para lo que sí se usa en obra.

Ahí van las cuadrillas, las actividades, las sub-actividades, las unidades y los
**elementos por cuadrilla**: las tareas que se ofrecen al marcar una lectura,
amarradas a la cuadrilla para que en un estudio de formaleta no salga la lista
de pintura. Nada de esto es obligatorio — todos los campos se pueden escribir a
mano igual, y lo que se escribe queda guardado solo para la próxima vez.

Las listas también viajan a los demás aparatos: una cuadrilla agregada en la
compu queda puesta en el celular de quien anda en obra.

---

## En el celular

Es donde se va a usar, así que manda el celular:

- El botón de marcar es de **76 px de alto**: se toca con guantes y sin mirar.
- Las barras de búsqueda —proyecto, actividad, cuadrilla, unidad— abren su lista
  **hacia arriba**, porque abajo del campo está el teclado y ahí no se ve nada.
  La lista llega hasta la barra de arriba y no más; si sobran opciones se
  scrollean adentro. Al tocar un campo que quedó bajo, **la pantalla sube sola**
  para dejarle campo a la lista. En la computadora abre hacia abajo, que no hay
  teclado que tape.
- Cada toque se guarda de una. Si se bloquea el teléfono, se cierra el navegador
  o se acaba la batería, el estudio está completo hasta la última lectura.
- Sin señal funciona igual: la nube solo se usa para emparejar.

---

## Instalarla como aplicación

Chrome solo ofrece **Instalar** cuando la app viene de una dirección web:
abriendo `index.html` a mano la dirección es `file://` y no lo ofrece nunca, por
más iconos que tenga. Para eso está `Rendimientos.cmd`.

Doble clic en **Rendimientos.cmd**: levanta un servidor local, abre Chrome en
`http://localhost:8126/` y ahí sí aparece el icono de instalar en la barra de
direcciones (o *Menú → Guardar y compartir → Instalar página como aplicación*).
Queda en el menú Inicio, con su propio icono y en una ventana sin barra del
navegador.

Después se abre desde el menú Inicio como cualquier programa, **aunque el
servidor no esté andando**: `sw.js` guardó una copia de los archivos. El
servidor solo hace falta la primera vez y cuando cambien los archivos de la app;
se apaga solo a la media hora sin pedidos y escucha únicamente en `localhost`,
así que nada sale de la computadora.

Dos cosas que hay que saber:

- El puerto **8126 es solo de esta app** y no se comparte con ninguna otra. Para
  el navegador un puerto es un sitio web, y en un sitio manda un solo `sw.js`:
  el último que se instaló. El 8124 es de Reportes y el 8125 de Horas; el 8123
  quedó abandonado con caché vieja adentro justamente por haberlo compartido.
- Para el navegador `http://localhost:8126` y `file://…` son dos lugares
  distintos, así que la app instalada arranca vacía. Los estudios bajan solos de
  la nube en unos segundos; no hay que copiar nada a mano.
- Para instalarla en el celular hay que publicar la carpeta en una dirección
  `https://` (GitHub Pages, por ejemplo) y entrar ahí; en el iPhone es
  *Compartir → Añadir a inicio*.

---

## Sincronización

Los estudios se ven en todos los dispositivos: lo que se anota en el celular en
obra aparece al abrir la app en la compu, y al revés.

Va contra **el mismo proyecto de Supabase que usan las apps de reportes y de
litros**, con dos tablas nuevas: `estudios` y `rendimientos_ajustes`. No hay
proyecto nuevo, ni cuenta nueva, ni clave nueva que administrar.

### Lo único que hay que hacer una vez

Abrir el panel de Supabase → **SQL Editor** → **New query** → pegar todo el
contenido de `esquema.sql` → **Run**.

Mientras eso no se corra, la app funciona igual pero el punto de la barra sale
en rojo y dice *«Falta la tabla en Supabase»*.

### Cómo se comporta

- **Lo local manda para trabajar.** La app funciona completa sin internet, con
  lo que haya en el aparato. La sincronización solo empareja esa copia con la
  nube cuando hay señal.
- **Se sincroniza sola**, sin botón: al abrir, cada 20 segundos mientras la
  pestaña esté a la vista, después de cada cambio y cuando vuelve la conexión.
- Todo el mando es el **punto de color** de la barra de arriba. Verde es al día,
  verde parpadeando es sincronizando, rojo es que algo falló y gris es que
  todavía no ha sincronizado. **Tocándolo se fuerza una sincronización** y sale
  abajo el mensaje con cómo fue — que en el celular es además la manera de leer
  el estado, porque no hay mouse que pase por encima del punto.
- Al juntar las dos listas gana, estudio por estudio, la versión **tocada más
  recientemente**.
- **Borrar borra en todos lados.** La fila no se elimina: se marca como borrada
  con fecha nueva. Es la única forma de que un borrado se propague — si se
  eliminara, el otro aparato la volvería a subir y el estudio reaparecería.
- Las listas de Ajustes se sincronizan aparte y **gana la última edición
  completa**, no se fusionan lista por lista. Si se fusionaran no se podría
  borrar nada: lo quitado en un aparato volvería desde el otro.

### ⚠️ Sobre la seguridad

La app va **sin login**, igual que reportes y litros, y por la misma decisión
que ya se tomó allá. La clave pública de Supabase viaja dentro de `nube.js`:
cualquiera que la encuentre puede leer, cambiar y borrar los estudios.

Se acepta ese riesgo porque son datos de proceso —no datos personales ni
contraseñas—, porque cada aparato conserva su copia completa, y porque el
`.xlsx` exportado es el respaldo real. Si algún día se quiere cerrar, al final
de `esquema.sql` está anotado cómo.

La clave que empieza con `sb_secret_` **no va** en este repositorio ni en ningún
archivo de la app.

---

## El Excel que exporta

**Exportar a Excel** genera un `.xlsx` de verdad, sin librerías. Trae:

- **una hoja por estudio**, con la misma forma de la hoja «Plantilla»: los
  mismos rótulos, las mismas filas y el mismo orden, y los tiempos en
  `horas:minutos`. Van **de primero**, y el archivo abre en la primera de
  ellas: es la hoja que la gente ya conoce, así que es la que tiene que
  aparecer al abrirlo. Cada una se llama como el proyecto;
- una hoja **Resumen** con una fila por estudio —fecha, encabezado, tiempos,
  rendimientos, horas hombre— con filtro puesto y la primera fila inmovilizada,
  para tabla dinámica. Va **al final**, y solo aparece cuando se exporta más de
  un estudio: con uno solo sería una tabla de una fila.

Los colores son los del Excel original, calcados: **gris `#D9D9D9`** en los
rótulos de la izquierda, en la fila de títulos y en las barras de sección, y
**blanco** en todo lo demás. El verde institucional se quedó en la app y no
entra en el archivo; en el Excel de referencia no existía —lo que se veía verde
en la captura era el resaltado que Excel le pone al rango que tiene
seleccionado, no un relleno—.

La única celda con color propio es la del **rendimiento**, en verde muy suave.
Esa celda en el original estaba vacía —el rótulo estaba puesto pero nunca se
escribió la fórmula—, así que no hay nada que calcar, y conviene que el número
por el que se hace todo el estudio se distinga de un vistazo.

La hoja de cada estudio agrega tres filas que el original no tenía, debajo de la
barra **Rendimiento**: el rendimiento por persona, la producción por hora y —en
el pie, en letra chica— de qué estudio y de qué fecha salió el archivo. El resto
está celda por celda donde estaba.

Ese archivo es el respaldo de verdad. Conviene bajarlo cada cierto tiempo.

---

## Estructura

```
index.html             Las cuatro pantallas.
styles.css             Estilos. Verde institucional sobre blanco, móvil primero.
app.js                 Estudios, cronómetro, tramos, cálculos, las cuatro vistas
                       y el desplegable que abre hacia arriba.
nube.js                Sincronización con Supabase. Acá está la clave pública.
excel.js               El .xlsx armado a mano: el zip, los estilos y las hojas.
sw.js                  Service worker: instalarla y abrirla sin señal.
                       Lleva el número de versión del caché.
manifest.webmanifest   Nombre, colores e iconos de la app instalada.
esquema.sql            Las dos tablas. Se corre una vez en el panel de Supabase,
                       en el mismo proyecto que reportes y litros.
Rendimientos.cmd       Abre la app en el navegador (arranca el servidor local).
servidor-local.ps1     El servidor local; es lo que permite instalarla.
icono-*.png            El cronómetro verde.
README.md              Este archivo.
```

---

## ⚠️ Al cambiar un archivo: subir también la versión del caché

Los archivos quedan guardados en el aparato. Si se sube un `app.js` nuevo sin
avisarle al service worker, quien ya tenga la app instalada puede seguir días
con la versión anterior.

**Cada vez que se cambie cualquier archivo de la app, hay que subirle uno al
número de `sw.js`:**

```js
const CACHE = 'rendimientos-v1';   →   const CACHE = 'rendimientos-v2';
```

Si se olvida, el arreglo es el de siempre: Ctrl+F5.
