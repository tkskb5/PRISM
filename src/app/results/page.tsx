'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type {
    PrismInput,
    PrismResult,
    AnalysisPhase,
    DeepListeningResult,
    SocialLanguage,
    SurveyDesign,
    GroundingSource,
    VoiceItem,
} from '@/lib/types';

/** Backward compat: handle both string (legacy) and VoiceItem */
function toVoiceItem(v: string | VoiceItem): VoiceItem {
    return typeof v === 'string' ? { text: v } : v;
}
import { generateMarkdownReport } from '@/lib/export';
import { saveHistory, getCustomPrompts } from '@/lib/storage';

// ── HTML sanitization ──
function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// ── Simple Markdown → HTML converter (with XSS protection) ──
function markdownToHtml(md: string): string {
    // Escape HTML entities first to prevent XSS, then apply markdown formatting
    const escaped = escapeHtml(md);
    return escaped
        // Headings
        .replace(/^### (.+)$/gm, '<h4 style="font-size:14px;font-weight:700;margin:20px 0 8px;color:var(--text-primary)">$1</h4>')
        .replace(/^## (.+)$/gm, '<h3 style="font-size:16px;font-weight:700;margin:24px 0 10px;color:var(--text-primary)">$1</h3>')
        .replace(/^# (.+)$/gm, '<h2 style="font-size:18px;font-weight:800;margin:28px 0 12px;color:var(--text-primary)">$1</h2>')
        // Bold + Italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong style="color:var(--text-primary)">$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Unordered lists
        .replace(/^[\-\*] (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:disc">$1</li>')
        // Ordered lists
        .replace(/^\d+\. (.+)$/gm, '<li style="margin:4px 0;margin-left:20px;list-style:decimal">$1</li>')
        // Horizontal rule
        .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid var(--border-subtle);margin:20px 0">')
        // Line breaks (double newline → paragraph break)
        .replace(/\n\n/g, '<br><br>')
        // Single newline → <br>
        .replace(/\n/g, '<br>');
}

// ── Markdown Section with copy buttons ──
function MarkdownSection({ title, markdown, icon, iconColor }: {
    title: string;
    markdown: string;
    icon: string;
    iconColor: string;
}) {
    const [copiedPlain, setCopiedPlain] = useState(false);
    const [copiedMd, setCopiedMd] = useState(false);

    const html = useMemo(() => markdownToHtml(markdown), [markdown]);

    // Strip markdown formatting for plain text copy
    const plainText = useMemo(() => {
        return markdown
            .replace(/^#{1,3} /gm, '')
            .replace(/\*\*\*(.+?)\*\*\*/g, '$1')
            .replace(/\*\*(.+?)\*\*/g, '$1')
            .replace(/\*(.+?)\*/g, '$1')
            .replace(/^[\-\*] /gm, '・')
            .replace(/^---$/gm, '────────')
            .trim();
    }, [markdown]);

    function handleCopyPlain() {
        navigator.clipboard.writeText(plainText);
        setCopiedPlain(true);
        setTimeout(() => setCopiedPlain(false), 2000);
    }

    function handleCopyMd() {
        navigator.clipboard.writeText(markdown);
        setCopiedMd(true);
        setTimeout(() => setCopiedMd(false), 2000);
    }

    return (
        <div style={{ marginBottom: 32 }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
            }}>
                <h3 style={{
                    fontSize: 16,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    margin: 0,
                }}>
                    <span style={{ color: iconColor }}>{icon}</span>
                    {title}
                </h3>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="copy-btn"
                        onClick={handleCopyPlain}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                        {copiedPlain ? '✓ コピー済み' : '📋 テキスト'}
                    </button>
                    <button
                        className="copy-btn"
                        onClick={handleCopyMd}
                        style={{ fontSize: 12, padding: '6px 12px' }}
                    >
                        {copiedMd ? '✓ コピー済み' : '◇ Markdown'}
                    </button>
                </div>
            </div>
            <div
                className="md-content md-rendered"
                style={{
                    padding: '24px',
                    background: 'rgba(10, 10, 30, 0.5)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: 14,
                    lineHeight: 1.8,
                    color: 'var(--text-secondary)',
                }}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
}

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
    const [percent, setPercent] = useState(0);
    const [progressMsg, setProgressMsg] = useState('');

    // Progressive phase results — populated as each phase completes
    const [partialPhase1, setPartialPhase1] = useState<DeepListeningResult | null>(null);
    const [partialPhase2, setPartialPhase2] = useState<SocialLanguage[] | null>(null);
    const [partialPhase3, setPartialPhase3] = useState<SurveyDesign | null>(null);
    const [partialGroundingSources, setPartialGroundingSources] = useState<GroundingSource[]>([]);

    const runAnalysis = useCallback(async (inputData: PrismInput) => {
        setPhase('phase1');
        setPercent(0);
        setProgressMsg('分析を開始しています...');

        try {
            const customPrompts = getCustomPrompts();

            const res = await fetch('/api/analyze', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ input: inputData, customPrompts }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Analysis failed');
            }

            const reader = res.body?.getReader();
            if (!reader) throw new Error('ストリーミングに対応していません');

            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.startsWith('data: ')) continue;
                    try {
                        const event = JSON.parse(line.slice(6));

                        if (event.type === 'progress') {
                            setPercent(event.percent);
                            setProgressMsg(event.message);
                            // Update phase based on phase number
                            const phaseMap: Record<number, AnalysisPhase> = {
                                1: 'phase1', 2: 'phase2', 3: 'phase3', 4: 'phase4',
                            };
                            if (phaseMap[event.phase]) setPhase(phaseMap[event.phase]);
                        } else if (event.type === 'phase_result') {
                            // Progressive display — store partial results
                            if (event.phase === 1) {
                                setPartialPhase1(event.data as DeepListeningResult);
                                setPartialGroundingSources(event.groundingSources || []);
                            } else if (event.phase === 2) {
                                setPartialPhase2(event.data as SocialLanguage[]);
                            } else if (event.phase === 3) {
                                setPartialPhase3(event.data as SurveyDesign);
                            }
                        } else if (event.type === 'result') {
                            const data: PrismResult = event.data;
                            setResult(data);
                            setPhase('complete');
                            setPercent(100);
                            saveHistory(inputData, data);
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        }
                    } catch (parseErr) {
                        // Skip malformed SSE lines
                        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                            throw parseErr;
                        }
                    }
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Unknown error');
            setPhase('error');
        }
    }, []);

    useEffect(() => {
        const stored = sessionStorage.getItem('prism-input');
        if (stored) {
            try {
                const parsed = JSON.parse(stored) as PrismInput;
                setInput(parsed);
                sessionStorage.removeItem('prism-input');
                runAnalysis(parsed);
            } catch {
                sessionStorage.removeItem('prism-input');
                setError('入力データの読み込みに失敗しました。もう一度やり直してください。');
                setPhase('error');
            }
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

                    {/* Spinner + Percentage + bar + message */}
                    <div style={{
                        textAlign: 'center',
                        marginTop: 32,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: 16,
                    }}>
                        {/* Spinner + Percentage number */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                            <div className="prism-loader" />
                            <div style={{
                                fontSize: 48,
                                fontWeight: 800,
                                fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                background: 'linear-gradient(135deg, var(--spectrum-cyan), var(--spectrum-violet))',
                                WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent',
                                letterSpacing: '-0.02em',
                            }}>
                                {percent}%
                            </div>
                        </div>

                        {/* Progress bar */}
                        <div style={{
                            width: '100%',
                            maxWidth: 400,
                            height: 6,
                            borderRadius: 3,
                            background: 'rgba(255,255,255,0.06)',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                width: `${percent}%`,
                                height: '100%',
                                borderRadius: 3,
                                background: 'linear-gradient(90deg, var(--spectrum-cyan), var(--spectrum-violet))',
                                transition: 'width 0.6s ease-out',
                            }} />
                        </div>

                        {/* Status message from server */}
                        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
                            {progressMsg || (currentPhaseIndex >= 0 ? PHASES[currentPhaseIndex].desc : '分析準備中...')}
                        </p>
                    </div>

                    {/* Progressive Phase Results — show completed phases during analysis */}
                    {(partialPhase1 || partialPhase2 || partialPhase3) && (
                        <div style={{ marginTop: 32 }}>
                            <h3 style={{
                                fontSize: 14,
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                marginBottom: 12,
                                textAlign: 'center',
                            }}>
                                完了したフェーズの結果
                            </h3>

                            {/* Phase 1 partial */}
                            {partialPhase1 && (
                                <div className="glass-card" style={{ padding: 28, marginBottom: 12 }}>
                                    <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--spectrum-green)' }}>✓</span> 🎧 Phase 1: Deep Listening
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--spectrum-cyan)', marginBottom: 4 }}>Positive / Hack</p>
                                        {partialPhase1.positiveHacks.map((v, i) => {
                                            const item = toVoiceItem(v);
                                            return (
                                                <div key={i} className="voice-item positive" style={{ padding: '10px 14px', fontSize: 13 }}>
                                                    <span style={{ color: 'var(--spectrum-cyan)', flexShrink: 0 }}>❝</span>
                                                    <div>
                                                        <span>{item.text}</span>
                                                        {item.sourceUrl && (
                                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-cyan)', textDecoration: 'none', marginTop: 4, opacity: 0.8 }}>
                                                                ↗ {item.sourceTitle || item.sourceUrl}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--spectrum-red)', marginBottom: 4 }}>Negative / Pain</p>
                                        {partialPhase1.negativePains.map((v, i) => {
                                            const item = toVoiceItem(v);
                                            return (
                                                <div key={i} className="voice-item negative" style={{ padding: '10px 14px', fontSize: 13 }}>
                                                    <span style={{ color: 'var(--spectrum-red)', flexShrink: 0 }}>❝</span>
                                                    <div>
                                                        <span>{item.text}</span>
                                                        {item.sourceUrl && (
                                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-red)', textDecoration: 'none', marginTop: 4, opacity: 0.8 }}>
                                                                ↗ {item.sourceTitle || item.sourceUrl}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div style={{ padding: '12px 16px', borderRadius: 8, background: 'rgba(255,204,51,0.05)', border: '1px solid rgba(255,204,51,0.15)' }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--spectrum-yellow)', marginBottom: 6 }}>▸ 市場の再定義</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.8, color: 'var(--text-primary)', margin: 0 }}>
                                            {partialPhase1.marketRedefinition}
                                        </p>
                                    </div>
                                    {partialGroundingSources.length > 0 && (
                                        <div style={{ marginTop: 12 }}>
                                            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>
                                                🔗 ソース（{partialGroundingSources.length}件）
                                            </p>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                {partialGroundingSources.map((src, i) => (
                                                    <a key={i} href={src.url} target="_blank" rel="noopener noreferrer"
                                                        style={{ fontSize: 11, color: 'var(--spectrum-cyan)', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                        ↗ {src.title}
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Phase 2 partial */}
                            {partialPhase2 && (
                                <div className="glass-card" style={{ padding: 28, marginBottom: 12 }}>
                                    <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--spectrum-green)' }}>✓</span> ◈ Phase 2: 社会言語
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                        {partialPhase2.map((sl, i) => (
                                            <div key={i} className="sl-card">
                                                <div className="sl-keyword">{sl.keyword}</div>
                                                <div className="sl-section-title">STORY</div>
                                                <div className="sl-section-body">{sl.story}</div>
                                                <div className="sl-section-title">FACT</div>
                                                <div className="sl-section-body">{sl.fact}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Phase 3 partial */}
                            {partialPhase3 && (
                                <div className="glass-card" style={{ padding: 28, marginBottom: 12 }}>
                                    <h4 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--spectrum-green)' }}>✓</span> 📊 Phase 3: 調査設計
                                    </h4>
                                    <div style={{ marginBottom: 16 }}>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>定量設問</p>
                                        <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            {partialPhase3.quantitative.map((q, i) => <li key={i}>{q}</li>)}
                                        </ol>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 8 }}>定性設問</p>
                                        <ol style={{ paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            {partialPhase3.qualitative.map((q, i) => <li key={i}>{q}</li>)}
                                        </ol>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
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
            )
            }

            {/* Results */}
            {
                phase === 'complete' && result && (
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
                                        {result.phase1.positiveHacks.map((voice, i) => {
                                            const item = toVoiceItem(voice);
                                            return (
                                                <div key={i} className="voice-item positive">
                                                    <span style={{ color: 'var(--spectrum-cyan)', flexShrink: 0 }}>❝</span>
                                                    <div style={{ flex: 1 }}>
                                                        <span>{item.text}</span>
                                                        {item.sourceUrl && (
                                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-cyan)', textDecoration: 'none', marginTop: 4, opacity: 0.8 }}>
                                                                ↗ {item.sourceTitle || item.sourceUrl}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <span style={{ color: 'var(--spectrum-red)' }}>●</span>
                                        Negative / Pain — 微細な不快
                                    </h3>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 36 }}>
                                        {result.phase1.negativePains.map((voice, i) => {
                                            const item = toVoiceItem(voice);
                                            return (
                                                <div key={i} className="voice-item negative">
                                                    <span style={{ color: 'var(--spectrum-red)', flexShrink: 0 }}>❝</span>
                                                    <div style={{ flex: 1 }}>
                                                        <span>{item.text}</span>
                                                        {item.sourceUrl && (
                                                            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-red)', textDecoration: 'none', marginTop: 4, opacity: 0.8 }}>
                                                                ↗ {item.sourceTitle || item.sourceUrl}
                                                            </a>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
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

                                    {/* Grounding Sources */}
                                    {result.groundingSources && result.groundingSources.length > 0 && (
                                        <div style={{ marginTop: 28 }}>
                                            <h3 style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: 'var(--text-muted)',
                                                marginBottom: 12,
                                                letterSpacing: '0.05em',
                                            }}>
                                                🔗 Google検索ソース（{result.groundingSources.length}件）
                                            </h3>
                                            <div style={{
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: 6,
                                                padding: '14px 18px',
                                                borderRadius: 10,
                                                background: 'rgba(255,255,255,0.03)',
                                                border: '1px solid var(--border-subtle)',
                                            }}>
                                                {result.groundingSources.map((source, i) => (
                                                    <a
                                                        key={i}
                                                        href={source.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            fontSize: 13,
                                                            color: 'var(--spectrum-cyan)',
                                                            textDecoration: 'none',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 6,
                                                            padding: '4px 0',
                                                            transition: 'opacity 0.2s',
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
                                                        onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
                                                    >
                                                        <span style={{ flexShrink: 0 }}>↗</span>
                                                        <span style={{
                                                            overflow: 'hidden',
                                                            textOverflow: 'ellipsis',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {source.title}
                                                        </span>
                                                    </a>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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
                                    <MarkdownSection
                                        title="調査レポートサマリ"
                                        markdown={result.phase4.reportSummary}
                                        icon="◇"
                                        iconColor="var(--spectrum-cyan)"
                                    />

                                    {/* Press Release */}
                                    <MarkdownSection
                                        title="プレスリリース記事"
                                        markdown={result.phase4.pressRelease}
                                        icon="◇"
                                        iconColor="var(--spectrum-violet)"
                                    />
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
                )
            }
        </div >
    );
}
