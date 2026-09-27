from __future__ import annotations

from dataclasses import dataclass
from math import asin, cos, radians, sin, sqrt
from typing import Any


@dataclass(frozen=True)
class Position:
    latitude: float
    longitude: float


def meters_between(first: Position, second: Position) -> float:
    radius_meters = 6_371_000
    latitude_delta = radians(second.latitude - first.latitude)
    longitude_delta = radians(second.longitude - first.longitude)
    first_latitude = radians(first.latitude)
    second_latitude = radians(second.latitude)

    haversine = (
        sin(latitude_delta / 2) ** 2
        + cos(first_latitude) * cos(second_latitude) * sin(longitude_delta / 2) ** 2
    )
    return 2 * radius_meters * asin(sqrt(haversine))


def format_location(position: Position) -> str:
    return f"{position.latitude:.6f}, {position.longitude:.6f}"


def _read_field(payload: dict[str, Any], field_path: str) -> Any:
    current: Any = payload
    for field_name in field_path.split("."):
        if not isinstance(current, dict) or field_name not in current:
            raise KeyError(f"Missing field '{field_path}'")
        current = current[field_name]
    return current


def extract_position(
    payload: dict[str, Any],
    latitude_field: str = "latitude",
    longitude_field: str = "longitude",
) -> Position:
    latitude = float(_read_field(payload, latitude_field))
    longitude = float(_read_field(payload, longitude_field))
    if not -90 <= latitude <= 90:
        raise ValueError("Latitude must be between -90 and 90")
    if not -180 <= longitude <= 180:
        raise ValueError("Longitude must be between -180 and 180")
    return Position(latitude=latitude, longitude=longitude)


class ShipMonitor:
    def __init__(self, ship_name: str, threshold_meters: float = 10) -> None:
        self.ship_name = ship_name
        self.threshold_meters = threshold_meters
        self._last_position: Position | None = None

    def update(self, position: Position) -> str | None:
        if self._last_position is None:
            self._last_position = position
            return f"{self.ship_name} location: {format_location(position)}"

        distance = meters_between(self._last_position, position)
        if distance <= self.threshold_meters:
            return None

        self._last_position = position
        return (
            f"{self.ship_name} moved {distance:.1f} meters to "
            f"{format_location(position)}"
        )
