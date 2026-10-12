import { useCallback, useEffect, useRef, useState } from 'react';
import * as api from './api.js';

const REFRESH_MS = 3000;
const QUESTION_MIN = 5; // same limits the server enforces
const QUESTION_MAX = 200;

function ErrorMessage({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="error" role="alert">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" className="link" onClick={onDismiss} aria-label="Dismiss error">
          ✕
        </button>
      )}
    </div>
  );
}

function CreatePollForm({ onCreated }) {
  const [question, setQuestion] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const trimmed = question.trim();
    if (trimmed.length < QUESTION_MIN || trimmed.length > QUESTION_MAX) {
      setError(`Question must be between ${QUESTION_MIN} and ${QUESTION_MAX} characters.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await api.createPoll(trimmed);
      setQuestion('');
      onCreated();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="card" onSubmit={handleSubmit}>
      <label htmlFor="question">Ask a yes / no question</label>
      <div className="row">
        <input
          id="question"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="Should we have pizza on Friday?"
          maxLength={QUESTION_MAX}
        />
        <button type="submit" disabled={saving}>
          {saving ? 'Creating…' : 'Create poll'}
        </button>
      </div>
      <ErrorMessage message={error} onDismiss={() => setError('')} />
    </form>
  );
}

function ResultBar({ label, percent, count, chosen }) {
  return (
    <div className="result">
      <div className="result-label">
        <span>
          {label} {chosen && <span className="badge">your vote</span>}
        </span>
        <span>
          {percent}% ({count})
        </span>
      </div>
      <div
        className="bar"
        role="progressbar"
        aria-label={`${label} votes`}
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`fill fill-${label.toLowerCase()}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function PollCard({ poll, onUpdated, onStale }) {
  const [error, setError] = useState('');
  const [voting, setVoting] = useState(false);
  const hasVoted = poll.myVote !== null;

  async function handleVote(choice) {
    setVoting(true);
    setError('');
    try {
      // The server answers with the poll's new results, so show them without waiting for a refresh.
      onUpdated(await api.vote(poll.id, choice));
    } catch (err) {
      setError(err.message);
      onStale(); // e.g. after a 409, reload so the vote already on record is shown
    } finally {
      setVoting(false);
    }
  }

  return (
    <li className="card">
      <h2>{poll.question}</h2>
      <div className="row">
        <button type="button" disabled={hasVoted || voting} onClick={() => handleVote('yes')}>
          Yes
        </button>
        <button type="button" disabled={hasVoted || voting} onClick={() => handleVote('no')}>
          No
        </button>
      </div>
      <ResultBar label="Yes" percent={poll.yesPercent} count={poll.yes} chosen={poll.myVote === 'yes'} />
      <ResultBar label="No" percent={poll.noPercent} count={poll.no} chosen={poll.myVote === 'no'} />
      <p className="muted">
        {poll.total} {poll.total === 1 ? 'vote' : 'votes'}
      </p>
      <ErrorMessage message={error} onDismiss={() => setError('')} />
    </li>
  );
}

export default function App() {
  const [polls, setPolls] = useState(null); // null = first load still in progress
  const [loadError, setLoadError] = useState('');
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return; // skip a tick rather than pile up slow requests
    inFlight.current = true;
    try {
      setPolls(await api.listPolls());
      setLoadError('');
    } catch (err) {
      // Keep showing the last good data; the banner explains why it may be stale.
      setLoadError(`Could not load polls: ${err.message}`);
    } finally {
      inFlight.current = false;
    }
  }, []);

  const replacePoll = useCallback((updated) => {
    setPolls((current) => current.map((p) => (p.id === updated.id ? updated : p)));
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return (
    <main>
      <h1>Yes / No Polls</h1>
      <CreatePollForm onCreated={refresh} />
      <ErrorMessage message={loadError} />
      {polls === null && !loadError && <p className="muted">Loading polls…</p>}
      {polls?.length === 0 && <p className="muted">No polls yet. Create the first one above.</p>}
      {polls?.length > 0 && (
        <>
          <p className="muted small">Results refresh every {REFRESH_MS / 1000} seconds.</p>
          <ul className="polls">
            {polls.map((poll) => (
              <PollCard key={poll.id} poll={poll} onUpdated={replacePoll} onStale={refresh} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
