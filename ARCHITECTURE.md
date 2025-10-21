# Arkitektur - Lokal Deployment

## Oversikt

Jelly Stream Viewer er designet for **lokal deployment** hvor frontend og Jellyfin-server kjører på samme nettverk.

## Komponenter

```
┌─────────────────────────────────────────────────────┐
│                 Lokalt Nettverk                      │
│                                                      │
│  ┌──────────────┐          ┌──────────────┐        │
│  │   Frontend   │◄────────►│   Jellyfin   │        │
│  │  (Nginx/Web) │  Direkte │    Server    │        │
│  └──────┬───────┘    HTTP   └──────────────┘        │
│         │                                            │
│         │ Auth/DB                                    │
│         ▼                                            │
│  ┌──────────────┐                                   │
│  │   Internet   │                                   │
│  └──────┬───────┘                                   │
└─────────┼────────────────────────────────────────────┘
          │
          ▼
   ┌──────────────┐
   │   Supabase   │
   │    Cloud     │
   │ (Auth + DB)  │
   └──────────────┘
```

## Dataflyt

### 1. Jellyfin-kommunikasjon (Lokal)
- Frontend snakker **direkte** med Jellyfin server via lokal IP
- Ingen proxy eller edge functions involvert
- Bruker `X-Emby-Token` header for autentisering
- Eksempel: `http://192.168.1.100:8096/Users`

### 2. Autentisering & Database (Cloud)
- Supabase Cloud håndterer:
  - Bruker-autentisering (login/signup)
  - Database (favoritter, historikk, innstillinger)
  - RLS policies for sikkerhet

### 3. Jellyseerr-integrasjon (Optional, via Edge Functions)
- Jellyseerr requests kjører fortsatt via edge functions
- Dette er OK siden Jellyseerr ofte er ekstern

## Viktrige Filer

### Frontend → Jellyfin Direkte
- `src/hooks/useJellyfinDirect.tsx` - Ny hook for direkte kommunikasjon
- `src/hooks/useJellyfinApi.tsx` - Oppdatert til å bruke direkte kommunikasjon
- `src/lib/jellyfinApi.ts` - Hjelpefunksjoner for Jellyfin API

### Database Tilgang
- `src/hooks/useServerSettings.tsx` - Henter server URL og API key
- `src/pages/Setup.tsx` - Lagrer innstillinger direkte til database

### Deprecated (ikke lenger i bruk)
- `supabase/functions/jellyfin-proxy/` - Edge function proxy (fjernet)
- `supabase/functions/jellyfin-setup/` - Setup edge function (fjernet)
- `supabase/functions/jellyfin-search-subtitles/` - Undertekst-søk (fjernet)
- `supabase/functions/jellyfin-download-subtitle/` - Undertekst-nedlasting (fjernet)

## Sikkerhetsoverveielser

### ✅ Trygt
- Jellyfin API-nøkkel lagres i database med RLS
- Kun admins kan oppdatere server-innstillinger
- Bruker-data beskyttes av RLS policies

### ⚠️ Pass på
- Jellyfin må være tilgjengelig på nettverket
- CORS må være konfigurert på Jellyfin hvis nødvendig
- Frontend må hostes på samme nettverk som Jellyfin

## Setup for Produksjon

1. **Server-oppsett**:
   ```bash
   ./setup.sh
   ```

2. **Konfigurer Jellyfin**:
   - Gå til `/setup` første gang
   - Fyll inn lokal Jellyfin URL (f.eks. `http://192.168.1.100:8096`)
   - Opprett API-nøkkel i Jellyfin Dashboard

3. **Supabase Cloud**:
   - Allerede konfigurert i `.env`
   - Ingen endringer nødvendig

## Debugging

### Sjekk Jellyfin-tilkobling
```bash
curl http://192.168.1.100:8096/System/Info
```

### Sjekk database-innstillinger
```sql
SELECT * FROM server_settings;
```

### Console logs
Åpne browser DevTools → Console for feilmeldinger

## Fremtidige Forbedringer

- [ ] Mulighet for HTTPS på lokal Jellyfin
- [ ] Automatisk discovery av Jellyfin på nettverket
- [ ] Lokal cache av metadata
- [ ] Offline-modus
