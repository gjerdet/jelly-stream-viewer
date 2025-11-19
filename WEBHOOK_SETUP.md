# Automatisk Webhook Oppsett

Webhooket settes nå opp automatisk når du kjører en oppdatering!

## Hva skjer automatisk?

1. **Nginx konfigureres** - `/update-webhook` endepunkt opprettes automatisk
2. **Systemd service** - Webhook serveren starter automatisk ved reboot
3. **Webhook URL** - Tilgjengelig på `http://ditt-domene.com/update-webhook`

## Første gangs oppsett

Første gang `update-server.js` kjører, vil den automatisk:
- Lage nginx config i `/etc/nginx/conf.d/webhook.conf`
- Lage systemd service `/etc/systemd/system/jelly-webhook.service`
- Starte webhook serveren automatisk

## Webhook URL oppsett

Gå til **Admin → Server Settings** og sett:
- **Update Webhook URL**: `http://ditt-domene.com/update-webhook` (eller `http://server-ip/update-webhook`)
- **Update Webhook Secret**: Den samme som i `.env` filen (`WEBHOOK_SECRET`)

## Manuell kontroll

Sjekk status på webhook service:
```bash
sudo systemctl status jelly-webhook
```

Se logger:
```bash
sudo journalctl -u jelly-webhook -f
```

Restart webhook service:
```bash
sudo systemctl restart jelly-webhook
```

## Miljøvariabler

Sett disse i `.env` filen:
```
WEBHOOK_SECRET=din-hemmelige-nøkkel-her
PROJECT_PATH=/var/www/jelly-stream-viewer
```

## Sikkerhet

- Webhooket bruker HMAC-SHA256 signatur-verifisering
- Kun requests med gyldig signatur aksepteres
- Nginx har standard rate limiting

## Feilsøking

Hvis webhook ikke virker:
1. Sjekk at servicen kjører: `sudo systemctl status jelly-webhook`
2. Sjekk nginx config: `sudo nginx -t`
3. Se webhook logger: `sudo journalctl -u jelly-webhook -f`
4. Verifiser at webhook URL er korrekt i Admin settings
5. Sjekk at WEBHOOK_SECRET matcher mellom edge function og server
