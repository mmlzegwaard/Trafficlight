import unittest

from trafficlight.monitor import Position, ShipMonitor, extract_position, format_location, meters_between


class MeterBetweenTests(unittest.TestCase):
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


if __name__ == "__main__":
    unittest.main()
