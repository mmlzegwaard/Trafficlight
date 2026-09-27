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
