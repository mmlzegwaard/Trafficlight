from __future__ import annotations

import argparse
import json
import sys
import time
from typing import Any
from urllib.parse import urlparse
from urllib.request import urlopen

from .monitor import ShipMonitor, extract_position


def non_negative_number(value: str) -> float:
    number = float(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return number


def http_source(value: str) -> str:
    parsed = urlparse(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise argparse.ArgumentTypeError("source must be an http or https URL")
    return value


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Monitor the Rotterdam cruise ship position and only report movement "
            "greater than a configured threshold."
        )
    )
    parser.add_argument(
        "source",
        type=http_source,
        help="HTTP(S) JSON endpoint with vessel coordinates",
    )
    parser.add_argument("--name", default="Cruiseship Rotterdam")
    parser.add_argument("--latitude-field", default="latitude")
    parser.add_argument("--longitude-field", default="longitude")
    parser.add_argument("--threshold-meters", type=non_negative_number, default=10)
    parser.add_argument("--poll-interval", type=non_negative_number, default=60)
    return parser.parse_args(argv)


def read_payload(source: str) -> Any:
    http_source(source)
    with urlopen(source) as response:  # noqa: S310
        return json.load(response)


def build_notice(
    source: str,
    latitude_field: str,
    longitude_field: str,
    monitor: ShipMonitor,
) -> str | None:
    payload = read_payload(source)
    position = extract_position(
        payload,
        latitude_field=latitude_field,
        longitude_field=longitude_field,
    )
    return monitor.update(position)


def main() -> int:
    args = parse_args()
    monitor = ShipMonitor(args.name, threshold_meters=args.threshold_meters)

    while True:
        try:
            notice = build_notice(
                args.source,
                latitude_field=args.latitude_field,
                longitude_field=args.longitude_field,
                monitor=monitor,
            )
            if notice:
                sys.stdout.buffer.write(f"{notice}\n".encode("utf-8"))
                sys.stdout.flush()
        except (KeyError, OSError, TypeError, ValueError) as error:
            sys.stderr.write(f"Failed to refresh location: {error}\n")
            sys.stderr.flush()
        time.sleep(args.poll_interval)


if __name__ == "__main__":
    raise SystemExit(main())
