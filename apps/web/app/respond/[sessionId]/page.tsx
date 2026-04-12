import { notFound } from 'next/navigation';
import { RespondForm } from './respond-form';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

async function fetchQuestions(sessionId: string, apiKey: string) {
  const res = await fetch(`${API}/sessions/${sessionId}/questions`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

async function fetchSession(sessionId: string, apiKey: string) {
  const res = await fetch(`${API}/sessions/${sessionId}`, {
    headers: { 'x-api-key': apiKey },
    cache: 'no-store',
  });
  if (!res.ok) return null;
  const json = await res.json();
  return json.data ?? json;
}

export default async function RespondPage({
  params,
  searchParams,
}: {
  params: { sessionId: string };
  searchParams: { key?: string };
}) {
  const apiKey = searchParams.key ?? '';
  if (!apiKey) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-red-500 text-xl">!</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">アクセスキーが必要です</h1>
          <p className="text-sm text-gray-500">URLにアクセスキーが含まれていません。担当者から正しいURLを受け取ってください。</p>
        </div>
      </div>
    );
  }

  const [session, questions] = await Promise.all([
    fetchSession(params.sessionId, apiKey),
    fetchQuestions(params.sessionId, apiKey),
  ]);

  if (!session || !questions) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-400 text-xl">?</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">セッションが見つかりません</h1>
          <p className="text-sm text-gray-500">URLが無効か、セッションの有効期限が切れています。</p>
        </div>
      </div>
    );
  }

  if (session.status === 'COMPLETED' || session.status === 'ANALYZING') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
            <span className="text-green-500 text-xl">✓</span>
          </div>
          <h1 className="text-lg font-semibold text-gray-900 mb-2">回答済みです</h1>
          <p className="text-sm text-gray-500">このセッションはすでに完了しています。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-gray-900">アンケート</h1>
            <p className="text-xs text-gray-400">ご協力ありがとうございます</p>
          </div>
          <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full font-medium">
            {questions.length} 問
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8">
        <RespondForm
          sessionId={params.sessionId}
          apiKey={apiKey}
          questions={questions}
        />
      </main>

      <footer className="max-w-2xl mx-auto px-4 py-6 text-center">
        <p className="text-xs text-gray-400">Powered by EvalEngine</p>
      </footer>
    </div>
  );
}
