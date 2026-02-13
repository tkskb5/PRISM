// ============================================================
// PRISM — Supabase Storage Utilities
// ============================================================

import { supabase } from './supabase';
import type { HistoryEntry, PrismInput, PrismResult, CustomPrompts } from './types';

const MAX_HISTORY = 50;

// ── History ──

export async function getHistory(): Promise<HistoryEntry[]> {
    const { data, error } = await supabase
        .from('prism_history')
        .select('id, created_at, input, result')
        .order('created_at', { ascending: false })
        .limit(MAX_HISTORY);

    if (error) {
        console.error('[PRISM Storage] getHistory error:', error.message);
        return [];
    }

    return (data ?? []).map((row) => ({
        id: row.id,
        timestamp: row.created_at,
        input: row.input as PrismInput,
        result: row.result as PrismResult,
    }));
}

export async function saveHistory(input: PrismInput, result: PrismResult): Promise<void> {
    const { error } = await supabase
        .from('prism_history')
        .insert({ input, result });

    if (error) {
        console.error('[PRISM Storage] saveHistory error:', error.message);
    }
}

export async function deleteHistoryEntry(id: string): Promise<void> {
    const { error } = await supabase
        .from('prism_history')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('[PRISM Storage] deleteHistoryEntry error:', error.message);
    }
}

export async function clearHistory(): Promise<void> {
    const { error } = await supabase
        .from('prism_history')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

    if (error) {
        console.error('[PRISM Storage] clearHistory error:', error.message);
    }
}

// ── Custom Prompts ──

export async function getCustomPrompts(): Promise<CustomPrompts | null> {
    const { data, error } = await supabase
        .from('prism_custom_prompts')
        .select('*')
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('[PRISM Storage] getCustomPrompts error:', error.message);
        return null;
    }

    if (!data) return null;

    return {
        systemPrompt: data.system_prompt,
        phase1Template: data.phase1_template,
        phase2Template: data.phase2_template,
        phase3Template: data.phase3_template,
        phase4Template: data.phase4_template,
    };
}

export async function saveCustomPrompts(prompts: CustomPrompts): Promise<void> {
    // 既存レコードがあるか確認
    const { data: existing } = await supabase
        .from('prism_custom_prompts')
        .select('id')
        .limit(1)
        .maybeSingle();

    const row = {
        system_prompt: prompts.systemPrompt,
        phase1_template: prompts.phase1Template,
        phase2_template: prompts.phase2Template,
        phase3_template: prompts.phase3Template,
        phase4_template: prompts.phase4Template,
        updated_at: new Date().toISOString(),
    };

    if (existing?.id) {
        const { error } = await supabase
            .from('prism_custom_prompts')
            .update(row)
            .eq('id', existing.id);
        if (error) console.error('[PRISM Storage] saveCustomPrompts update error:', error.message);
    } else {
        const { error } = await supabase
            .from('prism_custom_prompts')
            .insert(row);
        if (error) console.error('[PRISM Storage] saveCustomPrompts insert error:', error.message);
    }
}

export async function resetCustomPrompts(): Promise<void> {
    const { error } = await supabase
        .from('prism_custom_prompts')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // delete all rows

    if (error) {
        console.error('[PRISM Storage] resetCustomPrompts error:', error.message);
    }
}
