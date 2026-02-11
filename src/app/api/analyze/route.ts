// ============================================================
// PRISM — Analysis API Route (SSE Streaming)
// ============================================================

import { generateJSON, multiGroundedResearch, deepResearchContent, fetchActualTitles, interactionsDeepResearch } from '@/lib/gemini';
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
    buildManualPhase1Prompt,
    buildApiDeepResearchPrompt,
    buildApiDeepResearchPhase1Prompt,
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
    VoiceItem,
} from '@/lib/types';

// Route segment configuration — extend timeout for long-running analysis
export const maxDuration = 300; // 5 minutes (Pro model + grounding can take 2-4 min)
export const dynamic = 'force-dynamic';

const VALID_MODELS: GeminiModel[] = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];

// Known trusted URL domains from Google's grounding infrastructure
const TRUSTED_URL_PATTERNS = [
    'vertexaisearch.cloud.google.com/grounding-api-redirect/',
];
const isTrustedUrl = (url: string) =>
    TRUSTED_URL_PATTERNS.some(pattern => url.includes(pattern));

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
    const researchDepth: ResearchDepth = (['deep', 'manual', 'api-deep-research'] as ResearchDepth[]).includes(input.researchDepth as ResearchDepth)
        ? (input.researchDepth as ResearchDepth)
        : 'standard';

    const systemPrompt = prompts?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            const send = (data: Record<string, unknown>) => {
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
            };
            const debugLog = (label: string, content: unknown) => {
                send({ type: 'debug_log', timestamp: new Date().toISOString(), label, content });
            };

            try {
                const analysisStartTime = Date.now();
                const phaseTimings: Record<string, number> = {};
                let phaseStartTime = Date.now();
                debugLog('⏱ 分析開始', { モード: researchDepth, モデル: modelId, 開始時刻: new Date().toLocaleTimeString('ja-JP') });

                // Mode-specific progress milestones based on actual timing data
                // API Deep Research (673s): P1=80%, P2=6%, P3=3%, P4=11%
                // Standard       (~120s):  P1=50%, P2=15%, P3=10%, P4=25%
                // Deep Research  (~180s):  P1=60%, P2=12%, P3=8%,  P4=20%
                // Manual          (~60s):  P1=20%, P2=25%, P3=15%, P4=40%
                const pct = researchDepth === 'api-deep-research'
                    ? { p1Start: 1, p1Mid: 40, p1Struct: 70, p1Done: 80, p2Start: 81, p2Done: 86, p3Start: 87, p3Done: 89, p4Start: 90, p4a: 93, p4b: 96, p4c: 98 }
                    : researchDepth === 'deep'
                        ? { p1Start: 2, p1Mid: 20, p1Struct: 45, p1Done: 60, p2Start: 61, p2Done: 72, p3Start: 73, p3Done: 80, p4Start: 81, p4a: 87, p4b: 93, p4c: 97 }
                        : researchDepth === 'manual'
                            ? { p1Start: 5, p1Mid: 10, p1Struct: 15, p1Done: 20, p2Start: 21, p2Done: 45, p3Start: 46, p3Done: 60, p4Start: 61, p4a: 75, p4b: 88, p4c: 95 }
                            : /* standard */
                            { p1Start: 2, p1Mid: 15, p1Struct: 35, p1Done: 50, p2Start: 51, p2Done: 65, p3Start: 66, p3Done: 75, p4Start: 76, p4a: 84, p4b: 92, p4c: 97 };

                // ────────────────────────────────────────────
                // Phase 1: Deep Listening & Insight
                //   Standard: multi-angle grounding + JSON structuring
                //   Deep Research: grounding + URL Context for full page reading
                //   Manual: user-pasted external research data
                //   API Deep Research: Interactions API agent
                // ────────────────────────────────────────────
                let phase1: DeepListeningResult;
                let groundingSources: { title: string; url: string }[] = [];

                if (researchDepth === 'api-deep-research') {
                    // ── API Deep Research Mode (Interactions API) ──
                    send({ type: 'progress', phase: 1, percent: pct.p1Start, message: 'Phase 1 [API Deep Research]: Deep Research Agent を起動中...' });

                    const researchPrompt = buildApiDeepResearchPrompt(input);

                    // Time-based smooth progress interpolation
                    // Deep Research Agent takes ~500s; advance % smoothly from p1Start to p1Struct
                    const estimatedDuration = 500; // seconds (based on actual timing data)
                    const progressRange = pct.p1Struct - pct.p1Start;
                    const interpolationStart = Date.now();
                    let lastCallbackMessage = 'Deep Research Agent がリサーチを開始中...';

                    const interpolationTimer = setInterval(() => {
                        const elapsed = (Date.now() - interpolationStart) / 1000;
                        // Use easing: fast start, slow finish (sqrt curve)
                        const ratio = Math.min(Math.sqrt(elapsed / estimatedDuration), 0.95);
                        const currentPercent = Math.round(pct.p1Start + progressRange * ratio);
                        send({ type: 'progress', phase: 1, percent: currentPercent, message: `Phase 1 [API Deep Research]: ${lastCallbackMessage}` });
                    }, 3000);

                    const deepResult = await interactionsDeepResearch(
                        researchPrompt,
                        (msg) => { lastCallbackMessage = msg; },
                    );

                    clearInterval(interpolationTimer);
                    send({ type: 'progress', phase: 1, percent: pct.p1Struct, message: 'Phase 1 [API Deep Research]: リサーチ結果からDeep Listeningを構造化中...' });

                    const phase1Prompt = buildApiDeepResearchPhase1Prompt(input, prompts?.phase1Template)
                        + `\n\n【Deep Research Agent によるリサーチ結果】\n${deepResult.reportText}`;
                    phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);

                } else if (researchDepth === 'manual') {
                    // ── Manual Deep Research Mode ──
                    send({ type: 'progress', phase: 1, percent: pct.p1Start, message: 'Phase 1 [Manual]: 外部リサーチデータを分析中...' });

                    const manualData = input.manualResearchData || '';
                    const manualPrompt = buildManualPhase1Prompt(input, prompts?.phase1Template)
                        + `\n\n【外部Deep Researchの結果（ユーザー提供データ）】\n${manualData}`;

                    send({ type: 'progress', phase: 1, percent: pct.p1Mid, message: 'Phase 1 [Manual]: リサーチ結果からDeep Listeningを構造化中...' });
                    phase1 = await generateJSON<DeepListeningResult>(manualPrompt, modelId, systemPrompt);

                } else if (researchDepth === 'deep') {
                    // ── Deep Research Mode ──
                    send({ type: 'progress', phase: 1, percent: pct.p1Start, message: 'Phase 1 [Deep]: 5角度のGoogle検索でソースを探索中...' });

                    const groundingPrompts = buildMultiGroundingPrompts(input);
                    const analysisPrompt = buildDeepResearchPhase1Prompt(input, prompts?.phase1Template);

                    const deepResult = await deepResearchContent(
                        groundingPrompts,
                        analysisPrompt,
                        modelId,
                        systemPrompt,
                        (msg) => send({ type: 'progress', phase: 1, percent: pct.p1Mid, message: `Phase 1 [Deep]: ${msg}` }),
                    );

                    groundingSources = deepResult.allSources;
                    send({ type: 'progress', phase: 1, percent: pct.p1Struct, message: `Phase 1 [Deep]: ${groundingSources.length}件のソースからJSON構造化中...` });

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
                    send({ type: 'progress', phase: 1, percent: pct.p1Start, message: 'Phase 1: 5つの角度からGoogle検索で生活者のリアルな声を調査中...' });

                    const groundingPrompts = buildMultiGroundingPrompts(input);
                    const multiResult = await multiGroundedResearch(groundingPrompts, modelId, systemPrompt);

                    groundingSources = multiResult.allSources;
                    debugLog('📡 Grounding検索プロンプト', groundingPrompts);
                    debugLog('📄 Grounding検索結果（生テキスト）', multiResult.combinedText);
                    debugLog('🔗 発見されたソースURL一覧', groundingSources.map((s, i) => `[${i + 1}] ${s.title} — ${s.url}`));
                    debugLog('📊 セグメント数', multiResult.allSegments.length);
                    send({ type: 'progress', phase: 1, percent: pct.p1Mid, message: `Phase 1: ${groundingSources.length}件のソースから声を分析・構造化中...` });

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
                    debugLog('📝 Phase 1 プロンプト（LLMへの入力）', phase1Prompt);
                    phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);
                    debugLog('🤖 Phase 1 LLM生出力（検証前）', phase1);
                }

                // Fetch actual page titles from URLs (parallel, non-blocking)
                console.log(`[Route] Before fetchActualTitles: ${groundingSources.length} sources`);
                send({ type: 'progress', phase: 1, percent: pct.p1Struct, message: 'Phase 1: ソースページの正式タイトルを取得中...' });
                groundingSources = await fetchActualTitles(groundingSources);
                console.log(`[Route] After fetchActualTitles: ${groundingSources.length} sources`);

                // Build a URL→title map for correcting voice-level sourceTitle
                const titleMap = new Map(groundingSources.map(s => [s.url, s.title]));
                const correctTitles = (voices: (string | VoiceItem)[]): VoiceItem[] => {
                    return voices.map(v => {
                        const item = typeof v === 'string' ? { text: v } : v;
                        if (item.sourceUrl && titleMap.has(item.sourceUrl)) {
                            return { ...item, sourceTitle: titleMap.get(item.sourceUrl) };
                        }
                        return item;
                    });
                };
                // Build a set of valid URLs for validation
                const validUrls = new Set(groundingSources.map(s => s.url));

                const validateUrls = (voices: VoiceItem[]): VoiceItem[] => {
                    // If no ground truth URLs exist (api-deep-research, manual), trust Google grounding URLs
                    if (validUrls.size === 0) {
                        let trustedCount = 0;
                        let strippedCount = 0;
                        const result = voices.map(v => {
                            if (v.sourceUrl && v.sourceUrl !== '') {
                                if (isTrustedUrl(v.sourceUrl)) {
                                    trustedCount++;
                                    return v; // Keep trusted Google grounding URLs
                                } else {
                                    strippedCount++;
                                    return { ...v, sourceUrl: '', sourceTitle: '' };
                                }
                            }
                            return v;
                        });
                        debugLog(`🔗 URL検証 (no ground truth)`, {
                            信頼済みURL: trustedCount,
                            除去URL: strippedCount,
                            モード: researchDepth,
                        });
                        return result;
                    }

                    let strippedCount = 0;
                    const result = voices.map(v => {
                        if (v.sourceUrl && v.sourceUrl !== '' && !validUrls.has(v.sourceUrl)) {
                            // Allow trusted Google grounding redirect URLs
                            if (isTrustedUrl(v.sourceUrl)) return v;
                            // Check if it's a partial match (some LLMs add/remove trailing slashes)
                            const normalized = v.sourceUrl.replace(/\/$/, '');
                            const found = [...validUrls].some(u => u.replace(/\/$/, '') === normalized);
                            if (!found) {
                                strippedCount++;
                                return { ...v, sourceUrl: '', sourceTitle: '' };
                            }
                        }
                        return v;
                    });
                    if (strippedCount > 0) {
                        console.log(`[URL Validation] Stripped ${strippedCount} hallucinated URLs from ${voices.length} voices`);
                        debugLog(`⛔ URL検証: ${strippedCount}個のハルシネーションURLを除去`,
                            voices.filter(v => v.sourceUrl && v.sourceUrl !== '' && !validUrls.has(v.sourceUrl) && !isTrustedUrl(v.sourceUrl))
                                .map(v => `❌ ${v.sourceUrl} → "${v.text?.substring(0, 50)}..."`)
                        );
                    }
                    return result;
                };

                phase1 = {
                    ...phase1,
                    positiveHacks: validateUrls(correctTitles(phase1.positiveHacks)),
                    negativePains: validateUrls(correctTitles(phase1.negativePains)),
                };

                debugLog('✅ Phase 1 最終出力（検証後）', phase1);
                debugLog('📊 Phase 1 集計', {
                    ポジティブ数: phase1.positiveHacks.length,
                    ネガティブ数: phase1.negativePains.length,
                    URL付きポジティブ: phase1.positiveHacks.filter(h => typeof h !== 'string' && h.sourceUrl).length,
                    URL付きネガティブ: phase1.negativePains.filter(p => typeof p !== 'string' && p.sourceUrl).length,
                    有効URL数: validUrls.size,
                });

                send({ type: 'progress', phase: 1, percent: pct.p1Done, message: `Phase 1: Deep Listening 完了 ✓${researchDepth === 'deep' ? ' [Deep Research]' : ''}` });
                phaseTimings['Phase 1 (Deep Listening)'] = Math.round((Date.now() - phaseStartTime) / 1000);
                debugLog('⏱ Phase 1 完了', `${phaseTimings['Phase 1 (Deep Listening)']} 秒`);
                phaseStartTime = Date.now();
                send({ type: 'phase_result', phase: 1, data: phase1, groundingSources });

                const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${typeof h === 'string' ? h : h.text}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${typeof p === 'string' ? p : p.text}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

                // ────────────────────────────────────────────
                // Phase 2: Social Language Development (~8%)
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 2, percent: pct.p2Start, message: 'Phase 2: Social Language — 社会言語を開発中...' });

                const phase2Prompt = buildPhase2Prompt(input, phase1Summary, prompts?.phase2Template);
                const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 2, percent: pct.p2Done, message: 'Phase 2: Social Language 完了 ✓' });
                phaseTimings['Phase 2 (Social Language)'] = Math.round((Date.now() - phaseStartTime) / 1000);
                debugLog('⏱ Phase 2 完了', `${phaseTimings['Phase 2 (Social Language)']} 秒`);
                phaseStartTime = Date.now();
                send({ type: 'phase_result', phase: 2, data: phase2 });

                const socialLanguagesSummary = phase2
                    .map((sl, i) => `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`)
                    .join('\n\n');

                // ────────────────────────────────────────────
                // Phase 3: Evidence Design (~8%)
                // ────────────────────────────────────────────
                send({ type: 'progress', phase: 3, percent: pct.p3Start, message: 'Phase 3: Evidence Design — 調査設計中...' });

                const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary, prompts?.phase3Template);
                const phase3 = await generateJSON<SurveyDesign>(phase3Prompt, modelId, systemPrompt);

                send({ type: 'progress', phase: 3, percent: pct.p3Done, message: 'Phase 3: Evidence Design 完了 ✓' });
                phaseTimings['Phase 3 (Evidence Design)'] = Math.round((Date.now() - phaseStartTime) / 1000);
                debugLog('⏱ Phase 3 完了', `${phaseTimings['Phase 3 (Evidence Design)']} 秒`);
                phaseStartTime = Date.now();
                send({ type: 'phase_result', phase: 3, data: phase3 });

                const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

                // ────────────────────────────────────────────
                // Phase 4: Output Generation (~70% — split into 3 sub-calls)
                // ────────────────────────────────────────────

                let phase4: OutputGeneration;

                // If user has a custom Phase 4 template, use it as-is (single call)
                if (prompts?.phase4Template) {
                    send({ type: 'progress', phase: 4, percent: pct.p4Start, message: 'Phase 4: Output — カスタムテンプレートで生成中...' });

                    const phase4Prompt = buildPhase4Prompt(
                        input, phase1Summary, socialLanguagesSummary, surveyDesignSummary,
                        prompts.phase4Template,
                    );
                    phase4 = await generateJSON<OutputGeneration>(phase4Prompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: 100, message: 'Phase 4: Output 完了 ✓' });
                } else {
                    // ── Phase 4a: Report Summary (~25%) ──
                    send({ type: 'progress', phase: 4, percent: pct.p4Start, message: 'Phase 4: 調査レポートサマリを生成中...' });

                    const phase4aPrompt = buildPhase4aPrompt(input, phase1Summary, socialLanguagesSummary, surveyDesignSummary);
                    const phase4a = await generateJSON<{ reportSummary: string }>(phase4aPrompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: pct.p4a, message: 'Phase 4: 調査レポートサマリ完了 ✓' });

                    // ── Phase 4b: Press Release ──
                    send({ type: 'progress', phase: 4, percent: pct.p4a, message: 'Phase 4: プレスリリース記事を生成中...' });

                    const phase4bPrompt = buildPhase4bPrompt(input, phase1.marketRedefinition, socialLanguagesSummary);
                    const phase4b = await generateJSON<{ pressRelease: string }>(phase4bPrompt, modelId, systemPrompt);

                    send({ type: 'progress', phase: 4, percent: pct.p4b, message: 'Phase 4: プレスリリース完了 ✓' });

                    // ── Phase 4c: Positioning + Headline ──
                    send({ type: 'progress', phase: 4, percent: pct.p4b, message: 'Phase 4: ポジショニング提案 & 見出しを生成中...' });

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
                phaseTimings['Phase 4 (Output)'] = Math.round((Date.now() - phaseStartTime) / 1000);
                const totalSeconds = Math.round((Date.now() - analysisStartTime) / 1000);
                const totalMinutes = (totalSeconds / 60).toFixed(1);
                debugLog('⏱ Phase 4 完了', `${phaseTimings['Phase 4 (Output)']} 秒`);
                debugLog('🏁 全分析完了 — タイミングサマリー', {
                    ...(Object.fromEntries(Object.entries(phaseTimings).map(([k, v]) => [k, `${v}秒`]))),
                    '合計': `${totalSeconds}秒（${totalMinutes}分）`,
                    'モード': researchDepth,
                    'モデル': modelId,
                });
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
