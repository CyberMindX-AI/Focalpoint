import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { mergePracticeHistory } from './practiceSync.ts';

const local = { id: 'result-1', title: 'Science', score: 2, total_questions: 10, completed_at: '2026-10-17T12:00:00.000Z', source_bundle_id: 'paper', pending: true };

describe('mergePracticeHistory', () => {
  it('keeps a phone session that the server does not have yet', () => {
    const items = mergePracticeHistory([], [local]);
    assert.equal(items.length, 1);
    assert.equal(items[0].pending, true);
  });

  it('adds a server session and does not duplicate the same result', () => {
    const remote = { ...local, pending: false, score: 2 };
    const items = mergePracticeHistory([remote, remote], [local]);
    assert.equal(items.length, 1);
    assert.equal(items[0].pending, true);
  });

  it('clears pending only after the phone copy says the upload finished', () => {
    const items = mergePracticeHistory([{ ...local, pending: false }], [{ ...local, pending: false }]);
    assert.equal(items[0].pending, false);
  });
});
