# Trafficlight

Minimal Node-app om cruiseschip **Rotterdam** te volgen op een aparte pagina.

## Functies
- Pagina op `/rotterdam` met de laatste bekende positie
- Alert in de browser zodra het schip 10 meter of meer is verplaatst
- Emailhook voor een melding naar `mmlzegwaard` of een configureerbaar adres
- API-endpoints om de huidige status op te vragen en direct opnieuw te pollen

## Configuratie
Stel deze omgevingsvariabelen in:

- `ROTTERDAM_TRACKER_SOURCE_URL`: JSON-endpoint met de positie van het schip
- `ROTTERDAM_TRACKER_ALERT_EMAIL`: optioneel emailadres voor alerts (standaard `mmlzegwaard`)
- `ROTTERDAM_TRACKER_POLL_INTERVAL_MS`: optioneel poll-interval in milliseconden
- `PORT`: optionele poort, standaard `3000`

De bron mag een enkel object, een array van schepen, of een object met `ships` bevatten. De parser accepteert onder andere `name`, `shipName`, `vesselName`, `latitude`, `lat`, `longitude`, `lon` en `lng`.

## Gebruik
```bash
npm install
npm start
```

Open daarna `http://localhost:3000/rotterdam`.

## API
- `GET /api/rotterdam/status`
- `POST /api/rotterdam/poll`

## Testen
```bash
npm test
```
