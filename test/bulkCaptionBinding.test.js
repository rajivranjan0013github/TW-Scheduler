import test from 'node:test';
import assert from 'node:assert/strict';

import {
  bulkRowToProject,
  syncBulkRowContent,
} from '../src/pages/videoEditorV2/project/projectAdapters.js';

const media = (id, duration) => ({
  id,
  mediaId: id,
  name: `${id}.mp4`,
  type: 'video',
  url: `https://example.test/${id}.mp4`,
  duration,
});

const getTextClips = (project) => project.tracks
  .flatMap((track) => track.clips || [])
  .filter((clip) => clip.type === 'text');

test('a default caption update resets an old second-video overlay to the first video range', () => {
  const initialRow = {
    id: 'row-caption-binding',
    video1: media('first', 4),
    video1Url: 'https://example.test/first.mp4',
    video2: media('second', 7),
    video2Url: 'https://example.test/second.mp4',
    caption: 'Old text',
    textOverlays: [{
      id: 'old-overlay',
      text: 'Old text',
      binding: 'video2',
      start: 0,
      duration: 0,
      style: {},
      position: { preset: 'center' },
    }],
  };
  const project = bulkRowToProject(initialRow, { isDualVideo: true });
  const rowWithProject = { ...initialRow, editorProject: project, editorProjectStale: false };

  const synchronized = syncBulkRowContent(rowWithProject, {
    caption: 'New default caption',
  }, { isDualVideo: true });
  const [caption] = getTextClips(synchronized.editorProject);

  assert.equal(caption.text, 'New default caption');
  assert.equal(caption.timelineStart, 0);
  assert.equal(caption.duration, 4);
  assert.equal(caption.metadata.bulkDurationBinding, 'video1');
});

test('an agent caption bound to video1 uses the first video start and full duration', () => {
  const initialRow = {
    id: 'row-agent-caption',
    video1: media('first', 4),
    video1Url: 'https://example.test/first.mp4',
    video2: media('second', 7),
    video2Url: 'https://example.test/second.mp4',
    caption: '',
    textOverlays: [],
  };
  const project = bulkRowToProject(initialRow, { isDualVideo: true });
  const rowWithProject = { ...initialRow, editorProject: project, editorProjectStale: false };

  const synchronized = syncBulkRowContent(rowWithProject, {
    caption: 'Agent caption',
    textOverlays: [{
      id: 'agent-overlay',
      text: 'Agent caption',
      binding: 'video1',
      start: 0,
      duration: 0,
      style: {},
      position: { preset: 'center' },
    }],
  }, { isDualVideo: true });
  const [caption] = getTextClips(synchronized.editorProject);

  assert.equal(caption.timelineStart, 0);
  assert.equal(caption.duration, 4);
  assert.equal(caption.metadata.bulkDurationBinding, 'video1');
});

test('style-only updates preserve an explicit second-video caption binding', () => {
  const initialRow = {
    id: 'row-explicit-binding',
    video1: media('first', 4),
    video1Url: 'https://example.test/first.mp4',
    video2: media('second', 7),
    video2Url: 'https://example.test/second.mp4',
    caption: 'Keep on second video',
    textOverlays: [{
      id: 'explicit-overlay',
      text: 'Keep on second video',
      binding: 'video2',
      start: 0,
      duration: 0,
      style: {},
      position: { preset: 'center' },
    }],
  };
  const project = bulkRowToProject(initialRow, { isDualVideo: true });
  const rowWithProject = { ...initialRow, editorProject: project, editorProjectStale: false };

  const synchronized = syncBulkRowContent(rowWithProject, {
    textSettings: { fontColor: '#ff0000' },
  }, { isDualVideo: true });
  const [caption] = getTextClips(synchronized.editorProject);

  assert.equal(caption.timelineStart, 4);
  assert.equal(caption.duration, 7);
  assert.equal(caption.metadata.bulkDurationBinding, 'video2');
});
