// ============================================================
// PRISM — Gemini API Client (with Grounding support)
// ============================================================

import { GoogleGenAI } from '@google/genai';
import type { GeminiModel, GroundingSource, GroundingSegment } from './types';
import { DEFAULT_SYSTEM_PROMPT } from './prompts';

let ai: GoogleGenAI | null = null;

/**
 * Fetch actual page titles from URLs by reading HTML <title> tags.
 * Runs in parallel with a timeout per request.
 */
export async function fetchActualTitles(
    sources: GroundingSource[],
    timeoutMs = 5000,
): Promise<GroundingSource[]> {
    const results = await Promise.allSettled(
        sources.slice(0, 20).map(async (src) => {
            try {
                const controller = new AbortController();
                const timer = setTimeout(() => controller.abort(), timeoutMs);
                const res = await fetch(src.url, {
                    signal: controller.signal,
                    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PRISM/1.0)' },
                    redirect: 'follow',
                });
                clearTimeout(timer);
                if (!res.ok) return src;
                // Read only the first ~16KB to find <title>
                const reader = res.body?.getReader();
                if (!reader) return src;
                let html = '';
                const decoder = new TextDecoder();
                while (html.length < 16384) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    html += decoder.decode(value, { stream: true });
                    // Check if we've found closing </title>
                    if (html.includes('</title>') || html.includes('</TITLE>')) break;
                }
                reader.cancel();
                const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
                if (match?.[1]) {
                    const title = match[1].replace(/[\n\r\t]+/g, ' ').trim();
                    if (title.length > 0 && title.length < 200) {
                        return { ...src, title };
                    }
                }
                return src;
            } catch {
                return src;
            }
        })
    );

    return results.map((r, i) =>
        r.status === 'fulfilled' ? r.value : sources[i]
    );
}

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

/** Result from deep research (Google Search + URL Context) */
export interface DeepResearchResult {
    /** Combined research text from all steps */
    combinedText: string;
    /** All source URLs discovered and read */
    allSources: GroundingSource[];
}

/**
 * Deep Research: Two-step process
 * Step 1: Multi-angle Google Search grounding to discover source URLs
 * Step 2: URL Context Tool to deeply read the discovered pages
 *
 * Returns rich research data with accurate source-to-content mapping.
 */
export async function deepResearchContent(
    searchQueries: string[],
    analysisPrompt: string,
    modelId: GeminiModel = DEFAULT_MODEL,
    systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
    onProgress?: (message: string) => void,
): Promise<DeepResearchResult> {
    const client = getClient();

    // Step 1: Multi-angle grounding to discover URLs
    onProgress?.('Step 1/2: 複数角度からGoogle検索中...');
    const multiResult = await multiGroundedResearch(searchQueries, modelId, systemPrompt);
    console.log(`[Deep Research] Step 1 completed: ${multiResult.allSources.length} sources from grounding`);
    onProgress?.(`Step 1完了: ${multiResult.allSources.length}件のソースを発見`);

    // Step 2: Use URL Context Tool to deeply read discovered pages
    // Include up to 20 URLs (API limit)
    const urlsToRead = multiResult.allSources.slice(0, 20);
    const urlList = urlsToRead.map(s => s.url).join('\n');

    onProgress?.(`Step 2/2: ${urlsToRead.length}件のページを深く読み込み中...`);

    const deepPrompt = `${analysisPrompt}

以下のURLの内容を深く読み込み、生活者のリアルな声を抽出・分析してください。
重要：声はページに実際に書かれている内容からのみ抽出すること。ページに存在しない声を創作しないこと。
各声にはその内容が掲載されているページのURLを正確に紐づけてください。

【読み込み対象URL一覧】
${urlList}

【Step 1で収集済みの概要情報】
${multiResult.combinedText}`;

    const deepResponse = await client.models.generateContent({
        model: modelId,
        contents: deepPrompt,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ urlContext: {} }],
            responseMimeType: 'application/json',
        },
    });

    // Extract additional sources from URL context metadata
    const urlMeta = deepResponse.candidates?.[0]?.urlContextMetadata;
    const additionalSources: GroundingSource[] = [];
    if (urlMeta?.urlMetadata) {
        for (const meta of urlMeta.urlMetadata) {
            if (meta.retrievedUrl) {
                const existing = multiResult.allSources.find(s => s.url === meta.retrievedUrl);
                if (!existing) {
                    additionalSources.push({
                        title: meta.urlRetrievalStatus ?? meta.retrievedUrl,
                        url: meta.retrievedUrl,
                    });
                }
            }
        }
    }

    const allSources = [...multiResult.allSources, ...additionalSources];
    console.log(`[Deep Research] Step 2 completed: ${additionalSources.length} additional sources from URL context, total: ${allSources.length}`);

    return {
        combinedText: deepResponse.text ?? '',
        allSources,
    };
}

// ── Interactions API: Deep Research Agent ──

/** Result from Interactions API Deep Research */
export interface InteractionsDeepResearchResult {
    /** Full research report text */
    reportText: string;
    /** Thought summaries captured during research */
    thoughtSummaries: string[];
}

/**
 * Execute a Deep Research task using the Gemini Interactions API.
 * Uses the deep-research-pro-preview-12-2025 agent with streaming.
 *
 * Note: This is a long-running operation (3-15 minutes).
 * Progress is reported via onProgress callback.
 */
export async function interactionsDeepResearch(
    prompt: string,
    onProgress?: (message: string) => void,
): Promise<InteractionsDeepResearchResult> {
    const client = getClient();

    onProgress?.('Deep Research Agent を起動中...');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stream = await (client as any).interactions.create({
        input: prompt,
        agent: 'deep-research-pro-preview-12-2025',
        background: true,
        stream: true,
        agent_config: {
            type: 'deep-research',
            thinking_summaries: 'auto',
        },
    });

    let reportText = '';
    const thoughtSummaries: string[] = [];
    let interactionId: string | undefined;

    for await (const chunk of stream) {
        // Capture interaction ID
        if (chunk.event_type === 'interaction.start') {
            interactionId = chunk.interaction?.id;
            console.log(`[Interactions API] Deep Research started: ${interactionId}`);
            onProgress?.('Deep Research Agent がリサーチを開始しました...');
        }

        // Handle content deltas
        if (chunk.event_type === 'content.delta') {
            if (chunk.delta?.type === 'text') {
                reportText += chunk.delta.text;
            } else if (chunk.delta?.type === 'thought_summary') {
                const thought = chunk.delta.content?.text || chunk.delta.text || '';
                if (thought) {
                    thoughtSummaries.push(thought);
                    onProgress?.(`🔍 ${thought}`);
                }
            }
        }

        // Research complete
        if (chunk.event_type === 'interaction.complete') {
            console.log(`[Interactions API] Deep Research completed: ${interactionId}`);
            onProgress?.('Deep Research Agent がリサーチを完了しました');
        }

        // Handle failure
        if (chunk.event_type === 'interaction.failed') {
            const error = chunk.interaction?.error || 'Unknown error';
            console.error(`[Interactions API] Deep Research failed: ${error}`);
            throw new Error(`Deep Research failed: ${error}`);
        }
    }

    if (!reportText) {
        throw new Error('Deep Research returned empty result');
    }

    console.log(`[Interactions API] Report length: ${reportText.length} chars, ${thoughtSummaries.length} thought summaries`);

    return { reportText, thoughtSummaries };
}
