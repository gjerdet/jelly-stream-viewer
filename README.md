# Jelly Stream Viewer

En moderne webapplikasjon for streaming fra Jellyfin media server.

## 🚀 Rask installasjon (Ubuntu)

### Copy-paste disse 4 kommandoene:

```bash
git clone <DIN_GITHUB_URL> jelly-stream-viewer && cd jelly-stream-viewer
```

```bash
chmod +x setup.sh && sudo ./setup.sh
```

Det er alt! Skriptet installerer alt du trenger automatisk.

---

## 📋 Hva trenger du?

- Ubuntu Server 20.04+
- En Jellyfin media server (må være tilgjengelig)
- En Supabase-konto (gratis på supabase.com)

---

## ⚙️ Oppsett etter installasjon

### 1. Første gangs pålogging
```
http://din-server-ip
```

### 2. Opprett brukerkonto
Registrer en ny bruker via nettsiden.

### 3. Gjør deg selv til admin
Logg inn på [Supabase Dashboard](https://supabase.com/dashboard) og kjør:

```sql
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'din@epost.no');
```

### 4. Konfigurer servere
Gå til Admin-siden og fyll inn:
- **Jellyfin Server URL**: `http://din-jellyfin-server:8096`
- **Jellyfin API Key**: Fra Jellyfin Dashboard → API Keys
- **Jellyseerr URL**: (valgfritt) `http://din-jellyseerr-server:5055`
- **Jellyseerr API Key**: (valgfritt) Fra Jellyseerr Settings

---

## 🔧 Funksjoner

- 🎬 Stream filmer og serier fra Jellyfin
- 📱 Mobilvennlig design
- 🔐 Brukerautentisering og rollestyring
- ⭐ Favoritter og visningshistorikk
- 📺 Chromecast-støtte
- 🌐 Undertekststøtte
- 🎯 Jellyseerr-integrasjon med admin-godkjenning

## Konfigurasjon

### Første gangs oppsett

1. Besøk applikasjonen i nettleseren: `http://din-server-ip`
2. Registrer en brukerkonto
3. Logg inn som admin (sett i databasen)
4. Gå til Admin-siden og konfigurer:
   - **Jellyfin Server URL**: URL til din Jellyfin-server
   - **Jellyfin API Key**: API-nøkkel fra Jellyfin
   - **Jellyseerr URL**: (valgfritt) URL til Jellyseerr
   - **Jellyseerr API Key**: (valgfritt) API-nøkkel for Jellyseerr

Se [DEPLOYMENT.md](DEPLOYMENT.md) for fullstendig installasjonsveiledning.

## Oppgradering

For å oppdatere til nyeste versjon:

```bash
# Pull nyeste endringer fra GitHub
git pull origin main

# Installer nye avhengigheter
npm install

# Bygg på nytt
npm run build

# Restart tjenesten
sudo systemctl restart nginx
```

## Utviklingsmodus

For å kjøre i utviklingsmodus:

```bash
npm run dev
```

Applikasjonen vil være tilgjengelig på `http://localhost:8080`

## Dokumentasjon

- [Deployment Guide](DEPLOYMENT.md) - Fullstendig guide for lokal installasjon
- [Supabase Setup](DEPLOYMENT.md#steg-3-konfigurer-supabase) - Database og edge functions
- [Feilsøking](DEPLOYMENT.md#feilsøking) - Vanlige problemer og løsninger

## Teknologi

Dette prosjektet er bygget med:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS
- Supabase (database + edge functions)
- Jellyfin API

## Sikkerhet

Applikasjonen har følgende sikkerhetstiltak:
- API-nøkler lagres sikret i database (kun tilgjengelig via edge functions)
- JWT-basert autentisering for streaming
- Input-validering på alle endpoints
- Row Level Security (RLS) i Supabase
- HTTPS støtte via Nginx + Certbot

## Support

For problemer eller spørsmål:
- Opprett en issue på GitHub
- Se [DEPLOYMENT.md](DEPLOYMENT.md) for feilsøking
- Sjekk Supabase logs for backend-feil

## Lovable Integration

Dette prosjektet kan også redigeres via Lovable:

**URL**: https://lovable.dev/projects/205817f9-c090-44eb-91ab-92eabefe1aae

Endringer gjort i Lovable vil automatisk committes til dette repoet, og endringer pushet til GitHub vil reflekteres i Lovable.

## Lisens

Dette prosjektet er åpen kildekode.
