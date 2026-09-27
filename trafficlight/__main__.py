from __future__ import annotations

import argparse
import json
import time
from urllib.request import urlopen

from .monitor import ShipMonitor, extract_position


def parse_args() -> argparse.Namespace:
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
    parser.add_argument("--threshold-meters", type=float, default=10)
    parser.add_argument("--poll-interval", type=float, default=60)
    return parser.parse_args()


def read_payload(source: str) -> dict:
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
