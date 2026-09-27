from __future__ import annotations

import argparse
import json
import time
from typing import Any
from urllib.request import urlopen

from .monitor import ShipMonitor, extract_position


def non_negative_number(value: str) -> float:
    number = float(value)
    if number < 0:
        raise argparse.ArgumentTypeError("must be greater than or equal to 0")
    return number


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Monitor the Rotterdam cruise ship position and only report movement "
            "greater than a configured threshold."
        )
    )
    parser.add_argument("source", help="HTTP(S) JSON endpoint with vessel coordinates")
    parser.add_argument("--name", default="Cruiseship Rotterdam")
    parser.add_argument("--latitude-field", default="latitude")
    parser.add_argument("--longitude-field", default="longitude")
    parser.add_argument("--threshold-meters", type=non_negative_number, default=10)
    parser.add_argument("--poll-interval", type=non_negative_number, default=60)
    return parser.parse_args(argv)


def read_payload(source: str) -> Any:
    with urlopen(source) as response:  # noqa: S310
        return json.load(response)


def main() -> int:
    args = parse_args()
    monitor = ShipMonitor(args.name, threshold_meters=args.threshold_meters)

    while True:
        payload = read_payload(args.source)
        position = extract_position(
            payload,
            latitude_field=args.latitude_field,
            longitude_field=args.longitude_field,
        )
        notice = monitor.update(position)
        if notice:
            print(notice, flush=True)
        time.sleep(args.poll_interval)


if __name__ == "__main__":
    raise SystemExit(main())
