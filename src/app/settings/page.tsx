'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { CustomPrompts } from '@/lib/types';
import { getCustomPrompts, saveCustomPrompts, resetCustomPrompts } from '@/lib/storage';
import { getDefaultPrompts } from '@/lib/prompts';

const PROMPT_SECTIONS = [
    {
        key: 'systemPrompt' as const,
        label: 'システムプロンプト',
        icon: '🧠',
        description: 'AIの役割定義。社会記号学者としての振る舞いと品質基準を規定',
    },
    {
        key: 'phase1Template' as const,
        label: 'Phase 1: Deep Listening & Insight',
        icon: '🎧',
        description: 'SNSやレビューから生活者の声を抽出。変数: {{productName}}, {{category}}, {{challenges}}',
    },
    {
        key: 'phase2Template' as const,
        label: 'Phase 2: Social Language Development',
        icon: '💬',
        description: '生の声を社会言語に昇華。変数: {{productName}}, {{category}}, {{phase1Summary}}',
    },
    {
        key: 'phase3Template' as const,
        label: 'Phase 3: Evidence Design',
        icon: '📊',
        description: '社会言語を証明する調査設計。変数: {{productName}}, {{category}}, {{socialLanguages}}',
    },
    {
        key: 'phase4Template' as const,
        label: 'Phase 4: Output Generation',
        icon: '📄',
        description: 'レポート・プレスリリース・ポジショニング生成。変数: {{productName}}, {{category}}, {{phase1Summary}}, {{socialLanguages}}, {{surveyDesign}}',
    },
];

export default function SettingsPage() {
    const router = useRouter();
    const defaults = getDefaultPrompts();
    const [prompts, setPrompts] = useState<CustomPrompts>(defaults);
    const [saved, setSaved] = useState(false);
    const [expandedKey, setExpandedKey] = useState<string | null>(null);
    const [modified, setModified] = useState<Set<string>>(new Set());

    useEffect(() => {
        const custom = getCustomPrompts();
        if (custom) {
            setPrompts(custom);
            // Detect which prompts differ from defaults
            const diffs = new Set<string>();
            for (const section of PROMPT_SECTIONS) {
                if (custom[section.key] !== defaults[section.key]) {
                    diffs.add(section.key);
                }
            }
            setModified(diffs);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleChange = useCallback((key: keyof CustomPrompts, value: string) => {
        setPrompts((prev) => ({ ...prev, [key]: value }));
        setModified((prev) => {
            const next = new Set(prev);
            if (value !== defaults[key]) {
                next.add(key);
            } else {
                next.delete(key);
            }
            return next;
        });
        setSaved(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSave = () => {
        saveCustomPrompts(prompts);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleResetOne = (key: keyof CustomPrompts) => {
        if (!confirm('このプロンプトを初期値に戻しますか？')) return;
        const newPrompts = { ...prompts, [key]: defaults[key] };
        setPrompts(newPrompts);
        setModified((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
        });
        saveCustomPrompts(newPrompts);
    };

    const handleResetAll = () => {
        if (!confirm('すべてのプロンプトを初期値に戻しますか？')) return;
        resetCustomPrompts();
        setPrompts(defaults);
        setModified(new Set());
    };

    return (
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '48px 24px' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
                <div>
                    <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        ⚙️ プロンプト設定
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                        各工程で使われるプロンプトを確認・編集できます（ブラウザに保存）
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => router.push('/')} style={linkBtnStyle}>
                        ← ホームに戻る
                    </button>
                    {modified.size > 0 && (
                        <button
                            onClick={handleResetAll}
                            style={{ ...linkBtnStyle, color: '#ff6b6b', borderColor: 'rgba(255,107,107,0.3)' }}
                        >
                            🔄 すべて初期値に戻す
                        </button>
                    )}
                </div>
            </div>

            {/* Info */}
            <div style={{
                padding: '12px 16px',
                borderRadius: 8,
                marginBottom: 24,
                background: 'rgba(0,200,255,0.05)',
                border: '1px solid rgba(0,200,255,0.15)',
                fontSize: 13,
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
            }}>
                💡 <strong>変数について:</strong> <code style={codeStyle}>{`{{productName}}`}</code> のように二重波括弧で囲まれた部分は、
                分析実行時に実際の入力値に置換されます。変数名は変更しないでください。
            </div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {PROMPT_SECTIONS.map((section) => {
                    const expanded = expandedKey === section.key;
                    const isModified = modified.has(section.key);

                    return (
                        <div
                            key={section.key}
                            style={{
                                background: 'var(--glass-bg)',
                                border: `1px solid ${isModified ? 'rgba(255,200,0,0.3)' : 'var(--border-subtle)'}`,
                                borderRadius: 12,
                                overflow: 'hidden',
                            }}
                        >
                            {/* Header */}
                            <button
                                onClick={() => setExpandedKey(expanded ? null : section.key)}
                                style={{
                                    width: '100%',
                                    padding: '16px 20px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 12,
                                    textAlign: 'left',
                                    color: 'var(--text-primary)',
                                }}
                            >
                                <span style={{ fontSize: 20 }}>{expanded ? '▾' : '▸'}</span>
                                <span style={{ fontSize: 20 }}>{section.icon}</span>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 700, fontSize: 15 }}>
                                        {section.label}
                                        {isModified && (
                                            <span style={{
                                                marginLeft: 8,
                                                fontSize: 10,
                                                padding: '2px 6px',
                                                borderRadius: 4,
                                                background: 'rgba(255,200,0,0.15)',
                                                color: '#ffc800',
                                            }}>
                                                カスタマイズ済
                                            </span>
                                        )}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                                        {section.description}
                                    </div>
                                </div>
                            </button>

                            {/* Editor */}
                            {expanded && (
                                <div style={{ padding: '0 20px 20px', borderTop: '1px solid var(--border-subtle)' }}>
                                    <textarea
                                        value={prompts[section.key]}
                                        onChange={(e) => handleChange(section.key, e.target.value)}
                                        style={{
                                            width: '100%',
                                            minHeight: 300,
                                            marginTop: 16,
                                            padding: 16,
                                            borderRadius: 8,
                                            border: '1px solid var(--border-subtle)',
                                            background: 'rgba(0,0,0,0.3)',
                                            color: 'var(--text-primary)',
                                            fontSize: 13,
                                            fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                                            lineHeight: 1.7,
                                            resize: 'vertical',
                                            outline: 'none',
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12 }}>
                                        <button
                                            onClick={() => handleResetOne(section.key)}
                                            style={{
                                                ...linkBtnStyle,
                                                fontSize: 12,
                                                opacity: isModified ? 1 : 0.4,
                                                pointerEvents: isModified ? 'auto' : 'none',
                                            }}
                                        >
                                            🔄 初期値に戻す
                                        </button>
                                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {prompts[section.key].length.toLocaleString()} 文字
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Save button */}
            <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center' }}>
                <button
                    onClick={handleSave}
                    style={{
                        padding: '12px 40px',
                        borderRadius: 10,
                        fontSize: 15,
                        fontWeight: 700,
                        background: saved
                            ? 'rgba(0,200,100,0.2)'
                            : 'linear-gradient(135deg, rgba(0,200,255,0.15), rgba(150,0,255,0.15))',
                        border: `1px solid ${saved ? 'rgba(0,200,100,0.4)' : 'rgba(0,200,255,0.3)'}`,
                        color: saved ? '#00c864' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.3s',
                    }}
                >
                    {saved ? '✓ 保存しました' : '💾 設定を保存'}
                </button>
            </div>
        </div>
    );
}

// ── Shared styles ──
const linkBtnStyle: React.CSSProperties = {
    padding: '8px 16px',
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    background: 'none',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.2s',
};

const codeStyle: React.CSSProperties = {
    padding: '2px 6px',
    borderRadius: 4,
    background: 'rgba(255,255,255,0.05)',
    fontFamily: 'monospace',
    fontSize: 12,
};
