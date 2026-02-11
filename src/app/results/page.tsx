'use client';

import { useState, useEffect, useCallback } from 'react';
import type {
    PrismInput,
    PrismResult,
    AnalysisPhase,
} from '@/lib/types';
import { generateMarkdownReport } from '@/lib/export';

const PHASES = [
    { key: 'phase1' as const, label: 'Deep Listening', desc: '生の声を聴取中...' },
    { key: 'phase2' as const, label: 'Social Language', desc: '社会言語を開発中...' },
    { key: 'phase3' as const, label: 'Evidence Design', desc: '調査を設計中...' },
    { key: 'phase4' as const, label: 'Output', desc: 'レポートを生成中...' },
];

const TABS = [
    { key: 'listening', label: '🎧 Deep Listening' },
    { key: 'language', label: '◈ 社会言語' },
    { key: 'survey', label: '📊 調査設計' },
    { key: 'output', label: '📄 アウトプット' },
];

export default function ResultsPage() {
    const [input, setInput] = useState<PrismInput | null>(null);
    const [phase, setPhase] = useState<AnalysisPhase>('idle');
    const [result, setResult] = useState<PrismResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState('listening');
    const [copied, setCopied] = useState(false);

    const runAnalysis = useCallback(async (inputData: PrismInput) => {
        setPhase('phase1');

        // Simulate phase progression every ~8s (actual API does all at once)
        const phaseTimer = setInterval(() => {
            setPhase((prev) => {
                if (prev === 'phase1') return 'phase2';
                if (prev === 'phase2') return 'phase3';
                if (prev === 'phase3') return 'phase4';
                return prev;
            });
        }, 8000);

        try {
            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(inputData),
            });

            clearInterval(phaseTimer);

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Analysis failed');
            }

            const data: PrismResult = await res.json();
            setResult(data);
            setPhase('complete');
        } catch (err) {
            clearInterval(phaseTimer);
            setError(err instanceof Error ? err.message : 'Unknown error');
            setPhase('error');
        }
    }, []);

    useEffect(() => {
        const stored = sessionStorage.getItem('prism-input');
        if (stored) {
            const parsed = JSON.parse(stored) as PrismInput;
            setInput(parsed);
            sessionStorage.removeItem('prism-input');
            runAnalysis(parsed);
        }
    }, [runAnalysis]);

    function handleCopyMarkdown() {
        if (!result) return;
        const md = generateMarkdownReport(result);
        navigator.clipboard.writeText(md);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    }

    function handleDownloadMarkdown() {
        if (!result) return;
        const md = generateMarkdownReport(result);
        const blob = new Blob([md], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `PRISM_${result.input.productName}_${new Date().toISOString().slice(0, 10)}.md`;
        a.click();
        URL.revokeObjectURL(url);
    }

    // ── No input ──
    if (!input && phase === 'idle') {
        return (
            <div style={{ maxWidth: 720, margin: '0 auto', padding: '120px 24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-secondary)' }}>
                    入力データがありません。<br />
                    <a href="/" style={{ color: 'var(--spectrum-violet)' }}>トップページ</a>から入力してください。
                </p>
            </div>
        );
    }

    // ── Phase index helper ──
    const currentPhaseIndex = PHASES.findIndex((p) => p.key === phase);

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '40px 24px 120px' }}>

            {/* Input Summary */}
            {input && (
                <div className="glass-card" style={{ padding: '20px 28px', marginBottom: 32 }}>
                    <div style={{ display: 'flex', gap: 32, fontSize: 14 }}>
                        <div>
                            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>商材:</span>
                            <span style={{ fontWeight: 600 }}>{input.productName}</span>
                        </div>
                        <div>
                            <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>カテゴリ:</span>
                            <span style={{ fontWeight: 600 }}>{input.category}</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Progress Bar */}
            {phase !== 'complete' && phase !== 'error' && phase !== 'idle' && (
                <div style={{ marginBottom: 48 }}>
                    <div className="progress-track">
                        {PHASES.map((p, i) => {
                            let status = '';
                            if (i < currentPhaseIndex) status = 'completed';
                            else if (i === currentPhaseIndex) status = 'active';

                            return (
                                <div key={p.key} className={`progress-step ${status}`}>
                                    <div className="progress-dot">
                                        {status === 'completed' ? '✓' : i + 1}
                                    </div>
                                    <div className="progress-label">{p.label}</div>
                                    {i < PHASES.length - 1 && <div className="progress-line" />}
                                </div>
                            );
                        })}
                    </div>

                    {/* Current phase description */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: 32,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                    }}>
                        <div className="prism-loader" />
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                            {currentPhaseIndex >= 0 ? PHASES[currentPhaseIndex].desc : '分析準備中...'}
                        </p>
                    </div>
                </div>
            )}

            {/* Error State */}
            {phase === 'error' && (
                <div className="glass-card" style={{
                    padding: 32,
                    textAlign: 'center',
                    borderColor: 'rgba(255, 51, 102, 0.3)',
                }}>
                    <div style={{ fontSize: 32, marginBottom: 16 }}>⚠️</div>
                    <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12 }}>分析エラー</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: 14, marginBottom: 24 }}>
                        {error}
                    </p>
                    <a href="/" className="btn-prism" style={{ textDecoration: 'none' }}>
                        トップに戻る
                    </a>
                </div>
            )}

            {/* Results */}
            {phase === 'complete' && result && (
                <>
                    {/* Success Header */}
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <h2 className="prism-text" style={{
                            fontSize: 28,
                            fontWeight: 800,
                            marginBottom: 8,
                        }}>
                            解析完了
                        </h2>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                            {result.input.productName}（{result.input.category}）の社会言語を開発しました
                        </p>
                    </div>

                    {/* Export Buttons */}
                    <div style={{ display: 'flex', gap: 12, marginBottom: 24, justifyContent: 'flex-end' }}>
                        <button
                            id="btn-copy-md"
                            className="copy-btn"
                            onClick={handleCopyMarkdown}
                        >
                            {copied ? '✓ コピー済み' : '📋 Markdownコピー'}
                        </button>
                        <button
                            id="btn-download-md"
                            className="copy-btn"
                            onClick={handleDownloadMarkdown}
                        >
                            ⬇ ダウンロード
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="tab-group" style={{ marginBottom: 32 }}>
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Tab Content */}
                    <div className="glass-card" style={{ padding: 36, minHeight: 400 }}>

                        {/* Tab: Deep Listening */}
                        {activeTab === 'listening' && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--spectrum-cyan)' }}>●</span>
                                    Positive / Hack — 攻略の悦び
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
                                    {result.phase1.positiveHacks.map((voice, i) => (
                                        <div key={i} className="voice-item positive">
                                            <span style={{ color: 'var(--spectrum-cyan)', flexShrink: 0 }}>❝</span>
                                            <span>{voice}</span>
                                        </div>
                                    ))}
                                </div>

                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--spectrum-red)' }}>●</span>
                                    Negative / Pain — 微細な不快
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
                                    {result.phase1.negativePains.map((voice, i) => (
                                        <div key={i} className="voice-item negative">
                                            <span style={{ color: 'var(--spectrum-red)', flexShrink: 0 }}>❝</span>
                                            <span>{voice}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="spectrum-card" style={{ padding: 28 }}>
                                    <h3 style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--spectrum-yellow)',
                                        marginBottom: 12,
                                        letterSpacing: '0.05em',
                                    }}>
                                        ▸ 市場の再定義
                                    </h3>
                                    <p style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        lineHeight: 1.8,
                                        color: 'var(--text-primary)',
                                    }}>
                                        {result.phase1.marketRedefinition}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Tab: Social Language */}
                        {activeTab === 'language' && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 28 }}>
                                    3つの社会言語
                                </h3>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                                    {result.phase2.map((sl, i) => (
                                        <div key={i} className="sl-card">
                                            <div className="sl-keyword">{sl.keyword}</div>
                                            <div className="sl-section-title">販促ストーリー</div>
                                            <div className="sl-section-body">{sl.story}</div>
                                            <div className="sl-section-title">根拠・ファクト</div>
                                            <div className="sl-section-body">{sl.fact}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Tab: Survey Design */}
                        {activeTab === 'survey' && (
                            <div>
                                <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 28, display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span style={{ color: 'var(--spectrum-green)' }}>◆</span>
                                    イシューデザイン調査
                                </h3>

                                <div style={{ marginBottom: 36 }}>
                                    <h4 style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--spectrum-cyan)',
                                        marginBottom: 16,
                                    }}>
                                        定量設問（3問）
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {result.phase3.quantitative.map((q, i) => (
                                            <div key={i} className="glass-card" style={{
                                                padding: '16px 20px',
                                                display: 'flex',
                                                gap: 14,
                                                alignItems: 'flex-start',
                                            }}>
                                                <span style={{
                                                    fontWeight: 800,
                                                    color: 'var(--spectrum-cyan)',
                                                    fontSize: 18,
                                                    lineHeight: 1.5,
                                                    flexShrink: 0,
                                                }}>
                                                    Q{i + 1}
                                                </span>
                                                <span style={{ fontSize: 14, lineHeight: 1.8 }}>{q}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <h4 style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--spectrum-violet)',
                                        marginBottom: 16,
                                    }}>
                                        定性設問（1問）
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                        {result.phase3.qualitative.map((q, i) => (
                                            <div key={i} className="spectrum-card" style={{
                                                padding: '20px 24px',
                                            }}>
                                                <span style={{ fontSize: 14, lineHeight: 1.8 }}>{q}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Output */}
                        {activeTab === 'output' && (
                            <div>
                                {/* Positioning */}
                                <div className="spectrum-card" style={{ padding: 28, marginBottom: 32 }}>
                                    <h3 style={{
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: 'var(--spectrum-yellow)',
                                        marginBottom: 12,
                                        letterSpacing: '0.05em',
                                    }}>
                                        ▸ ポジショニング提案
                                    </h3>
                                    <p style={{
                                        fontSize: 16,
                                        fontWeight: 600,
                                        lineHeight: 1.8,
                                        color: 'var(--text-primary)',
                                        marginBottom: 20,
                                    }}>
                                        {result.phase4.positioning}
                                    </p>
                                    <div style={{
                                        padding: '12px 20px',
                                        background: 'rgba(255, 204, 51, 0.08)',
                                        borderRadius: 'var(--radius-sm)',
                                        border: '1px solid rgba(255, 204, 51, 0.15)',
                                        fontSize: 14,
                                        fontWeight: 600,
                                    }}>
                                        📰 {result.phase4.newsHeadline}
                                    </div>
                                </div>

                                {/* Report Summary */}
                                <div style={{ marginBottom: 32 }}>
                                    <h3 style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        marginBottom: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}>
                                        <span style={{ color: 'var(--spectrum-cyan)' }}>◇</span>
                                        調査レポートサマリ
                                    </h3>
                                    <div className="md-content" style={{
                                        padding: '24px',
                                        background: 'rgba(10, 10, 30, 0.5)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 14,
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {result.phase4.reportSummary}
                                    </div>
                                </div>

                                {/* Press Release */}
                                <div>
                                    <h3 style={{
                                        fontSize: 16,
                                        fontWeight: 700,
                                        marginBottom: 16,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 8,
                                    }}>
                                        <span style={{ color: 'var(--spectrum-violet)' }}>◇</span>
                                        プレスリリース記事
                                    </h3>
                                    <div className="md-content" style={{
                                        padding: '24px',
                                        background: 'rgba(10, 10, 30, 0.5)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 14,
                                        whiteSpace: 'pre-wrap',
                                    }}>
                                        {result.phase4.pressRelease}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Back to Top */}
                    <div style={{ textAlign: 'center', marginTop: 48 }}>
                        <a href="/" style={{
                            color: 'var(--text-muted)',
                            fontSize: 14,
                            textDecoration: 'none',
                            transition: 'color 0.2s',
                        }}>
                            ← 新しい解析を開始する
                        </a>
                    </div>
                </>
            )}
        </div>
    );
}
