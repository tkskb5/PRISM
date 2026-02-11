// ============================================================
// PRISM — Analysis API Route (SSE Streaming)
// ============================================================

import { generateJSON, generateGroundedContent } from '@/lib/gemini';
import {
    buildPhase1Prompt,
    buildPhase2Prompt,
    buildPhase3Prompt,
    buildPhase4Prompt,
    buildPhase4aPrompt,
    buildPhase4bPrompt,
    buildPhase4cPrompt,
    buildGroundingPrompt,
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
 * Phase 1 uses Google Search grounding for real consumer voice data.
 * Phase 4 is split into 3 sub-calls for granular progress.
 * Percentages are weighted by estimated processing time.
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

    if (!input.productName || !input.category || !input.challenges) {
        return new Response(
            JSON.stringify({ error: '商材名、カテゴリ、課題のすべてを入力してください。' }),
            { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
    }

    const modelId: GeminiModel = VALID_MODELS.includes(input.model as GeminiModel)
        ? (input.model as GeminiModel)
        : 'gemini-3-flash-preview';

    const systemPrompt = prompts?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };

            try {
                // ────────────────────────────────────────────
                // Phase 1: Deep Listening & Insight (~18%)
                //   Step 1: Google Search grounded research
                //   Step 2: Structure into JSON
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 1, percent: 2, message: 'Phase 1: Google検索で生活者のリアルな声を調査中...' });

                // Step 1: Grounded research — searches the real web
                const groundingPrompt = buildGroundingPrompt(input);
                const groundedResult = await generateGroundedContent(groundingPrompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 1, percent: 10, message: 'Phase 1: 調査データを分析・構造化中...' });

                // Step 2: Structure the grounded data into JSON
                const phase1Prompt = buildPhase1Prompt(input, prompts?.phase1Template)
                    + `\n\n【参考: Google検索による実際の生活者の声】\n${groundedResult.text}`;
                const phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 1, percent: 18, message: 'Phase 1: Deep Listening 完了 ✓' });

                const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${h}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${p}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

                // ────────────────────────────────────────────
                // Phase 2: Social Language Development (~8%)
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 2, percent: 14, message: 'Phase 2: Social Language — 社会言語を開発中...' });

                const phase2Prompt = buildPhase2Prompt(input, phase1Summary, prompts?.phase2Template);
                const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 2, percent: 22, message: 'Phase 2: Social Language 完了 ✓' });

                const socialLanguagesSummary = phase2
                    .map((sl, i) => `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`)
                    .join('\n\n');

                // ────────────────────────────────────────────
                // Phase 3: Evidence Design (~8%)
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 3, percent: 24, message: 'Phase 3: Evidence Design — 調査設計中...' });

                const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary, prompts?.phase3Template);
                const phase3 = await generateJSON<SurveyDesign>(phase3Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 3, percent: 30, message: 'Phase 3: Evidence Design 完了 ✓' });

                const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

                // ────────────────────────────────────────────
                // Phase 4: Output Generation (~70% — split into 3 sub-calls)
                // ────────────────────────────────────────────

                let phase4: OutputGeneration;

                // If user has a custom Phase 4 template, use it as-is (single call)
                if (prompts?.phase4Template) {
                    send({ type: 'progress', phase: 4, percent: 32, message: 'Phase 4: Output — カスタムテンプレートで生成中...' });

                    const phase4Prompt = buildPhase4Prompt(
                        input, phase1Summary, socialLanguagesSummary, surveyDesignSummary,
                        prompts.phase4Template,
                    );
                    phase4 = await generateJSON<OutputGeneration>(phase4Prompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: 100, message: 'Phase 4: Output 完了 ✓' });
                } else {
                    // ── Phase 4a: Report Summary (~25%) ──
                    send({ type: 'progress', phase: 4, percent: 32, message: 'Phase 4: 調査レポートサマリを生成中...' });

                    const phase4aPrompt = buildPhase4aPrompt(input, phase1Summary, socialLanguagesSummary, surveyDesignSummary);
                    const phase4a = await generateJSON<{ reportSummary: string }>(phase4aPrompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: 58, message: 'Phase 4: 調査レポートサマリ完了 ✓' });

                    // ── Phase 4b: Press Release (~22%) ──
                    send({ type: 'progress', phase: 4, percent: 60, message: 'Phase 4: プレスリリース記事を生成中...' });

                    const phase4bPrompt = buildPhase4bPrompt(input, phase1.marketRedefinition, socialLanguagesSummary);
                    const phase4b = await generateJSON<{ pressRelease: string }>(phase4bPrompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: 82, message: 'Phase 4: プレスリリース完了 ✓' });

                    // ── Phase 4c: Positioning + Headline (~18%) ──
                    send({ type: 'progress', phase: 4, percent: 84, message: 'Phase 4: ポジショニング提案 & 見出しを生成中...' });

                    const phase4cPrompt = buildPhase4cPrompt(input, socialLanguagesSummary);
                    const phase4c = await generateJSON<{ positioning: string; newsHeadline: string }>(phase4cPrompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: 100, message: 'Phase 4: 全アウトプット完了 ✓' });

                    phase4 = {
                        reportSummary: phase4a.reportSummary,
                        pressRelease: phase4b.pressRelease,
                        positioning: phase4c.positioning,
                        newsHeadline: phase4c.newsHeadline,
                    };
                }

                // ── Send final result ──
                send({
                    type: 'result',
                    data: {
                        input,
                        phase1,
                        phase2,
                        phase3,
                        phase4,
                        groundingSources: groundedResult.sources,
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
