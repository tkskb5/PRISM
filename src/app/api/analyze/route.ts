// ============================================================
// PRISM — Analysis API Route (SSE Streaming)
// ============================================================

import { generateJSON } from '@/lib/gemini';
import {
    buildPhase1Prompt,
    buildPhase2Prompt,
    buildPhase3Prompt,
    buildPhase4Prompt,
    DEFAULT_SYSTEM_PROMPT,
} from '@/lib/prompts';
import type {
    PrismInput,
    GeminiModel,
    CustomPrompts,
    DeepListeningResult,
    SocialLanguage,
    SurveyDesign,
    OutputGeneration,
} from '@/lib/types';

const VALID_MODELS: GeminiModel[] = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];

interface AnalyzeRequest {
    input: PrismInput;
    customPrompts?: CustomPrompts;
}

/**
 * SSE streaming endpoint — sends progress events as each phase completes.
 *
 * Event format: `data: { "type": "progress"|"result"|"error", ... }\n\n`
 *
 * Progress events include `phase` (1-4), `percent` (0-100), and `message`.
 * The final `result` event includes the full PrismResult.
 */
export async function POST(request: Request) {
    let body: AnalyzeRequest;
    try {
        body = await request.json();
    } catch {
        return new Response(
            JSON.stringify({ error: '不正なリクエストです。' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    const input = body.input ?? body as unknown as PrismInput;
    const prompts = body.customPrompts;

    // Validate input
    if (!input.productName || !input.category || !input.challenges) {
        return new Response(
            JSON.stringify({ error: '商材名、カテゴリ、課題のすべてを入力してください。' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    // Validate model
    const modelId: GeminiModel = VALID_MODELS.includes(input.model as GeminiModel)
        ? (input.model as GeminiModel)
        : 'gemini-3-flash-preview';

    const systemPrompt = prompts?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    // Create SSE stream
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // ── Phase 1: Deep Listening & Insight ──
                send({ type: 'progress', phase: 1, percent: 5, message: 'Phase 1: Deep Listening — 生活者の声を聴取中...' });

                const phase1Prompt = buildPhase1Prompt(input, prompts?.phase1Template);
                const phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 1, percent: 25, message: 'Phase 1 完了 ✓' });

                const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${h}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${p}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

                // ── Phase 2: Social Language Development ──
                send({ type: 'progress', phase: 2, percent: 30, message: 'Phase 2: Social Language — 社会言語を開発中...' });

                const phase2Prompt = buildPhase2Prompt(input, phase1Summary, prompts?.phase2Template);
                const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 2, percent: 50, message: 'Phase 2 完了 ✓' });

                const socialLanguagesSummary = phase2
                    .map((sl, i) => `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`)
                    .join('\n\n');

                // ── Phase 3: Evidence Design ──
                send({ type: 'progress', phase: 3, percent: 55, message: 'Phase 3: Evidence Design — 調査設計中...' });

                const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary, prompts?.phase3Template);
                const phase3 = await generateJSON<SurveyDesign>(phase3Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 3, percent: 75, message: 'Phase 3 完了 ✓' });

                const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

                // ── Phase 4: Output Generation ──
                send({ type: 'progress', phase: 4, percent: 78, message: 'Phase 4: Output — レポート・プレスリリースを生成中...' });

                const phase4Prompt = buildPhase4Prompt(
                    input,
                    phase1Summary,
                    socialLanguagesSummary,
                    surveyDesignSummary,
                    prompts?.phase4Template,
                );
                const phase4 = await generateJSON<OutputGeneration>(phase4Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 4, percent: 100, message: 'Phase 4 完了 ✓' });

                // ── Send final result ──
                send({
                    type: 'result',
                    data: {
                        input,
                        phase1,
                        phase2,
                        phase3,
                        phase4,
                    },
                });
            } catch (error) {
                console.error('PRISM Analysis Error:', error);
                send({
                    type: 'error',
                    error: error instanceof Error ? error.message : 'Unknown error occurred',
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
