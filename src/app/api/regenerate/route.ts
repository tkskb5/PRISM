// ============================================================
// PRISM — Regenerate API Route (Social Language Iteration)
// ============================================================
//
// Two actions:
//   1. "add-languages"     — Generate 3 additional social language candidates
//   2. "regenerate-phases" — Re-run Phase 3+4 with selected social languages (SSE)

import { generateJSON } from '@/lib/gemini';
import {
    buildPhase2AdditionalPrompt,
    buildPhase3Prompt,
    buildPhase4aPrompt,
    buildPhase4bPrompt,
    buildPhase4cPrompt,
    DEFAULT_SYSTEM_PROMPT,
} from '@/lib/prompts';
import type {
    PrismInput,
    GeminiModel,
    SocialLanguage,
    SurveyDesign,
    OutputGeneration,
    CustomPrompts,
} from '@/lib/types';

export const maxDuration = 120; // 2 minutes max for regeneration
export const dynamic = 'force-dynamic';

const VALID_MODELS: GeminiModel[] = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];

interface RegenerateRequest {
    action: 'add-languages' | 'regenerate-phases';
    input: PrismInput;
    phase1Summary: string;
    modelId?: GeminiModel;
    customPrompts?: CustomPrompts;
    // add-languages specific
    existingKeywords?: string[];
    direction?: string;
    // regenerate-phases specific
    selectedLanguages?: SocialLanguage[];
    marketRedefinition?: string;
}

export async function POST(request: Request) {
    let body: RegenerateRequest;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: '不正なリクエストです。' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    const { action, input, phase1Summary, customPrompts } = body;
    const modelId: GeminiModel = VALID_MODELS.includes(body.modelId as GeminiModel)
        ? (body.modelId as GeminiModel)
        : 'gemini-3-flash-preview';
    const systemPrompt = customPrompts?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    if (!input?.productName || !phase1Summary) {
        return new Response(
            JSON.stringify({ error: '必要なデータが不足しています。' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // ── Action: Add Languages ──
    if (action === 'add-languages') {
        try {
            const prompt = buildPhase2AdditionalPrompt(
                input,
                phase1Summary,
                body.existingKeywords || [],
                body.direction,
            );
            const newLanguages = await generateJSON<SocialLanguage[]>(prompt, modelId, systemPrompt);
            return new Response(
                JSON.stringify({ languages: newLanguages }),
                { status: 200, headers: { 'Content-Type': 'application/json' } },
            );
        } catch (error) {
            console.error('Add Languages Error:', error);
            return new Response(
                JSON.stringify({ error: error instanceof Error ? error.message : '社会言語の追加生成に失敗しました。' }),
                { status: 500, headers: { 'Content-Type': 'application/json' } },
            );
        }
    }

    // ── Action: Regenerate Phases 3+4 ──
    if (action === 'regenerate-phases') {
        if (!body.selectedLanguages || body.selectedLanguages.length !== 3) {
            return new Response(
                JSON.stringify({ error: '3つの社会言語を選択してください。' }),
                { status: 400, headers: { 'Content-Type': 'application/json' } },
            );
        }

        const encoder = new TextEncoder();
        const stream = new ReadableStream({
            async start(controller) {
                const send = (data: Record<string, unknown>) => {
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
                };

                try {
                    const selected = body.selectedLanguages!;
                    const socialLanguagesSummary = selected
                        .map((sl, i) => `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`)
                        .join('\n\n');

                    // Phase 3: Evidence Design
                    send({ type: 'progress', percent: 10, message: 'Phase 3: 選択した3案で調査設計中...' });

                    const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary, customPrompts?.phase3Template);
                    const phase3 = await generateJSON<SurveyDesign>(phase3Prompt, modelId, systemPrompt);

                    send({ type: 'progress', percent: 30, message: 'Phase 3: 調査設計完了 ✓' });
                    send({ type: 'phase_result', phase: 3, data: phase3 });

                    const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

                    // Phase 4a: Report Summary
                    send({ type: 'progress', percent: 40, message: 'Phase 4: 調査レポートサマリを生成中...' });
                    const phase4aPrompt = buildPhase4aPrompt(input, phase1Summary, socialLanguagesSummary, surveyDesignSummary);
                    const phase4a = await generateJSON<{ reportSummary: string }>(phase4aPrompt, modelId, systemPrompt);
                    send({ type: 'progress', percent: 60, message: 'Phase 4: 調査レポートサマリ完了 ✓' });

                    // Phase 4b: Press Release
                    send({ type: 'progress', percent: 65, message: 'Phase 4: プレスリリース記事を生成中...' });
                    const marketRedefinition = body.marketRedefinition || '';
                    const phase4bPrompt = buildPhase4bPrompt(input, marketRedefinition, socialLanguagesSummary);
                    const phase4b = await generateJSON<{ pressRelease: string }>(phase4bPrompt, modelId, systemPrompt);
                    send({ type: 'progress', percent: 80, message: 'Phase 4: プレスリリース完了 ✓' });

                    // Phase 4c: Positioning + Headline
                    send({ type: 'progress', percent: 85, message: 'Phase 4: ポジショニング提案 & 見出しを生成中...' });
                    const phase4cPrompt = buildPhase4cPrompt(input, socialLanguagesSummary);
                    const phase4c = await generateJSON<{ positioning: string; newsHeadline: string }>(phase4cPrompt, modelId, systemPrompt);
                    send({ type: 'progress', percent: 100, message: 'Phase 3+4: 再生成完了 ✓' });

                    const phase4: OutputGeneration = {
                        reportSummary: phase4a.reportSummary,
                        pressRelease: phase4b.pressRelease,
                        positioning: phase4c.positioning,
                        newsHeadline: phase4c.newsHeadline,
                    };

                    send({
                        type: 'result',
                        data: {
                            selectedLanguages: selected,
                            phase3,
                            phase4,
                        },
                    });
                } catch (error) {
                    console.error('Regenerate Phases Error:', error);
                    send({
                        type: 'error',
                        error: error instanceof Error ? error.message : 'Phase 3+4の再生成に失敗しました。',
                    });
                } finally {
                    controller.close();
                }
            },
        });

        return new Response(stream, {
            headers: {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            },
        });
    }

    return new Response(
        JSON.stringify({ error: '不明なアクションです。' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
}
