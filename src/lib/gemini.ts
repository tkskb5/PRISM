// ============================================================
// PRISM — Gemini API Client (with Grounding support)
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type { GeminiModel, GroundingSource } from './types';
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
 * Returns grounded text AND source URLs from the search results.
 *
 * NOTE: Grounding cannot be combined with JSON response mode,
 * so this returns raw text. Use generateJSON separately to
 * structure the grounded output.
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

    // Extract source URLs from grounding metadata
    const sources: GroundingSource[] = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
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

    return {
        text: response.text ?? '',
        sources,
    };
}
