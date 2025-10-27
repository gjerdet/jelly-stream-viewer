# Deployment Guide - Lokal Ubuntu Server

Denne guiden forklarer hvordan du deployer Jelly Stream Viewer på din lokale Ubuntu-server.

## Oversikt

Applikasjonen består av:
- **Frontend**: React + Vite applikasjon (statiske filer)
- **Backend**: Supabase (database + edge functions)
- **Media Server**: Din eksisterende Jellyfin-server

## Forutsetninger

Før du starter, sørg for at du har:
- ✅ En Ubuntu-server (20.04 eller nyere)
- ✅ SSH-tilgang til serveren
- ✅ En Jellyfin media server som kjører
- ✅ En Supabase-konto eller selvhostet Supabase-instans
- ✅ Git installert på serveren
- ✅ (Valgfritt) Et domenenavn eller bruk IP-adresse

## Installasjonsprosess

### Steg 1: Klon prosjektet fra GitHub

SSH inn på Ubuntu-serveren din og klon prosjektet:

```bash
# Logg inn på serveren
ssh bruker@din-server-ip

# Klon prosjektet (erstatt med din GitHub URL)
git clone https://github.com/ditt-brukernavn/jelly-stream-viewer.git
cd jelly-stream-viewer
```

### Steg 2: Kjør installasjonsskriptet

Skriptet vil automatisk:
- Installere Node.js hvis det mangler
- Installere npm-avhengigheter
- Sette opp miljøvariabler
- Bygge applikasjonen
- Konfigurere Nginx med CORS-støtte for direkte Jellyfin-streaming
- (Valgfritt) Sette opp systemd service

```bash
# Gjør skriptet kjørbart
chmod +x setup.sh

# Kjør installasjonsskriptet med sudo
sudo ./setup.sh
```

**Viktig om video-streaming:**
Installasjonsskriptet konfigurerer automatisk CORS-headere i Nginx som tillater direkte video-streaming fra Jellyfin-serveren. Dette gir best mulig kvalitet da Jellyfin håndterer all transkoding direkte uten mellomliggende proxyer.

Under installasjonen vil du bli spurt om:
1. **Supabase URL**: Finn dette i Supabase Dashboard → Project Settings → API
2. **Supabase Publishable Key**: Samme sted som URL
3. **Supabase Project ID**: Samme sted som URL
4. **Server navn/IP**: IP-adressen til serveren din (f.eks. 192.168.1.100)
5. **Systemd service**: Om du vil ha automatisk start ved server-reboot
6. **Firewall**: Om port 80 skal åpnes automatisk

### Steg 3: Konfigurer Supabase

#### A) Opprett database-tabeller

1. Logg inn på [Supabase Dashboard](https://supabase.com/dashboard)
2. Velg ditt prosjekt
3. Gå til **SQL Editor** i venstre meny
4. Kjør SQL-skriptet fra `README.md` under "Sett opp Supabase" seksjonen

Dette oppretter:
- Brukerroller og profiler
- Serverinnstillinger (Jellyfin API-nøkler)
- Visningshistorikk
- Favoritter og likes
- Nyhetsinnlegg

#### B) Deploy Edge Functions

Edge functions håndterer all kommunikasjon med Jellyfin:

```bash
# Installer Supabase CLI (hvis ikke allerede installert)
npm install -g supabase

# Logg inn
supabase login

# Link til ditt prosjekt
supabase link --project-ref <din-project-ref>

# Deploy alle edge functions
supabase functions deploy jellyfin-proxy
supabase functions deploy jellyfin-stream
supabase functions deploy jellyfin-subtitle
supabase functions deploy jellyfin-download-subtitle
supabase functions deploy jellyfin-search-subtitles
supabase functions deploy jellyseerr-request
supabase functions deploy jellyseerr-search
supabase functions deploy jellyseerr-discover
```

#### C) Opprett første admin-bruker

1. Besøk applikasjonen: `http://din-server-ip`
2. Registrer en ny brukerkonto
3. Hent bruker-ID fra Supabase Dashboard:
   - Gå til **Authentication** → **Users**
   - Kopier UUID for brukeren din
4. Kjør denne SQL-en i SQL Editor:

```sql
-- Erstatt <USER_ID> med UUID fra forrige steg
INSERT INTO public.user_roles (user_id, role)
VALUES ('<USER_ID>', 'admin');
```

### Steg 4: Konfigurer applikasjonen

1. Logg inn i applikasjonen som admin
2. Gå til **Admin**-siden (i menyen øverst til høyre)
3. Legg inn følgende informasjon:
   - **Jellyfin Server URL**: `http://din-jellyfin-server:8096`
   - **Jellyfin API Key**: Finn i Jellyfin → Dashboard → Advanced → API Keys
   - (Valgfritt) **Jellyseerr URL** og **API Key**

### Steg 5: Test installasjonen

1. Besøk `http://din-server-ip` i nettleseren
2. Logg inn med admin-kontoen
3. Sjekk at du ser innhold fra Jellyfin-serveren
4. Test videoavspilling
5. Test favoritter og visningshistorikk

## Nettverk og tilgjengelighet

### Lokal tilgang

Applikasjonen er nå tilgjengelig på:
- **Internt nettverk**: `http://192.168.x.x` (server IP)
- **Lokal server**: `http://localhost` (på serveren selv)

### Ekstern tilgang (valgfritt)

For tilgang utenfor hjemmenettverket:

#### Alternativ 1: Port Forwarding (enklest)

1. Logg inn på ruteren din
2. Sett opp port forwarding for port 80 til server IP
3. Finn din eksterne IP: `curl ifconfig.me`
4. Tilgang: `http://din-eksterne-ip`

**Viktig**: Dette er ikke anbefalt uten SSL/HTTPS!

#### Alternativ 2: VPN (sikrere)

Sett opp en VPN-løsning som:
- WireGuard
- OpenVPN
- Tailscale (enklest)

#### Alternativ 3: Reverse Proxy med SSL (best)

Bruk Cloudflare Tunnel eller lignende for sikker tilgang.

## SSL/HTTPS-konfigurering

For sikker tilgang anbefales SSL:

### Med Certbot (gratis Let's Encrypt)

```bash
# Installer Certbot
sudo apt-get install certbot python3-certbot-nginx

# Konfigurer SSL (krever domenenavn)
sudo certbot --nginx -d ditt-domene.no

# Sertifikatet fornyes automatisk
```

### Med selvlagd sertifikat (kun for testing)

```bash
# Generer sertifikat
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/jelly-stream.key \
  -out /etc/ssl/certs/jelly-stream.crt

# Oppdater Nginx konfigurasjon manuelt
```

## Vedlikehold

### Oppdatere applikasjonen

Når det kommer oppdateringer på GitHub:

```bash
# Gå til installasjonskatalogen
cd /path/to/jelly-stream-viewer

# Pull nyeste endringer
git pull origin main

# Installer nye avhengigheter
npm install

# Bygg på nytt
npm run build

# Restart tjenestene
sudo systemctl restart nginx
# Hvis du bruker systemd service:
sudo systemctl restart jelly-stream
```

### Backup

Viktige ting å ta backup av:
1. **.env fil**: Inneholder konfigurasjon
2. **Supabase database**: Ta backup i Supabase Dashboard
3. **Nginx konfigurasjon**: `/etc/nginx/sites-available/jelly-stream`

### Monitorering

Sjekk logger for feil:

```bash
# Nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log

# Systemd service logs (hvis aktivert)
sudo journalctl -u jelly-stream -f

# Supabase Edge Function logs
# Se i Supabase Dashboard → Functions → Logs
```

## Feilsøking

### Problem: Kan ikke se innhold fra Jellyfin

**Løsning**:
1. Sjekk at Jellyfin-serveren kjører: `http://jellyfin-ip:8096`
2. Verifiser API-nøkkelen i Admin-panelet
3. Sjekk at server URL er riktig (inkludert http:// eller https://)
4. Se Edge Function logs i Supabase Dashboard

### Problem: Video spiller ikke eller dårlig kvalitet

**Løsning**:
1. Verifiser at CORS-headere er konfigurert i Nginx:
   ```bash
   sudo cat /etc/nginx/sites-available/jelly-stream | grep "Access-Control"
   ```
2. Hvis CORS-headere mangler, legg til følgende i Nginx-konfigurasjonen under `server` blokken:
   ```nginx
   # CORS headers for direkte Jellyfin-streaming
   add_header 'Access-Control-Allow-Origin' '*' always;
   add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, HEAD' always;
   add_header 'Access-Control-Allow-Headers' 'Range, Origin, X-Requested-With, Content-Type, Accept, Authorization' always;
   add_header 'Access-Control-Expose-Headers' 'Content-Length, Content-Range, Accept-Ranges' always;
   ```
3. Test og restart Nginx:
   ```bash
   sudo nginx -t
   sudo systemctl reload nginx
   ```

### Problem: 502 Bad Gateway

**Løsning**:
1. Sjekk at Nginx kjører: `sudo systemctl status nginx`
2. Sjekk Nginx konfigurasjon: `sudo nginx -t`
3. Se Nginx error logs: `sudo tail -f /var/log/nginx/error.log`

### Problem: Ingen tilgang fra andre enheter

**Løsning**:
1. Sjekk firewall: `sudo ufw status`
2. Åpne port 80: `sudo ufw allow 80/tcp`
3. Sjekk at serveren er tilgjengelig: `ping server-ip`

### Problem: Edge Functions feiler

**Løsning**:
1. Verifiser at alle functions er deployet: `supabase functions list`
2. Sjekk function logs i Supabase Dashboard
3. Redeploy functions: `supabase functions deploy function-name`

## Ytterligere ressurser

- [Supabase Dokumentasjon](https://supabase.com/docs)
- [Nginx Dokumentasjon](https://nginx.org/en/docs/)
- [Jellyfin Dokumentasjon](https://jellyfin.org/docs/)
- [Certbot Dokumentasjon](https://certbot.eff.org/instructions)

## Support

For problemer eller spørsmål:
- Opprett en issue på GitHub
- Sjekk eksisterende issues for løsninger
- Se README.md for mer detaljert dokumentasjon
