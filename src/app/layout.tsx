import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRISM — 社会言語開発モジュール",
  description:
    "Public Resonance & Insight Synthesis Module: SNS上のノイズから美しい社会言語を結晶化する。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              }}>
                Social Language Module
              </span>
            </div>
            <div style={{
              fontSize: '12px',
              color: 'var(--text-muted)',
              letterSpacing: '0.02em',
            }}>
              by Antigravity
            </div>
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
