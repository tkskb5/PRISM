'use client';

import Link from 'next/link';
import { linkBtnStyle } from '@/lib/styles';

const MANUAL_CONTENT = {
    overview: {
        title: '◈ PRISMとは',
        body: `PRISM（Public Resonance & Insight Synthesis Module）は、SNS上の生活者の声から「社会言語」を開発するAI分析ツールです。

商材情報を入力するだけで、以下の4フェーズの分析をGemini AIが自動実行します。`,
    },
    phases: [
        {
            icon: '🎧',
            title: 'Phase 1: Deep Listening & Insight',
            desc: 'SNSやレビューサイトでの生活者の声を分析し、ポジティブ・ハック（意外な使い方）、ネガティブ・ペイン（不満）、市場の再定義を抽出します。',
        },
        {
            icon: '💬',
            title: 'Phase 2: Social Language Development',
            desc: 'Phase 1で得た生の声を「社会言語」に昇華します。ニュースのテロップやSNSのハッシュタグになり得る、共感を生む新しいキーワードを3つ開発します。',
        },
        {
            icon: '📊',
            title: 'Phase 3: Evidence Design',
            desc: '開発した社会言語が「実は社会の正解である」ことを証明するための調査設計（定量3問 + 定性1問）を行います。',
        },
        {
            icon: '📄',
            title: 'Phase 4: Output Generation',
            desc: '調査レポートサマリ、プレスリリース記事、ポジショニング提案、ニュース見出し案の4つのアウトプットを自動生成します。',
        },
    ],
    features: [
        {
            icon: '🚀',
            title: '分析を実行する',
            steps: [
                'ホーム画面で「商材名」「カテゴリ」「課題・特徴」を入力',
                '使用するAIモデルを選択（Flash: 高速＆低コスト / Pro: 高精度）',
                '「◈ PRISM分析を開始する」ボタンをクリック',
                '4フェーズの分析が自動実行され、リアルタイムで進捗（%）が表示されます',
                '各フェーズの完了ごとにパーセンテージが更新され、サーバーからのステータスメッセージが表示されます',
            ],
        },
        {
            icon: '🤖',
            title: 'AIモデルの選択',
            steps: [
                'Gemini 3 Flash（おすすめ）: 約40秒 / 約0.5円 — 通常の分析に最適',
                'Gemini 3 Pro: 約2〜3分 / 約3円 — 深い洞察が必要な案件向け',
            ],
        },
        {
            icon: '📋',
            title: '実行履歴を確認する',
            steps: [
                'ヘッダーの「📋 履歴」をクリック',
                '過去の分析結果が新しい順に一覧表示されます（最大50件）',
                'クリックで展開し、入力情報・分析結果の概要を確認可能',
                '個別削除（✕ボタン）・全件クリア（🗑 すべて削除）が可能',
                '※ 履歴はブラウザのlocalStorageに保存されます。ブラウザのデータを消去すると履歴も消えます',
            ],
        },
        {
            icon: '⚙️',
            title: 'プロンプトを編集する',
            steps: [
                'ヘッダーの「⚙️ 設定」をクリック',
                'システムプロンプトと各フェーズ（Phase 1〜4）のテンプレートを確認・編集可能',
                '{{productName}} 等の変数は分析時に実際の値に自動置換されます。変数名は変更しないでください',
                '各プロンプトごとに「🔄 初期値に戻す」ボタンで元に戻せます',
                '「🔄 すべて初期値に戻す」で全プロンプトを一括リセット可能',
                '編集後は「💾 設定を保存」を押してください',
                '※ カスタマイズ済のプロンプトには黄色い「カスタマイズ済」バッジが表示されます',
            ],
        },
        {
            icon: '📥',
            title: '結果をエクスポートする',
            steps: [
                '分析完了後、結果画面下部の「📋 Markdownをコピー」でレポート全文をコピー',
                '「💾 Markdownファイルとして保存」で .md ファイルとしてダウンロード',
                'レポートサマリとプレスリリースには個別のコピーボタン（テキスト / Markdown）あり',
            ],
        },
    ],
    tips: [
        '「課題・特徴」欄にできるだけ詳しく情報を入力すると、分析の質が大幅に向上します',
        'プロンプト設定で各フェーズの指示を調整することで、出力の方向性をコントロールできます',
        '分析結果が期待と異なる場合は、設定画面で該当フェーズのプロンプトを確認・調整してみてください',
        'Gemini 3 Pro は複雑な分析や深い洞察が必要な場合に有効です。通常は Flash で十分です',
    ],
};

export default function ManualPage() {
    return (
        <div style={{ maxWidth: 800, margin: '0 auto', padding: '48px 24px 80px' }}>
            {/* Header */}
            <div style={{ marginBottom: 40 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                    📖 マニュアル
                </h1>
                <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                    PRISMの使い方ガイド
                </p>
            </div>

            {/* Overview */}
            <section style={sectionStyle}>
                <h2 style={h2Style}>{MANUAL_CONTENT.overview.title}</h2>
                <p style={bodyStyle}>{MANUAL_CONTENT.overview.body}</p>
            </section>

            {/* 4 Phases */}
            <section style={sectionStyle}>
                <h2 style={h2Style}>分析の4フェーズ</h2>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {MANUAL_CONTENT.phases.map((phase, i) => (
                        <div key={i} style={cardStyle}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                                <span style={{ fontSize: 22 }}>{phase.icon}</span>
                                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {phase.title}
                                </h3>
                            </div>
                            <p style={{ ...bodyStyle, margin: 0 }}>{phase.desc}</p>
                        </div>
                    ))}
                </div>
            </section>

            {/* Features */}
            {MANUAL_CONTENT.features.map((feature, i) => (
                <section key={i} style={sectionStyle}>
                    <h2 style={h2Style}>
                        <span style={{ marginRight: 8 }}>{feature.icon}</span>
                        {feature.title}
                    </h2>
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {feature.steps.map((step, j) => (
                            <li key={j} style={{ ...bodyStyle, lineHeight: 1.7 }}>{step}</li>
                        ))}
                    </ol>
                </section>
            ))}

            {/* Tips */}
            <section style={sectionStyle}>
                <h2 style={h2Style}>💡 Tips</h2>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {MANUAL_CONTENT.tips.map((tip, i) => (
                        <li key={i} style={{ ...bodyStyle, lineHeight: 1.7 }}>{tip}</li>
                    ))}
                </ul>
            </section>

            {/* Back */}
            <div style={{ marginTop: 32, textAlign: 'center' }}>
                <Link href="/" style={linkBtnStyle}>← ホームに戻る</Link>
            </div>
        </div>
    );
}

// ── Styles ──
const sectionStyle: React.CSSProperties = {
    marginBottom: 32,
};

const h2Style: React.CSSProperties = {
    fontSize: 18,
    fontWeight: 800,
    color: 'var(--text-primary)',
    marginBottom: 16,
    paddingBottom: 8,
    borderBottom: '1px solid var(--border-subtle)',
};

const bodyStyle: React.CSSProperties = {
    fontSize: 14,
    color: 'var(--text-secondary)',
    lineHeight: 1.8,
};

const cardStyle: React.CSSProperties = {
    padding: '14px 18px',
    borderRadius: 10,
    background: 'var(--glass-bg)',
    border: '1px solid var(--border-subtle)',
};
