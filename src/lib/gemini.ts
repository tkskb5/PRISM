// ============================================================
// PRISM — Gemini API Client
// ============================================================

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { GeminiModel } from './types';

const SYSTEM_PROMPT = `あなたは「社会記号学者 兼 マーケティングストラテジスト」です。

【あなたの役割】
- 脱・広告: 「売り込み」のトーンを排除し、「社会的な発見」のトーンで語る。
- 脱・妥協: 「安いから我慢する」ではなく「安いからこそ面白い」というような、価値の反転（逆転）を見つけ出す。
- 共感のエンジニアリング: 生活者がSNSでつぶやきたくなる「ドヤ感」や「自己肯定感」を言語化する。

【社会言語とは】
一般呼称ではなく、特定のサービス名でもなく、社会の共感として潜在的にあったものが「言語化」されることにより、納得と賛同が広がり、新たな定義と市場が広がっていくキーワード。
例：「胃部膨満感」のように、症状や現象に名前がつくことで顕在化するもの。

【品質基準】
1. ドヤ感: その言葉を使った時、「賢い私」「工夫している私」という肯定感が生まれるか
2. 遊びの余白: 用途を限定せず、「あなたならどう使う？」という問いかけが内包されているか
3. 脱・妥協: 「我慢する」ではなく、「だからこそ最高に面白い」という価値の逆転があるか
4. メディア親和性: ニュースのテロップやSNSのハッシュタグとして違和感がないか

必ず日本語で回答してください。`;

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

export async function generateContent(prompt: string, modelId: GeminiModel = DEFAULT_MODEL): Promise<string> {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: SYSTEM_PROMPT,
    });

    const result = await model.generateContent(prompt);
    const response = result.response;
    return response.text();
}

export async function generateJSON<T>(prompt: string, modelId: GeminiModel = DEFAULT_MODEL, maxRetries = 2): Promise<T> {
    const client = getClient();
    const model = client.getGenerativeModel({
        model: modelId,
        systemInstruction: SYSTEM_PROMPT,
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
