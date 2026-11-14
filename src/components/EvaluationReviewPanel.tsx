import React, { useMemo, useState } from 'react';
import {
  AnswerEvaluationRecord,
  buildReferenceEvaluationBank,
} from '../game/evaluationLog';
import { LEVEL_METADATA } from '../game/blueprintData';
import { audioEngine } from '../game/audioEngine';

export interface EvaluationReviewPanelProps {
  variant: 'remedial' | 'result';
  records: readonly AnswerEvaluationRecord[];
  p2Records?: readonly AnswerEvaluationRecord[];
  isTwoPlayer?: boolean;
  playerName: string;
  player2Name?: string;
  activeLevel?: number; // Used in remedial mode to prioritize current level
  lastMistakeNote?: string | null;
}

export const EvaluationReviewPanel: React.FC<EvaluationReviewPanelProps> = ({
  variant,
  records,
  p2Records = [],
  isTwoPlayer = false,
  playerName,
  player2Name = 'Pemain 2',
  activeLevel,
  lastMistakeNote,
}) => {
  const [selectedSlot, setSelectedSlot] = useState<1 | 2>(1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'attention' | 'perfect'>('all');
  const [levelFilter, setLevelFilter] = useState<number>(0); // 0 = Semua Level
  const [includeUnplayedRef, setIncludeUnplayedRef] = useState<boolean>(false);
  const [expandedList, setExpandedList] = useState<boolean>(false);

  const referenceBank = useMemo(() => buildReferenceEvaluationBank(), []);

  if (variant === 'remedial') {
    const targetLevel = activeLevel ?? 1;
    const levelRecords = records
      .filter((r) => r.level === targetLevel)
      .sort((a, b) => {
        // Prioritize unresolved / wrong attempts first so students see what to improve
        const scoreA = !a.isResolved ? 0 : !a.firstAttemptCorrect ? 1 : 2;
        const scoreB = !b.isResolved ? 0 : !b.firstAttemptCorrect ? 1 : 2;
        if (scoreA !== scoreB) return scoreA - scoreB;
        return b.updatedAt - a.updatedAt;
      });

    const needsAttentionCount = levelRecords.filter(
      (r) => !r.isResolved || !r.firstAttemptCorrect
    ).length;

    const displayRecords =
      levelRecords.length > 0
        ? levelRecords
        : referenceBank.filter((r) => r.level === targetLevel).slice(0, 4);

    const isReferenceFallback = levelRecords.length === 0;
    const lvMeta = LEVEL_METADATA[targetLevel - 1] || LEVEL_METADATA[0];

    return (
      <section
        aria-label="Rincian Evaluasi Jawaban dan Pembahasan Singkat"
        data-testid="remedial-evaluation-panel"
        className="mt-4 text-left bg-white/85 border-2 border-amber-500/70 rounded-2xl p-3.5 md:p-4 shadow-inner"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-300/80 pb-2">
          <div>
            <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-900">
              📋 Rincian Evaluasi Jawaban &amp; Pembahasan Singkat
            </div>
            <div className="text-xs font-bold text-stone-700">
              Level {lvMeta.level} ({lvMeta.bloomCode}) · {lvMeta.name}
            </div>
          </div>
          {!isReferenceFallback ? (
            <div className="flex flex-wrap gap-1.5 text-[11px] font-extrabold">
              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-400">
                💡 Perlu Diperhatikan: {needsAttentionCount}
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-400">
                ✅ Sudah Tepat: {levelRecords.filter((r) => r.isResolved).length}
              </span>
            </div>
          ) : (
            <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-900 border border-amber-400 text-[11px] font-bold">
              📖 Panduan Singkat Level {targetLevel}
            </span>
          )}
        </div>

        {lastMistakeNote && (
          <div className="mt-2.5 bg-amber-50 border border-amber-400/80 rounded-xl px-3 py-2 text-xs text-stone-800 leading-relaxed">
            <strong className="text-amber-900">💬 Catatan Pendamping:</strong> {lastMistakeNote}
          </div>
        )}

        <div className="mt-2.5 max-h-56 md:max-h-64 overflow-y-auto space-y-2.5 pr-1">
          {displayRecords.map((item) => {
            const badge = isReferenceFallback
              ? { label: '📖 Ringkasan Materi', cls: 'bg-sky-100 text-sky-900 border-sky-300' }
              : !item.isResolved
              ? { label: '💡 Belum Selesai — Yuk Pelajari', cls: 'bg-amber-100 text-amber-950 border-amber-400' }
              : !item.firstAttemptCorrect
              ? { label: '🌱 Tepat Setelah Dibimbing', cls: 'bg-amber-50 text-amber-900 border-amber-300' }
              : { label: '✅ Tepat Langsung', cls: 'bg-emerald-100 text-emerald-900 border-emerald-400' };

            return (
              <div
                key={item.challengeKey}
                className="rounded-xl bg-amber-50/70 border border-amber-300/80 p-2.5 md:p-3 space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <span className="text-[11px] font-extrabold text-stone-900">
                    {item.phaseLabel} · {item.promptTitle}
                  </span>
                  <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${badge.cls}`}>
                    {badge.label}
                  </span>
                </div>
                <p className="text-xs text-stone-700 leading-snug">{item.questionText}</p>

                {!isReferenceFallback && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                    <div className="bg-white/90 border border-amber-200 rounded-lg px-2 py-1 text-stone-800">
                      <span className="font-bold text-amber-900">Pilihanmu: </span>
                      {item.wrongChoices.length > 0 ? (
                        <span>
                          {item.wrongChoices.join(' → ')}
                          {item.isResolved ? ` → ${item.lastUserAnswer}` : ''}
                        </span>
                      ) : (
                        <span>{item.lastUserAnswer}</span>
                      )}
                    </div>
                    <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 text-emerald-950">
                      <span className="font-bold text-emerald-800">Jawaban Tepat: </span>
                      <span className="font-semibold">{item.correctAnswer}</span>
                    </div>
                  </div>
                )}

                {isReferenceFallback && (
                  <div className="bg-emerald-50 border border-emerald-300 rounded-lg px-2 py-1 text-[11px] text-emerald-950">
                    <span className="font-bold text-emerald-800">Kunci Tepat: </span>
                    <span className="font-semibold">{item.correctAnswer}</span>
                  </div>
                )}

                <div className="bg-white border-l-4 border-emerald-500 rounded-r-lg px-2.5 py-1.5 text-[11px] text-stone-800 leading-relaxed">
                  <strong className="text-emerald-900">💡 Pembahasan Singkat:</strong> {item.explanation}
                </div>
              </div>
            );
          })}
        </div>
      </section>
    );
  }

  // RESULT / VICTORY VARIANT
  const activePlayerRecords = isTwoPlayer && selectedSlot === 2 ? p2Records : records;
  const activePlayerDisplayName = isTwoPlayer && selectedSlot === 2 ? player2Name : playerName;

  const hasRecordedAnswers = activePlayerRecords.length > 0;
  const recordedKeys = new Set(activePlayerRecords.map((r) => r.challengeKey));
  const unplayedRefRecords = referenceBank.filter((r) => !recordedKeys.has(r.challengeKey));

  const baseDataset: AnswerEvaluationRecord[] = !hasRecordedAnswers
    ? referenceBank
    : includeUnplayedRef
    ? [...activePlayerRecords, ...unplayedRefRecords]
    : [...activePlayerRecords];

  const totalRecorded = activePlayerRecords.length;
  const firstTryCount = activePlayerRecords.filter(
    (r) => r.firstAttemptCorrect && r.isResolved
  ).length;
  const guidedOrAttentionCount = activePlayerRecords.filter(
    (r) => !r.firstAttemptCorrect || !r.isResolved
  ).length;

  const filteredRecords = baseDataset.filter((item) => {
    if (levelFilter > 0 && item.level !== levelFilter) return false;
    if (statusFilter === 'attention') {
      return !item.firstAttemptCorrect || !item.isResolved;
    }
    if (statusFilter === 'perfect') {
      return item.firstAttemptCorrect && item.isResolved;
    }
    return true;
  });

  // Sort by Level 1 -> 6, keeping attention items highlighted cleanly within level or chronological
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    return 0;
  });

  return (
    <section
      aria-label="Rincian Evaluasi Jawaban dan Pembahasan Singkat"
      data-testid="result-evaluation-panel"
      className="bg-slate-950/95 border-2 border-amber-500/75 rounded-3xl p-5 md:p-6 shadow-2xl space-y-4 no-print"
    >
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div>
          <div className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
            UMPAN BALIK BELAJAR &amp; REFLEKSI JAWABAN (C1 – C6)
          </div>
          <h2 className="text-lg md:text-xl font-extrabold text-white mt-0.5">
            📋 Rincian Evaluasi Jawaban &amp; Pembahasan Singkat
          </h2>
          <p className="text-xs text-slate-300 mt-1">
            Menampilkan catatan jawaban {activePlayerDisplayName} beserta penjelasan singkat untuk memperkuat pemahaman.
          </p>
        </div>

        {isTwoPlayer && (
          <div className="flex items-center gap-2 bg-slate-900 p-1 rounded-xl border border-slate-700 self-start">
            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                setSelectedSlot(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                selectedSlot === 1
                  ? 'bg-emerald-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              👤 P1: {playerName}
            </button>
            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                setSelectedSlot(2);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-extrabold cursor-pointer transition-colors ${
                selectedSlot === 2
                  ? 'bg-sky-600 text-white shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              👤 P2: {player2Name}
            </button>
          </div>
        )}
      </div>

      {/* Ringkasan Statistik Evaluasi */}
      {hasRecordedAnswers ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-slate-400 uppercase">Tantangan Dijawab</div>
              <div className="text-xl font-extrabold text-white font-mono-num">{totalRecorded} Soal</div>
            </div>
            <span className="text-2xl">📝</span>
          </div>
          <div className="bg-emerald-950/60 border border-emerald-500/50 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-300 uppercase">Tepat Sekali Coba</div>
              <div className="text-xl font-extrabold text-emerald-300 font-mono-num">{firstTryCount} Soal</div>
            </div>
            <span className="text-2xl">🌟</span>
          </div>
          <div className="bg-amber-950/50 border border-amber-500/50 rounded-2xl p-3 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-300 uppercase">Dibimbing / Perlu Latihan</div>
              <div className="text-xl font-extrabold text-amber-300 font-mono-num">{guidedOrAttentionCount} Soal</div>
            </div>
            <span className="text-2xl">💡</span>
          </div>
        </div>
      ) : (
        <div className="bg-amber-950/50 border border-amber-500/60 rounded-2xl p-3.5 text-xs text-amber-100 leading-relaxed">
          <strong className="text-amber-300">📖 Mode Ringkasan Pembahasan:</strong> Belum ada riwayat
          jawaban langsung yang terekam pada sesi ini (misalnya karena lompat langsung ke halaman
          hasil). Berikut adalah kunci jawaban dan pembahasan singkat lengkap Level C1–C6 sebagai
          panduan belajar!
        </div>
      )}

      {/* Filter Status & Level */}
      <div className="flex flex-col gap-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                setStatusFilter('all');
              }}
              className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-emerald-600 border-emerald-400 text-white'
                  : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
              }`}
            >
              Semua ({baseDataset.length})
            </button>
            {hasRecordedAnswers && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setStatusFilter('attention');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                    statusFilter === 'attention'
                      ? 'bg-amber-500 border-amber-300 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-amber-300 hover:border-amber-500/60'
                  }`}
                >
                  💡 Perlu Dipelajari Ulang ({guidedOrAttentionCount})
                </button>
                <button
                  type="button"
                  onClick={() => {
                    audioEngine.playClickWood();
                    setStatusFilter('perfect');
                  }}
                  className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                    statusFilter === 'perfect'
                      ? 'bg-emerald-500 border-emerald-300 text-slate-950'
                      : 'bg-slate-900 border-slate-700 text-emerald-300 hover:border-emerald-500/60'
                  }`}
                >
                  ✅ Tepat Langsung ({firstTryCount})
                </button>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {hasRecordedAnswers && unplayedRefRecords.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  audioEngine.playClickWood();
                  setIncludeUnplayedRef((v) => !v);
                }}
                className={`px-3 py-1 rounded-xl text-xs font-bold border cursor-pointer ${
                  includeUnplayedRef
                    ? 'bg-sky-600 border-sky-400 text-white'
                    : 'bg-slate-900 border-slate-700 text-sky-300 hover:border-sky-500'
                }`}
              >
                {includeUnplayedRef
                  ? '✓ Pembahasan Level Lain Ditampilkan'
                  : `📚 Sertakan Kunci Level Lain (${unplayedRefRecords.length})`}
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                setExpandedList((v) => !v);
              }}
              className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-800 border border-slate-600 text-slate-200 hover:border-slate-400 cursor-pointer"
            >
              {expandedList ? '🔼 Ringkas Daftar' : '🔽 Perluas Semua'}
            </button>
          </div>
        </div>

        {/* Filter per Level C1-C6 */}
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              audioEngine.playClickWood();
              setLevelFilter(0);
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
              levelFilter === 0
                ? 'bg-amber-400 text-slate-950'
                : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            Semua Level
          </button>
          {LEVEL_METADATA.map((meta) => (
            <button
              key={meta.level}
              type="button"
              onClick={() => {
                audioEngine.playClickWood();
                setLevelFilter(meta.level);
              }}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold cursor-pointer ${
                levelFilter === meta.level
                  ? 'bg-amber-400 text-slate-950'
                  : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
              }`}
            >
              {meta.bloomCode} · Lv.{meta.level}
            </button>
          ))}
        </div>
      </div>

      {/* Daftar Kartu Rincian Evaluasi */}
      {sortedRecords.length === 0 ? (
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-center text-xs text-slate-300">
          {statusFilter === 'attention'
            ? `MasyaAllah! Semua tantangan yang dijawab ${activePlayerDisplayName} pada filter ini sudah tepat sejak percobaan pertama.`
            : 'Tidak ada rincian jawaban pada filter level yang dipilih.'}
        </div>
      ) : (
        <div
          className={`space-y-3 pr-1 ${
            expandedList ? '' : 'max-h-[420px] overflow-y-auto'
          }`}
        >
          {sortedRecords.map((item) => {
            const isRecorded = !hasRecordedAnswers ? false : recordedKeys.has(item.challengeKey);
            const isPerfect = isRecorded && item.firstAttemptCorrect && item.isResolved;
            const isGuidedSuccess = isRecorded && !item.firstAttemptCorrect && item.isResolved;
            const isUnresolved = isRecorded && !item.isResolved;

            return (
              <article
                key={`${item.challengeKey}-${isRecorded ? 'rec' : 'ref'}`}
                className={`rounded-2xl border p-3.5 md:p-4 space-y-2 ${
                  isUnresolved
                    ? 'bg-amber-950/35 border-amber-400/80'
                    : isGuidedSuccess
                    ? 'bg-slate-900/95 border-amber-500/60'
                    : 'bg-slate-900/90 border-emerald-600/50'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-extrabold font-mono-num px-2 py-0.5 rounded-md bg-slate-800 text-amber-300 border border-slate-700">
                      {item.bloomCode} · Level {item.level}
                    </span>
                    <span className="text-xs font-extrabold text-white">
                      {item.phaseLabel}: {item.promptTitle}
                    </span>
                  </div>

                  <span
                    className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg border ${
                      !isRecorded
                        ? 'bg-sky-950/80 text-sky-300 border-sky-500/50'
                        : isPerfect
                        ? 'bg-emerald-950/90 text-emerald-300 border-emerald-500/60'
                        : isGuidedSuccess
                        ? 'bg-amber-950/90 text-amber-300 border-amber-400/60'
                        : 'bg-amber-900/80 text-amber-200 border-amber-300'
                    }`}
                  >
                    {!isRecorded
                      ? '📖 Kunci Pembahasan'
                      : isPerfect
                      ? '✅ Tepat Langsung'
                      : isGuidedSuccess
                      ? `🌱 Tepat Setelah Dibimbing (${item.attemptsCount}x)`
                      : `💡 Perlu Latihan Lagi (${item.attemptsCount}x)`}
                  </span>
                </div>

                <p className="text-xs md:text-sm text-slate-200 leading-relaxed">
                  {item.questionText}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  {isRecorded ? (
                    <div
                      className={`rounded-xl px-3 py-2 border ${
                        isPerfect
                          ? 'bg-emerald-950/40 border-emerald-700/50 text-emerald-100'
                          : 'bg-amber-950/40 border-amber-600/50 text-amber-100'
                      }`}
                    >
                      <span className="font-extrabold text-amber-300">Jawabanmu: </span>
                      {item.wrongChoices.length > 0 ? (
                        <span>
                          {item.wrongChoices.join(' → ')}
                          {item.isResolved ? ` → ${item.lastUserAnswer}` : ''}
                        </span>
                      ) : (
                        <span>{item.lastUserAnswer}</span>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl px-3 py-2 border bg-slate-950/70 border-slate-700 text-slate-300">
                      <span className="font-bold text-sky-300">Status: </span>
                      Referensi materi &amp; kunci pembahasan Level {item.level}
                    </div>
                  )}

                  <div className="rounded-xl px-3 py-2 border bg-emerald-950/60 border-emerald-500/50 text-emerald-100">
                    <span className="font-extrabold text-emerald-300">Jawaban Tepat: </span>
                    <span className="font-semibold">{item.correctAnswer}</span>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-950/85 border-l-4 border-amber-400 px-3 py-2 text-xs text-slate-200 leading-relaxed">
                  <strong className="text-amber-300">📖 Pembahasan Singkat:</strong>{' '}
                  {item.explanation}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
};
