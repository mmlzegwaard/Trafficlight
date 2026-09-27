import { sendMovementAlert } from './email.js';

const DEFAULT_POLL_INTERVAL_MS = 60_000;
const DEFAULT_ALERT_THRESHOLD_METERS = 10;
const DEFAULT_SHIP_NAME = 'Rotterdam';

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

export function extractRotterdamPosition(payload, shipName = DEFAULT_SHIP_NAME) {
  const requestedShipName = shipName.toLowerCase();

  if (Array.isArray(payload)) {
    const candidate = payload.find((item) => {
      const name = String(item?.name ?? item?.shipName ?? item?.vesselName ?? '').toLowerCase();
      return name.includes(requestedShipName);
    });

    return candidate ? normalizeShip(candidate) : null;
  }

  if (payload && typeof payload === 'object') {
    if (Array.isArray(payload.ships)) {
      return extractRotterdamPosition(payload.ships, shipName);
    }

    if (payload.position) {
      return normalizeShip({ ...payload.position, name: payload.name ?? shipName });
    }

    return normalizeShip(payload);
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

export class RotterdamTracker {
  constructor({
    shipName = DEFAULT_SHIP_NAME,
    alertThresholdMeters = DEFAULT_ALERT_THRESHOLD_METERS,
    sourceUrl = process.env.ROTTERDAM_TRACKER_SOURCE_URL,
    alertEmail = process.env.ROTTERDAM_TRACKER_ALERT_EMAIL ?? 'mmlzegwaard',
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
    this.state = {
      shipName: this.shipName,
      currentPosition: null,
      previousPosition: null,
      distanceMeters: 0,
      alertActive: false,
      lastAlertAt: null,
      lastEmailStatus: null,
      lastCheckedAt: null,
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
      this.state.error = 'ROTTERDAM_TRACKER_SOURCE_URL is niet ingesteld.';
      this.state.alertActive = false;
      return this.getStatus();
    }

    try {
      const payload = await this.fetchJson(this.sourceUrl);
      const currentPosition = extractRotterdamPosition(payload, this.shipName);

      if (!currentPosition) {
        throw new Error(`ship_not_found:${this.shipName}`);
      }

      const previousPosition = this.state.currentPosition;
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
        error: null,
      };

      if (alertActive) {
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
