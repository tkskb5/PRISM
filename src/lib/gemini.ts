// ============================================================
// PRISM — Gemini API Client (with Grounding support)
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type { GeminiModel, GroundingSource, GroundingSegment } from './types';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';

let ai: GoogleGenAI | null = null;

function getClient(): GoogleGenAI {
    if (!ai) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        ai = new GoogleGenAI({ apiKey });
    }
    return ai;
}

const DEFAULT_MODEL: GeminiModel = 'gemini-3-flash-preview';

/** Result from a grounded content generation */
export interface GroundedResult {
    text: string;
    sources: GroundingSource[];
    /** Text segments mapped to their specific sources via groundingSupports */
    segments: GroundingSegment[];
}

/** Merged result from multiple grounded searches */
export interface MultiGroundedResult {
    /** All grounded texts concatenated with labels */
    combinedText: string;
    /** Deduplicated sources across all searches */
    allSources: GroundingSource[];
    /** All segments from all searches */
    allSegments: GroundingSegment[];
}

/**
 * Generate and parse JSON response.
 */
export async function generateJSON<T>(
    prompt: string,
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    maxRetries = 2,
): Promise<T> {
    const client = getClient();
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const response = await client.models.generateContent({
                model: modelId,
                contents: prompt,
                config: {
                    systemInstruction: systemPrompt,
                    responseMimeType: 'application/json',
                },
            });
            const text = response.text ?? '';
            return JSON.parse(text) as T;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error(String(error));
            console.warn(`Gemini JSON attempt ${attempt + 1}/${maxRetries + 1} failed:`, lastError.message);
            if (attempt < maxRetries) {
                await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }

    throw new Error(`Failed after ${maxRetries + 1} attempts: ${lastError?.message}`);
}

/**
 * Generate content with Google Search grounding enabled.
 * Returns grounded text, source URLs, AND per-segment source mapping.
 */
export async function generateGroundedContent(
    prompt: string,
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<GroundedResult> {
    const client = getClient();
    const response = await client.models.generateContent({
        model: modelId,
        contents: prompt,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} }],
        },
    });

    const groundingMeta = response.candidates?.[0]?.groundingMetadata;

    // Extract source URLs from grounding chunks
    const sources: GroundingSource[] = [];
    const chunks = groundingMeta?.groundingChunks;
    if (chunks) {
        for (const chunk of chunks) {
            if (chunk.web?.uri) {
                sources.push({
                    title: chunk.web.title ?? chunk.web.uri,
                    url: chunk.web.uri,
                });
            }
        }
    }

    // Extract text-to-source mapping from groundingSupports
    const fullText = response.text ?? '';
    const segments: GroundingSegment[] = [];
    const supports = groundingMeta?.groundingSupports;
    if (supports && chunks) {
        for (const support of supports) {
            const seg = support.segment;
            if (seg?.text) {
                const segSources: GroundingSource[] = [];
                const indices = support.groundingChunkIndices;
                if (indices) {
                    for (const idx of indices) {
                        const chunk = chunks[idx];
                        if (chunk?.web?.uri) {
                            segSources.push({
                                title: chunk.web.title ?? chunk.web.uri,
                                url: chunk.web.uri,
                            });
                        }
                    }
                }
                if (segSources.length > 0) {
                    segments.push({ text: seg.text, sources: segSources });
                }
            }
        }
    }

    return { text: fullText, sources, segments };
}

/**
 * Execute multiple grounded searches in parallel with different angles.
 * Returns combined text, deduplicated sources, and all segments.
 */
export async function multiGroundedResearch(
    queries: string[],
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<MultiGroundedResult> {
    // Run all searches in parallel
    const results = await Promise.all(
        queries.map(q => generateGroundedContent(q, modelId, systemPrompt))
    );

    // Combine text with labels
    const combinedText = results
        .map((r, i) => `【検索${i + 1}の結果】\n${r.text}`)
        .join('\n\n');

    // Deduplicate sources by URL
    const seenUrls = new Set<string>();
    const allSources: GroundingSource[] = [];
    for (const r of results) {
        for (const src of r.sources) {
            if (!seenUrls.has(src.url)) {
                seenUrls.add(src.url);
                allSources.push(src);
            }
        }
    }

    // Collect all segments
    const allSegments: GroundingSegment[] = results.flatMap(r => r.segments);

    return { combinedText, allSources, allSegments };
}
