import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyMaterialFiles, reviewMinimumOptions, sortUploadFiles, type UploadFile } from './materialFiles.ts';

const file = (name: string, mime: string, size = 10): UploadFile => ({ uri: name, name, mime, size });

describe('upload classification', () => {
  it('keeps photos together and sorts a new selection by name', () => {
    const files = [file('page-10.jpg', 'image/jpeg'), file('page-2.jpg', 'image/jpeg')];
    assert.equal(classifyMaterialFiles(files).kind, 'photos');
    assert.deepEqual(sortUploadFiles(files).map(item => item.name), ['page-2.jpg', 'page-10.jpg']);
  });

  it('rejects a PDF mixed with a photo before any session is created', () => {
    assert.throws(() => classifyMaterialFiles([file('one.jpg', 'image/jpeg'), file('paper.pdf', 'application/pdf')]), /one PDF/);
  });

  it('accepts one PDF or one text file and rejects an empty file', () => {
    assert.equal(classifyMaterialFiles([file('paper.pdf', 'application/pdf')]).kind, 'pdf');
    assert.equal(classifyMaterialFiles([file('paper.txt', 'text/plain')]).kind, 'text');
    assert.throws(() => classifyMaterialFiles([file('empty.txt', 'text/plain', 0)]), /empty/);
  });

  it('lets a written question through review without multiple-choice options', () => {
    assert.equal(reviewMinimumOptions({ type: 'theory' }), 0);
    assert.equal(reviewMinimumOptions({ type: 'single_choice' }), 2);
    assert.equal(reviewMinimumOptions({}), 2);
  });
});