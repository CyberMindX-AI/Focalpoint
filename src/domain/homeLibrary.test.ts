import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { papersForHome, topicSuggestion } from './homeLibrary.ts';

const catalog = [{ id: 'paper-408', title: 'Science paper', questionCount: 408 }];

describe('papersForHome', () => {
  it('shows a paper that is already on the device', () => {
    const papers = papersForHome([{ id: 'paper-408', title: 'Science paper', questions: [{}, {}] }], [], catalog);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].questions?.length, 2);
  });

  it('keeps an account paper that has no questions downloaded yet', () => {
    const papers = papersForHome([{ id: 'paper-408', title: 'Science paper', accountSaved: true, questionCount: 408, questions: [] }], [], []);
    assert.equal(papers[0].questionCount, 408);
    assert.equal(papers[0].questions?.length, 0);
  });

  it('matches a completed session to the public catalog without inventing a paper', () => {
    const papers = papersForHome([], [{ source_bundle_id: 'paper-408' }, { source_bundle_id: 'paper-408' }], catalog);
    assert.equal(papers.length, 1);
    assert.equal(papers[0].id, 'paper-408');
    assert.equal(papers[0].questionCount, 408);
    assert.equal(papers[0].questions?.length, 0);
  });

  it('stays empty when there is no saved paper and no matching session', () => {
    assert.deepEqual(papersForHome([], [{ source_bundle_id: 'missing' }, { source_bundle_id: 'demo' }, { source_bundle_id: 'saved-questions' }], catalog), []);
  });

  it('suggests the weakest practised topic on a downloaded paper', () => {
    const material = { id: 'paper-408', questions: [{ subject: 'Biology', topic: 'Cells', options: ['A', 'B'], correct: 0 }] };
    const suggestion = topicSuggestion([material], [{ status: 'completed', source: { bundleId: 'paper-408' }, questions: material.questions, answers: [1], completedAt: '2026-01-01T00:00:00.000Z' }]);
    assert.equal(suggestion?.topic, 'Cells');
    assert.equal(suggestion?.correct, 0);
  });

  it('does not treat a failed catalog as an empty account', () => {
    const papers = papersForHome([{ id: 'paper-408', title: 'Science paper', accountSaved: true, questionCount: 408 }], [], []);
    assert.equal(papers.length, 1);
  });
});
