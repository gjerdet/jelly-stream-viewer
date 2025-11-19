# Oppsett av automatisk oppdatering

Dette dokumentet beskriver hvordan du setter opp automatisk oppdatering av Jelly Stream Viewer fra GUI.

## Oversikt

Systemet består av:
1. **Edge Function** (`trigger-update`) - Mottar forespørsel fra GUI
2. **Webhook Server** (`update-webhook.js`) - Kjører på serveren og tar imot signaler
3. **Update Script** (`update-server.js`) - Kjører faktisk git pull og npm install

## Steg 1: Generer Webhook Secret

Lag en sterk, tilfeldig nøkkel:

```bash
# På Linux/Mac:
openssl rand -hex 32

# Eller i Node.js:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Lagre denne nøkkelen et trygt sted. Du trenger den både på serveren og i databasen.

## Steg 2: Start Webhook Server

### Manuell start (testing)

```bash
cd /path/to/jelly-stream-viewer

# Sett miljøvariabler
export WEBHOOK_SECRET="your-secret-key-here"
export WEBHOOK_PORT=3001
export PROJECT_PATH="/path/to/jelly-stream-viewer"

# Start server
node server/update-webhook.js
```

### Automatisk start med PM2 (anbefalt)

Installer PM2 hvis du ikke har det:

```bash
npm install -g pm2
```

Opprett PM2 ecosystem-fil (`ecosystem.config.js`):

```javascript
module.exports = {
  apps: [{
    name: 'jelly-webhook',
    script: './server/update-webhook.js',
    cwd: '/path/to/jelly-stream-viewer',
    env: {
      NODE_ENV: 'production',
      WEBHOOK_SECRET: 'your-secret-key-here',
      WEBHOOK_PORT: 3001,
      PROJECT_PATH: '/path/to/jelly-stream-viewer'
    },
    autorestart: true,
    watch: false,
    max_memory_restart: '200M',
    error_file: '/var/log/jelly-webhook-error.log',
    out_file: '/var/log/jelly-webhook-out.log'
  }]
};
```

Start med PM2:

```bash
pm2 start ecosystem.config.js
pm2 save  # Lagre PM2-prosesslisten
pm2 startup  # Generer oppstartsskript
```

### Automatisk start med systemd

Opprett service-fil (`/etc/systemd/system/jelly-webhook.service`):

```ini
[Unit]
Description=Jelly Stream Viewer Webhook Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/jelly-stream-viewer
Environment="NODE_ENV=production"
Environment="WEBHOOK_SECRET=your-secret-key-here"
Environment="WEBHOOK_PORT=3001"
Environment="PROJECT_PATH=/path/to/jelly-stream-viewer"
ExecStart=/usr/bin/node /path/to/jelly-stream-viewer/server/update-webhook.js
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=jelly-webhook

[Install]
WantedBy=multi-user.target
```

Aktiver og start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable jelly-webhook
sudo systemctl start jelly-webhook
sudo systemctl status jelly-webhook
```

## Steg 3: Konfigurer Nginx (hvis du bruker det)

Hvis appen din kjører bak Nginx, legg til proxy for webhooket:

```nginx
# I din eksisterende server-block
location /webhook/update {
    proxy_pass http://localhost:3001;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_set_header Host $host;
    proxy_cache_bypass $http_upgrade;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Reload Nginx:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Steg 4: Konfigurer i Admin Panel

1. Gå til Admin → Database eller logg inn i backend
2. Legg til følgende innstillinger i `server_settings` tabellen:

```sql
-- Webhook URL (bytt ut domenet med ditt eget)
INSERT INTO server_settings (setting_key, setting_value)
VALUES ('update_webhook_url', 'https://jellyfin.gjerdet.casa/webhook/update')
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = EXCLUDED.setting_value;

-- Webhook Secret (samme som du brukte i trinn 1)
INSERT INTO server_settings (setting_key, setting_value)
VALUES ('update_webhook_secret', 'your-secret-key-here')
ON CONFLICT (setting_key) 
DO UPDATE SET setting_value = EXCLUDED.setting_value;
```

Eller via GUI når det blir lagt til felt for det i Admin-panelet.

## Steg 5: Test Oppdateringssystemet

1. Gå til Admin → Versions
2. Klikk "Check for updates"
3. Hvis ny versjon er tilgjengelig, klikk "Install update"
4. Følg med på status i GUI

For å se logger på serveren:

```bash
# PM2
pm2 logs jelly-webhook

# systemd
sudo journalctl -u jelly-webhook -f

# Manuell kjøring
# Se output i terminalen
```

## Sikkerhet

**VIKTIG:**

1. **Webhook Secret**: Må være sterk og hemmelig. Aldri commit den til Git!
2. **Firewall**: Hvis mulig, kun tillat webhook-forespørsler fra Supabase IP-er
3. **HTTPS**: Bruk alltid HTTPS for webhook URL i produksjon
4. **Filrettigheter**: Sørg for at webhook-serveren har riktige rettigheter til å kjøre git og npm

## Feilsøking

### Webhook-serveren starter ikke

```bash
# Sjekk om porten er i bruk
sudo netstat -tlnp | grep 3001

# Sjekk logger
pm2 logs jelly-webhook
# eller
sudo journalctl -u jelly-webhook -n 50
```

### Oppdateringen feiler

1. Sjekk at webhook-serveren kjører
2. Verifiser at webhook URL er riktig konfigurert
3. Sjekk at webhook secret matcher mellom server og database
4. Se på logger på serveren for detaljert feilmelding

### Nginx returnerer 502 Bad Gateway

- Sjekk at webhook-serveren kjører på riktig port
- Verifiser at proxy_pass URL i Nginx er korrekt
- Sjekk Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

## Avansert: Custom Update Script

Hvis du vil tilpasse oppdateringsprosessen, kan du modifisere `update-server.js`:

```javascript
// Eksempel: Legg til database-migrering
async function runMigrations() {
  console.log('Running database migrations...');
  // Din migreringslogikk her
}

// I update-scriptet, etter npm install:
await runMigrations();
```

## Automatisk rollback ved feil

Du kan legge til automatisk rollback hvis oppdateringen feiler:

```javascript
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function updateWithRollback() {
  // Lagre gjeldende commit
  const { stdout: currentCommit } = await execPromise('git rev-parse HEAD');
  
  try {
    // Forsøk oppdatering
    await execPromise('git pull origin main');
    await execPromise('npm install');
    await execPromise('npm run build');
  } catch (error) {
    console.error('Update failed, rolling back...');
    // Gå tilbake til forrige commit
    await execPromise(`git reset --hard ${currentCommit.trim()}`);
    throw error;
  }
}
```
