'use client';

import { useState, useTransition } from 'react';
import { ChevronLeft, ChevronRight, Send, CheckCircle, Loader2 } from 'lucide-react';

interface Question {
  id: string;
  text: string;
  type: string;
  scaleMin?: number;
  scaleMax?: number;
  scaleMinLabel?: string;
  scaleMaxLabel?: string;
  required: boolean;
  options?: { id: string; label: string; value: string; order: number }[];
}

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function submitAnswers(
  sessionId: string,
  apiKey: string,
  items: { questionId: string; value: unknown }[],
) {
  const res = await fetch(`${API}/sessions/${sessionId}/answers`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
    body: JSON.stringify({ items }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? '送信に失敗しました');
  }
  // Trigger analysis
  await fetch(`${API}/sessions/${sessionId}/analyze`, {
    method: 'POST',
    headers: { 'x-api-key': apiKey },
  }).catch(() => {});
  return true;
}

function QuestionCard({
  question,
  value,
  onChange,
}: {
  question: Question;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (question.type === 'SCALE') {
    const min = question.scaleMin ?? 1;
    const max = question.scaleMax ?? 5;
    const nums = Array.from({ length: max - min + 1 }, (_, i) => min + i);
    return (
      <div>
        <div className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:gap-3">
          {nums.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(String(n))}
              className={`flex-1 sm:flex-none sm:w-12 h-12 rounded-xl border-2 text-base font-semibold transition-all ${
                String(value) === String(n)
                  ? 'border-blue-500 bg-blue-500 text-white shadow-md scale-105'
                  : 'border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 bg-white'
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        {(question.scaleMinLabel || question.scaleMaxLabel) && (
          <div className="flex justify-between mt-2 text-xs text-gray-400">
            <span>{question.scaleMinLabel ?? `${min}: 最低`}</span>
            <span>{question.scaleMaxLabel ?? `${max}: 最高`}</span>
          </div>
        )}
      </div>
    );
  }

  if (question.type === 'SINGLE_CHOICE') {
    const opts = [...(question.options ?? [])].sort((a, b) => a.order - b.order);
    return (
      <div className="space-y-3">
        {opts.map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
              value === opt.value
                ? 'border-blue-500 bg-blue-50 shadow-sm'
                : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50 bg-white'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                value === opt.value ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
              }`}>
                {value === opt.value && <span className="w-2 h-2 rounded-full bg-white" />}
              </span>
              <span className={`text-sm font-medium ${value === opt.value ? 'text-blue-700' : 'text-gray-700'}`}>
                {opt.label}
              </span>
            </div>
          </button>
        ))}
      </div>
    );
  }

  if (question.type === 'MULTIPLE_CHOICE') {
    const opts = [...(question.options ?? [])].sort((a, b) => a.order - b.order);
    const selected: string[] = Array.isArray(value) ? value : [];
    return (
      <div className="space-y-3">
        {opts.map((opt) => {
          const checked = selected.includes(opt.value);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onChange(checked ? selected.filter((v) => v !== opt.value) : [...selected, opt.value])}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                checked ? 'border-blue-500 bg-blue-50 shadow-sm' : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors ${
                  checked ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
                }`}>
                  {checked && <span className="text-white text-xs font-bold leading-none">✓</span>}
                </span>
                <span className={`text-sm font-medium ${checked ? 'text-blue-700' : 'text-gray-700'}`}>
                  {opt.label}
                </span>
              </div>
            </button>
          );
        })}
        <p className="text-xs text-gray-400 mt-1">複数選択可</p>
      </div>
    );
  }

  return (
    <textarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      rows={4}
      placeholder="こちらに入力してください"
      className="w-full border-2 border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-blue-400 resize-none bg-white"
    />
  );
}

export function RespondForm({
  sessionId,
  apiKey,
  questions,
}: {
  sessionId: string;
  apiKey: string;
  questions: Question[];
}) {
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();

  const current = questions[currentIdx];
  const progress = ((currentIdx + 1) / questions.length) * 100;
  const currentAnswer = answers[current?.id];
  const isAnswered = currentAnswer !== undefined && currentAnswer !== '' && !(Array.isArray(currentAnswer) && currentAnswer.length === 0);

  function goNext() {
    if (currentIdx < questions.length - 1) setCurrentIdx((i) => i + 1);
  }

  function goPrev() {
    if (currentIdx > 0) setCurrentIdx((i) => i - 1);
  }

  function handleSubmit() {
    const items = questions.map((q) => ({ questionId: q.id, value: answers[q.id] ?? null }));
    setError('');
    startTransition(async () => {
      try {
        await submitAnswers(sessionId, apiKey, items);
        setSubmitted(true);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  if (submitted) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 text-center">
        <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-5">
          <CheckCircle size={32} className="text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">回答を送信しました</h2>
        <p className="text-sm text-gray-500">
          ご回答ありがとうございます。結果は担当者から共有されます。
        </p>
      </div>
    );
  }

  if (!current) return null;

  const answeredCount = questions.filter((q) => {
    const v = answers[q.id];
    return v !== undefined && v !== '' && !(Array.isArray(v) && v.length === 0);
  }).length;
  const isLast = currentIdx === questions.length - 1;

  return (
    <div>
      {/* Progress bar */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">{currentIdx + 1} / {questions.length}</span>
          <span className="text-xs text-gray-500">{answeredCount} 問回答済</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5">
          <div
            className="h-1.5 bg-blue-500 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Question card */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 sm:p-8 mb-4">
        <p className="text-xs text-gray-400 mb-1 uppercase tracking-wide">Q{currentIdx + 1}</p>
        <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-6 leading-relaxed">
          {current.text}
          {current.required && <span className="text-red-400 ml-1 text-sm">*</span>}
        </h2>
        <QuestionCard
          question={current}
          value={currentAnswer}
          onChange={(v) => setAnswers((prev) => ({ ...prev, [current.id]: v }))}
        />
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 mb-4">
          {error}
        </div>
      )}

      {/* Navigation */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={goPrev}
          disabled={currentIdx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm text-gray-600 hover:bg-gray-100 disabled:opacity-30 transition-colors"
        >
          <ChevronLeft size={16} />
          前へ
        </button>

        <div className="flex-1" />

        {!isLast ? (
          <button
            type="button"
            onClick={goNext}
            className={`flex items-center gap-1.5 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
              isAnswered
                ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            disabled={!isAnswered && current.required}
          >
            次へ
            <ChevronRight size={16} />
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium bg-green-600 text-white hover:bg-green-700 shadow-sm disabled:opacity-50 transition-all"
          >
            {isPending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                送信中...
              </>
            ) : (
              <>
                <Send size={15} />
                送信する
              </>
            )}
          </button>
        )}
      </div>

      {/* Question dots */}
      <div className="flex gap-1.5 justify-center mt-6 flex-wrap">
        {questions.map((q, i) => {
          const answered = answers[q.id] !== undefined && answers[q.id] !== '' && !(Array.isArray(answers[q.id]) && (answers[q.id] as any[]).length === 0);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => setCurrentIdx(i)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                i === currentIdx ? 'bg-blue-500 scale-125' : answered ? 'bg-blue-200' : 'bg-gray-200 hover:bg-gray-300'
              }`}
              title={`Q${i + 1}`}
            />
          );
        })}
      </div>
    </div>
  );
}
