// ============================================================
// PRISM — Prompt Templates for 4-Phase Analysis
// ============================================================

import type { PrismInput, CustomPrompts } from './types';

// ── Default System Prompt ──
export const DEFAULT_SYSTEM_PROMPT = `あなたは「社会記号学者 兼 マーケティングストラテジスト」です。

【あなたの役割】
- 脱・広告: 「売り込み」のトーンを排除し、「社会的な発見」のトーンで語る。
- 脱・妥協: 「安いから我慢する」ではなく「安いからこそ面白い」というような、価値の反転（逆転）を見つけ出す。
- 共感のエンジニアリング: 生活者がSNSでつぶやきたくなる「ドヤ感」や「自己肯定感」を言語化する。

【社会言語とは】
一般呼称ではなく、特定のサービス名でもなく、社会の共感として潜在的にあったものが「言語化」されることにより、納得と賛同が広がり、新たな定義と市場が広がっていくキーワード。
例：「胃部膨満感」のように、症状や現象に名前がつくことで顕在化するもの。

【品質基準】
1. ドヤ感: その言葉を使った時、「賢い私」「工夫している私」という肯定感が生まれるか
2. 遊びの余白: 用途を限定せず、「あなたならどう使う？」という問いかけが内包されているか
3. 脱・妥協: 「我慢する」ではなく、「だからこそ最高に面白い」という価値の逆転があるか
4. メディア親和性: ニュースのテロップやSNSのハッシュタグとして違和感がないか

必ず日本語で回答してください。`;

// ── Default Phase Templates ──
// Variables: {{productName}}, {{category}}, {{challenges}}, {{phase1Summary}}, {{socialLanguages}}, {{surveyDesign}}

// ── Multi-angle Grounding Search Prompts ──

const SEARCH_ANGLES = [
  {
    label: 'レビュー・口コミ全般',
    template: `「{{productName}}」（{{category}}）について、レビューサイトや口コミサイトでの生活者の評価・感想を調査してください。実際のレビュー投稿から具体的な声をできるだけ多く引用してください。日本語で回答してください。`,
  },
  {
    label: 'ポジティブ・裏技系',
    template: `「{{productName}}」（{{category}}）の意外な使い方、裏技、シンデレラフィット、便利な活用法についてSNSやブログでの声を調査してください。「こんな使い方があったのか」という発見系の投稿を重点的に探してください。日本語で回答してください。`,
  },
  {
    label: 'ネガティブ・不満・失敗',
    template: `「{{productName}}」（{{category}}）に対する不満、失敗談、がっかりした声、「使えない」「微妙」「期待はずれ」「すぐ壊れた」「買って後悔」という声をレビューサイト・口コミ・掲示板・SNSから調査してください。「仕方なく使っている」「もっとこうしてほしい」という諦めの声も含めてください。日本語で回答してください。`,
  },
  {
    label: '掲示板・Q&A・リアルな不満',
    template: `「{{productName}}」（{{category}}）について、Yahoo知恵袋、5ちゃんねる、Reddit、価格.comの掲示板など、匿名の本音が出やすい場所での生活者の声を調査してください。特に「{{productName}} 最悪」「{{productName}} ダメ」「{{productName}} 使えない」「{{productName}} 品質」といった不満や本音の声を重点的に探してください。日本語で回答してください。`,
  },
  {
    label: 'SNS・リアルタイム検索・呟き',
    template: `「{{productName}}」（{{category}}）に関するSNSの呟きやリアルタイムの声を調査してください。Yahoo!リアルタイム検索（search.yahoo.co.jp/realtime）やTwitter/Xで「{{productName}}」について投稿されている生の声を探してください。ポジティブ・ネガティブ両方、特に「{{productName}} 行ってきた」「{{productName}} 最悪」「{{productName}} おすすめ」「{{productName}} がっかり」「{{productName}} 美味しい」「{{productName}} まずい」といったリアルな呟きを探してください。日本語で回答してください。`,
  },
  {
    label: '市場・比較・トレンド',
    template: `「{{category}}」の市場トレンド、「{{productName}}」と競合との比較、業界に対する生活者の認識やトレンドの変化を調査してください。日本語で回答してください。`,
  },
  {
    label: '妥協・諦め・仕方なく使っている声',
    template: `「{{productName}}」（{{category}}）を仕方なく使っている、本当は別のものが良いけどコスパで選んでいる、品質に不安があるが我慢している、という「妥協の声」を調査してください。「安かろう悪かろう」「値段相応」「壊れても買い直せばいい」といった諦めの感覚を探してください。日本語で回答してください。`,
  },
];

/**
 * Build multiple grounding prompts for parallel search.
 */
export function buildMultiGroundingPrompts(input: PrismInput): string[] {
  return SEARCH_ANGLES.map(angle =>
    fillTemplate(angle.template, {
      productName: input.productName,
      category: input.category,
      challenges: input.challenges,
    })
  );
}


export const DEFAULT_PHASE1_TEMPLATE = `【Phase 1: Deep Listening & Insight — 前提の整理】

対象商材: {{productName}}
カテゴリ: {{category}}
現状の課題・特徴: {{challenges}}

あなたのタスク:
以下の複数の検索結果データを分析し、生活者の声を抽出・整理してください。

**⛔⛔⛔【最重要 — 絶対厳守】ファクトチェックルール ⛔⛔⛔**:
- 声は **下記に添付されたソースデータに実際に書かれている内容** からのみ抽出すること
- ソースに存在しない声を **絶対に** 創作・捏造しないこと（ハルシネーション厳禁）
- 各声を出力する前に「この声はソースのどの部分に書いてあるか？」を自問すること。答えられないなら **その声は出力しない**
- **0個でも構わない** — 存在しない声を作るより、空配列 [] を返す方がはるかに良い
- **ソースの多様性**: できる限り複数の異なるソースから抽出すること。1つの記事から最大5個まで抽出可能
- **数の目標**: ポジティブ・ネガティブそれぞれ **10個を目標** に、ソースから丁寧に拾い上げること。ただし、存在しない声の創作は絶対禁止

⚠️ **声の出力は後工程で機械的にソースデータと照合されます。ソースに存在しない声は自動削除されます。**

**⛔ 出典URL — 絶対禁止事項 ⛔**:
- **URLを自分で生成・推測・創作することを絶対に禁止する**
- sourceUrl には **下記の「出典URLリスト」に掲載されているURL** のみを使用すること
- リストにないURLを1つでも出力した場合、全体が無効になる
- 声の内容と明確に対応するソースがない場合は、sourceUrl を **空文字 ""** にすること
- sourceTitle もソースから取得した実際のサイト名のみを使用すること（サイト名の創作も禁止）

1. **ポジティブ・ハック（Positive/Hack）**: メーカーの意図を超えた使い方、シンデレラフィット、攻略の悦び。ソースの直接引用または忠実な要約で**目標10個**（ソースに存在する範囲で最大限抽出すること）。
2. **ネガティブ・ペイン（Negative/Pain）**: 諦め、虚無感、不満。ソースの直接引用または忠実な要約で**目標10個**（ソースに存在する範囲で最大限抽出すること）。ネガティブがソースに見つからない場合は空配列 [] を返すこと。
3. **市場の再定義（Market Redefinition）**: 「現在の市場は『〇〇』という認識だが、実態は『△△』で動いている」という最短の定義文。

**ネガティブ判定の重要ルール（フリ→オチ判定）**:
- ネガティブなフリ（前置き）があっても、結論が「{{productName}}が解決してくれた」等のポジティブなオチなら、それは**ポジティブ**に分類すること
- ネガティブとは、{{productName}}自体に対する不満・問題・改善要望であること

**対象帰属の検証ルール（ターゲット検証）**:
- 各声が本当に **{{productName}}** についての声であることを確認すること
- 別ブランド・別商品への感想を {{productName}} の声として含めないこと
- 「業界全般」への感想ではなく、{{productName}} 固有の声を優先すること

以下のJSON形式で出力してください:
{
  "positiveHacks": [{"text": "声1", "sourceUrl": "https://...", "sourceTitle": "サイト名"}, ...],
  "negativePains": [{"text": "声1", "sourceUrl": "https://...", "sourceTitle": "サイト名"}, ...],
  "marketRedefinition": "定義文"
}`;



export const DEFAULT_PHASE2_TEMPLATE = `【Phase 2: Social Language Development — 社会言語開発】

対象商材: { { productName } }
カテゴリ: { { category } }
Deep Listeningの結果:
{ { phase1Summary } }

あなたのタスク:
Deep Listeningで得た「生の声」を、一般名詞化された「社会言語」へと昇華させてください。

生成要件:
- 既存の意味や価値をひっくり返すアプローチであること
  - ニュースのテロップやSNSのハッシュタグになり得る「現象名」であること
    - ** 6つの社会言語候補 ** を開発し、それぞれにストーリーとファクトをセットで出力
      - 6つの候補は互いに異なるアプローチ・視点であること（バリエーション重視）

品質基準:
1. ドヤ感: 使った時に「賢い私」という肯定感が生まれるか
2. 遊びの余白: 「あなたならどう使う？」が内包されているか
3. 脱・妥協: 価値の逆転（リフレーミング）が起きているか
4. メディア親和性: ハッシュタグやテロップとして自然か

以下のJSON形式で出力してください:
[
  {
    "keyword": "【社会言語名】",
    "story": "なぜ今この言葉が必要なのかのロジック",
    "fact": "裏付ける生活者の行動事実"
  },
  ...
]

  ** 6つ ** の社会言語を出力してください。`;

export const DEFAULT_PHASE3_TEMPLATE = `【Phase 3: Evidence Design — イシューデザイン調査設計】

対象商材: { { productName } }
カテゴリ: { { category } }
開発した社会言語:
{ { socialLanguages } }

あなたのタスク:
「社会言語が、実は社会の正解である」ことを証明するための調査を設計してください。
「言葉（仮説）に基づき調査を作る」逆算アプローチです。

定量調査（3問）:
- 生活者が「そう言われてみればそうだ（YES）」と答えざるを得ない設問を設計する
  - これがロジックの鉄壁さを作る

定性調査（1問）:
- 具体的なエピソードやワクワク感を想起させ、その感情に名前をつけるような問い

以下のJSON形式で出力してください:
{
  "quantitative": ["設問1", "設問2", "設問3"],
    "qualitative": ["設問1"]
} `;

export const DEFAULT_PHASE4_TEMPLATE = `【Phase 4: Output Generation — アウトプット生成】

対象商材: { { productName } }
カテゴリ: { { category } }

Phase 1（Deep Listening）結果:
{ { phase1Summary } }

Phase 2（社会言語）:
{ { socialLanguages } }

Phase 3（調査設計）:
{ { surveyDesign } }

あなたのタスク:
以下の3つのアウトプットを生成してください。

1. ** 調査レポートサマリ ** (2〜3ページ分のテキスト): Phase 3の調査結果を想定して記述。データは仮想だが説得力のある数字を使用。
2. ** プレスリリース記事 **: 市場の再定義ニュースとして記事化。「消費者は〇〇を求めているのではない。△△を求めているのだ」のような切り口で。
3. ** ポジショニング提案（結論）**: クライアントへの最終提言。「御社は今後、〇〇ではなく『△△』と名乗るべきである」形式。
4. ** ニュース見出し案 **: Yahoo!トピックス風の見出し（1行）

以下のJSON形式で出力してください:
{
  "reportSummary": "レポートサマリ（Markdown形式）",
    "pressRelease": "プレスリリース記事（Markdown形式）",
      "positioning": "ポジショニング提案文",
        "newsHeadline": "ニュース見出し（1行）"
} `;

// ── Phase 4 Sub-templates (for split execution) ──

export const DEFAULT_PHASE4A_TEMPLATE = `【Phase 4a: 調査レポートサマリ生成】

対象商材: { { productName } }
カテゴリ: { { category } }

Phase 1（Deep Listening）結果:
{ { phase1Summary } }

Phase 2（社会言語）:
{ { socialLanguages } }

Phase 3（調査設計）:
{ { surveyDesign } }

あなたのタスク:
調査レポートサマリ（2〜3ページ分のテキスト）を生成してください。
Phase 3の調査結果を想定して記述。データは仮想だが説得力のある数字を使用。

以下のJSON形式で出力してください:
{
  "reportSummary": "レポートサマリ（Markdown形式）"
} `;

export const DEFAULT_PHASE4B_TEMPLATE = `【Phase 4b: プレスリリース記事生成】

対象商材: { { productName } }
カテゴリ: { { category } }

市場の再定義:
{ { marketRedefinition } }

社会言語:
{ { socialLanguages } }

あなたのタスク:
プレスリリース記事を生成してください。
市場の再定義ニュースとして記事化。「消費者は〇〇を求めているのではない。△△を求めているのだ」のような切り口で。

以下のJSON形式で出力してください:
{
  "pressRelease": "プレスリリース記事（Markdown形式）"
} `;

export const DEFAULT_PHASE4C_TEMPLATE = `【Phase 4c: ポジショニング提案 & ニュース見出し】

対象商材: { { productName } }
カテゴリ: { { category } }

社会言語:
{ { socialLanguages } }

あなたのタスク:
以下の2つのアウトプットを生成してください。

1. ** ポジショニング提案（結論）**: クライアントへの最終提言。「御社は今後、〇〇ではなく『△△』と名乗るべきである」形式。
2. ** ニュース見出し案 **: Yahoo!トピックス風の見出し（1行）

以下のJSON形式で出力してください:
{
  "positioning": "ポジショニング提案文",
    "newsHeadline": "ニュース見出し（1行）"
} `;

/** Get all default prompts as a single object */
export function getDefaultPrompts(): CustomPrompts {
  return {
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    phase1Template: DEFAULT_PHASE1_TEMPLATE,
    phase2Template: DEFAULT_PHASE2_TEMPLATE,
    phase3Template: DEFAULT_PHASE3_TEMPLATE,
    phase4Template: DEFAULT_PHASE4_TEMPLATE,
  };
}

// ── Template Variable Replacement ──
function fillTemplate(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (t, [key, value]) => t
      .replaceAll(`{ { ${key} } }`, value)
      .replaceAll(`{{${key}}}`, value),
    template
  );
}


/** Phase 1: Deep Listening & Insight */
export function buildPhase1Prompt(input: PrismInput, customTemplate?: string): string {
  const template = customTemplate || DEFAULT_PHASE1_TEMPLATE;
  return fillTemplate(template, {
    productName: input.productName,
    category: input.category,
    challenges: input.challenges,
  });
}

/** Phase 2: Social Language Development */
export function buildPhase2Prompt(input: PrismInput, phase1Summary: string, customTemplate?: string): string {
  const template = customTemplate || DEFAULT_PHASE2_TEMPLATE;
  return fillTemplate(template, {
    productName: input.productName,
    category: input.category,
    phase1Summary,
  });
}

/** Phase 2 Additional: Generate more social language candidates */
export function buildPhase2AdditionalPrompt(
  input: PrismInput,
  phase1Summary: string,
  existingKeywords: string[],
  direction?: string,
): string {
  const excludeList = existingKeywords.map((k, i) => `${i + 1}. ${k} `).join('\n');
  const directionNote = direction ? `\n\n ** 追加の方向性指示 **: ${direction} ` : '';

  return `【Phase 2: Social Language Development — 追加候補生成】

対象商材: ${input.productName}
カテゴリ: ${input.category}
Deep Listeningの結果:
${phase1Summary}

あなたのタスク:
以下の既存候補とは ** 異なるアプローチ・視点 ** で、新しい社会言語を3つ追加生成してください。

【除外リスト — 以下と同じ or 類似の社会言語は生成しないこと】
${excludeList}${directionNote}

生成要件:
- 既存候補と明確に異なる切り口であること
  - 既存の意味や価値をひっくり返すアプローチであること
  - ニュースのテロップやSNSのハッシュタグになり得る「現象名」であること

品質基準:
1. ドヤ感: 使った時に「賢い私」という肯定感が生まれるか
2. 遊びの余白: 「あなたならどう使う？」が内包されているか
3. 脱・妥協: 価値の逆転（リフレーミング）が起きているか
4. メディア親和性: ハッシュタグやテロップとして自然か

以下のJSON形式で出力してください:
[
  {
    "keyword": "【社会言語名】",
    "story": "なぜ今この言葉が必要なのかのロジック",
    "fact": "裏付ける生活者の行動事実"
  },
  ...
]

  ** 3つ ** の新しい社会言語を出力してください。`;
}

/** Phase 3: Evidence Design */
export function buildPhase3Prompt(input: PrismInput, socialLanguages: string, customTemplate?: string): string {
  const template = customTemplate || DEFAULT_PHASE3_TEMPLATE;
  return fillTemplate(template, {
    productName: input.productName,
    category: input.category,
    socialLanguages,
  });
}

/** Phase 4: Output Generation (full — used when custom prompt is set) */
export function buildPhase4Prompt(
  input: PrismInput,
  phase1Summary: string,
  socialLanguages: string,
  surveyDesign: string,
  customTemplate?: string,
): string {
  const template = customTemplate || DEFAULT_PHASE4_TEMPLATE;
  return fillTemplate(template, {
    productName: input.productName,
    category: input.category,
    phase1Summary,
    socialLanguages,
    surveyDesign,
  });
}

/** Phase 4a: Report Summary */
export function buildPhase4aPrompt(
  input: PrismInput,
  phase1Summary: string,
  socialLanguages: string,
  surveyDesign: string,
): string {
  return fillTemplate(DEFAULT_PHASE4A_TEMPLATE, {
    productName: input.productName,
    category: input.category,
    phase1Summary,
    socialLanguages,
    surveyDesign,
  });
}

/** Phase 4b: Press Release */
export function buildPhase4bPrompt(
  input: PrismInput,
  marketRedefinition: string,
  socialLanguages: string,
): string {
  return fillTemplate(DEFAULT_PHASE4B_TEMPLATE, {
    productName: input.productName,
    category: input.category,
    marketRedefinition,
    socialLanguages,
  });
}

/** Phase 4c: Positioning + News Headline */
export function buildPhase4cPrompt(
  input: PrismInput,
  socialLanguages: string,
): string {
  return fillTemplate(DEFAULT_PHASE4C_TEMPLATE, {
    productName: input.productName,
    category: input.category,
    socialLanguages,
  });
}


// ── API Deep Research (Interactions API) Prompts ──

/**
 * Generate the prompt sent to the Gemini Deep Research Agent
 * (via Interactions API). This prompt instructs the agent to do
 * autonomous multi-step research.
 */
export function buildApiDeepResearchPrompt(input: PrismInput): string {
  return `以下の商材について、消費者・生活者のリアルな声を徹底的にリサーチしてください。

【対象商材】${input.productName}
【カテゴリ】${input.category}
【現状の課題・特徴】${input.challenges}

【リサーチ指示】
以下の観点で、できるだけ多くの異なるソースから声を収集してください。** 各カテゴリ最低10個の声を目標 ** に、幅広いソースから徹底的にリサーチしてください:

1. ** ポジティブな声・意外な使い方 **（目標10個以上）: レビューサイト、ブログ、SNS、YouTubeから「${input.productName}」の良い評判、おすすめの声、シンデレラフィット、裏技的な使い方
2. ** ネガティブな声・不満・失敗談 **（目標10個以上）: 「${input.productName}」への不満、がっかり、「使えない」「微妙」「買って後悔」。掲示板（Yahoo知恵袋、5ちゃんねる、価格.com）やSNSの本音
3. ** 妥協・諦めの声 **: 「仕方なく使っている」「値段相応」「他に選択肢がない」という消極的な声（ネガティブに含めてよい）
4. ** 市場の認識 **: 「${input.category}」市場に対する一般的な認識と実態のギャップ

【重要な注意事項】
- 各声について、出典URL（わかる場合）と出典サイト名を明記すること
  - ネガティブな声も同等に重要。ポジティブ偏重にならないこと
    - 実際のユーザーの言葉をできるだけ原文に近い形で引用すること
    - ** 10個に満たない場合は、検索キーワードを変えて追加リサーチすること **
      - 日本語で回答してください`;
}

/**
 * Build Phase 1 prompt that structures API Deep Research results
 * into the PRISM Phase 1 format.
 */
export function buildApiDeepResearchPhase1Prompt(input: PrismInput, template?: string): string {
  const tpl = template || DEFAULT_PHASE1_TEMPLATE;
  return fillTemplate(tpl, {
    productName: input.productName,
    category: input.category,
    challenges: input.challenges,
  });
}
