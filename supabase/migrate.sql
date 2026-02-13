-- ============================================================
-- PRISM — Supabase Migration
-- SAGEプロジェクトと共有。テーブル名に prism_ プレフィックス。
-- Supabase SQLエディタで実行してください。
-- ============================================================

-- 分析実行履歴
CREATE TABLE IF NOT EXISTS prism_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    input JSONB NOT NULL,
    result JSONB NOT NULL
);

-- 新しい順に取得するためのインデックス
CREATE INDEX IF NOT EXISTS idx_prism_history_created_at
    ON prism_history (created_at DESC);

-- カスタムプロンプト設定（全ユーザー共有の1レコード）
CREATE TABLE IF NOT EXISTS prism_custom_prompts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    system_prompt TEXT NOT NULL DEFAULT '',
    phase1_template TEXT NOT NULL DEFAULT '',
    phase2_template TEXT NOT NULL DEFAULT '',
    phase3_template TEXT NOT NULL DEFAULT '',
    phase4_template TEXT NOT NULL DEFAULT ''
);

-- RLSは社内ツールのため無効（デフォルトOFF）
-- 将来認証を追加する場合はここにRLSポリシーを追加
