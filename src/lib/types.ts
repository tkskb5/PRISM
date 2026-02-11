// ============================================================
// PRISM — Type Definitions
// ============================================================

/** コンサルタントからの入力 */
export interface PrismInput {
  productName: string;
  category: string;
  challenges: string;
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
