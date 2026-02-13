'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type {
    PrismInput,
    PrismResult,
    AnalysisPhase,
    DeepListeningResult,
    SocialLanguage,
    SurveyDesign,
    OutputGeneration,
    GroundingSource,
    VoiceItem,
    IterationEntry,
} from '@/lib/types';
import { toVoiceItem } from '@/lib/types';
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

/** Debug log entry received via SSE */
interface DebugLogEntry {
    timestamp: string;
    label: string;
    content: unknown;
}

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
    const [progressTab, setProgressTab] = useState<'listening' | 'language' | 'survey'>('listening');

    // Debug log state
    const [debugLogs, setDebugLogs] = useState<DebugLogEntry[]>([]);
    const [debugExpanded, setDebugExpanded] = useState(false);
    const [logCopied, setLogCopied] = useState(false);
    const debugPanelRef = useRef<HTMLDivElement>(null);

    // Social Language iteration state
    const [allCandidates, setAllCandidates] = useState<SocialLanguage[]>([]);
    const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set());
    const [isRegenerating, setIsRegenerating] = useState(false);
    const [regeneratePercent, setRegeneratePercent] = useState(0);
    const [regenerateMsg, setRegenerateMsg] = useState('');
    const [iterationHistory, setIterationHistory] = useState<IterationEntry[]>([]);
    const [directionNote, setDirectionNote] = useState('');
    const [showDirectionInput, setShowDirectionInput] = useState(false);
    const [isAddingLanguages, setIsAddingLanguages] = useState(false);
    const [phase1Summary, setPhase1Summary] = useState('');

    const runAnalysis = useCallback(async (inputData: PrismInput) => {
        setPhase('phase1');
        setPercent(0);
        setProgressMsg('分析を開始しています...');
        setDebugLogs([]);

        try {
            const customPrompts = await getCustomPrompts();

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
                                setProgressTab('listening');
                                // Store phase1 summary for later regeneration
                                const p1 = event.data as DeepListeningResult;
                                const summary = `Positive Hacks:\n${p1.positiveHacks.map(h => typeof h === 'string' ? h : h.text).join('\n')}\n\nNegative Pains:\n${p1.negativePains.map(p => typeof p === 'string' ? p : p.text).join('\n')}\n\n市場再定義: ${p1.marketRedefinition}`;
                                setPhase1Summary(summary);
                            } else if (event.phase === 2) {
                                setPartialPhase2(event.data as SocialLanguage[]);
                                if (event.allCandidates) {
                                    setAllCandidates(event.allCandidates as SocialLanguage[]);
                                    // Auto-select first 3
                                    setSelectedIndices(new Set([0, 1, 2]));
                                }
                                setProgressTab('language');
                            } else if (event.phase === 3) {
                                setPartialPhase3(event.data as SurveyDesign);
                                setProgressTab('survey');
                            }
                        } else if (event.type === 'result') {
                            const data: PrismResult = event.data;
                            // Also populate allCandidates from result
                            if (data.allSocialLanguages && data.allSocialLanguages.length > 0) {
                                setAllCandidates(data.allSocialLanguages);
                                setSelectedIndices(new Set([0, 1, 2]));
                            }
                            if (data.iterationHistory) {
                                setIterationHistory(data.iterationHistory);
                            }
                            setResult(data);
                            setPhase('complete');
                            setPercent(100);
                            await saveHistory(inputData, data);
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        } else if (event.type === 'debug_log') {
                            setDebugLogs(prev => [...prev, {
                                timestamp: event.timestamp,
                                label: event.label,
                                content: event.content,
                            }]);
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

    function handleCopyDebugLog() {
        const text = debugLogs.map(log => {
            const time = new Date(log.timestamp).toLocaleTimeString('ja-JP');
            const contentStr = typeof log.content === 'string'
                ? log.content
                : JSON.stringify(log.content, null, 2);
            return `${time}\n${log.label}\n${contentStr}`;
        }).join('\n');
        navigator.clipboard.writeText(text);
        setLogCopied(true);
        setTimeout(() => setLogCopied(false), 2000);
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

    function toggleCandidate(index: number) {
        setSelectedIndices(prev => {
            const next = new Set(prev);
            if (next.has(index)) {
                next.delete(index);
            } else {
                if (next.size >= 3) return prev; // Max 3 selections
                next.add(index);
            }
            return next;
        });
    }

    async function handleAddLanguages() {
        if (!input || !phase1Summary) return;
        setIsAddingLanguages(true);
        try {
            const customPrompts = await getCustomPrompts();
            const res = await fetch('/api/regenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'add-languages',
                    input,
                    phase1Summary,
                    modelId: input.model,
                    customPrompts,
                    existingKeywords: allCandidates.map(c => c.keyword),
                    direction: directionNote || undefined,
                }),
            });
            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '追加生成に失敗しました');
            }
            const data = await res.json();
            if (data.languages && Array.isArray(data.languages)) {
                setAllCandidates(prev => [...prev, ...data.languages]);
            }
            setDirectionNote('');
            setShowDirectionInput(false);
        } catch (err) {
            alert(err instanceof Error ? err.message : '追加生成に失敗しました');
        } finally {
            setIsAddingLanguages(false);
        }
    }

    async function handleRegeneratePhases() {
        if (!input || !phase1Summary || selectedIndices.size !== 3) return;
        const selected = [...selectedIndices].sort((a, b) => a - b).map(i => allCandidates[i]);

        setIsRegenerating(true);
        setRegeneratePercent(0);
        setRegenerateMsg('Phase 3+4 を再生成中...');

        try {
            const customPrompts = await getCustomPrompts();
            const res = await fetch('/api/regenerate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'regenerate-phases',
                    input,
                    phase1Summary,
                    modelId: input.model,
                    customPrompts,
                    selectedLanguages: selected,
                    marketRedefinition: result?.phase1?.marketRedefinition || '',
                }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || '再生成に失敗しました');
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
                            setRegeneratePercent(event.percent);
                            setRegenerateMsg(event.message);
                        } else if (event.type === 'result') {
                            // Save to iteration history
                            const entry: IterationEntry = {
                                id: crypto.randomUUID(),
                                timestamp: new Date().toISOString(),
                                selectedLanguages: event.data.selectedLanguages,
                                phase3: event.data.phase3,
                                phase4: event.data.phase4,
                            };
                            setIterationHistory(prev => [...prev, entry]);

                            // Update current result
                            if (result) {
                                const updated: PrismResult = {
                                    ...result,
                                    phase2: selected,
                                    phase3: event.data.phase3,
                                    phase4: event.data.phase4,
                                    iterationHistory: [...iterationHistory, entry],
                                };
                                setResult(updated);
                                await saveHistory(input, updated);
                            }
                        } else if (event.type === 'error') {
                            throw new Error(event.error);
                        }
                    } catch (parseErr) {
                        if (parseErr instanceof Error && parseErr.message !== 'Unexpected end of JSON input') {
                            throw parseErr;
                        }
                    }
                }
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : '再生成に失敗しました');
        } finally {
            setIsRegenerating(false);
            setRegeneratePercent(0);
            setRegenerateMsg('');
        }
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 14 }}>
                        <div style={{ display: 'flex', gap: 32 }}>
                            <div>
                                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>商材:</span>
                                <span style={{ fontWeight: 600 }}>{input.productName}</span>
                            </div>
                            <div>
                                <span style={{ color: 'var(--text-muted)', marginRight: 8 }}>カテゴリ:</span>
                                <span style={{ fontWeight: 600 }}>{input.category}</span>
                            </div>
                        </div>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{
                                fontSize: 11,
                                padding: '3px 10px',
                                borderRadius: 20,
                                background: input.model === 'gemini-3-pro-preview'
                                    ? 'rgba(139,92,246,0.18)'
                                    : 'rgba(59,130,246,0.18)',
                                color: input.model === 'gemini-3-pro-preview'
                                    ? 'var(--spectrum-violet)'
                                    : 'var(--spectrum-blue)',
                                fontWeight: 600,
                            }}>
                                {input.model === 'gemini-3-pro-preview' ? 'Gemini 3 Pro' : 'Gemini 3 Flash'}
                            </span>
                            <span style={{
                                fontSize: 11,
                                padding: '3px 10px',
                                borderRadius: 20,
                                background: input.researchDepth === 'api-deep-research'
                                    ? 'rgba(245,158,11,0.18)'
                                    : 'rgba(100,116,139,0.18)',
                                color: input.researchDepth === 'api-deep-research'
                                    ? '#f59e0b'
                                    : 'var(--text-secondary)',
                                fontWeight: 600,
                            }}>
                                {input.researchDepth === 'api-deep-research' ? '🔬 Deep Research' : '⚡ Test'}
                            </span>
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

                    {/* Progressive Phase Results — tab-based view */}
                    {(partialPhase1 || partialPhase2 || partialPhase3) && (
                        <div style={{ marginTop: 32 }}>
                            {/* Tab bar */}
                            <div className="tab-group" style={{ marginBottom: 16 }}>
                                <button
                                    className={`tab-item ${progressTab === 'listening' ? 'active' : ''}`}
                                    onClick={() => setProgressTab('listening')}
                                    disabled={!partialPhase1}
                                    style={!partialPhase1 ? { opacity: 0.3, pointerEvents: 'none' } : {}}
                                >
                                    {partialPhase1 ? '✓ ' : ''}🎧 Deep Listening
                                </button>
                                <button
                                    className={`tab-item ${progressTab === 'language' ? 'active' : ''}`}
                                    onClick={() => setProgressTab('language')}
                                    disabled={!partialPhase2}
                                    style={!partialPhase2 ? { opacity: 0.3, pointerEvents: 'none' } : {}}
                                >
                                    {partialPhase2 ? '✓ ' : ''}◈ 社会言語
                                </button>
                                <button
                                    className={`tab-item ${progressTab === 'survey' ? 'active' : ''}`}
                                    onClick={() => setProgressTab('survey')}
                                    disabled={!partialPhase3}
                                    style={!partialPhase3 ? { opacity: 0.3, pointerEvents: 'none' } : {}}
                                >
                                    {partialPhase3 ? '✓ ' : ''}📊 調査設計
                                </button>
                            </div>

                            {/* Tab content */}
                            <div className="glass-card" style={{ padding: 28 }}>
                                {/* Phase 1 tab */}
                                {progressTab === 'listening' && partialPhase1 && (
                                    <div>
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

                                {/* Phase 2 tab */}
                                {progressTab === 'language' && partialPhase2 && (
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
                                )}

                                {/* Phase 3 tab */}
                                {progressTab === 'survey' && partialPhase3 && (
                                    <div>
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
                        </div>
                    )}

                    {/* Debug Log Panel (during analysis) */}
                    {debugLogs.length > 0 && (
                        <div ref={debugPanelRef} style={{
                            marginTop: 24,
                            borderRadius: 'var(--radius-lg)',
                            border: '1px solid rgba(255,255,255,0.06)',
                            background: 'rgba(0,0,0,0.3)',
                            overflow: 'hidden',
                        }}>
                            <button
                                onClick={() => setDebugExpanded(!debugExpanded)}
                                style={{
                                    width: '100%',
                                    padding: '14px 20px',
                                    background: 'rgba(255,255,255,0.03)',
                                    border: 'none',
                                    borderBottom: debugExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 10,
                                    fontFamily: 'inherit',
                                    color: 'var(--text-muted)',
                                    fontSize: 13,
                                    fontWeight: 600,
                                }}
                            >
                                <span style={{ transform: debugExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                                🔬 デバッグログ ({debugLogs.length}件) — リアルタイム
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleCopyDebugLog(); }}
                                    style={{
                                        marginLeft: 'auto',
                                        fontSize: 11,
                                        padding: '4px 12px',
                                        borderRadius: 'var(--radius-sm)',
                                        background: logCopied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                        border: `1px solid ${logCopied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                        color: logCopied ? '#34d399' : 'var(--text-muted)',
                                        cursor: 'pointer',
                                        fontFamily: 'inherit',
                                        fontWeight: 500,
                                    }}
                                >
                                    {logCopied ? '✓ コピー済み' : '📋 ログをコピー'}
                                </button>
                            </button>
                            {debugExpanded && (
                                <div style={{ maxHeight: '50vh', overflowY: 'auto', padding: '8px 0' }}>
                                    {debugLogs.map((log, i) => {
                                        const contentStr = typeof log.content === 'string'
                                            ? log.content
                                            : JSON.stringify(log.content, null, 2);
                                        return (
                                            <div key={i} style={{
                                                padding: '8px 20px',
                                                borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                fontSize: 12,
                                            }}>
                                                <div style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 10,
                                                    marginBottom: 4,
                                                }}>
                                                    <span style={{
                                                        fontSize: 10,
                                                        color: 'var(--text-muted)',
                                                        fontFamily: 'monospace',
                                                        opacity: 0.6,
                                                    }}>
                                                        {new Date(log.timestamp).toLocaleTimeString('ja-JP')}
                                                    </span>
                                                    <span style={{
                                                        fontWeight: 600,
                                                        color: 'var(--text-secondary)',
                                                    }}>
                                                        {log.label}
                                                    </span>
                                                </div>
                                                <pre style={{
                                                    margin: 0,
                                                    padding: '6px 10px',
                                                    borderRadius: 'var(--radius-sm)',
                                                    background: 'rgba(0,0,0,0.3)',
                                                    color: 'var(--text-muted)',
                                                    fontSize: 11,
                                                    fontFamily: 'monospace',
                                                    whiteSpace: 'pre-wrap',
                                                    wordBreak: 'break-all',
                                                }}>
                                                    {contentStr}
                                                </pre>
                                            </div>
                                        );
                                    })}
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
                                    {/* Test mode hallucination warning */}
                                    {input?.researchDepth !== 'api-deep-research' && (
                                        <div style={{
                                            padding: '14px 18px',
                                            marginBottom: 24,
                                            borderRadius: 'var(--radius-md)',
                                            background: 'rgba(245,158,11,0.08)',
                                            border: '1px solid rgba(245,158,11,0.25)',
                                            display: 'flex',
                                            alignItems: 'flex-start',
                                            gap: 10,
                                            fontSize: 13,
                                            lineHeight: 1.7,
                                            color: '#fbbf24',
                                        }}>
                                            <span style={{ fontSize: 18, flexShrink: 0, marginTop: 1 }}>⚠️</span>
                                            <div>
                                                <strong style={{ color: '#f59e0b' }}>テストモード — AIによる推定結果</strong>
                                                <br />
                                                <span style={{ color: 'var(--text-secondary)', fontSize: 12 }}>
                                                    以下の「声」はAIが生成した仮想データであり、実在する口コミ・レビューとは限りません。URLリンクが含まれる場合も、ハルシネーション（AI幻覚）の可能性があります。正確な調査には Deep Research モードをご利用ください。
                                                </span>
                                            </div>
                                        </div>
                                    )}
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
                                    {/* Header + Selection count */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                                        <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0 }}>
                                            社会言語候補
                                            <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8 }}>
                                                ({allCandidates.length > 0 ? allCandidates.length : result.phase2.length}個)
                                            </span>
                                        </h3>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={{
                                                fontSize: 12,
                                                padding: '4px 12px',
                                                borderRadius: 20,
                                                background: selectedIndices.size === 3 ? 'rgba(34,197,94,0.15)' : 'rgba(255,255,255,0.06)',
                                                color: selectedIndices.size === 3 ? '#22c55e' : 'var(--text-muted)',
                                                fontWeight: 600,
                                            }}>
                                                {selectedIndices.size}/3 選択中
                                            </span>
                                        </div>
                                    </div>

                                    {/* Candidate Cards with Checkboxes */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                                        {(allCandidates.length > 0 ? allCandidates : result.phase2).map((sl, i) => {
                                            const isSelected = selectedIndices.has(i);
                                            const isDisabled = !isSelected && selectedIndices.size >= 3;
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => !isRegenerating && toggleCandidate(i)}
                                                    style={{
                                                        position: 'relative',
                                                        padding: '20px 24px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: isSelected
                                                            ? '2px solid var(--spectrum-violet)'
                                                            : '1px solid rgba(255,255,255,0.08)',
                                                        background: isSelected
                                                            ? 'rgba(139,92,246,0.08)'
                                                            : 'rgba(10,10,30,0.4)',
                                                        cursor: isRegenerating ? 'default' : (isDisabled ? 'not-allowed' : 'pointer'),
                                                        opacity: isDisabled ? 0.5 : 1,
                                                        transition: 'all 0.2s ease',
                                                    }}
                                                >
                                                    {/* Selection badge */}
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: 12,
                                                        right: 12,
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: '50%',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        background: isSelected ? 'var(--spectrum-violet)' : 'rgba(255,255,255,0.06)',
                                                        border: isSelected ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        color: isSelected ? '#fff' : 'var(--text-muted)',
                                                    }}>
                                                        {isSelected ? '✓' : ''}
                                                    </div>

                                                    {/* Card number badge */}
                                                    <span style={{
                                                        display: 'inline-block',
                                                        fontSize: 11,
                                                        fontWeight: 700,
                                                        padding: '2px 8px',
                                                        borderRadius: 12,
                                                        background: 'rgba(255,255,255,0.06)',
                                                        color: 'var(--text-muted)',
                                                        marginBottom: 8,
                                                    }}>
                                                        候補 {i + 1}
                                                    </span>

                                                    <div className="sl-keyword" style={{ marginTop: 4, paddingRight: 40 }}>{sl.keyword}</div>
                                                    <div className="sl-section-title">販促ストーリー</div>
                                                    <div className="sl-section-body">{sl.story}</div>
                                                    <div className="sl-section-title">根拠・ファクト</div>
                                                    <div className="sl-section-body">{sl.fact}</div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Action Buttons */}
                                    <div style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: 16,
                                        padding: '20px 24px',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'rgba(10,10,30,0.4)',
                                        border: '1px solid rgba(255,255,255,0.06)',
                                    }}>
                                        {/* Add more candidates */}
                                        <div>
                                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                                <button
                                                    onClick={() => setShowDirectionInput(true)}
                                                    disabled={isAddingLanguages || isRegenerating || showDirectionInput}
                                                    style={{
                                                        padding: '10px 20px',
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid rgba(139,92,246,0.3)',
                                                        background: 'rgba(139,92,246,0.1)',
                                                        color: 'var(--spectrum-violet)',
                                                        fontSize: 13,
                                                        fontWeight: 600,
                                                        cursor: isAddingLanguages || isRegenerating || showDirectionInput ? 'not-allowed' : 'pointer',
                                                        opacity: isAddingLanguages || isRegenerating || showDirectionInput ? 0.5 : 1,
                                                        fontFamily: 'inherit',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 6,
                                                    }}
                                                >
                                                    ＋ 候補を3つ追加生成
                                                </button>
                                            </div>
                                            {showDirectionInput && (
                                                <div style={{ marginTop: 10 }}>
                                                    <input
                                                        type="text"
                                                        value={directionNote}
                                                        onChange={e => setDirectionNote(e.target.value)}
                                                        placeholder="方向性メモ（任意）例：もっと攻めた表現で、○○の側面にフォーカス"
                                                        style={{
                                                            width: '100%',
                                                            padding: '10px 14px',
                                                            borderRadius: 'var(--radius-md)',
                                                            border: '1px solid rgba(255,255,255,0.12)',
                                                            background: 'rgba(0,0,0,0.3)',
                                                            color: 'var(--text-primary)',
                                                            fontSize: 13,
                                                            fontFamily: 'inherit',
                                                            outline: 'none',
                                                            boxSizing: 'border-box',
                                                        }}
                                                        onKeyDown={e => e.key === 'Enter' && handleAddLanguages()}
                                                    />
                                                    <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                                                        <button
                                                            onClick={handleAddLanguages}
                                                            disabled={isAddingLanguages}
                                                            style={{
                                                                padding: '8px 18px',
                                                                borderRadius: 'var(--radius-md)',
                                                                border: 'none',
                                                                background: 'var(--spectrum-violet)',
                                                                color: '#fff',
                                                                fontSize: 13,
                                                                fontWeight: 600,
                                                                cursor: isAddingLanguages ? 'not-allowed' : 'pointer',
                                                                fontFamily: 'inherit',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 6,
                                                            }}
                                                        >
                                                            {isAddingLanguages ? (
                                                                <><span className="prism-loader" style={{ width: 14, height: 14 }} /> 生成中...</>
                                                            ) : (
                                                                '生成開始'
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => { setShowDirectionInput(false); setDirectionNote(''); }}
                                                            disabled={isAddingLanguages}
                                                            style={{
                                                                padding: '8px 14px',
                                                                borderRadius: 'var(--radius-md)',
                                                                border: '1px solid rgba(255,255,255,0.1)',
                                                                background: 'transparent',
                                                                color: 'var(--text-muted)',
                                                                fontSize: 12,
                                                                cursor: isAddingLanguages ? 'not-allowed' : 'pointer',
                                                                fontFamily: 'inherit',
                                                            }}
                                                        >
                                                            キャンセル
                                                        </button>
                                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                            Enterキーでも開始OK　空欄でもOK
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Divider */}
                                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }} />

                                        {/* Regenerate Phase 3+4 */}
                                        <div>
                                            <button
                                                onClick={handleRegeneratePhases}
                                                disabled={selectedIndices.size !== 3 || isRegenerating || isAddingLanguages}
                                                style={{
                                                    padding: '12px 24px',
                                                    borderRadius: 'var(--radius-md)',
                                                    border: 'none',
                                                    background: selectedIndices.size === 3 && !isRegenerating
                                                        ? 'linear-gradient(135deg, var(--spectrum-cyan), var(--spectrum-violet))'
                                                        : 'rgba(255,255,255,0.06)',
                                                    color: selectedIndices.size === 3 ? '#fff' : 'var(--text-muted)',
                                                    fontSize: 14,
                                                    fontWeight: 700,
                                                    cursor: selectedIndices.size !== 3 || isRegenerating ? 'not-allowed' : 'pointer',
                                                    opacity: selectedIndices.size !== 3 || isRegenerating ? 0.5 : 1,
                                                    fontFamily: 'inherit',
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    gap: 8,
                                                }}
                                            >
                                                {isRegenerating ? (
                                                    <><span className="prism-loader" style={{ width: 18, height: 18 }} /> 再生成中...</>
                                                ) : (
                                                    <>🔄 この3案で Phase 3+4 を再生成</>
                                                )}
                                            </button>
                                            {selectedIndices.size !== 3 && !isRegenerating && (
                                                <p style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', marginTop: 6, marginBottom: 0 }}>
                                                    3つの候補を選択してください
                                                </p>
                                            )}
                                        </div>

                                        {/* Regeneration progress bar */}
                                        {isRegenerating && (
                                            <div style={{ marginTop: 8 }}>
                                                <div style={{
                                                    width: '100%',
                                                    height: 4,
                                                    borderRadius: 2,
                                                    background: 'rgba(255,255,255,0.06)',
                                                    overflow: 'hidden',
                                                    marginBottom: 8,
                                                }}>
                                                    <div style={{
                                                        width: `${regeneratePercent}%`,
                                                        height: '100%',
                                                        borderRadius: 2,
                                                        background: 'linear-gradient(90deg, var(--spectrum-cyan), var(--spectrum-violet))',
                                                        transition: 'width 0.4s ease-out',
                                                    }} />
                                                </div>
                                                <p style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>
                                                    {regenerateMsg}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Iteration History */}
                                    {iterationHistory.length > 0 && (
                                        <div style={{ marginTop: 32 }}>
                                            <h4 style={{
                                                fontSize: 14,
                                                fontWeight: 700,
                                                color: 'var(--text-muted)',
                                                marginBottom: 12,
                                                letterSpacing: '0.05em',
                                            }}>
                                                📋 イテレーション履歴 ({iterationHistory.length}回)
                                            </h4>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                {iterationHistory.map((entry, hi) => (
                                                    <details key={entry.id} style={{
                                                        borderRadius: 'var(--radius-md)',
                                                        border: '1px solid rgba(255,255,255,0.06)',
                                                        background: 'rgba(10,10,30,0.3)',
                                                        overflow: 'hidden',
                                                    }}>
                                                        <summary style={{
                                                            padding: '12px 16px',
                                                            cursor: 'pointer',
                                                            fontSize: 13,
                                                            fontWeight: 600,
                                                            color: 'var(--text-secondary)',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 10,
                                                        }}>
                                                            <span style={{ color: 'var(--spectrum-violet)' }}>#{hi + 1}</span>
                                                            {entry.selectedLanguages.map(sl => sl.keyword).join(' / ')}
                                                            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>
                                                                {new Date(entry.timestamp).toLocaleTimeString('ja-JP')}
                                                            </span>
                                                        </summary>
                                                        <div style={{ padding: '0 16px 16px' }}>
                                                            {/* Survey Design preview */}
                                                            <div style={{ marginBottom: 12 }}>
                                                                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>📊 調査設計</p>
                                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                                                    {entry.phase3.quantitative.map((q, qi) => (
                                                                        <div key={qi}>Q{qi + 1}. {q}</div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            {/* Output preview */}
                                                            <div>
                                                                <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>📰 ニュース見出し</p>
                                                                <p style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, margin: 0 }}>
                                                                    {entry.phase4.newsHeadline}
                                                                </p>
                                                            </div>
                                                            {/* Load this iteration button */}
                                                            <button
                                                                onClick={() => {
                                                                    if (result) {
                                                                        setResult({
                                                                            ...result,
                                                                            phase2: entry.selectedLanguages,
                                                                            phase3: entry.phase3,
                                                                            phase4: entry.phase4,
                                                                        });
                                                                    }
                                                                }}
                                                                style={{
                                                                    marginTop: 12,
                                                                    padding: '6px 14px',
                                                                    borderRadius: 'var(--radius-sm)',
                                                                    border: '1px solid rgba(139,92,246,0.3)',
                                                                    background: 'rgba(139,92,246,0.08)',
                                                                    color: 'var(--spectrum-violet)',
                                                                    fontSize: 11,
                                                                    fontWeight: 600,
                                                                    cursor: 'pointer',
                                                                    fontFamily: 'inherit',
                                                                }}
                                                            >
                                                                この結果を表示
                                                            </button>
                                                        </div>
                                                    </details>
                                                ))}
                                            </div>
                                        </div>
                                    )}
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

                        {/* Debug Log Panel */}
                        {debugLogs.length > 0 && (
                            <div ref={debugPanelRef} style={{
                                marginTop: 48,
                                borderRadius: 'var(--radius-lg)',
                                border: '1px solid rgba(255,255,255,0.06)',
                                background: 'rgba(0,0,0,0.3)',
                                overflow: 'hidden',
                            }}>
                                <button
                                    onClick={() => setDebugExpanded(!debugExpanded)}
                                    style={{
                                        width: '100%',
                                        padding: '14px 20px',
                                        background: 'rgba(255,255,255,0.03)',
                                        border: 'none',
                                        borderBottom: debugExpanded ? '1px solid rgba(255,255,255,0.06)' : 'none',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        fontFamily: 'inherit',
                                        color: 'var(--text-muted)',
                                        fontSize: 13,
                                        fontWeight: 600,
                                    }}
                                >
                                    <span style={{ transform: debugExpanded ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>▶</span>
                                    🔬 デバッグログ ({debugLogs.length}件)
                                    <span style={{ fontSize: 11, fontWeight: 400 }}>
                                        データフローの全記録
                                    </span>
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleCopyDebugLog(); }}
                                        style={{
                                            marginLeft: 'auto',
                                            fontSize: 11,
                                            padding: '4px 12px',
                                            borderRadius: 'var(--radius-sm)',
                                            background: logCopied ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                                            border: `1px solid ${logCopied ? 'rgba(52,211,153,0.3)' : 'rgba(255,255,255,0.1)'}`,
                                            color: logCopied ? '#34d399' : 'var(--text-muted)',
                                            cursor: 'pointer',
                                            fontFamily: 'inherit',
                                            fontWeight: 500,
                                        }}
                                    >
                                        {logCopied ? '✓ コピー済み' : '📋 ログをコピー'}
                                    </button>
                                </button>
                                {debugExpanded && (
                                    <div style={{ maxHeight: '70vh', overflowY: 'auto', padding: '8px 0' }}>
                                        {debugLogs.map((log, i) => {
                                            const contentStr = typeof log.content === 'string'
                                                ? log.content
                                                : JSON.stringify(log.content, null, 2);
                                            return (
                                                <div key={i} style={{
                                                    padding: '8px 20px',
                                                    borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                    fontSize: 12,
                                                }}>
                                                    <div style={{
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        gap: 10,
                                                        marginBottom: 4,
                                                    }}>
                                                        <span style={{
                                                            fontSize: 10,
                                                            color: 'var(--text-muted)',
                                                            fontFamily: 'monospace',
                                                            opacity: 0.6,
                                                        }}>
                                                            {new Date(log.timestamp).toLocaleTimeString('ja-JP')}
                                                        </span>
                                                        <span style={{
                                                            fontWeight: 600,
                                                            color: 'var(--text-secondary)',
                                                        }}>
                                                            {log.label}
                                                        </span>
                                                    </div>
                                                    <pre style={{
                                                        margin: 0,
                                                        padding: '6px 10px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        background: 'rgba(0,0,0,0.3)',
                                                        color: 'var(--text-muted)',
                                                        fontSize: 11,
                                                        fontFamily: 'monospace',
                                                        whiteSpace: 'pre-wrap',
                                                        wordBreak: 'break-all',
                                                    }}>
                                                        {contentStr}
                                                    </pre>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                )
            }
        </div >
    );
}
