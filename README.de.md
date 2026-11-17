# Universal Character Card Exporter

[English](README.md) · [Español](README.es.md) · [日本語](README.ja.md) · [Italiano](README.it.md) · **Deutsch** · [Русский](README.ru.md)

Eine Browser-Erweiterung, die einen Charakter von **JanitorAI**, **Emochi**, **Polybuzz**, **Character.ai**, **Crushon.ai**, **Saucepan.ai**, **Chub.ai**, **Venus.chub.ai** oder **WyvernChat** liest und als portable Charakterkarte speichert — zum Sichern oder zum Umziehen auf ein anderes Frontend. Kein Konto, kein Build, kein Server. Sie läuft in deinem Browser, mit deiner eigenen Sitzung.

**Neu in 0.12.0:** Leser für Chub.ai, Venus.chub.ai und WyvernChat, die aus dem doppelt kodierten Hydration-Speicher der Seite wiederhergestellte JanitorAI-Definition, **Save chat** für Character.ai (Tavern-JSONL, JSON, Markdown, Beispieldialog und eine Oobabooga-Paardatei) sowie alle V2/V3-Kartenfelder einschließlich der Optionen von `character_book`-Einträgen. Der PNG-Pfad wurde neu gebaut und in einem echten Browser zurückgelesen: `chara` + `ccv3`, beide vor `IDAT`, Portrait intakt. Alle Details im [Changelog](CHANGELOG.md) und im [Devlog](#devlog).

> Kostenlos und Open Source. Wenn sie dir hilft und du die ursprüngliche Arbeit unterstützen willst, schau bei [inkwell.rip](https://inkwell.rip) vorbei. Das hält Werkzeuge wie dieses am Leben.

---

## Danksagung

Dieses Projekt ist ein **Fork** von **[Character Card Extractor / JAI Card Extractor](https://github.com/erpocalypse/jai-card-extractor)** von **[erpocalypse](https://github.com/erpocalypse)**. Die ursprüngliche Erweiterung, der JanitorAI-Leser, das Panel, die Export-Pipeline und die gesamte Arbeit am Kartenformat stammen von dort.

**Wer das hier benutzt, forkt, weiterverteilt oder darauf aufbaut, muss den ursprünglichen Autor nennen und auf [github.com/erpocalypse/jai-card-extractor](https://github.com/erpocalypse/jai-card-extractor) verlinken.** Das ist eine Bedingung dieses Forks, keine Bitte.

Dieser Fork wird von **[mxchu666](https://github.com/mxchu666)** gepflegt. Er ergänzt Emochi- und Polybuzz-Unterstützung, die einheitliche Karten-Pipeline und die Dokumentation, die du gerade liest.

**Der Character.ai-Chat-Export folgt [CAI Tools](https://github.com/irsat000/CAI-Tools)** von **[İrşat (irsat000)](https://github.com/irsat000)**, der Erweiterung, die die praktische Form des Character.ai-Chat-Speicherns etabliert hat. CAI Tools diente als Funktions- und Endpunkt-Referenz; es wurde kein Code kopiert. Die ersetzte Chat-Oberfläche, die Hintergrund-/Schrift-/Speicher-Verwaltung, die Bibliothek und die Charaktersuche sind keine Exportfunktionen und werden hier daher nicht reproduziert.

**Wie dieser Fork entstanden ist.** Der Code wurde mit **OpenCode** geschrieben, das **DeepSeek v4.1-flash:free** ausführt. Jeden Prompt, den ich dem Agenten gegeben habe, habe ich auf Spanisch geschrieben und **selbst von Hand ins Englische übersetzt**, bevor ich ihn verwendet habe. Die Befunde, die Tests und die API-Notizen im Entwicklerteil sind das Ergebnis dieser Arbeit und gegen die live laufenden Seiten geprüft.

---

## Was exportiert wird

| Format | Datei | Gelesen von |
|---|---|---|
| SillyTavern-Charakterkarte | `.card.json` | SillyTavern, Tavo, Agnai, RisuAI, Inkwell, Chub — V2/V3-Leser lesen `data`, ältere Importeure lesen die flachen V1-Felder in derselben Datei |
| SillyTavern-Karte als PNG | `.png` | SillyTavern, Tavo, Chub, RisuAI, Agnai. Der einzige Container, der Portrait *und* Karte in einer Datei trägt |
| Lorebook / World Info | `.lorebook.json` | SillyTavern, Tavo |
| Character.ai-Chat | `.chat.jsonl`, `.chat.json`, `.chat.md`, `.chat.txt`, `.chat.ooba.json` | SillyTavern (JSONL), text-generation-webui (Ooba), jeder Textleser (Markdown und Beispieldialog) |
| JanitorAI-JSON | `.jai.json` | Am nächsten am Originaldatensatz |
| Klartext | `.txt` | Alles, was Text lesen kann — der einzige Weg auf Plattformen ohne Karten-Importeur (Character.ai, Crushon, Polybuzz, Emochi) |

Die Chat-Dateien werden nur auf einer Character.ai-Chatseite angeboten, weil nur dort diese Erweiterung den Chatverlauf liest. **Save chat** lädt alle fünf auf einmal herunter; du musst auf der Seite kein Format wählen.

Wenn das Ziel überhaupt eine Karte akzeptiert, nimm das PNG. Eine JSON-Karte hat in keiner Spezifikationsversion ein Bildfeld; ein PNG schon.

Alles läuft lokal. Nichts wird hochgeladen, es gibt keine Analyse und keinen fremden Code.

---

## Wie das Werkzeug tatsächlich funktioniert

Die Erweiterung besteht aus vier kleinen Teilen mit je einer Aufgabe und einer einzigen Regel, die alles zusammenhält: **jeder Seitenleser erzeugt dasselbe Kartenobjekt**.

```
Seite der Website
   │
   ├─ src/scraper.js    liest JanitorAI
   ├─ src/emochi.js     liest Emochi (Charakterseiten und Lab)
   ├─ src/polybuzz.js   liest Polybuzz
   ├─ src/cai.js        liest Character.ai + exportiert Chats
   ├─ src/crushon.js    liest Crushon.ai
   ├─ src/saucepan.js   liest Saucepan.ai
   ├─ src/chub.js       liest Chub.ai + Venus.chub.ai
   ├─ src/wyvern.js     liest WyvernChat
   │       ▲
   │       └─ src/intercept.js + src/harvest.js
   │          (Seiten, die den Datensatz nur ihrem eigenen Client geben)
           │
           ▼
     ein Kartenobjekt
     { name, creator, avatarUrl, gender, tags,
       fields: { description, personality, scenario,
                 greeting, altGreetings, exampleDialogue },
       creatorNotes, systemPrompt, postHistoryInstructions,
       extensions, lorebooks[], scriptRefs[] }
           │
           ├─ src/exporters.js  ──▶ .card.json / .png / .lorebook.json / .jai.json / .txt
           └─ src/panel.js      ──▶ die Oberfläche auf der Seite: Blockliste, Checkboxen, Export
```

1. **Lesen.** Der Leser der Seite, auf der du bist, holt den Charakter. Jeder macht es anders, weil jede Seite eine andere Oberfläche anbietet: JanitorAI hat eine interne JSON-API plus einen Hydration-Speicher in der Seite, Emochi ein Next.js-Backend mit kompiliertem Prompt, Polybuzz eine serverseitig gerenderte Nuxt-Nutzlast plus eine REST-API, Chub und Wyvern veröffentlichen Tavern-förmige Datensätze über ihre eigenen APIs, und Character.ai sowie Crushon.ai geben den Datensatz nur ihrer eigenen Seite — dort fängt die Erweiterung ab, was die Seite bereits geholt hat, statt selbst zu fragen.
2. **Normalisieren.** Der Rohdatensatz wird in das Kartenobjekt oben abgeflacht. Hier werden die Feldnamen der Seiten übersetzt: `sceneBrief` von Polybuzz wird `description`, `speechText` wird `greeting`, `templateIntro` wird `scenario`. Nichts wird erfunden. Ist ein Feld nicht veröffentlicht, bleibt es leer.
3. **Anzeigen.** Das Panel listet jeden gefundenen Block mit Checkbox und Vorschau, damit du eine eingeschleuste Jailbreak-Zeile oder einen mitgelieferten System-Prompt abwählen kannst. Der Zähler oben (`x/y kept`) sagt genau, was geschrieben wird.
4. **Exportieren.** `toBlocks()` wandelt die markierten Blöcke ins Zielformat. Der Exporter kennt die Seite nicht: Er hat nie von Emochi oder Polybuzz gehört, er kennt nur das Kartenobjekt. Deshalb bekommt jede Seite alle fünf Formate gratis.
5. **Speichern.** Ein Blob wird erzeugt und über ein `<a download>` geklickt. Nichts geht durchs Netz.

In `toBlocks()` gibt es eine bewusste Schutzregel: Ist ein Personality-Block zeichengleich mit dem Description-Block, wird er stillschweigend verworfen. Fast immer schiebt ein Server ein Feld in ein anderes, statt dass ein Autor denselben Absatz zweimal schreibt.

### Warum eine Erweiterung und keine Website

Jede dieser Seiten legt mindestens einen Teil der Daten hinter eine angemeldete Sitzung. Eine Web-App bräuchte deine Cookies; eine Erweiterung kann die Sitzung nutzen, die der Browser ohnehin hat, ohne je dein Passwort zu sehen. Genau deshalb lebt das Werkzeug dort, wo es lebt.

---

## Installation (etwa zwei Minuten)

Du musst nicht programmieren können. Es gibt nichts zu bauen oder zu kompilieren.

1. **Projekt herunterladen.** Grüner **Code**-Button auf der GitHub-Seite, dann **Download ZIP**. Entpacke es an einen dauerhaften Ort, etwa den Desktop.
2. **Erweiterungsseite öffnen.** Chrome: `chrome://extensions`. Edge: `edge://extensions`.
3. **Entwicklermodus** einschalten (Schalter oben rechts).
4. **Entpackte Erweiterung laden** und den Ordner mit der `manifest.json` auswählen.

> Wird dieser Ordner verschoben oder gelöscht, funktioniert die Erweiterung nicht mehr. Leg sie an einen dauerhaften Ort.

---

## Verwendung

### JanitorAI

1. Öffne einen Charakter auf [janitorai.com](https://janitorai.com), angemeldet.
2. Klicke unten rechts auf **Extract card**.
3. **Quick scan** liest den Charakter. **Deep scan** läuft zusätzlich durch alle angehängten Lorebooks — langsamer, vollständiger.
4. Hake ab, was du nicht willst. **Select all** / **Select none** sind dafür da.
5. Exportformat wählen.

Hat ein Charakter mehr als ein Lorebook, erscheint nach dem Deep Scan ein **Separate books**-Button, damit ein geteiltes World Book als eigene wiederverwendbare Datei gespeichert wird.

### Emochi

1. Öffne einen Charakter auf [emochi.com](https://emochi.com) (`emochi.com/character/...`).
2. **Quick scan** liest die öffentliche Nutzlast: Name, Tagline/Beschreibung, Willkommensnachricht, Tags, Avatar, Ersteller.
3. **Deep scan** fragt zusätzlich die Erstellerdefinition ab: Persönlichkeit, Szenario, Beispielgespräche. Diese Route antwortet nur für Charaktere auf **deinem eigenen Konto**; melde dich vorher an.

Manche Emochi-Charaktere haben wirklich nirgends gespeicherten Persönlichkeits- oder Szenariotext, weil die Seite sie über Tags steuert und die Persona erst im Chat erzeugt. Das ist eine Eigenschaft des Charakters, kein fehlgeschlagenes Auslesen.

### Polybuzz

1. Öffne einen Charakter auf [polybuzz.ai](https://polybuzz.ai) (`polybuzz.ai/es/character/chat/...`).
2. **Extract card** → **Quick scan**.
3. Exportieren.

Eine Polybuzz-Karte enthält, was die Seite veröffentlicht:

| Kartenfeld | Quelle in Polybuzz |
|---|---|
| Description | `sceneBrief` — die kurze Einleitung |
| Greeting | `speechText` — die Eröffnungsnachricht |
| Scenario | `templateIntro` bei Template-Bots, sonst die Regieanweisung, die der Ersteller oben in die Begrüßung geschrieben hat |
| Personality | die **Personalidad**-Tags des Erstellers (`Frío`, `Celoso`, `Tsundere`…) plus den Dialogstil, wenn veröffentlicht |
| Gender | `sceneGender`, als Zeile `Gender: Male/Female/Non-binary` in der Beschreibung |
| Tags, Avatar, Name, Ersteller | der Szenendatensatz |

### Character.ai

1. Öffne einen Charakter auf [character.ai](https://character.ai) mit aktiver Sitzung (`character.ai/character/...`).
2. Lass die Seite fertig laden, dann **Extract card** → **Quick scan**.
3. Exportieren.

| Kartenfeld | Quelle in Character.ai |
|---|---|
| Name, Ersteller, Avatar | der Charakterdatensatz |
| Description | `title` (der Slogan), gefolgt von `description` (dem About-Text) |
| Greeting | `greeting` |
| Beispielgespräch | `definition` — die Freitext-Definition des Erstellers, wenn sie öffentlich ist |

**Zur Definition.** Character.ai versteckt die Definition eines Charakters hinter einem zweiten Schalter des Erstellers, **Definition Visibility**, getrennt von der Charakter-Sichtbarkeit. Ist er aus, schickt die Seite den Text niemandem, also bleibt der Block für Beispielgespräche leer und das Panel sagt das in einer Fußnote. Alle anderen Felder sind unabhängig davon da.

Der Leser arbeitet, indem er die Anfragen der Seite beobachtet: ein kleines Skript in der Welt der Seite (`src/intercept.js`) kopiert den `Authorization`-Header in ein verstecktes Tag und sendet jede JSON-Antwort als DOM-Ereignis erneut aus, wo der Leser sie aufnimmt. Es ändert nie eine Anfrage und schickt nie eine eigene mit deinem Token. Wenn die Seite den Aufruf noch nicht gemacht hat, fragt der Leser in dieser Reihenfolge: im Kontext der Seite selbst mit dem erfassten Header und ihren Cookies, derselbe Aufruf über den Service Worker mit Cookies, die Nutzlasten und die serverseitig gerenderten Daten, und zuletzt die Charakterseite als HTML mit dem aus dem Stream geschnittenen Datensatz. Der Header wird so verwendet, wie die Seite ihn gesendet hat: Die Seite hat sowohl `Token` als auch `Bearer` benutzt, und ein neu zusammengesetztes Schema ergibt ein 401.

**Seit 0.11.2** sagt diese Spur, was jede Stufe tatsächlich zurückgegeben hat, statt `no answer`. Ein 200 zählt nur, wenn es einen Charakterdatensatz trägt, daher liest sich die Zeile jetzt `200, no character in body (status,error)` oder `200, html page instead of json` — die beiden Formen, die ein Cloudflare-Interstitial und ein verschobener Endpunkt erzeugen. Ein toter Erweiterungskontext liest sich `runtime: extension reloaded - reload this tab`, der einzige Fehler, der nichts mit Character.ai zu tun hat.

#### Save chat (der Exportpfad von CAI Tools)

Öffne einen Chat (`character.ai/chat/...`), lass ihn laden und klicke **Save chat**. Der Knopf erscheint nur auf einer Chatseite. Er lädt fünf Dateien herunter:

| Datei | Was sie ist | Wohin sie geht |
|---|---|---|
| `<name>.chat.jsonl` | Tavern-Chat: zuerst eine Metadatenzeile, dann `{name, is_user, is_system, is_name, send_date, mes}` pro Nachricht | SillyTavern → **Chat history** importieren |
| `<name>.chat.json` | Dieselbe Unterhaltung plus `chat_id`, Charakter, Quelle und Exportzeit | Archiv oder eigene Skripte |
| `<name>.chat.md` | Ein lesbares Transkript mit einer Überschrift pro Sprecher | Lesen, Teilen, Drucken |
| `<name>.chat.txt` | `<START>` gefolgt von `{{user}}:`- / `{{char}}:`-Zeilen | Der Beispieldialog-Block einer Karte |
| `<name>.chat.ooba.json` | `{internal, visible, data, data_visible}`-Paare, beginnend beim ersten Nutzerzug | text-generation-webui |

Der Turns-Endpunkt liefert Neuestes zuerst und blättert mit `meta.next_token`. Der Leser folgt ihm bis zum Ende, nimmt die durch `primary_candidate_id` benannte Antwort — die, die tatsächlich auf dem Bildschirm war — und sortiert ältestes zuerst. Bei einem langen Chat zählt die Statuszeile die Züge beim Blättern.

**Was CAI Tools tut, das hier fehlt.** CAI Tools ersetzt auch die Character.ai-Chatoberfläche, verwaltet Hintergründe, Schriften, Memory-Pins, Avatare und ein Karten-/Bibliotheks-/Suchsystem und rendert Chat-Logs mit jsPDF als PDF. Das sind Oberflächenfunktionen oder sie hängen von mitgelieferten Bibliotheken ab, also liegen sie außerhalb eines Exporteurs, der abhängigkeitsfrei bleiben muss. Die exportrelevante Hälfte — Charakterfelder, Begrüßungen, Avatar, Chat-Download in übertragbaren Formaten — ist portiert. Markdown lässt sich aus jedem Browser als PDF drucken, wenn du ein PDF brauchst.

### Crushon.ai

1. Öffne einen Charakter auf [crushon.ai](https://crushon.ai) (`crushon.ai/character/...`).
2. Lass die Seite fertig laden, dann **Extract card** → **Quick scan**.
3. Exportieren.

Crushon wird vollständig im Client gerendert, also liest der Leser den Datensatz, den die Seite selbst gerendert hat, statt eine API aufzurufen. Die Feld-Aliase decken jede Schreibweise ab, die die Seite über die Releases hinweg benutzt hat: `firstMessage` / `first_mes` / `greeting`, `description` / `introduction` / `intro`, `avatar` / `avatarUrl` / `image`, `mes_example` / `exampleDialogue` / `dialogue`. Wenn die Seite den Charakter noch nicht geholt hat, lade sie neu und scanne erneut.

**Zu den Feldnamen.** Der Importeur von Crushon bildet eine Tavern-Karte umgekehrt ab: die `personality` der Karte wird Crushons *Introduction*, die `description` der Karte wird Crushons *Personality*. Der Leser schreibt, was Crushon veröffentlicht, in das Kartenfeld, das dasselbe bedeutet — ein Durchlauf durch beide Werkzeuge lässt den Text also dort, wo er war.

### Saucepan.ai

1. Öffne einen Companion auf [saucepan.ai](https://saucepan.ai) (`saucepan.ai/companion/...`), angemeldet, wenn du die Definition und die Lorebooks willst.
2. Lass die Seite fertig laden, dann **Extract card** → **Quick scan**. **Deep scan** ergänzt die Lorebooks.
3. Exportieren.

| Kartenfeld | Quelle in Saucepan.ai |
|---|---|
| Name, Ersteller, Avatar | der Companion-Datensatz |
| Beschreibung | der Untertitel (`short_description`), dann Profil → **Description** |
| Persönlichkeit | Core → **Information**, dazu Fortgeschritten → **Advanced Prompt** und **Formatting Instructions**, wenn der Ersteller sie gefüllt hat |
| Begrüßung | der erste öffentliche Eintrag unter Nachrichten → **Starting Messages** |
| Alternative Begrüßungen | jede weitere öffentliche Startnachricht |
| Beispielgespräch | Nachrichten → **Example Dialogue** |
| Tags | die Tags des Companions plus seine Fandoms |
| Lorebooks | jedes angehängte Lorebook, ein Eintrag pro Kapitel |

**Proxies sind ein Feld, kein Riegel.** Saucepan versieht jeden Companion mit einer Provider-Richtlinie — *custom and vetted*, *vetted only* oder *internal only*, letzteres heißt kein externes Modell. Diese Richtlinie steht in der Hinweiszeile der Karte und nichts weiter hängt davon ab; ein Companion exportiert gleich, ob sein Ersteller Proxies erlaubt oder nicht.

**Warum die Beschreibung manchmal verschlüsselt aussieht.** Es ist keine Verschlüsselung, es ist eine Fragmentliste. `GET /api/v2/companions/{id}` liefert die Description als `{mask, version, fragments: [{key, proof, text}]}`, wobei die meisten Fragmente Köder mit zufälligem Text sind: `"signal glance window but"`, `"simple quiet maybe almost"`. Ein Fragment ist echt nur dann, wenn sein `proof` zu einem FNV-1a-Hash seines eigenen Textes passt, gesät mit der Maske und mit `key ^ mask`; die Überlebenden werden nach `key ^ mask` sortiert und zusammengefügt. `decodeFragments` in `src/saucepan.js` ist diese Routine, und die Tests führen sie gegen Fragmente aus einer echten Antwort aus. Ohne sie würdest du Fülltext exportieren.

**Öffentliche Companions, mit oder ohne offene Definition.** Der öffentliche Datensatz trägt immer Name, Untertitel, Description, Tags, Fandoms, Portrait und die Provider-Richtlinie, also exportiert ein öffentlicher Companion immer als Charakterkarte. Die Definition — Core, Beispielgespräch, Advanced Prompt, Formatierung — ist eine eigene Route und ein eigener Schalter des Erstellers namens **Definition Visibility**. Ist er aus, schickt Saucepan den Text an niemanden, die Karte kommt mit leeren Blöcken heraus, und das Panel nennt die Blöcke, die der Ersteller geschlossen hat. Startnachrichten werden ebenfalls nur ausgeliefert, wenn das Szenario öffentlich ist; gibt es keine, bleibt der Begrüßungsblock leer und das Panel sagt es.

**Companions, die dir gehören**, werden über `GET /api/v1/companion/editable` gelesen, das den rohen Editor-Datensatz zurückgibt: Core-Text, Beispielgespräch, Advanced Prompt, Formatierungsanweisungen und jedes Startszenario unabhängig von seiner Sichtbarkeit. Die Eigentümerschaft wird bei jedem Scan geprüft, also kommen deine eigenen Bots auch bei geschlossener Definition Visibility vollständig zurück.

### Chub.ai und Venus.chub.ai

1. Öffne einen Charakter auf [chub.ai](https://chub.ai) oder [venus.chub.ai](https://venus.chub.ai) (`/characters/ersteller/name`). Für eine öffentliche Karte ist keine Anmeldung nötig, für alles Private schon.
2. Klicke **Extract card** → **Quick scan**. **Deep scan** ergänzt das eingebettete Lorebook und jedes mit dem Charakter verknüpfte Lorebook.
3. Exportiere.

Chub ist die einfachste Seite hier, weil sie bereits Tavern-Karten speichert. Die Zuordnung ist fast eins zu eins:

| Kartenfeld | Quelle in Chub |
|---|---|
| Name, Ersteller, Avatar, Tags | `node.definition.name`, das erste Segment von `node.fullPath`, `definition.avatar`, `node.topics` |
| Description | `definition.description` — das Notizfeld des Erstellers |
| Personality | `definition.personality`, plus `definition.tavern_personality`, wenn es kein exaktes Echo ist |
| Scenario, Begrüßung, alternative Begrüßungen | `definition.scenario`, `definition.first_message`, `definition.alternate_greetings` |
| Beispieldialog | `definition.example_dialogs` |
| System-Prompt, Post-History-Anweisungen | `definition.system_prompt`, `definition.post_history_instructions` |
| Lorebooks | `definition.embedded_lorebook`, dann jede positive ID in `related_lorebooks` |

**Warum der Worker benutzt wird.** `api.chub.ai/api/characters/...` sendet kein `Access-Control-Allow-Origin`, also wird ein Fetch aus dem Seitenkontext abgelehnt, obwohl die API öffentlich ist. Der Service Worker der Erweiterung ist nicht CORS-gebunden und hält die Host-Berechtigung für `api.chub.ai`, also übernimmt er diese eine Lesung. Der Lorebook-Endpunkt sendet `*`, dort funktioniert jeder Transport.

**Duplikate werden nach Inhalt verworfen, nicht nach ID.** Ein Charakter kann ein Buch einbetten und dasselbe Buch zusätzlich als verknüpft führen. Jeder Eintrag wird auf `keys + content` reduziert; ein verknüpftes Buch, dessen Signatur mit der eingebetteten identisch ist, wird übersprungen. `-1` ist ein Sentinel in `related_lorebooks`, keine Buch-ID.

**Venus ist dieselbe Seite unter einem anderen Host.** Venus.chub.ai liefert dieselbe SPA, dieselben Pfade und dieselbe API, also decken ein Leser und ein Berechtigungssatz beide ab. Das Panel nennt den Host, von dem es gelesen hat.

### WyvernChat

1. Öffne einen Charakter auf [app.wyvern.chat](https://app.wyvern.chat) (`/profiles/ersteller/characters/name`).
2. Klicke **Extract card** → **Quick scan**. **Deep scan** ergänzt jedes mit dem Charakter verknüpfte Lorebook.
3. Exportiere.

| Kartenfeld | Quelle in WyvernChat |
|---|---|
| Name, Ersteller, Avatar, Tags | der Charakterdatensatz; `creator.vanityUrl`, dann `displayName` |
| Description | `description`, dann `visual_description`, wenn es nicht bereits wiederholt wird |
| Personality, Scenario, Begrüßung | `personality`, `scenario`, `first_mes` |
| Alternative Begrüßungen | `alternate_greetings`, plus erweiterte `greetings`, die nicht der `default`-Eintrag sind |
| Beispieldialog | `mes_example` |
| System-Prompt | `pre_history_instructions` — der Editor nennt es **System Prompt** |
| Post-History-Anweisungen | `post_history_instructions` — der Editor nennt sie **Final Instructions** |
| Charakter-Notiz | `character_note`, getragen in `extensions.depth_prompt` auf Tiefe 4 |
| Ersteller-Notizen | `creator_notes` — die **Long Description**; kann designgemäß HTML enthalten |
| Lorebooks | `GET /api/lorebooks/character/{id}` |

**Benutzerdefinierte Slugs werden aus der Seite aufgelöst.** Eine Wyvern-URL kann die interne ID (`_Ytaz4tYBerdx7zPzp14VD`) oder einen vom Ersteller gewählten Namen (`eveline`) verwenden. Die API löst nur die ID auf; fragt man sie nach dem benutzerdefinierten Namen, antwortet sie mit 404. Bei einem benutzerdefinierten Slug analysiert der Leser die serverseitig gerenderte Next.js-Flug-Nutzlast, entnimmt die `id` des Datensatzes und ruft dann die API auf. Dieselbe Nutzlast ist der Ersatzdatensatz, wenn die API sich weigert.

**Die Zuordnung folgt Wyverns eigenem Exporteur.** Sein Bundle enthält einen V2-Kartenschreiber. Dieser Schreiber ordnet `pre_history_instructions` → `system_prompt` und `character_note` → `extensions.depth_prompt.prompt` zu; dieser Leser tut dasselbe. `creator_notes` wird unverändert exportiert, auch wenn ein Ersteller sie mit einer vollständigen HTML-Profilseite gefüllt hat, weil genau das Wyverns eigener Download tut.

---

## Tavo: Warum die Karte ohne Bild ankam

Drei Fehler, geschlossen in 0.11.0 und 0.11.1.

**Das PNG war eine gültige Karte, aber nur im V2-Block.** Ein Karten-PNG trägt sein JSON in base64-kodierten `tEXt`-Blöcken: `chara` für Spezifikation V2, `ccv3` für V3. Die Erweiterung schrieb nur `chara`. Tavo liest `ccv3`, findet nichts und antwortet *„No se detectaron metadatos PNG"* auf eine völlig gültige Datei. Jetzt werden beide geschrieben, in derselben Reihenfolge und Form wie bei SillyTavern, und die Tests prüfen beide Blöcke und ihre CRCs gegen `zlib.crc32`. Die Blöcke liegen zwischen `IHDR` und `IDAT`, wo Chub sie platziert und wo ein Leser sie sieht, der am ersten Bildblock haltmacht.

**Das JSON hat kein Bildfeld.** Die Spezifikation V2/V3 ist reiner Text, deshalb legt Tavo die Figur mit leerem Portrait an. Die Erweiterung bettet das Portrait jetzt als base64-Data-URI in 512×512 (~40 KB) in `avatar`, `data.avatar` und `data.extensions.avatar` ein; liest ein Frontend eines davon, ist das Bild ohne Netzwerkanfrage da. Sind die Bytes nicht zu holen, steht dort die öffentliche URL.

**Das Portrait blieb manchmal bei den Initialen, weil der Worker nicht antwortete.** Der alte Weg lud den Avatar mit `<img crossOrigin="anonymous">`; 0.11.0 ersetzte das durch einen Aufruf des Service Workers ohne Rückfallebene. Die Emochi-CDN senden sehr wohl `Access-Control-Allow-Origin: *`, sobald die Anfrage `Origin` trägt (die frühere Messung tat das nicht) — das Problem war also nie CORS, sondern der Worker. Seit 0.11.2 wird zuerst der Worker versucht — der einzige Weg für `cdn.crushon.ai`, das ein Sitzungs-Cookie verlangt — und bei Fehlschlag das Bild direkt geladen. Kommt es auch so nicht an, nennt das Panel den Grund (`the extension was reloaded - reload this tab`, `http 403`, `decode failed`), statt still die Kachel zu zeichnen.

Chrome deaktiviert die Erweiterung nach dem Update einmal, weil das Manifest Host-Berechtigungen für diese CDN ergänzt. Auf der Erweiterungsseite wieder aktivieren.

**Welches Avatar-Feld Tavo liest — beantwortet in 0.12.0.** Tavos dokumentiertes Charakterobjekt exponiert `avatar` (eine Bild-URL oder ein Pfad), und `tavo.character.import(card)` akzeptiert entweder einen vollständigen `{spec:"chara_card_v3",data:{…}}`-Wrapper oder ein nacktes `data`-Objekt. Das APK 1.9.0 wurde entpackt und sein `libapp.so` durchsucht: Es enthält `chara_card_v2`, `chara_card_v3`, `ccv3`, `creator_notes`, `mes_example`, `alternate_greetings`, `first_mes`, `character_book` und `extensions.`, aber **kein `avatar_url`**. `data.avatar` ist also der JSON-Slot, den Tavo lesen kann; `data.extensions.avatar` und das oberste `avatar` werden für andere Leser geschrieben, nicht weil Tavo sie braucht. Der Importdialog hat weiterhin das letzte Wort: Ignoriert deine Tavo-Version dort einen Data-URI, importiere das PNG, bei dem das Bild die Datei selbst ist.

### Wenn ein Leser weiterhin „keine PNG-Metadaten" meldet

Das Panel sagt jetzt, was es gebaut hat. Die Fußzeile zeigt die laufende Version, und die Statuszeile nach einem PNG-Export listet die Textblöcke in der Datei:

```
PNG gespeichert - chara + ccv3 - 486 KB - v0.12.0.
```

Stehen dort beide Schlüssel, ist die Datei richtig und der Leser schaut woanders. Stehen sie nicht dort, ist der Export selbst gescheitert. Die Größe erlaubt den Abgleich der Datei auf der Platte mit der gerade gebauten; `- Initialen-Kachel` bedeutet, dass das Portrait nicht geholt werden konnte und die Verlaufsplatte gezeichnet wurde.

Die Datei aus dem Bericht, der diesen Abschnitt ausgelöst hat, wurde Byte für Byte geprüft: ein `tEXt`-Block, Schlüssel `chara`, vor `IDAT`, gültige CRC, und kein `avatar`-Schlüssel im JSON. Das ist die Signatur von 0.10.0. Der 0.11.x-Exporteur schreibt immer zwei Blöcke und ein `avatar`-Feld. Also zuerst:

1. **Prüfe, ob die Fußzeile `v0.12.0` sagt.** Steht dort `v0.10.x` oder `v0.11.x`, läuft im Browser ein alter Build.
2. **Erweiterung neu aktivieren, dann den Tab neu laden.** Chrome deaktiviert eine entpackte Erweiterung einmal, wenn sich ihre Berechtigungen ändern, und ein bereits offener Tab behält das alte Content-Script bis zum Neuladen. Ein Export aus diesem Tab erzeugt eine alte Datei mit neuem Namen — genau das sieht wie ein „immer noch kaputt"-Bericht aus.
3. **Erneut exportieren.** Dateien auf der Platte behalten ihre alten Bytes. Lade das PNG nach dem Neuladen erneut herunter.

Um eine Datei direkt zu prüfen: Ihr erster Textblock muss zu einem JSON-Objekt mit `"spec": "chara_card_v2"` dekodieren, der zweite zu `"chara_card_v3"`, und `data.avatar` muss existieren.

### Das Portrait war oft die Initialen-Kachel, nicht der Charakter

Das Portrait ist der einzige Teil eines Exports, der vom Service Worker der Erweiterung abhängt, also der Teil, der ausfällt, wenn der Worker nicht erreichbar ist. Mit und ohne `Origin`-Header gemessen, verhalten sich die Portrait-Hosts so:

| Seite | Portrait-Host | `Access-Control-Allow-Origin` |
|---|---|---|
| Emochi | `image-cdn.flowgpt.com`, `cdn.mokio.ai` | `*`, wenn die Anfrage `Origin` trägt |
| Polybuzz | `cdn.polyspeak.ai` | `*` |
| Character.ai | `characterai.io` | `*` |
| JanitorAI | `ella.janitorai.com` | `*` |
| Crushon.ai | `cdn.crushon.ai` | fehlt; 403 ohne Sitzungs-Cookie |
| Saucepan.ai | `saucepan.ai/cdn/<id>/card` | nicht nötig, gleiche Origin |

Die 0.11.0-Notiz in dieser Datei behauptete, die Emochi-Hosts senden keinen CORS-Header. Diese Sonde schickte kein `Origin`, und diese CDN spiegeln den Header, den sie bekommen. Mit einem Browser davor antworten `image-cdn.flowgpt.com` und `cdn.mokio.ai` mit `Access-Control-Allow-Origin: *`, und ein `<img crossOrigin="anonymous">`-Laden funktioniert — in einem echten Chromium geprüft, nicht durch Header-Lesen.

Die Initialen-Kachel war also nie ein CORS-Problem. Es war der Worker: `chrome.runtime.sendMessage` liefert nichts, wenn die Erweiterung bei offenem Tab neu geladen wurde, wenn die Host-Berechtigung nicht erteilt wurde oder wenn der Service Worker auslief. Der Exporteur nannte das einen Fehler und zeichnete die Kachel, ohne sagen zu können, welcher der drei Fälle eingetreten war.

0.11.2 ändert drei Dinge:

- **Ein zweiter Transport.** Zuerst wird der Worker versucht (er ist der einzige Weg für `cdn.crushon.ai`, das das Sitzungs-Cookie braucht), dann wird das Portrait als Cross-Origin-Bild geladen. Emochi, Polybuzz, Character.ai und JanitorAI bekommen ihr Bild jetzt auch bei totem Worker.
- **Kein dauerhafter Riegel.** Eine Karte, deren Portrait scheiterte, wird beim nächsten Export erneut versucht, statt den Fehler für die Lebensdauer des Tabs zu merken.
- **Ein Grund auf dem Bildschirm.** Die Statuszeile endet mit `- Initialen-Kachel (<Grund>)`: `the extension was reloaded - reload this tab`, `http 403`, `decode failed: …` oder `the record has no portrait URL`. Ein toter Erweiterungskontext wird als solcher benannt, statt wie ein kaputtes CDN auszusehen.

Weil das Manifest diese Portrait-Hosts nennt, deaktiviert Chrome die Erweiterung nach dem Update einmal, bis du sie auf der Erweiterungsseite wieder aktivierst.

---

## Polybuzz: Die Hintergrundinformationen sind nicht abrufbar. Hier ist der Grund.

Polybuzz' Anleitung zum Erstellen nennt sieben Bestandteile eines Charakters: Name, Geschlecht, kurze Einleitung, Begrüßung, Tags, **Hintergrund** und **Dialogstil** (dazu das Beispielgespräch, das den Stil lehrt). Eine öffentliche Seite veröffentlicht fünf davon. Die anderen zwei — `systemRole` (der Hintergrund, bezeichnet als *Antecedentes*) und `conversationExample` (die Beispielgespräche) — **werden niemandem außer dem Ersteller dieses Charakters geschickt**. Das ist kein fehlender Endpunkt und nichts, was diese oder eine andere Erweiterung umgehen könnte, denn **die Daten werden serverseitig zusammengesetzt und nie an einen Nicht-Eigentümer serialisiert**.

Die Belege, kurz:

- Das Erstellformular selbst zeigt das Feld als `Antecedentes (Visto en privado)` — *Antecedentes, privat einsehbar*. Es ist per Design eine Notiz nur für den Ersteller.
- Jede schreibgeschützte API-Route, die der Web-Client kennt, wurde gegen öffentliche Bots mit frischer Gastsitzung aufgerufen. Die einzige, die den Schlüssel überhaupt enthält, ist `scene/detailguest`, und sie liefert `""`.
- Die Eigentümerroute `scene/getscenedetail` antwortet `210002` für einen Bot, den dein Konto nicht besitzt. Dieser Code ist eindeutig: Der Server verweigert den Datensatz.
- Über alle 225 nachgeladenen JavaScript-Chunks der Seite hinweg erscheinen `systemRole` und `conversationExample` in **einer** Datei: der Erstellseite. Keine andere Seite fragt sie ab, also kann keine andere Seite sie anzeigen.
- Ein kontrollierter Test entscheidet es: Ein Bot, in dessen Antecedentes die Markierung `ZZZ-123` steht, aus einem zweiten Konto gescannt, zeigte die Markierung nie. Der Wert verlässt die Sitzung des Erstellers nicht.
- Das Modell zu bitten, seine Anweisungen zu zitieren, funktioniert auch nicht. Die Chat-Pipeline baut den System-Prompt serverseitig, und der Stream transportiert nur Textstücke. Als ein Bot nach seiner eigenen Lebensgeschichte gefragt wurde, erfand er selbstbewusst eine Kindheit, die er nicht hatte. Paraphrase ist nicht der gespeicherte Text, und diese Erweiterung gibt keine Generierung als Abruf aus.

**Was die Erweiterung stattdessen tut:** Sie nutzt die Felder, die Polybuzz tatsächlich veröffentlicht, und sagt das in einer Fußnote unter der Blockliste. Personality kommt aus den Tag-Wahlen des Erstellers, Scenario aus der Eröffnungs-Regieanweisung der Begrüßung, wörtlich. Nichts wird umformuliert, nichts erfunden.

Gehört dir der Charakter, werden die drei angemeldeten Routen bei jedem Scan weiterhin gefragt, und deine eigenen Bots kommen vollständig zurück.

---

## Wie dieser Fork entstanden ist, von Anfang bis Ende

Ein kurzer Bericht, weil die Form des Prozesses erklärt, warum die Grenzen oben verlässlich sind.

1. **Mit dem Originalwerkzeug anfangen.** Die vorgelagerte Erweiterung las bereits JanitorAI. Sie wurde die Basis, und die Regel für alles Weitere lautete: niemals das geerbte Verhalten ändern, nur daneben ergänzen.
2. **Einen Leser hinzufügen, keinen Sonderfall.** Emochi kam als `src/emochi.js`, das dasselbe Kartenobjekt füllt, sodass `exporters.js` und `panel.js` unverändert blieben.
3. **Die echte Nutzlast finden.** Emochi ist eine Next.js-App auf FlowGPTs Backend; die nützlichen Daten stecken in einem kompilierten `initPrompt`-String im öffentlichen Prompt-Objekt. Dieser String wird zurück in Persönlichkeit, Hintergrund, Szenario und Beispielgespräch geparst.
4. **Messen statt annehmen.** Die Aussage, Emochi veröffentliche für etwa ein Drittel der Charaktere eine Definition, stammt aus drei unabhängigen Live-Stichproben (30, 19 und 9 Charaktere) und deren Auszählung. Es ist ein Veröffentlichungs-Flag (`visibility: true`), kein Login-Gate.
5. **Polybuzz genauso ergänzen.** Nuxt rendert den Charakter serverseitig in die Seite, die Nutzlast liegt also als Devalue-Array im DOM. Dieses Array wird expandiert und durchsucht. Ein Content-Script sieht `window.__NUXT__` nicht, deshalb wird der `<script id="__NUXT_DATA__">`-Tag verwendet.
6. **Die API aufzählen, nicht raten.** Das JavaScript-Bundle der Seite deklariert 214 Request-Konfigurationen. Jede schreibgeschützte wurde gegen öffentliche Bots aufgerufen. So kam die Schlussfolgerung „der Hintergrund ist unerreichbar" zustande — nicht durch einen Fehlversuch, sondern durch Erschöpfen der Oberfläche.
7. **Das Negative mit einer Kontrolle beweisen.** Der `ZZZ-123`-Versuch über zwei Konten verwandelte „wir finden es nicht" in „es ist nicht da, um gefunden zu werden".
8. **Das Panel leise halten.** Ein fehlendes erstellerprivates Feld ist der Normalfall, kein Fehler. Das Panel zeigt eine Fußnote, kein Banner. Nur ein echter Ausfall (abgemeldet, keine Route antwortet) bekommt eine Meldung.
9. **Alles testen, was testbar ist.** `node --test` deckt die Leser, den Normalisierer, die Exporter und den Block-Builder ab. 137 Tests zum Zeitpunkt dieses Schreibens. Jede API-Aussage in diesem README wurde gegen die Live-Seite geprüft; nicht prüfbare sind als solche markiert.
10. **Aufschreiben.** Der Entwicklerteil existiert, damit die nächste Person es nicht neu herleiten muss.
11. **Wiederverwenden vor dem Schreiben.** Character.ai und Crushon.ai geben den Datensatz nur ihrem eigenen JavaScript, also deckt ein Mechanismus beide ab: ein Sniffer in der Welt der Seite und ein bewertender Durchlauf über die Nutzlasten. Eine neue Datei pro Seite, zwei geteilte, und die Exporter blieben unberührt.
12. **Die Herkunft eines Ansatzes nennen.** Das Interception-Muster stammt von [taquantas Exporter](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), und die Nennung steht oben in der Datei und in diesem README, nicht nur in einer Commit-Nachricht.
13. **Sagen, was nicht geprüft ist.** Beide neuen Seiten antworten einer Maschine ohne Browser mit Cloudflare `403`; die Verträge sind also dokumentiert, der Live-Lesetest nicht. Das steht an drei Stellen, statt übergangen zu werden.
14. **Den eigenen Exporteur der Seite lesen, wenn sie einen hat.** Wyvern liefert einen V2-Kartenschreiber im Bundle. Ihn zu extrahieren klärte `pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt` und `creator_notes` als Long Description. Eine aus dem Produktcode kopierte Zuordnung schlägt eine aus der Oberfläche geratene.
15. **Nicht annehmen, die API sei der ganze Datensatz.** JanitorAI schreibt denselben Charakter als `window.mbxM.push(JSON.parse("…"))` in die Seite, einen JSON-String in einem JSON-Dokument. Die API sagte, die Definition sei null; die Seite trug den Datensatz. Das Hydration-Script zu parsen war der Unterschied zwischen einer Zusammenfassung und einer Karte.
16. **Funktionen portieren, nicht Code.** CAI Tools definierte die praktischen Chat-Formate; der Leser schreibt sie mit eigenem Code, hält die Regel ohne Abhängigkeiten ein und sagt, welche CAI-Tools-Funktionen Oberfläche sind und daher außerhalb des Umfangs liegen.

**Dieses Werkzeug ist in aktiver Entwicklung und wird weiter aktualisiert.** Neue Seiten kommen dazu, kaputte Leser werden repariert, und die API-Notizen werden korrigiert, wenn eine Seite sich ändert. Wenn etwas bricht, liegt es meist daran, dass eine Seite ihre Nutzlast verändert hat — und das ist behebbar.

---

## Devlog

Die Aufzeichnung, wie jedes Release tatsächlich erreicht wurde: was versucht wurde, was scheiterte und was der Fehlschlag gelehrt hat. Neuestes zuerst. Die Kurzfassung steht im [Changelog](CHANGELOG.md); das hier ist die lange.

### 0.12.0 — drei Seiten, ein Hydration-Speicher und die Export-Hälfte von CAI Tools

**Chub war die erste Seite, die keinen Übersetzer brauchte.** Die Charakter-API liefert ein `definition`-Objekt, dessen Schlüssel bereits Taverns sind: `description`, `personality`, `scenario`, `first_message`, `alternate_greetings`, `example_dialogs`, `system_prompt`, `post_history_instructions`, `tavern_personality`, `embedded_lorebook`. Die Arbeit war nicht die Feldzuordnung, sondern der Transport. Der Charakter-Endpunkt sendet kein `Access-Control-Allow-Origin`, also stirbt ein Fetch aus der Seite, obwohl die API öffentlich ist. Den Worker gab es schon für Emochi und Polybuzz, also wanderte die Lesung dorthin, unter einer Host-Berechtigung für `api.chub.ai`. Lorebooks waren die zweite Frage: `related_lorebooks` trägt IDs, `-1` ist ein Sentinel, und ein Buch kann sowohl eingebettet als auch verknüpft sein. Jedes Buch auf eine `keys + content`-Signatur zu reduzieren und exakte Wiederholungen zu verwerfen genügte; keiner ID-Liste wurde vertraut.

**Wyvern sah nach einem Custom-Slug-Problem aus und war ein Nutzlast-Problem.** `/api/characters/{id}` ist sauber, aber die URLs der Seite nutzen einen vom Ersteller gewählten Slug, und `eveline` ist keine ID. Die API antwortet auf den Namen mit 404. Die Seite rendert jedoch den ganzen Datensatz in eine Next.js-Flug-Nutzlast. Die `self.__next_f.push`-Blöcke zu parsen und den Datensatz per Klammerabgleich zu schneiden liefert sowohl die ID als auch einen Ersatz. Dann beantwortete das Bundle die Zuordnungsfrage besser als jede Vermutung: Wyvern enthält einen eigenen V2-Schreiber, und dieser Schreiber sagt `system_prompt: e.pre_history_instructions`, `post_history_instructions: e.post_history_instructions`, `creator_notes: e.creator_notes` und `depth_prompt.prompt: e.character_note`. Beim Lesen wurden zwei 0.12.0-Fehler gefunden: Der erste Leser verlor den 935 Zeichen langen System-Prompt, weil er `system_prompt` betrachtete, und behandelte erweiterte `greetings`-Objekte als Strings. Beide sind behoben, und die Tests nutzen die Feldnamen der Seite selbst.

**JanitorAIs Definition fehlte nicht; sie war escaped.** Die API antwortet einer anonymen Anfrage weiterhin mit `personality: null` und `showdefinition: true`, was wie ein Widerspruch wirkt, bis man die Seite untersucht. Die Vite-App hydratisiert ihre Stores mit `window.mbxM.push(JSON.parse("{\"SJ--a:a-a--characterStore\":{…}}"))` — ein JSON-String-Literal, das ein JSON-Dokument enthält. Der alte Seitenleser suchte nach dekodiertem `{"id":…}` und fand nichts. `scriptPayloads()` parst jetzt das Literal und dann das Ergebnis, und der bewertende Durchlauf findet das Charakterobjekt im Store. Dieselbe Nutzlast wird für einen angemeldeten Leser die Definition tragen, weil sie die Kopie ist, die der Server für diese Sitzung gerendert hat. Der anonyme Datensatz bleibt eine Zusammenfassung, und das Panel sagt das jetzt präzise: Der Ersteller hat die Definition als öffentlich markiert, aber diese Sitzung hat sie nicht erhalten. Das ist eine andere Meldung als „der Ersteller hat sie versteckt", und der Unterschied zählt in einem Fehlerbericht.

**CAI Tools wurde zerlegt, nicht kopiert.** Sein Chat-Exporteur definiert fünf Formate: lesbar, Tavern-JSONL, Oobabooga-JSON, Definitionstext und PDF. Die ersten vier passen zur Regel ohne Abhängigkeiten. Die Tavern-Datei brauchte ihre Metadatenzeile und `is_name`; die Oobabooga-Datei brauchte Paar-Zusammenführung und einen Start beim ersten Nutzerzug. Beide werden jetzt erzeugt, zusammen mit einem JSON-Archiv, Markdown und dem Beispieldialog. PDF wurde bewusst weggelassen: Es nutzt jsPDF und Avatare, und ein originalgetreues Unicode-PDF ohne mitgelieferte Schrift ist hier nicht möglich. Das Markdown druckt der Browser als PDF. Der Rest von CAI Tools — Chatseiten-Ersatz, Hintergründe, Schriften, Memory-Pins, Bibliothek, Suche — ist kein Exporteur und wird nicht reproduziert.

**Das PNG wurde im Browser geprüft, nicht nur in Node.** Ein echter JanitorAI-Datensatz wurde gelesen, mit einem Lorebook-Eintrag versehen, mit seinem echten Portrait auf eine 512×512-Kachel gezeichnet und als PNG geschrieben. Dann wurde die Datei zurückgelesen: `IHDR, tEXt (chara), tEXt (ccv3), IDAT…`; beide Base64-Blöcke dekodierten zu gültigem V2/V3-JSON mit dem Bucheintrag; der Portrait-Transport meldete `cors`, nicht die Initialen-Kachel. Das ist der End-to-End-Beweis, den Unit-Tests nicht liefern können: Canvas, `btoa`, `TextEncoder`, CRCs und Blockplatzierung in demselben Browser, der die Erweiterung ausführt.

**Was weiterhin nicht verifiziert ist.** Angemeldete Lesungen von JanitorAI, Character.ai und Crushon.ai bleiben unerreichbar: Die Hosts antworten der Maschine, auf der dies gebaut wurde, mit Cloudflare 403, und der eingebaute Browser hat keine Kontositzung. Die Verträge sind dokumentiert; die angemeldete Lesung nicht. Chub, Venus' API, Wyverns ID- und Custom-Slugs, JanitorAIs anonyme Lesung und die Wiederherstellung aus dem Hydration-Speicher wurden gegen die Live-Seiten ausgeführt.

### 0.11.2 — das Portrait, das nur im Panel existierte

**Zwei Karten wurden als graue Buchstaben exportiert, und die Datei sagte, warum.** Die beiden Alana-Flores-PNGs trugen `chara` + `ccv3` an der richtigen Stelle, und `data.avatar` hielt die korrekte `image-cdn.flowgpt.com`-URL. Die Karte war also in Ordnung, und das Bild war nie geholt worden: `prepareAvatar()` war gelaufen, `requestImage()` war leer zurückgekommen, und die Initialen-Kachel wurde gezeichnet. Das Panel zeigte das Foto weiterhin, weil die Vorschau ein einfaches `<img>` ist und keine Erweiterungsmechanik braucht.

**Die 0.11.0-Erklärung dafür war falsch, und erneutes Messen zeigte warum.** Jene Version sagte, `image-cdn.flowgpt.com` und `cdn.mokio.ai` senden kein `Access-Control-Allow-Origin`. Die Sonde dahinter schickte keinen `Origin`-Header. Schick einen — was jeder Browser tut — und beide Hosts antworten `Access-Control-Allow-Origin: *`. Der CDN war also nie das Problem; der Worker war es. Ein `<img crossOrigin="anonymous">`-Laden des Portraits funktioniert, und 0.11.0 hatte genau das durch einen Worker-Aufruf ohne Rückfall ersetzt. Beide Zweige wurden dann in einem echten Chromium ausgeführt: zuerst `avatarSource=worker`, ein 99-KB-Data-URI und ein 526-KB-Karten-PNG. Dann wurde `https://*.flowgpt.com/*` aus dem Manifest entfernt, damit der Worker den CDN nicht erreicht — `avatarSource=cors`, dieselben Bytes, dasselbe Portrait.

**Was sich ändert.** Der Worker bleibt der erste Transport, weil `cdn.crushon.ai` ohne das Sitzungs-Cookie mit 403 antwortet und nur der Worker es trägt. Das CORS-Laden ist der Rückfall. Der dauerhafte `avatarReady`-Riegel ist weg, also wird eine Karte, die einmal scheiterte, beim nächsten Export erneut versucht. Und die Statuszeile nennt den Fehler — `- Initialen-Kachel (worker unreachable: the extension was reloaded - reload this tab)` oder `- Initialen-Kachel (http 403)` statt einer Design-Entscheidung. Der Character.ai-Fehler im selben Bericht war dieselbe fehlende Information: Seine Spur endete bei jedem Worker-Schritt in `no answer`, was ein verlorener Erweiterungskontext aus einem Content-Script so aussieht. Jetzt meldet der Leser den Runtime-Fehler, und ein 200 ohne verwertbaren Inhalt sagt, welche Form es bekam.

### 0.11.1 — die Datei stammte vom Build vor der Korrektur

**Der Bericht sagte, der neue Export scheitere weiterhin. Die Datei sagte das Gegenteil.** Ein fehlschlagendes PNG war angehängt, also wurde zuerst die Datei geparst statt der Code. Blockliste: `IHDR`, ein `tEXt` (`chara`, 2170 Bytes), `IDAT` wiederholt, `IEND`. CRC gegen `zlib.crc32`: gültig. Base64-Nutzlast: die Karte. Pillow öffnet sie als 512×512 RGBA und zeigt denselben Textblock. Nichts falsch außer einem Textblock statt zwei und keinem `avatar`-Schlüssel im JSON — genau das, was 0.10.0 schrieb. Der 0.11.0-Exporteur schreibt `chara` + `ccv3` und ein `avatar`-Feld. Der Browser lief also noch mit dem alten Content-Script: Chrome deaktiviert eine entpackte Erweiterung, wenn sich ihre Berechtigungen ändern, und ein bereits offener Tab behält das alte Script bis zum Neuladen. Ein Export aus diesem Tab erzeugt eine alte Datei mit neuem Namen, was identisch zu „die Korrektur hat nicht funktioniert" aussieht.

**Die Referenzkarte wurde heruntergeladen und zerlegt.** Chub veröffentlicht seine Karte als `avatars.charhub.io/.../chara_card_v2.png`, und Tavos eigener Importleitfaden verweist auf Chub. Diese Datei: `IHDR, tEXt (chara), IDAT…, IEND`, ein `data.avatar`-Feld und ein vollständiges `character_book`. Kein `ccv3`. Das Layout dieses Exporteurs entspricht ihr jetzt, mit `ccv3` nach `chara` — beide Blöcke vor `IDAT`, die Position, die ein Leser noch sieht, der am ersten Bildblock haltmacht. Daraus kamen zwei Änderungen, die mehr wert sind als die Korrektur: Das Panel druckt, was es gebaut hat (die Version in der Fußzeile und `PNG saved - chara + ccv3 - v0.12.0.` beim Export), und das JSON schreibt die flachen V1-Felder neben `data`, weil Leser vor V2 nie in `data` schauen — Agnais Importeur, Pygmalion, die Gradio-Loader. Eine Datei, zwei Generationen.

### 0.11.0 — die Karte war gültig, der Leser wollte den anderen Block

**Zwei Berichte, ein Dateiformat.** Ein von Tavo mit *„No se detectaron metadatos PNG"* abgelehntes PNG und ein JSON-Import, der den Charakter lud, aber das Portrait leer ließ. Beides wurde gegen die Datei reproduziert, die die Erweiterung tatsächlich schreibt, nicht gegen die Seite.

**Das PNG war eine gültige V2-Karte.** Blockreihenfolge, Längenfelder und CRC32s wurden Byte für Byte gegen `zlib.crc32` geprüft: Signatur, `IHDR`, ein `tEXt`-Block unter dem Schlüssel `chara` mit dem Base64-JSON, dann die Bilddaten unverändert. Nichts war fehlerhaft. Es fehlte der zweite Block. SillyTavern schreibt `chara` und `ccv3`; Tavo sucht zuerst `ccv3` und meldet keine Metadaten, statt auf den anderen zurückzufallen. Ein Block war der ganze Unterschied zwischen einer abgelehnten und einer akzeptierten Datei. Jetzt werden beide geschrieben, in dieser Reihenfolge, und der Test prüft die vollständige Liste `IHDR, tEXt, tEXt, IDAT, IEND` mit jeder CRC gegen zlib.

**Das JSON hatte nie einen Bild-Slot.** Die V2/V3-Spezifikation ist reiner Text. Tavos JSON-Import legt den Charakter daher immer mit leerem Portrait-Picker an, genau wie im Screenshot. Die einzige Möglichkeit, ein Bild in eine JSON-Datei zu bringen, ist ein Data-URI, also bettet der Export jetzt ein 512×512-JPEG (~40 KB) in `avatar`, `data.avatar` und `data.extensions.avatar` ein. Liest ein Frontend eines davon, kommt das Bild ohne Netzwerkanfrage an. Tavo ist dokumentiert als App, die das Bild aus dem PNG oder dem Picker nimmt; die ehrliche Antwort für diese App lautet also: PNG für Bild und Karte zusammen, JSON für Text.

**Der Avatar scheiterte, bevor er begann.** Der alte Code lud das Portrait mit `crossOrigin = "anonymous"`, was `Access-Control-Allow-Origin` auf der Bildantwort verlangt. Die fünf CDNs zu sondieren beantwortete die Frage direkt: `image-cdn.flowgpt.com` und `cdn.mokio.ai` ohne Header, `cdn.polyspeak.ai`, `characterai.io` und `ella.janitorai.com` mit `*`, `cdn.crushon.ai` mit 403 ohne Cookie. Für Emochi erhielt das CORS-Laden nicht einmal ein Byte, also fiel der Export still auf die Initialen-Kachel zurück und sah aus, als hätte er funktioniert. Jetzt geht das Portrait über `background.js` mit einer Host-Berechtigung pro CDN, kommt als Base64 zurück und wird mit `createImageBitmap` dekodiert, was kein CORS braucht und den Canvas nicht verunreinigen kann. Ein fehlgeschlagener Fetch fällt weiterhin auf die Kachel zurück, aber jetzt bedeutet ein Fehler ein fehlgeschlagener Fetch, nicht ein falscher Modus. Das kostet fünf neue Host-Berechtigungen, also deaktiviert Chrome die Erweiterung beim Update einmal, bis sie wieder aktiviert wird.

### 0.10.0 — Saucepan und die Beschreibung, die in Stücken ankommt

**Die Seite ist nicht, was sie von außen zu sein scheint.** `api.saucepan.ai` setzt die Verbindung für alles zurück, was kein Browser ist, was normalerweise Cloudflare und eine Sackgasse bedeutet. War es nicht: Die Basis-URL der App ist die leere Zeichenkette, also geht jeder Aufruf an `https://saucepan.ai/api/...` und wird am Edge proxyiert. Gleiche Origin, kein CORS, und ein statischer Header, den der Client auf jede Anfrage stempelt (`cf-edge-token-8af3`). Diese eine Entdeckung machte die ganze Seite ohne Browser lesbar.

**Dann der Feldvertrag, aus dem Bundle statt aus einer Vermutung.** Die App liefert ein 9,8-MB-Bundle mit der ganzen API. Es deklariert 666 Anfragepfade. Das Validierungsschema des Companion-Editors nennt jedes Feld, das die Seite speichert — `card`, `full_description`, `short_description`, `example_dialogue`, `starting_scenarios[]`, `advanced_prompt`, `formatting_instructions`, `hidden_fields`, `external_model_policy` — und die Profilkomponente nennt jedes Feld, das sie rendert. Zwei Formen, ein Produkt; der Unterschied zwischen ihnen ist die Geschichte dieser Version.

**Die Beschreibung ist eine Fragmentliste mit Ködern.** Der erste echte öffentliche Companion lieferte vierundfünfzig Fragmente für die Description, sieben davon echt. Die Köder sind grammatikalisches Rauschen aus einem kleinen Wortvorrat — *signal*, *glance*, *window*, *pattern*, *gentle*, *quiet* —, sodass sie auf den ersten Blick wie Prosa wirken und eine naive „nimm die längsten Strings"-Heuristik überleben. Die Unterscheidung steckt im Client: Jedes Fragment trägt einen `proof`, und echt ist es nur, wenn dieser Proof einem FNV-1a-Hash des eigenen Textes mit einem aus der Maske und aus `key ^ mask` abgeleiteten Seed entspricht. Die echten werden nach `key ^ mask` sortiert und verbunden. Sieben Fragmente ergaben wieder 137 Zeichen sauberen Text. Die Routine ist `decodeFragments`, geprüft gegen Fragmente aus der Live-Antwort. Startnachrichten nutzen dieselbe Struktur in `starting_scenarios_fragments[].message`; ein privates Szenario fehlt einfach, und ein leerer Slot wird als Sentinel `≠≠≠BLANK_SCENARIO≠≠≠` gespeichert, den der Leser verwirft.

**Proxies waren die Frage, und die Antwort ist `providers_profile`.** Das Feld heißt `external_model_policy` im Editor und `providers_profile` im öffentlichen Datensatz: `custom_and_vetted`, `vetted_only`, `internal_only`. Es entscheidet, welches Modell der Chat aufrufen darf, nicht was das Profil ausliefert, also wird es in der Notizzeile gemeldet und für nichts anderes genutzt. Beide Richtlinien exportieren identisch. Es gibt zwei Lesepfade, weil ein öffentlicher Companion zwei Sichtbarkeitsschalter hat: Der öffentliche Datensatz ist anonym und trägt immer die Description; die Definition ist ein zweiter Aufruf, braucht den Bearer aus `localStorage["hallucination/auth_token"]` und wird abgelehnt, wenn der Ersteller Definition Visibility geschlossen hat. Ein eigener Companion hat einen dritten Weg, `/api/v1/companion/editable`, der den rohen Editor-Datensatz liefert und sich nicht um Sichtbarkeit kümmert. **Was nicht verifiziert wurde:** Die Definitions- und Editable-Routen brauchen eine Sitzung, also stammen ihre Formen aus dem Client-Code, der sie konsumiert, nicht aus einem angemeldeten Aufruf; die öffentliche Route, der Fragment-Decoder, die Provider-Richtlinie und die Szenario-Fragmente wurden gegen Live-Companions ausgeführt. 103 Tests, 11 davon neu.

### 0.9.0 — zwei geschlossene Seiten, ein Mechanismus und ein Emochi-Parser mit drei Fehlern

**Emochi zuerst, weil es die Priorität war.** Zwei Meldungen waren offen: fehlende Persönlichkeit und fehlendes Szenario bei manchen Bots, und `characterExampleConversation`, das nie auf der Karte ankam.

Der Fehler mit den Beispielgesprächen war in zehn Minuten erledigt. Die Definitionsroute liefert `characterExampleConversation` als **Array von Zügen**, und der Leser wandte `String(...)` darauf an. Ein Array wird in manchen Laufzeiten zu `"[object Object],[object Object]"` und im `s()`-Helfer des Normalisierers zu `""` — in keinem Fall Dialog. Jetzt wird es als Züge geparst, und der Parser akzeptiert `{role, content}`, `{user, ai}`, `{isUser, text}` und einen `{dialogue: [...]}`-Wrapper, weil Emochis eigener Recorder die erste Form nutzt, die Karten-Importeure die zweite, und die übrigen in Datensätzen von vor einem Schemawechsel auftauchen.

Der Fehler mit der Persönlichkeit dauerte länger und bestand aus drei gestapelten, getrennten Defekten:

1. **Die Schlussanweisung wurde als Grenze behandelt.** Jeder kompilierte Prompt endet mit `Do not write as {{user}} or assume {{user}}'s reaction or response.` Der Leser schnitt dort ab und verwarf den ganzen Rest. Das ist richtig für einen Prompt, der mit der Regel endet — also für den, den der Compiler erzeugt. Es ist falsch, sobald ein Ersteller die Regel in seinem eigenen Hintergrund oder Beispielgespräch zitiert, und das passiert häufiger als man denkt: Leute fügen die Regel absichtlich in ihr Beispiel ein, um sie dem Modell beizubringen. Jeder Abschnitt nach dem Zitat verschwand. Die Korrektur: den Satz dort entfernen und den umgebenden Text behalten.
2. **Die Abschnittsgrammatik akzeptierte genau eine Formulierung.** Die Marker waren `'s personality:`, `'s background:`, `scenario of role-play:`. Wer `Personality:` schrieb — großes P, kein Possessiv, weil er seinen eigenen Prompt statt des Builders nutzte — bekam ein leeres Ergebnis, und der ganze Prompt fiel in den Zweig „keine Marker, behandle es als Persönlichkeit“. Es gibt jetzt einen zweiten, zeilenverankerten Markersatz, der die Abweichung toleriert, und der Durchlauf mit mehr erkannten Abschnitten gewinnt. Bei Gleichstand bleibt die strenge Grammatik, damit Compiler-Prompts exakt wie vorher geparst werden.
3. **Der Hinweis auf leere Abschnitte war eine Vermutung.** Der Leser sagte „der Ersteller hat Persönlichkeit und Beispielgespräch leer gelassen“, sobald diese Felder leer blieben — auch wenn der Parser das Layout gar nicht erkannt hatte, die Felder also wegen des Parsers leer waren. Der Hinweis feuert jetzt nur noch, wenn auch die Namenszeile erkannt wurde, das Layout also wirklich verstanden war.

Alle drei sind durch Tests abgedeckt, die aus den scheiternden Formen geschrieben wurden, nicht aus den funktionierenden.

**Dann Polybuzz' Beispielgespräche.** Im Ticket war ein Screenshot des *Estilo de diálogo*-Editors: Zeilen mit Avatar daneben sind `{{user}}`, Zeilen ohne sind `{{char}}`. Das Bundle der Erstellungsseite bestätigte die Form: `dialogueStyleObj` ist ein Array aus `{user, ai}`-Paaren, ein Eintrag pro Austausch, und der Detaildatensatz gibt es unter `dialogueStyle.dialogue` zurück. Beides wird jetzt in Kartenzeilen geparst. Der flache `conversationExample`-String ist dieselben Daten als `user;ai` pro Zeile, und auch diese Form wird umgeschrieben.

Eine Falle: ein reiner String unter `dialogueStyle` ist das **Stil-Label** (`Descriptivo, frases cortas`), kein Dialog. Die erste Version des Parsers schrieb fröhlich ein Stil-Label in `{{char}}: Descriptivo, frases cortas` um und steckte es in den Beispielblock. Die Tests fingen es. Strings werden jetzt nie Dialog; nur Arrays und `user;ai`-Text.

**Dann Character.ai.** Der Ansatz stammt von [taquantas Exporter](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter), der dasselbe Problem gelöst hat: Den Datensatz holt nur das JavaScript der Seite selbst, mit einem `Authorization: Token <hex>`-Header, den die Erweiterung nicht ausstellen kann. Die Referenzimplementierung führt ein Skript in der Welt der Seite (`MAIN`) aus, überschreibt `fetch` und `XMLHttpRequest` und legt den Header im DOM ab. Das ist der einzige Weg, einen Header zu sehen, den der Browser außerhalb deines Kontexts hinzufügt.

Zwei Änderungen daran. Das Token landet in einem Meta-Tag mit eigenem Namensraum statt in einem, das kollidieren kann. Und jede JSON-Antwort, die die Seite erhält, wird als DOM-Ereignis erneut ausgesandt, das einen **String** trägt — Objekte überqueren die Grenze zwischen einem `MAIN`-Skript und einem isolierten Content-Script nicht, Strings schon. Diese eine Änderung machte aus dem Sniffer „Token fangen und Aufruf wiederholen“ ein „Token *und* Antwort fangen“, sodass der Leser auch dann funktioniert, wenn die Wiederholung abgelehnt wird.

Die Definition ist das interessante Feld. Character.ai legt sie hinter **Definition Visibility**, einen zweiten Schalter getrennt von der Charakter-Sichtbarkeit, und ist er aus, wird der Text niemandem geschickt. Eine Karte mit leerem Beispielblock ist also eine Einstellung des Erstellers, kein Fehlschlag beim Lesen, und das Panel sagt genau das, statt einen Fehler zu zeigen.

**Dann Crushon.ai.** Vollständig im Client gerendert, hinter einer Bot-Mauer. Es gibt keine öffentliche API zum Wiederholen, und die Aufrufe der Seite tragen Sitzungszustand, also ruft der Leser nichts auf: er läuft durch die Nutzlasten, die die Seite schon erhalten hat, und bewertet jedes Objekt danach, wie viele bekannte Feldnamen es trägt. Der reichste Treffer gewinnt. Die Aliase decken die Schreibweisen ab, die die Seite über Releases hinweg genutzt hat, denn eine verpasste Schreibweise kostet das ganze Feld.

Der gemeinsame Teil beider Leser ist `src/harvest.js`: Nutzlast-Sammlung, Token-Rücklesen und der bewertende Durchlauf. Zwei neue Leser, zwei geteilte Dateien, null Änderungen an `exporters.js` oder `panel.js` — die Regel, dass jeder Seitenleser dasselbe Kartenobjekt füllt, machte das möglich, und sie ist der Grund, warum die nächste Seite eine Datei kostet.

**Was nicht geprüft werden konnte.** Beide neuen Hosts antworten der Maschine, auf der das gebaut wurde, mit Cloudflare `403`; keiner der beiden Leser lief also gegen einen angemeldeten Browser. Geprüft wurde: der neo-Endpunkt lebt und antwortet einer synthetischen ID mit `{"status":"NOT_OK","error":"bad request"}`, also beschwert sich die Route über den Body, nicht über den Aufrufer. Die Feldverträge stammen aus taquantas funktionierender Implementierung. Es steht als ungeprüft im Changelog, in der To-do-Liste und hier, weil ein nicht ausgeführter Leser eine andere Behauptung ist als einer, der lief.

### 0.8.0 — der Fork bekommt einen Namen und sechs Sprachen

Das Repository trug noch seinen ursprünglichen Namen, während es vier Seiten unterstützte. Umbenannt in **Universal Character Card Exporter**, was es tut. Issues wurde gleichzeitig aktiviert, weil der Abschnitt zum Melden von Fehlern die Leute auf einen Tab schickte, den es nicht gab.

Die Dokumentation ging in einem Durchgang auf sechs Sprachen. Die API-Referenz pro Seite bleibt auf Englisch und sagt das oben im Abschnitt: Es ist Referenzmaterial, das am schnellsten veraltet, und sechs Kopien eines veralteten Dokuments sind sechsmal die Pflege ohne Gewinn. Die Übersetzungen verlinken dorthin.

Der Polybuzz-Abschnitt wurde neu geschrieben. Vorher stand dort „nicht abrufbar“ als Schlussfolgerung. Jetzt steht die Evidenz darunter — das privat-by-design-Label im Erstellungsformular, der erschöpfende Routen-Sweep, das `210002` beim Bot eines anderen, der `ZZZ-123`-Kontrolltest auf zwei Konten. Ein behauptetes negatives Ergebnis ist nichts wert; ein negatives Ergebnis mit angehängter Methode ist etwas wert.

### 0.7.13 — Persönlichkeit aus den Tags des Erstellers

Polybuzz veröffentlicht weder Hintergrund noch Persönlichkeitsfeld, was Karten mit leerem Personality-Block hinterließ. Der Tag-Baum wurde ohnehin für die Tag-Liste der Karte geholt, also wurde er genauer gelesen: Jeder Tag liegt unter einem von vier Eltern, und `Personalidad` enthält 41 Temperamentswörter, die der Ersteller von Hand wählt. Das ist die Charakterisierung des Erstellers, von ihm geschrieben, von der Seite veröffentlicht.

Die Verknüpfung ist in einem präzisen Sinn ehrlich: Genre-, Herkunfts- und Identitäts-Tags bleiben aus Personality heraus und in der Tag-Liste, und ein echter `systemRole` schlägt die Tags weiterhin, wenn es einen gibt. Gemessen an 10 Live-Bots: 10/10 ergaben einen echten Personality-Block. Eine Tag-Liste ist dünner als ein geschriebener Hintergrund, aber es sind die Worte des Erstellers statt einer Vermutung.

### 0.7.10 – 0.7.12 — ein Echo ist kein Feld

Drei Releases, eine Idee. `getsceneconfig` mit einer Szenen-ID antwortet mit dem kompilierten Einleitungstext als Fallback. Fünf angemeldete Scans von Bots, die das Konto nicht besitzt, ergaben ein `systemRole`, das zeichengleich mit `sceneBrief` war. So rendert der Server einen leeren Hintergrund, nicht ein zweites Feld, das zufällig übereinstimmt. Ein exaktes Echo gilt jetzt als Abwesenheit, jede Route behält ihre eigene Antwort statt der ersten nicht-leeren, und das Panel zeigt eine Fußnote statt eines Banners, weil ein erstellerprivates Feld der Normalfall ist.

Das Szenario kam aus derselben Arbeit: Polybuzz-Begrüßungen beginnen oft mit einer Regieanweisung (`*Bangchan es tu esposo*`), und das ist die Prämisse des Erstellers. Sie wird wortgleich übernommen, wenn der Datensatz kein `templateIntro` trägt. Paraphrasiert wird nie etwas.

---

## Changelog

Vollständige Release-Historie mit jeder Korrektur und ihrem Grund: **[CHANGELOG.md](CHANGELOG.md)**.

Kurzfassung:

| Version | Was kam |
|---|---|
| 0.12.0 | Leser für Chub.ai, Venus.chub.ai und WyvernChat; JanitorAI-Definition aus dem Hydration-Speicher wiederhergestellt; **Save chat** für Character.ai (Tavern-JSONL, JSON, Markdown, Beispieldialog, Oobabooga); vollständige `character_book`-Einträge und Karten-Erweiterungen; PNG in einem echten Browser geprüft; 137 Tests |
| 0.11.2 | Portrait überlebt einen ausgefallenen Worker (Worker, dann direkte Ladung), Fehler werden benannt, die Character.ai-Spur nennt jede Antwort; 111 Tests |
| 0.11.1 | Panel zeigt die laufende Version und die geschriebenen PNG-Blöcke; das JSON trägt auch die flachen V1-Felder; 107 Tests |
| 0.11.0 | PNG mit `chara` + `ccv3`, Portraits über den Worker geholt, damit ein CDN ohne CORS nicht mehr die Initialen liefert, JSON mit dem Portrait als Data-URI; 106 Tests |
| 0.10.0 | Leser für Saucepan.ai: Fragment-Dekodierung, zwei Lesepfade, Lorebooks, Provider-Richtlinie in der Hinweiszeile; 103 Tests |
| 0.9.1 | Character.ai: Auth-Schema beibehalten, Kaltstart-Leiter, Fallback auf gerenderte Daten, 92 Tests |
| 0.9.0 | Leser für Character.ai und Crushon.ai, Polybuzz-Beispielgespräche, Emochi-Parser-Korrekturen, Emochi Lab, 92 Tests |
| 0.8.0 | Umbenennung, Dokumentation in sechs Sprachen, Credit-Abschnitt, Polybuzz-Evidenz neu geschrieben, Issues aktiviert |
| 0.7.13 | Polybuzz-Personality aus den `Personalidad`-Tags des Erstellers |
| 0.7.12 | Polybuzz-Szenario aus der Regieanweisung der Begrüßung |
| 0.7.11 | Kandidaten pro Route, damit ein Echo keinen echten Hintergrund verdeckt |
| 0.7.10 | Gesprächsbewusste Config-Kette, leises Panel |
| 0.7.0 – 0.7.9 | Polybuzz-Unterstützung, von Anfang bis Ende |
| 0.6.0 – 0.6.1 | Emochi-Leser und Tiefenscan der Prompt-Historie |
| 0.5.0 und früher | JanitorAI, übernommen aus erpocalypses ursprünglicher Erweiterung |

---

## To-do

- [x] **Unterstützung für Character.ai hinzufügen.** Erledigt in 0.9.0. Die Definition hängt weiterhin am Definition-Visibility-Schalter des Erstellers.
- [x] **Unterstützung für Crushon.ai hinzufügen.** Erledigt in 0.9.0, liest, was die Seite rendert.
- [x] **Priorität — Emochi: Bei manchen Bots fehlen Persönlichkeit und Szenario.** Behoben in 0.9.0. Drei Ursachen, alle im Parser: die Schlussanweisung wurde als Schnittgrenze behandelt, die Abschnittsgrammatik akzeptierte nur eine exakte Formulierung, und der Hinweis „der Ersteller hat es leer gelassen“ feuerte bei einem Layout, das nicht erkannt worden war. Details im [Changelog](CHANGELOG.md).
- [x] **Priorität — Emochi: Beispielgespräche werden nicht abgerufen.** Behoben in 0.9.0. `characterExampleConversation` kommt als Array von Zügen, und die String-Umwandlung machte `""` daraus. Jetzt wird es als Züge geparst.
- [x] **Emochi-Lab-Unterstützung.** Story-, Soundstage- und LiveRoom-URLs werden gegen denselben Prompt-Datensatz gelesen, wobei das letzte Pfadsegment als ID dient. Die abgemeldete Sitzung hat die tatsächliche URL-Form des Lab nie gezeigt; nutzt eine Oberfläche einen anderen Datensatztyp, meldet das Panel also die fehlgeschlagene Route statt einer halben Karte.
- [x] **Unterstützung für Saucepan AI hinzufügen.** Erledigt in 0.10.0. Öffentliche Companions exportieren mit der Description und jeder öffentlichen Startnachricht; Definition und Lorebooks brauchen eine angemeldete Sitzung, die Definition zusätzlich den Schalter Definition Visibility des Erstellers. Die Routen für Definition und Editable sind aus dem Client-Code dokumentiert, der sie konsumiert, nicht aus einem angemeldeten Aufruf — kommt dir eine leer zurück, ist ein Issue mit der Panel-Meldung genau das Richtige.
- [x] **Tavos JSON-Import: klären, welches Avatar-Feld gelesen wird.** Beantwortet in 0.12.0. Tavos Charakterobjekt exponiert `avatar` (URL oder Pfad), sein Importeur akzeptiert einen vollständigen CCv3-Wrapper oder ein nacktes `data`-Objekt, und sein APK 1.9.0 enthält keinen `avatar_url`-String. Das JSON schreibt das Portrait in `avatar`, `data.avatar` und `data.extensions.avatar`; das PNG bleibt der dokumentierte Weg, wenn das Bild mit der Karte ankommen muss.
- [x] **Unterstützung für WyvernChat.com.** Erledigt in 0.12.0. ID- und Custom-Slugs werden beide aufgelöst, Lorebooks werden im Deep scan gelesen, und die Zuordnung folgt Wyverns eigenem V2-Exporteur (`pre_history_instructions` → `system_prompt`, `character_note` → `extensions.depth_prompt`).
- [ ] **Die Leser für Character.ai und Crushon.ai mit einer angemeldeten Sitzung prüfen.** Beide Hosts antworten der Maschine, auf der dieses Release gebaut wurde, mit Cloudflare `403`; die Verträge sind also geprüft, der Live-Lesetest nicht. Wenn einer der beiden Leser bei dir scheitert, ist ein Issue mit der Panel-Meldung genau das, was gebraucht wird.
- [x] **Unterstützung für Chub.ai und Venus.chub.ai.** Erledigt in 0.12.0. Die Charakterlesung geht über den Erweiterungs-Worker, weil der Endpunkt keinen CORS-Header hat; Venus liefert dieselbe SPA und API. Deep scan liest eingebettete und verknüpfte Lorebooks und verwirft exakte Duplikate.
- [x] **PNG-Metadaten mit der vollständigen Definition für jede Plattform.** Erledigt und in 0.12.0 erneut geprüft: `chara`- (V2) und `ccv3`- (V3) `tEXt`-Blöcke, beide sofort nach `IHDR` und vor `IDAT`, gültige CRCs, vollständiges Karten-JSON inklusive `character_book`; ein echter Chromium-Build erzeugte und las eine 1,14-MB-Karte zurück.
- [x] **Die Exportfunktionen von CAI Tools portieren.** Erledigt in 0.12.0 für den Character.ai-Pfad: Zuordnung von Definition/Begrüßungen/Kategorien/Avatar und Chat-Export als Tavern-JSONL, JSON, Markdown, Beispieldialog und Oobabooga-Paare. CAI Tools' Chat-UI-Ersatz, Hintergründe, Schriften, Memory-Manager, Bibliothek, Suche und jsPDF-Ausgabe sind UI- oder Abhängigkeitsfunktionen und bleiben außerhalb des Umfangs.

Ein Leser, der auf einer unterstützten Seite halb funktioniert, ist schlechter als eine weitere Seite, die ganz funktioniert — deshalb lagen die beiden Emochi-Punkte über neuer Seitenunterstützung, bis sie geschlossen waren.

---

## Fehler melden

Nutze den **[Issues-Tab](https://github.com/mxchu666/Universal-Character-Card-Exporter/issues)**. Er ist aktiviert. Bitte gib an:

- Die Seite und die Charakter-URL.
- Welche Version du hast — **fahre mit der Maus über die Fußzeile des Export-Panels, die Version steht im Tooltip**.
- Was du erwartet hast und was du bekommen hast. Ein Screenshot des Panels ist das Nützlichste, was du anhängen kannst.
- Jede Meldung, die das Panel gezeigt hat. Bei einer fehlgeschlagenen Abfrage nennt das Panel Route und Antwortcode — genau dieser Text wird für die Reparatur gebraucht.

Funktionswünsche sind am selben Ort willkommen.

---

## Ist das erlaubt?

Es ist ein persönliches Backup-Werkzeug. Es liest, was du angemeldet ohnehin siehst, und speichert es in einem offenen Format. Es umgeht keine Paywall und schaltet nichts frei, was du sonst nicht sehen könntest.

Die Nutzungsbedingungen der Seiten können automatisierten Zugriff dennoch einschränken. Nutze es für deine eigenen Charaktere und persönliche Backups, nenne Ersteller, wenn du ihre Arbeit weitergibst, und überlaste die Seiten nicht.

## Datenschutz

- Gelesene Charakterdaten verlassen deinen Browser nie. Keine Analyse, kein fremder Code.
- Host-Berechtigungen sind auf die Seiten im Manifest, ihre API-Hosts und ihre Portrait-CDN beschränkt; es gibt keine `<all_urls>`-Berechtigung.
- Die einzigen Netzwerkaufrufe gehen an die Seite, auf der du bereits bist, die API dieser Seite und ihren Portrait-Host.

---

## Für Entwickler

Die Erweiterung ist reines JavaScript, ohne Abhängigkeiten und ohne Build-Schritt. Ändere `src/` und lade sie auf der Erweiterungsseite neu.

```sh
node --test
```

`src/scraper.js` liest JanitorAI, `src/emochi.js` Emochi, `src/polybuzz.js` Polybuzz, `src/cai.js` Character.ai, `src/crushon.js` Crushon.ai, `src/saucepan.js` Saucepan.ai, `src/chub.js` Chub.ai/Venus.chub.ai und `src/wyvern.js` WyvernChat. Alle acht füllen dieselbe Kartenform, Exporter und Panel wissen also nie, auf welcher Seite du bist. `src/exporters.js` konvertiert, `src/panel.js` und `src/panel.css` sind das Panel auf der Seite, `background.js` ist der Service Worker für Anfragen, die ein Content-Script nicht stellen kann (CORS, verbotene Header).

Zwei Dateien existieren nur für die Seiten, die ihren Datensatz nie über eine API veröffentlichen: `src/intercept.js` läuft in der Welt der Seite (`world: "MAIN"`, `document_start`) und kopiert ins DOM, was die Seite schon weiß; `src/harvest.js` sammelt diese Nutzlasten und bewertet jedes Objekt gegen eine Liste bekannter Feldnamen. Eine dritte geschlossene Seite kostet eine Datei, die ihre Schlüssel nennt.

**Die API-Aufzeichnung je Seite steht im englischen README** ([Developer reference](README.md#developer-reference-english-only)). Sie bleibt bewusst englisch: Es ist Referenzmaterial und der Teil, der am schnellsten veraltet, wenn eine Seite sich ändert. Die Übersetzungen verlinken dorthin.

---

## Lizenz

[MIT](LICENSE).
