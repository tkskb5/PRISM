// ============================================================
// PRISM — Analysis API Route (SSE Streaming)
// ============================================================

import { generateJSON, multiGroundedResearch, deepResearchContent, fetchActualTitles } from '@/lib/gemini';
import {
    buildPhase1Prompt,
    buildPhase2Prompt,
    buildPhase3Prompt,
    buildPhase4Prompt,
    buildPhase4aPrompt,
    buildPhase4bPrompt,
    buildPhase4cPrompt,
    buildMultiGroundingPrompts,
    buildDeepResearchPhase1Prompt,
    DEFAULT_SYSTEM_PROMPT,
} from '@/lib/prompts';
import type {
    PrismInput,
    GeminiModel,
    ResearchDepth,
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
    const researchDepth: ResearchDepth = input.researchDepth === 'deep' ? 'deep' : 'standard';

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
                //   Standard: multi-angle grounding + JSON structuring
                //   Deep Research: grounding + URL Context for full page reading
                // ────────────────────────────────────────────
                let phase1: DeepListeningResult;
                let groundingSources: { title: string; url: string }[] = [];

                if (researchDepth === 'deep') {
                    // ── Deep Research Mode ──
                    send({ type: 'progress', phase: 1, percent: 2, message: 'Phase 1 [Deep]: 5角度のGoogle検索でソースを探索中...' });

                    const groundingPrompts = buildMultiGroundingPrompts(input);
                    const analysisPrompt = buildDeepResearchPhase1Prompt(input, prompts?.phase1Template);

                    const deepResult = await deepResearchContent(
                        groundingPrompts,
                        analysisPrompt,
                        modelId,
                        systemPrompt,
                        (msg) => send({ type: 'progress', phase: 1, percent: 8, message: `Phase 1 [Deep]: ${msg}` }),
                    );

                    groundingSources = deepResult.allSources;
                    send({ type: 'progress', phase: 1, percent: 14, message: `Phase 1 [Deep]: ${groundingSources.length}件のソースからJSON構造化中...` });

                    // deepResearchContent already returns JSON-formatted text via responseMimeType
                    try {
                        phase1 = JSON.parse(deepResult.combinedText);
                    } catch {
                        // Fallback: if URL Context response isn't valid JSON, re-generate
                        const sourceRefList = groundingSources
                            .map((src, i) => `[${i + 1}] ${src.title} — ${src.url}`)
                            .join('\n');
                        const fallbackPrompt = buildDeepResearchPhase1Prompt(input)
                            + `\n\n【Webページ分析結果】\n${deepResult.combinedText}`
                            + `\n\n【出典URLリスト】\n${sourceRefList}`;
                        phase1 = await generateJSON<DeepListeningResult>(fallbackPrompt, modelId, systemPrompt);
                    }
                } else {
                    // ── Standard Mode ──
                    send({ type: 'progress', phase: 1, percent: 2, message: 'Phase 1: 5つの角度からGoogle検索で生活者のリアルな声を調査中...' });

                    const groundingPrompts = buildMultiGroundingPrompts(input);
                    const multiResult = await multiGroundedResearch(groundingPrompts, modelId, systemPrompt);

                    groundingSources = multiResult.allSources;
                    send({ type: 'progress', phase: 1, percent: 10, message: `Phase 1: ${groundingSources.length}件のソースから声を分析・構造化中...` });

                    const segmentRef = multiResult.allSegments
                        .map((seg, i) => {
                            const srcInfo = seg.sources.map(s => `${s.title} (${s.url})`).join(', ');
                            return `[セグメント${i + 1}] ${seg.text.substring(0, 200)}...\n  → 出典: ${srcInfo}`;
                        })
                        .join('\n\n');
                    const sourceRefList = groundingSources
                        .map((src, i) => `[${i + 1}] ${src.title} — ${src.url}`)
                        .join('\n');

                    const phase1Prompt = buildPhase1Prompt(input, prompts?.phase1Template)
                        + `\n\n【参考: Google検索による実際の生活者の声（5つの検索角度から収集）】\n${multiResult.combinedText}`
                        + `\n\n【ソース別テキストセグメント（各声のsourceUrl指定に使用）】\n${segmentRef}`
                        + `\n\n【出典URLリスト（sourceUrlにはこのリストのURLのみを使用すること）】\n${sourceRefList}`;
                    phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);
                }

                // Fetch actual page titles from URLs (parallel, non-blocking)
                send({ type: 'progress', phase: 1, percent: 16, message: 'Phase 1: ソースページの正式タイトルを取得中...' });
                groundingSources = await fetchActualTitles(groundingSources);

                // Build a URL→title map for correcting voice-level sourceTitle
                const titleMap = new Map(groundingSources.map(s => [s.url, s.title]));
                const correctTitles = (voices: (string | { text: string; sourceUrl?: string; sourceTitle?: string })[]): { text: string; sourceUrl?: string; sourceTitle?: string }[] => {
                    return voices.map(v => {
                        const item = typeof v === 'string' ? { text: v } : v;
                        if (item.sourceUrl && titleMap.has(item.sourceUrl)) {
                            return { ...item, sourceTitle: titleMap.get(item.sourceUrl) };
                        }
                        return item;
                    });
                };
                phase1 = {
                    ...phase1,
                    positiveHacks: correctTitles(phase1.positiveHacks),
                    negativePains: correctTitles(phase1.negativePains),
                };

                send({ type: 'progress', phase: 1, percent: 18, message: `Phase 1: Deep Listening 完了 ✓${researchDepth === 'deep' ? ' [Deep Research]' : ''}` });
                send({ type: 'phase_result', phase: 1, data: phase1, groundingSources });

                const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${typeof h === 'string' ? h : h.text}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${typeof p === 'string' ? p : p.text}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

                // ────────────────────────────────────────────
                // Phase 2: Social Language Development (~8%)
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 2, percent: 14, message: 'Phase 2: Social Language — 社会言語を開発中...' });

                const phase2Prompt = buildPhase2Prompt(input, phase1Summary, prompts?.phase2Template);
                const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 2, percent: 22, message: 'Phase 2: Social Language 完了 ✓' });
                send({ type: 'phase_result', phase: 2, data: phase2 });

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
                send({ type: 'phase_result', phase: 3, data: phase3 });

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
                        groundingSources,
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
