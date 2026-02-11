// ============================================================
// PRISM — Analysis API Route
// ============================================================

import { NextResponse } from 'next/server';
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
    PrismResult,
} from '@/lib/types';

const VALID_MODELS: GeminiModel[] = ['gemini-3-flash-preview', 'gemini-3-pro-preview'];

interface AnalyzeRequest {
    input: PrismInput;
    customPrompts?: CustomPrompts;
}

export async function POST(request: Request) {
    try {
        const body: AnalyzeRequest = await request.json();
        const input = body.input ?? body as unknown as PrismInput; // backward compat
        const prompts = body.customPrompts;

        // Validate input
        if (!input.productName || !input.category || !input.challenges) {
            return NextResponse.json(
                { error: '商材名、カテゴリ、課題のすべてを入力してください。' },
                { status: 400 }
            );
        }

        // Validate and sanitize model selection
        const modelId: GeminiModel = VALID_MODELS.includes(input.model as GeminiModel)
            ? (input.model as GeminiModel)
            : 'gemini-3-flash-preview';

        const systemPrompt = prompts?.systemPrompt || DEFAULT_SYSTEM_PROMPT;

        // ── Phase 1: Deep Listening & Insight ──
        const phase1Prompt = buildPhase1Prompt(input, prompts?.phase1Template);
        const phase1 = await generateJSON<DeepListeningResult>(phase1Prompt, modelId, systemPrompt);

        const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${h}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${p}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

        // ── Phase 2: Social Language Development ──
        const phase2Prompt = buildPhase2Prompt(input, phase1Summary, prompts?.phase2Template);
        const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt, modelId, systemPrompt);

        const socialLanguagesSummary = phase2
            .map(
                (sl, i) =>
                    `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`
            )
            .join('\n\n');

        // ── Phase 3: Evidence Design ──
        const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary, prompts?.phase3Template);
        const phase3 = await generateJSON<SurveyDesign>(phase3Prompt, modelId, systemPrompt);

        const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

        // ── Phase 4: Output Generation ──
        const phase4Prompt = buildPhase4Prompt(
            input,
            phase1Summary,
            socialLanguagesSummary,
            surveyDesignSummary,
            prompts?.phase4Template,
        );
        const phase4 = await generateJSON<OutputGeneration>(phase4Prompt, modelId, systemPrompt);

        // ── Assemble Result ──
        const result: PrismResult = {
            input,
            phase1,
            phase2,
            phase3,
            phase4,
        };

        return NextResponse.json(result);
    } catch (error) {
        console.error('PRISM Analysis Error:', error);
        const message =
            error instanceof Error ? error.message : 'Unknown error occurred';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
