import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { shouldStartDownload } from './downloadPlan.ts';

describe('shouldStartDownload', () => {
  it('starts a normal paper such as a few hundred questions', () => {
    assert.equal(shouldStartDownload({ totalBytes: 365218, totalQuestions: 408, parts: [{}, {}, {}, {}, {}] }), true);
  });

  it('does not start an empty or huge library by itself', () => {
    assert.equal(shouldStartDownload({ totalBytes: 0, totalQuestions: 0, parts: [] }), false);
    assert.equal(shouldStartDownload({ totalBytes: 120 * 1024 * 1024, totalQuestions: 19838, parts: Array.from({ length: 50 }, () => ({})) }), false);
  });
});
