# Jelly Stream Viewer

En moderne webapplikasjon for streaming fra Jellyfin media server, bygget med React, TypeScript, Tailwind CSS og Supabase.

## Funksjoner

- 🎬 Stream filmer og serier fra Jellyfin
- 📱 Mobilvennlig design
- 🔐 Brukerautentisering og rollestyring
- ⭐ Favoritter og visningshistorikk
- 📺 Chromecast-støtte
- 🌐 Undertekststøtte
- 🎯 Integrasjon med Jellyseerr for forespørsler (under jobb enda)

## Forutsetninger

- Ubuntu Server 20.04+ (eller annen Linux-distribusjon)
- Node.js 18+ og npm
- En Jellyfin media server (kjørende og tilgjengelig)
- En Supabase-konto (eller selvhostet Supabase)
- (Valgfritt) Jellyseerr-instans for medieforespørsler

## Rask installasjon på Ubuntu

### Automatisk installasjon

Kjør installasjonsskriptet for automatisk oppsett:

```bash
# Last ned prosjektet fra GitHub
git clone <DIN_GITHUB_URL>
cd jelly-stream-viewer

# Gjør skriptet kjørbart
chmod +x setup.sh

# Kjør installasjonsskriptet
sudo ./setup.sh
```

Skriptet vil:
1. Installere Node.js og npm hvis de mangler
2. Installere alle nødvendige avhengigheter
3. Sette opp miljøvariabler
4. Bygge produksjonsversjonen
5. Installere og konfigurere Nginx som reverse proxy
6. Sette opp systemd-tjeneste for automatisk start

### Manuell installasjon

Hvis du foretrekker manuell installasjon, se [DEPLOYMENT.md](DEPLOYMENT.md) for detaljerte instruksjoner.

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
