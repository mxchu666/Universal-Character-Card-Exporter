# Universal Character Card Exporter

[English](README.md) · **Español** · [日本語](README.ja.md) · [Italiano](README.it.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

Una extensión de navegador que lee un personaje de **JanitorAI**, **Emochi**, **Polybuzz**, **Character.ai**, **Crushon.ai**, **Saucepan.ai**, **Chub.ai**, **Venus.chub.ai** o **WyvernChat** y lo guarda como una tarjeta de personaje portable, para que puedas hacer una copia de seguridad o llevarlo a otro frontend. Sin cuenta, sin compilación, sin servidor. Se ejecuta en tu propio navegador, con tu propia sesión.

**Nuevo en 0.12.0:** lectores de Chub.ai, Venus.chub.ai y WyvernChat, la definición de JanitorAI recuperada del propio almacén de hidratación de la página (codificado dos veces), **Save chat** de Character.ai (JSONL de Tavern, JSON, Markdown, diálogo de ejemplo y un archivo de pares para Oobabooga) y todos los campos V2/V3 de la tarjeta, incluidas las opciones de las entradas de `character_book`. La ruta del PNG se reconstruyó y se volvió a analizar en un navegador real: `chara` + `ccv3`, ambos antes de `IDAT`, retrato intacto. Todo el detalle está en el [changelog](CHANGELOG.md) y en el [devlog](#devlog).

> Gratis y de código abierto. Si te resulta útil y quieres apoyar el trabajo original, pásate por [inkwell.rip](https://inkwell.rip). Eso es lo que mantiene vivos este tipo de herramientas.

---

## Crédito al autor original

Este proyecto es un **fork** de **[Character Card Extractor / JAI Card Extractor](https://github.com/erpocalypse/jai-card-extractor)** de **[erpocalypse](https://github.com/erpocalypse)**. La extensión original, el lector de JanitorAI, el panel, el flujo de exportación y todo el trabajo sobre el formato de tarjetas vienen de ahí.

**Si usas, bifurcas, redistribuyes o construyes sobre esto, debes dar crédito al creador original y enlazar a [github.com/erpocalypse/jai-card-extractor](https://github.com/erpocalypse/jai-card-extractor).** Es una condición de este fork, no una petición.

Este fork lo mantiene **[mxchu666](https://github.com/mxchu666)**. Añade soporte para Emochi y Polybuzz, el flujo unificado de tarjetas y la documentación que estás leyendo.

**La exportación de chats de Character.ai sigue a [CAI Tools](https://github.com/irsat000/CAI-Tools)** de **[İrşat (irsat000)](https://github.com/irsat000)**, la extensión que estableció la forma práctica de guardar chats de Character.ai. CAI Tools se usó como referencia de funciones y endpoints; no se copió código. Su página de chat sustituta, los gestores de fondo/fuente/memoria, la biblioteca y la búsqueda de personajes no forman parte de un exportador, así que no se reproducen aquí.

**Cómo se hizo este fork.** El código se escribió con **OpenCode** ejecutando **DeepSeek v4.1-flash:free**. Todos los prompts que le di al agente los escribí en español y los traduje yo mismo al inglés a mano, uno por uno, antes de usarlos. Los hallazgos, las pruebas y las notas de API de la sección para desarrolladores son el resultado de ese trabajo, verificados contra los sitios en vivo.

---

## Qué exporta

| Formato | Archivo | Lo leen |
|---|---|---|
| Tarjeta SillyTavern | `.card.json` | SillyTavern, Tavo, Agnai, RisuAI, Inkwell, Chub — los lectores V2/V3 leen `data`; los importadores antiguos leen los campos planos V1 del mismo archivo |
| Tarjeta SillyTavern en PNG | `.png` | SillyTavern, Tavo, Chub, RisuAI, Agnai. El único contenedor que lleva el retrato *y* la tarjeta en un solo archivo |
| Lorebook / World Info | `.lorebook.json` | SillyTavern, Tavo |
| Chat de Character.ai | `.chat.jsonl`, `.chat.json`, `.chat.md`, `.chat.txt`, `.chat.ooba.json` | SillyTavern (JSONL), text-generation-webui (Ooba), cualquier lector de texto (Markdown y diálogo de ejemplo) |
| JSON de JanitorAI | `.jai.json` | Lo más cercano al registro original |
| Texto plano | `.txt` | Cualquier cosa que lea texto — la única vía hacia plataformas sin importador de tarjetas (Character.ai, Crushon, Polybuzz, Emochi) |

Los archivos de chat solo se ofrecen en una página de chat de Character.ai, porque es el único sitio cuyo historial lee esta extensión. **Save chat** descarga los cinco a la vez; no hay que elegir un formato en la página.

Cuando el destino acepta una tarjeta, envía el PNG. Una tarjeta JSON no tiene campo de imagen en ninguna versión de la especificación; un PNG sí.

Todo ocurre en local. No se sube nada, no hay analítica y no se carga código externo.

---

## Cómo funciona la herramienta

La extensión son cuatro piezas pequeñas con una tarea cada una, y una sola regla que lo sostiene todo: **todos los lectores de sitio producen el mismo objeto de tarjeta**.

```
página del sitio
   │
   ├─ src/scraper.js    lee JanitorAI
   ├─ src/emochi.js     lee Emochi (páginas de personaje y el Lab)
   ├─ src/polybuzz.js   lee Polybuzz
   ├─ src/cai.js        lee Character.ai + exporta chats
   ├─ src/crushon.js    lee Crushon.ai
   ├─ src/saucepan.js   lee Saucepan.ai
   ├─ src/chub.js       lee Chub.ai + Venus.chub.ai
   ├─ src/wyvern.js     lee WyvernChat
   │       ▲
   │       └─ src/intercept.js + src/harvest.js
   │          (sitios que solo entregan el registro a su propio cliente)
           │
           ▼
     un objeto de tarjeta
     { name, creator, avatarUrl, gender, tags,
       fields: { description, personality, scenario,
                 greeting, altGreetings, exampleDialogue },
       creatorNotes, systemPrompt, postHistoryInstructions,
       extensions, lorebooks[], scriptRefs[] }
           │
           ├─ src/exporters.js  ──▶ .card.json / .png / .lorebook.json / .jai.json / .txt
           └─ src/panel.js      ──▶ la interfaz en la página: lista de bloques, casillas, botones
```

1. **Leer.** El lector del sitio en el que estás reúne el personaje. Cada uno lo hace distinto, porque cada sitio expone una superficie distinta: JanitorAI tiene una API JSON interna más un almacén de hidratación en la página, Emochi tiene un backend Next.js con un prompt compilado, Polybuzz tiene una carga Nuxt renderizada en servidor más una API REST, Chub y Wyvern publican registros con forma de Tavern desde sus propias API, y Character.ai y Crushon.ai solo entregan el registro a su propia página — para esos dos la extensión olfatea lo que la página ya descargó en vez de pedirlo.
2. **Normalizar.** El registro crudo se aplana en el objeto de tarjeta de arriba. Aquí se traducen los nombres de campo de cada sitio: `sceneBrief` de Polybuzz pasa a `description`, `speechText` a `greeting`, `templateIntro` a `scenario`. No se inventa nada. Si un campo no se publica, queda vacío.
3. **Mostrar.** El panel lista cada bloque encontrado con una casilla y una vista previa, para que puedas quitar una línea de jailbreak o un prompt de sistema que venía incluido. El contador de arriba (`x/y kept`) dice exactamente qué se va a escribir.
4. **Exportar.** `toBlocks()` convierte los bloques marcados al formato elegido. El exportador es agnóstico al sitio: nunca ha oído hablar de Emochi ni de Polybuzz, solo conoce el objeto de tarjeta. Por eso cada sitio obtiene los cinco formatos gratis.
5. **Guardar.** Se crea un Blob y se pulsa mediante un `<a download>`. Nada cruza la red.

Hay una protección deliberada en `toBlocks()`: si un bloque de Personalidad acaba siendo idéntico carácter por carácter al bloque de Descripción, se descarta en silencio. Esa situación casi siempre es un servidor repitiendo un campo en otro, no un creador escribiendo el mismo párrafo dos veces.

### Por qué una extensión y no un sitio web

Todos estos sitios protegen al menos parte de sus datos detrás de una sesión iniciada. Una aplicación web necesitaría tus cookies; una extensión puede tomar prestada la sesión que el navegador ya tiene, sin ver nunca tu contraseña. Eso es toda la razón por la que la herramienta vive donde vive.

---

## Instalarlo (unos dos minutos)

No necesitas saber programar. No hay nada que compilar.

1. **Descarga el proyecto.** Pulsa el botón verde **Code** en la página de GitHub y luego **Download ZIP**. Descomprímelo en un sitio permanente, como el Escritorio.
2. **Abre la página de extensiones.** Chrome: escribe `chrome://extensions`. Edge: `edge://extensions`.
3. **Activa el modo de desarrollador** (interruptor arriba a la derecha).
4. Pulsa **Load unpacked** / **Cargar descomprimida** y elige la carpeta que contiene `manifest.json`.

> Si mueves o borras esa carpeta, la extensión deja de funcionar. Guárdala en un sitio permanente.

---

## Usarla

### JanitorAI

1. Abre un personaje en [janitorai.com](https://janitorai.com) con la sesión iniciada.
2. Pulsa **Extract card** en la esquina inferior derecha.
3. **Quick scan** lee el personaje. **Deep scan** además recorre todos los lorebooks asociados: más lento, más completo.
4. Desmarca lo que no quieras. **Select all** / **Select none** están para eso.
5. Elige un formato de exportación.

Si un personaje tiene más de un lorebook, aparece un botón **Separate books** después del escaneo profundo, para que un libro de mundo compartido se guarde como archivo reutilizable.

### Emochi

1. Abre un personaje en [emochi.com](https://emochi.com) (`emochi.com/character/...`).
2. **Quick scan** lee la carga pública: nombre, lema/descripción, mensaje de bienvenida, etiquetas, avatar, creador.
3. **Deep scan** además pide la definición del creador: personalidad, escenario, conversaciones de ejemplo. Esa ruta solo responde para personajes de **tu propia cuenta**; inicia sesión primero.

Algunos personajes de Emochi realmente no tienen texto de personalidad ni de escenario guardado en ningún sitio, porque el sitio los maneja desde etiquetas y genera la persona en el chat. Eso es una propiedad del personaje, no una lectura fallida.

### Polybuzz

1. Abre un personaje en [polybuzz.ai](https://polybuzz.ai) (`polybuzz.ai/es/character/chat/...`).
2. Pulsa **Extract card** → **Quick scan**.
3. Exporta.

Una tarjeta de Polybuzz sale con lo que el sitio publica:

| Campo de la tarjeta | Origen en Polybuzz |
|---|---|
| Description | `sceneBrief` — la introducción corta |
| Greeting | `speechText` — el mensaje de apertura |
| Scenario | `templateIntro` cuando el bot es de plantilla; si no, la dirección escénica que el creador escribió al principio del saludo |
| Personality | las etiquetas de **Personalidad** del propio creador (`Frío`, `Celoso`, `Tsundere`…), más el estilo de diálogo cuando se publica |
| Gender | `sceneGender`, como línea `Gender: Male/Female/Non-binary` en la descripción |
| Etiquetas, avatar, nombre, creador | el registro de la escena |

### Character.ai

1. Abre un personaje en [character.ai](https://character.ai) con la sesión iniciada (`character.ai/character/...`).
2. Deja que la página termine de cargar y pulsa **Extract card** → **Quick scan**.
3. Exporta.

| Campo de la tarjeta | Origen en Character.ai |
|---|---|
| Nombre, creador, avatar | el registro del personaje |
| Description | `title` (el lema) seguido de `description` (el texto de «Acerca de») |
| Greeting | `greeting` |
| Diálogo de ejemplo | `definition` — la definición de texto libre del creador, cuando es pública |

**Sobre la definición.** Character.ai esconde la definición de un personaje detrás de un segundo interruptor del creador llamado **Definition Visibility**, separado de la visibilidad del personaje. Cuando está apagado, el sitio no envía el texto a nadie, así que el bloque de diálogo de ejemplo sale vacío y el panel lo dice en una nota al pie. El resto de campos está ahí igualmente.

El lector funciona observando las peticiones de la propia página: un script pequeño en el mundo de la página (`src/intercept.js`) copia la cabecera `Authorization` a una etiqueta oculta y reemite cada respuesta JSON como un evento del DOM, que el lector recoge. Nunca modifica una petición ni manda una propia con tu token. Cuando la página todavía no ha hecho la llamada, el lector pregunta en este orden: el contexto de la propia página con la cabecera capturada y sus cookies, la misma llamada a través del service worker con cookies, las cargas y los datos que el servidor renderizó, y por último la página del personaje descargada como HTML con el registro recortado del flujo. La cabecera se usa tal como la envió la página: el sitio ha usado `Token` y `Bearer`, y reconstruir el esquema produce un 401.

**Desde 0.11.2** ese rastro dice qué devolvió cada etapa en vez de `no answer`. Un 200 no cuenta como nada salvo que lleve un registro de personaje, así que la línea ahora puede leerse `200, no character in body (status,error)` o `200, html page instead of json` — las dos formas que producen un interstitial de Cloudflare y un endpoint movido. Un contexto de extensión muerto dice `runtime: extension reloaded - reload this tab`, el único fallo que no tiene nada que ver con Character.ai.

#### Save chat (la ruta de exportación de CAI Tools)

Abre un chat (`character.ai/chat/...`), deja que cargue y pulsa **Save chat**. El botón solo aparece en una página de chat. Descarga cinco archivos:

| Archivo | Qué es | Dónde va |
|---|---|---|
| `<nombre>.chat.jsonl` | Chat de Tavern: primero una línea de metadatos, luego `{name, is_user, is_system, is_name, send_date, mes}` por mensaje | SillyTavern → importar **Chat history** |
| `<nombre>.chat.json` | La misma conversación más `chat_id`, personaje, origen y fecha de exportación | Archivo, o tus propios scripts |
| `<nombre>.chat.md` | Una transcripción legible con un encabezado por interlocutor | Lectura, compartir, imprimir |
| `<nombre>.chat.txt` | `<START>` seguido de líneas `{{user}}:` / `{{char}}:` | El bloque de diálogo de ejemplo de una tarjeta |
| `<nombre>.chat.ooba.json` | Pares `{internal, visible, data, data_visible}`, empezando en el primer turno del usuario | text-generation-webui |

El endpoint de turnos devuelve lo más reciente primero y pagina con `meta.next_token`. El lector lo recorre hasta el final, toma la respuesta indicada por `primary_candidate_id` — la que estaba realmente en pantalla — y ordena de más antiguo a más nuevo. Si un chat es largo, la línea de estado cuenta los turnos mientras pagina.

**Qué hace CAI Tools que esto no hace.** CAI Tools también sustituye la interfaz de chat de Character.ai, gestiona fondos, fuentes, pines de memoria, avatares y un sistema de tarjetas/biblioteca/búsqueda, y renderiza registros de chat en PDF con jsPDF. Son funciones de interfaz o dependen de bibliotecas empaquetadas, así que quedan fuera de un exportador que debe seguir sin dependencias. La mitad relevante para exportar — campos del personaje, saludos, avatar y descarga del chat en formatos transferibles — está portada. Markdown se imprime a PDF desde cualquier navegador si necesitas un PDF.

### Crushon.ai

1. Abre un personaje en [crushon.ai](https://crushon.ai) (`crushon.ai/character/...`).
2. Deja que la página termine de cargar y pulsa **Extract card** → **Quick scan**.
3. Exporta.

Crushon se renderiza por completo en el cliente, así que el lector lee el registro que la propia página renderizó en lugar de llamar a una API. Los alias de campo cubren todas las grafías que el sitio ha usado entre versiones: `firstMessage` / `first_mes` / `greeting`, `description` / `introduction` / `intro`, `avatar` / `avatarUrl` / `image`, `mes_example` / `exampleDialogue` / `dialogue`. Si la página aún no ha pedido el personaje, recárgala y vuelve a escanear.

**Nota sobre los nombres de campo.** El importador de Crushon mapea una tarjeta Tavern invertida: la `personality` de la tarjeta se convierte en la *Introduction* de Crushon, y la `description` de la tarjeta se convierte en la *Personality* de Crushon. El lector informa lo que Crushon publica en el campo al que pertenece en la tarjeta, así que pasar por ambas herramientas deja el texto donde estaba.

### Saucepan.ai

1. Abre un companion en [saucepan.ai](https://saucepan.ai) (`saucepan.ai/companion/...`), con la sesión iniciada si quieres la definición y los lorebooks.
2. Deja que la página termine de cargar y pulsa **Extract card** → **Quick scan**. **Deep scan** añade los lorebooks.
3. Exporta.

| Campo de la tarjeta | Origen en Saucepan.ai |
|---|---|
| Nombre, creador, avatar | el registro del companion |
| Descripción | el eslogan (`short_description`) y después Perfil → **Description** |
| Personalidad | Core → **Information**, más Avanzado → **Advanced Prompt** y **Formatting Instructions** cuando el creador los rellenó |
| Saludo | la primera entrada pública de Mensajes → **Starting Messages** |
| Saludos alternativos | los demás mensajes de inicio públicos |
| Diálogo de ejemplo | Mensajes → **Example Dialogue** |
| Etiquetas | las del companion más sus fandoms |
| Lorebooks | cada lorebook adjunto, una entrada por capítulo |

**Los proxies son un campo, no una puerta.** Saucepan etiqueta cada companion con una política de proveedores — *custom and vetted*, *vetted only* o *internal only*, la última significa ningún modelo externo. Esa política aparece en la línea de nota de la tarjeta y nada más depende de ella; un companion se exporta igual permita proxies o no.

**Por qué la descripción a veces parece cifrada.** No es cifrado, es una lista de fragmentos. `GET /api/v2/companions/{id}` devuelve la Description como `{mask, version, fragments: [{key, proof, text}]}`, donde la mayoría de los fragmentos son señuelos con texto aleatorio: `"signal glance window but"`, `"simple quiet maybe almost"`. Un fragmento es real solo si su `proof` coincide con un hash FNV-1a de su propio texto, sembrado con la máscara y con `key ^ mask`; los supervivientes se ordenan por `key ^ mask` y se unen. `decodeFragments` en `src/saucepan.js` es esa rutina, y los tests la ejecutan contra fragmentos copiados de una respuesta real. Sin ella exportarías relleno.

**Companions públicos, con o sin definición abierta.** El registro público siempre lleva el nombre, el eslogan, la Description, las etiquetas, los fandoms, el retrato y la política de proveedores, así que un companion público siempre se exporta como tarjeta de personaje. La definición —Core, diálogo de ejemplo, prompt avanzado, formato— es otra ruta y otro interruptor del creador llamado **Definition Visibility**. Cuando está cerrado, Saucepan no envía el texto a nadie, la tarjeta sale con esos bloques vacíos y el panel dice qué bloques cerró el creador. Los mensajes de inicio se sirven igualmente solo cuando el escenario es público; cuando no hay ninguno, el bloque de saludo queda vacío y el panel lo dice.

**Los companions que son tuyos** se leen con `GET /api/v1/companion/editable`, que devuelve el registro crudo del editor: texto de Core, diálogo de ejemplo, prompt avanzado, instrucciones de formato y todos los escenarios de inicio sin importar su nivel de acceso. La propiedad se detecta en cada escaneo, así que tus propios bots salen completos aunque Definition Visibility esté cerrado.

### Chub.ai y Venus.chub.ai

1. Abre un personaje en [chub.ai](https://chub.ai) o [venus.chub.ai](https://venus.chub.ai) (`/characters/creador/nombre`). No hace falta iniciar sesión para una tarjeta pública, pero sí para cualquier cosa privada.
2. Pulsa **Extract card** → **Quick scan**. **Deep scan** añade el lorebook incrustado y todos los lorebooks enlazados al personaje.
3. Exporta.

Chub es el sitio más fácil de todos, porque ya guarda tarjetas Tavern. El mapeo es casi uno a uno:

| Campo de la tarjeta | Origen en Chub |
|---|---|
| Nombre, creador, avatar, etiquetas | `node.definition.name`, el primer segmento de `node.fullPath`, `definition.avatar`, `node.topics` |
| Description | `definition.description` — la caja de notas del creador |
| Personality | `definition.personality`, más `definition.tavern_personality` cuando no es un eco exacto |
| Scenario, saludo, saludos alternativos | `definition.scenario`, `definition.first_message`, `definition.alternate_greetings` |
| Diálogo de ejemplo | `definition.example_dialogs` |
| System prompt, instrucciones posteriores al historial | `definition.system_prompt`, `definition.post_history_instructions` |
| Lorebooks | `definition.embedded_lorebook` y después cada id positivo de `related_lorebooks` |

**Por qué se usa el worker.** `api.chub.ai/api/characters/...` no envía `Access-Control-Allow-Origin`, así que un fetch desde la página se rechaza aunque la API sea pública. El service worker de la extensión no está sujeto a CORS y tiene el permiso de host `api.chub.ai`, así que hace esa lectura. El endpoint de lorebooks sí envía `*`, así que allí sirve cualquiera de los dos transportes.

**Los duplicados se descartan por contenido, no por id.** Un personaje puede incrustar un libro y además listarlo como relacionado. Cada entrada se reduce a `keys + content`; un libro enlazado cuya firma sea idéntica a la del incrustado se salta. `-1` es un centinela en `related_lorebooks`, no un id de libro.

**Venus es el mismo sitio detrás de otro host.** Venus.chub.ai sirve la misma SPA, las mismas rutas y la misma API, así que un lector y un juego de permisos cubren ambos. El panel indica de qué host leyó.

### WyvernChat

1. Abre un personaje en [app.wyvern.chat](https://app.wyvern.chat) (`/profiles/creador/characters/nombre`).
2. Pulsa **Extract card** → **Quick scan**. **Deep scan** añade todos los lorebooks asociados al personaje.
3. Exporta.

| Campo de la tarjeta | Origen en WyvernChat |
|---|---|
| Nombre, creador, avatar, etiquetas | el registro del personaje; `creator.vanityUrl` y después `displayName` |
| Description | `description`, después `visual_description` cuando no está ya repetido |
| Personality, scenario, saludo | `personality`, `scenario`, `first_mes` |
| Saludos alternativos | `alternate_greetings`, más los `greetings` avanzados que no sean la entrada `default` |
| Diálogo de ejemplo | `mes_example` |
| System prompt | `pre_history_instructions` — el editor lo llama **System Prompt** |
| Instrucciones posteriores al historial | `post_history_instructions` — el editor las llama **Final Instructions** |
| Nota del personaje | `character_note`, llevada en `extensions.depth_prompt` a profundidad 4 |
| Notas del creador | `creator_notes` — la **Long Description**; puede contener HTML por diseño |
| Lorebooks | `GET /api/lorebooks/character/{id}` |

**Los slugs personalizados se resuelven desde la página.** Una URL de Wyvern puede usar el id interno (`_Ytaz4tYBerdx7zPzp14VD`) o un nombre elegido por el creador (`eveline`). La API solo resuelve el id; pedirle el nombre personalizado devuelve 404. Para un slug personalizado el lector analiza la carga de vuelo de Next.js renderizada en el servidor, toma el `id` del registro y luego llama a la API. Esa misma carga es el registro de respaldo cuando la API se niega.

**El mapeo sigue al propio exportador de Wyvern.** Su bundle contiene un escritor de tarjetas V2. Ese escritor mapea `pre_history_instructions` a `system_prompt` y `character_note` a `extensions.depth_prompt.prompt`; este lector hace lo mismo. `creator_notes` se exporta tal cual, incluso cuando un creador la ha llenado con una página de perfil HTML completa, porque eso es lo que hace la propia descarga de Wyvern.

---

## Tavo: por qué la tarjeta llegaba sin imagen

Tres fallos, cerrados en 0.11.0 y 0.11.1.

**El PNG era una tarjeta válida, pero solo en el bloque V2.** Un PNG de tarjeta guarda su JSON en bloques `tEXt` en base64: `chara` para la especificación V2 y `ccv3` para la V3. La extensión escribía solo `chara`. Tavo lee `ccv3`, no lo encuentra y responde *«No se detectaron metadatos PNG»* sobre un archivo perfectamente válido. Ahora se escriben los dos, en el mismo orden y formato que usa SillyTavern, y los tests comprueban ambos bloques y sus CRC contra `zlib.crc32`. Los bloques van entre `IHDR` e `IDAT`, donde los coloca Chub y donde los busca un lector que se detiene en el primer bloque de imagen.

**El JSON no tiene campo de imagen.** La especificación V2/V3 es solo texto, así que Tavo crea el personaje con el retrato vacío. La extensión ahora incrusta el retrato como data URI base64 de 512×512 (~40 KB) en `avatar`, `data.avatar` y `data.extensions.avatar`; si el frontend lee cualquiera de ellos, la imagen aparece sin ninguna petición de red. Cuando no se pudieron obtener los bytes, se escribe la URL pública.

**El retrato a veces salía como iniciales porque el worker no respondía.** La ruta anterior cargaba el avatar con `<img crossOrigin="anonymous">`; la 0.11.0 la sustituyó por una llamada al service worker sin respaldo. Los CDN de Emochi sí envían `Access-Control-Allow-Origin: *` cuando la petición lleva `Origin` (la medición anterior no lo llevaba), así que el problema nunca fue CORS: era el worker. Desde 0.11.2 se intenta primero el worker —la única ruta para `cdn.crushon.ai`, que exige cookie de sesión— y, si falla, la imagen se carga directamente. Si tampoco así llega, el panel lo dice con el motivo (`the extension was reloaded - reload this tab`, `http 403`, `decode failed`) en vez de dibujar el mosaico sin avisar.

Chrome desactiva la extensión una vez tras la actualización, porque el manifiesto añade permisos de host para esos CDN. Vuelve a activarla en la página de extensiones.

**Qué campo de avatar lee Tavo — respondido en 0.12.0.** El objeto de personaje documentado por Tavo expone `avatar` (una URL o ruta de imagen), y `tavo.character.import(card)` acepta tanto un envoltorio completo `{spec:"chara_card_v3",data:{…}}` como un objeto `data` pelado. Se desempaquetó el APK 1.9.0 y se buscó en su `libapp.so`: contiene `chara_card_v2`, `chara_card_v3`, `ccv3`, `creator_notes`, `mes_example`, `alternate_greetings`, `first_mes`, `character_book` y `extensions.`, pero **ningún `avatar_url`**. Así que `data.avatar` es la ranura JSON que Tavo puede leer; `data.extensions.avatar` y el `avatar` de nivel superior se escriben para otros lectores, no porque Tavo los necesite. El diálogo de importación sigue teniendo la última palabra: si tu versión de Tavo ignora un data URI ahí, importa el PNG, donde la imagen es el propio archivo.

### Si un lector sigue diciendo «sin metadatos PNG»

El panel ahora dice qué construyó. El pie muestra la versión en ejecución, y la línea de estado tras exportar un PNG lista los bloques de texto del archivo:

```
PNG guardado - chara + ccv3 - 486 KB - v0.12.0.
```

Si esa línea lista las dos claves, el archivo está bien y el lector mira en otro sitio. Si no las lista, falló la propia exportación. El tamaño está ahí para poder comparar el archivo del disco con el que acaba de construir el panel; `- mosaico de iniciales` significa que no se pudo obtener el retrato y se dibujó la placa degradada.

El archivo del informe que motivó esta sección se revisó byte a byte: un solo bloque `tEXt`, clave `chara`, antes de `IDAT`, CRC válido y ninguna clave `avatar` en su JSON. Esa es la firma de 0.10.0. El exportador 0.11.x siempre escribe dos bloques y un campo `avatar`. Así que, antes que nada:

1. **Comprueba que el pie dice `v0.12.0`.** Si dice `v0.10.x` o `v0.11.x`, el navegador ejecuta una compilación antigua.
2. **Vuelve a activar la extensión y recarga la pestaña.** Chrome desactiva una vez una extensión sin empaquetar cuando cambian sus permisos, y una pestaña ya abierta conserva el content script antiguo hasta recargarla. Exportar desde esa pestaña produce un archivo viejo con un nombre nuevo, que es exactamente lo que parece un informe de «sigue fallando».
3. **Vuelve a exportar.** Los archivos que ya están en disco conservan sus bytes antiguos. Descarga el PNG otra vez después de recargar.

Para comprobar un archivo directamente, su primer bloque de texto debe decodificar a un objeto JSON con `"spec": "chara_card_v2"`, el segundo a `"chara_card_v3"`, y `data.avatar` debe existir.

### El retrato a menudo era el mosaico de iniciales, no el personaje

El retrato es la única parte de una exportación que depende del service worker de la extensión, así que es la parte que falla cuando el worker no está disponible. Medidos con y sin cabecera `Origin`, los hosts de retratos se comportan así:

| Sitio | Host del retrato | `Access-Control-Allow-Origin` |
|---|---|---|
| Emochi | `image-cdn.flowgpt.com`, `cdn.mokio.ai` | `*` cuando la petición lleva `Origin` |
| Polybuzz | `cdn.polyspeak.ai` | `*` |
| Character.ai | `characterai.io` | `*` |
| JanitorAI | `ella.janitorai.com` | `*` |
| Crushon.ai | `cdn.crushon.ai` | ausente; 403 sin la cookie de sesión |
| Saucepan.ai | `saucepan.ai/cdn/<id>/card` | no hace falta, mismo origen |

La nota de 0.11.0 en este archivo afirmaba que los hosts de Emochi no envían cabecera CORS. Esa sonda no mandaba `Origin`, y estos CDN reflejan la cabecera que reciben. Con un navegador delante, `image-cdn.flowgpt.com` y `cdn.mokio.ai` responden `Access-Control-Allow-Origin: *`, y una carga de imagen con `crossOrigin="anonymous"` funciona — verificado en un Chromium real, no leyendo cabeceras.

Así que el mosaico de iniciales nunca fue un problema de CORS. Era el worker: `chrome.runtime.sendMessage` no devuelve nada cuando la extensión se recargó con la pestaña abierta, cuando no se concedió el permiso de host o cuando el service worker agotó el tiempo. El exportador lo llamaba fallo y dibujaba la placa, sin forma de saber cuál de las tres cosas había pasado.

0.11.2 cambia tres cosas:

- **Un segundo transporte.** Se prueba primero el worker (es la única ruta para `cdn.crushon.ai`, que necesita la cookie de sesión) y luego se carga el retrato como imagen cross-origin. Emochi, Polybuzz, Character.ai y JanitorAI ya obtienen su foto incluso con el worker muerto.
- **Sin pestillo permanente.** Una tarjeta que falló el retrato se reintenta en la siguiente exportación en vez de recordar el fallo durante toda la vida de la pestaña.
- **Un motivo en pantalla.** La línea de estado termina en `- mosaico de iniciales (<motivo>)`: `the extension was reloaded - reload this tab`, `http 403`, `decode failed: …` o `the record has no portrait URL`. Un contexto de extensión muerto se nombra como tal en vez de parecer un CDN roto.

Como el manifiesto nombra esos hosts de retratos, Chrome desactiva la extensión una vez tras la actualización hasta que la vuelvas a activar en la página de extensiones.

---

## Polybuzz: la información de antecedentes no se puede recuperar. Por esto.

La guía de creación de Polybuzz enumera siete cosas de las que se compone un personaje: nombre, género, introducción corta, saludo, etiquetas, **antecedentes** y **estilo de diálogo** (más el diálogo de ejemplo que enseña el estilo). Una página pública publica cinco. Las otras dos — `systemRole` (los antecedentes, etiquetados *Antecedentes*) y `conversationExample` (los diálogos de ejemplo) — **no se envían a nadie excepto al creador de ese personaje**. Esto no es un endpoint que falte ni algo que esta extensión o cualquier otra pueda sortear, porque **los datos se ensamblan en el servidor y nunca se serializan hacia alguien que no sea el propietario**.

La evidencia, en corto:

- El propio formulario de creación muestra el campo como `Antecedentes (Visto en privado)`. Es una nota solo para el creador, por diseño.
- Se llamó a todas las rutas de API de solo lectura que conoce el cliente web contra bots públicos con una sesión de invitado nueva. La única que contiene la clave es `scene/detailguest`, y devuelve `""`.
- La ruta del propietario `scene/getscenedetail` responde `210002` para un bot que tu cuenta no posee. Ese código es definitivo: el servidor rechaza el registro.
- En los 225 chunks de JavaScript cargados de forma diferida, `systemRole` y `conversationExample` aparecen en **un** archivo: la página de creación. Ninguna otra página los pide, así que ninguna otra página puede mostrarlos.
- Un experimento controlado lo zanja: un bot creado con el marcador `ZZZ-123` en sus Antecedentes, escaneado después desde una segunda cuenta, nunca mostró el marcador. El valor no sale de la sesión del creador.
- Pedirle al modelo que recite sus propias instrucciones tampoco funciona. El pipeline del chat construye el prompt de sistema en el servidor y el stream solo lleva trozos de texto. La vez que se le pidió a un bot su propia biografía, se inventó una infancia que no tenía: la paráfrasis no es el texto guardado, y esta extensión no va a hacer pasar una generación por una recuperación.

**Lo que hace la extensión en su lugar:** usa los campos que Polybuzz sí publica, y lo dice en una nota al pie debajo de la lista de bloques. La personalidad sale de las etiquetas que eligió el creador; el escenario sale de la dirección de apertura del propio saludo, literal; no se parafrasea nada y no se inventa nada.

Si el personaje es tuyo, las tres rutas autenticadas se siguen preguntando en cada escaneo, y tus propios bots vuelven completos.

---

## Cómo se construyó este fork, de principio a fin

Un registro breve, porque la forma del proceso explica por qué los límites anteriores son fiables.

1. **Empezar con la herramienta original.** La extensión original ya leía JanitorAI. Se convirtió en la base, y la regla para todo lo demás fue: nunca cambiar el comportamiento heredado, solo añadir al lado.
2. **Añadir un lector, no un caso especial.** Emochi se añadió como `src/emochi.js` llenando el mismo objeto de tarjeta, así que `exporters.js` y `panel.js` no necesitaron ningún cambio.
3. **Encontrar la carga real.** Emochi es una app Next.js sobre el backend de FlowGPT; los datos útiles están en una cadena `initPrompt` compilada dentro del objeto público del prompt. Esa cadena se vuelve a parsear en personalidad, antecedentes, escenario y diálogo de ejemplo.
4. **Medir, no suponer.** La afirmación de que Emochi publica una definición para cerca de un tercio de los personajes salió de muestrear tres listas en vivo independientes (30, 19 y 9 personajes) y contarlos. Es un flag de publicación (`visibility: true`), no una puerta de inicio de sesión.
5. **Añadir Polybuzz igual.** Nuxt renderiza el personaje en el servidor dentro de la página, así que la carga está en el DOM como un array devalue. Ese array se expande y se busca dentro. Un content script no puede ver `window.__NUXT__`, así que se usa la etiqueta `<script id="__NUXT_DATA__">`.
6. **Enumerar la API, no adivinarla.** El bundle de JavaScript del sitio declara 214 configuraciones de petición. Se llamó a todas las de solo lectura contra bots públicos. Así se llegó a la conclusión de que los antecedentes son inalcanzables: no fallando una vez, sino agotando la superficie.
7. **Demostrar el negativo con un control.** El experimento `ZZZ-123`, hecho en dos cuentas, es lo que convirtió "no lo encontramos" en "no está ahí para encontrarlo".
8. **Mantener el panel en silencio.** Un campo privado del creador que falta es el caso normal, no un error. El panel muestra una nota al pie, no un aviso. Solo un fallo real (sin sesión, ninguna ruta respondió) recibe un mensaje.
9. **Probar todo lo que se puede probar.** `node --test` cubre los lectores, el normalizador, los exportadores y el constructor de bloques. 137 tests en el momento de escribir esto. Cada afirmación sobre la API en este README se verificó contra el sitio en vivo, y las que no se pudieron verificar están marcadas como tales.
10. **Escribirlo.** La sección para desarrolladores existe para que la siguiente persona no tenga que volver a deducirlo.
11. **Reutilizar antes de escribir.** Character.ai y Crushon.ai solo entregan el registro a su propio JavaScript, así que un solo mecanismo cubre a los dos: un sniffer en el mundo de la página y un recorrido con puntuación sobre las cargas. Un archivo nuevo para cada uno, más dos compartidos, y los exportadores no se tocaron.
12. **Acreditar el origen de un enfoque.** El patrón de intercepción viene del [exportador de taquanta](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), y el crédito está arriba del archivo y en este README, no solo en un mensaje de commit.
13. **Decir lo que no está verificado.** Los dos sitios nuevos responden `403` de Cloudflare a una máquina sin navegador, así que los contratos están documentados y la lectura en vivo no. Eso está escrito en tres sitios en lugar de disimularse.
14. **Leer el exportador del propio sitio cuando lo tiene.** Wyvern incluye un escritor de tarjetas V2 en su bundle. Extraerlo zanjó `pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt` y `creator_notes` como Long Description. Un mapeo copiado del código del propio producto vale más que uno inferido de la interfaz.
15. **No suponer que la API es todo el registro.** JanitorAI escribe el mismo personaje en la página como `window.mbxM.push(JSON.parse("…"))`, una cadena JSON dentro de un documento JSON. La API decía que la definición era null; la página llevaba el registro. Analizar el script de hidratación fue la diferencia entre un resumen y una tarjeta.
16. **Portar funciones, no código.** CAI Tools definió los formatos prácticos de chat; el lector los escribe con su propio código, mantiene la regla de cero dependencias y dice qué funciones de CAI Tools son de interfaz y por tanto quedan fuera de alcance.

**Esta herramienta está en desarrollo activo y seguirá recibiendo actualizaciones.** Se añaden sitios, se arreglan lectores rotos y las notas de API se corrigen cuando un sitio cambia. Si algo se rompe, normalmente es porque un sitio cambió la forma de su carga, y eso tiene arreglo.

---

## Devlog

El registro de cómo se llegó realmente a cada versión: qué se intentó, qué falló y qué enseñó el fallo. Lo más reciente primero. La versión corta está en el [changelog](CHANGELOG.md); esta es la larga.

### 0.12.0 — tres sitios, un almacén de hidratación y la mitad exportadora de CAI Tools

**Chub fue el primer sitio que no necesitó un traductor.** Su API de personajes devuelve un objeto `definition` cuyas claves ya son las de Tavern: `description`, `personality`, `scenario`, `first_message`, `alternate_greetings`, `example_dialogs`, `system_prompt`, `post_history_instructions`, `tavern_personality`, `embedded_lorebook`. El trabajo no era mapear campos; era encontrar el transporte. El endpoint de personajes no envía `Access-Control-Allow-Origin`, así que un fetch desde la página muere aunque la API sea pública. El worker ya existía para Emochi y Polybuzz, así que la lectura se movió allí con un permiso de host para `api.chub.ai`. Los lorebooks fueron la segunda pregunta: `related_lorebooks` lleva ids, `-1` es un centinela, y un libro puede estar incrustado y enlazado a la vez. Reducir cada libro a una firma de `keys + content` y descartar repetidos exactos bastó; no se confió en ninguna lista de ids.

**Wyvern parecía un problema de slug personalizado y resultó ser un problema de carga.** `/api/characters/{id}` está limpio, pero las URLs del sitio usan un slug elegido por el creador, y `eveline` no es un id. La API da 404 con el nombre. La página, sin embargo, renderiza todo el registro en una carga de vuelo de Next.js. Analizar los trozos `self.__next_f.push` y emparejar llaves del registro da tanto el id como un respaldo. Después el bundle respondió a la pregunta del mapeo mejor que cualquier conjetura: Wyvern incluye su propio escritor V2, y ese escritor dice `system_prompt: e.pre_history_instructions`, `post_history_instructions: e.post_history_instructions`, `creator_notes: e.creator_notes` y `depth_prompt.prompt: e.character_note`. Leyéndolo se cazaron dos errores de 0.12.0: el primer lector perdía el System Prompt de 935 caracteres porque miraba `system_prompt`, y trataba los objetos de `greetings` avanzados como cadenas. Ambos están corregidos, y los tests usan los nombres de campo del propio sitio.

**La definición de JanitorAI no faltaba; estaba escapada.** La API sigue respondiendo `personality: null` y `showdefinition: true` a una llamada anónima, lo que parece una contradicción hasta inspeccionar la página. La app Vite hidrata sus almacenes con `window.mbxM.push(JSON.parse("{\"SJ--a:a-a--characterStore\":{…}}"))` — un literal de cadena JSON que contiene un documento JSON. El lector antiguo buscaba `{"id":…}` ya decodificado y no encontraba nada. `scriptPayloads()` ahora analiza el literal y luego el resultado, y el recorrido con puntuación encuentra el objeto del personaje dentro del almacén. Esa misma carga llevará la definición para un lector con sesión, porque es la copia que el servidor renderizó para esa sesión. El registro anónimo sigue siendo un resumen, y el panel ahora lo dice con precisión: el creador marcó la definición como pública, pero esta sesión no la recibió. Es un mensaje distinto de «el creador la ocultó», y la diferencia importa en un informe de error.

**CAI Tools se desmontó, no se copió.** Su exportador de chats define cinco formatos: legible, JSONL de Tavern, JSON de Oobabooga, texto de definición y PDF. Los cuatro primeros encajan con la regla de cero dependencias. El archivo de Tavern necesitaba su línea de metadatos y `is_name`; el de Oobabooga necesitaba fusionar pares y empezar en el primer turno del usuario. Ahora se producen ambos, junto a un archivo JSON, Markdown y el diálogo de ejemplo. El PDF se dejó fuera a propósito: usa jsPDF y avatares, y un PDF Unicode fiel sin una fuente empaquetada no es posible aquí. El Markdown se imprime a PDF desde el navegador. El resto de CAI Tools —sustitución de la página de chat, fondos, fuentes, pines de memoria, biblioteca, búsqueda— no es un exportador y no se reproduce.

**El PNG se probó en el navegador, no solo en Node.** Se leyó un registro real de JanitorAI, se le dio una entrada de lorebook, se dibujó en una placa de 512×512 con su retrato real y se escribió como PNG. Después el archivo se volvió a analizar: `IHDR, tEXt (chara), tEXt (ccv3), IDAT…`; ambos bloques base64 decodificaron a JSON V2/V3 válido con la entrada del libro; el transporte del retrato informó `cors`, no el mosaico de iniciales. Es la prueba de extremo a extremo que los tests unitarios no pueden dar: canvas, `btoa`, `TextEncoder`, CRC y colocación de bloques en el mismo navegador que ejecutará la extensión.

**Lo que sigue sin verificarse.** Las lecturas con sesión de JanitorAI, Character.ai y Crushon.ai siguen fuera de alcance: los hosts responden 403 de Cloudflare a la máquina donde se construyó esto, y el navegador integrado no tiene sesión de cuenta. Los contratos están documentados; la lectura con sesión no. Chub, la API de Venus, los slugs de id y personalizados de Wyvern, la lectura anónima de JanitorAI y la recuperación desde la hidratación de la página se ejercitaron contra los sitios en vivo.

### 0.11.2 — el retrato que solo existía en el panel

**Dos tarjetas se exportaron como letras grises, y el archivo decía por qué.** Los dos PNG de Alana Flores llevaban `chara` + `ccv3` en el sitio correcto, y `data.avatar` tenía la URL correcta de `image-cdn.flowgpt.com`. La tarjeta estaba bien y la imagen nunca se había descargado: `prepareAvatar()` había corrido, `requestImage()` había vuelto vacío y se dibujó el mosaico de iniciales. El panel seguía mostrando la foto porque la vista previa es un `<img>` normal y no necesita maquinaria de extensión.

**La explicación de 0.11.0 era incorrecta, y medirlo otra vez mostró por qué.** Esa versión decía que `image-cdn.flowgpt.com` y `cdn.mokio.ai` no envían `Access-Control-Allow-Origin`. La sonda que lo afirmaba no mandaba `Origin`. Manda uno —como hace todo navegador— y ambos hosts responden `Access-Control-Allow-Origin: *`. El CDN nunca fue el problema; el worker sí. Una carga `<img crossOrigin="anonymous">` del retrato funciona, y 0.11.0 había sustituido exactamente eso por una llamada al worker sin respaldo. Ambas ramas se ejercitaron después en un Chromium real: primero `avatarSource=worker`, un data URI de 99 KB y un PNG de 526 KB; después se quitó `https://*.flowgpt.com/*` del manifiesto para que el worker no llegara al CDN, y salió `avatarSource=cors` con los mismos bytes y el mismo retrato.

**Qué cambió.** El worker sigue siendo el primer transporte, porque `cdn.crushon.ai` responde 403 sin la cookie de sesión y solo el worker la lleva. La carga CORS es el respaldo. El pestillo permanente `avatarReady` desapareció, así que una tarjeta que falló una vez se reintenta en la siguiente exportación. Y la línea de estado nombra el fallo: `- mosaico de iniciales (worker unreachable: the extension was reloaded - reload this tab)` o `- mosaico de iniciales (http 403)`, en vez de parecer una decisión de diseño. El error de Character.ai del mismo informe era la misma información ausente: su rastro terminaba en `no answer` para cada paso del worker, que es como se ve un contexto de extensión perdido desde un content script. Ahora informa del error de runtime y un 200 sin nada usable dice qué forma recibió.

### 0.11.1 — el archivo era de la compilación anterior al arreglo

**El informe decía que el nuevo export seguía fallando. El archivo decía lo contrario.** Se adjuntaba un PNG fallido, así que lo primero fue analizarlo a él y no el código. Lista de bloques: `IHDR`, un `tEXt` (`chara`, 2170 bytes), `IDAT` repetido, `IEND`. CRC contra `zlib.crc32`: válido. Carga base64: la tarjeta. Pillow lo abre como 512×512 RGBA y expone el mismo bloque de texto. Nada malo salvo que tiene un bloque de texto en vez de dos y ninguna clave `avatar` en su JSON — exactamente lo que escribía 0.10.0. El exportador 0.11.0 escribe `chara` + `ccv3` y un campo `avatar`. El navegador seguía ejecutando el content script antiguo: Chrome desactiva una extensión sin empaquetar cuando cambian sus permisos, y una pestaña ya abierta conserva el script antiguo hasta recargarla. Exportar desde esa pestaña produce un archivo viejo con un nombre nuevo, que parece idéntico a «el arreglo no funcionó».

**La tarjeta de referencia se descargó y se desmontó.** Chub publica su tarjeta como `avatars.charhub.io/.../chara_card_v2.png`, y la propia guía de importación de Tavo apunta a Chub. Ese archivo: `IHDR, tEXt (chara), IDAT…, IEND`, un campo `data.avatar` y un `character_book` completo. Sin `ccv3`. El diseño de este exportador ahora coincide con él, con `ccv3` añadido después de `chara` — ambos bloques antes de `IDAT`, la posición que un lector que se detiene en el primer bloque de imagen todavía puede ver. De ahí salieron dos cambios que valen más que el arreglo: el panel imprime lo que construyó (la versión en el pie y `PNG saved - chara + ccv3 - v0.12.0.` al exportar), y el JSON escribe los campos planos V1 junto a `data`, porque los lectores anteriores a V2 nunca miran dentro de `data` —el importador de Agnai, Pygmalion, los cargadores de Gradio. Un archivo, dos generaciones.

### 0.11.0 — la tarjeta era válida, el lector quería el otro bloque

**Dos informes, un formato de archivo.** Un PNG rechazado por Tavo con *«No se detectaron metadatos PNG»*, y una importación JSON que cargaba el personaje pero dejaba el retrato vacío. Ambos se reprodujeron contra el archivo que la extensión escribe de verdad, no contra el sitio.

**El PNG era una tarjeta V2 válida.** El orden de bloques, los campos de longitud y los CRC32 se comprobaron contra `zlib.crc32` byte a byte: firma, `IHDR`, un bloque `tEXt` bajo la clave `chara` con el JSON base64, y luego los datos de imagen intactos. Nada estaba malformado. Faltaba el segundo bloque. SillyTavern escribe `chara` y `ccv3`; Tavo busca `ccv3` primero y responde que no hay metadatos en vez de usar el otro. Un bloque era toda la diferencia entre un archivo rechazado y uno aceptado. Ahora se escriben ambos, en ese orden, y el test afirma la lista completa `IHDR, tEXt, tEXt, IDAT, IEND` con cada CRC verificado por zlib.

**El JSON nunca tuvo una ranura para la imagen.** La especificación V2/V3 es solo texto. La importación JSON de Tavo siempre crea el personaje con el selector de retrato vacío, que es exactamente lo que mostraba la captura. La única forma de meter una imagen en un JSON es un data URI, así que el export ahora incrusta un JPEG de 512×512 (~40 KB) en `avatar`, `data.avatar` y `data.extensions.avatar`. Si un frontend lee cualquiera de ellos, la imagen llega sin una petición de red. Tavo está documentado como que toma la imagen del PNG o del selector, así que la respuesta honesta para esa app es: PNG para imagen y tarjeta juntas, JSON para texto.

**El avatar fallaba antes de empezar.** El código antiguo cargaba el retrato con `crossOrigin = "anonymous"`, que exige `Access-Control-Allow-Origin` en la respuesta de imagen. Sondear los cinco CDN respondió la pregunta directamente: `image-cdn.flowgpt.com` y `cdn.mokio.ai` sin cabecera, `cdn.polyspeak.ai`, `characterai.io` y `ella.janitorai.com` con `*`, `cdn.crushon.ai` con 403 sin cookie. Para Emochi la carga CORS no llegaba ni a recibir un byte, así que el export caía en silencio al mosaico de iniciales y parecía haber funcionado. Ahora el retrato pasa por `background.js` con un permiso de host por CDN, vuelve en base64 y se decodifica con `createImageBitmap`, que no necesita CORS y no puede manchar el canvas. Un fetch fallido sigue cayendo al mosaico, pero ahora un fallo significa un fetch fallido, no un modo incorrecto. Eso cuesta cinco permisos de host nuevos, así que Chrome desactiva la extensión una vez al actualizar hasta que se reactive.

### 0.10.0 — Saucepan, y la descripción que llega en pedazos

**El sitio no es lo que parece desde fuera.** `api.saucepan.ai` reinicia la conexión para cualquier cosa que no sea un navegador, lo que suele significar Cloudflare y un callejón sin salida. No lo era: la URL base propia de la app es la cadena vacía, así que cada llamada va a `https://saucepan.ai/api/...` y se proxya en el borde. Mismo origen, sin CORS, y una cabecera estática que el cliente pone en cada petición (`cf-edge-token-8af3`). Ese descubrimiento hizo legible todo el sitio sin un navegador.

**Después, el contrato de campos, desde el bundle y no desde una conjetura.** La app trae un bundle de 9,8 MB con toda la API. Declara 666 rutas de petición. El esquema de validación del editor de companions nombra cada campo que guarda el sitio — `card`, `full_description`, `short_description`, `example_dialogue`, `starting_scenarios[]`, `advanced_prompt`, `formatting_instructions`, `hidden_fields`, `external_model_policy` — y el componente de perfil nombra cada campo que renderiza. Dos formas, un producto; la diferencia entre ellas es la historia de esta versión.

**La descripción es una lista de fragmentos con señuelos.** La primera companion pública real devolvió cincuenta y cuatro fragmentos para Description, siete reales. Los señuelos son ruido gramatical generado con un pequeño banco de palabras — *signal*, *glance*, *window*, *pattern*, *gentle*, *quiet* — así que se leen como prosa a primera vista y sobreviven a una heurística ingenua de «tomar las cadenas más largas». La desambiguación está en el cliente: cada fragmento lleva un `proof`, y un fragmento es real solo cuando ese proof es igual a un hash FNV-1a del texto del propio fragmento con una semilla derivada de la máscara y de `key ^ mask`. Los reales se ordenan por `key ^ mask` y se unen. Siete fragmentos recompusieron 137 caracteres de texto limpio. La rutina es `decodeFragments`, verificada contra fragmentos copiados de la respuesta viva. Los mensajes de inicio usan la misma estructura en `starting_scenarios_fragments[].message`; un escenario privado simplemente no aparece, y un hueco vacío se guarda como el centinela `≠≠≠BLANK_SCENARIO≠≠≠`, que el lector descarta.

**Los proxies eran la pregunta, y la respuesta es `providers_profile`.** El campo es `external_model_policy` en el editor y `providers_profile` en el registro público: `custom_and_vetted`, `vetted_only`, `internal_only`. Decide qué modelo puede llamar el chat, no lo que sirve el perfil, así que se informa en la línea de nota y no se usa para nada más. Ambas políticas exportan igual. Hay dos rutas de lectura porque un companion público tiene dos interruptores de visibilidad: el registro público es anónimo y siempre lleva la Description; la definición es una segunda llamada, necesita el bearer de `localStorage["hallucination/auth_token"]` y se rechaza cuando el creador cerró Definition Visibility. Un companion propio tiene una tercera ruta, `/api/v1/companion/editable`, que devuelve el registro crudo del editor y no le importa la visibilidad. **Lo que no se verificó:** las rutas de definición y editable necesitan sesión, así que sus formas vienen del código del cliente que las consume, no de una llamada con sesión; la ruta pública, el decodificador de fragmentos, la política de proveedores y los fragmentos de escenario sí se ejercitaron contra companions vivos. 103 tests, 11 nuevos.

### 0.9.0 — dos sitios cerrados, un solo mecanismo, y un parser de Emochi con tres errores

**Emochi primero, porque era la prioridad.** Había dos informes abiertos: personalidad y escenario ausentes en algunos bots, y `characterExampleConversation` que nunca llegaba a la tarjeta.

El fallo de las conversaciones de ejemplo se resolvió en diez minutos. La ruta de definición devuelve `characterExampleConversation` como un **array de turnos**, y el lector le aplicaba `String(...)`. Un array se convierte en `"[object Object],[object Object]"` en algunos entornos y en `""` en el helper `s()` del normalizador — en ningún caso, diálogo. Ahora se parsea como turnos, y el parser acepta `{role, content}`, `{user, ai}`, `{isUser, text}` y un envoltorio `{dialogue: [...]}`, porque el grabador de Emochi usa la primera forma, los importadores de tarjetas usan la segunda, y el resto aparece en registros anteriores a un cambio de esquema.

El fallo de la personalidad tardó más y resultó ser tres fallos distintos apilados:

1. **La instrucción de cierre se trataba como un límite.** Todo prompt compilado acaba con `Do not write as {{user}} or assume {{user}}'s reaction or response.` El lector cortaba el texto ahí y descartaba toda la cola. Eso es correcto para un prompt que termina con la regla, que es lo que produce el compilador. Es incorrecto en el momento en que un creador cita la regla dentro de sus propios antecedentes o su diálogo de ejemplo, y pasa más de lo que parece: hay gente que pega la regla en su ejemplo a propósito, para enseñársela al modelo. Cada sección posterior a la cita desaparecía. El arreglo es eliminar esa frase donde aparezca y conservar el texto que la rodea.
2. **La gramática de secciones aceptaba una sola redacción exacta.** Los marcadores eran `'s personality:`, `'s background:`, `scenario of role-play:`. Un creador que escribió `Personality:` — mayúscula, sin posesivo, porque escribió su propio prompt en lugar de usar el constructor — parseaba a nada, y el prompt entero caía en la rama de «sin marcadores, trátalo como personalidad». Ahora hay un segundo conjunto de marcadores anclado a línea que tolera la deriva, y gana la pasada que reconoce más secciones. Un empate conserva la gramática estricta, así que los prompts que produjo el compilador se parsean exactamente igual que antes.
3. **La nota de sección vacía era una suposición.** El lector decía «el creador dejó la personalidad y el diálogo de ejemplo vacíos» siempre que esos campos salían en blanco, incluso cuando el parser no había reconocido la estructura — en cuyo caso estaban en blanco por culpa del parser. La nota ahora solo se dispara cuando también se reconoció la línea del nombre, es decir, cuando la estructura se entendió de verdad.

Los tres están cubiertos por tests escritos desde las formas que fallaban, no desde las que pasaban.

**Después, los diálogos de ejemplo de Polybuzz.** El ticket traía una captura del editor de *Estilo de diálogo*: las filas con avatar al lado son `{{user}}`, las filas sin avatar son `{{char}}`. Leer el bundle de la página de creación confirmó la forma — `dialogueStyleObj` es un array de pares `{user, ai}`, una entrada por intercambio, y el registro de detalle lo devuelve bajo `dialogueStyle.dialogue`. Ambos se parsean ahora a líneas de tarjeta. La cadena plana `conversationExample` es el mismo dato como `user;ai` por línea, y esa forma también se reescribe.

Una trampa: una cadena plana bajo `dialogueStyle` es la **etiqueta de estilo** (`Descriptivo, frases cortas`), no diálogo. La primera versión del parser reescribió alegremente una etiqueta de estilo como `{{char}}: Descriptivo, frases cortas` y la metió en el bloque de ejemplos. Los tests lo cazaron. Ahora las cadenas nunca se convierten en diálogo; solo los arrays y el texto `user;ai`.

**Después, Character.ai.** El enfoque está tomado del [exportador de taquanta](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), que resolvió el mismo problema: el registro solo lo pide el JavaScript de la propia página, con una cabecera `Authorization: Token <hex>` que la extensión no puede fabricar. La implementación de referencia ejecuta un script en el mundo de la página (`MAIN`), intercepta `fetch` y `XMLHttpRequest`, y guarda la cabecera en el DOM. Es la única forma de ver una cabecera que el navegador añade fuera de tu contexto.

Dos cambios sobre ella. El token va en una etiqueta meta con espacio de nombres propio en lugar de una que pueda colisionar. Y cada respuesta JSON que recibe la página se reemite como un evento del DOM que lleva una **cadena** — los objetos no sobreviven a la frontera entre un script `MAIN` y un content script aislado, pero las cadenas sí. Ese único cambio convirtió el sniffer de «captura el token y repite la llamada» en «captura el token *y* la respuesta», así que el lector sigue funcionando cuando la repetición es rechazada.

La definición es el campo interesante. Character.ai la cierra detrás de **Definition Visibility**, un segundo interruptor separado de la visibilidad del personaje, y cuando está apagado el texto no se envía a nadie. Así que una tarjeta con el bloque de diálogo de ejemplo vacío es una configuración del creador, no una lectura fallida, y el panel lo dice exactamente así en lugar de mostrar un error.

**Después, Crushon.ai.** Renderizado por completo en el cliente y detrás de un muro anti-bots. No hay API pública que repetir y las llamadas de la página llevan estado de sesión, así que el lector no llama a nada: recorre las cargas que la página ya recibió y puntúa cada objeto por cuántos nombres de campo conocidos lleva. Gana el más rico. Los alias cubren las grafías que el sitio ha usado entre versiones, porque fallar en una grafía cuesta el campo entero.

La parte compartida de ambos lectores es `src/harvest.js`: recogida de cargas, lectura del token y el recorrido con puntuación. Dos lectores nuevos, dos archivos compartidos, cero cambios en `exporters.js` o `panel.js` — la regla de que cada lector llena el mismo objeto de tarjeta es lo que lo hizo posible, y es por lo que el siguiente sitio cuesta un archivo.

**Lo que no se pudo verificar.** Los dos hosts nuevos responden `403` de Cloudflare a la máquina donde se construyó esto, así que ningún lector se ha ejercitado contra un navegador con sesión. Lo que sí se verificó: el endpoint neo está vivo y responde `{"status":"NOT_OK","error":"bad request"}` a un id sintético, que es la ruta quejándose del cuerpo y no del llamante. Los contratos de campo vienen de la implementación funcional de taquanta. Está escrito como no verificado en el changelog, en la lista de tareas y aquí, porque un lector que no se ejercitó es una afirmación distinta de uno que sí.

### 0.8.0 — el fork recibe nombre y seis idiomas

El repositorio conservaba su nombre original mientras soportaba cuatro sitios. Renombrado a **Universal Character Card Exporter**, que es lo que hace. La pestaña de Issues se habilitó al mismo tiempo, porque la sección de reporte de errores mandaba a la gente a una pestaña que no existía.

La documentación pasó a seis idiomas en una sola pasada. La referencia de API sitio por sitio se queda en inglés y lo dice al principio de la sección: es material de referencia que se queda obsoleto más rápido, y seis copias de un documento obsoleto son seis veces el mantenimiento sin ninguna ganancia. Las traducciones enlazan a ella.

La sección de Polybuzz se reescribió. Antes decía que los antecedentes «no se pueden recuperar» como conclusión. Ahora la evidencia está debajo: la etiqueta de privado por diseño en el formulario de creación, el barrido exhaustivo de rutas, el `210002` en el bot de otra persona, el experimento controlado con `ZZZ-123` en dos cuentas. Un resultado negativo afirmado no vale nada; un resultado negativo con su método adjunto vale algo.

### 0.7.13 — personalidad a partir de las etiquetas del propio creador

Polybuzz no publica antecedentes ni campo de personalidad, lo que dejaba las tarjetas con el bloque de Personality vacío. El árbol de etiquetas ya se pedía para la lista de etiquetas de la tarjeta, así que se leyó con más cuidado: cada etiqueta se archiva bajo uno de cuatro padres, y `Personalidad` contiene 41 palabras de temperamento que el creador elige a mano. Eso es la caracterización del propio creador, escrita por él, publicada por el sitio.

El cruce es honesto de una forma concreta: las etiquetas de género, origen e identidad se quedan fuera de Personality y siguen en la lista de etiquetas, y un `systemRole` real sigue teniendo prioridad sobre las etiquetas cuando existe. Medido en 10 bots en vivo: 10/10 produjeron un bloque de Personality real. Una lista de etiquetas es más fina que unos antecedentes escritos, pero son palabras del creador en lugar de una suposición.

### 0.7.10 – 0.7.12 — un eco no es un campo

Tres versiones, una idea. `getsceneconfig` con un id de escena responde con el texto de introducción compilado como respaldo. Cinco escaneos con sesión de bots que la cuenta no posee devolvieron un `systemRole` idéntico carácter por carácter a `sceneBrief`. Así es como el servidor renderiza unos antecedentes vacíos, no un segundo campo que coincide por casualidad. Un eco exacto ahora se trata como ausencia, cada ruta conserva su propia respuesta en lugar de la primera no vacía, y el panel muestra una nota al pie en lugar de un aviso, porque un campo privado del creador es el caso normal.

El escenario salió del mismo trabajo: los saludos de Polybuzz suelen abrir con una dirección escénica (`*Bangchan es tu esposo*`), que es la premisa del propio creador. Se promueve literal cuando el registro no lleva `templateIntro`. Nunca se parafrasea nada.

---

## Changelog

Historial completo de versiones, con cada arreglo y su motivo: **[CHANGELOG.md](CHANGELOG.md)**.

Versión corta:

| Versión | Qué llegó |
|---|---|
| 0.12.0 | Lectores de Chub.ai, Venus.chub.ai y WyvernChat; definición de JanitorAI recuperada del almacén de hidratación de la página; **Save chat** de Character.ai (JSONL de Tavern, JSON, Markdown, diálogo de ejemplo, Oobabooga); entradas completas de `character_book` y extensiones de tarjeta; PNG verificado en un navegador real; 137 tests |
| 0.11.2 | El retrato sobrevive a un worker caído (worker y luego carga directa), los fallos se nombran, el rastro de Character.ai dice qué devolvió cada endpoint; 111 tests |
| 0.11.1 | El panel muestra la versión en ejecución y los bloques del PNG que escribió; el JSON lleva también los campos planos V1; 107 tests |
| 0.11.0 | PNG con `chara` + `ccv3`, retratos descargados por el worker para que un CDN sin CORS deje de dar iniciales, JSON con el retrato como data URI; 106 tests |
| 0.10.0 | Lector de Saucepan.ai: decodificación de fragmentos, dos rutas de lectura, lorebooks, política de proveedores en la nota; 103 tests |
| 0.9.1 | Character.ai: esquema de autenticación preservado, escalera de lectura en carga fría, respaldo con datos de renderizado; 92 tests |
| 0.9.0 | Lectores de Character.ai y Crushon.ai, diálogos de ejemplo de Polybuzz, arreglos del parser de Emochi, Emochi Lab, 92 tests |
| 0.8.0 | Renombrado, documentación en seis idiomas, sección de crédito, reescritura de la evidencia de Polybuzz, Issues habilitado |
| 0.7.13 | Personality de Polybuzz desde las etiquetas `Personalidad` del creador |
| 0.7.12 | Scenario de Polybuzz desde la dirección escénica del saludo |
| 0.7.11 | Candidatos por ruta, para que un eco no tape unos antecedentes reales |
| 0.7.10 | Cadena de configuración con conversación, panel silencioso |
| 0.7.0 – 0.7.9 | Soporte de Polybuzz, de principio a fin |
| 0.6.0 – 0.6.1 | Lector de Emochi y escaneo profundo del historial de prompts |
| 0.5.0 y anteriores | JanitorAI, heredado de la extensión original de erpocalypse |

---

## Tareas pendientes

- [x] **Añadir soporte para Character.ai.** Hecho en 0.9.0. La definición sigue dependiendo del interruptor Definition Visibility del creador.
- [x] **Añadir soporte para Crushon.ai.** Hecho en 0.9.0, leyendo lo que la página renderiza.
- [x] **Prioridad — Emochi: algunos bots no muestran personalidad ni escenario.** Arreglado en 0.9.0. Tres causas, todas en el parser: la instrucción de cierre se trataba como límite de corte, la gramática de secciones solo aceptaba una redacción exacta, y la nota de «el creador lo dejó vacío» se disparaba con una estructura que no se había reconocido. Detalle en el [changelog](CHANGELOG.md).
- [x] **Prioridad — Emochi: no se están recuperando las conversaciones de ejemplo.** Arreglado en 0.9.0. `characterExampleConversation` llega como array de turnos y la coerción a cadena lo convertía en `""`. Ahora se parsea como turnos.
- [x] **Soporte del Emochi Lab.** Las URLs de Story, Soundstage y LiveRoom se leen contra el mismo registro de prompt, tomando el último segmento de la ruta como id. La sesión sin iniciar nunca expuso la forma real de las URLs del Lab, así que una superficie con otro tipo de registro informa de la ruta fallida en lugar de devolver media tarjeta.
- [x] **Añadir soporte para Saucepan AI.** Hecho en 0.10.0. Los companions públicos se exportan con la Description y cualquier mensaje de inicio público; la definición y los lorebooks necesitan sesión iniciada, y la definición además el interruptor Definition Visibility del creador. Las rutas de definición y editable están documentadas a partir del código del cliente que las consume, no de una llamada con sesión; si alguna te vuelve vacía, un issue con el mensaje del panel es exactamente lo que hace falta.
- [x] **Importación JSON de Tavo: confirmar qué campo de avatar lee.** Respondido en 0.12.0. El objeto de personaje de Tavo expone `avatar` (URL o ruta), su importador acepta un envoltorio CCv3 completo o un objeto `data` pelado, y su APK 1.9.0 no contiene la cadena `avatar_url`. El JSON escribe el retrato en `avatar`, `data.avatar` y `data.extensions.avatar`; el PNG sigue siendo la ruta documentada cuando la imagen debe llegar con la tarjeta.
- [x] **Soporte de WyvernChat.com.** Hecho en 0.12.0. Resuelven tanto los slugs de id como los personalizados, los lorebooks se leen en Deep scan, y el mapeo sigue al propio exportador V2 de Wyvern (`pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt`).
- [ ] **Verificar los lectores de Character.ai y Crushon.ai contra una sesión iniciada.** Los dos hosts responden `403` de Cloudflare a la máquina donde se construyó esta versión, así que los contratos están verificados pero la lectura en vivo no. Si alguno de los dos lectores falla en tu caso, un issue con el mensaje del panel es exactamente lo que hace falta.
- [x] **Soporte de Chub.ai y Venus.chub.ai.** Hecho en 0.12.0. La lectura del personaje pasa por el worker de la extensión porque el endpoint no tiene cabecera CORS; Venus sirve la misma SPA y la misma API. Deep scan lee lorebooks incrustados y enlazados y descarta los duplicados exactos.
- [x] **Metadatos PNG con la definición completa para cualquier plataforma.** Hecho y re-verificado en 0.12.0: bloques `tEXt` `chara` (V2) y `ccv3` (V3), ambos inmediatamente después de `IHDR` y antes de `IDAT`, CRC válidos, JSON completo de la tarjeta incluido `character_book`; una compilación real en Chromium produjo y volvió a analizar una tarjeta de 1,14 MB.
- [x] **Portar las funciones de exportación de CAI Tools.** Hecho en 0.12.0 para la ruta de Character.ai: mapeo de definición/saludos/categorías/avatar y exportación de chats como JSONL de Tavern, JSON, Markdown, diálogo de ejemplo y pares de Oobabooga. La sustitución de la interfaz de chat, fondos, fuentes, gestor de memoria, biblioteca, búsqueda y salida jsPDF de CAI Tools son funciones de interfaz o dependencias y quedan fuera de alcance.

Un lector que funciona a medias en un sitio soportado es peor que un sitio más que funciona del todo, y por eso los dos puntos de Emochi estuvieron por encima de añadir sitios nuevos hasta que se cerraron.

---

## Reportar errores

Usa la **[pestaña Issues](https://github.com/mxchu666/Universal-Character-Card-Exporter/issues)**. Está activada. Incluye:

- El sitio y la URL del personaje.
- Qué versión tienes — **pasa el cursor por el pie del panel de exportación y la versión aparece en el tooltip**.
- Qué esperabas y qué obtuviste. Una captura del panel es lo más útil que puedes adjuntar.
- Cualquier mensaje que mostrara el panel. El panel nombra la ruta y el código de respuesta cuando falla una consulta, y ese texto es exactamente lo que hace falta para arreglarlo.

Las peticiones de funciones son bienvenidas en el mismo sitio.

---

## ¿Está permitido?

Es una herramienta de copia de seguridad personal. Lee lo que ya puedes ver con la sesión iniciada y lo guarda en un formato abierto. No salta ningún muro de pago ni desbloquea nada que no pudieras ver de otra forma.

Los términos de los sitios pueden restringir el acceso automatizado. Úsala para tus propios personajes y copias personales, da crédito a los creadores cuando vuelvas a compartir su trabajo y no martillees los sitios.

## Privacidad

- Los datos del personaje escaneado nunca salen de tu navegador. Sin analítica, sin código externo.
- Los permisos de host se limitan a los sitios del manifiesto, sus hosts de API y sus CDN de retratos; no hay un permiso `<all_urls>`.
- Las únicas llamadas de red que hace van al sitio en el que ya estás, a la API de ese sitio y a su host de retratos.

---

## Para desarrolladores

La extensión es JavaScript puro, sin dependencias y sin paso de compilación. Edita `src/` y recarga desde la página de extensiones.

```sh
node --test
```

`src/scraper.js` lee JanitorAI, `src/emochi.js` Emochi, `src/polybuzz.js` Polybuzz, `src/cai.js` Character.ai, `src/crushon.js` Crushon.ai, `src/saucepan.js` Saucepan.ai, `src/chub.js` Chub.ai/Venus.chub.ai y `src/wyvern.js` WyvernChat. Los ocho llenan la misma forma de tarjeta, así que los exportadores y el panel nunca saben en qué sitio estás. `src/exporters.js` convierte, `src/panel.js` y `src/panel.css` son el panel en la página, `background.js` es el service worker para peticiones que un content script no puede hacer (CORS, cabeceras prohibidas).

Dos archivos existen solo para los sitios que nunca publican su registro en una API: `src/intercept.js` se ejecuta en el mundo de la propia página (`world: "MAIN"`, `document_start`) y copia al DOM lo que la página ya sabe; `src/harvest.js` recoge esas cargas y puntúa cada objeto contra una lista de nombres de campo conocidos. Añadir un tercer sitio cerrado significa un archivo que declare sus claves.

**El registro de API sitio por sitio está en el README en inglés** ([Developer reference](README.md#developer-reference-english-only)). Se mantiene en inglés a propósito: es material de referencia y la parte que más se queda obsoleta cuando un sitio cambia. Las traducciones enlazan a él.

---

## Licencia

[MIT](LICENSE).
