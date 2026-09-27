import { sendMovementAlert } from './email.js';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_ALERT_THRESHOLD_METERS = 10;
const DEFAULT_SHIP_NAME = 'Rotterdam';
const DEFAULT_FALLBACK_POSITION = {
  latitude: 51.9225,
  longitude: 4.47917,
};

function toRadians(value) {
  return (value * Math.PI) / 180;
}

export function calculateDistanceMeters(from, to) {
  const earthRadiusMeters = 6_371_000;
  const deltaLat = toRadians(to.latitude - from.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);
  const fromLat = toRadians(from.latitude);
  const toLat = toRadians(to.latitude);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(deltaLon / 2) ** 2;

  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pickCoordinate(candidate, keys) {
  for (const key of keys) {
    const value = candidate?.[key];
    if (value !== undefined && value !== null && value !== '') {
      const numericValue = Number(value);
      if (Number.isFinite(numericValue)) {
        return numericValue;
      }
    }
  }

  return null;
}

function normalizeShip(candidate) {
  const latitude = pickCoordinate(candidate, ['latitude', 'lat', 'Latitude', 'LAT']);
  const longitude = pickCoordinate(candidate, ['longitude', 'lon', 'lng', 'Longitude', 'LON', 'LNG']);

  if (latitude === null || longitude === null) {
    return null;
  }

  return {
    name: candidate.name ?? candidate.shipName ?? candidate.vesselName ?? DEFAULT_SHIP_NAME,
    latitude,
    longitude,
    updatedAt:
      candidate.updatedAt ?? candidate.timestamp ?? candidate.lastSeen ?? new Date().toISOString(),
  };
}

function nameMatchesShip(candidate, shipName) {
  const name = String(candidate?.name ?? candidate?.shipName ?? candidate?.vesselName ?? '').toLowerCase();
  return name.includes(shipName.toLowerCase());
}

export function extractRotterdamPosition(payload, shipName = DEFAULT_SHIP_NAME) {
  if (Array.isArray(payload)) {
    const candidate = payload.find((item) => nameMatchesShip(item, shipName));

    return candidate ? normalizeShip(candidate) : null;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.ships)) {
      return extractRotterdamPosition(payload.ships, shipName);
    }

    if (payload.position) {
      const candidate = { ...payload, ...payload.position };
      return nameMatchesShip(candidate, shipName) ? normalizeShip(candidate) : null;
    }

    return nameMatchesShip(payload, shipName) ? normalizeShip(payload) : null;
  }

  return null;
}

async function defaultFetchJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`ship_source_http_${response.status}`);
  }

  return response.json();
}

function buildAlertMessage(currentPosition, distanceMeters) {
  const roundedDistance = distanceMeters.toFixed(2);
  return [
    `Cruiseschip ${currentPosition.name} is ${roundedDistance} meter verplaatst.`,
    `Nieuwe positie: ${currentPosition.latitude}, ${currentPosition.longitude}`,
    `Gemeten om: ${currentPosition.updatedAt}`,
  ].join('\n');
}

function buildFallbackPosition(shipName, updatedAt) {
  return {
    name: shipName,
    latitude: DEFAULT_FALLBACK_POSITION.latitude,
    longitude: DEFAULT_FALLBACK_POSITION.longitude,
    updatedAt,
  };
}

export class RotterdamTracker {
  constructor({
    shipName = DEFAULT_SHIP_NAME,
    alertThresholdMeters = DEFAULT_ALERT_THRESHOLD_METERS,
    sourceUrl = process.env.ROTTERDAM_TRACKER_SOURCE_URL,
    alertEmail = process.env.ROTTERDAM_TRACKER_ALERT_EMAIL ?? '',
    pollIntervalMs = Number(process.env.ROTTERDAM_TRACKER_POLL_INTERVAL_MS) || DEFAULT_POLL_INTERVAL_MS,
    fetchJson = defaultFetchJson,
    sendAlert = sendMovementAlert,
  } = {}) {
    this.shipName = shipName;
    this.alertThresholdMeters = alertThresholdMeters;
    this.sourceUrl = sourceUrl;
    this.alertEmail = alertEmail;
    this.pollIntervalMs = pollIntervalMs;
    this.fetchJson = fetchJson;
    this.sendAlert = sendAlert;
    this.timer = null;
    const initialCheckedAt = this.sourceUrl ? null : new Date().toISOString();
    const initialFallbackPosition = this.sourceUrl
      ? null
      : buildFallbackPosition(this.shipName, initialCheckedAt);

    this.state = {
      shipName: this.shipName,
      currentPosition: initialFallbackPosition,
      previousPosition: null,
      distanceMeters: 0,
      alertActive: false,
      lastAlertAt: null,
      lastEmailStatus: null,
      lastCheckedAt: initialCheckedAt,
      error: null,
      sourceConfigured: Boolean(this.sourceUrl),
    };
  }

  getStatus() {
    return { ...this.state };
  }

  async poll() {
    this.state.lastCheckedAt = new Date().toISOString();

    if (!this.sourceUrl) {
      this.state = {
        ...this.state,
        currentPosition: buildFallbackPosition(this.shipName, this.state.lastCheckedAt),
        previousPosition: this.state.currentPosition,
        distanceMeters: 0,
        alertActive: false,
        lastAlertAt: null,
        lastEmailStatus: null,
        error: null,
      };
      return this.getStatus();
    }

    try {
      const payload = await this.fetchJson(this.sourceUrl);
      const currentPosition = extractRotterdamPosition(payload, this.shipName);

      if (!currentPosition) {
        throw new Error(`ship_not_found:${this.shipName}`);
      }

      const previousPosition = this.state.currentPosition;
      const wasAlertActive = this.state.alertActive;
      const distanceMeters = previousPosition
        ? calculateDistanceMeters(previousPosition, currentPosition)
        : 0;
      const alertActive = Boolean(previousPosition) && distanceMeters >= this.alertThresholdMeters;

      this.state = {
        ...this.state,
        currentPosition,
        previousPosition,
        distanceMeters,
        alertActive,
        lastAlertAt: null,
        lastEmailStatus: null,
        error: null,
      };

      if (alertActive && !wasAlertActive) {
        const lastEmailStatus = await this.sendAlert({
          to: this.alertEmail,
          subject: `Rotterdam alert: ${distanceMeters.toFixed(2)} meter verplaatst`,
          body: buildAlertMessage(currentPosition, distanceMeters),
        });

        this.state.lastAlertAt = new Date().toISOString();
        this.state.lastEmailStatus = lastEmailStatus;
      }

      return this.getStatus();
    } catch (error) {
      this.state.error = error.message;
      this.state.alertActive = false;
      return this.getStatus();
    }
  }

  start() {
    if (this.timer) {
      return;
    }

    this.poll();
    this.timer = setInterval(() => {
      this.poll();
    }, this.pollIntervalMs);
  }

  stop() {
    if (!this.timer) {
      return;
    }

    clearInterval(this.timer);
    this.timer = null;
  }
}
