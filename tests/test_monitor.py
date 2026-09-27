import argparse
import unittest
from unittest.mock import patch

from trafficlight.__main__ import build_notice, parse_args
from trafficlight.monitor import Position, ShipMonitor, extract_position, format_location, meters_between


class MetersBetweenTests(unittest.TestCase):
    def test_same_location_has_zero_distance(self) -> None:
        self.assertEqual(meters_between(Position(51.0, 4.0), Position(51.0, 4.0)), 0)

    def test_small_latitude_change_exceeds_ten_meters(self) -> None:
        distance = meters_between(Position(51.921295, 4.479622), Position(51.921395, 4.479622))
        self.assertGreater(distance, 10)


class ExtractPositionTests(unittest.TestCase):
    def test_extracts_nested_fields(self) -> None:
        payload = {"ship": {"position": {"lat": "51.921295", "lon": "4.479622"}}}

        position = extract_position(payload, "ship.position.lat", "ship.position.lon")

        self.assertEqual(position, Position(51.921295, 4.479622))


class ShipMonitorTests(unittest.TestCase):
    def test_reports_initial_location(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)

        notice = monitor.update(Position(51.921295, 4.479622))

        self.assertEqual(notice, "Cruiseship Rotterdam location: 51.921295, 4.479622")

    def test_ignores_small_moves(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)
        monitor.update(Position(51.921295, 4.479622))

        notice = monitor.update(Position(51.921345, 4.479622))

        self.assertIsNone(notice)

    def test_reports_moves_over_threshold(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)
        monitor.update(Position(51.921295, 4.479622))

        notice = monitor.update(Position(51.921495, 4.479622))

        self.assertIn("Cruiseship Rotterdam moved", notice)
        self.assertIn(format_location(Position(51.921495, 4.479622)), notice)

    def test_exact_threshold_does_not_report(self) -> None:
        start = Position(51.921295, 4.479622)
        end = Position(51.921395, 4.479622)
        threshold = meters_between(start, end)
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=threshold)
        monitor.update(start)

        notice = monitor.update(end)

        self.assertIsNone(notice)

    def test_does_not_accumulate_sub_threshold_moves(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)
        first = Position(51.921295, 4.479622)
        second = Position(51.921345, 4.479622)
        third = Position(51.921395, 4.479622)
        monitor.update(first)

        second_notice = monitor.update(second)
        third_notice = monitor.update(third)

        self.assertIsNone(second_notice)
        self.assertIsNone(third_notice)


class ParseArgsTests(unittest.TestCase):
    def test_rejects_negative_threshold(self) -> None:
        with self.assertRaises(SystemExit):
            parse_args(["https://example.com/rotterdam.json", "--threshold-meters", "-1"])

    def test_rejects_negative_poll_interval(self) -> None:
        with self.assertRaises(SystemExit):
            parse_args(["https://example.com/rotterdam.json", "--poll-interval", "-1"])

    def test_rejects_zero_poll_interval(self) -> None:
        with self.assertRaises(SystemExit):
            parse_args(["https://example.com/rotterdam.json", "--poll-interval", "0"])

    def test_rejects_non_http_source(self) -> None:
        with self.assertRaises(SystemExit):
            parse_args(["file:///tmp/rotterdam.json"])


class BuildNoticeTests(unittest.TestCase):
    def test_build_notice_propagates_invalid_payload_errors(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)

        with patch("trafficlight.__main__.read_payload", return_value={"latitude": 91, "longitude": 4.479622}):
            with self.assertRaises(ValueError):
                build_notice(
                    source="https://example.com/rotterdam.json",
                    latitude_field="latitude",
                    longitude_field="longitude",
                    monitor=monitor,
                )

    def test_build_notice_rejects_non_http_source(self) -> None:
        monitor = ShipMonitor("Cruiseship Rotterdam", threshold_meters=10)

        with self.assertRaises(argparse.ArgumentTypeError):
            build_notice(
                source="file:///tmp/rotterdam.json",
                latitude_field="latitude",
                longitude_field="longitude",
                monitor=monitor,
            )


if __name__ == "__main__":
    unittest.main()
