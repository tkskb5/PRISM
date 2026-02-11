// ============================================================
// PRISM — Gemini API Client
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiModel } from './types';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';

let genAI: GoogleGenerativeAI | null = null;

function getClient(): GoogleGenerativeAI {
    if (!genAI) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error('GEMINI_API_KEY environment variable is not set');
        }
        genAI = new GoogleGenerativeAI(apiKey);
    }
    return genAI;
}

const DEFAULT_MODEL: GeminiModel = 'gemini-3-flash-preview';

export async function generateContent(
    prompt: string,
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}

export async function generateJSON<T>(
    prompt: string,
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    maxRetries = 2,
): Promise<T> {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: systemPrompt,
        generationConfig: {
            responseMimeType: 'application/json',
        },
    });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const result = await model.generateContent(prompt);
            const response = result.response;
            const text = response.text();
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
