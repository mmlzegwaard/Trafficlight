# Trafficlight

Trafficlight monitors the location of the Cruiseship Rotterdam and prints a notice whenever the current position differs by more than 10 meters from the last reported location.

## Usage

Provide an HTTP(S) endpoint that returns JSON coordinates:

```json
{
  "latitude": 51.921295,
  "longitude": 4.479622
}
```

Run the monitor with:

```bash
python -m trafficlight https://example.com/rotterdam.json
```

Optional flags:

- `--name` to override the ship name shown in notices
- `--latitude-field` and `--longitude-field` for nested JSON field paths such as `ship.position.lat`
- `--threshold-meters` to change the movement threshold
- `--poll-interval` to control how often the endpoint is checked

Example output:

```text
Cruiseship Rotterdam location: 51.921295, 4.479622
Cruiseship Rotterdam moved 22.2 meters to 51.921495, 4.479622
```
