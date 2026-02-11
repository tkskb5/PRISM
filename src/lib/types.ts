// ============================================================
// PRISM — Type Definitions
// ============================================================

/** 利用可能なGeminiモデル */
export type GeminiModel = 'gemini-3-flash-preview' | 'gemini-3-pro-preview';

/** コンサルタントからの入力 */
export interface PrismInput {
    productName: string;
    category: string;
    challenges: string;
    model?: GeminiModel;
}

/** Phase 1: Deep Listening の結果 */
export interface DeepListeningResult {
    positiveHacks: string[];
    negativePains: string[];
    marketRedefinition: string;
}

/** Phase 2: 社会言語1件 */
export interface SocialLanguage {
    keyword: string;
    story: string;
    fact: string;
}

/** Phase 3: 調査設計 */
export interface SurveyDesign {
    quantitative: string[];
    qualitative: string[];
}

/** Phase 4: 最終アウトプット */
export interface OutputGeneration {
    reportSummary: string;
    pressRelease: string;
    positioning: string;
    newsHeadline: string;
}

/** 全フェーズ統合結果 */
export interface PrismResult {
    input: PrismInput;
    phase1: DeepListeningResult;
    phase2: SocialLanguage[];
    phase3: SurveyDesign;
    phase4: OutputGeneration;
}

/** 分析ステータス */
export type AnalysisPhase =
    | 'idle'
    | 'phase1'
    | 'phase2'
    | 'phase3'
    | 'phase4'
    | 'complete'
    | 'error';

/** 実行履歴エントリ */
export interface HistoryEntry {
    id: string;
    timestamp: string;
    input: PrismInput;
    result: PrismResult;
}

/** カスタムプロンプト設定 */
export interface CustomPrompts {
    systemPrompt: string;
    phase1Template: string;
    phase2Template: string;
    phase3Template: string;
    phase4Template: string;
}
