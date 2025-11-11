# Lokal Deployment Guide

Denne guiden forklarer hvordan du setter opp Jelly Stream Viewer lokalt på din egen server eller maskin.

## 📋 Innholdsfortegnelse

- [Deployment Alternativer](#deployment-alternativer)
- [Anbefalt: Supabase Cloud + Lokal Frontend](#anbefalt-supabase-cloud--lokal-frontend)
- [Alternativ: 100% Lokal med Docker](#alternativ-100-lokal-med-docker)
- [Manuell Deployment](#manuell-deployment)
- [Vedlikehold og Oppgradering](#vedlikehold-og-oppgradering)

---

## Deployment Alternativer

Det finnes tre måter å deploye Jelly Stream Viewer:

### 1. 🌟 Supabase Cloud + Lokal Frontend (ANBEFALT)
- **Fordeler:** Enklest oppsett, full funksjonalitet, gratis tier
- **Ulemper:** Krever internett for auth og edge functions
- **Best for:** De fleste brukere

### 2. 🐳 100% Lokal med Docker
- **Fordeler:** Full kontroll, offline capable, data på din maskin
- **Ulemper:** Begrenset funksjonalitet (ingen auth, edge functions)
- **Best for:** Avanserte brukere, testing, utvikling

### 3. 🔧 Manuell Deployment
- **Fordeler:** Maksimal kontroll over hver komponent
- **Ulemper:** Krever teknisk kunnskap
- **Best for:** System administrators

---

## Anbefalt: Supabase Cloud + Lokal Frontend

Dette er den enkleste måten å komme i gang på, med full funksjonalitet.

### Rask Start

```bash
# 1. Klon repo
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer

# 2. Kjør interaktivt setup
chmod +x setup-local.sh
./setup-local.sh

# Velg alternativ 1: Supabase Cloud
```

### Steg-for-steg

#### 1. Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com)
2. Opprett gratis konto
3. Klikk "New Project"
4. Velg:
   - Organization (opprett ny hvis første gang)
   - Project name: `jelly-stream-viewer`
   - Database Password: (lagre dette!)
   - Region: Velg nærmeste (Europe West for Norge)
5. Klikk "Create new project"
6. Vent 1-2 minutter

#### 2. Konfigurer Database

1. Gå til **SQL Editor** i Supabase Dashboard
2. Klikk "+ New query"
3. Kopier hele innholdet fra `supabase/setup.sql`
4. Lim inn og klikk **Run**
5. Sjekk at alle tabeller er opprettet under **Table Editor**

#### 3. Konfigurer Authentication

1. Gå til **Authentication → Providers**
2. Under **Email**:
   - Enable **Email provider** ✅
   - **Disable** "Confirm email" ❌ (viktig for testing!)
   - Save

#### 4. Hent API Keys

1. Gå til **Project Settings → API**
2. Kopier disse verdiene:
   - **Project URL** (f.eks. `https://xxxxx.supabase.co`)
   - **anon public** key (lang JWT token)
   - **Project ID** (fra URL eller settings)

#### 5. Konfigurer Environment

Opprett `.env` fil:
```bash
cp .env.example .env
nano .env
```

Fyll inn:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=xxxxx
```

#### 6. Installer og Bygg

```bash
# Installer dependencies
npm install

# Bygg for produksjon
npm run build
```

#### 7. Deploy med Nginx

```bash
# Installer Nginx
sudo apt-get update
sudo apt-get install nginx

# Opprett config
sudo nano /etc/nginx/sites-available/jelly-stream-viewer
```

Lim inn:
```nginx
server {
    listen 80;
    server_name din-ip-eller-domene;
    
    root /path/to/jelly-stream-viewer/dist;
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;
}
```

Aktiver:
```bash
sudo ln -s /etc/nginx/sites-available/jelly-stream-viewer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

#### 8. Første Gangs Oppsett

1. Åpne `http://din-server-ip` i nettleser
2. Klikk **Registrer**
3. Opprett første bruker (blir automatisk admin)
4. Gå til `/setup`
5. Konfigurer:
   - Jellyfin Server URL
   - Jellyfin API Key
   - (Valgfritt) Jellyseerr

---

## Alternativ: 100% Lokal med Docker

For de som vil ha full kontroll og kjøre alt lokalt.

### ⚠️ Viktige Begrensninger

- **Ingen autentisering** - Må implementere egen auth-løsning
- **Ingen Edge Functions** - API-kall må håndteres annerledes
- **Manuell konfigurasjon** - Jellyfin setup via database

### Rask Start

```bash
# Kjør setup script
./setup-local.sh

# Velg alternativ 2: Lokal PostgreSQL
```

### Docker Compose Arkitektur

```yaml
services:
  postgres:    # PostgreSQL 15 database
  pgadmin:     # Web-basert database admin (valgfritt)
```

### Manuell Docker Setup

#### 1. Konfigurer Environment

```bash
cp .env.local.example .env.local
nano .env.local
```

Konfigurer:
```env
DB_NAME=jellystream
DB_USER=jellystream
DB_PASSWORD=ditt_sikre_passord_her
DB_PORT=5432
```

#### 2. Start Database

```bash
# Start bare PostgreSQL
docker-compose --env-file .env.local up -d postgres

# Eller med pgAdmin for GUI
docker-compose --env-file .env.local --profile admin up -d
```

#### 3. Verifiser Database

```bash
# Sjekk at container kjører
docker ps

# Test connection
docker exec -it jelly-stream-db psql -U jellystream -d jellystream -c "SELECT version();"
```

#### 4. Kjør Migrations

Migrations kjøres automatisk via `docker-entrypoint-initdb.d`, men du kan kjøre manuelt:

```bash
docker exec -i jelly-stream-db psql -U jellystream -d jellystream < supabase/setup.sql
```

#### 5. pgAdmin (Valgfritt)

Hvis du startet med `--profile admin`:

1. Åpne http://localhost:5050
2. Logg inn:
   - Email: `admin@jellystream.local`
   - Passord: Fra `.env.local`
3. Legg til server:
   - Host: `postgres` (Docker network)
   - Port: 5432
   - Database: `jellystream`
   - Username: Fra `.env.local`
   - Password: Fra `.env.local`

### Begrensninger og Løsninger

#### Problem: Ingen Autentisering

**Løsning 1: Basic Auth via Nginx**
```nginx
location / {
    auth_basic "Jelly Stream";
    auth_basic_user_file /etc/nginx/.htpasswd;
    try_files $uri $uri/ /index.html;
}
```

**Løsning 2: Bruk Supabase Cloud bare for Auth**
- Bruk Supabase for authentication
- Lokal PostgreSQL for data
- Best of both worlds!

#### Problem: Ingen Edge Functions

**Løsning:** Direct Jellyfin/Jellyseerr API calls fra frontend
- Legg til CORS i Jellyfin
- Bruk Jellyfin/Jellyseerr API direkte
- Mer eksponering, men fungerer

---

## Manuell Deployment

For avanserte brukere som vil ha full kontroll.

### Systemkrav

- Ubuntu 20.04+ (eller lignende)
- Node.js 18+
- PostgreSQL 15+
- Nginx (eller annen webserver)
- Git

### 1. Installer PostgreSQL

```bash
# Legg til PostgreSQL repo
sudo sh -c 'echo "deb http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" > /etc/apt/sources.list.d/pgdg.list'
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | sudo apt-key add -

# Installer
sudo apt-get update
sudo apt-get install postgresql-15 postgresql-contrib-15

# Konfigurer
sudo -u postgres createuser jellystream
sudo -u postgres createdb jellystream
sudo -u postgres psql -c "ALTER USER jellystream WITH PASSWORD 'ditt_passord';"
```

### 2. Kjør Migrations

```bash
sudo -u postgres psql jellystream < supabase/setup.sql
```

### 3. Bygg og Deploy

Se "Anbefalt" seksjonen over for build og Nginx setup.

---

## Vedlikehold og Oppgradering

### Oppdatere til Ny Versjon

```bash
cd jelly-stream-viewer

# Pull nyeste endringer
git pull origin main

# Installer nye dependencies
npm install

# Bygg på nytt
npm run build

# Restart webserver
sudo systemctl reload nginx

# (Docker) Restart containers
docker-compose restart
```

### Kjøre Nye Migrations

Når det kommer nye database-endringer:

**Supabase Cloud:**
1. Gå til SQL Editor
2. Kjør nye migration files fra `supabase/migrations/`

**Lokal PostgreSQL:**
```bash
# Docker
docker exec -i jelly-stream-db psql -U jellystream -d jellystream < supabase/migrations/NEW_MIGRATION.sql

# Manuell
sudo -u postgres psql jellystream < supabase/migrations/NEW_MIGRATION.sql
```

### Backup og Restore

#### Backup

**Docker:**
```bash
docker exec jelly-stream-db pg_dump -U jellystream jellystream > backup_$(date +%Y%m%d).sql
```

**Manuell:**
```bash
sudo -u postgres pg_dump jellystream > backup_$(date +%Y%m%d).sql
```

#### Restore

**Docker:**
```bash
docker exec -i jelly-stream-db psql -U jellystream -d jellystream < backup_20240101.sql
```

**Manuell:**
```bash
sudo -u postgres psql jellystream < backup_20240101.sql
```

### Monitorering

#### Docker Logs

```bash
# Database logs
docker logs -f jelly-stream-db

# Alle containers
docker-compose logs -f
```

#### PostgreSQL Performance

```sql
-- Koble til database
psql -U jellystream -d jellystream

-- Sjekk aktive connections
SELECT * FROM pg_stat_activity;

-- Database størrelse
SELECT pg_size_pretty(pg_database_size('jellystream'));

-- Tabell størrelser
SELECT schemaname, tablename, 
       pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

---

## Feilsøking

### Database Connection Issues

```bash
# Test connection
psql -U jellystream -h localhost -d jellystream

# Sjekk at port er åpen
sudo netstat -plnt | grep 5432

# Docker: Sjekk container status
docker ps
docker logs jelly-stream-db
```

### Build Errors

```bash
# Tøm cache
rm -rf node_modules package-lock.json
npm install

# Prøv build igjen
npm run build
```

### Nginx Issues

```bash
# Test config
sudo nginx -t

# Sjekk error logs
sudo tail -f /var/log/nginx/error.log

# Restart
sudo systemctl restart nginx
```

---

## Sikkerhet

### Database Sikkerhet

```sql
-- Endre database passord
ALTER USER jellystream WITH PASSWORD 'nytt_sikkert_passord';
```

### Firewall

```bash
# Tillat bare nødvendige porter
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable

# IKKE åpne PostgreSQL port 5432 til internett!
```

### HTTPS (Anbefalt for produksjon)

```bash
# Installer Certbot
sudo apt-get install certbot python3-certbot-nginx

# Få SSL sertifikat
sudo certbot --nginx -d ditt-domene.com

# Auto-renewal er satt opp automatisk
```

---

## Support

Problemer? Se [README.md](README.md) for kontaktinfo eller opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues).
