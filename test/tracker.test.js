import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateDistanceMeters, extractRotterdamPosition, RotterdamTracker } from '../src/tracker.js';

test('calculateDistanceMeters returns zero for same point', () => {
  const point = { latitude: 51.9225, longitude: 4.47917 };
  assert.equal(calculateDistanceMeters(point, point), 0);
});

test('extractRotterdamPosition finds Rotterdam in ship array', () => {
  const position = extractRotterdamPosition([
    { name: 'Another vessel', latitude: 1, longitude: 2 },
    { vesselName: 'Cruiseship Rotterdam', lat: 51.9, lon: 4.4 },
  ]);

  assert.deepEqual(position, {
    name: 'Cruiseship Rotterdam',
    latitude: 51.9,
    longitude: 4.4,
    updatedAt: position.updatedAt,
  });
  assert.ok(position.updatedAt);
});

test('extractRotterdamPosition only accepts matching object payloads', () => {
  assert.equal(
    extractRotterdamPosition({ name: 'Another vessel', latitude: 1, longitude: 2 }),
    null,
  );

  const position = extractRotterdamPosition({
    shipName: 'Rotterdam',
    latitude: 51.92,
    longitude: 4.47,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });

  assert.deepEqual(position, {
    name: 'Rotterdam',
    latitude: 51.92,
    longitude: 4.47,
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
});

test('extractRotterdamPosition supports ships array and nested position payloads', () => {
  const shipsPayload = extractRotterdamPosition({
    ships: [
      { shipName: 'Other ship', latitude: 1, longitude: 2 },
      { shipName: 'Rotterdam', latitude: 51.93, longitude: 4.48, updatedAt: '2026-01-01T00:02:00.000Z' },
    ],
  });

  assert.deepEqual(shipsPayload, {
    name: 'Rotterdam',
    latitude: 51.93,
    longitude: 4.48,
    updatedAt: '2026-01-01T00:02:00.000Z',
  });

  const nestedPositionPayload = extractRotterdamPosition({
    name: 'Rotterdam',
    position: {
      latitude: 51.94,
      longitude: 4.49,
      updatedAt: '2026-01-01T00:03:00.000Z',
    },
  });

  assert.deepEqual(nestedPositionPayload, {
    name: 'Rotterdam',
    latitude: 51.94,
    longitude: 4.49,
    updatedAt: '2026-01-01T00:03:00.000Z',
  });
});

test('tracker activates alert and requests email after movement above threshold', async () => {
  const payloads = [
    { name: 'Rotterdam', latitude: 51.9225, longitude: 4.47917, updatedAt: '2026-01-01T00:00:00.000Z' },
    { name: 'Rotterdam', latitude: 51.9227, longitude: 4.47917, updatedAt: '2026-01-01T00:01:00.000Z' },
  ];
  const emailCalls = [];

  const tracker = new RotterdamTracker({
    sourceUrl: 'https://example.test/rotterdam.json',
    fetchJson: async () => payloads.shift(),
    sendAlert: async (message) => {
      emailCalls.push(message);
      return { sent: false, reason: 'test_mode' };
    },
  });

  const firstStatus = await tracker.poll();
  const secondStatus = await tracker.poll();

  assert.equal(firstStatus.alertActive, false);
  assert.equal(secondStatus.alertActive, true);
  assert.equal(emailCalls.length, 1);
  assert.match(emailCalls[0].subject, /Rotterdam alert/);
});

test('tracker only emails on alert transition', async () => {
  const payloads = [
    { name: 'Rotterdam', latitude: 51.9225, longitude: 4.47917, updatedAt: '2026-01-01T00:00:00.000Z' },
    { name: 'Rotterdam', latitude: 51.9227, longitude: 4.47917, updatedAt: '2026-01-01T00:01:00.000Z' },
    { name: 'Rotterdam', latitude: 51.9229, longitude: 4.47917, updatedAt: '2026-01-01T00:02:00.000Z' },
  ];
  const emailCalls = [];

  const tracker = new RotterdamTracker({
    sourceUrl: 'https://example.test/rotterdam.json',
    fetchJson: async () => payloads.shift(),
    sendAlert: async (message) => {
      emailCalls.push(message);
      return { sent: true, reason: 'sent' };
    },
  });

  await tracker.poll();
  await tracker.poll();
  await tracker.poll();

  assert.equal(emailCalls.length, 1);
});

test('tracker returns fallback location when source is not configured', async () => {
  const tracker = new RotterdamTracker({
    sourceUrl: '',
  });

  const initialStatus = tracker.getStatus();
  assert.equal(initialStatus.sourceConfigured, false);
  assert.equal(initialStatus.error, null);
  assert.deepEqual(initialStatus.currentPosition, {
    name: 'Rotterdam',
    latitude: 51.9225,
    longitude: 4.47917,
    updatedAt: initialStatus.currentPosition.updatedAt,
  });
  assert.ok(initialStatus.lastCheckedAt);

  const polledStatus = await tracker.poll();
  assert.equal(polledStatus.error, null);
  assert.equal(polledStatus.alertActive, false);
  assert.deepEqual(polledStatus.currentPosition, {
    name: 'Rotterdam',
    latitude: 51.9225,
    longitude: 4.47917,
    updatedAt: polledStatus.currentPosition.updatedAt,
  });
});
