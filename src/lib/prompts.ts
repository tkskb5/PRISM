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

// ── Grounding Research Prompt (used with Google Search) ──
export const GROUNDING_RESEARCH_PROMPT = `以下の商材について、SNS・レビューサイト・掲示板・ブログ等での生活者のリアルな声を調査してください。

商材: {{productName}}
カテゴリ: {{category}}
特徴・課題: {{challenges}}

調査すべき内容:
1. ポジティブな声（意外な使い方、シンデレラフィット、攻略の悦び、裏ワザ）
2. ネガティブな声（不満、諦め、妥協、改善要望）
3. 市場や業界に対する生活者の認識・トレンド

できるだけ具体的で生々しい声を、実在のSNS投稿やレビューから引用・参照してください。
出典URL があれば含めてください。日本語で回答してください。`;

export function buildGroundingPrompt(input: PrismInput): string {
  return fillTemplate(GROUNDING_RESEARCH_PROMPT, {
    productName: input.productName,
    category: input.category,
    challenges: input.challenges,
  });
}

export const DEFAULT_PHASE1_TEMPLATE = `【Phase 1: Deep Listening & Insight — 前提の整理】

対象商材: {{productName}}
カテゴリ: {{category}}
現状の課題・特徴: {{challenges}}

あなたのタスク:
「{{category}}」について、SNSやレビューサイトでの生活者の声を深く聴取し、以下を抽出してください。

1. **ポジティブ・ハック（Positive/Hack）**: メーカーの意図を超えた使い方、シンデレラフィット、攻略の悦び。生活者の生々しい一人称の言葉で10個。
2. **ネガティブ・ペイン（Negative/Pain）**: 諦め、虚無感、仕方なく使っている感覚。生活者の生々しい一人称の言葉で10個。
3. **市場の再定義（Market Redefinition）**: 「現在の市場は『〇〇』という認識だが、実態は『△△』で動いている」という最短の定義文。

**重要**: 各声には、その情報の出典となったWebページのURLとサイト名を含めてください。参考データに含まれるURLを活用してください。

以下のJSON形式で出力してください:
{
  "positiveHacks": [{"text": "声1", "sourceUrl": "https://example.com/...", "sourceTitle": "サイト名"}, ...],
  "negativePains": [{"text": "声1", "sourceUrl": "https://example.com/...", "sourceTitle": "サイト名"}, ...],
  "marketRedefinition": "定義文"
}`;

export const DEFAULT_PHASE2_TEMPLATE = `【Phase 2: Social Language Development — 社会言語開発】

対象商材: {{productName}}
カテゴリ: {{category}}
Deep Listeningの結果:
{{phase1Summary}}

あなたのタスク:
Deep Listeningで得た「生の声」を、一般名詞化された「社会言語」へと昇華させてください。

生成要件:
- 既存の意味や価値をひっくり返すアプローチであること
- ニュースのテロップやSNSのハッシュタグになり得る「現象名」であること
- 3つの社会言語を開発し、それぞれにストーリーとファクトをセットで出力

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

3つの社会言語を出力してください。`;

export const DEFAULT_PHASE3_TEMPLATE = `【Phase 3: Evidence Design — イシューデザイン調査設計】

対象商材: {{productName}}
カテゴリ: {{category}}
開発した社会言語:
{{socialLanguages}}

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
}`;

export const DEFAULT_PHASE4_TEMPLATE = `【Phase 4: Output Generation — アウトプット生成】

対象商材: {{productName}}
カテゴリ: {{category}}

Phase 1（Deep Listening）結果:
{{phase1Summary}}

Phase 2（社会言語）:
{{socialLanguages}}

Phase 3（調査設計）:
{{surveyDesign}}

あなたのタスク:
以下の3つのアウトプットを生成してください。

1. **調査レポートサマリ** (2〜3ページ分のテキスト): Phase 3の調査結果を想定して記述。データは仮想だが説得力のある数字を使用。
2. **プレスリリース記事**: 市場の再定義ニュースとして記事化。「消費者は〇〇を求めているのではない。△△を求めているのだ」のような切り口で。
3. **ポジショニング提案（結論）**: クライアントへの最終提言。「御社は今後、〇〇ではなく『△△』と名乗るべきである」形式。
4. **ニュース見出し案**: Yahoo!トピックス風の見出し（1行）

以下のJSON形式で出力してください:
{
  "reportSummary": "レポートサマリ（Markdown形式）",
  "pressRelease": "プレスリリース記事（Markdown形式）",
  "positioning": "ポジショニング提案文",
  "newsHeadline": "ニュース見出し（1行）"
}`;

// ── Phase 4 Sub-templates (for split execution) ──

export const DEFAULT_PHASE4A_TEMPLATE = `【Phase 4a: 調査レポートサマリ生成】

対象商材: {{productName}}
カテゴリ: {{category}}

Phase 1（Deep Listening）結果:
{{phase1Summary}}

Phase 2（社会言語）:
{{socialLanguages}}

Phase 3（調査設計）:
{{surveyDesign}}

あなたのタスク:
調査レポートサマリ（2〜3ページ分のテキスト）を生成してください。
Phase 3の調査結果を想定して記述。データは仮想だが説得力のある数字を使用。

以下のJSON形式で出力してください:
{
  "reportSummary": "レポートサマリ（Markdown形式）"
}`;

export const DEFAULT_PHASE4B_TEMPLATE = `【Phase 4b: プレスリリース記事生成】

対象商材: {{productName}}
カテゴリ: {{category}}

市場の再定義:
{{marketRedefinition}}

社会言語:
{{socialLanguages}}

あなたのタスク:
プレスリリース記事を生成してください。
市場の再定義ニュースとして記事化。「消費者は〇〇を求めているのではない。△△を求めているのだ」のような切り口で。

以下のJSON形式で出力してください:
{
  "pressRelease": "プレスリリース記事（Markdown形式）"
}`;

export const DEFAULT_PHASE4C_TEMPLATE = `【Phase 4c: ポジショニング提案 & ニュース見出し】

対象商材: {{productName}}
カテゴリ: {{category}}

社会言語:
{{socialLanguages}}

あなたのタスク:
以下の2つのアウトプットを生成してください。

1. **ポジショニング提案（結論）**: クライアントへの最終提言。「御社は今後、〇〇ではなく『△△』と名乗るべきである」形式。
2. **ニュース見出し案**: Yahoo!トピックス風の見出し（1行）

以下のJSON形式で出力してください:
{
  "positioning": "ポジショニング提案文",
  "newsHeadline": "ニュース見出し（1行）"
}`;

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
    (t, [key, value]) => t.replaceAll(`{{${key}}}`, value),
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
