import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import path from 'path';
import os from 'os';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Modality } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ILYAS_VOICE_STYLE =
  'A mature male voice, gentle, expressive, and deep. Sounds like an engaging literature teacher or wise storyteller. Very warm with dynamic pacing to keep the listener hooked.';

const RAHMA_VOICE_STYLE =
  'A mature female voice, soft, soothing, and highly expressive. Sounds like a gentle arts or language teacher reading a storybook. Warm, dynamic, and emotionally engaging.';

type StudioPersona = 'rahma' | 'ilyas';

function resolvePersonaSpec(rawPersona: unknown): {
  persona: StudioPersona;
  voiceName: 'Kore' | 'Charon';
  style: string;
} {
  if (rawPersona === 'ilyas') {
    return {
      persona: 'ilyas',
      voiceName: 'Charon',
      style: ILYAS_VOICE_STYLE,
    };
  }
  return {
    persona: 'rahma',
    voiceName: 'Kore',
    style: RAHMA_VOICE_STYLE,
  };
}

const MAX_TTS_TEXT_CHARS = 2500;
const MAX_TTS_CACHE_ENTRIES = 200;
const ttsAudioCache = new Map<string, string>();
const inFlightTts = new Map<string, Promise<string | null>>();
const modelCooldownUntil = new Map<string, number>();
const DISK_TTS_CACHE_DIR = path.join(os.tmpdir(), 'sahabat-bumi-narrator-tts-cache-v3');

// Purge legacy cache directories so old voices or headerless PCM files never mix in
for (const legacyDir of [
  'sahabat-bumi-ilyas-tts-cache',
  'sahabat-bumi-narrator-tts-cache-v2',
]) {
  try {
    fs.rmSync(path.join(os.tmpdir(), legacyDir), { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

try {
  fs.mkdirSync(DISK_TTS_CACHE_DIR, { recursive: true });
} catch {
  // Ignore cache dir creation errors
}

function getCacheKey(persona: StudioPersona, cleanText: string): string {
  const spec = resolvePersonaSpec(persona);
  return `v3::${spec.persona}::${spec.voiceName}::${spec.style}::${cleanText}`;
}

function getCacheHash(persona: StudioPersona, cleanText: string): string {
  return crypto
    .createHash('sha256')
    .update(getCacheKey(persona, cleanText))
    .digest('hex');
}

function buildWavBufferFromPcm(pcmBuffer: Buffer, sampleRate = 24000): Buffer {
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const header = Buffer.alloc(44);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(36 + pcmBuffer.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36, 'ascii');
  header.writeUInt32LE(pcmBuffer.length, 40);
  return Buffer.concat([header, pcmBuffer]);
}

function ensureWavBuffer(rawBuf: Buffer, sampleRate = 24000): Buffer {
  if (rawBuf.length >= 44 && rawBuf.toString('ascii', 0, 4) === 'RIFF') {
    return rawBuf;
  }
  const aligned =
    rawBuf.length % 2 === 1 ? rawBuf.subarray(0, rawBuf.length - 1) : rawBuf;
  return buildWavBufferFromPcm(aligned, sampleRate);
}

function getCachedTtsAudio(persona: StudioPersona, cleanText: string): string | null {
  const cacheKey = getCacheKey(persona, cleanText);
  const mem = ttsAudioCache.get(cacheKey);
  if (mem) return mem;

  try {
    const filePath = path.join(DISK_TTS_CACHE_DIR, `${getCacheHash(persona, cleanText)}.wav`);
    if (fs.existsSync(filePath)) {
      const rawBuf = fs.readFileSync(filePath);
      if (rawBuf.length > 44) {
        const wavBuf = ensureWavBuffer(rawBuf, 24000);
        const b64 = wavBuf.toString('base64');
        cacheTtsAudio(persona, cleanText, b64, false);
        return b64;
      }
    }
  } catch {
    // Ignore disk cache read errors
  }
  return null;
}

const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      apiVersion: 'v1beta',
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

const extractWavBase64 = (response: {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        inlineData?: { data?: string; mimeType?: string };
      }>;
    };
  }>;
}): string | null => {
  const parts = response.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  for (const part of parts) {
    if (part.inlineData?.data) {
      return part.inlineData.data;
    }
  }
  return null;
};

function recordModelError(model: string, err: unknown) {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  if (msg.includes('404') || msg.includes('NOT_FOUND') || msg.includes('not found') || msg.includes('not supported')) {
    modelCooldownUntil.set(model, Date.now() + 3600_000);
  } else if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
    const isDaily = msg.includes('PerDay');
    modelCooldownUntil.set(model, Date.now() + (isDaily ? 3600_000 : 12_000));
  }
}

function isModelAvailable(model: string): boolean {
  const until = modelCooldownUntil.get(model) ?? 0;
  return Date.now() >= until;
}

const LIVE_MODELS = [
  'gemini-2.5-flash-native-audio-preview-12-2025',
  'gemini-2.5-flash-native-audio-preview-09-2025',
  'gemini-3.8-live',
];

async function synthesizeViaLiveApi(
  ai: GoogleGenAI,
  spec: { persona: StudioPersona; voiceName: string; style: string },
  textToRead: string,
  onChunk?: (pcmChunk: Buffer) => void,
  isCancelled?: () => boolean
): Promise<{ pcm: Buffer; complete: boolean } | null> {
  for (const liveModel of LIVE_MODELS) {
    if (!isModelAvailable(liveModel)) continue;
    try {
      const pcmParts: Buffer[] = [];
      let turnCompleted = false;
      const result = await new Promise<{ pcm: Buffer; complete: boolean } | null>((resolve, reject) => {
        let settled = false;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let sessionRef: any = null;

        const finish = (val: { pcm: Buffer; complete: boolean } | null, err?: unknown) => {
          if (settled) return;
          settled = true;
          clearTimeout(timeoutId);
          try {
            sessionRef?.close?.();
          } catch {
            // Ignore close error
          }
          if (err) reject(err);
          else resolve(val);
        };

        const timeoutId = setTimeout(() => {
          if (pcmParts.length > 0) {
            finish({ pcm: Buffer.concat(pcmParts), complete: true });
          } else {
            finish(null, new Error(`Live API timeout on ${liveModel}`));
          }
        }, 45000);

        ai.live
          .connect({
            model: liveModel,
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: spec.voiceName },
                },
              },
              systemInstruction: {
                parts: [
                  {
                    text: `Voice Persona & Audio Profile: ${spec.style}\nYou are an Indonesian storybook and game narrator. Your ONLY task is to read aloud the user's Indonesian text verbatim (word-for-word). NEVER add any greeting, intro, commentary, or extra words. Speak immediately in natural Bahasa Indonesia with the exact voice persona described above.`,
                  },
                ],
              },
            },
            callbacks: {
              onopen: () => {
                // Connection opened; send text once sessionRef is assigned
              },
              onmessage: (message) => {
                if (isCancelled?.()) {
                  finish(
                    pcmParts.length > 0
                      ? { pcm: Buffer.concat(pcmParts), complete: false }
                      : null
                  );
                  return;
                }
                const parts = message.serverContent?.modelTurn?.parts ?? [];
                for (const part of parts) {
                  const b64 = part.inlineData?.data;
                  if (b64) {
                    const buf = Buffer.from(b64, 'base64');
                    if (buf.length > 0) {
                      pcmParts.push(buf);
                      onChunk?.(buf);
                    }
                  }
                }
                if (message.serverContent?.turnComplete) {
                  turnCompleted = true;
                  finish(
                    pcmParts.length > 0
                      ? { pcm: Buffer.concat(pcmParts), complete: true }
                      : null
                  );
                }
              },
              onerror: (err) => {
                finish(
                  pcmParts.length > 0
                    ? { pcm: Buffer.concat(pcmParts), complete: turnCompleted }
                    : null,
                  err
                );
              },
              onclose: () => {
                finish(
                  pcmParts.length > 0
                    ? { pcm: Buffer.concat(pcmParts), complete: turnCompleted }
                    : null
                );
              },
            },
          })
          .then((session) => {
            sessionRef = session;
            if (settled) {
              try {
                session.close();
              } catch {
                // Ignore
              }
              return;
            }
            session.sendClientContent({
              turns: [
                {
                  role: 'user',
                  parts: [
                    {
                      text: `Bacakan teks Bahasa Indonesia berikut persis kata demi kata tanpa tambahan kata apa pun:\n"${textToRead}"`,
                    },
                  ],
                },
              ],
              turnComplete: true,
            });
          })
          .catch((err) => {
            finish(null, err);
          });
      });

      if (result && result.pcm.length > 0) {
        return result;
      }
    } catch (err) {
      lastTtsDebugError = `Live API (${liveModel}) error: ${err instanceof Error ? err.message : String(err)}`;
      recordModelError(liveModel, err);
    }
  }
  return null;
}

async function synthesizeSingleChunkPcm(
  ai: GoogleGenAI,
  spec: { persona: StudioPersona; voiceName: string; style: string },
  chunkText: string
): Promise<Buffer | null> {
  // Check if this exact sentence/chunk is already cached
  const cachedB64 = getCachedTtsAudio(spec.persona, chunkText);
  if (cachedB64) {
    const buf = Buffer.from(cachedB64, 'base64');
    return buf.length >= 44 && buf.toString('ascii', 0, 4) === 'RIFF' ? buf.subarray(44) : buf;
  }

  // 1. Primary path: Gemini Live API (real-time 24kHz PCM with expressive systemInstruction & high quota)
  const liveResult = await synthesizeViaLiveApi(ai, spec, chunkText);
  if (liveResult && liveResult.pcm.length > 0) {
    if (liveResult.complete) {
      const wavBuf = buildWavBufferFromPcm(liveResult.pcm, 24000);
      cacheTtsAudio(spec.persona, chunkText, wavBuf.toString('base64'), true);
    }
    return liveResult.pcm;
  }

  // 2. Secondary path: Standard TTS models if available
  if (isModelAvailable('gemini-2.5-flash-preview-tts')) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [
          {
            role: 'user',
            parts: [{ text: `${spec.style}: "${chunkText}"` }],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: spec.voiceName },
            },
          },
        },
      });
      const rawBase64 = extractWavBase64(response);
      if (rawBase64) {
        const buf = Buffer.from(rawBase64, 'base64');
        const pcm =
          buf.length >= 44 && buf.toString('ascii', 0, 4) === 'RIFF' ? buf.subarray(44) : buf;
        if (pcm.length > 0) {
          const wavBuf = buildWavBufferFromPcm(pcm, 24000);
          cacheTtsAudio(spec.persona, chunkText, wavBuf.toString('base64'), true);
          return pcm;
        }
      }
    } catch (err) {
      lastTtsDebugError = `Error on 2.5-tts: ${err instanceof Error ? err.message : String(err)}`;
      recordModelError('gemini-2.5-flash-preview-tts', err);
    }
  }

  // 3. Fallback to secondary Studio TTS models if available
  for (const model of ['gemini-3.8-flash-tts', 'gemini-3.8-flash-lite-tts']) {
    if (!isModelAvailable(model)) continue;
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: chunkText,
                speechMetadata: {
                  style: spec.style,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            languageCode: 'id-ID',
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: spec.voiceName },
            },
          },
        },
      });
      const rawBase64 = extractWavBase64(response);
      if (rawBase64) {
        const buf = Buffer.from(rawBase64, 'base64');
        const pcm =
          buf.length >= 44 && buf.toString('ascii', 0, 4) === 'RIFF' ? buf.subarray(44) : buf;
        if (pcm.length > 0) {
          const wavBuf = buildWavBufferFromPcm(pcm, 24000);
          cacheTtsAudio(spec.persona, chunkText, wavBuf.toString('base64'), true);
          return pcm;
        }
      }
    } catch (err) {
      recordModelError(model, err);
    }
  }

  return null;
}

async function synthesizePersonaSpeech(
  ai: GoogleGenAI,
  persona: StudioPersona,
  text: string
): Promise<string | null> {
  const cached = getCachedTtsAudio(persona, text);
  if (cached) return cached;

  const flightKey = getCacheKey(persona, text);
  const existingPromise = inFlightTts.get(flightKey);
  if (existingPromise) {
    return existingPromise;
  }

  const spec = resolvePersonaSpec(persona);

  const run = (async () => {
    const pcm = await synthesizeSingleChunkPcm(ai, spec, text);
    if (pcm && pcm.length > 0) {
      const wavBuf = buildWavBufferFromPcm(pcm, 24000);
      const wavBase64 = wavBuf.toString('base64');
      cacheTtsAudio(persona, text, wavBase64, true);
      return wavBase64;
    }
    return null;
  })();

  inFlightTts.set(flightKey, run);
  try {
    return await run;
  } finally {
    inFlightTts.delete(flightKey);
  }
}

function cacheTtsAudio(persona: StudioPersona, cleanText: string, wavBase64: string, writeDisk = true) {
  const wavBuf = ensureWavBuffer(Buffer.from(wavBase64, 'base64'), 24000);
  const normalizedBase64 = wavBuf.toString('base64');
  const cacheKey = getCacheKey(persona, cleanText);
  if (ttsAudioCache.size >= MAX_TTS_CACHE_ENTRIES) {
    const oldestKey = ttsAudioCache.keys().next().value;
    if (oldestKey) {
      ttsAudioCache.delete(oldestKey);
    }
  }
  ttsAudioCache.set(cacheKey, normalizedBase64);

  if (writeDisk) {
    try {
      const filePath = path.join(DISK_TTS_CACHE_DIR, `${getCacheHash(persona, cleanText)}.wav`);
      fs.writeFileSync(filePath, wavBuf);
    } catch {
      // Ignore disk cache write errors
    }
  }
}

let lastTtsDebugError = '';

async function handleUnaryTtsRequest(req: Request, res: Response, defaultPersona?: StudioPersona) {
  const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
  const cleanText = rawText.replace(/["[\]]/g, '').trim().slice(0, MAX_TTS_TEXT_CHARS);
  const { persona } = resolvePersonaSpec(defaultPersona ?? req.body?.persona);

  if (!cleanText) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  const cached = getCachedTtsAudio(persona, cleanText);
  if (cached) {
    res.json({ mimeType: 'audio/wav', audioBase64: cached, persona });
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(200).json({ fallback: true, persona, reason: 'no_api_key' });
    return;
  }

  try {
    const audioBase64 = await synthesizePersonaSpeech(ai, persona, cleanText);
    if (!audioBase64) {
      res.status(200).json({ fallback: true, persona, reason: lastTtsDebugError });
      return;
    }

    res.json({ mimeType: 'audio/wav', audioBase64, persona });
  } catch (err) {
    res.status(200).json({ fallback: true, persona, reason: String(err) });
  }
}

async function handleStreamTtsRequest(req: Request, res: Response, defaultPersona?: StudioPersona) {
  const rawText = typeof req.body?.text === 'string' ? req.body.text : '';
  const cleanText = rawText.replace(/["[\]]/g, '').trim().slice(0, MAX_TTS_TEXT_CHARS);
  const spec = resolvePersonaSpec(defaultPersona ?? req.body?.persona);
  const { persona } = spec;

  if (!cleanText) {
    res.status(400).json({ error: 'Text is required' });
    return;
  }

  const cached = getCachedTtsAudio(persona, cleanText);
  if (cached) {
    const wavBuf = Buffer.from(cached, 'base64');
    res.setHeader('Content-Type', 'audio/wav');
    res.setHeader('Cache-Control', 'no-store');
    res.send(wavBuf);
    return;
  }

  const ai = getGeminiClient();
  if (!ai) {
    res.status(200).json({ fallback: true, persona });
    return;
  }

  // If unary synthesis is already in-flight for this exact persona & text, await it instead of issuing a duplicate API request
  const flightKey = getCacheKey(persona, cleanText);
  const pendingUnary = inFlightTts.get(flightKey);
  if (pendingUnary) {
    try {
      const audioBase64 = await pendingUnary;
      if (audioBase64 && !res.headersSent) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(audioBase64, 'base64'));
        return;
      }
    } catch {
      // Fall through to stream attempt
    }
  }

  let clientClosed = false;
  res.on('close', () => {
    clientClosed = true;
  });

  // Stream real-time 24kHz PCM chunks directly as they arrive from Gemini Live API
  let streamedAny = false;
  try {
    const liveResult = await synthesizeViaLiveApi(
      ai,
      spec,
      cleanText,
      (chunk) => {
        if (clientClosed) return;
        if (!res.headersSent) {
          res.setHeader('Content-Type', 'audio/l16; rate=24000; channels=1');
          res.setHeader('Cache-Control', 'no-store');
          res.flushHeaders?.();
        }
        res.write(chunk);
        streamedAny = true;
      },
      () => clientClosed
    );

    if (liveResult && liveResult.pcm.length > 0) {
      if (liveResult.complete) {
        const wavBuf = buildWavBufferFromPcm(liveResult.pcm, 24000);
        cacheTtsAudio(persona, cleanText, wavBuf.toString('base64'), true);
      }
      if (!clientClosed) {
        res.end();
      }
      return;
    }
  } catch {
    if (res.headersSent) {
      if (!clientClosed) {
        res.end();
      }
      return;
    }
  }

  if (streamedAny) {
    if (!clientClosed) {
      res.end();
    }
    return;
  }

  // Fallback to unary synthesis if Live API streaming did not produce chunks
  if (!clientClosed && !res.headersSent) {
    try {
      const unaryBase64 = await synthesizePersonaSpeech(ai, persona, cleanText);
      if (unaryBase64 && !clientClosed) {
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Cache-Control', 'no-store');
        res.send(Buffer.from(unaryBase64, 'base64'));
        return;
      }
    } catch {
      // Fall through
    }
  }

  if (!res.headersSent) {
    res.status(200).json({ fallback: true, persona });
  } else if (!clientClosed) {
    res.end();
  }
}

// ============================================================================
// HIGH-CONCURRENCY GOOGLE APPS SCRIPT LEADERBOARD ENGINE
// ============================================================================

const DEFAULT_APPS_SCRIPT_URL =
  process.env.GOOGLE_APPS_SCRIPT_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbwMV5ZI8PXFlSmOosLZtJBkqpd-491JqAcrkvUdWOrBp_jrowNtPcesTAI3jWGwJ7tfRw/exec';

const LEADERBOARD_DISK_CACHE_FILE = path.join(os.tmpdir(), 'pbn-leaderboard-cache-v1.json');

interface ServerLeaderboardRecord {
  sessionId: string;
  timestamp: string;
  playerName: string;
  schoolName: string;
  studentClass: string;
  gameMode: string;
  playerSlot: string;
  difficulty: string;
  c1: number;
  c2: number;
  c3: number;
  c4: number;
  c5: number;
  c6: number;
  totalScore: number;
  starsText: string;
  title: string;
  statusText: string;
  syncedToSheet?: boolean;
}

const leaderboardMemMap = new Map<string, ServerLeaderboardRecord>();
let lastRemoteFetchMs = 0;
let remoteFetchInFlight: Promise<void> | null = null;

function parseClassSchoolPair(rawClass?: string, rawSchool?: string) {
  const explicitSchool = (rawSchool || '').trim();
  const raw = (rawClass || 'Kelas V (Fase C)').trim();
  if (raw.includes('|')) {
    const parts = raw.split('|').map((s) => s.trim());
    return {
      studentClass: parts[0] || 'Kelas V (Fase C)',
      schoolName: explicitSchool || parts.slice(1).join(' ').trim() || 'SDN 2 GIRIMARTO',
    };
  }
  return {
    studentClass: raw || 'Kelas V (Fase C)',
    schoolName: explicitSchool || 'SDN 2 GIRIMARTO',
  };
}

function getPredicateForScore(score: number) {
  if (score >= 90) {
    return {
      starsText: '⭐⭐⭐ (3 Bintang)',
      title: 'Penjaga Bumi Teladan Nusantara',
      statusText: 'TUNTAS ISTIMEWA',
    };
  }
  if (score >= 75) {
    return {
      starsText: '⭐⭐ (2 Bintang)',
      title: 'Penjaga Alam Bijaksana',
      statusText: 'TUNTAS BAIK',
    };
  }
  if (score >= 60) {
    return {
      starsText: '⭐ (1 Bintang)',
      title: 'Sahabat Lingkungan Cilik',
      statusText: 'TUNTAS CUKUP',
    };
  }
  return {
    starsText: '🌱 (Perlu Remedial)',
    title: 'Calon Penjaga Bumi Cilik',
    statusText: 'PERLU PENDAMPINGAN / REMEDIAL',
  };
}

function loadLeaderboardDiskCache() {
  try {
    if (fs.existsSync(LEADERBOARD_DISK_CACHE_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(LEADERBOARD_DISK_CACHE_FILE, 'utf8'));
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (item && typeof item.sessionId === 'string') {
            leaderboardMemMap.set(item.sessionId, item);
          }
        }
      }
    }
  } catch {
    // Ignore disk read error
  }
}

function saveLeaderboardDiskCache() {
  try {
    const arr = Array.from(leaderboardMemMap.values()).slice(-600);
    fs.writeFileSync(LEADERBOARD_DISK_CACHE_FILE, JSON.stringify(arr), 'utf8');
  } catch {
    // Ignore disk write error
  }
}

loadLeaderboardDiskCache();

// Background queue with concurrency control (max 2 parallel requests) + exponential backoff + jitter
interface QueuedSheetTask {
  sessionId: string;
  payload: Record<string, unknown>;
  attempt: number;
  resolveInitial?: (synced: boolean) => void;
}

const sheetWriteQueue: QueuedSheetTask[] = [];
let activeSheetWorkers = 0;
const MAX_CONCURRENT_SHEET_WORKERS = 2;

async function postToGoogleAppsScript(payload: Record<string, unknown>): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 14000);
  try {
    const response = await fetch(DEFAULT_APPS_SCRIPT_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
      },
      body: JSON.stringify(payload),
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) return false;
    const text = await response.text();
    try {
      const json = JSON.parse(text);
      return json && (json.status === 'success' || json.status === 'online');
    } catch {
      return response.status === 200;
    }
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function pumpSheetWriteQueue() {
  while (
    activeSheetWorkers < MAX_CONCURRENT_SHEET_WORKERS &&
    sheetWriteQueue.length > 0
  ) {
    const task = sheetWriteQueue.shift();
    if (!task) break;
    activeSheetWorkers += 1;

    void (async () => {
      try {
        const ok = await postToGoogleAppsScript(task.payload);
        if (ok) {
          const rec = leaderboardMemMap.get(task.sessionId);
          if (rec) rec.syncedToSheet = true;
          const recP2 = leaderboardMemMap.get(`${task.sessionId}-P2`);
          if (recP2) recP2.syncedToSheet = true;
          saveLeaderboardDiskCache();
          task.resolveInitial?.(true);
        } else if (task.attempt < 4) {
          const backoffMs =
            Math.min(4500, 380 * Math.pow(2, task.attempt)) +
            Math.floor(Math.random() * 320);
          task.resolveInitial?.(false);
          task.resolveInitial = undefined;
          setTimeout(() => {
            sheetWriteQueue.push({
              ...task,
              attempt: task.attempt + 1,
            });
            pumpSheetWriteQueue();
          }, backoffMs);
        } else {
          task.resolveInitial?.(false);
        }
      } finally {
        activeSheetWorkers -= 1;
        pumpSheetWriteQueue();
      }
    })();
  }
}

async function syncFromGoogleAppsScript(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastRemoteFetchMs < 6000) return;
  if (remoteFetchInFlight) return remoteFetchInFlight;

  remoteFetchInFlight = (async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const url = `${DEFAULT_APPS_SCRIPT_URL}?action=leaderboard&limit=300&_t=${now}`;
      const res = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
        signal: controller.signal,
      });
      if (!res.ok) return;
      const json = (await res.json()) as {
        status?: string;
        data?: Array<Record<string, unknown>>;
      };
      if (json && Array.isArray(json.data)) {
        lastRemoteFetchMs = Date.now();
        json.data.forEach((raw, idx) => {
          const { studentClass, schoolName } = parseClassSchoolPair(
            typeof raw.studentClass === 'string' ? raw.studentClass : undefined,
            typeof raw.schoolName === 'string' ? raw.schoolName : undefined
          );
          const c1 = Number(raw.c1 ?? 0) || 0;
          const c2 = Number(raw.c2 ?? 0) || 0;
          const c3 = Number(raw.c3 ?? 0) || 0;
          const c4 = Number(raw.c4 ?? 0) || 0;
          const c5 = Number(raw.c5 ?? 0) || 0;
          const c6 = Number(raw.c6 ?? 0) || 0;
          const totalScore = Number(raw.totalScore ?? c1 + c2 + c3 + c4 + c5 + c6) || 0;
          const pred = getPredicateForScore(totalScore);
          const playerName =
            typeof raw.playerName === 'string' && raw.playerName.trim()
              ? raw.playerName.trim()
              : 'Penjaga Cilik';
          const sessionId =
            typeof raw.sessionId === 'string' && raw.sessionId.trim()
              ? raw.sessionId.trim()
              : `SHEET-ROW-${idx}-${playerName}-${totalScore}`;

          const existing = leaderboardMemMap.get(sessionId);
          if (existing && existing.totalScore > totalScore) {
            return;
          }
          leaderboardMemMap.set(sessionId, {
            sessionId,
            timestamp:
              typeof raw.timestamp === 'string' && raw.timestamp.trim()
                ? raw.timestamp.trim()
                : existing?.timestamp || new Date().toISOString().replace('T', ' ').slice(0, 19),
            playerName,
            schoolName: existing?.schoolName || schoolName,
            studentClass,
            gameMode:
              typeof raw.gameMode === 'string' && raw.gameMode.trim()
                ? raw.gameMode.trim()
                : '1P Petualangan',
            playerSlot:
              typeof raw.playerSlot === 'string' && raw.playerSlot.trim()
                ? raw.playerSlot.trim()
                : 'Pemain Utama (1P)',
            difficulty:
              typeof raw.difficulty === 'string' && raw.difficulty.trim()
                ? raw.difficulty.trim().toUpperCase()
                : 'SEDANG',
            c1,
            c2,
            c3,
            c4,
            c5,
            c6,
            totalScore,
            starsText:
              typeof raw.starsText === 'string' && raw.starsText.trim()
                ? raw.starsText.trim()
                : pred.starsText,
            title:
              typeof raw.title === 'string' && raw.title.trim()
                ? raw.title.trim()
                : pred.title,
            statusText:
              typeof raw.statusText === 'string' && raw.statusText.trim()
                ? raw.statusText.trim()
                : pred.statusText,
            syncedToSheet: true,
          });
        });
        saveLeaderboardDiskCache();
      }
    } catch {
      // Keep local cache intact if network/Apps Script is temporarily busy
    } finally {
      clearTimeout(timeout);
      remoteFetchInFlight = null;
    }
  })();

  return remoteFetchInFlight;
}

const lastSentSignatureBySession = new Map<string, string>();

function getSortedLeaderboardList(): ServerLeaderboardRecord[] {
  const list = Array.from(leaderboardMemMap.values());
  list.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    if (b.c6 !== a.c6) return b.c6 - a.c6;
    if (b.c5 !== a.c5) return b.c5 - a.c5;
    if (b.c4 !== a.c4) return b.c4 - a.c4;
    return String(b.timestamp).localeCompare(String(a.timestamp));
  });
  return list;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.post('/api/tts/speak', (req: Request, res: Response) =>
    handleUnaryTtsRequest(req, res)
  );
  app.post('/api/tts/stream', (req: Request, res: Response) =>
    handleStreamTtsRequest(req, res)
  );

  app.post('/api/tts/ilyas', (req: Request, res: Response) =>
    handleUnaryTtsRequest(req, res, 'ilyas')
  );
  app.post('/api/tts/ilyas-stream', (req: Request, res: Response) =>
    handleStreamTtsRequest(req, res, 'ilyas')
  );

  app.post('/api/tts/rahma', (req: Request, res: Response) =>
    handleUnaryTtsRequest(req, res, 'rahma')
  );
  app.post('/api/tts/rahma-stream', (req: Request, res: Response) =>
    handleStreamTtsRequest(req, res, 'rahma')
  );

  // GET /api/leaderboard/list - Returns live merged leaderboard from Google Spreadsheet + high-concurrency cache
  app.get('/api/leaderboard/list', async (req: Request, res: Response) => {
    const force = req.query.force === '1';
    await syncFromGoogleAppsScript(force);
    const data = getSortedLeaderboardList();
    res.json({
      status: 'success',
      count: data.length,
      queuePending: sheetWriteQueue.length + activeSheetWorkers,
      data,
    });
  });

  // POST /api/leaderboard/submit - High-concurrency submission to Google Spreadsheet + immediate ranking
  app.post('/api/leaderboard/submit', async (req: Request, res: Response) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const nowFormatted = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Asia/Jakarta',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date());

      const sessionId =
        typeof body.sessionId === 'string' && body.sessionId.trim()
          ? body.sessionId.trim()
          : `PBN-${Date.now()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

      const rawSchool =
        typeof body.schoolName === 'string' && body.schoolName.trim()
          ? body.schoolName.trim()
          : 'SDN 2 GIRIMARTO';
      const rawClass =
        typeof body.studentClass === 'string' && body.studentClass.trim()
          ? body.studentClass.trim().split('|')[0].trim()
          : 'Kelas V (Fase C)';
      const combinedClassForSheet = `${rawClass} | ${rawSchool}`;

      const scores = (body.scores ?? {}) as Record<string, number>;
      const c1 = Number(scores.c1 ?? 0) || 0;
      const c2 = Number(scores.c2 ?? 0) || 0;
      const c3 = Number(scores.c3 ?? 0) || 0;
      const c4 = Number(scores.c4 ?? 0) || 0;
      const c5 = Number(scores.c5 ?? 0) || 0;
      const c6 = Number(scores.c6 ?? 0) || 0;
      const totalScore =
        typeof body.totalScore === 'number'
          ? body.totalScore
          : Math.min(100, Math.round((c1 + c2 + c3 + c4 + c5 + c6) * 10) / 10);
      const pred1 = getPredicateForScore(totalScore);

      const isTwoPlayer = Boolean(body.isTwoPlayer);
      const playerName =
        typeof body.playerName === 'string' && body.playerName.trim()
          ? body.playerName.trim()
          : 'Penjaga Cilik';
      const player2Name =
        typeof body.player2Name === 'string' && body.player2Name.trim()
          ? body.player2Name.trim()
          : 'Pemain 2';
      const gameMode =
        typeof body.gameMode === 'string' && body.gameMode.trim()
          ? body.gameMode.trim()
          : isTwoPlayer
          ? '2P Split Screen'
          : '1P Petualangan';
      const difficulty =
        typeof body.difficulty === 'string' && body.difficulty.trim()
          ? body.difficulty.trim().toUpperCase()
          : 'SEDANG';

      const p2Scores = (body.p2Scores ?? {}) as Record<string, number>;
      const p2c1 = Number(p2Scores.c1 ?? 0) || 0;
      const p2c2 = Number(p2Scores.c2 ?? 0) || 0;
      const p2c3 = Number(p2Scores.c3 ?? 0) || 0;
      const p2c4 = Number(p2Scores.c4 ?? 0) || 0;
      const p2c5 = Number(p2Scores.c5 ?? 0) || 0;
      const p2c6 = Number(p2Scores.c6 ?? 0) || 0;
      const p2TotalScore =
        typeof body.p2TotalScore === 'number'
          ? body.p2TotalScore
          : Math.min(
              100,
              Math.round((p2c1 + p2c2 + p2c3 + p2c4 + p2c5 + p2c6) * 10) / 10
            );

      const evalLen = Array.isArray(body.evaluationLog) ? body.evaluationLog.length : 0;
      const p2EvalLen = Array.isArray(body.p2EvaluationLog) ? body.p2EvaluationLog.length : 0;
      const payloadSignature = `${playerName}|${player2Name}|${rawSchool}|${rawClass}|${gameMode}|${difficulty}|${c1},${c2},${c3},${c4},${c5},${c6}|${totalScore}|${p2TotalScore}|${evalLen}|${p2EvalLen}`;

      // Upsert Player 1 into immediate memory store
      const prevRec = leaderboardMemMap.get(sessionId);
      leaderboardMemMap.set(sessionId, {
        sessionId,
        timestamp: nowFormatted,
        playerName,
        schoolName: rawSchool,
        studentClass: rawClass,
        gameMode,
        playerSlot: isTwoPlayer ? 'Pemain 1 (Kiri)' : 'Pemain Utama (1P)',
        difficulty,
        c1,
        c2,
        c3,
        c4,
        c5,
        c6,
        totalScore,
        starsText: pred1.starsText,
        title: pred1.title,
        statusText: pred1.statusText,
        syncedToSheet: prevRec?.syncedToSheet ?? false,
      });

      // If 2P Split Screen, also upsert Player 2
      if (isTwoPlayer && player2Name) {
        const pred2 = getPredicateForScore(p2TotalScore);
        const prevP2 = leaderboardMemMap.get(`${sessionId}-P2`);

        leaderboardMemMap.set(`${sessionId}-P2`, {
          sessionId: `${sessionId}-P2`,
          timestamp: nowFormatted,
          playerName: player2Name,
          schoolName: rawSchool,
          studentClass: rawClass,
          gameMode: '2P Split Screen',
          playerSlot: 'Pemain 2 (Kanan)',
          difficulty,
          c1: p2c1,
          c2: p2c2,
          c3: p2c3,
          c4: p2c4,
          c5: p2c5,
          c6: p2c6,
          totalScore: p2TotalScore,
          starsText: pred2.starsText,
          title: pred2.title,
          statusText: pred2.statusText,
          syncedToSheet: prevP2?.syncedToSheet ?? false,
        });
      }

      saveLeaderboardDiskCache();

      // If this exact snapshot was already synced/queued for this session, skip duplicate sheet write
      if (lastSentSignatureBySession.get(sessionId) === payloadSignature) {
        const data = getSortedLeaderboardList();
        res.json({
          status: 'success',
          sessionId,
          syncedToSheet: true,
          queuedForRetry: false,
          count: data.length,
          data,
        });
        return;
      }

      lastSentSignatureBySession.set(sessionId, payloadSignature);

      // Forward payload to Google Apps Script via concurrency-controlled queue
      const sheetPayload: Record<string, unknown> = {
        ...body,
        sessionId,
        playerName,
        player2Name,
        schoolName: rawSchool,
        studentClass: combinedClassForSheet,
        gameMode,
        difficulty,
        totalScore,
        p2TotalScore,
      };

      // If a pending task for this sessionId is still waiting in queue, update its payload in place
      const existingQueuedTask = sheetWriteQueue.find((t) => t.sessionId === sessionId);
      if (existingQueuedTask) {
        existingQueuedTask.payload = sheetPayload;
        const data = getSortedLeaderboardList();
        res.json({
          status: 'success',
          sessionId,
          syncedToSheet: false,
          queuedForRetry: true,
          count: data.length,
          data,
        });
        return;
      }

      const syncedImmediately = await new Promise<boolean>((resolve) => {
        const timer = setTimeout(() => resolve(false), 3200);
        sheetWriteQueue.push({
          sessionId,
          payload: sheetPayload,
          attempt: 0,
          resolveInitial: (ok) => {
            clearTimeout(timer);
            resolve(ok);
          },
        });
        pumpSheetWriteQueue();
      });

      // Trigger non-blocking pull if cache is cold
      if (leaderboardMemMap.size <= 2) {
        void syncFromGoogleAppsScript(false);
      }

      const data = getSortedLeaderboardList();
      res.json({
        status: 'success',
        sessionId,
        syncedToSheet: syncedImmediately,
        queuedForRetry: !syncedImmediately,
        count: data.length,
        data,
      });
    } catch (err) {
      res.status(500).json({
        status: 'error',
        message: err instanceof Error ? err.message : String(err),
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const port = Number(process.env.PORT) || 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${port}`);
  });
}

void startServer();

