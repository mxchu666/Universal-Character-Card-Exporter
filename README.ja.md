# Universal Character Card Exporter

[English](README.md) · [Español](README.es.md) · **日本語** · [Italiano](README.it.md) · [Deutsch](README.de.md) · [Русский](README.ru.md)

**JanitorAI**、**Emochi**、**Polybuzz**、**Character.ai**、**Crushon.ai**、**Saucepan.ai**、**Chub.ai**、**Venus.chub.ai**、**WyvernChat** のキャラクターを読み取り、持ち運べるキャラクターカードとして保存するブラウザ拡張機能です。バックアップにも、別のフロントエンドへの移行にも使えます。アカウント登録も、ビルドも、サーバーも不要。あなた自身のブラウザで、あなた自身のセッションを使って動きます。

**0.12.0 の新機能：** Chub.ai、Venus.chub.ai、WyvernChat のリーダー、ページ自身の二重エンコードされたハイドレーションストアから復元する JanitorAI の定義、Character.ai の **Save chat**（Tavern JSONL、JSON、Markdown、会話例、Oobabooga のペアファイル）、そして `character_book` エントリのオプションを含む V2/V3 カードの全フィールドです。PNG の経路は作り直し、実際のブラウザで読み戻しました：`chara` + `ccv3`、どちらも `IDAT` の前、ポートレートも無事です。詳細は [changelog](CHANGELOG.md) と [devlog](#devlog) にあります。

> 無料・オープンソースです。役に立ったら、オリジナルの活動を支援するために [inkwell.rip](https://inkwell.rip) を覗いてみてください。こうしたツールが続くのはそれが理由です。

---

## クレジット

このプロジェクトは **[erpocalypse](https://github.com/erpocalypse)** による **[Character Card Extractor / JAI Card Extractor](https://github.com/erpocalypse/jai-card-extractor)** の**フォーク**です。元の拡張機能、JanitorAI リーダー、パネル、エクスポーターのパイプライン、カード形式まわりの作業はすべてそこから来ています。

**これを使う場合、フォークする場合、再配布する場合、あるいはこれを土台に何かを作る場合は、原作者のクレジットを表示し、[github.com/erpocalypse/jai-card-extractor](https://github.com/erpocalypse/jai-card-extractor) へのリンクを載せてください。** これはお願いではなく、このフォークの条件です。

このフォークのメンテナは **[mxchu666](https://github.com/mxchu666)** です。Emochi と Polybuzz の対応、サイト横断のカードパイプライン、いま読んでいるドキュメントを追加しました。

**Character.ai のチャット書き出しは [CAI Tools](https://github.com/irsat000/CAI-Tools)**（**[İrşat / irsat000](https://github.com/irsat000)**）に従っています。Character.ai のチャット保存の実用的な形を確立した拡張機能です。CAI Tools は機能とエンドポイントの参照として使い、コードはコピーしていません。チャット画面の置き換え、背景・フォント・メモリの管理、ライブラリ、キャラクター検索はエクスポーターの仕事ではないため、ここでは再現していません。

**このフォークがどう作られたか。** コードは **OpenCode** 上で **DeepSeek v4.1-flash:free** を動かして書きました。エージェントに渡したプロンプトはすべてスペイン語で書き、**英語への翻訳はすべて私が手作業で行いました**。開発者向けセクションの調査結果・検証・API ノートは、その作業の成果で、すべて実際のサイトに対して確認済みです。

---

## 書き出せる形式

| 形式 | ファイル | 読み込めるもの |
|---|---|---|
| SillyTavern キャラクターカード | `.card.json` | SillyTavern、Tavo、Agnai、RisuAI、Inkwell、Chub — V2/V3 リーダーは `data` を読み、古いインポーターは同じファイルのフラットな V1 フィールドを読みます |
| SillyTavern カード（PNG） | `.png` | SillyTavern、Tavo、Chub、RisuAI、Agnai。ポートレートとカードを1ファイルに収める唯一のコンテナ |
| ロアブック / World Info | `.lorebook.json` | SillyTavern、Tavo |
| Character.ai チャット | `.chat.jsonl`、`.chat.json`、`.chat.md`、`.chat.txt`、`.chat.ooba.json` | SillyTavern（JSONL）、text-generation-webui（Ooba）、テキストを読むもの全般（Markdown と会話例） |
| JanitorAI JSON | `.jai.json` | 元のレコードに最も近い形 |
| プレーンテキスト | `.txt` | テキストを読めるものなら何でも — カードインポーターのないプラットフォームへの唯一の経路（Character.ai、Crushon、Polybuzz、Emochi） |

チャットファイルは Character.ai のチャットページでのみ提供されます。この拡張機能が履歴を読む唯一のサイトだからです。**Save chat** は5つを一度にダウンロードします。ページ上で形式を選ぶ必要はありません。

受け入れ先がカードを受け取るなら PNG を送ってください。JSON カードにはどの仕様バージョンにも画像フィールドがありませんが、PNG にはあります。

処理はすべてローカルで完結します。アップロードはなく、解析もなく、外部コードも読み込みません。

---

## このツールの仕組み

拡張機能は「1つずつ役割を持つ4つの部品」と「全体を貫く1つのルール」でできています。そのルールとは、**どのサイトのリーダーも同じカードオブジェクトを出力する**、というものです。

```
サイトのページ
   │
   ├─ src/scraper.js    JanitorAI を読む
   ├─ src/emochi.js     Emochi を読む（キャラクターページと Lab）
   ├─ src/polybuzz.js   Polybuzz を読む
   ├─ src/cai.js        Character.ai を読み、チャットを書き出す
   ├─ src/crushon.js    Crushon.ai を読む
   ├─ src/saucepan.js   Saucepan.ai を読む
   ├─ src/chub.js       Chub.ai + Venus.chub.ai を読む
   ├─ src/wyvern.js     WyvernChat を読む
   │       ▲
   │       └─ src/intercept.js + src/harvest.js
   │          (レコードを自前のクライアントにしか渡さないサイト)
           │
           ▼
     1つのカードオブジェクト
     { name, creator, avatarUrl, gender, tags,
       fields: { description, personality, scenario,
                 greeting, altGreetings, exampleDialogue },
       creatorNotes, systemPrompt, postHistoryInstructions,
       extensions, lorebooks[], scriptRefs[] }
           │
           ├─ src/exporters.js  ──▶ .card.json / .png / .lorebook.json / .jai.json / .txt
           └─ src/panel.js      ──▶ ページ上の UI：ブロック一覧、チェックボックス、書き出しボタン
```

1. **読む。** いま開いているサイトのリーダーがキャラクターを集めます。サイトごとに公開されている表面が違うので、やり方も違います。JanitorAI は内部 JSON API とページ内のハイドレーションストア、Emochi は Next.js バックエンドのコンパイル済みプロンプト、Polybuzz はサーバー側で描画された Nuxt ペイロードと REST API、Chub と Wyvern は自前の API から Tavern 形式のレコードを公開し、Character.ai と Crushon.ai はレコードを自前のページにしか渡しません — その2つでは、拡張機能は問い合わせずにページがすでに取得したものを嗅ぎ取ります。
2. **正規化する。** 生のレコードを上のカードオブジェクトに平坦化します。ここでサイト固有のフィールド名を翻訳します。Polybuzz の `sceneBrief` は `description` に、`speechText` は `greeting` に、`templateIntro` は `scenario` になります。何も捏造しません。公開されていないフィールドは空のままです。
3. **見せる。** パネルは見つけたブロックをチェックボックスとプレビュー付きで一覧表示します。混ざり込んだ jailbreak 行やシステムプロンプトを外せます。上部のカウンタ（`x/y kept`）が、実際に何が書かれるかを正確に示します。
4. **書き出す。** `toBlocks()` がチェックされたブロックを目的の形式に変換します。エクスポーターはサイト非依存で、Emochi も Polybuzz も知りません。知っているのはカードオブジェクトだけです。だからどのサイトでも5形式がそのまま使えます。
5. **保存する。** Blob を作り、`<a download>` でクリックします。ネットワークは通りません。

`toBlocks()` には意図的なガードが1つあります。Personality ブロックが Description ブロックと1文字違わず同一になった場合、黙って捨てます。それはほぼ常に、サーバーが片方のフィールドをもう片方に流し込んでいるのであって、作者が同じ段落を2回書いたのではありません。

### なぜウェブサイトではなく拡張機能なのか

ここに挙げたサイトはどれも、データの少なくとも一部をログイン済みセッションの背後に置いています。ウェブアプリなら Cookie が必要になりますが、拡張機能はブラウザがすでに持っているセッションを借りられます。パスワードを目にすることもありません。ツールがこの場所に存在する理由は、それだけです。

---

## インストール（約2分）

プログラミングの知識は不要です。ビルドもコンパイルもありません。

1. **プロジェクトをダウンロード。** GitHub ページの緑の **Code** ボタン → **Download ZIP**。デスクトップなど、消さない場所に解凍します。
2. **拡張機能ページを開く。** Chrome は `chrome://extensions`、Edge は `edge://extensions`。
3. **デベロッパーモード**をオンにする（右上のスイッチ）。
4. **パッケージ化されていない拡張機能を読み込む** を押し、`manifest.json` が入っているフォルダを選ぶ。

> そのフォルダを移動・削除すると拡張機能は動かなくなります。消さない場所に置いてください。

---

## 使い方

### JanitorAI

1. ログインした状態で [janitorai.com](https://janitorai.com) のキャラクターページを開く。
2. 右下の **Extract card** を押す。
3. **Quick scan** でキャラクターを読みます。**Deep scan** は付属するロアブックもすべて巡回します（遅いが完全）。
4. 不要なもののチェックを外す。**Select all** / **Select none** が使えます。
5. 書き出し形式を選ぶ。

ロアブックが複数あるキャラクターでは、ディープスキャン後に **Separate books** ボタンが出ます。共有ワールドブックを再利用可能な単独ファイルとして保存できます。

### Emochi

1. [emochi.com](https://emochi.com) のキャラクターを開く（`emochi.com/character/...`）。
2. **Quick scan** は公開ペイロードを読みます：名前、キャッチコピー／説明、ウェルカムメッセージ、タグ、アバター、作者。
3. **Deep scan** はさらに作者の定義（性格、シナリオ、会話例）を要求します。このルートは**自分のアカウントのキャラクター**にしか応答しません。先にログインしてください。

Emochi のキャラクターの一部は、性格やシナリオのテキストをどこにも保存していません。サイトはタグで動かし、ペルソナはチャット時に生成するためです。それはキャラクターの性質であって、読み取り失敗ではありません。

### Polybuzz

1. [polybuzz.ai](https://polybuzz.ai) のキャラクターを開く（`polybuzz.ai/es/character/chat/...`）。
2. **Extract card** → **Quick scan**。
3. 書き出す。

Polybuzz のカードには、サイトが公開しているものが入ります。

| カードのフィールド | Polybuzz の出どころ |
|---|---|
| Description | `sceneBrief` — 短い紹介文 |
| Greeting | `speechText` — 開始メッセージ |
| Scenario | テンプレート型なら `templateIntro`、そうでなければ作者がグリーティング冒頭に書いたト書き |
| Personality | 作者自身が選んだ **Personalidad** タグ（`Frío`、`Celoso`、`Tsundere` など）と、公開されていれば会話スタイル |
| Gender | `sceneGender`。説明文の先頭に `Gender: Male/Female/Non-binary` の行として入ります |
| タグ、アバター、名前、作者 | シーンレコード |

### Character.ai

1. ログインした状態で [character.ai](https://character.ai) のキャラクターを開く（`character.ai/character/...`）。
2. ページの読み込みが終わるのを待って、**Extract card** → **Quick scan**。
3. 書き出す。

| カードのフィールド | Character.ai の出どころ |
|---|---|
| 名前、作者、アバター | キャラクターレコード |
| Description | `title`（キャッチコピー）の後に `description`（About テキスト） |
| Greeting | `greeting` |
| 会話例 | `definition` — 作者が書いた自由記述の定義（公開されている場合） |

**定義について。** Character.ai はキャラクターの定義を、キャラクター公開設定とは別の **Definition Visibility** という2つ目のスイッチの奥に置いています。これがオフのとき、サイトはそのテキストを誰にも送りません。そのため会話例ブロックは空になり、パネルは脚注でそう告げます。他のフィールドは関係なく揃います。

リーダーはページ自身のリクエストを観察して動きます。ページの世界で動く小さなスクリプト（`src/intercept.js`）が `Authorization` ヘッダーを隠しタグに写し、受け取った JSON レスポンスをすべて DOM イベントとして再送出します。リーダーはそれを受け取ります。リクエストを書き換えることはなく、あなたのトークンで独自のリクエストを送ることもありません。ページがまだその呼び出しをしていない場合は、リーダーはこの順に問い合わせます。まずページ自身のコンテキストで、捕捉したヘッダーとクッキーを使う。次に同じ呼び出しをサービスワーカー経由でクッキー付きで行う。次に受信済みペイロードとサーバー描画データを見る。最後にキャラクターページを HTML として取得し、ストリームからレコードを切り出します。ヘッダーはページが送ったままを使います。サイトは `Token` と `Bearer` の両方を使ってきたため、スキームを組み直すと 401 になります。

**0.11.2 以降**、そのログは `no answer` の代わりに各段階が実際に返したものを表示します。200 はキャラクターレコードを含まなければ何も意味しないので、行は `200, no character in body (status,error)` や `200, html page instead of json` と読めます。Cloudflare のインタースティシャルと移動したエンドポイントが作る2つの形です。死んだ拡張機能コンテキストは `runtime: extension reloaded - reload this tab` と表示され、Character.ai と無関係な唯一の失敗です。

#### Save chat（CAI Tools の書き出し経路）

チャット（`character.ai/chat/...`）を開き、読み込みが終わってから **Save chat** を押します。ボタンはチャットページにだけあります。5つのファイルをダウンロードします。

| ファイル | 内容 | 行き先 |
|---|---|---|
| `<名前>.chat.jsonl` | Tavern チャット。最初にメタデータ行、その後にメッセージごとの `{name, is_user, is_system, is_name, send_date, mes}` | SillyTavern → **Chat history** インポート |
| `<名前>.chat.json` | 同じ会話に `chat_id`、キャラクター、出どころ、書き出し時刻を加えたもの | 保存用、または自作スクリプト |
| `<名前>.chat.md` | 話者ごとの見出しが付いた読みやすい記録 | 読む、共有する、印刷する |
| `<名前>.chat.txt` | `<START>` の後に `{{user}}:` / `{{char}}:` 行 | カードの会話例ブロック |
| `<名前>.chat.ooba.json` | 最初のユーザーターンから始まる `{internal, visible, data, data_visible}` のペア | text-generation-webui |

ターンのエンドポイントは新しい順に返し、`meta.next_token` でページングします。リーダーは最後までたどり、`primary_candidate_id` が示す応答 — 実際に画面にあったもの — を取り、古い順に並べます。長いチャットでは、ページング中にステータス行がターンを数えます。

**CAI Tools にあってここにないもの。** CAI Tools は Character.ai のチャット UI を置き換え、背景、フォント、メモリピン、アバター、カード/ライブラリ/検索システムを管理し、jsPDF でチャットログを PDF にします。それらは UI 機能か同梱ライブラリ依存なので、依存関係ゼロを守るエクスポーターの外です。書き出しに関係する半分 — キャラクターフィールド、グリーティング、アバター、移行可能な形式でのチャットダウンロード — は移植しました。PDF が必要なら、Markdown をブラウザから PDF に印刷できます。

### Crushon.ai

1. [crushon.ai](https://crushon.ai) のキャラクターを開く（`crushon.ai/character/...`）。
2. ページの読み込みが終わるのを待って、**Extract card** → **Quick scan**。
3. 書き出す。

Crushon は完全にクライアント側で描画されるので、リーダーは API を呼ばず、ページがすでに描画したレコードを読みます。フィールド別名は、サイトがこれまでのリリースで使ってきた表記をすべてカバーします：`firstMessage` / `first_mes` / `greeting`、`description` / `introduction` / `intro`、`avatar` / `avatarUrl` / `image`、`mes_example` / `exampleDialogue` / `dialogue`。ページがまだキャラクターを取得していない場合は、再読み込みしてからスキャンしてください。

**フィールド名について。** Crushon 自身のインポーターは Tavern カードを反転して対応づけます。カードの `personality` が Crushon の *Introduction* に、カードの `description` が Crushon の *Personality* になります。リーダーは Crushon が公開しているものを、カード上で同じ意味を持つフィールドに書き出すので、両方のツールを通してもテキストは元の場所に戻ります。

### Saucepan.ai

1. [saucepan.ai](https://saucepan.ai) の companion を開く（`saucepan.ai/companion/...`）。定義とロアブックも要るならサインインした状態で。
2. ページの読み込みが終わるのを待って、**Extract card** → **Quick scan**。**Deep scan** はロアブックも追加します。
3. 書き出す。

| カードのフィールド | Saucepan.ai の取得元 |
|---|---|
| 名前、作者、アバター | companion のレコード |
| 説明 | キャッチコピー（`short_description`）、続いてプロフィール → **Description** |
| 性格 | Core → **Information**、作者が書いていれば詳細 → **Advanced Prompt** と **Formatting Instructions** |
| 挨拶 | メッセージ → **Starting Messages** の最初の公開エントリ |
| 代替の挨拶 | 残りの公開スタートメッセージすべて |
| 会話例 | メッセージ → **Example Dialogue** |
| タグ | companion のタグとそのファンダム |
| ロアブック | 紐づいたロアブックごとに、章を1エントリとして |

**プロキシはフィールドであって関門ではありません。** Saucepan は companion ごとにプロバイダの方針 — *custom and vetted*、*vetted only*、*internal only*（最後は外部モデルなし）— を付けます。その方針はカードの注記行に出るだけで、他には何も依存しません。作者がプロキシを許可していてもいなくても、companion は同じように書き出されます。

**説明が暗号に見えることがある理由。** 暗号ではなく断片のリストです。`GET /api/v2/companions/{id}` は Description を `{mask, version, fragments: [{key, proof, text}]}` として返し、ほとんどの断片はランダムなテキストの囮です：`"signal glance window but"`、`"simple quiet maybe almost"`。断片が本物なのは、その `proof` が自分自身のテキストの FNV-1a ハッシュ（マスクと `key ^ mask` を種にする）と一致したときだけで、残った断片は `key ^ mask` で並べ替えて連結します。`src/saucepan.js` の `decodeFragments` がその処理で、テストは実レスポンスからコピーした断片に対して実行します。これがなければ埋め草を書き出すことになります。

**公開 companion、定義が開いていてもいなくても。** 公開レコードは必ず名前、キャッチコピー、Description、タグ、ファンダム、ポートレート、プロバイダ方針を持つので、公開 companion は必ずキャラクターカードとして書き出せます。定義 — Core、会話例、高度なプロンプト、フォーマット — は別のルートで、作者の **Definition Visibility** という別のスイッチがかかります。閉じていると Saucepan は誰にもテキストを送らず、カードはそのブロックが空のまま出て、パネルが作者が閉じたブロックを名指しします。スタートメッセージもシナリオが公開のときだけ配信され、無い場合は挨拶ブロックが空になり、パネルがそう告げます。

**自分が所有する companion** は `GET /api/v1/companion/editable` から読みます。エディタの生レコード — Core のテキスト、会話例、高度なプロンプト、フォーマット指示、そして公開範囲に関係なくすべてのスタートシナリオ — が返ります。所有はスキャンのたびに判定するので、Definition Visibility が閉じていても自分のボットは完全な形で出てきます。

### Chub.ai と Venus.chub.ai

1. [chub.ai](https://chub.ai) または [venus.chub.ai](https://venus.chub.ai) のキャラクターを開く（`/characters/作者/名前`）。公開カードにログインは不要ですが、非公開のものには必要です。
2. **Extract card** → **Quick scan**。**Deep scan** は埋め込みロアブックと、キャラクターにリンクされたすべてのロアブックを追加します。
3. 書き出す。

Chub はここで最も簡単なサイトです。すでに Tavern カードを保存しているからです。対応はほぼ1対1です。

| カードのフィールド | Chub の出どころ |
|---|---|
| 名前、作者、アバター、タグ | `node.definition.name`、`node.fullPath` の最初のセグメント、`definition.avatar`、`node.topics` |
| Description | `definition.description` — 作者のメモ欄 |
| Personality | `definition.personality`、そして完全なエコーでなければ `definition.tavern_personality` |
| Scenario、グリーティング、代替グリーティング | `definition.scenario`、`definition.first_message`、`definition.alternate_greetings` |
| 会話例 | `definition.example_dialogs` |
| システムプロンプト、履歴後の指示 | `definition.system_prompt`、`definition.post_history_instructions` |
| ロアブック | `definition.embedded_lorebook`、続いて `related_lorebooks` の正の id すべて |

**なぜ worker を使うのか。** `api.chub.ai/api/characters/...` は `Access-Control-Allow-Origin` を送らないので、API が公開されていてもページ文脈の fetch は拒否されます。拡張機能の service worker は CORS の制約を受けず、`api.chub.ai` のホスト権限を持つため、その読み取りを担当します。ロアブックのエンドポイントは `*` を送るので、どちらの経路でも動きます。

**重複は id ではなく内容で捨てます。** キャラクターは本を埋め込み、同じ本を関連としても一覧できます。各エントリを `keys + content` に縮約し、埋め込み側とシグネチャが完全一致する関連本は飛ばします。`related_lorebooks` の `-1` は本の id ではなくセンチネルです。

**Venus は別ホストの同じサイトです。** Venus.chub.ai は同じ SPA、同じパス、同じ API を提供するので、1つのリーダーと1組の権限で両方をカバーします。パネルはどちらのホストから読んだかを表示します。

### WyvernChat

1. [app.wyvern.chat](https://app.wyvern.chat) のキャラクターを開く（`/profiles/作者/characters/名前`）。
2. **Extract card** → **Quick scan**。**Deep scan** はキャラクターに付属するすべてのロアブックを追加します。
3. 書き出す。

| カードのフィールド | WyvernChat の出どころ |
|---|---|
| 名前、作者、アバター、タグ | キャラクターレコード。`creator.vanityUrl`、次に `displayName` |
| Description | `description`、すでに繰り返されていなければ `visual_description` |
| Personality、Scenario、グリーティング | `personality`、`scenario`、`first_mes` |
| 代替グリーティング | `alternate_greetings`、さらに `default` 以外の高度な `greetings` |
| 会話例 | `mes_example` |
| システムプロンプト | `pre_history_instructions` — エディタでは **System Prompt** |
| 履歴後の指示 | `post_history_instructions` — エディタでは **Final Instructions** |
| キャラクターノート | `character_note`、`extensions.depth_prompt` に深さ4で格納 |
| 作者ノート | `creator_notes` — **Long Description**。設計上 HTML を含むことがある |
| ロアブック | `GET /api/lorebooks/character/{id}` |

**カスタムスラッグはページから解決します。** Wyvern の URL は内部 id（`_Ytaz4tYBerdx7zPzp14VD`）か、作者が選んだ名前（`eveline`）を使えます。API が解決できるのは id だけで、カスタム名を渡すと404です。カスタムスラッグの場合、リーダーはサーバー描画された Next.js のフライトペイロードを解析し、レコードの `id` を取ってから API を呼びます。同じペイロードが、API が拒否したときの予備レコードにもなります。

**対応は Wyvern 自身のエクスポーターに従います。** バンドルには V2 カードの書き出し処理が入っています。それは `pre_history_instructions` を `system_prompt` に、`character_note` を `extensions.depth_prompt.prompt` に対応させており、このリーダーも同じにしています。`creator_notes` は、作者が完全な HTML プロフィールページを入れている場合でもそのまま書き出します。Wyvern 自身のダウンロードがそうしているからです。

---

## Tavo：カードが画像なしで届く理由

3つの不具合で、0.11.0 と 0.11.1 で閉じました。

**PNG は正しいカードでしたが、V2 ブロックだけでした。** カード PNG は JSON を base64 の `tEXt` ブロックに入れます。V2 仕様が `chara`、V3 仕様が `ccv3` です。拡張機能は `chara` しか書いていませんでした。Tavo は `ccv3` を読み、見つからないと、完全に正しいファイルに対して *「No se detectaron metadatos PNG」* と返します。今は両方を、SillyTavern と同じ順序と形式で書き、テストは両ブロックとその CRC を `zlib.crc32` で検証します。ブロックは `IHDR` と `IDAT` の間にあり、Chub が置く位置であり、最初の画像ブロックで止まるリーダーにも見える位置です。

**JSON には画像のフィールドがありません。** V2/V3 仕様はテキストのみなので、Tavo はポートレートが空のままキャラクターを作ります。そこで 512×512 の JPEG（約40 KB）を data URI として `avatar`、`data.avatar`、`data.extensions.avatar` に埋め込みます。フロントエンドがどれかを読めば、ネットワーク要求なしで画像が出ます。バイトを取得できなかった場合は公開 URL を書きます。

**ポートレートがイニシャルになっていたのは、worker が応答していなかったためです。** 以前は `<img crossOrigin="anonymous">` で読み込んでいましたが、0.11.0 はそれを service worker 呼び出しに置き換え、代替経路を持たせませんでした。Emochi の CDN は `Origin` 付きのリクエストには `Access-Control-Allow-Origin: *` を返します（以前の計測は `Origin` を送っていませんでした）。つまり原因は CORS ではなく worker です。0.11.2 ではまず worker を試し（セッション cookie を要する `cdn.crushon.ai` にとって唯一の経路）、失敗したら画像を直接読み込みます。それでも取得できなければ、黙ってタイルを描く代わりに理由を表示します（`the extension was reloaded - reload this tab`、`http 403`、`decode failed`）。

マニフェストがこれらの CDN のホスト権限を追加するため、更新後に Chrome が拡張機能を一度無効にします。拡張機能ページで再度有効にしてください。

**Tavo が読むアバターフィールド — 0.12.0 で回答。** Tavo のドキュメントにあるキャラクターオブジェクトは `avatar`（画像 URL またはパス）を持ち、`tavo.character.import(card)` は完全な `{spec:"chara_card_v3",data:{…}}` ラッパーか、裸の `data` オブジェクトを受け取ります。APK 1.9.0 を展開して `libapp.so` を検索すると、`chara_card_v2`、`chara_card_v3`、`ccv3`、`creator_notes`、`mes_example`、`alternate_greetings`、`first_mes`、`character_book`、`extensions.` は含まれますが、**`avatar_url` はありません**。つまり Tavo が読める JSON スロットは `data.avatar` です。`data.extensions.avatar` と最上位の `avatar` は、Tavo が必要とするからではなく、他のリーダー向けに書いています。最終的な判断はインポート画面です。あなたの Tavo がそこで data URI を無視するなら、画像そのものがファイルである PNG をインポートしてください。

### それでもリーダーが「PNG メタデータなし」と言う場合

パネルは何を作ったかを表示するようになりました。フッターに実行中のバージョンが出て、PNG 書き出し後のステータス行にファイル内のテキストブロックが並びます。

```
PNG saved - chara + ccv3 - 486 KB - v0.12.0.
```

そこに両方のキーがあれば、ファイルは正しく、リーダーが別の場所を見ています。なければ書き出し自体が失敗しています。サイズは、ディスク上のファイルとパネルが今作ったファイルを照合するためのものです。`- イニシャルのタイル` は、ポートレートを取得できずグラデーションのタイルを描いたという意味です。

この節のきっかけになった報告のファイルはバイト単位で確認しました。`tEXt` ブロックが1つ、キーは `chara`、`IDAT` の前、CRC は有効、JSON に `avatar` キーなし。これは 0.10.0 の署名です。0.11.x のエクスポーターは常に2つのブロックと `avatar` フィールドを書きます。したがって、まず次を確認してください。

1. **フッターが `v0.12.0` か確認する。** `v0.10.x` や `v0.11.x` なら、ブラウザは古いビルドを実行しています。
2. **拡張機能を再度有効にし、タブを再読み込みする。** Chrome は権限が変わったとき、展開済み拡張機能を一度無効にします。すでに開いているタブは再読み込みするまで古い content script を保持します。そのタブから書き出すと、新しい名前の古いファイルができ、「まだ失敗する」報告とまったく同じに見えます。
3. **もう一度書き出す。** ディスク上のファイルは古いバイトのままです。再読み込み後に PNG をもう一度ダウンロードしてください。

ファイルを直接確認するには、最初のテキストブロックが `"spec": "chara_card_v2"` の JSON オブジェクトに、2つ目が `"chara_card_v3"` にデコードされ、`data.avatar` が存在する必要があります。

### ポートレートはしばしばキャラクターではなくイニシャルのタイルでした

ポートレートは書き出しのうち拡張機能の service worker に依存する唯一の部分なので、worker に届かないときに失敗する部分です。`Origin` ヘッダーの有無で測ると、ポートレートのホストはこう振る舞います。

| サイト | ポートレートのホスト | `Access-Control-Allow-Origin` |
|---|---|---|
| Emochi | `image-cdn.flowgpt.com`、`cdn.mokio.ai` | リクエストに `Origin` があれば `*` |
| Polybuzz | `cdn.polyspeak.ai` | `*` |
| Character.ai | `characterai.io` | `*` |
| JanitorAI | `ella.janitorai.com` | `*` |
| Crushon.ai | `cdn.crushon.ai` | なし。セッション cookie がないと 403 |
| Saucepan.ai | `saucepan.ai/cdn/<id>/card` | 不要。同一オリジン |

このファイルの 0.11.0 の注記は、Emochi のホストが CORS ヘッダーを送らないとしていました。その調査は `Origin` を送っていませんでした。これらの CDN は与えられたヘッダーを反映します。ブラウザを前に置くと `image-cdn.flowgpt.com` と `cdn.mokio.ai` は `Access-Control-Allow-Origin: *` を返し、`crossOrigin="anonymous"` の画像読み込みが機能します。ヘッダーを読んだのではなく、実際の Chromium で確認しました。

つまりイニシャルのタイルは CORS の問題では決してありませんでした。worker の問題です。`chrome.runtime.sendMessage` は、タブを開いたまま拡張機能を再読み込みしたとき、ホスト権限が与えられていないとき、service worker がタイムアウトしたときに何も返しません。エクスポーターはそれを失敗と呼び、タイルを描いていましたが、3つのどれが起きたかは分かりませんでした。

0.11.2 は3つを変えます。

- **第2の経路。** まず worker を試し（セッション cookie を要する `cdn.crushon.ai` の唯一の経路）、次にポートレートをクロスオリジン画像として読み込みます。Emochi、Polybuzz、Character.ai、JanitorAI は worker が死んでいても画像を取得します。
- **恒久的なラッチなし。** ポートレートに失敗したカードは、タブの寿命いっぱい失敗を覚えるのではなく、次の書き出しで再試行されます。
- **画面に理由を出す。** ステータス行は `- イニシャルのタイル (<理由>)` で終わります。`the extension was reloaded - reload this tab`、`http 403`、`decode failed: …`、`the record has no portrait URL` のいずれかです。死んだ拡張機能コンテキストは、壊れた CDN に見えるのではなく、そう名指しされます。

マニフェストがこれらのポートレートホストを名指しするため、Chrome は更新後に拡張機能を一度無効にします。拡張機能ページで再度有効にしてください。

---

## Polybuzz：背景情報は取得できません。理由はこれです。

Polybuzz の作成ガイドは、キャラクターが7つの要素でできていると説明しています。名前、性別、短い紹介、グリーティング、タグ、**背景**、**会話スタイル**（加えてスタイルを教えるためのサンプル会話）。公開ページが出すのはそのうち5つです。残り2つ — `systemRole`（背景、*Antecedentes*）と `conversationExample`（会話例）— は、**そのキャラクターの作者以外には一切送信されません**。これは欠けているエンドポイントでもなく、この拡張機能や他の何かが回避できるものでもありません。**データはサーバー側で組み立てられ、非所有者に向けてシリアライズされることが決してない**からです。

根拠を短くまとめます。

- 作成フォーム自体がこのフィールドを `Antecedentes (Visto en privado)`（＝「非公開」）と表示します。設計上、作者専用のメモです。
- ウェブクライアントが知っている読み取り専用 API ルートはすべて、新しいゲストセッションで公開ボットに対して呼びました。キーを含んでいたのは `scene/detailguest` だけで、しかも `""` を返します。
- 所有者用ルート `scene/getscenedetail` は、あなたのアカウントが所有していないボットに対して `210002` を返します。このコードは決定的です。サーバーがレコードを拒否しています。
- サイトの225個の遅延読み込み JavaScript チャンク全体で、`systemRole` と `conversationExample` が現れるのは**1ファイル**だけ — 作成ページです。他のページはこれらを要求しないので、他のページに表示しようがありません。
- 対照実験で決着します。Antecedentes に `ZZZ-123` というマーカーを入れて作成したボットを、別アカウントからスキャンしても、マーカーは一度も出ませんでした。値は作者のセッションから外に出ません。
- モデルに自分の指示を復唱させる手も使えません。チャットパイプラインはシステムプロンプトをサーバー側で構築し、ストリームはテキスト断片しか運びません。あるボットに自分の生い立ちを尋ねたところ、実際には存在しない幼少期を自信満々に捏造しました。言い換えは保存されたテキストではなく、この拡張機能は生成物を取得結果として扱いません。

**代わりに拡張機能がやること：** Polybuzz が実際に公開しているフィールドを使い、そのことをブロック一覧の下に脚注として明記します。Personality は作者が選んだタグから、Scenario はグリーティング冒頭のト書きからそのまま取ります。言い換えも捏造もしません。

キャラクターが自分のものであれば、3つの認証ルートは毎回のスキャンで問い合わせ続けます。自分のボットは完全な形で返ります。

---

## このフォークがどう作られたか（最初から最後まで）

短い記録です。プロセスの形が、上の限界がなぜ信頼できるのかを説明してくれます。

1. **元のツールから始める。** 上流の拡張機能はすでに JanitorAI を読んでいました。それを土台にし、以降のすべてに適用したルールは「上流の挙動は変えない、横に足すだけ」。
2. **特別扱いではなくリーダーを足す。** Emochi は `src/emochi.js` として、同じカードオブジェクトを埋める形で追加しました。`exporters.js` も `panel.js` も変更不要でした。
3. **本当のペイロードを見つける。** Emochi は FlowGPT バックエンド上の Next.js アプリで、有用なデータは公開プロンプトオブジェクト内のコンパイル済み `initPrompt` 文字列にあります。その文字列を性格・背景・シナリオ・会話例に逆パースします。
4. **推測せず計測する。** 「Emochi は約3分の1のキャラクターで定義を公開している」という主張は、独立したライブの一覧3つ（30、19、9件）を標本にして数えた結果です。ログインの壁ではなく公開フラグ（`visibility: true`）です。
5. **Polybuzz も同じやり方で追加する。** Nuxt がキャラクターをサーバー側でページに描画するので、ペイロードは devalue 配列として DOM にあります。その配列を展開して検索します。content script は `window.__NUXT__` を見られないため、`<script id="__NUXT_DATA__">` タグを使います。
6. **API を推測せず列挙する。** サイトの JavaScript バンドルは214個のリクエスト設定を宣言しています。読み取り専用のものをすべて公開ボットに対して呼びました。「背景は到達不能」という結論は、一度失敗したからではなく、表面を尽くしたから出たものです。
7. **対照実験で陰性を証明する。** 2つのアカウントで行った `ZZZ-123` 実験が、「見つからない」を「そこに存在しない」に変えました。
8. **パネルを静かに保つ。** 作者専用フィールドの欠落は通常ケースであり、エラーではありません。パネルは警告バナーではなく脚注を出します。本当の失敗（未ログイン、どのルートも応答しない）だけがメッセージを受け取ります。
9. **テストできるものはすべてテストする。** `node --test` がリーダー、正規化、エクスポーター、ブロックビルダーをカバーします。執筆時点で137テスト。この README の API に関する主張はすべて実際のサイトで検証しており、検証できなかったものはその旨を明記しています。
10. **書き残す。** 下の開発者向けセクションは、次の誰かが一から導き直さなくて済むように存在します。
11. **書く前に再利用する。** Character.ai と Crushon.ai はどちらも自分の JavaScript にしかレコードを渡さないので、1つの仕組みで両方をまかないます。ページ世界のスニッファーと、ペイロードを採点して歩く処理です。それぞれ新規1ファイル、共通2ファイルで、エクスポーターには触れていません。
12. **手法の出どころを明記する。** インターセプトの手法は [taquanta のエクスポーター](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter) から来ています。クレジットはコミットメッセージだけでなく、ファイル冒頭とこの README に置いています。
13. **検証できていないことを書く。** 新しい2サイトはブラウザのないマシンに Cloudflare の `403` を返すため、契約は文書化できてもライブ読み取りはできていません。それは曖昧にせず3か所に書いています。
14. **サイト自身のエクスポーターがあれば読む。** Wyvern はバンドルに V2 カードの書き出し処理を含んでいます。それを抽出すると `pre_history_instructions` → `system_prompt`、`character_note` → `extensions.depth_prompt`、`creator_notes` が Long Description であることが確定しました。製品コードから写した対応は、UI から推測したものに勝ります。
15. **API がレコードのすべてだと思わない。** JanitorAI は同じキャラクターを `window.mbxM.push(JSON.parse("…"))` としてページに書きます。JSON ドキュメントの中の JSON 文字列です。API は定義が null と言い、ページはレコードを運んでいました。ハイドレーションスクリプトの解析が、要約とカードの違いでした。
16. **コードではなく機能を移植する。** CAI Tools は実用的なチャット形式を定めました。リーダーはそれを自分のコードで書き、依存関係ゼロの規則を守り、CAI Tools のどの機能が UI で範囲外かを明言します。

**このツールは活発に開発中で、今後も更新を続けます。** サイトは追加され、壊れたリーダーは直され、サイトが変われば API ノートも修正されます。何かが壊れるときは、たいていサイトがペイロードの形を変えたからで、それは直せます。

---

## Devlog

各リリースに実際どう到達したかの記録です。何を試し、何が失敗し、その失敗が何を教えたか。新しい順。短い版は [changelog](CHANGELOG.md)、長い版がこれです。

### 0.12.0 — 3つのサイト、ハイドレーションストア、そして CAI Tools の書き出し半分

**Chub は初めて翻訳者を必要としないサイトでした。** キャラクター API が返す `definition` オブジェクトのキーは、すでに Tavern のものです。`description`、`personality`、`scenario`、`first_message`、`alternate_greetings`、`example_dialogs`、`system_prompt`、`post_history_instructions`、`tavern_personality`、`embedded_lorebook`。仕事はフィールドの対応ではなく、輸送路を見つけることでした。キャラクターのエンドポイントは `Access-Control-Allow-Origin` を送らないので、API が公開されていてもページからの fetch は失敗します。worker は Emochi と Polybuzz のためにすでにあったので、`api.chub.ai` のホスト権限を加えて読み取りをそこへ移しました。次に疑問だったのがロアブックです。`related_lorebooks` は id を持ち、`-1` はセンチネルで、本は埋め込みと関連の両方に現れます。各本を `keys + content` のシグネチャに縮約し、完全一致の重複を捨てるだけで足りました。id の一覧は鵜呑みにしていません。

**Wyvern はカスタムスラッグの問題に見えて、ペイロードの問題でした。** `/api/characters/{id}` はきれいですが、サイトの URL は作者が選んだスラッグを使い、`eveline` は id ではありません。API に名前を渡すと404です。しかしページはレコード全体を Next.js のフライトペイロードに描画しています。`self.__next_f.push` の塊を解析し、括弧を対応させてレコードを切り出すと、id と予備のレコードの両方が得られます。そのあと、対応の疑問にはどんな推測よりもバンドルがよく答えました。Wyvern は自前の V2 書き出し処理を含み、それは `system_prompt: e.pre_history_instructions`、`post_history_instructions: e.post_history_instructions`、`creator_notes: e.creator_notes`、`depth_prompt.prompt: e.character_note` と書いていました。これを読んだことで 0.12.0 の2つのバグが見つかりました。最初のリーダーは `system_prompt` を見ていたため935文字の System Prompt を落とし、高度な `greetings` のオブジェクトを文字列として扱っていました。どちらも直り、テストはサイト自身のフィールド名を使っています。

**JanitorAI の定義は欠けていたのではなく、エスケープされていました。** API は匿名の呼び出しに今も `personality: null` と `showdefinition: true` を返します。矛盾に見えますが、ページを見るまでそう見えるだけです。Vite アプリはストアを `window.mbxM.push(JSON.parse("{\"SJ--a:a-a--characterStore\":{…}}"))` でハイドレートします。JSON ドキュメントを含む JSON 文字列リテラルです。古いページリーダーはデコード済みの `{"id":…}` を探していて、何も見つけていませんでした。`scriptPayloads()` は今、リテラルを解析してからその結果を解析し、採点しながらの走査がストア内のキャラクターオブジェクトを見つけます。同じペイロードはログイン済みのリーダーにも定義を運びます。サーバーがそのセッションのために描画したコピーだからです。匿名のレコードは要約のままで、パネルはそれを正確に伝えます。作者は定義を公開に設定したが、このセッションは受け取っていない、と。これは「作者が隠した」とは別のメッセージで、バグ報告ではその違いが重要です。

**CAI Tools は分解したのであって、コピーしていません。** チャットの書き出しは5つの形式を定義します。読める形、Tavern JSONL、Oobabooga JSON、定義テキスト、PDF。最初の4つは依存関係ゼロの規則に合います。Tavern のファイルにはメタデータ行と `is_name` が必要で、Oobabooga のファイルにはペアの結合と最初のユーザーターンからの開始が必要でした。今は両方を、JSON アーカイブ、Markdown、会話例と一緒に生成します。PDF は意図的に外しました。jsPDF とアバターを使い、同梱フォントなしで忠実な Unicode PDF はここでは作れません。Markdown はブラウザから PDF に印刷できます。CAI Tools の残り — チャット画面の置き換え、背景、フォント、メモリピン、ライブラリ、検索 — はエクスポーターではないので再現しません。

**PNG は Node だけでなくブラウザで確かめました。** 実際の JanitorAI レコードを読み、ロアブックのエントリを1つ与え、実際のポートレートとともに 512×512 のタイルに描き、PNG として書き出しました。そのあとファイルを読み戻すと `IHDR, tEXt (chara), tEXt (ccv3), IDAT…`。両方の base64 ブロックは本のエントリを含む有効な V2/V3 JSON にデコードされ、ポートレートの経路はイニシャルのタイルではなく `cors` と報告しました。ユニットテストでは得られない端から端までの証拠です。canvas、`btoa`、`TextEncoder`、CRC、ブロックの配置を、拡張機能を実行するのと同じブラウザで確かめたのです。

**まだ検証できていないこと。** JanitorAI、Character.ai、Crushon.ai のログイン済み読み取りは範囲外のままです。ホストはこれを組み立てたマシンに Cloudflare の403を返し、内蔵ブラウザにアカウントのセッションはありません。契約は文書化しましたが、ログイン済みの読み取りはしていません。Chub、Venus の API、Wyvern の id スラッグとカスタムスラッグ、JanitorAI の匿名読み取り、ハイドレーションストアからの復元は実際のサイトで動かしました。

### 0.11.2 — パネルにだけ存在したポートレート

**2枚のカードが灰色の文字として書き出され、ファイルが理由を語っていました。** Alana Flores の2つの PNG は正しい位置に `chara` + `ccv3` を持ち、`data.avatar` には `image-cdn.flowgpt.com` の正しい URL が入っていました。カードは正しく、画像だけが取得されていませんでした。`prepareAvatar()` は走り、`requestImage()` は空を返し、イニシャルのタイルが描かれていました。パネルが写真を表示し続けたのは、プレビューが普通の `<img>` で拡張機能の仕組みを必要としないからです。

**0.11.0 の説明は間違っていて、測り直すと理由が分かりました。** その版は `image-cdn.flowgpt.com` と `cdn.mokio.ai` が `Access-Control-Allow-Origin` を送らないとしていました。そう主張した調査は `Origin` を送っていませんでした。ブラウザがするように送れば、両方のホストは `Access-Control-Allow-Origin: *` を返します。CDN は問題ではなく、worker が問題でした。ポートレートの `<img crossOrigin="anonymous">` 読み込みは機能し、0.11.0 はまさにそれを、代替のない worker 呼び出しに置き換えていました。その後、両方の経路を実際の Chromium で動かしました。まず `avatarSource=worker`、99 KB の data URI、526 KB のカード PNG。次に `https://*.flowgpt.com/*` をマニフェストから外して worker が CDN に届かないようにすると、`avatarSource=cors` で同じバイト、同じポートレートでした。

**何が変わったか。** worker は最初の経路のままです。`cdn.crushon.ai` はセッション cookie なしで403を返し、それを運べるのは worker だけだからです。CORS 読み込みが代替です。恒久的な `avatarReady` のラッチは消え、一度失敗したカードは次の書き出しで再試行されます。ステータス行は失敗を名指しします。`- イニシャルのタイル (worker unreachable: the extension was reloaded - reload this tab)` や `- イニシャルのタイル (http 403)` で、設計上の判断には見えません。同じ報告の Character.ai のエラーも同じ情報の欠落でした。そのログは worker の各段階で `no answer` に終わり、content script から見た失われた拡張機能コンテキストはそう見えます。今は runtime のエラーを報告し、使えるものが入っていない200はどの形を受け取ったかを伝えます。

### 0.11.1 — ファイルは修正前のビルドのものでした

**報告は新しい書き出しがまだ失敗すると言い、ファイルは逆のことを言っていました。** 失敗した PNG が添付されていたので、コードではなくまずファイルを解析しました。ブロックの一覧は `IHDR`、`tEXt` が1つ（`chara`、2170バイト）、繰り返す `IDAT`、`IEND`。`zlib.crc32` に対する CRC は有効。base64 のペイロードはカード。Pillow は 512×512 RGBA として開き、同じテキストブロックを出します。テキストブロックが2つではなく1つで、JSON に `avatar` キーがないこと以外は何も悪くなく、それは 0.10.0 が書いていたものそのものです。0.11.0 のエクスポーターは `chara` + `ccv3` と `avatar` フィールドを書きます。ブラウザはまだ古い content script を実行していました。Chrome は権限が変わると展開済み拡張機能を無効にし、すでに開いているタブは再読み込みするまで古いスクリプトを保持します。そのタブからの書き出しは新しい名前の古いファイルを生み、「修正が効かなかった」とまったく同じに見えます。

**参照カードをダウンロードして分解しました。** Chub はカードを `avatars.charhub.io/.../chara_card_v2.png` として公開し、Tavo 自身のインポートガイドも Chub を指しています。そのファイルは `IHDR, tEXt (chara), IDAT…, IEND`、`data.avatar` フィールド、完全な `character_book`。`ccv3` はありません。このエクスポーターの配置はそれに一致し、`chara` の後に `ccv3` を加えています。どちらも `IDAT` の前で、最初の画像ブロックで止まるリーダーにも見える位置です。そこから修正以上の価値がある2つの変更が出ました。パネルが何を作ったかを表示すること（フッターのバージョンと、書き出し時の `PNG saved - chara + ccv3 - v0.12.0.`）、そして JSON が `data` の隣にフラットな V1 フィールドを書くことです。V2 以前のリーダーは `data` の中を決して見ません。Agnai のインポーター、Pygmalion、Gradio のローダーです。1つのファイル、2つの世代。

### 0.11.0 — カードは正しかった、リーダーがもう一方のブロックを欲しがっていた

**2つの報告、1つのファイル形式。** Tavo が *「No se detectaron metadatos PNG」* で拒否した PNG と、キャラクターは読み込むがポートレートが空のままの JSON インポート。どちらもサイトではなく、拡張機能が実際に書くファイルに対して再現しました。

**PNG は有効な V2 カードでした。** ブロックの順序、長さフィールド、CRC32 を `zlib.crc32` に対してバイト単位で確認しました。署名、`IHDR`、`chara` キーの base64 JSON を持つ `tEXt` ブロック、そして無傷の画像データ。何も壊れていません。欠けていたのは2つ目のブロックです。SillyTavern は `chara` と `ccv3` を書き、Tavo は `ccv3` を先に探し、もう一方に落ちる代わりにメタデータがないと答えます。ブロック1つが、拒否されるファイルと受け入れられるファイルの違いすべてでした。今は両方をその順で書き、テストは完全な一覧 `IHDR, tEXt, tEXt, IDAT, IEND` を zlib で検証した各 CRC とともに主張します。

**JSON にはもともと画像のスロットがありませんでした。** V2/V3 仕様はテキストだけです。Tavo の JSON インポートは常にポートレート選択が空のキャラクターを作り、スクリーンショットが示していたのはまさにそれでした。JSON に画像を入れる唯一の方法は data URI なので、書き出しは 512×512 の JPEG（約40 KB）を `avatar`、`data.avatar`、`data.extensions.avatar` に埋め込みます。フロントエンドがどれかを読めば、画像はネットワーク要求なしで届きます。Tavo は画像を PNG か選択画面から取るアプリとして文書化されているので、このアプリへの正直な答えはこうです。画像とカードを一緒に持つなら PNG、テキストなら JSON。

**アバターは始まる前に失敗していました。** 古いコードはポートレートを `crossOrigin = "anonymous"` で読み込み、画像レスポンスに `Access-Control-Allow-Origin` を要求していました。5つの CDN を調べただけで答えは出ました。`image-cdn.flowgpt.com` と `cdn.mokio.ai` はヘッダーなし、`cdn.polyspeak.ai`、`characterai.io`、`ella.janitorai.com` は `*`、`cdn.crushon.ai` は cookie なしで403。Emochi では CORS 読み込みが1バイトも受け取らず、書き出しは黙ってイニシャルのタイルに落ち、成功したように見えていました。今はポートレートが `background.js` を通り、CDN ごとのホスト権限で base64 として戻り、`createImageBitmap` でデコードされます。CORS を必要とせず、canvas を汚すこともありません。fetch の失敗は今もタイルに落ちますが、失敗は失敗した fetch を意味し、間違ったモードではありません。これは5つの新しいホスト権限を要するので、Chrome は更新時に拡張機能を一度無効にし、再度有効にするまでそのままです。

### 0.10.0 — Saucepan、そして断片で届く Description

**サイトは外から見える姿とは違いました。** `api.saucepan.ai` はブラウザ以外の接続をすべてリセットし、それは通常 Cloudflare と行き止まりを意味します。そうではありませんでした。アプリ自身のベース URL が空文字列なので、すべての呼び出しは `https://saucepan.ai/api/...` に行き、エッジでプロキシされます。同一オリジン、CORS なし、そしてクライアントがすべての要求に付ける静的ヘッダー（`cf-edge-token-8af3`）。この発見が、ブラウザなしでサイト全体を読めるようにしました。

**次はフィールドの契約で、推測ではなくバンドルから。** アプリは API 全体を含む 9.8 MB のバンドルを積んでいます。666 のリクエスト経路を宣言しています。companion エディタの検証スキーマは、サイトが保存するすべてのフィールドを名指しします。`card`、`full_description`、`short_description`、`example_dialogue`、`starting_scenarios[]`、`advanced_prompt`、`formatting_instructions`、`hidden_fields`、`external_model_policy`。プロフィールコンポーネントは描画するすべてのフィールドを名指しします。2つの形、1つの製品。その違いがこの版の物語です。

**Description はおとりの入った断片リストです。** 最初の実在する公開 companion は Description に54個の断片を返し、本物は7個でした。おとりは小さな語彙から作られた文法上のノイズ — *signal*、*glance*、*window*、*pattern*、*gentle*、*quiet* — なので、一見すると文章に見え、「長い文字列を取る」という素朴なヒューリスティックを生き残ります。見分ける手がかりはクライアントにあります。各断片は `proof` を持ち、その proof がマスクと `key ^ mask` から作った種での FNV-1a ハッシュと一致するときだけ本物です。本物は `key ^ mask` で並べ替えて連結します。7つの断片が137文字のきれいなテキストに戻りました。手順は `decodeFragments` で、実際の応答からコピーした断片に対して検証しています。開始メッセージも `starting_scenarios_fragments[].message` に同じ構造を使います。非公開のシナリオは単に現れず、空のスロットはセンチネル `≠≠≠BLANK_SCENARIO≠≠≠` として保存され、リーダーが捨てます。

**プロキシが疑問で、答えは `providers_profile` でした。** フィールドはエディタで `external_model_policy`、公開レコードで `providers_profile` です。`custom_and_vetted`、`vetted_only`、`internal_only`。チャットがどのモデルを呼べるかを決めるもので、プロフィールが提供するものではないので、注記行に報告し、それ以外には使いません。どちらのポリシーも同じように書き出されます。公開 companion には2つの可視性スイッチがあるため、読み取り経路も2つです。公開レコードは匿名で常に Description を持ち、定義は2回目の呼び出しで `localStorage["hallucination/auth_token"]` の bearer を必要とし、作者が Definition Visibility を閉じていると拒否されます。自分の companion には3つ目の経路 `/api/v1/companion/editable` があり、エディタの生レコードを返し、可視性を気にしません。**検証できなかったこと：** 定義と editable の経路はセッションを要するので、その形は消費するクライアントコードから取ったもので、ログイン済みの呼び出しからではありません。公開経路、断片デコーダー、プロバイダポリシー、シナリオ断片は実際の companion で動かしました。103テスト、うち11が新規。

### 0.9.0 — 閉じた2サイト、1つの仕組み、そして3つのバグを抱えた Emochi パーサー

**優先だったので Emochi から。** 未解決の報告が2件ありました。一部のボットで性格とシナリオが出ないこと、そして `characterExampleConversation` がカードに届かないことです。

会話例のバグは10分で片づきました。定義ルートは `characterExampleConversation` を**ターンの配列**として返すのに、リーダーが `String(...)` をかけていました。配列は環境によって `"[object Object],[object Object]"` になり、正規化側の `s()` ヘルパーでは `""` になります。どちらにせよ会話ではありません。今はターンとしてパースし、`{role, content}`、`{user, ai}`、`{isUser, text}`、`{dialogue: [...]}` のラッパーを受け付けます。Emochi 自身のレコーダーが1つ目、カードインポーターが2つ目を使い、残りはスキーマ変更前のレコードに現れるからです。

性格の欠落は時間がかかり、積み重なった3つの別々の不具合でした。

1. **閉じの指示を境界として扱っていた。** コンパイル済みプロンプトは必ず `Do not write as {{user}} or assume {{user}}'s reaction or response.` で終わります。リーダーはそこでテキストを切り、末尾をすべて捨てていました。ルールで終わるプロンプト——つまりコンパイラが生成するもの——には正しい挙動です。作者が自分の背景や会話例の中でそのルールを引用した瞬間に誤りになります。そしてそれは思うより頻繁に起きます。モデルに教えるために、わざと例の中へルールを貼る人がいるのです。引用より後のセクションがすべて消えていました。修正は、その文が現れた場所で除去し、周囲のテキストを残すことです。
2. **セクション文法が1つの表記しか受け付けなかった。** マーカーは `'s personality:`、`'s background:`、`scenario of role-play:` でした。ビルダーを使わず自分でプロンプトを書いた作者が `Personality:` と打つと（大文字、所有格なし）、何もパースされず、プロンプト全体が「マーカーなし、性格として扱う」分岐に落ちていました。行頭固定で揺れを許容する2つ目のマーカー集合を追加し、より多くを認識したパスが勝つようにしました。同点なら厳格な文法を保つので、コンパイラが生成したプロンプトは以前とまったく同じにパースされます。
3. **空セクションの注記が推測だった。** リーダーは、これらのフィールドが空になるたびに「作者が性格と会話例を空のままにしました」と表示していました。パーサーがレイアウトを認識できなかった場合も含みます。その場合、空なのはパーサーのせいです。注記は名前行も認識できたとき、つまりレイアウトを実際に理解したときだけ出るようになりました。

3つとも、通る形ではなく落ちる形から書いたテストでカバーしています。

**次に Polybuzz のサンプル会話。** チケットには *Estilo de diálogo* エディタのスクリーンショットがありました。アバターが横にある行が `{{user}}`、ない行が `{{char}}` です。作成ページのバンドルを読むと形が確認できました。`dialogueStyleObj` は `{user, ai}` ペアの配列で1交換につき1エントリ、詳細レコードは `dialogueStyle.dialogue` として返します。どちらもカードの行にパースされます。平坦な `conversationExample` 文字列は同じデータを1行 `user;ai` にしたもので、その形も書き換えます。

落とし穴が1つ。`dialogueStyle` 直下の素の文字列は**スタイルラベル**（`Descriptivo, frases cortas`）であって会話ではありません。パーサーの最初の版はスタイルラベルを意気揚々と `{{char}}: Descriptivo, frases cortas` に書き換え、例ブロックに入れていました。テストが捕まえました。今は文字列が会話になることはなく、配列と `user;ai` テキストだけが対象です。

**次に Character.ai。** 手法は [taquanta のエクスポーター](https://github.com/taquanta/character-ai-to-crushon-ai-card-exporter) から取っています。同じ問題を解いた実装です。レコードはページ自身の JavaScript だけが、拡張機能には作れない `Authorization: Token <hex>` ヘッダー付きで取得します。参照実装はページ世界（`MAIN`）でスクリプトを動かし、`fetch` と `XMLHttpRequest` を横取りしてヘッダーを DOM に保存します。ブラウザがあなたのコンテキストの外で足すヘッダーを見る唯一の方法です。

変更は2点。トークンは衝突しやすい名前ではなく、名前空間付きの meta タグに入れます。そしてページが受け取るすべての JSON レスポンスを、**文字列**を運ぶ DOM イベントとして再送出します。オブジェクトは `MAIN` スクリプトと分離された content script の境界を越えられませんが、文字列は越えられます。この1点でスニッファーは「トークンを捕まえて呼び出しを再生する」から「トークン*と*応答を捕まえる」に変わり、再生が拒否されてもリーダーは動き続けます。

定義が面白いフィールドです。Character.ai はそれを **Definition Visibility** の奥に置いています。キャラクター公開設定とは別の2つ目のスイッチで、オフならテキストは誰にも送られません。つまり会話例ブロックが空のカードは作者の設定であって読み取り失敗ではなく、パネルはエラーではなくそのままそう表示します。

**次に Crushon.ai。** 完全にクライアント描画で、ボット対策の壁の内側にあります。再生すべき公開 API はなく、ページ自身の呼び出しはセッション状態を運ぶので、リーダーは何も呼びません。ページがすでに受け取ったペイロードを歩き、既知のフィールド名をいくつ持つかで各オブジェクトを採点します。最も豊かなものが勝ちます。別名はリリース間でサイトが使ってきた表記をカバーします。1つの表記を取りこぼすとフィールド全体を失うからです。

両リーダーの共通部分が `src/harvest.js` です。ペイロード収集、トークン読み戻し、採点しながらの走査。新リーダー2つ、共通ファイル2つ、`exporters.js` と `panel.js` の変更ゼロ。すべてのサイトリーダーが同じカードオブジェクトを埋めるというルールがそれを可能にし、次のサイトが1ファイルで済む理由でもあります。

**検証できなかったこと。** 新しい2ホストは、これをビルドしたマシンに Cloudflare の `403` を返すため、どちらのリーダーもログイン済みブラウザに対して動かしていません。検証できたのは、neo エンドポイントが生きていて、合成 ID に対して `{"status":"NOT_OK","error":"bad request"}` を返すこと — 呼び出し側ではなく本文に文句を言っている応答です。フィールド契約は taquanta の動作する実装から来ています。changelog、To-do、そしてここに未検証と書いています。動かしていないリーダーと、動かしたリーダーは別の主張だからです。

### 0.8.0 — フォークに名前と6言語

リポジトリは4サイトを支えているのに元の名前のままでした。**Universal Character Card Exporter** に改名。していることそのものです。同時に Issues を有効にしました。バグ報告のセクションが、存在しないタブへ人を送っていたからです。

ドキュメントは一度に6言語へ。サイト別の API 記録は英語のまま、セクション冒頭でそう断っています。最も早く古くなる参照資料であり、古い文書のコピー6つは利益ゼロで保守が6倍になるからです。翻訳からはそこへリンクします。

Polybuzz のセクションは書き直しました。以前は「取得できない」という結論だけを置いていました。今は根拠がその下にあります。作成フォームの「非公開」ラベル、ルートの網羅的な走査、他人のボットでの `210002`、2アカウントで行った `ZZZ-123` 対照実験。主張だけの陰性結果には価値がありません。手法を添えた陰性結果には価値があります。

### 0.7.13 — 作者自身のタグから性格を作る

Polybuzz は背景も性格フィールドも公開しないため、カードの Personality ブロックは空のままでした。タグツリーはカードのタグ一覧のためにすでに取得していたので、もっと注意して読みました。すべてのタグは4つの親のいずれかに属し、`Personalidad` には作者が手で選ぶ41の気質語が入っています。それは作者自身の人物描写で、作者が書き、サイトが公開しているものです。

突き合わせは特定の意味で誠実です。ジャンル・出自・アイデンティティのタグは Personality に入れずタグ一覧に残し、実在する `systemRole` があればタグより優先します。ライブの10ボットで計測：10/10 が実際の Personality ブロックを生成しました。タグ一覧は書かれた背景より薄いですが、推測ではなく作者の言葉です。

### 0.7.10 – 0.7.12 — エコーはフィールドではない

3リリース、1つの考え。`getsceneconfig` にシーン ID を渡すと、紹介文をコンパイルしたものがフォールバックとして返ります。アカウントが所有していないボットを5回ログイン状態でスキャンすると、`sceneBrief` と文字単位で同一の `systemRole` が返りました。それが空の背景をサーバーが描画する方法であり、たまたま一致する2つ目のフィールドではありません。完全一致のエコーは不在として扱い、各ルートは最初の非空ではなく自分の応答を保持し、パネルはバナーではなく脚注を出します。作者専用フィールドは通常ケースだからです。

シナリオも同じ作業から出ました。Polybuzz のグリーティングは often ト書きで始まり（`*Bangchan es tu esposo*`）、それが作者自身の前提です。レコードに `templateIntro` がないとき、そのまま昇格させます。言い換えは決してしません。

---

## Changelog

すべての修正とその理由を含む完全なリリース履歴：**[CHANGELOG.md](CHANGELOG.md)**。

短い版：

| バージョン | 入ったもの |
|---|---|
| 0.12.0 | Chub.ai、Venus.chub.ai、WyvernChat のリーダー、ページのハイドレーションストアから復元する JanitorAI の定義、Character.ai の **Save chat**（Tavern JSONL、JSON、Markdown、会話例、Oobabooga）、完全な `character_book` エントリとカード拡張、実際のブラウザで検証した PNG、137テスト |
| 0.11.2 | worker が落ちてもポートレートを取得（worker → 直接読み込み）、失敗理由を表示、Character.ai のログが各応答を表示、111テスト |
| 0.11.1 | パネルが実行中のバージョンと書き出した PNG ブロックを表示、JSON に V1 のフラットフィールドも追加、107テスト |
| 0.11.0 | PNG に `chara` + `ccv3`、worker 経由でポートレート取得（CORS なしの CDN でもイニシャルにならない）、JSON にポートレートを data URI で、106テスト |
| 0.10.0 | Saucepan.ai リーダー：断片のデコード、2つの読み取り経路、ロアブック、プロバイダ方針を注記行に、103テスト |
| 0.9.1 | Character.ai：認証スキームを保持、コールドロード時の読み取り手順、サーバー描画データのフォールバック、92テスト |
| 0.9.0 | Character.ai と Crushon.ai のリーダー、Polybuzz のサンプル会話、Emochi パーサー修正、Emochi Lab、92テスト |
| 0.8.0 | 改名、6言語ドキュメント、クレジット節、Polybuzz 根拠の書き直し、Issues 有効化 |
| 0.7.13 | 作者の `Personalidad` タグから Polybuzz の Personality |
| 0.7.12 | グリーティングのト書きから Polybuzz の Scenario |
| 0.7.11 | ルート別の候補保持で、エコーが実在の背景を隠せない |
| 0.7.10 | 会話を意識した設定チェーン、静かなパネル |
| 0.7.0 – 0.7.9 | Polybuzz 対応、最初から最後まで |
| 0.6.0 – 0.6.1 | Emochi リーダーとプロンプト履歴のディープスキャン |
| 0.5.0 以前 | JanitorAI、erpocalypse のオリジナル拡張機能から継承 |

---

## To-do

- [x] **Character.ai 対応を追加する。** 0.9.0 で完了。定義は作者の Definition Visibility 設定に依存します。
- [x] **Crushon.ai 対応を追加する。** 0.9.0 で完了。ページが描画するものを読みます。
- [x] **優先 — Emochi：一部のボットで性格・シナリオが表示されない。** 0.9.0 で修正。原因は3つ、すべてパーサー側でした。閉じの指示を切り取り境界として扱っていたこと、セクション文法が1つの表記しか受け付けなかったこと、「作者が空のままにした」注記が認識できていないレイアウトでも出ていたこと。詳細は [changelog](CHANGELOG.md)。
- [x] **優先 — Emochi：会話例が取得できていない。** 0.9.0 で修正。`characterExampleConversation` はターンの配列で届き、文字列変換が `""` にしていました。今はターンとしてパースします。
- [x] **Emochi Lab 対応。** Story、Soundstage、LiveRoom の URL は同じプロンプトレコードとして読み、パスの末尾セグメントを id にします。未ログインのセッションでは Lab 自身の URL 形状を観測できなかったため、別のレコード種別を使うサーフェスでは中途半端なカードではなく失敗したルートを報告します。
- [x] **Saucepan AI 対応を追加する。** 0.10.0 で完了。公開 companion は Description と公開スタートメッセージ付きで書き出せます。定義とロアブックはサインインが必要で、定義はさらに作者の Definition Visibility スイッチが要ります。定義と editable のルートは、セッション付きの呼び出しではなく、それを消費するクライアントコードから文書化しています。どちらかが空で返ってきたら、パネルのメッセージを添えた issue がまさに必要なものです。
- [x] **Tavo の JSON インポート：どのアバターフィールドを読むか確認する。** 0.12.0 で回答。Tavo のキャラクターオブジェクトは `avatar`（URL またはパス）を持ち、インポーターは完全な CCv3 ラッパーか裸の `data` オブジェクトを受け取り、APK 1.9.0 に `avatar_url` の文字列はありません。JSON はポートレートを `avatar`、`data.avatar`、`data.extensions.avatar` に書き、画像をカードと一緒に届ける必要があるときは PNG が文書化された経路のままです。
- [x] **WyvernChat.com 対応。** 0.12.0 で完了。id スラッグとカスタムスラッグの両方を解決し、ロアブックは Deep scan で読み、対応は Wyvern 自身の V2 エクスポーターに従います（`pre_history_instructions` → `system_prompt`、`character_note` → `extensions.depth_prompt`）。
- [ ] **Character.ai と Crushon.ai のリーダーをログイン済みセッションで検証する。** 両ホストとも、このリリースをビルドしたマシンに Cloudflare の `403` を返すため、契約は検証済みでもライブ読み取りは未検証です。どちらかのリーダーが動かない場合、パネルのメッセージを添えた issue がまさに必要な情報です。
- [x] **Chub.ai と Venus.chub.ai 対応。** 0.12.0 で完了。キャラクターの読み取りはエンドポイントに CORS ヘッダーがないため拡張機能の worker を通り、Venus は同じ SPA と同じ API を提供します。Deep scan は埋め込みロアブックと関連ロアブックを読み、完全な重複を捨てます。
- [x] **あらゆるプラットフォーム向けに、完全な定義を載せた PNG メタデータ。** 0.12.0 で実施し再検証しました。`chara`（V2）と `ccv3`（V3）の `tEXt` ブロックがどちらも `IHDR` の直後、`IDAT` の前にあり、CRC は有効、`character_book` を含む完全なカード JSON。実際の Chromium のビルドが 1.14 MB のカードを生成し、読み戻しました。
- [x] **CAI Tools の書き出し機能を移植する。** 0.12.0 で Character.ai の経路について完了。定義・グリーティング・カテゴリ・アバターの対応と、チャットの Tavern JSONL、JSON、Markdown、会話例、Oobabooga ペアとしての書き出し。CAI Tools のチャット UI 置き換え、背景、フォント、メモリ管理、ライブラリ、検索、jsPDF 出力は UI 機能か依存関係なので範囲外です。

対応済みのサイトで半分しか動かないリーダーは、完全に動くサイトがもう1つ増えるより悪い。だから Emochi の2項目は片づくまで新サイト対応より上にありました。

---

## バグ報告

**[Issues タブ](https://github.com/mxchu666/Universal-Character-Card-Exporter/issues)** を使ってください。有効になっています。次の内容を含めてください。

- サイト名とキャラクターの URL。
- 使っているバージョン — **書き出しパネルのフッターにカーソルを合わせると、ツールチップにバージョンが出ます**。
- 期待したことと、実際に起きたこと。パネルのスクリーンショットが最も役立つ1枚です。
- パネルに表示されたメッセージ。検索に失敗したとき、パネルはルート名とレスポンスコードを表示します。そのテキストこそ修正に必要な情報です。

機能要望も同じ場所で歓迎します。

---

## これは許可されているのか

個人用のバックアップツールです。ログイン中に見えているものを読み、オープンな形式で保存するだけです。課金の壁を迂回したり、本来見られないものを解錠したりはしません。

サイトの利用規約が自動アクセスを制限している場合があります。自分のキャラクターと個人バックアップに使い、再共有するときは作者をクレジットし、サイトに負荷をかけないでください。

## プライバシー

- スキャンしたキャラクターデータがブラウザの外に出ることはありません。解析も外部コードもありません。
- ホスト権限はマニフェストのサイト、その API ホスト、ポートレートの CDN に限られます。`<all_urls>` 権限はありません。
- ネットワーク呼び出しは、いま開いているサイト、そのサイトの API、そのポートレートホストに対してだけです。

---

## 開発者向け

拡張機能は依存関係もビルド手順もない素の JavaScript です。`src/` を編集して、拡張機能ページから再読み込みしてください。

```sh
node --test
```

`src/scraper.js` が JanitorAI、`src/emochi.js` が Emochi、`src/polybuzz.js` が Polybuzz、`src/cai.js` が Character.ai、`src/crushon.js` が Crushon.ai、`src/saucepan.js` が Saucepan.ai、`src/chub.js` が Chub.ai/Venus.chub.ai、`src/wyvern.js` が WyvernChat を読みます。8つとも同じカード形状を埋めるので、エクスポーターとパネルはどのサイトかを気にしません。`src/exporters.js` が変換、`src/panel.js` と `src/panel.css` がページ上のパネル、`background.js` は content script では作れないリクエスト（CORS、禁止ヘッダー）用のサービスワーカーです。

2つのファイルは、レコードを API に一切公開しないサイトのためだけに存在します。`src/intercept.js` はページ自身の世界で動き（`world: "MAIN"`、`document_start`）、ページがすでに知っていることを DOM に写します。`src/harvest.js` はそのペイロードを集め、既知のフィールド名の一覧に対して各オブジェクトを採点します。3つ目の閉じたサイトを足すのは、そのキーを宣言する1ファイル分です。

**サイト別の API 記録は英語版 README にあります**（[Developer reference](README.md#developer-reference-english-only)）。参照資料であり、サイトが変更したときに最も古くなる部分なので、意図的に英語で維持しています。各翻訳はそこを指しています。

---

## ライセンス

[MIT](LICENSE).
