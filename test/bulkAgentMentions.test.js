import test from 'node:test';
import assert from 'node:assert/strict';

import {
  deriveMentionRoles,
  messageRequestsAudio,
  shouldShowDefaultAudioHint,
} from '../src/pages/bulkBuilder/bulkAgentMentions.js';

test('inline mentions derive primary and secondary roles from their own clauses', () => {
  assert.deepEqual(deriveMentionRoles(
    'Use @Beta as second and @Alpha as first',
    [
      { folderId: 'folder-b', name: 'Beta', role: 'unspecified' },
      { folderId: 'folder-a', name: 'Alpha', role: 'unspecified' },
    ],
  ), [
    { folderId: 'folder-b', name: 'Beta', role: 'secondary' },
    { folderId: 'folder-a', name: 'Alpha', role: 'primary' },
  ]);
});

test('audio mention is not reassigned by a nearby frame number', () => {
  assert.deepEqual(deriveMentionRoles(
    'Add @Music as audio to frames 2 and 4',
    [{ folderId: 'folder-audio', name: 'Music', role: 'unspecified' }],
  ), [
    { folderId: 'folder-audio', name: 'Music', role: 'audio' },
  ]);
});

test('folder substrings in ordinary words do not create role assignments', () => {
  assert.deepEqual(deriveMentionRoles(
    'apply 10 frames',
    [{ folderId: 'folder-app', name: 'App', role: 'unspecified' }],
  ), [
    { folderId: 'folder-app', name: 'App', role: 'unspecified' },
  ]);
});

test('role inference ignores ordinal words inside an inline folder token', () => {
  assert.deepEqual(deriveMentionRoles(
    'Use @Dr Nupur first as second video',
    [{
      folderId: 'folder-dr-nupur-first',
      name: 'Dr Nupur first',
      role: 'unspecified',
    }],
  ), [{
    folderId: 'folder-dr-nupur-first',
    name: 'Dr Nupur first',
    role: 'secondary',
  }]);
});

test('a generic music request does not relabel an attached video folder as audio', () => {
  assert.deepEqual(deriveMentionRoles(
    'Create 10 frames from @Product Videos with music',
    [{ folderId: 'folder-videos', name: 'Product Videos', role: 'unspecified' }],
  ), [{
    folderId: 'folder-videos',
    name: 'Product Videos',
    role: 'unspecified',
  }]);
  assert.deepEqual(deriveMentionRoles(
    'Create frames from @Product Videos as the source with music',
    [{ folderId: 'folder-videos', name: 'Product Videos', role: 'unspecified' }],
  ), [{
    folderId: 'folder-videos',
    name: 'Product Videos',
    role: 'unspecified',
  }]);
});

test('audio source wording still assigns the attached folder to audio', () => {
  assert.deepEqual(deriveMentionRoles(
    'Create 10 frames with music from @Brand Tracks',
    [{ folderId: 'folder-tracks', name: 'Brand Tracks', role: 'unspecified' }],
  ), [{
    folderId: 'folder-tracks',
    name: 'Brand Tracks',
    role: 'audio',
  }]);
});

test('audio intent detects the default Trending Songs request vocabulary', () => {
  assert.equal(messageRequestsAudio('Add background music to every frame'), true);
  assert.equal(messageRequestsAudio('Use a soundtrack'), true);
  assert.equal(messageRequestsAudio('Add BGM to frame 2'), true);
  assert.equal(messageRequestsAudio('Create ten silent video frames'), false);
  assert.equal(messageRequestsAudio('Create these without music'), false);
  assert.equal(messageRequestsAudio('No audio on frame 2'), false);
  assert.equal(messageRequestsAudio('Use music with no audio repeats'), true);
  assert.equal(messageRequestsAudio('Use music with no audio reuse'), true);
  assert.equal(messageRequestsAudio('Remove audio from frame 2'), false);
  assert.equal(messageRequestsAudio(
    'Use @Brand Audio',
    [{ folderId: 'folder-audio', name: 'Brand Audio' }],
  ), false);
});

test('the default audio hint is hidden when an audio source is attached', () => {
  assert.equal(shouldShowDefaultAudioHint({
    message: 'Create frames with music from @Brand Tracks',
    mentions: [{ folderId: 'folder-tracks', name: 'Brand Tracks', role: 'unspecified' }],
  }), false);
  assert.equal(shouldShowDefaultAudioHint({
    message: 'Create frames with @Brand Beats and music',
    mentions: [{ folderId: 'folder-beats', name: 'Brand Beats', role: 'unspecified' }],
    folders: [
      { _id: 'folder-audio', name: 'Audio' },
      { _id: 'folder-beats', name: 'Brand Beats', parentFolderId: 'folder-audio' },
    ],
  }), false);
  assert.equal(shouldShowDefaultAudioHint({
    message: 'Create frames from @Product Videos with music',
    mentions: [{ folderId: 'folder-videos', name: 'Product Videos', role: 'unspecified' }],
    folders: [{ _id: 'folder-videos', name: 'Product Videos', typeCounts: { audio: 0, video: 8 } }],
  }), true);
});
