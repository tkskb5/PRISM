// ============================================================
// PRISM — Analysis API Route
// ============================================================

import { NextResponse } from 'next/server';
import { generateJSON, generateContent } from '@/lib/gemini';
import {
    buildPhase1Prompt,
    buildPhase2Prompt,
    buildPhase3Prompt,
    buildPhase4Prompt,
} from '@/lib/prompts';
import type {
    PrismInput,
    DeepListeningResult,
    SocialLanguage,
    SurveyDesign,
    OutputGeneration,
    PrismResult,
} from '@/lib/types';

export async function POST(request: Request) {
    try {
        const input: PrismInput = await request.json();

        // Validate input
        if (!input.productName || !input.category || !input.challenges) {
            return NextResponse.json(
                { error: '商材名、カテゴリ、課題のすべてを入力してください。' },
                { status: 400 }
            );
        }

        // ── Phase 1: Deep Listening & Insight ──
        const phase1Prompt = buildPhase1Prompt(input);
        const phase1 = await generateJSON<DeepListeningResult>(phase1Prompt);

        const phase1Summary = `ポジティブ・ハック:\n${phase1.positiveHacks.map((h) => `- ${h}`).join('\n')}\n\nネガティブ・ペイン:\n${phase1.negativePains.map((p) => `- ${p}`).join('\n')}\n\n市場の再定義: ${phase1.marketRedefinition}`;

        // ── Phase 2: Social Language Development ──
        const phase2Prompt = buildPhase2Prompt(input, phase1Summary);
        const phase2 = await generateJSON<SocialLanguage[]>(phase2Prompt);

        const socialLanguagesSummary = phase2
            .map(
                (sl, i) =>
                    `${i + 1}. ${sl.keyword}\n   ストーリー: ${sl.story}\n   ファクト: ${sl.fact}`
            )
            .join('\n\n');

        // ── Phase 3: Evidence Design ──
        const phase3Prompt = buildPhase3Prompt(input, socialLanguagesSummary);
        const phase3 = await generateJSON<SurveyDesign>(phase3Prompt);

        const surveyDesignSummary = `定量設問:\n${phase3.quantitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}\n\n定性設問:\n${phase3.qualitative.map((q, i) => `${i + 1}. ${q}`).join('\n')}`;

        // ── Phase 4: Output Generation ──
        const phase4Prompt = buildPhase4Prompt(
            input,
            phase1Summary,
            socialLanguagesSummary,
            surveyDesignSummary
        );
        const phase4 = await generateJSON<OutputGeneration>(phase4Prompt);

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
