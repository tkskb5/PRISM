'use client';

import Link from 'next/link';
import './globals.css';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <head>
        <title>PRISM — 社会言語開発モジュール</title>
        <meta name="description" content="Public Resonance & Insight Synthesis Module: SNS上のノイズから美しい社会言語を結晶化する。" />
      </head>
      <body>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
          {/* Header */}
          <header style={{
            padding: '16px 32px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backdropFilter: 'blur(12px)',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            background: 'rgba(5, 5, 16, 0.85)',
          }}>
            <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
              <span style={{ fontSize: '24px' }}>◈</span>
              <span className="prism-text" style={{
                fontSize: '20px',
                fontWeight: 800,
                letterSpacing: '0.08em',
              }}>
                PRISM
              </span>
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                letterSpacing: '0.05em',
                display: 'flex',
                flexDirection: 'column',
                lineHeight: 1.4,
              }}>
                <span>Public Resonance & Insight Synthesis Module</span>
                <span style={{ fontSize: '10px', opacity: 0.7 }}>大衆の共鳴とインサイトの統合モジュール</span>
              </span>
            </Link>
            <nav style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Link href="/history" style={navLinkStyle}>📋 履歴</Link>
              <Link href="/settings" style={navLinkStyle}>⚙️ 設定</Link>
              <span style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                letterSpacing: '0.02em',
              }}>
                by Antigravity
              </span>
            </nav>
          </header>

          {/* Main */}
          <main style={{ flex: 1 }}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: '13px',
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  padding: '6px 12px',
  borderRadius: 8,
  transition: 'all 0.2s',
  border: '1px solid transparent',
};

