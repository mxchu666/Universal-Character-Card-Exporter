# Universal Character Card Exporter

[English](README.md) · [Español](README.es.md) · [日本語](README.ja.md) · **Italiano** · [Deutsch](README.de.md) · [Русский](README.ru.md)

Un'estensione per browser che legge un personaggio da **JanitorAI**, **Emochi**, **Polybuzz**, **Character.ai**, **Crushon.ai**, **Saucepan.ai**, **Chub.ai**, **Venus.chub.ai** o **WyvernChat** e lo salva come scheda personaggio portabile, così puoi farne un backup o portarlo su un altro frontend. Nessun account, nessuna compilazione, nessun server. Funziona nel tuo browser, con la tua sessione.

**Novità in 0.12.0:** lettori per Chub.ai, Venus.chub.ai e WyvernChat, la definizione di JanitorAI recuperata dal deposito di idratazione della pagina (codificato due volte), **Save chat** di Character.ai (JSONL Tavern, JSON, Markdown, dialogo di esempio e un file di coppie per Oobabooga) e tutti i campi V2/V3 della scheda, comprese le opzioni delle voci di `character_book`. Il percorso PNG è stato ricostruito e riletto in un browser reale: `chara` + `ccv3`, entrambi prima di `IDAT`, ritratto intatto. Tutti i dettagli nel [changelog](CHANGELOG.md) e nel [devlog](#devlog).

> Gratis e open source. Se ti è utile e vuoi sostenere il lavoro originale, dai un'occhiata a [inkwell.rip](https://inkwell.rip). È quello che tiene in vita strumenti come questo.

---

## Crediti

Questo progetto è un **fork** di **[Character Card Extractor / JAI Card Extractor](https://github.com/erpocalypse/jai-card-extractor)** di **[erpocalypse](https://github.com/erpocalypse)**. L'estensione originale, il lettore di JanitorAI, il pannello, la pipeline di export e tutto il lavoro sul formato delle schede vengono da lì.

**Se usi, fork, ridistribuisci o costruisci sopra questo progetto, devi attribuire il credito all'autore originale e linkare [github.com/erpocalypse/jai-card-extractor](https://github.com/erpocalypse/jai-card-extractor).** È una condizione di questo fork, non una richiesta.

Questo fork è mantenuto da **[mxchu666](https://github.com/mxchu666)**. Aggiunge il supporto per Emochi e Polybuzz, la pipeline unificata delle schede e la documentazione che stai leggendo.

**L'esportazione delle chat di Character.ai segue [CAI Tools](https://github.com/irsat000/CAI-Tools)** di **[İrşat (irsat000)](https://github.com/irsat000)**, l'estensione che ha stabilito la forma pratica del salvataggio delle chat di Character.ai. CAI Tools è stata usata come riferimento per funzioni ed endpoint; nessun codice è stato copiato. La sua pagina chat sostitutiva, i gestori di sfondo/font/memoria, la libreria e la ricerca personaggi non fanno parte di un esportatore, quindi non sono riprodotti qui.

**Come è nato questo fork.** Il codice è stato scritto con **OpenCode** che eseguiva **DeepSeek v4.1-flash:free**. Ogni prompt che ho fornito all'agente l'ho scritto in spagnolo e l'ho tradotto in inglese a mano, uno per uno, prima di usarlo. I risultati, le verifiche e le note API nella sezione per sviluppatori sono il prodotto di quel lavoro, controllati sui siti dal vivo.

---

## Cosa esporta

| Formato | File | Lo leggono |
|---|---|---|
| Scheda SillyTavern | `.card.json` | SillyTavern, Tavo, Agnai, RisuAI, Inkwell, Chub — i lettori V2/V3 leggono `data`, gli importatori più vecchi leggono i campi piatti V1 nello stesso file |
| Scheda SillyTavern in PNG | `.png` | SillyTavern, Tavo, Chub, RisuAI, Agnai. L'unico contenitore che porta il ritratto *e* la scheda in un solo file |
| Lorebook / World Info | `.lorebook.json` | SillyTavern, Tavo |
| Chat di Character.ai | `.chat.jsonl`, `.chat.json`, `.chat.md`, `.chat.txt`, `.chat.ooba.json` | SillyTavern (JSONL), text-generation-webui (Ooba), qualsiasi lettore di testo (Markdown e dialogo di esempio) |
| JSON di JanitorAI | `.jai.json` | Il più vicino al record originale |
| Testo semplice | `.txt` | Qualunque cosa legga testo — l'unica via verso piattaforme senza importatore di schede (Character.ai, Crushon, Polybuzz, Emochi) |

I file di chat sono offerti solo su una pagina di chat di Character.ai, perché è l'unico sito di cui questa estensione legge la cronologia. **Save chat** scarica tutti e cinque insieme; non devi scegliere un formato sulla pagina.

Quando la destinazione accetta una scheda, invia il PNG. Una scheda JSON non ha un campo immagine in nessuna versione della specifica; un PNG sì.

Tutto avviene in locale. Niente viene caricato, non c'è analytics e non viene caricato codice esterno.

---

## Come funziona lo strumento

L'estensione è composta da quattro piccoli pezzi con un compito ciascuno, e da una sola regola che tiene insieme tutto: **ogni lettore di sito produce lo stesso oggetto scheda**.

```
pagina del sito
   │
   ├─ src/scraper.js    legge JanitorAI
   ├─ src/emochi.js     legge Emochi (pagine personaggio e Lab)
   ├─ src/polybuzz.js   legge Polybuzz
   ├─ src/cai.js        legge Character.ai + esporta le chat
   ├─ src/crushon.js    legge Crushon.ai
   ├─ src/saucepan.js   legge Saucepan.ai
   ├─ src/chub.js       legge Chub.ai + Venus.chub.ai
   ├─ src/wyvern.js     legge WyvernChat
   │       ▲
   │       └─ src/intercept.js + src/harvest.js
   │          (siti che consegnano il record solo al proprio client)
           │
           ▼
     un oggetto scheda
     { name, creator, avatarUrl, gender, tags,
       fields: { description, personality, scenario,
                 greeting, altGreetings, exampleDialogue },
       creatorNotes, systemPrompt, postHistoryInstructions,
       extensions, lorebooks[], scriptRefs[] }
           │
           ├─ src/exporters.js  ──▶ .card.json / .png / .lorebook.json / .jai.json / .txt
           └─ src/panel.js      ──▶ l'interfaccia in pagina: elenco blocchi, caselle, pulsanti
```

1. **Leggere.** Il lettore del sito su cui ti trovi raccoglie il personaggio. Ognuno lo fa a modo suo, perché ogni sito espone una superficie diversa: JanitorAI ha un'API JSON interna più un deposito di idratazione nella pagina, Emochi ha un backend Next.js con un prompt compilato, Polybuzz ha un payload Nuxt renderizzato lato server più un'API REST, Chub e Wyvern pubblicano record in forma Tavern dalle proprie API, mentre Character.ai e Crushon.ai consegnano il record solo alla propria pagina — per questi due l'estensione annusa ciò che la pagina ha già scaricato invece di chiederlo.
2. **Normalizzare.** Il record grezzo viene appiattito nell'oggetto scheda qui sopra. Qui si traducono i nomi dei campi: `sceneBrief` di Polybuzz diventa `description`, `speechText` diventa `greeting`, `templateIntro` diventa `scenario`. Nulla viene inventato. Se un campo non è pubblicato, resta vuoto.
3. **Mostrare.** Il pannello elenca ogni blocco trovato con casella e anteprima, così puoi togliere una riga di jailbreak o un prompt di sistema finito dentro. Il contatore in alto (`x/y kept`) dice esattamente cosa verrà scritto.
4. **Esportare.** `toBlocks()` trasforma i blocchi spuntati nel formato scelto. L'esportatore è indipendente dal sito: non ha mai sentito parlare di Emochi o Polybuzz, conosce solo l'oggetto scheda. È per questo che ogni sito ottiene i cinque formati gratis.
5. **Salvare.** Si crea un Blob e lo si clicca tramite un `<a download>`. Nulla attraversa la rete.

C'è una protezione voluta in `toBlocks()`: se un blocco Personality risulta identico carattere per carattere al blocco Description, viene scartato in silenzio. Quasi sempre è un server che riversa un campo nell'altro, non un autore che scrive due volte lo stesso paragrafo.

### Perché un'estensione e non un sito web

Ognuno di questi siti mette almeno parte dei dati dietro una sessione autenticata. Un'app web avrebbe bisogno dei tuoi cookie; un'estensione può prendere in prestito la sessione che il browser ha già, senza mai vedere la tua password. È tutta qui la ragione per cui lo strumento vive dove vive.

---

## Installazione (circa due minuti)

Non serve saper programmare. Non c'è nulla da compilare.

1. **Scarica il progetto.** Clicca il pulsante verde **Code** nella pagina GitHub, poi **Download ZIP**. Estrai in un posto permanente, tipo il Desktop.
2. **Apri la pagina delle estensioni.** Chrome: `chrome://extensions`. Edge: `edge://extensions`.
3. **Attiva la modalità sviluppatore** (interruttore in alto a destra).
4. Clicca **Load unpacked** / **Carica estensione non pacchettizzata** e scegli la cartella che contiene `manifest.json`.

> Se sposti o cancelli quella cartella, l'estensione smette di funzionare. Tienila in un posto permanente.

---

## Usarla

### JanitorAI

1. Apri un personaggio su [janitorai.com](https://janitorai.com) con la sessione attiva.
2. Clicca **Extract card** in basso a destra.
3. **Quick scan** legge il personaggio. **Deep scan** percorre anche tutti i lorebook collegati: più lento, più completo.
4. Togli la spunta a ciò che non vuoi. **Select all** / **Select none** servono a questo.
5. Scegli un formato di esportazione.

Se un personaggio ha più di un lorebook, dopo la scansione profonda appare un pulsante **Separate books**, così un world book condiviso si salva come file riutilizzabile.

### Emochi

1. Apri un personaggio su [emochi.com](https://emochi.com) (`emochi.com/character/...`).
2. **Quick scan** legge il payload pubblico: nome, tagline/descrizione, messaggio di benvenuto, tag, avatar, autore.
3. **Deep scan** chiede in più la definizione dell'autore: personalità, scenario, conversazioni di esempio. Quella rotta risponde solo per i personaggi del **tuo account**; accedi prima.

Alcuni personaggi Emochi non hanno davvero testo di personalità o scenario salvato da nessuna parte, perché il sito li guida tramite tag e genera la persona al momento della chat. È una proprietà del personaggio, non una lettura fallita.

### Polybuzz

1. Apri un personaggio su [polybuzz.ai](https://polybuzz.ai) (`polybuzz.ai/es/character/chat/...`).
2. Clicca **Extract card** → **Quick scan**.
3. Esporta.

Una scheda Polybuzz esce con ciò che il sito pubblica:

| Campo della scheda | Origine in Polybuzz |
|---|---|
| Description | `sceneBrief` — l'introduzione breve |
| Greeting | `speechText` — il messaggio di apertura |
| Scenario | `templateIntro` se il bot è basato su template; altrimenti la didascalia che l'autore ha scritto in cima al saluto |
| Personality | i tag **Personalidad** scelti dall'autore (`Frío`, `Celoso`, `Tsundere`…), più lo stile di dialogo quando è pubblicato |
| Gender | `sceneGender`, come riga `Gender: Male/Female/Non-binary` nella descrizione |
| Tag, avatar, nome, autore | il record della scena |

### Character.ai

1. Apri un personaggio su [character.ai](https://character.ai) con la sessione attiva (`character.ai/character/...`).
2. Lascia che la pagina finisca di caricare, poi **Extract card** → **Quick scan**.
3. Esporta.

| Campo della scheda | Origine in Character.ai |
|---|---|
| Nome, autore, avatar | il record del personaggio |
| Description | `title` (lo slogan) seguito da `description` (il testo «About») |
| Greeting | `greeting` |
| Dialogo di esempio | `definition` — la definizione in testo libero dell'autore, quando è pubblica |

**Sulla definizione.** Character.ai nasconde la definizione di un personaggio dietro un secondo interruttore dell'autore, **Definition Visibility**, separato dalla visibilità del personaggio. Quando è spento, il sito non invia il testo a nessuno, quindi il blocco del dialogo di esempio esce vuoto e il pannello lo dice in una nota a piè di pagina. Tutti gli altri campi ci sono comunque.

Il lettore lavora osservando le richieste della pagina stessa: un piccolo script nel mondo della pagina (`src/intercept.js`) copia l'header `Authorization` in un tag nascosto e ritrasmette ogni risposta JSON come evento DOM, che il lettore raccoglie. Non modifica mai una richiesta e non ne invia una propria con il tuo token. Quando la pagina non ha ancora fatto la chiamata, il lettore chiede in quest'ordine: il contesto della pagina stessa con l'header catturato e i suoi cookie, la stessa chiamata tramite il service worker con i cookie, i payload e i dati renderizzati dal server, e infine la pagina del personaggio scaricata come HTML con il record ritagliato dallo stream. L'header viene usato così come lo ha inviato la pagina: il sito ha usato sia `Token` sia `Bearer`, e ricostruire lo schema produce un 401.

**Dalla 0.11.2** quel trail dice cosa ha restituito ogni fase invece di `no answer`. Un 200 non conta nulla se non porta un record personaggio, quindi la riga ora può leggersi `200, no character in body (status,error)` o `200, html page instead of json` — le due forme prodotte da un interstitial Cloudflare e da un endpoint spostato. Un contesto estensione morto dice `runtime: extension reloaded - reload this tab`, l'unico guasto che non ha nulla a che vedere con Character.ai.

#### Save chat (il percorso di export di CAI Tools)

Apri una chat (`character.ai/chat/...`), lasciala caricare e clicca **Save chat**. Il pulsante compare solo su una pagina di chat. Scarica cinque file:

| File | Cos'è | Dove va |
|---|---|---|
| `<nome>.chat.jsonl` | Chat Tavern: prima una riga di metadati, poi `{name, is_user, is_system, is_name, send_date, mes}` per messaggio | SillyTavern → import **Chat history** |
| `<nome>.chat.json` | La stessa conversazione più `chat_id`, personaggio, origine e data di export | Archivio, o i tuoi script |
| `<nome>.chat.md` | Una trascrizione leggibile con un'intestazione per interlocutore | Lettura, condivisione, stampa |
| `<nome>.chat.txt` | `<START>` seguito da righe `{{user}}:` / `{{char}}:` | Il blocco dialogo di esempio di una scheda |
| `<nome>.chat.ooba.json` | Coppie `{internal, visible, data, data_visible}`, a partire dal primo turno utente | text-generation-webui |

L'endpoint dei turni restituisce prima i più recenti e pagina con `meta.next_token`. Il lettore lo segue fino in fondo, prende la risposta indicata da `primary_candidate_id` — quella realmente sullo schermo — e ordina dal più vecchio. Se una chat è lunga, la riga di stato conta i turni mentre pagina.

**Cosa fa CAI Tools che questo non fa.** CAI Tools sostituisce anche l'interfaccia chat di Character.ai, gestisce sfondi, font, pin di memoria, avatar e un sistema di schede/libreria/ricerca, e renderizza log di chat in PDF con jsPDF. Sono funzioni di interfaccia o dipendono da librerie incluse, quindi restano fuori da un esportatore che deve rimanere senza dipendenze. La metà rilevante per l'export — campi del personaggio, saluti, avatar e download della chat in formati trasferibili — è portata. Markdown si stampa in PDF da qualsiasi browser se serve un PDF.

### Crushon.ai

1. Apri un personaggio su [crushon.ai](https://crushon.ai) (`crushon.ai/character/...`).
2. Lascia che la pagina finisca di caricare, poi **Extract card** → **Quick scan**.
3. Esporta.

Crushon è interamente renderizzato lato client, quindi il lettore legge il record che la pagina ha già renderizzato invece di chiamare un'API. Gli alias dei campi coprono ogni grafia che il sito ha usato tra le versioni: `firstMessage` / `first_mes` / `greeting`, `description` / `introduction` / `intro`, `avatar` / `avatarUrl` / `image`, `mes_example` / `exampleDialogue` / `dialogue`. Se la pagina non ha ancora richiesto il personaggio, ricaricala e riscansiona.

**Nota sui nomi dei campi.** L'importatore di Crushon mappa una scheda Tavern al contrario: la `personality` della scheda diventa l'*Introduction* di Crushon, e la `description` della scheda diventa la *Personality* di Crushon. Il lettore riporta ciò che Crushon pubblica nel campo che significa la stessa cosa sulla scheda, così il passaggio per entrambi gli strumenti lascia il testo dov'era.

### Saucepan.ai

1. Apri un companion su [saucepan.ai](https://saucepan.ai) (`saucepan.ai/companion/...`), con la sessione attiva se vuoi la definizione e i lorebook.
2. Lascia che la pagina finisca di caricare, poi **Extract card** → **Quick scan**. **Deep scan** aggiunge i lorebook.
3. Esporta.

| Campo della scheda | Origine in Saucepan.ai |
|---|---|
| Nome, autore, avatar | il record del companion |
| Descrizione | lo slogan (`short_description`), poi Profilo → **Description** |
| Personalità | Core → **Information**, più Avanzato → **Advanced Prompt** e **Formatting Instructions** quando l'autore li ha compilati |
| Saluto | la prima voce pubblica di Messaggi → **Starting Messages** |
| Saluti alternativi | ogni altro messaggio iniziale pubblico |
| Dialogo di esempio | Messaggi → **Example Dialogue** |
| Tag | quelli del companion più i suoi fandom |
| Lorebook | ogni lorebook collegato, una voce per capitolo |

**I proxy sono un campo, non un cancello.** Saucepan etichetta ogni companion con una politica dei provider — *custom and vetted*, *vetted only* oppure *internal only*, l'ultima significa nessun modello esterno. Quella politica compare nella riga di nota della scheda e nient'altro dipende da lei; un companion si esporta allo stesso modo che i proxy siano permessi o no.

**Perché la descrizione a volte sembra cifrata.** Non è cifratura, è una lista di frammenti. `GET /api/v2/companions/{id}` restituisce la Description come `{mask, version, fragments: [{key, proof, text}]}`, dove la maggior parte dei frammenti sono esche con testo casuale: `"signal glance window but"`, `"simple quiet maybe almost"`. Un frammento è reale solo se il suo `proof` coincide con un hash FNV-1a del suo stesso testo, con seme dato dalla maschera e da `key ^ mask`; i superstiti vengono ordinati per `key ^ mask` e uniti. `decodeFragments` in `src/saucepan.js` è quella routine, e i test la eseguono su frammenti copiati da una risposta reale. Senza, esporteresti riempitivo.

**Companion pubblici, con o senza definizione aperta.** Il record pubblico porta sempre nome, slogan, Description, tag, fandom, ritratto e politica dei provider, quindi un companion pubblico si esporta sempre come scheda personaggio. La definizione — Core, dialogo di esempio, prompt avanzato, formato — è un'altra rotta e un altro interruttore dell'autore chiamato **Definition Visibility**. Quando è chiuso, Saucepan non invia il testo a nessuno, la scheda esce con quei blocchi vuoti e il pannello dice quali blocchi ha chiuso l'autore. I messaggi iniziali vengono serviti comunque solo quando lo scenario è pubblico; quando non ce n'è nessuno, il blocco del saluto resta vuoto e il pannello lo dice.

**I companion che possiedi** si leggono con `GET /api/v1/companion/editable`, che restituisce il record grezzo dell'editor: testo di Core, dialogo di esempio, prompt avanzato, istruzioni di formato e ogni scenario iniziale a prescindere dal suo livello di accesso. La proprietà viene rilevata a ogni scansione, quindi i tuoi bot escono completi anche con Definition Visibility chiuso.

### Chub.ai e Venus.chub.ai

1. Apri un personaggio su [chub.ai](https://chub.ai) o [venus.chub.ai](https://venus.chub.ai) (`/characters/autore/nome`). Non serve accedere per una scheda pubblica, ma serve per qualsiasi cosa privata.
2. Clicca **Extract card** → **Quick scan**. **Deep scan** aggiunge il lorebook incorporato e ogni lorebook collegato al personaggio.
3. Esporta.

Chub è il sito più semplice di tutti, perché memorizza già schede Tavern. La mappatura è quasi uno a uno:

| Campo della scheda | Origine in Chub |
|---|---|
| Nome, autore, avatar, tag | `node.definition.name`, il primo segmento di `node.fullPath`, `definition.avatar`, `node.topics` |
| Description | `definition.description` — la casella delle note dell'autore |
| Personality | `definition.personality`, più `definition.tavern_personality` quando non è un'eco esatta |
| Scenario, saluto, saluti alternativi | `definition.scenario`, `definition.first_message`, `definition.alternate_greetings` |
| Dialogo di esempio | `definition.example_dialogs` |
| System prompt, istruzioni post-storia | `definition.system_prompt`, `definition.post_history_instructions` |
| Lorebook | `definition.embedded_lorebook`, poi ogni id positivo in `related_lorebooks` |

**Perché si usa il worker.** `api.chub.ai/api/characters/...` non invia `Access-Control-Allow-Origin`, quindi un fetch dal contesto della pagina viene rifiutato anche se l'API è pubblica. Il service worker dell'estensione non è soggetto a CORS e ha il permesso host `api.chub.ai`, quindi esegue quella lettura. L'endpoint dei lorebook invece invia `*`, quindi lì funziona qualsiasi trasporto.

**I duplicati si scartano per contenuto, non per id.** Un personaggio può incorporare un libro e anche elencarlo come correlato. Ogni voce viene ridotta a `keys + content`; un libro collegato la cui firma è identica a quella dell'incorporato viene saltato. `-1` è un sentinella in `related_lorebooks`, non un id di libro.

**Venus è lo stesso sito dietro un altro host.** Venus.chub.ai serve la stessa SPA, gli stessi percorsi e la stessa API, quindi un lettore e un insieme di permessi coprono entrambi. Il pannello indica da quale host ha letto.

### WyvernChat

1. Apri un personaggio su [app.wyvern.chat](https://app.wyvern.chat) (`/profiles/autore/characters/nome`).
2. Clicca **Extract card** → **Quick scan**. **Deep scan** aggiunge ogni lorebook collegato al personaggio.
3. Esporta.

| Campo della scheda | Origine in WyvernChat |
|---|---|
| Nome, autore, avatar, tag | il record del personaggio; `creator.vanityUrl`, poi `displayName` |
| Description | `description`, poi `visual_description` quando non è già ripetuto |
| Personality, scenario, saluto | `personality`, `scenario`, `first_mes` |
| Saluti alternativi | `alternate_greetings`, più i `greetings` avanzati che non sono la voce `default` |
| Dialogo di esempio | `mes_example` |
| System prompt | `pre_history_instructions` — l'editor lo chiama **System Prompt** |
| Istruzioni post-storia | `post_history_instructions` — l'editor le chiama **Final Instructions** |
| Nota del personaggio | `character_note`, trasportata in `extensions.depth_prompt` a profondità 4 |
| Note dell'autore | `creator_notes` — la **Long Description**; può contenere HTML per design |
| Lorebook | `GET /api/lorebooks/character/{id}` |

**Gli slug personalizzati si risolvono dalla pagina.** Un URL di Wyvern può usare l'id interno (`_Ytaz4tYBerdx7zPzp14VD`) o un nome scelto dall'autore (`eveline`). L'API risolve solo l'id; chiederle il nome personalizzato restituisce 404. Per uno slug personalizzato il lettore analizza il payload di volo di Next.js renderizzato dal server, prende l'`id` del record e poi chiama l'API. Lo stesso payload è il record di riserva quando l'API rifiuta.

**La mappatura segue l'esportatore di Wyvern stesso.** Il suo bundle contiene uno scrittore di schede V2. Quello scrittore mappa `pre_history_instructions` su `system_prompt` e `character_note` su `extensions.depth_prompt.prompt`; questo lettore fa lo stesso. `creator_notes` viene esportata così com'è, anche quando un autore l'ha riempita con una pagina profilo HTML completa, perché è ciò che fa il download di Wyvern stesso.

---

## Tavo: perché la scheda arrivava senza immagine

Tre guasti, chiusi in 0.11.0 e 0.11.1.

**Il PNG era una scheda valida, ma solo nel blocco V2.** Un PNG di scheda tiene il JSON in blocchi `tEXt` in base64: `chara` per la specifica V2 e `ccv3` per la V3. L'estensione scriveva solo `chara`. Tavo legge `ccv3`, non lo trova e risponde *«No se detectaron metadatos PNG»* su un file perfettamente valido. Ora vengono scritti entrambi, nello stesso ordine e formato che usa SillyTavern, e i test controllano entrambi i blocchi e i loro CRC contro `zlib.crc32`. I blocchi stanno tra `IHDR` e `IDAT`, dove li mette Chub e dove li vede un lettore che si ferma al primo blocco immagine.

**Il JSON non ha un campo immagine.** La specifica V2/V3 è solo testo, quindi Tavo crea il personaggio con il ritratto vuoto. L'estensione ora incorpora il ritratto come data URI base64 da 512×512 (~40 KB) in `avatar`, `data.avatar` e `data.extensions.avatar`; se il frontend legge uno di questi, l'immagine compare senza nessuna richiesta di rete. Se i byte non sono recuperabili, viene scritta l'URL pubblico.

**Il ritratto a volte restava sulle iniziali perché il worker non rispondeva.** La via precedente caricava l'avatar con `<img crossOrigin="anonymous">`; la 0.11.0 l'ha sostituita con una chiamata al service worker senza riserva. I CDN di Emochi inviano `Access-Control-Allow-Origin: *` quando la richiesta porta `Origin` (la misura precedente non lo portava), quindi il problema non è mai stato CORS: era il worker. Dalla 0.11.2 si prova prima il worker — l'unica via per `cdn.crushon.ai`, che esige il cookie di sessione — e, se fallisce, l'immagine viene caricata direttamente. Se non arriva nemmeno così, il pannello lo dice con il motivo (`the extension was reloaded - reload this tab`, `http 403`, `decode failed`) invece di disegnare il riquadro senza avvisare.

Chrome disattiva l'estensione una volta dopo l'aggiornamento, perché il manifest aggiunge permessi di host per quei CDN. Riattivala nella pagina delle estensioni.

**Quale campo avatar legge Tavo — risposto in 0.12.0.** L'oggetto personaggio documentato da Tavo espone `avatar` (un URL o un percorso immagine), e `tavo.character.import(card)` accetta sia un wrapper completo `{spec:"chara_card_v3",data:{…}}` sia un oggetto `data` nudo. L'APK 1.9.0 è stato scompattato e cercato nel suo `libapp.so`: contiene `chara_card_v2`, `chara_card_v3`, `ccv3`, `creator_notes`, `mes_example`, `alternate_greetings`, `first_mes`, `character_book` ed `extensions.`, ma **nessun `avatar_url`**. Quindi `data.avatar` è lo slot JSON che Tavo può leggere; `data.extensions.avatar` e l'`avatar` di primo livello sono scritti per altri lettori, non perché Tavo ne abbia bisogno. La finestra di importazione ha comunque l'ultima parola: se la tua versione di Tavo ignora un data URI lì, importa il PNG, dove l'immagine è il file stesso.

### Se un lettore dice ancora «nessun metadato PNG»

Il pannello ora dice cosa ha costruito. Il piè di pagina mostra la versione in esecuzione, e la riga di stato dopo un export PNG elenca i blocchi di testo nel file:

```
PNG salvato - chara + ccv3 - 486 KB - v0.12.0.
```

Se quella riga elenca entrambe le chiavi, il file è corretto e il lettore guarda altrove. Se non le elenca, è fallito l'export stesso. La dimensione serve a confrontare il file su disco con quello appena costruito dal pannello; `- riquadro iniziali` significa che non è stato possibile ottenere il ritratto ed è stata disegnata la placca sfumata.

Il file del report che ha motivato questa sezione è stato controllato byte per byte: un solo blocco `tEXt`, chiave `chara`, prima di `IDAT`, CRC valido e nessuna chiave `avatar` nel JSON. È la firma di 0.10.0. L'esportatore 0.11.x scrive sempre due blocchi e un campo `avatar`. Quindi, prima di tutto:

1. **Controlla che il piè di pagina dica `v0.12.0`.** Se dice `v0.10.x` o `v0.11.x`, il browser sta eseguendo una build vecchia.
2. **Riattiva l'estensione, poi ricarica la scheda.** Chrome disattiva una volta un'estensione non pacchettizzata quando cambiano i permessi, e una scheda già aperta conserva il vecchio content script finché non viene ricaricata. Esportare da quella scheda produce un file vecchio con un nome nuovo, che è esattamente ciò che sembra un report di «continua a fallire».
3. **Riesporta.** I file già su disco conservano i loro byte vecchi. Scarica di nuovo il PNG dopo la ricarica.

Per controllare un file direttamente, il suo primo blocco di testo deve decodificare in un oggetto JSON con `"spec": "chara_card_v2"`, il secondo in `"chara_card_v3"`, e `data.avatar` deve esistere.

### Il ritratto era spesso il riquadro delle iniziali, non il personaggio

Il ritratto è l'unica parte di un export che dipende dal service worker dell'estensione, quindi è la parte che fallisce quando il worker non è raggiungibile. Misurati con e senza header `Origin`, gli host dei ritratti si comportano così:

| Sito | Host del ritratto | `Access-Control-Allow-Origin` |
|---|---|---|
| Emochi | `image-cdn.flowgpt.com`, `cdn.mokio.ai` | `*` quando la richiesta porta `Origin` |
| Polybuzz | `cdn.polyspeak.ai` | `*` |
| Character.ai | `characterai.io` | `*` |
| JanitorAI | `ella.janitorai.com` | `*` |
| Crushon.ai | `cdn.crushon.ai` | assente; 403 senza il cookie di sessione |
| Saucepan.ai | `saucepan.ai/cdn/<id>/card` | non serve, stesso origine |

La nota di 0.11.0 in questo file affermava che gli host Emochi non inviano header CORS. Quella sonda non mandava `Origin`, e questi CDN riflettono l'header ricevuto. Con un browser davanti, `image-cdn.flowgpt.com` e `cdn.mokio.ai` rispondono `Access-Control-Allow-Origin: *`, e un caricamento immagine con `crossOrigin="anonymous"` funziona — verificato in un Chromium reale, non leggendo header.

Quindi il riquadro delle iniziali non è mai stato un problema di CORS. Era il worker: `chrome.runtime.sendMessage` non restituisce nulla quando l'estensione è stata ricaricata con la scheda aperta, quando il permesso host non è stato concesso o quando il service worker va in timeout. L'esportatore lo chiamava fallimento e disegnava la placca, senza modo di sapere quale dei tre fosse successo.

0.11.2 cambia tre cose:

- **Un secondo trasporto.** Si prova prima il worker (è l'unica via per `cdn.crushon.ai`, che richiede il cookie di sessione), poi il ritratto viene caricato come immagine cross-origin. Emochi, Polybuzz, Character.ai e JanitorAI ora ottengono la foto anche con il worker morto.
- **Nessun latch permanente.** Una scheda che ha fallito il ritratto viene ritentata al prossimo export invece di ricordare l'errore per tutta la vita della scheda.
- **Un motivo a schermo.** La riga di stato termina con `- riquadro iniziali (<motivo>)`: `the extension was reloaded - reload this tab`, `http 403`, `decode failed: …` o `the record has no portrait URL`. Un contesto estensione morto viene nominato come tale invece di sembrare un CDN rotto.

Poiché il manifest nomina quegli host dei ritratti, Chrome disattiva l'estensione una volta dopo l'aggiornamento finché non la riattivi nella pagina delle estensioni.

---

## Polybuzz: le informazioni di background non sono recuperabili. Ecco perché.

La guida alla creazione di Polybuzz elenca sette cose di cui è fatto un personaggio: nome, genere, introduzione breve, saluto, tag, **background** e **stile di dialogo** (più il dialogo di esempio che insegna lo stile). Una pagina pubblica ne pubblica cinque. Le altre due — `systemRole` (il background, etichettato *Antecedentes*) e `conversationExample` (i dialoghi di esempio) — **non vengono inviate a nessuno tranne che all'autore di quel personaggio**. Non è un endpoint mancante né qualcosa che questa o altre estensioni possano aggirare, perché **i dati vengono assemblati lato server e non vengono mai serializzati verso un non-proprietario**.

Le prove, in breve:

- Il modulo di creazione stesso mostra il campo come `Antecedentes (Visto en privado)` — *Antecedentes, visto in privato*. È una nota riservata all'autore per design.
- Tutte le rotte API di sola lettura che il client web conosce sono state chiamate contro bot pubblici con una sessione ospite nuova. L'unica che contiene la chiave è `scene/detailguest`, e restituisce `""`.
- La rotta del proprietario `scene/getscenedetail` risponde `210002` per un bot che il tuo account non possiede. Quel codice è definitivo: il server rifiuta il record.
- Nei 225 chunk JavaScript caricati in modo differito, `systemRole` e `conversationExample` compaiono in **un** file: la pagina di creazione. Nessun'altra pagina li chiede, quindi nessun'altra pagina può mostrarli.
- Un esperimento controllato chiude la questione: un bot creato con il marcatore `ZZZ-123` nei suoi Antecedentes, poi scansionato da un secondo account, non ha mai mostrato il marcatore. Il valore non lascia la sessione dell'autore.
- Chiedere al modello di recitare le proprie istruzioni non funziona. La pipeline della chat costruisce il prompt di sistema lato server e lo stream trasporta solo frammenti di testo. L'unica volta che a un bot è stata chiesta la propria biografia, si è inventato un'infanzia che non aveva: la parafrasi non è il testo salvato, e questa estensione non spaccia una generazione per un recupero.

**Cosa fa invece l'estensione:** usa i campi che Polybuzz pubblica davvero, e lo dice in una nota a piè di pagina sotto l'elenco dei blocchi. Personality viene dai tag scelti dall'autore; Scenario dalla didascalia d'apertura del saluto, alla lettera; nulla viene parafrasato e nulla inventato.

Se il personaggio è tuo, le tre rotte autenticate vengono comunque interrogate a ogni scansione, e i tuoi bot tornano completi.

---

## Come è stato costruito questo fork, dall'inizio alla fine

Un breve resoconto, perché la forma del processo spiega perché i limiti sopra sono affidabili.

1. **Partire dallo strumento originale.** L'estensione a monte leggeva già JanitorAI. È diventata la base, e la regola per tutto il resto è stata: non cambiare mai il comportamento ereditato, aggiungi solo accanto.
2. **Aggiungere un lettore, non un caso speciale.** Emochi è stato aggiunto come `src/emochi.js` che riempie lo stesso oggetto scheda, così `exporters.js` e `panel.js` non hanno richiesto alcuna modifica.
3. **Trovare il payload vero.** Emochi è un'app Next.js sul backend di FlowGPT; i dati utili stanno in una stringa `initPrompt` compilata dentro l'oggetto pubblico del prompt. Quella stringa viene ri-parsata in personalità, background, scenario e dialogo di esempio.
4. **Misurare, non supporre.** L'affermazione che Emochi pubblichi una definizione per circa un terzo dei personaggi viene dal campionamento di tre liste dal vivo indipendenti (30, 19 e 9 personaggi) e dal contarli. È un flag di pubblicazione (`visibility: true`), non un cancello di login.
5. **Aggiungere Polybuzz allo stesso modo.** Nuxt rende il personaggio lato server dentro la pagina, quindi il payload è nel DOM come array devalue. Quell'array viene espanso e cercato. Un content script non vede `window.__NUXT__`, quindi si usa il tag `<script id="__NUXT_DATA__">`.
6. **Enumerare l'API, non indovinarla.** Il bundle JavaScript del sito dichiara 214 configurazioni di richiesta. Tutte quelle di sola lettura sono state chiamate contro bot pubblici. È così che si è arrivati alla conclusione "il background è irraggiungibile": non fallendo una volta, ma esaurendo la superficie.
7. **Dimostrare il negativo con un controllo.** L'esperimento `ZZZ-123`, fatto su due account, è ciò che ha trasformato "non lo troviamo" in "non c'è da trovare".
8. **Tenere il pannello zitto.** Un campo privato dell'autore mancante è il caso normale, non un errore. Il pannello mostra una nota a piè di pagina, non un banner. Solo un guasto reale (disconnesso, nessuna rotta che risponde) riceve un messaggio.
9. **Testare tutto ciò che è testabile.** `node --test` copre i lettori, il normalizzatore, gli esportatori e il costruttore di blocchi. 137 test al momento della scrittura. Ogni affermazione API in questo README è stata verificata sui siti dal vivo, e quelle non verificabili sono marcate come tali.
10. **Scriverlo.** La sezione per sviluppatori esiste perché la prossima persona non debba ri-derivare tutto.
11. **Riutilizzare prima di scrivere.** Character.ai e Crushon.ai consegnano il record solo al proprio JavaScript, quindi un solo meccanismo copre entrambi: uno sniffer nel mondo della pagina e una scansione con punteggio dei payload. Un file nuovo per sito, più due condivisi, e gli esportatori non sono stati toccati.
12. **Citare la fonte di un approccio.** Il pattern di intercettazione viene dall'[esportatore di taquanta](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), e il credito sta in cima al file e in questo README, non solo in un messaggio di commit.
13. **Dire ciò che non è verificato.** Entrambi i siti nuovi rispondono `403` di Cloudflare a una macchina senza browser, quindi i contratti sono documentati e la lettura dal vivo no. È scritto in tre punti invece di essere sorvolato.
14. **Leggere l'esportatore del sito quando ne ha uno.** Wyvern include uno scrittore di schede V2 nel suo bundle. Estrarlo ha risolto `pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt` e `creator_notes` come Long Description. Una mappatura copiata dal codice del prodotto batte una dedotta dall'interfaccia.
15. **Non supporre che l'API sia tutto il record.** JanitorAI scrive lo stesso personaggio nella pagina come `window.mbxM.push(JSON.parse("…"))`, una stringa JSON dentro un documento JSON. L'API diceva che la definizione era null; la pagina portava il record. Analizzare lo script di idratazione è stata la differenza tra un riassunto e una scheda.
16. **Portare funzioni, non codice.** CAI Tools ha definito i formati pratici delle chat; il lettore li scrive con il proprio codice, mantiene la regola zero dipendenze e dice quali funzioni di CAI Tools sono di interfaccia e quindi fuori ambito.

**Questo strumento è in sviluppo attivo e continuerà a ricevere aggiornamenti.** Si aggiungono siti, si riparano lettori rotti e le note API vengono corrette quando un sito cambia. Se qualcosa si rompe, di solito è perché un sito ha cambiato la forma del payload, e si può sistemare.

---

## Devlog

Il resoconto di come si è arrivati davvero a ogni versione: cosa è stato provato, cosa ha fallito e cosa ha insegnato il fallimento. Il più recente per primo. La versione breve è nel [changelog](CHANGELOG.md); questa è quella lunga.

### 0.12.0 — tre siti, un deposito di idratazione e la metà esportatrice di CAI Tools

**Chub è stato il primo sito che non ha avuto bisogno di un traduttore.** La sua API personaggi restituisce un oggetto `definition` le cui chiavi sono già quelle di Tavern: `description`, `personality`, `scenario`, `first_message`, `alternate_greetings`, `example_dialogs`, `system_prompt`, `post_history_instructions`, `tavern_personality`, `embedded_lorebook`. Il lavoro non era mappare campi; era trovare il trasporto. L'endpoint personaggi non invia `Access-Control-Allow-Origin`, quindi un fetch dalla pagina muore anche se l'API è pubblica. Il worker esisteva già per Emochi e Polybuzz, quindi la lettura si è spostata lì con un permesso host per `api.chub.ai`. I lorebook sono stata la seconda domanda: `related_lorebooks` porta id, `-1` è un sentinella, e un libro può essere sia incorporato sia collegato. Ridurre ogni libro a una firma `keys + content` e scartare i duplicati esatti è bastato; nessuna lista di id è stata creduta sulla parola.

**Wyvern sembrava un problema di slug personalizzato e si è rivelato un problema di payload.** `/api/characters/{id}` è pulito, ma gli URL del sito usano uno slug scelto dall'autore, e `eveline` non è un id. L'API risponde 404 al nome. La pagina, però, renderizza l'intero record in un payload di volo Next.js. Analizzare i blocchi `self.__next_f.push` e abbinare le graffe del record dà sia l'id sia un fallback. Poi il bundle ha risposto alla domanda sulla mappatura meglio di qualsiasi congettura: Wyvern include il proprio scrittore V2, e quello scrittore dice `system_prompt: e.pre_history_instructions`, `post_history_instructions: e.post_history_instructions`, `creator_notes: e.creator_notes` e `depth_prompt.prompt: e.character_note`. Leggendolo sono stati trovati due bug della 0.12.0: il primo lettore perdeva il System Prompt di 935 caratteri perché guardava `system_prompt`, e trattava gli oggetti `greetings` avanzati come stringhe. Entrambi sono corretti, e i test usano i nomi di campo del sito stesso.

**La definizione di JanitorAI non mancava; era sfuggita.** L'API continua a rispondere `personality: null` e `showdefinition: true` a una chiamata anonima, il che sembra una contraddizione finché non si ispeziona la pagina. L'app Vite idrata i suoi depositi con `window.mbxM.push(JSON.parse("{\"SJ--a:a-a--characterStore\":{…}}"))` — un letterale stringa JSON che contiene un documento JSON. Il vecchio lettore cercava `{"id":…}` già decodificato e non trovava nulla. `scriptPayloads()` ora analizza il letterale e poi il risultato, e la scansione con punteggio trova l'oggetto personaggio dentro il deposito. Lo stesso payload porterà la definizione per un lettore autenticato, perché è la copia che il server ha renderizzato per quella sessione. Il record anonimo resta un riassunto, e il pannello ora lo dice con precisione: l'autore ha marcato la definizione come pubblica, ma questa sessione non l'ha ricevuta. È un messaggio diverso da «l'autore l'ha nascosta», e la differenza conta in un report di bug.

**CAI Tools è stata smontata, non copiata.** Il suo esportatore di chat definisce cinque formati: leggibile, JSONL Tavern, JSON Oobabooga, testo della definizione e PDF. I primi quattro rispettano la regola zero dipendenze. Il file Tavern aveva bisogno della riga di metadati e di `is_name`; quello Oobabooga della fusione delle coppie e dell'inizio dal primo turno utente. Ora vengono prodotti entrambi, insieme a un archivio JSON, Markdown e il dialogo di esempio. Il PDF è stato lasciato fuori di proposito: usa jsPDF e avatar, e un PDF Unicode fedele senza un font incluso non è possibile qui. Il Markdown si stampa in PDF dal browser. Il resto di CAI Tools — sostituzione della pagina chat, sfondi, font, pin di memoria, libreria, ricerca — non è un esportatore e non viene riprodotto.

**Il PNG è stato provato nel browser, non solo in Node.** Un record JanitorAI reale è stato letto, dotato di una voce lorebook, disegnato in una placca 512×512 con il suo ritratto reale e scritto come PNG. Poi il file è stato riletto: `IHDR, tEXt (chara), tEXt (ccv3), IDAT…`; entrambi i blocchi base64 sono decodificati in JSON V2/V3 valido con la voce del libro; il trasporto del ritratto ha riportato `cors`, non la placca con le iniziali. È la prova end-to-end che i test unitari non possono dare: canvas, `btoa`, `TextEncoder`, CRC e posizionamento dei blocchi nello stesso browser che eseguirà l'estensione.

**Cosa resta non verificato.** Le letture autenticate di JanitorAI, Character.ai e Crushon.ai restano fuori portata: gli host rispondono 403 di Cloudflare alla macchina su cui è stato costruito tutto questo, e il browser integrato non ha una sessione account. I contratti sono documentati; la lettura autenticata no. Chub, l'API di Venus, gli slug id e personalizzati di Wyvern, la lettura anonima di JanitorAI e il recupero dal deposito di idratazione sono stati esercitati contro i siti live.

### 0.11.2 — il ritratto che esisteva solo nel pannello

**Due schede esportate come lettere grigie, e il file diceva perché.** I due PNG di Alana Flores portavano `chara` + `ccv3` nel posto giusto, e `data.avatar` aveva l'URL corretto di `image-cdn.flowgpt.com`. La scheda era a posto e l'immagine non era mai stata scaricata: `prepareAvatar()` era partito, `requestImage()` era tornato vuoto e si era disegnata la placca con le iniziali. Il pannello continuava a mostrare la foto perché l'anteprima è un semplice `<img>` e non ha bisogno della macchineria dell'estensione.

**La spiegazione della 0.11.0 era sbagliata, e misurarla di nuovo ha mostrato perché.** Quella versione diceva che `image-cdn.flowgpt.com` e `cdn.mokio.ai` non inviano `Access-Control-Allow-Origin`. La sonda che lo affermava non mandava `Origin`. Mandane uno — come fa ogni browser — e entrambi gli host rispondono `Access-Control-Allow-Origin: *`. Il CDN non è mai stato il problema; il worker sì. Un caricamento `<img crossOrigin="anonymous">` del ritratto funziona, e la 0.11.0 aveva sostituito proprio quello con una chiamata al worker senza fallback. Entrambi i rami sono stati poi esercitati in un Chromium reale: prima `avatarSource=worker`, un data URI da 99 KB e un PNG da 526 KB; poi è stato tolto `https://*.flowgpt.com/*` dal manifest perché il worker non raggiungesse il CDN, e il risultato è stato `avatarSource=cors`, stessi byte, stesso ritratto.

**Cosa è cambiato.** Il worker resta il primo trasporto, perché `cdn.crushon.ai` risponde 403 senza il cookie di sessione e solo il worker lo porta. Il caricamento CORS è il fallback. Il latch permanente `avatarReady` è sparito, quindi una scheda che ha fallito una volta viene ritentata all'export successivo. E la riga di stato nomina il guasto: `- riquadro iniziali (worker unreachable: the extension was reloaded - reload this tab)` o `- riquadro iniziali (http 403)`, invece di sembrare una scelta di design. L'errore Character.ai dello stesso report era la stessa informazione mancante: il trail finiva in `no answer` per ogni passo del worker, che è come appare un contesto estensione perduto da un content script. Ora riporta l'errore di runtime, e un 200 senza nulla di usabile dice che forma ha ricevuto.

### 0.11.1 — il file era della build precedente alla correzione

**Il report diceva che il nuovo export falliva ancora. Il file diceva il contrario.** Era allegato un PNG fallito, quindi la prima mossa è stata analizzarlo invece del codice. Lista dei blocchi: `IHDR`, un `tEXt` (`chara`, 2170 byte), `IDAT` ripetuto, `IEND`. CRC contro `zlib.crc32`: valido. Payload base64: la scheda. Pillow lo apre come 512×512 RGBA ed espone lo stesso blocco di testo. Nulla di sbagliato tranne un blocco di testo invece di due e nessuna chiave `avatar` nel JSON — esattamente ciò che scriveva la 0.10.0. L'esportatore 0.11.0 scrive `chara` + `ccv3` e un campo `avatar`. Il browser stava ancora eseguendo il vecchio content script: Chrome disattiva un'estensione non pacchettizzata quando cambiano i permessi, e una scheda già aperta conserva il vecchio script finché non viene ricaricata. Esportare da quella scheda produce un file vecchio con un nome nuovo, che sembra identico a «la correzione non ha funzionato».

**La scheda di riferimento è stata scaricata e smontata.** Chub pubblica la sua scheda come `avatars.charhub.io/.../chara_card_v2.png`, e la guida di importazione di Tavo punta proprio a Chub. Quel file: `IHDR, tEXt (chara), IDAT…, IEND`, un campo `data.avatar` e un `character_book` completo. Nessun `ccv3`. Il layout di questo esportatore ora corrisponde, con `ccv3` aggiunto dopo `chara` — entrambi i blocchi prima di `IDAT`, la posizione che un lettore fermo al primo blocco immagine può ancora vedere. Da lì sono venuti due cambi che valgono più della correzione: il pannello stampa ciò che ha costruito (la versione nel piè di pagina e `PNG saved - chara + ccv3 - v0.12.0.` all'export), e il JSON scrive i campi piatti V1 accanto a `data`, perché i lettori precedenti a V2 non guardano mai dentro `data` — l'importatore Agnai, Pygmalion, i loader Gradio. Un file, due generazioni.

### 0.11.0 — la scheda era valida, il lettore voleva l'altro blocco

**Due report, un formato di file.** Un PNG rifiutato da Tavo con *«No se detectaron metadatos PNG»*, e un'importazione JSON che caricava il personaggio ma lasciava vuoto il ritratto. Entrambi sono stati riprodotti contro il file che l'estensione scrive davvero, non contro il sito.

**Il PNG era una scheda V2 valida.** Ordine dei blocchi, campi di lunghezza e CRC32 sono stati controllati contro `zlib.crc32` byte per byte: firma, `IHDR`, un blocco `tEXt` sotto la chiave `chara` con il JSON base64, poi i dati immagine intatti. Nulla era malformato. Mancava il secondo blocco. SillyTavern scrive `chara` e `ccv3`; Tavo cerca `ccv3` per primo e risponde che non ci sono metadati invece di usare l'altro. Un blocco era tutta la differenza tra un file rifiutato e uno accettato. Ora vengono scritti entrambi, in quell'ordine, e il test verifica la lista completa `IHDR, tEXt, tEXt, IDAT, IEND` con ogni CRC controllato da zlib.

**Il JSON non ha mai avuto uno slot per l'immagine.** La specifica V2/V3 è solo testo. L'importazione JSON di Tavo crea sempre il personaggio con il selettore del ritratto vuoto, che è esattamente ciò che mostrava lo screenshot. L'unico modo per mettere un'immagine in un JSON è un data URI, quindi l'export ora incorpora un JPEG 512×512 (~40 KB) in `avatar`, `data.avatar` e `data.extensions.avatar`. Se un frontend ne legge uno, l'immagine arriva senza richiesta di rete. Tavo è documentato come un'app che prende l'immagine dal PNG o dal selettore, quindi la risposta onesta per quell'app è: PNG per immagine e scheda insieme, JSON per il testo.

**L'avatar falliva prima di iniziare.** Il vecchio codice caricava il ritratto con `crossOrigin = "anonymous"`, che richiede `Access-Control-Allow-Origin` sulla risposta immagine. Sondare i cinque CDN ha risposto direttamente: `image-cdn.flowgpt.com` e `cdn.mokio.ai` senza header, `cdn.polyspeak.ai`, `characterai.io` e `ella.janitorai.com` con `*`, `cdn.crushon.ai` con 403 senza cookie. Per Emochi il caricamento CORS non riceveva nemmeno un byte, quindi l'export cadeva in silenzio sulla placca con le iniziali e sembrava aver funzionato. Ora il ritratto passa da `background.js` con un permesso host per CDN, torna in base64 e viene decodificato con `createImageBitmap`, che non richiede CORS e non può macchiare il canvas. Un fetch fallito cade ancora sulla placca, ma ora un fallimento significa un fetch fallito, non una modalità sbagliata. Questo costa cinque nuovi permessi host, quindi Chrome disattiva l'estensione una volta all'aggiornamento finché non viene riattivata.

### 0.10.0 — Saucepan, e la descrizione che arriva a pezzi

**Il sito non è ciò che sembra da fuori.** `api.saucepan.ai` resetta la connessione per qualsiasi cosa non sia un browser, il che di solito significa Cloudflare e un vicolo cieco. Non lo era: la base URL dell'app è la stringa vuota, quindi ogni chiamata va a `https://saucepan.ai/api/...` ed è proxata all'edge. Stesso origine, niente CORS, e un header statico che il client mette su ogni richiesta (`cf-edge-token-8af3`). Quella scoperta ha reso leggibile tutto il sito senza un browser.

**Poi il contratto dei campi, dal bundle e non da una congettura.** L'app include un bundle da 9,8 MB con tutta l'API. Dichiara 666 percorsi di richiesta. Lo schema di validazione dell'editor dei companion nomina ogni campo che il sito salva — `card`, `full_description`, `short_description`, `example_dialogue`, `starting_scenarios[]`, `advanced_prompt`, `formatting_instructions`, `hidden_fields`, `external_model_policy` — e il componente profilo nomina ogni campo che renderizza. Due forme, un prodotto; la differenza tra loro è la storia di questa versione.

**La descrizione è una lista di frammenti con esche.** Il primo companion pubblico reale ha restituito cinquantaquattro frammenti per la Description, sette reali. Le esche sono rumore grammaticale generato da un piccolo dizionario — *signal*, *glance*, *window*, *pattern*, *gentle*, *quiet* — quindi sembrano prosa a prima vista e sopravvivono a una euristica ingenua di «prendi le stringhe più lunghe». Il disambiguatore è nel client: ogni frammento porta un `proof`, ed è reale solo quando quel proof è uguale a un hash FNV-1a del testo del frammento con un seme derivato dalla maschera e da `key ^ mask`. I reali vengono ordinati per `key ^ mask` e uniti. Sette frammenti hanno ricomposto 137 caratteri di testo pulito. La routine è `decodeFragments`, verificata su frammenti copiati dalla risposta live. I messaggi iniziali usano la stessa struttura in `starting_scenarios_fragments[].message`; uno scenario privato semplicemente non compare, e uno slot vuoto è salvato come sentinella `≠≠≠BLANK_SCENARIO≠≠≠`, che il lettore scarta.

**I proxy erano la domanda, e la risposta è `providers_profile`.** Il campo è `external_model_policy` nell'editor e `providers_profile` nel record pubblico: `custom_and_vetted`, `vetted_only`, `internal_only`. Decide quale modello può chiamare la chat, non ciò che serve il profilo, quindi viene riportato nella riga di nota e non usato per altro. Entrambe le politiche esportano allo stesso modo. Ci sono due percorsi di lettura perché un companion pubblico ha due interruttori di visibilità: il record pubblico è anonimo e porta sempre la Description; la definizione è una seconda chiamata, richiede il bearer di `localStorage["hallucination/auth_token"]` ed è rifiutata quando l'autore ha chiuso Definition Visibility. Un companion tuo ha una terza rotta, `/api/v1/companion/editable`, che restituisce il record grezzo dell'editor e non si cura della visibilità. **Cosa non è stato verificato:** le rotte definizione ed editable richiedono una sessione, quindi le loro forme vengono dal codice client che le consuma, non da una chiamata autenticata; la rotta pubblica, il decodificatore di frammenti, la politica dei provider e i frammenti di scenario sono stati esercitati su companion live. 103 test, 11 nuovi.

### 0.9.0 — due siti chiusi, un solo meccanismo, e un parser Emochi con tre bug

**Prima Emochi, perché era la priorità.** C'erano due segnalazioni aperte: personalità e scenario mancanti su alcuni bot, e `characterExampleConversation` che non arrivava mai alla scheda.

Il bug delle conversazioni di esempio è durato dieci minuti. La rotta di definizione restituisce `characterExampleConversation` come **array di turni**, e il lettore ci applicava `String(...)`. Un array diventa `"[object Object],[object Object]"` in alcuni runtime e `""` nell'helper `s()` del normalizzatore — in nessun caso dialogo. Ora viene analizzato come turni, e il parser accetta `{role, content}`, `{user, ai}`, `{isUser, text}` e un wrapper `{dialogue: [...]}`, perché il registratore di Emochi usa la prima forma, gli importatori di schede la seconda, e le altre compaiono in record precedenti a un cambio di schema.

Il bug della personalità ha richiesto più tempo ed erano tre difetti separati impilati:

1. **L'istruzione di chiusura era trattata come un confine.** Ogni prompt compilato termina con `Do not write as {{user}} or assume {{user}}'s reaction or response.` Il lettore tagliava lì e buttava via tutta la coda. È corretto per un prompt che finisce con la regola, cioè quello che produce il compilatore. È sbagliato nel momento in cui un autore cita la regola dentro il proprio background o il proprio dialogo di esempio, cosa che succede più spesso di quanto si pensi: c'è chi incolla la regola nel proprio esempio di proposito, per insegnarla al modello. Ogni sezione dopo la citazione spariva. La correzione è rimuovere quella frase dove appare e conservare il testo attorno.
2. **La grammatica delle sezioni accettava una sola formulazione esatta.** I marcatori erano `'s personality:`, `'s background:`, `scenario of role-play:`. Un autore che ha scritto `Personality:` — maiuscola, senza possessivo, perché ha scritto il proprio prompt invece di usare il builder — otteneva un parsing vuoto, e l'intero prompt finiva nel ramo «nessun marcatore, trattalo come personalità». Ora c'è un secondo insieme di marcatori ancorato alla riga che tollera la deriva, e vince la passata che riconosce più sezioni. In caso di parità resta la grammatica stretta, così i prompt prodotti dal compilatore si analizzano esattamente come prima.
3. **La nota di sezione vuota era una supposizione.** Il lettore diceva «l'autore ha lasciato vuoti personalità e dialogo di esempio» ogni volta che quei campi uscivano bianchi — anche quando il parser non aveva riconosciuto affatto il layout, e quindi erano bianchi per colpa del parser. Ora la nota scatta solo quando è stata riconosciuta anche la riga del nome, cioè quando il layout è stato capito davvero.

Tutti e tre sono coperti da test scritti dalle forme che fallivano, non da quelle che passavano.

**Poi i dialoghi di esempio di Polybuzz.** Il ticket aveva uno screenshot dell'editor *Estilo de diálogo*: le righe con l'avatar accanto sono `{{user}}`, quelle senza sono `{{char}}`. Leggendo il bundle della pagina di creazione la forma è stata confermata: `dialogueStyleObj` è un array di coppie `{user, ai}`, una voce per scambio, e il record di dettaglio lo restituisce sotto `dialogueStyle.dialogue`. Entrambi ora vengono analizzati in righe della scheda. La stringa piatta `conversationExample` è lo stesso dato come `user;ai` per riga, e anche quella forma viene riscritta.

Una trappola: una stringa semplice sotto `dialogueStyle` è l'**etichetta di stile** (`Descriptivo, frases cortas`), non dialogo. La prima versione del parser riscriveva allegramente un'etichetta di stile in `{{char}}: Descriptivo, frases cortas` e la infilava nel blocco esempi. I test l'hanno preso. Ora le stringhe non diventano mai dialogo; solo gli array e il testo `user;ai`.

**Poi Character.ai.** L'approccio viene dall'[esportatore di taquanta](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), che ha risolto lo stesso problema: il record lo chiede solo il JavaScript della pagina, con un header `Authorization: Token <hex>` che l'estensione non può coniare. L'implementazione di riferimento esegue uno script nel mondo della pagina (`MAIN`), intercetta `fetch` e `XMLHttpRequest`, e salva l'header nel DOM. È l'unico modo per vedere un header che il browser aggiunge fuori dal tuo contesto.

Due modifiche. Il token va in un meta tag con namespace proprio invece che in uno che può collidere. E ogni risposta JSON che la pagina riceve viene ritrasmessa come evento DOM che porta una **stringa** — gli oggetti non attraversano il confine tra uno script `MAIN` e un content script isolato, le stringhe sì. Quella singola modifica ha trasformato lo sniffer da «cattura il token e ripeti la chiamata» a «cattura il token *e* la risposta», così il lettore continua a funzionare quando la ripetizione viene rifiutata.

La definizione è il campo interessante. Character.ai la chiude dietro **Definition Visibility**, un secondo interruttore separato dalla visibilità del personaggio, e quando è spento il testo non viene inviato a nessuno. Quindi una scheda con il blocco del dialogo di esempio vuoto è una impostazione dell'autore, non una lettura fallita, e il pannello dice esattamente questo invece di mostrare un errore.

**Poi Crushon.ai.** Interamente renderizzato lato client, dietro un muro anti-bot. Non c'è un'API pubblica da ripetere e le chiamate della pagina portano stato di sessione, quindi il lettore non chiama nulla: percorre i payload che la pagina ha già ricevuto e assegna un punteggio a ogni oggetto in base a quanti nomi di campo noti contiene. Vince il più ricco. Gli alias coprono le grafie usate tra le versioni, perché mancarne una costa l'intero campo.

La parte condivisa dei due lettori è `src/harvest.js`: raccolta dei payload, rilettura del token e la scansione con punteggio. Due lettori nuovi, due file condivisi, zero modifiche a `exporters.js` o `panel.js` — la regola che ogni lettore riempie lo stesso oggetto scheda è ciò che lo ha reso possibile, ed è il motivo per cui il prossimo sito costa un file.

**Cosa non è stato verificato.** Entrambi gli host nuovi rispondono `403` di Cloudflare alla macchina su cui è stato costruito, quindi nessuno dei due lettori è stato esercitato contro un browser con sessione. Ciò che è stato verificato: l'endpoint neo è vivo e risponde `{"status":"NOT_OK","error":"bad request"}` a un id sintetico, cioè la rotta che si lamenta del corpo e non del chiamante. I contratti dei campi vengono dall'implementazione funzionante di taquanta. È scritto come non verificato nel changelog, nella lista To-do e qui, perché un lettore non esercitato è un'affermazione diversa da uno che lo è stato.

### 0.8.0 — il fork prende un nome e sei lingue

Il repository portava ancora il nome originale mentre supportava quattro siti. Rinominato in **Universal Character Card Exporter**, che è ciò che fa. Issues è stato abilitato nello stesso momento, perché la sezione sulla segnalazione bug mandava le persone a una scheda che non esisteva.

La documentazione è passata a sei lingue in una sola passata. Il riferimento API sito per sito resta in inglese e lo dice in cima alla sezione: è materiale di riferimento che invecchia più in fretta, e sei copie di un documento vecchio sono sei volte la manutenzione senza alcun guadagno. Le traduzioni rimandano lì.

La sezione Polybuzz è stata riscritta. Prima diceva che il background «non è recuperabile» come conclusione. Ora l'evidenza sta sotto: l'etichetta privata per design nel form di creazione, la scansione esaustiva delle rotte, il `210002` sul bot di qualcun altro, il test di controllo `ZZZ-123` su due account. Un risultato negativo affermato non vale niente; un risultato negativo con il suo metodo allegato vale qualcosa.

### 0.7.13 — personalità dai tag dell'autore

Polybuzz non pubblica né background né campo personalità, il che lasciava le schede con il blocco Personality vuoto. L'albero dei tag veniva già richiesto per la lista tag della scheda, quindi è stato letto con più attenzione: ogni tag finisce sotto uno di quattro genitori, e `Personalidad` contiene 41 parole di temperamento scelte a mano dall'autore. È la caratterizzazione dell'autore, scritta da lui, pubblicata dal sito.

L'incrocio è onesto in un modo preciso: i tag di genere, origine e identità restano fuori da Personality e rimangono nella lista tag, e un `systemRole` reale ha ancora la precedenza sui tag quando esiste. Misurato su 10 bot dal vivo: 10/10 hanno prodotto un blocco Personality reale. Una lista di tag è più sottile di un background scritto, ma sono parole dell'autore invece di una supposizione.

### 0.7.10 – 0.7.12 — un'eco non è un campo

Tre versioni, un'idea. `getsceneconfig` con un id di scena risponde con il testo di introduzione compilato come fallback. Cinque scansioni con sessione su bot non posseduti dall'account hanno restituito un `systemRole` identico carattere per carattere a `sceneBrief`. È così che il server renderizza un background vuoto, non un secondo campo che per caso coincide. Un'eco esatta ora viene trattata come assenza, ogni rotta conserva la propria risposta invece della prima non vuota, e il pannello mostra una nota a piè di pagina invece di un banner, perché un campo privato dell'autore è il caso normale.

Lo scenario è uscito dallo stesso lavoro: i saluti di Polybuzz spesso si aprono con una didascalia (`*Bangchan es tu esposo*`), che è la premessa dell'autore. Viene promossa alla lettera quando il record non porta `templateIntro`. Non si parafrasa mai nulla.

---

## Changelog

Storia completa delle versioni, con ogni correzione e il suo motivo: **[CHANGELOG.md](CHANGELOG.md)**.

Versione breve:

| Versione | Cosa è arrivato |
|---|---|
| 0.12.0 | Lettori per Chub.ai, Venus.chub.ai e WyvernChat; definizione di JanitorAI recuperata dal deposito di idratazione; **Save chat** di Character.ai (JSONL Tavern, JSON, Markdown, dialogo di esempio, Oobabooga); voci complete di `character_book` ed estensioni della scheda; PNG verificato in un browser reale; 137 test |
| 0.11.2 | Il ritratto sopravvive a un worker non disponibile (worker e poi carica diretta), gli errori vengono nominati, il trail di Character.ai dice cosa ha restituito ogni endpoint; 111 test |
| 0.11.1 | Il pannello mostra la versione in esecuzione e i blocchi del PNG scritto; il JSON porta anche i campi piatti V1; 107 test |
| 0.11.0 | PNG con `chara` + `ccv3`, ritratti scaricati dal worker così un CDN senza CORS non dà più le iniziali, JSON con il ritratto come data URI; 106 test |
| 0.10.0 | Lettore Saucepan.ai: decodifica dei frammenti, due rotte di lettura, lorebook, politica dei provider nella nota; 103 test |
| 0.9.1 | Character.ai: schema di autenticazione preservato, scaletta di lettura a freddo, fallback sui dati renderizzati, 92 test |
| 0.9.0 | Lettori Character.ai e Crushon.ai, dialoghi di esempio Polybuzz, correzioni al parser Emochi, Emochi Lab, 92 test |
| 0.8.0 | Rinomina, documentazione in sei lingue, sezione crediti, riscrittura delle prove Polybuzz, Issues abilitato |
| 0.7.13 | Personality di Polybuzz dai tag `Personalidad` dell'autore |
| 0.7.12 | Scenario di Polybuzz dalla didascalia del saluto |
| 0.7.11 | Candidati per rotta, così un'eco non può nascondere un background reale |
| 0.7.10 | Catena di configurazione consapevole della conversazione, pannello silenzioso |
| 0.7.0 – 0.7.9 | Supporto Polybuzz, dall'inizio alla fine |
| 0.6.0 – 0.6.1 | Lettore Emochi e scansione profonda della cronologia prompt |
| 0.5.0 e precedenti | JanitorAI, ereditato dall'estensione originale di erpocalypse |

---

## To-do

- [x] **Aggiungere il supporto a Character.ai.** Fatto in 0.9.0. La definizione dipende ancora dall'interruttore Definition Visibility dell'autore.
- [x] **Aggiungere il supporto a Crushon.ai.** Fatto in 0.9.0, leggendo ciò che la pagina renderizza.
- [x] **Priorità — Emochi: alcuni bot non mostrano personalità o scenario.** Risolto in 0.9.0. Tre cause, tutte nel parser: l'istruzione di chiusura trattata come confine di taglio, la grammatica delle sezioni che accettava una sola formulazione, e la nota «l'autore l'ha lasciato vuoto» che scattava su un layout non riconosciuto. Dettagli nel [changelog](CHANGELOG.md).
- [x] **Priorità — Emochi: le conversazioni di esempio non vengono recuperate.** Risolto in 0.9.0. `characterExampleConversation` arriva come array di turni e la conversione a stringa lo riduceva a `""`. Ora viene analizzato come turni.
- [x] **Supporto Emochi Lab.** Gli URL di Story, Soundstage e LiveRoom vengono letti come lo stesso record di prompt, prendendo l'ultimo segmento del percorso come id. La sessione non autenticata non ha mai mostrato la forma reale degli URL del Lab, quindi una superficie con un tipo di record diverso segnala la rotta fallita invece di restituire mezza scheda.
- [x] **Aggiungere il supporto a Saucepan AI.** Fatto in 0.10.0. I companion pubblici si esportano con la Description e con ogni messaggio iniziale pubblico; la definizione e i lorebook richiedono una sessione attiva, e la definizione anche l'interruttore Definition Visibility dell'autore. Le rotte definizione ed editable sono documentate dal codice del client che le consuma, non da una chiamata autenticata; se una ti torna vuota, un issue con il messaggio del pannello è esattamente ciò che serve.
- [x] **Importazione JSON di Tavo: confermare quale campo avatar legge.** Risposto in 0.12.0. L'oggetto personaggio di Tavo espone `avatar` (URL o percorso), il suo importatore accetta un wrapper CCv3 completo o un oggetto `data` nudo, e il suo APK 1.9.0 non contiene la stringa `avatar_url`. Il JSON scrive il ritratto in `avatar`, `data.avatar` e `data.extensions.avatar`; il PNG resta la via documentata quando l'immagine deve arrivare con la scheda.
- [x] **Supporto WyvernChat.com.** Fatto in 0.12.0. Risolvono sia gli slug id sia quelli personalizzati, i lorebook si leggono in Deep scan, e la mappatura segue l'esportatore V2 di Wyvern (`pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt`).
- [ ] **Verificare i lettori Character.ai e Crushon.ai con una sessione attiva.** Entrambi gli host rispondono `403` di Cloudflare alla macchina su cui è stata costruita questa versione, quindi i contratti sono verificati ma la lettura dal vivo no. Se uno dei due lettori non funziona per te, un issue con il messaggio del pannello è esattamente ciò che serve.
- [x] **Supporto Chub.ai e Venus.chub.ai.** Fatto in 0.12.0. La lettura del personaggio passa dal worker dell'estensione perché l'endpoint non ha header CORS; Venus serve la stessa SPA e la stessa API. Deep scan legge lorebook incorporati e collegati e scarta i duplicati esatti.
- [x] **Metadati PNG con la definizione completa per qualsiasi piattaforma.** Fatto e ri-verificato in 0.12.0: blocchi `tEXt` `chara` (V2) e `ccv3` (V3), entrambi subito dopo `IHDR` e prima di `IDAT`, CRC validi, JSON completo della scheda incluso `character_book`; una build reale in Chromium ha prodotto e riletto una scheda da 1,14 MB.
- [x] **Portare le funzioni di export di CAI Tools.** Fatto in 0.12.0 per il percorso Character.ai: mappatura di definizione/saluti/categorie/avatar ed export delle chat come JSONL Tavern, JSON, Markdown, dialogo di esempio e coppie Oobabooga. La sostituzione dell'interfaccia chat, gli sfondi, i font, il gestore di memoria, la libreria, la ricerca e l'output jsPDF di CAI Tools sono funzioni di interfaccia o dipendenze e restano fuori ambito.

Un lettore che funziona a metà su un sito supportato è peggio di un sito in più che funziona del tutto: per questo i due punti Emochi sono rimasti sopra l'aggiunta di nuovi siti finché non sono stati chiusi.

---

## Segnalare bug

Usa la **[scheda Issues](https://github.com/mxchu666/Universal-Character-Card-Exporter/issues)**. È abilitata. Includi:

- Il sito e l'URL del personaggio.
- Che versione hai — **passa il cursore sul piè di pagina del pannello di export e la versione appare nel tooltip**.
- Cosa ti aspettavi e cosa hai ottenuto. Uno screenshot del pannello è la cosa più utile che puoi allegare.
- Qualsiasi messaggio mostrato dal pannello. Quando una ricerca fallisce, il pannello nomina la rotta e il codice di risposta, e quel testo è esattamente ciò che serve per la correzione.

Le richieste di funzionalità sono benvenute nello stesso posto.

---

## È permesso?

È uno strumento di backup personale. Legge ciò che puoi già vedere da connesso e lo salva in un formato aperto. Non aggira paywall e non sblocca nulla che non potresti comunque vedere.

I termini dei siti possono comunque limitare l'accesso automatizzato. Usalo per i tuoi personaggi e i tuoi backup personali, accredita gli autori quando ricondividi il loro lavoro e non martellare i siti.

## Privacy

- I dati dei personaggi scansionati non lasciano mai il browser. Nessun analytics, nessun codice esterno.
- I permessi host sono limitati ai siti nel manifest, ai loro host API e ai loro CDN dei ritratti; non c'è un permesso `<all_urls>`.
- Le uniche chiamate di rete sono verso il sito su cui sei già, l'API di quel sito e il suo host dei ritratti.

---

## Per sviluppatori

L'estensione è JavaScript puro, senza dipendenze e senza build. Modifica `src/` e ricarica dalla pagina delle estensioni.

```sh
node --test
```

`src/scraper.js` legge JanitorAI, `src/emochi.js` Emochi, `src/polybuzz.js` Polybuzz, `src/cai.js` Character.ai, `src/crushon.js` Crushon.ai, `src/saucepan.js` Saucepan.ai, `src/chub.js` Chub.ai/Venus.chub.ai e `src/wyvern.js` WyvernChat. Tutti e otto riempiono la stessa forma di scheda, quindi esportatori e pannello non sanno mai su che sito sei. `src/exporters.js` converte, `src/panel.js` e `src/panel.css` sono il pannello in pagina, `background.js` è il service worker per le richieste che un content script non può fare (CORS, header proibiti).

Due file esistono solo per i siti che non pubblicano mai il proprio record su un'API: `src/intercept.js` gira nel mondo della pagina stessa (`world: "MAIN"`, `document_start`) e copia nel DOM ciò che la pagina già sa; `src/harvest.js` raccoglie quei payload e assegna un punteggio a ogni oggetto contro una lista di nomi di campo noti. Aggiungere un terzo sito chiuso costa un file che dichiara le sue chiavi.

**Il registro API sito per sito è nel README inglese** ([Developer reference](README.md#developer-reference-english-only)). Resta in inglese di proposito: è materiale di riferimento e la parte che invecchia più in fretta quando un sito cambia. Le traduzioni rimandano lì.

---

## Licenza

[MIT](LICENSE).
