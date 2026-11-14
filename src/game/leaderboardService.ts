import {
  GOOGLE_APPS_SCRIPT_URL,
  LeaderboardEntry,
  RankedLeaderboardEntry,
  LevelScoreMap,
  formatClassWithSchool,
  normalizeLeaderboardEntry,
  rankAndDeduplicateLeaderboard,
} from './rules';
import { AnswerEvaluationRecord } from './evaluationLog';

const LOCAL_STORAGE_KEY = 'pbn_leaderboard_entries_v1';

export interface SubmitLeaderboardPayload {
  sessionId: string;
  playerName: string;
  player2Name?: string;
  schoolName: string;
  studentClass: string;
  gameMode: string;
  difficulty: string;
  isTwoPlayer: boolean;
  scores: LevelScoreMap;
  p2Scores?: LevelScoreMap;
  totalScore: number;
  p2TotalScore?: number;
  ecoHealth: number;
  amanah: number;
  evaluationLog?: readonly AnswerEvaluationRecord[];
  p2EvaluationLog?: readonly AnswerEvaluationRecord[];
}

export interface SubmitLeaderboardResult {
  ok: boolean;
  syncedToSheet: boolean;
  queuedForRetry: boolean;
  rankedEntries: RankedLeaderboardEntry[];
}

function readLocalCache(): LeaderboardEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => normalizeLeaderboardEntry(item, idx));
  } catch {
    return [];
  }
}

function writeLocalCache(entries: readonly LeaderboardEntry[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(
      LOCAL_STORAGE_KEY,
      JSON.stringify(entries.slice(0, 300))
    );
  } catch {
    // Ignore storage quota errors
  }
}

function buildOptimisticLocalEntries(payload: SubmitLeaderboardPayload): LeaderboardEntry[] {
  const nowStr = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const cleanSchool = (payload.schoolName || 'SDN 2 GIRIMARTO').trim() || 'SDN 2 GIRIMARTO';
  const cleanClass = (payload.studentClass || 'Kelas V (Fase C)').split('|')[0].trim();

  const p1Entry = normalizeLeaderboardEntry({
    sessionId: payload.sessionId,
    timestamp: nowStr,
    playerName: payload.playerName || 'Penjaga Cilik',
    schoolName: cleanSchool,
    studentClass: cleanClass,
    gameMode: payload.gameMode,
    playerSlot: payload.isTwoPlayer ? 'Pemain 1 (Kiri)' : 'Pemain Utama (1P)',
    difficulty: payload.difficulty,
    c1: payload.scores.c1,
    c2: payload.scores.c2,
    c3: payload.scores.c3,
    c4: payload.scores.c4,
    c5: payload.scores.c5,
    c6: payload.scores.c6,
    totalScore: payload.totalScore,
  });

  const list: LeaderboardEntry[] = [p1Entry];

  if (payload.isTwoPlayer && payload.player2Name && payload.p2Scores) {
    const p2Entry = normalizeLeaderboardEntry({
      sessionId: `${payload.sessionId}-P2`,
      timestamp: nowStr,
      playerName: payload.player2Name,
      schoolName: cleanSchool,
      studentClass: cleanClass,
      gameMode: '2P Split Screen',
      playerSlot: 'Pemain 2 (Kanan)',
      difficulty: payload.difficulty,
      c1: payload.p2Scores.c1,
      c2: payload.p2Scores.c2,
      c3: payload.p2Scores.c3,
      c4: payload.p2Scores.c4,
      c5: payload.p2Scores.c5,
      c6: payload.p2Scores.c6,
      totalScore: payload.p2TotalScore ?? 0,
    });
    list.push(p2Entry);
  }

  return list;
}

async function postDirectlyToAppsScriptWithRetry(
  payload: SubmitLeaderboardPayload,
  maxAttempts = 3
): Promise<boolean> {
  const sheetBody = {
    ...payload,
    studentClass: formatClassWithSchool(payload.studentClass, payload.schoolName),
    schoolName: payload.schoolName || 'SDN 2 GIRIMARTO',
  };

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delayMs = 350 * Math.pow(2, attempt - 1) + Math.floor(Math.random() * 260);
      await new Promise((r) => setTimeout(r, delayMs));
    }
    try {
      const res = await fetch(GOOGLE_APPS_SCRIPT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8',
        },
        body: JSON.stringify(sheetBody),
        redirect: 'follow',
      });
      if (res.ok) {
        return true;
      }
    } catch {
      // Retry on transient error
    }
  }
  return false;
}

export async function submitScoreAndFetchLeaderboard(
  payload: SubmitLeaderboardPayload
): Promise<SubmitLeaderboardResult> {
  const optimistic = buildOptimisticLocalEntries(payload);
  const existingLocal = readLocalCache();
  const mergedInitial = rankAndDeduplicateLeaderboard([
    ...optimistic,
    ...existingLocal,
  ]);
  writeLocalCache(mergedInitial);

  // 1. Primary path: High-concurrency Express Backend Queue (/api/leaderboard/submit)
  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = (await res.json()) as {
        status?: string;
        syncedToSheet?: boolean;
        queuedForRetry?: boolean;
        data?: Array<Record<string, unknown>>;
      };
      const serverEntries = Array.isArray(json.data)
        ? json.data.map((r, i) => normalizeLeaderboardEntry(r, i))
        : [];
      const ranked = rankAndDeduplicateLeaderboard([
        ...optimistic,
        ...serverEntries,
        ...existingLocal,
      ]);
      writeLocalCache(ranked);
      return {
        ok: true,
        syncedToSheet: Boolean(json.syncedToSheet),
        queuedForRetry: Boolean(json.queuedForRetry),
        rankedEntries: ranked,
      };
    }
  } catch {
    // Fall back to direct Google Apps Script call
  }

  // 2. Fallback path: Direct client-to-Google Apps Script with exponential backoff + jitter
  const directOk = await postDirectlyToAppsScriptWithRetry(payload, 3);
  const remoteList = await fetchLeaderboardEntries(true);
  const finalRanked = rankAndDeduplicateLeaderboard([
    ...optimistic,
    ...remoteList,
    ...existingLocal,
  ]);
  writeLocalCache(finalRanked);

  return {
    ok: directOk,
    syncedToSheet: directOk,
    queuedForRetry: !directOk,
    rankedEntries: finalRanked,
  };
}

/**
 * Non-blocking real-time checkpoint sync called immediately at Login (Setup -> Arena),
 * whenever a player answers/scores in any level (even 1 level or partial progress),
 * and on early exit / pagehide so all logins and activities are recorded in the Spreadsheet.
 */
export async function syncProgressCheckpoint(
  payload: SubmitLeaderboardPayload,
  keepalive = false
): Promise<void> {
  const optimistic = buildOptimisticLocalEntries(payload);
  const existingLocal = readLocalCache();
  const mergedInitial = rankAndDeduplicateLeaderboard([
    ...optimistic,
    ...existingLocal,
  ]);
  writeLocalCache(mergedInitial);

  try {
    const res = await fetch('/api/leaderboard/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      keepalive,
    });
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(json.data)) {
        const serverEntries = json.data.map((r, i) => normalizeLeaderboardEntry(r, i));
        const ranked = rankAndDeduplicateLeaderboard([
          ...optimistic,
          ...serverEntries,
          ...existingLocal,
        ]);
        writeLocalCache(ranked);
      }
      return;
    }
  } catch {
    // Fallback to direct Apps Script POST below
  }

  await postDirectlyToAppsScriptWithRetry(payload, keepalive ? 1 : 2);
}


export async function fetchLeaderboardEntries(
  forceRefresh = false
): Promise<RankedLeaderboardEntry[]> {
  const localEntries = readLocalCache();

  // 1. Try backend proxy first
  try {
    const res = await fetch(
      `/api/leaderboard/list${forceRefresh ? '?force=1' : ''}`
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(json.data)) {
        const normalized = json.data.map((r, i) => normalizeLeaderboardEntry(r, i));
        const ranked = rankAndDeduplicateLeaderboard([
          ...normalized,
          ...localEntries,
        ]);
        writeLocalCache(ranked);
        return ranked;
      }
    }
  } catch {
    // Fall through to direct Google Apps Script GET
  }

  // 2. Direct GET to Google Apps Script
  try {
    const res = await fetch(
      `${GOOGLE_APPS_SCRIPT_URL}?action=leaderboard&limit=300&_t=${Date.now()}`,
      {
        method: 'GET',
        redirect: 'follow',
      }
    );
    if (res.ok) {
      const json = (await res.json()) as {
        data?: Array<Record<string, unknown>>;
      };
      if (Array.isArray(json.data)) {
        const normalized = json.data.map((r, i) => normalizeLeaderboardEntry(r, i));
        const ranked = rankAndDeduplicateLeaderboard([
          ...normalized,
          ...localEntries,
        ]);
        writeLocalCache(ranked);
        return ranked;
      }
    }
  } catch {
    // Return local cache if offline
  }

  return rankAndDeduplicateLeaderboard(localEntries);
}
