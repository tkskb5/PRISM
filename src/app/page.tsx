'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { GeminiModel, ResearchDepth } from '@/lib/types';

const CATEGORY_EXAMPLES = [
  '100円ショップ', '軽トラ', '生命保険', '事務用品', '中古家電',
  '不動産', 'コンビニ', 'ファストフード', '文房具', 'ドラッグストア',
];

export default function HomePage() {
  const router = useRouter();
  const [productName, setProductName] = useState('');
  const [category, setCategory] = useState('');
  const [challenges, setChallenges] = useState('');
  const [model, setModel] = useState<GeminiModel>('gemini-3-flash-preview');
  const [researchDepth, setResearchDepth] = useState<ResearchDepth>('standard');
  const [isLoading, setIsLoading] = useState(false);

  const isValid = productName.trim() && category.trim() && challenges.trim();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid || isLoading) return;

    setIsLoading(true);

    // Store input and navigate to results page
    const input = { productName, category, challenges, model, researchDepth };
    sessionStorage.setItem('prism-input', JSON.stringify(input));
    router.push('/results');
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px 120px' }}>

      {/* Hero */}
      <div style={{ textAlign: 'center', marginBottom: 64 }}>
        <h1 className="prism-text" style={{
          fontSize: 'clamp(36px, 6vw, 56px)',
          fontWeight: 900,
          lineHeight: 1.1,
          marginBottom: 20,
          letterSpacing: '-0.02em',
        }}>
          社会言語を、<br />結晶化する。
        </h1>
        <p style={{
          fontSize: 16,
          lineHeight: 1.8,
          color: 'var(--text-secondary)',
          maxWidth: 500,
          margin: '0 auto',
        }}>
          SNS上の混沌としたノイズを通過させることで、<br />
          市場を再定義する美しい切り口として結晶化する。
        </p>
      </div>

      {/* How it works */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 56,
      }}>
        {[
          { num: '01', label: 'Deep Listening', desc: '生の声を聴取', color: 'var(--spectrum-red)' },
          { num: '02', label: 'Social Language', desc: '社会言語を開発', color: 'var(--spectrum-cyan)' },
          { num: '03', label: 'Evidence Design', desc: '調査を設計', color: 'var(--spectrum-green)' },
          { num: '04', label: 'Output', desc: 'レポートを生成', color: 'var(--spectrum-violet)' },
        ].map((step) => (
          <div key={step.num} className="glass-card" style={{
            padding: '20px 16px',
            textAlign: 'center',
          }}>
            <div style={{
              fontSize: 24,
              fontWeight: 800,
              color: step.color,
              marginBottom: 8,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {step.num}
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: 4,
            }}>
              {step.label}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              {step.desc}
            </div>
          </div>
        ))}
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit}>
        <div className="glass-card" style={{ padding: 36 }}>
          <h2 style={{
            fontSize: 18,
            fontWeight: 700,
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{ color: 'var(--spectrum-violet)' }}>◇</span>
            プロジェクト入力
          </h2>

          {/* Product Name */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}>
              対象商材 / サービス名
            </label>
            <input
              id="input-product-name"
              type="text"
              className="prism-input"
              placeholder="例：ダイソー、スズキ キャリイ、LIXIL..."
              value={productName}
              onChange={e => setProductName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div style={{ marginBottom: 24 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}>
              カテゴリ
            </label>
            <input
              id="input-category"
              type="text"
              className="prism-input"
              placeholder="例：100円ショップ、軽トラ、生命保険..."
              value={category}
              onChange={e => setCategory(e.target.value)}
            />
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              marginTop: 10,
            }}>
              {CATEGORY_EXAMPLES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  style={{
                    padding: '4px 12px',
                    fontSize: 12,
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: category === cat
                      ? 'rgba(153, 51, 255, 0.2)'
                      : 'transparent',
                    color: category === cat
                      ? 'var(--spectrum-violet)'
                      : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit',
                  }}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Challenges */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 8,
            }}>
              現状の課題 / 特徴
            </label>
            <textarea
              id="input-challenges"
              className="prism-input"
              placeholder="箇条書きレベルのラフな情報でOKです。&#10;例：&#10;・安いだけと思われがち&#10;・ブランド価値が見えにくい&#10;・実はプロも使っている"
              value={challenges}
              onChange={e => setChallenges(e.target.value)}
            />
          </div>

          {/* Model Selection */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 12,
            }}>
              分析エンジン
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                {
                  id: 'gemini-3-flash-preview' as GeminiModel,
                  name: 'Gemini 3 Flash',
                  badge: 'おすすめ',
                  badgeColor: 'var(--spectrum-cyan)',
                  time: '約40秒',
                  cost: '約0.5円',
                  desc: '高速＆高品質。通常の分析に最適',
                },
                {
                  id: 'gemini-3-pro-preview' as GeminiModel,
                  name: 'Gemini 3 Pro',
                  badge: '高精度',
                  badgeColor: 'var(--spectrum-violet)',
                  time: '約2〜3分',
                  cost: '約3円',
                  desc: '最高精度。深い洞察が必要な案件向け',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModel(m.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 14,
                    padding: '14px 18px',
                    borderRadius: 'var(--radius-md)',
                    border: model === m.id
                      ? `1px solid ${m.badgeColor}`
                      : '1px solid var(--border-subtle)',
                    background: model === m.id
                      ? `${m.badgeColor}10`
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                >
                  {/* Radio dot */}
                  <div style={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    border: model === m.id
                      ? `2px solid ${m.badgeColor}`
                      : '2px solid var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {model === m.id && (
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: m.badgeColor,
                      }} />
                    )}
                  </div>
                  {/* Content */}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                        {m.name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 8px',
                        borderRadius: 'var(--radius-sm)',
                        background: `${m.badgeColor}20`,
                        color: m.badgeColor,
                        letterSpacing: '0.03em',
                      }}>
                        {m.badge}
                      </span>
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {m.desc}
                    </div>
                    <div style={{
                      fontSize: 11,
                      color: 'var(--text-muted)',
                      marginTop: 4,
                      display: 'flex',
                      gap: 16,
                    }}>
                      <span>⏱ {m.time}</span>
                      <span>💰 {m.cost}/回</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Research Depth */}
          <div style={{ marginBottom: 32 }}>
            <label style={{
              display: 'block',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-secondary)',
              marginBottom: 12,
            }}>
              リサーチ深度
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              {[
                {
                  id: 'standard' as ResearchDepth,
                  name: 'Standard',
                  badge: '高速',
                  badgeColor: 'var(--spectrum-cyan)',
                  time: '約40秒',
                  cost: '約2〜3円',
                  desc: 'Google検索のサマリーから分析',
                },
                {
                  id: 'deep' as ResearchDepth,
                  name: 'Deep Research',
                  badge: '高精度',
                  badgeColor: 'var(--spectrum-green)',
                  time: '約1〜2分',
                  cost: '約5円',
                  desc: '実際のWebページを読み込んで深く分析',
                },
              ].map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setResearchDepth(d.id)}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    padding: '14px 12px',
                    borderRadius: 'var(--radius-md)',
                    border: researchDepth === d.id
                      ? `1px solid ${d.badgeColor}`
                      : '1px solid var(--border-subtle)',
                    background: researchDepth === d.id
                      ? `${d.badgeColor}10`
                      : 'transparent',
                    cursor: 'pointer',
                    textAlign: 'center',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {d.name}
                    </span>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '2px 6px',
                      borderRadius: 'var(--radius-sm)',
                      background: `${d.badgeColor}20`,
                      color: d.badgeColor,
                    }}>
                      {d.badge}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                    {d.desc}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', display: 'flex', gap: 10 }}>
                    <span>⏱ {d.time}</span>
                    <span>💰 {d.cost}/回</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            id="btn-submit"
            type="submit"
            className="btn-prism"
            disabled={!isValid || isLoading}
            style={{ width: '100%', fontSize: 16, padding: '16px 32px' }}
          >
            {isLoading ? (
              <>
                <div className="prism-loader" style={{ width: 20, height: 20, borderWidth: 2 }} />
                解析準備中...
              </>
            ) : (
              '◈ 解析を開始する'
            )}
          </button>
        </div>
      </form>

      {/* Concept Note */}
      <div style={{
        marginTop: 48,
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: 12,
        lineHeight: 1.8,
      }}>
        <p>
          <strong style={{ color: 'var(--text-secondary)' }}>PRISM</strong> — Public Resonance & Insight Synthesis Module
          <br />
          <span style={{ fontSize: 11, opacity: 0.7 }}>大衆の共鳴とインサイトの統合モジュール</span>
        </p>
        <p style={{ marginTop: 4 }}>
          プリズムが光を解くように、<br />
          混沌としたSNSのノイズから美しい社会言語を取り出す。
        </p>
      </div>
    </div>
  );
}
