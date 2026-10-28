import React, { useState } from 'react';
import type { QAItem } from '../../types';

const API_BASE_URL = 'http://localhost:5000/api';

interface ListingQuestionsProps {
  listingId: string;
  questions: QAItem[];
  mode: 'buyer' | 'seller';
  canAsk?: boolean;
  onQuestionsUpdated: (questions: QAItem[]) => void;
}

export const ListingQuestions: React.FC<ListingQuestionsProps> = ({
  listingId,
  questions,
  mode,
  canAsk = false,
  onQuestionsUpdated,
}) => {
  const [questionText, setQuestionText] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const submit = async (path: string, body: Record<string, string>) => {
    const token = localStorage.getItem('bidnest_auth_token');
    if (!token) {
      setError('Please sign in again to use listing questions.');
      return;
    }
    setError('');
    setMessage('');
    try {
      const response = await fetch(`${API_BASE_URL}/listings/${listingId}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Could not update listing questions.');
      onQuestionsUpdated(data.listing.questions ?? []);
      setMessage(data.message);
      return true;
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not update listing questions.');
      return false;
    }
  };

  const askQuestion = async (event: React.FormEvent) => {
    event.preventDefault();
    if (await submit('/questions', { question: questionText })) setQuestionText('');
  };

  const answerQuestion = async (event: React.FormEvent, questionId: string) => {
    event.preventDefault();
    if (await submit(`/questions/${questionId}/answer`, { answer: answers[questionId] ?? '' })) {
      setAnswers((existing) => ({ ...existing, [questionId]: '' }));
    }
  };

  return (
    <section className="mt-3 rounded-lg border border-slate-700 bg-slate-950/40 p-3" aria-label="Questions and answers">
      <h4 className="text-xs font-semibold text-indigo-200">Questions &amp; answers ({questions.length})</h4>
      <ul className="mt-2 space-y-3">
        {questions.map((entry) => (
          <li key={entry.id} className="border-t border-slate-800 pt-2">
            <p className="text-xs text-slate-200"><span className="font-semibold">{entry.askedByName.split(' ')[0]} asks:</span> {entry.question}</p>
            {entry.answer
              ? <p className="mt-1 whitespace-pre-wrap text-xs text-emerald-200"><span className="font-semibold">Seller:</span> {entry.answer}</p>
              : mode === 'seller'
                ? (
                  <form onSubmit={(event) => void answerQuestion(event, entry.id)} className="mt-2 space-y-2">
                    <label className="block text-[11px] text-slate-400">Public answer
                      <textarea required minLength={2} maxLength={1000} rows={2} value={answers[entry.id] ?? ''} onChange={(event) => setAnswers({ ...answers, [entry.id]: event.target.value })} className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white" />
                    </label>
                    <button type="submit" className="rounded bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500">Post answer</button>
                  </form>
                )
                : <p className="mt-1 text-[11px] text-slate-500">Waiting for seller response</p>}
          </li>
        ))}
        {!questions.length && <li className="text-xs text-slate-500">No questions yet. Ask one clearly and keep it about the item.</li>}
      </ul>
      {canAsk && (
        <form onSubmit={askQuestion} className="mt-3 border-t border-slate-800 pt-3">
          <label className="block text-[11px] text-slate-400">Ask the seller (5–500 characters; up to 5 questions per auction each day)
            <textarea required minLength={5} maxLength={500} rows={2} value={questionText} onChange={(event) => setQuestionText(event.target.value)} placeholder="Does the cycle's rear brake work?" className="mt-1 w-full rounded border border-slate-700 bg-slate-900 p-2 text-xs text-white placeholder:text-slate-500" />
          </label>
          <button type="submit" className="mt-2 rounded bg-indigo-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-indigo-500">Post question publicly</button>
        </form>
      )}
      {message && <p role="status" className="mt-2 text-[11px] text-emerald-300">{message}</p>}
      {error && <p role="alert" className="mt-2 text-[11px] text-rose-300">{error}</p>}
    </section>
  );
};
