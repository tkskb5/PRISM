// ============================================================
// PRISM — localStorage Storage Utilities
// ============================================================

import type { HistoryEntry, PrismInput, PrismResult, CustomPrompts } from './types';

const HISTORY_KEY = 'prism-history';
const PROMPTS_KEY = 'prism-prompts';
const MAX_HISTORY = 50;

// ── History ──

export function getHistory(): HistoryEntry[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = localStorage.getItem(HISTORY_KEY);
        return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
    } catch {
        return [];
    }
}

export function saveHistory(input: PrismInput, result: PrismResult): void {
    const entry: HistoryEntry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        input,
        result,
    };
    const history = getHistory();
    history.unshift(entry); // newest first
    if (history.length > MAX_HISTORY) history.length = MAX_HISTORY;
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function deleteHistoryEntry(id: string): void {
    const history = getHistory().filter((e) => e.id !== id);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
}

export function clearHistory(): void {
    localStorage.removeItem(HISTORY_KEY);
}

// ── Custom Prompts ──

export function getCustomPrompts(): CustomPrompts | null {
    if (typeof window === 'undefined') return null;
    try {
        const raw = localStorage.getItem(PROMPTS_KEY);
        return raw ? (JSON.parse(raw) as CustomPrompts) : null;
    } catch {
        return null;
    }
}

export function saveCustomPrompts(prompts: CustomPrompts): void {
    localStorage.setItem(PROMPTS_KEY, JSON.stringify(prompts));
}

export function resetCustomPrompts(): void {
    localStorage.removeItem(PROMPTS_KEY);
}
