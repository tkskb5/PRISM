'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import type { HistoryEntry } from '@/lib/types';
import { getHistory, deleteHistoryEntry, clearHistory } from '@/lib/storage';
import { linkBtnStyle, dangerBtnStyle, sectionStyle, sectionTitleStyle } from '@/lib/styles';

export default function HistoryPage() {
    const [entries, setEntries] = useState<HistoryEntry[]>([]);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    useEffect(() => {
        setEntries(getHistory());
    }, []);

    const handleDelete = (id: string) => {
        deleteHistoryEntry(id);
        setEntries((prev) => prev.filter((e) => e.id !== id));
    };

    const handleClearAll = () => {
        if (!confirm('すべての実行履歴を削除しますか？')) return;
        clearHistory();
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
                        過去の分析結果を確認できます（最大50件・ブラウザに保存）
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

                            {/* Expanded detail */}
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

                                    {/* Phase 1 */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>🎧 Deep Listening</h4>
                                        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                            <p><strong>市場の再定義:</strong> {entry.result.phase1.marketRedefinition}</p>
                                        </div>
                                    </div>

                                    {/* Phase 2 */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>💬 社会言語</h4>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                                            {entry.result.phase2.map((sl, i) => (
                                                <span key={i} style={{
                                                    padding: '4px 10px',
                                                    borderRadius: 8,
                                                    fontSize: 13,
                                                    fontWeight: 700,
                                                    background: 'rgba(0,255,200,0.08)',
                                                    border: '1px solid rgba(0,255,200,0.2)',
                                                    color: 'var(--spectrum-cyan)',
                                                }}>
                                                    {sl.keyword}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Phase 4: headline */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>📰 ニュース見出し</h4>
                                        <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                            {entry.result.phase4.newsHeadline}
                                        </p>
                                    </div>

                                    {/* Positioning */}
                                    <div style={sectionStyle}>
                                        <h4 style={sectionTitleStyle}>🎯 ポジショニング提案</h4>
                                        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                            {entry.result.phase4.positioning}
                                        </p>
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

