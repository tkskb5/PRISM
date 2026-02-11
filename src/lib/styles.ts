// ============================================================
// PRISM — Shared UI Styles
// ============================================================

/** Standard link/action button style (ghost button) */
export const linkBtnStyle: React.CSSProperties = {
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

/** Danger variant of linkBtnStyle */
export const dangerBtnStyle: React.CSSProperties = {
    ...linkBtnStyle,
    color: '#ff6b6b',
    borderColor: 'rgba(255,107,107,0.3)',
};

/** Section container style */
export const sectionStyle: React.CSSProperties = {
    marginTop: 16,
    padding: '12px 16px',
    borderRadius: 8,
    background: 'rgba(255,255,255,0.02)',
    border: '1px solid var(--border-subtle)',
};

/** Section title style */
export const sectionTitleStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 8px',
};
