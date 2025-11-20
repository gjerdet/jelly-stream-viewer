# Autostart Setup for Update Webhook Server

Denne guiden viser hvordan du setter opp update-serveren til å starte automatisk ved oppstart og holde seg oppe.

## Automatisk Setup (Anbefalt)

Kjør setup-scriptet som root:

```bash
sudo bash setup-update-service.sh
```

Dette scriptet gjør alt automatisk:
- Oppretter systemd service
- Aktiverer autostart ved oppstart
- Starter serveren
- Konfigurerer automatisk restart ved feil

## Manuell Setup

Hvis du ønsker å sette opp manuelt:

### 1. Opprett systemd service

```bash
sudo nano /etc/systemd/system/jelly-update-server.service
```

Lim inn:

```ini
[Unit]
Description=Jelly Stream Viewer Auto-Update Server
After=network.target
Wants=network-online.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/home/joakim/jelly-stream-viewer
Environment="NODE_ENV=production"
Environment="PORT=3001"
Environment="UPDATE_SECRET=din-webhook-secret-her"
Environment="APP_DIR=/home/joakim/jelly-stream-viewer"
Environment="RESTART_COMMAND=sudo systemctl restart jelly-stream"
EnvironmentFile=/home/joakim/jelly-stream-viewer/.env
ExecStart=/usr/bin/node /home/joakim/jelly-stream-viewer/update-server.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-update

[Install]
WantedBy=multi-user.target
```

**VIKTIG**: Bytt ut `/home/joakim/jelly-stream-viewer` med din faktiske app-sti!

### 2. Aktiver og start service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Aktiver service (autostart ved oppstart)
sudo systemctl enable jelly-update-server.service

# Start service
sudo systemctl start jelly-update-server.service

# Sjekk status
sudo systemctl status jelly-update-server.service
```

## Nyttige Kommandoer

```bash
# Sjekk om servicen kjører
sudo systemctl status jelly-update-server

# Se logger i sanntid
sudo journalctl -u jelly-update-server -f

# Se de siste 50 linjene av logger
sudo journalctl -u jelly-update-server -n 50

# Restart servicen
sudo systemctl restart jelly-update-server

# Stopp servicen
sudo systemctl stop jelly-update-server

# Start servicen
sudo systemctl start jelly-update-server

# Deaktiver autostart
sudo systemctl disable jelly-update-server
```

## Feilsøking

### Servicen starter ikke

Sjekk logger:
```bash
sudo journalctl -u jelly-update-server -n 100
```

Vanlige problemer:
- **Port 3001 er opptatt**: En annen prosess bruker porten. Finn og stopp den andre prosessen.
- **Node ikke funnet**: Installer Node.js eller oppdater `ExecStart` stien i service-filen.
- **Mangler miljøvariabler**: Sjekk at `.env` filen eksisterer og har korrekte verdier.

### Servicen crasher

Hvis servicen crasher, vil systemd automatisk restarte den etter 10 sekunder (RestartSec=10).

Se hvorfor den crashet:
```bash
sudo journalctl -u jelly-update-server -n 100 --no-pager
```

### Port 3001 er opptatt

Finn hva som bruker porten:
```bash
sudo lsof -i :3001
```

Stopp prosessen:
```bash
sudo kill <PID>
```

## Sikkerhet

Servicen kjører som `www-data` bruker av sikkerhetsgrunner. Hvis du trenger å kjøre som en annen bruker, endre `User=` linjen i service-filen.

## Webhook URL

Når servicen kjører, er webhook tilgjengelig på:
- Lokalt: `http://localhost:3001/update`
- Eksternt: `http://ditt-domene.com:3001/update` (husk å åpne port 3001 i brannmuren)

Eller bruk nginx proxy (anbefalt):
- `http://ditt-domene.com/update-webhook`

Konfigurer denne URL-en i Admin → Servers → Update Webhook URL.
