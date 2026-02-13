'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { HistoryEntry, VoiceItem } from '@/lib/types';
import { toVoiceItem } from '@/lib/types';
import { getHistory, deleteHistoryEntry, clearHistory } from '@/lib/storage';
import { linkBtnStyle, dangerBtnStyle, sectionStyle, sectionTitleStyle } from '@/lib/styles';

const subHeadStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-secondary)',
    marginBottom: 6,
    marginTop: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
};

const voiceStyle: React.CSSProperties = {
    fontSize: 13,
    color: 'var(--text-secondary)',
    display: 'flex',
    gap: 6,
    padding: '4px 0',
    lineHeight: 1.6,
};

const cardStyle: React.CSSProperties = {
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
};
export default function HistoryPage() {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        getHistory().then(setEntries);
    }, []);

    const handleDelete = async (id: string) => {
        await deleteHistoryEntry(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    const handleClearAll = async () => {
        if (!confirm('すべての実行履歴を削除しますか？')) return;
        await clearHistory();
        setEntries([]);
    };

    const formatDate = (iso: string) => {
        const d = new Date(iso);
        return d.toLocaleDateString('ja-JP', {
            year: 'numeric', month: '2-digit', day: '2-digit',
            hour: '2-digit', minute: '2-digit',
        });
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        📋 実行履歴
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                        過去の分析結果を確認できます（最大50件・データベースに保存）
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <Link href="/" style={linkBtnStyle}>
                        ← ホームに戻る
                    </Link>
                    {entries.length > 0 && (
                        <button
                            onClick={handleClearAll}
                            style={dangerBtnStyle}
                        >
                            🗑 すべて削除
                        </button>
                    )}
                </div>
            </div>

            {/* Empty state */}
            {entries.length === 0 && (
                <div style={{
                    padding: 64,
                    textAlign: 'center',
                    color: 'var(--text-muted)',
                    border: '1px dashed var(--border-subtle)',
                    borderRadius: 16,
                }}>
                    <p style={{ fontSize: 48, margin: '0 0 12px' }}>📭</p>
                    <p>まだ実行履歴がありません</p>
                    <Link
                        href="/"
                        style={{ ...linkBtnStyle, marginTop: 16 }}
                    >
                        分析を始める →
                    </Link>
                </div>
            )}

            {/* List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {entries.map((entry) => {
                    const expanded = expandedId === entry.id;
                    return (
                        <div
                            key={entry.id}
                            style={{
                                background: 'var(--glass-bg)',
                                border: '1px solid var(--border-subtle)',
                                borderRadius: 12,
                                overflow: 'hidden',
                                transition: 'border-color 0.2s',
                            }}
                        >
                            {/* Summary row */}
                            <button
                                onClick={() => setExpandedId(expanded ? null : entry.id)}
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 16,
                                    textAlign: 'left',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <span style={{ fontSize: 20 }}>{expanded ? '▾' : '▸'}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 16 }}>
                                        {entry.input.productName}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {entry.input.category} ・ {formatDate(entry.timestamp)}
                                        {entry.input.model && (
                                            <span style={{
                                                marginLeft: 8,
                                                padding: '1px 6px',
                                                borderRadius: 4,
                                                fontSize: 10,
                                                background: 'rgba(100,100,255,0.15)',
                                                color: 'var(--spectrum-violet)',
                                            }}>
                                                {entry.input.model === 'gemini-3-pro-preview' ? 'Pro' : 'Flash'}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                                    title="この履歴を削除"
                                    style={{
                                        background: 'none', border: 'none', cursor: 'pointer',
                                        color: 'var(--text-muted)', fontSize: 16, padding: 4,
                                        opacity: 0.5, transition: 'opacity 0.2s',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                                >
                                    ✕
                                </button>
                            </button>

                            {/* Expanded detail — FULL RESULTS */}
                            {expanded && (
                                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                                    {/* Input info */}
                                    <div style={{ ...sectionStyle, marginTop: 16 }}>
                                        <h4 style={sectionTitleStyle}>入力情報</h4>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                                            <div><strong>商材:</strong> {entry.input.productName}</div>
                                            <div><strong>カテゴリ:</strong> {entry.input.category}</div>
                                            <div><strong>課題:</strong> {entry.input.challenges}</div>
                                        </div>
                                    </div>

                                    {/* Phase 1: Deep Listening */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>🎧 Phase 1: Deep Listening</h4>

                                        <p style={subHeadStyle}>
                                            <span style={{ color: 'var(--spectrum-cyan)' }}>●</span> Positive / Hack
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                                            {entry.result.phase1.positiveHacks.map((v, i) => {
                                                const item = toVoiceItem(v);
                                                return (
                                                    <div key={i} style={voiceStyle}>
                                                        <span style={{ color: 'var(--spectrum-cyan)', flexShrink: 0 }}>❝</span>
                                                        <div>
                                                            <span>{item.text}</span>
                                                            {item.sourceUrl && (
                                                                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                    style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-cyan)', textDecoration: 'none', marginTop: 2, opacity: 0.8 }}>
                                                                    ↗ {item.sourceTitle || item.sourceUrl}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p style={subHeadStyle}>
                                            <span style={{ color: 'var(--spectrum-red)' }}>●</span> Negative / Pain
                                        </p>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                                            {entry.result.phase1.negativePains.map((v, i) => {
                                                const item = toVoiceItem(v);
                                                return (
                                                    <div key={i} style={voiceStyle}>
                                                        <span style={{ color: 'var(--spectrum-red)', flexShrink: 0 }}>❝</span>
                                                        <div>
                                                            <span>{item.text}</span>
                                                            {item.sourceUrl && (
                                                                <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
                                                                    style={{ display: 'block', fontSize: 11, color: 'var(--spectrum-red)', textDecoration: 'none', marginTop: 2, opacity: 0.8 }}>
                                                                    ↗ {item.sourceTitle || item.sourceUrl}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>

                                        <p style={subHeadStyle}>▸ 市場の再定義</p>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', lineHeight: 1.8, margin: 0 }}>
                                            {entry.result.phase1.marketRedefinition}
                                        </p>

                                        {/* Grounding Sources */}
                                        {entry.result.groundingSources && entry.result.groundingSources.length > 0 && (
                                            <div style={{ marginTop: 16 }}>
                                                <p style={{ ...subHeadStyle, color: 'var(--text-muted)' }}>
                                                    🔗 Google検索ソース（{entry.result.groundingSources.length}件）
                                                </p>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                                    {entry.result.groundingSources.map((src, i) => (
                                                        <a
                                                            key={i}
                                                            href={src.url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            style={{
                                                                fontSize: 12,
                                                                color: 'var(--spectrum-cyan)',
                                                                textDecoration: 'none',
                                                                overflow: 'hidden',
                                                                textOverflow: 'ellipsis',
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            ↗ {src.title}
                                                        </a>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Phase 2: Social Language */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>💬 Phase 2: 社会言語</h4>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                            {entry.result.phase2.map((sl, i) => (
                                                <div key={i} style={cardStyle}>
                                                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--spectrum-cyan)', marginBottom: 6 }}>
                                                        {i + 1}. {sl.keyword}
                                                    </div>
                                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                                        <div><strong>ストーリー:</strong> {sl.story}</div>
                                                        <div style={{ marginTop: 4 }}><strong>ファクト:</strong> {sl.fact}</div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Phase 3: Evidence Design */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>📊 Phase 3: 調査設計</h4>
                                        <p style={subHeadStyle}>定量設問</p>
                                        <ol style={{ margin: '0 0 12px', paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            {entry.result.phase3.quantitative.map((q, i) => (
                                                <li key={i}>{q}</li>
                                            ))}
                                        </ol>
                                        <p style={subHeadStyle}>定性設問</p>
                                        <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                                            {entry.result.phase3.qualitative.map((q, i) => (
                                                <li key={i}>{q}</li>
                                            ))}
                                        </ol>
                                    </div>

                                    {/* Phase 4: Output */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>📄 Phase 4: アウトプット</h4>

                                        <p style={subHeadStyle}>📰 ニュース見出し</p>
                                        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 16px' }}>
                                            {entry.result.phase4.newsHeadline}
                                        </p>

                                        <p style={subHeadStyle}>🎯 ポジショニング提案</p>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.8, margin: '0 0 16px' }}>
                                            {entry.result.phase4.positioning}
                                        </p>

                                        <p style={subHeadStyle}>📋 調査レポートサマリ</p>
                                        <div style={{
                                            fontSize: 13,
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.8,
                                            whiteSpace: 'pre-wrap',
                                            padding: 16,
                                            borderRadius: 8,
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--border-subtle)',
                                            marginBottom: 16,
                                        }}>
                                            {entry.result.phase4.reportSummary}
                                        </div>

                                        <p style={subHeadStyle}>📰 プレスリリース記事</p>
                                        <div style={{
                                            fontSize: 13,
                                            color: 'var(--text-secondary)',
                                            lineHeight: 1.8,
                                            whiteSpace: 'pre-wrap',
                                            padding: 16,
                                            borderRadius: 8,
                                            background: 'rgba(255,255,255,0.02)',
                                            border: '1px solid var(--border-subtle)',
                                        }}>
                                            {entry.result.phase4.pressRelease}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

