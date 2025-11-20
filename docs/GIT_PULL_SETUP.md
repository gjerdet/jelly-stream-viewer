# Git Pull Oppdateringssystem

**Nytt og enklere oppdateringssystem!** Ingen webhook, domene eller proxy nødvendig.

## Hvordan det fungerer

I stedet for komplisert webhook-infrastruktur, kjører vi bare `git pull` lokalt på serveren:

```
Admin Panel → Edge Function → Localhost Server → Git Pull
```

## Automatisk Oppsett (Anbefalt)

Kjør setup-scriptet som root:

```bash
sudo bash setup-git-pull-service.sh
```

Dette scriptet:
- ✅ Lager en lokal server på `localhost:3002`
- ✅ Genererer sikkerhetsnøkkel
- ✅ Setter opp systemd service (autostart)
- ✅ Starter serveren automatisk

## Admin Panel Konfigurasjon

Etter oppsett, gå til **Admin → Server Settings**:

1. **Git Pull Server URL**: `http://localhost:3002/git-pull`
2. **Git Pull Secret**: (Bruk nøkkelen fra setup-scriptet)

## Test Oppdatering

1. Gå til **Admin → Versjoner → Oppdateringshåndtering**
2. Klikk **"Installer oppdatering"**
3. Serveren kjører automatisk:
   ```bash
   git stash
   git pull origin main
   npm install --production
   npm run build
   ```

## Hva Skjer Under Oppdatering

Serveren kjører automatisk følgende kommandoer:

1. **`git stash`** - Lagrer lokale endringer
2. **`git pull origin main`** - Henter siste kode fra GitHub
3. **`npm install --production`** - Installerer nye dependencies
4. **`npm run build`** - Bygger applikasjonen

## Systemd Service Kommandoer

```bash
# Sjekk status
sudo systemctl status jelly-git-pull

# Se logger i sanntid
sudo journalctl -u jelly-git-pull -f

# Restart service
sudo systemctl restart jelly-git-pull

# Stopp service
sudo systemctl stop jelly-git-pull

# Start service
sudo systemctl start jelly-git-pull
```

## Health Check

Test at serveren kjører:

```bash
curl http://localhost:3002/health
```

Forventet respons:
```json
{
  "status": "ok",
  "service": "git-pull-server",
  "directory": "/path/til/jelly-stream-viewer"
}
```

## Manuelt Oppsett

Hvis du ikke vil bruke setup-scriptet:

### 1. Generer Secret

```bash
openssl rand -hex 32
```

Legg til i `.env`:
```
UPDATE_SECRET=din-genererte-nøkkel-her
```

### 2. Start Serveren Manuelt

```bash
node git-pull-server.js
```

### 3. Eller Lag Systemd Service Manuelt

Opprett `/etc/systemd/system/jelly-git-pull.service`:

```ini
[Unit]
Description=Jelly Stream Git Pull Server
After=network.target

[Service]
Type=simple
User=din-bruker
WorkingDirectory=/path/til/jelly-stream-viewer
Environment="GIT_PULL_PORT=3002"
Environment="APP_DIR=/path/til/jelly-stream-viewer"
EnvironmentFile=/path/til/jelly-stream-viewer/.env
ExecStart=/usr/bin/node /path/til/jelly-stream-viewer/git-pull-server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Aktiver og start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable jelly-git-pull
sudo systemctl start jelly-git-pull
```

## Sikkerhet

- ✅ Serveren lytter kun på `localhost` (ikke tilgjengelig utenfra)
- ✅ HMAC signatur-verifisering med secret
- ✅ Kun POST requests akseptert
- ✅ Ingen åpne porter i brannmur nødvendig

## Feilsøking

### Service starter ikke

Sjekk logger:
```bash
sudo journalctl -u jelly-git-pull -n 100
```

Vanlige problemer:
- **Port 3002 opptatt**: En annen prosess bruker porten
- **Node ikke funnet**: Installer Node.js eller oppdater ExecStart path
- **Permission denied**: Sjekk at brukeren har tilgang til app-directory

### "Git pull server er ikke tilgjengelig"

1. Sjekk at servicen kjører:
   ```bash
   sudo systemctl status jelly-git-pull
   ```

2. Test health endpoint:
   ```bash
   curl http://localhost:3002/health
   ```

3. Sjekk brannmur (selv om localhost vanligvis er åpen):
   ```bash
   sudo ufw status
   ```

### Git pull feiler

Sjekk at:
- Git repository er korrekt konfigurert
- Du har SSH keys eller credentials satt opp for GitHub
- Du har skriverettigheter i app-directory

Test manuelt:
```bash
cd /path/til/jelly-stream-viewer
git pull origin main
```

## Sammenligning med Webhook

| Feature | Webhook System | Git Pull System |
|---------|---------------|-----------------|
| Domene nødvendig | ✅ Ja | ❌ Nei |
| Proxy/Nginx | ✅ Ja | ❌ Nei |
| SSL sertifikat | ✅ Ja | ❌ Nei |
| Åpne porter | ✅ Ja | ❌ Nei |
| Kompleksitet | 🔴 Høy | 🟢 Lav |
| Oppsett tid | 30+ min | 2 min |

## Fordeler

✅ **Ingen ekstern tilgang nødvendig** - Alt kjører på localhost
✅ **Enkel oppsett** - Ett script, ferdig!
✅ **Fungerer uten domene** - Perfekt for hjemmeservere
✅ **Ingen proxy** - Ingen Nginx eller Cloudflare nødvendig
✅ **Raskere** - Direkte kommunikasjon
✅ **Sikrere** - Ikke eksponert på internett
✅ **Færre feilkilder** - Mindre som kan gå galt

## Ofte Stilte Spørsmål

**Q: Kan jeg bruke dette uten GitHub?**
A: Ja, men du må håndtere oppdateringer manuelt. Git Pull systemet forutsetter at du har GitHub integration.

**Q: Hva skjer med mine lokale endringer?**
A: `git stash` lagrer dem automatisk før pull.

**Q: Må jeg restarte applikasjonen?**
A: Nei, `npm run build` bygger automatisk. Refresh nettleseren for å se endringer.

**Q: Kan jeg bruke dette med Docker?**
A: Ja, men du må mounte git-pull-server.js inn i containeren og eksponere port 3002 internt.

**Q: Hva hvis oppdateringen feiler?**
A: Sjekk logs med `sudo journalctl -u jelly-git-pull -f` for å se hva som gikk galt.
