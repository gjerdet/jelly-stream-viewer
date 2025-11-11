# Jelly Stream Viewer

En moderne webapplikasjon for streaming fra Jellyfin media server - **optimalisert for selvhosting**.

## 🏗️ Arkitektur

**Lokal deployment med egen database:**
- Frontend snakker **direkte** med Jellyfin server for optimal kvalitet
- Jellyfin håndterer all video-transkoding
- Nginx konfigureres automatisk med CORS for direkte streaming
- Supabase håndterer autentisering og database
- Alt kjører på lokalt nettverk for beste ytelse

Se [ARCHITECTURE.md](ARCHITECTURE.md) for detaljert oversikt.

## 📋 Hva trenger du?

- **Ubuntu Server 20.04+** (eller annen Linux-distro)
- **Node.js 18+** og **npm**
- **Jellyfin media server** på samme nettverk
- **Egen Supabase-konto** (gratis på supabase.com)

## 🚀 Selvhosting - Komplett guide

### Steg 1: Klon prosjektet

```bash
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer
```

### Steg 2: Opprett Supabase-prosjekt

1. Gå til [supabase.com](https://supabase.com) og opprett en gratis konto
2. Opprett et nytt prosjekt
3. Vent til databasen er klar (tar 1-2 minutter)

### Steg 3: Sett opp databasen

1. Gå til **SQL Editor** i Supabase Dashboard
2. Klikk **+ New query**
3. Kopier HELE innholdet fra `supabase/setup.sql` og lim inn
4. Klikk **Run** for å kjøre scriptet
5. Sjekk at alle tabeller er opprettet under **Table Editor**

### Steg 4: Konfigurer autentisering

1. Gå til **Authentication → Providers** i Supabase Dashboard
2. Under **Email**:
   - Aktiver **Enable Email provider**
   - **VIKTIG:** Skru **AV** "Confirm email" (sett til disabled)
   - Lagre endringer

### Steg 5: Hent API-nøkler

1. Gå til **Project Settings → API** i Supabase Dashboard
2. Kopier disse verdiene:
   - **Project URL** (f.eks. `https://xxxxx.supabase.co`)
   - **anon/public key** (lang JWT-token)
   - **Project ID** (kort ID)

### Steg 6: Opprett .env fil

1. Kopier example-filen:
```bash
cp .env.example .env
```

2. Rediger `.env` og fyll inn dine verdier:
```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=xxxxx
```

### Steg 7: Installer og bygg

```bash
# Installer avhengigheter
npm install

# Bygg for produksjon
npm run build
```

### Steg 8: Sett opp webserver (Nginx)

1. Installer Nginx:
```bash
sudo apt update
sudo apt install nginx
```

2. Opprett Nginx config:
```bash
sudo nano /etc/nginx/sites-available/jelly-stream-viewer
```

3. Lim inn denne konfigurasjonen:
```nginx
server {
    listen 80;
    server_name din-server-ip;  # Bytt ut med din IP eller domene
    
    root /path/to/jelly-stream-viewer/dist;  # Bytt ut med full sti
    index index.html;
    
    location / {
        try_files $uri $uri/ /index.html;
    }
    
    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
```

4. Aktiver siden:
```bash
sudo ln -s /etc/nginx/sites-available/jelly-stream-viewer /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### Steg 9: Første gangs oppsett

1. Åpne nettleseren på `http://din-server-ip`
2. Klikk **Registrer** og opprett første bruker
3. **Første bruker blir automatisk admin!**
4. Gå til `/setup` og konfigurer:
   - Jellyfin Server URL (f.eks. `http://192.168.1.100:8096`)
   - Jellyfin API Key (hent fra Jellyfin Dashboard → API Keys)
   - (Valgfritt) Jellyseerr URL og API Key

## ✅ Du er ferdig!

Applikasjonen kjører nå på din egen server med din egen database.

---

## 🔧 Funksjoner

- 🎬 Stream filmer og serier fra Jellyfin
- 📱 Mobilvennlig design
- 🔐 Brukerautentisering og rollestyring
- ⭐ Favoritter og visningshistorikk
- 📺 Chromecast-støtte
- 🌐 Undertekststøtte
- 🎯 Jellyseerr-integrasjon med admin-godkjenning

## 🔧 Vedlikehold og oppgradering

### Oppdatere til ny versjon

```bash
cd jelly-stream-viewer
git pull origin main
npm install
npm run build
sudo systemctl reload nginx
```

### Kjøre database-migrasjoner

Hvis det kommer nye database-endringer i oppdateringer:
1. Sjekk `supabase/migrations/` for nye .sql filer
2. Kjør de nye migrasjonene i Supabase SQL Editor
3. Eller kjør hele `supabase/setup.sql` på nytt (trygt med `IF NOT EXISTS`)

## 🛠️ Utviklingsmodus

```bash
npm install
npm run dev
```

Applikasjonen vil være tilgjengelig på `http://localhost:8080`

**OBS:** Du må fortsatt ha `.env` konfigurert med Supabase-credentials for at appen skal fungere.

## 📚 Filer for selvhosting

- **`supabase/setup.sql`** - Komplett database-oppsett (kjør i Supabase SQL Editor)
- **`.env.example`** - Template for environment variabler
- **`setup.sh`** - Automatisk installasjonsscript for Ubuntu (legacy)
- **Edge Functions** i `supabase/functions/` - Deploy via Supabase CLI om nødvendig

## ⚠️ Viktige sikkerhetspunkter

### Database-sikkerhet
- **Row Level Security (RLS)** er aktivert på alle tabeller
- Brukere kan kun se sine egne data (favoritter, historikk, etc.)
- Admins har full tilgang via `has_role()` funksjonen
- Første bruker blir automatisk admin

### Autentisering
- Bruk **sterke passord** for alle brukerkontoer
- Første bruker er admin - opprett denne kontoen først!
- Skru **AV** email confirmation i Supabase for enkel selvhosting
- For produksjon: Aktiver email confirmation og SMTP

### API-nøkler
- Jellyfin og Jellyseerr API-nøkler lagres i databasen
- Kun synlig for admins via RLS policies
- Aldri commit `.env` til Git (allerede i `.gitignore`)

## 🧰 Teknologi

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn-ui
- **Database:** PostgreSQL via Supabase
- **Auth:** Supabase Authentication
- **Backend:** Supabase Edge Functions (Deno)
- **Media:** Jellyfin API
- **Requests:** Jellyseerr API (valgfritt)

## 🔧 Feilsøking

### "Failed to fetch" eller connection errors
- Sjekk at `.env` har riktige Supabase credentials
- Verifiser at Supabase-prosjektet er aktivt
- Sjekk at email confirmation er skrudd AV i Supabase

### Kan ikke logge inn
- Første bruker MÅ registreres via `/register` ruten
- Sjekk at `setup.sql` er kjørt korrekt
- Verifiser at RLS policies er opprettet

### Jellyfin-innhold vises ikke
- Gå til `/setup` og konfigurer Jellyfin URL og API key
- Sjekk at Jellyfin-server er tilgjengelig fra appen
- Verifiser CORS-innstillinger i Jellyfin

### Database errors
- Sjekk at alle tabeller er opprettet: `supabase/setup.sql`
- Verifiser at triggers og funksjoner eksisterer
- Se Supabase logs for detaljerte feilmeldinger

## 💬 Support og bidrag

### Rapporter problemer
Opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues) med:
- Beskrivelse av problemet
- Feilmeldinger (fra browser console eller Supabase logs)
- Steg for å reprodusere

### Bidra til prosjektet
Pull requests er velkomne! Se [CONTRIBUTING.md](CONTRIBUTING.md) for retningslinjer.

## 📜 Lisens

MIT License - se [LICENSE](LICENSE) filen for detaljer.

---

## 🎯 Komme i gang nå?

1. **[Opprett Supabase-konto](https://supabase.com)** (gratis)
2. **Kjør `supabase/setup.sql`** i SQL Editor
3. **Kopier `.env.example` → `.env`** og fyll inn API keys
4. **`npm install && npm run build`**
5. **Konfigurer Nginx** (se Steg 8)
6. **Registrer første bruker** → Blir admin automatisk!

Ferdig! 🚀
