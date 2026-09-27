# Trafficlight

Minimal Node-app om cruiseschip **Rotterdam** te volgen op een aparte pagina.

## Functies
- Pagina op `/rotterdam` met de laatste bekende positie
- Alert in de browser zodra het schip 10 meter of meer is verplaatst
- Emailhook voor een melding naar een configureerbaar adres
- API-endpoints om de huidige status op te vragen en direct opnieuw te pollen

## Configuratie
Stel deze omgevingsvariabelen in:

- `ROTTERDAM_TRACKER_SOURCE_URL`: JSON-endpoint met de positie van het schip (optioneel; zonder deze variabele gebruikt de app een laatste bekende fallbacklocatie)
- `ROTTERDAM_TRACKER_ALERT_EMAIL`: optioneel emailadres voor alerts
- `ROTTERDAM_TRACKER_POLL_INTERVAL_MS`: optioneel poll-interval in milliseconden
- `HOST`: optioneel hostadres, standaard `0.0.0.0`
- `PORT`: optionele poort, standaard `3000`

De bron mag een enkel object, een array van schepen, of een object met `ships` bevatten. De parser accepteert onder andere `name`, `shipName`, `vesselName`, `latitude`, `lat`, `longitude`, `lon` en `lng`.

## Gebruik
```bash
npm install
npm start
```

Open daarna `http://localhost:3000/rotterdam`.

## Extern bekijken
De sandbox-URL van de agent is niet publiek zichtbaar. Om de site extern te bekijken kun je de app als container starten op een server of VPS:

```bash
docker build -t trafficlight .
docker run -d \
  -p 3000:3000 \
  -e ROTTERDAM_TRACKER_SOURCE_URL="https://jouw-bron/rotterdam.json" \
  -e ROTTERDAM_TRACKER_ALERT_EMAIL="mmlzegwaard@example.com" \
  --name trafficlight \
  trafficlight
```

Open daarna `http://<jouw-server>:3000/rotterdam`.

## API
- `GET /api/rotterdam/status`
- `POST /api/rotterdam/poll`

## Testen
```bash
npm test
```
