import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clearAgentReservationMetadata,
  collectAgentReservations,
  filterUnreferencedAgentReservations,
  groupAgentReservations,
} from '../src/pages/bulkBuilder/bulkAgentReservations.js';

test('reservation collection deduplicates plan/media pairs and ignores malformed metadata', () => {
  const rows = [
    {
      agentReservations: {
        video1: { planId: 'plan-a', mediaId: 'video-1' },
        video2: { planId: 'plan-a', sourceMediaId: 'video-2' },
        audio: { planId: '', mediaId: 'invalid' },
      },
    },
    {
      agentReservations: {
        video1: { planId: 'plan-a', mediaId: 'video-1' },
        audio: { planId: 'plan-b', mediaId: 'audio-1' },
      },
    },
  ];

  assert.deepEqual(collectAgentReservations(rows), [
    { planId: 'plan-a', mediaId: 'video-1' },
    { planId: 'plan-a', mediaId: 'video-2' },
    { planId: 'plan-b', mediaId: 'audio-1' },
  ]);
});

test('reservation grouping produces one deduplicated release per plan', () => {
  assert.deepEqual(groupAgentReservations([
    { planId: 'plan-a', mediaId: 'video-1' },
    { planId: 'plan-a', sourceMediaId: 'video-2' },
    { planId: 'plan-a', mediaId: 'video-1' },
    { planId: 'plan-b', mediaId: 'audio-1' },
    { planId: '', mediaId: 'invalid' },
  ]), [
    { planId: 'plan-a', sourceMediaIds: ['video-1', 'video-2'] },
    { planId: 'plan-b', sourceMediaIds: ['audio-1'] },
  ]);
});

test('a reused source is releasable only after its final board reference is gone', () => {
  const candidate = { planId: 'plan-reuse', mediaId: 'video-shared' };
  const remainingRows = [{
    agentReservations: {
      video2: { planId: 'plan-reuse', mediaId: 'video-shared' },
    },
  }];

  assert.deepEqual(
    filterUnreferencedAgentReservations([candidate, candidate], remainingRows),
    [],
  );
  assert.deepEqual(
    filterUnreferencedAgentReservations([candidate, candidate], []),
    [candidate],
  );
});

test('clearing selected reservation slots is immutable and preserves other slots', () => {
  const row = {
    id: 'row-1',
    agentReservations: {
      video1: { planId: 'plan-a', mediaId: 'video-1' },
      video2: { planId: 'plan-a', mediaId: 'video-2' },
      audio: { planId: 'plan-a', mediaId: 'audio-1' },
    },
  };

  const clearedVideo = clearAgentReservationMetadata(row, ['video1']);
  assert.notEqual(clearedVideo, row);
  assert.deepEqual(row.agentReservations.video1, { planId: 'plan-a', mediaId: 'video-1' });
  assert.deepEqual(clearedVideo.agentReservations, {
    video2: { planId: 'plan-a', mediaId: 'video-2' },
    audio: { planId: 'plan-a', mediaId: 'audio-1' },
  });

  const clearedAll = clearAgentReservationMetadata(row);
  assert.equal(Object.hasOwn(clearedAll, 'agentReservations'), true);
  assert.equal(clearedAll.agentReservations, undefined);
});
