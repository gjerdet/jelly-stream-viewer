# Jelly Stream Viewer

En moderne webapplikasjon for streaming fra Jellyfin media server - **optimalisert for lokal deployment**.

## 🏗️ Arkitektur

**Lokal deployment med cloud-basert autentisering:**
- Frontend snakker **direkte** med Jellyfin server (ingen proxy)
- Supabase Cloud håndterer autentisering og database
- Alt kjører på lokalt nettverk for beste ytelse

Se [ARCHITECTURE.md](ARCHITECTURE.md) for detaljert oversikt.

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

- **Ubuntu Server 20.04+** (eller annen Linux-distro)
- **Jellyfin media server** på samme nettverk (lokal IP)
- **Supabase-konto** (gratis på supabase.com) - kun for autentisering/database

**Viktig:** Frontend og Jellyfin må være på samme nettverk for at direktekommunikasjon skal fungere.

---

## ⚙️ Oppsett etter installasjon

### 1. Første gangs pålogging
```
http://din-server-ip
```

### 2. Opprett brukerkonto
Registrer en ny bruker via nettsiden.

### 3. Første bruker blir automatisk admin
**Første bruker som registrerer seg blir automatisk admin** - ingen manuell konfigurasjon nødvendig!

Hvis du trenger å gjøre flere brukere til admin, kan du gjøre dette via backend-grensesnittet eller kontakte systemadministrator.

### 4. Konfigurer servere
Gå til `/setup` ved første besøk og fyll inn:
- **Jellyfin Server URL**: `http://192.168.1.100:8096` (din lokale Jellyfin-server)
- **Jellyfin API Key**: Fra Jellyfin Dashboard → API Keys

**OBS:** Bruk lokal IP-adresse for Jellyfin-serveren, ikke `localhost` hvis frontend kjører på en annen maskin.

*Jellyseerr-konfigurasjon (valgfritt) gjøres via Admin-siden.*

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

Applikasjonen implementerer flere lag med sikkerhet:

### Autentisering
- **JWT-basert autentisering**: Alle API-kall krever gyldig JWT-token fra Supabase
- **Automatisk token-refresh**: Håndteres av Supabase-klienten
- **Session management**: Sikker lagring i localStorage med automatisk utlogging

### Database-sikkerhet (RLS)
Row Level Security (RLS) er aktivert på alle tabeller:
```sql
-- Eksempel: Brukere ser kun sine egne favoritter
CREATE POLICY "Users can view own favorites"
ON user_favorites FOR SELECT
USING (auth.uid() = user_id);

-- Admins har full tilgang
CREATE POLICY "Admins have full access"
ON user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### API-sikkerhet
- **API-nøkler i database**: Jellyfin/Jellyseerr-nøkler lagres kryptert, kun tilgjengelig via edge functions
- **Input-validering**: Zod-schemas validerer alle brukerinput
- **CORS**: Konfigurert for sikker cross-origin kommunikasjon

### Edge Functions
- **JWT-verifisering**: Aktivert på alle sensitive endepunkter (se `supabase/config.toml`)
- **Rate limiting**: Implementert via Supabase
- **Logging**: Alle API-kall logges for revisjon

### HTTPS og transport
- **HTTPS via Nginx + Certbot**: Anbefalt for produksjon
- **Secure cookies**: HttpOnly og Secure flags på sessions
- **HSTS**: HTTP Strict Transport Security aktivert

## Support

For problemer eller spørsmål:
- Opprett en issue på GitHub
- Se [DEPLOYMENT.md](DEPLOYMENT.md) for feilsøking
- Sjekk Supabase logs for backend-feil

## Lovable Integration

Dette prosjektet kan også redigeres via Lovable:

**URL**: https://lovable.dev/projects/205817f9-c090-44eb-91ab-92eabefe1aae

Endringer gjort i Lovable vil automatisk committes til dette repoet, og endringer pushet til GitHub vil reflekteres i Lovable.

## Bidra

Bidrag er velkomne! Vennligst:
1. Fork prosjektet
2. Opprett en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit endringer (`git commit -m 'Add some AmazingFeature'`)
4. Push til branch (`git push origin feature/AmazingFeature`)
5. Åpne en Pull Request

### Utviklingsoppsett
```bash
npm install
npm run dev
```

## Lisens

Dette prosjektet er lisensiert under MIT License - se [LICENSE](LICENSE) filen for detaljer.
