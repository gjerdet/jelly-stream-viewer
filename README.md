# Jelly Stream Viewer

> 🎬 En moderne, responsiv webapplikasjon for streaming fra Jellyfin-medieservere

[![CI](https://github.com/gjerdet/jelly-stream-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/gjerdet/jelly-stream-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://react.dev/)

En fullstack media streaming-løsning med autentisering, brukerroller, innholdsforespørsler og sanntidsoppdateringer.

## 🌟 Funksjoner

- 🎬 **Stream filmer og TV-serier** - Direkte streaming fra Jellyfin
- 📱 **Mobilresponsiv** - Fungerer flott på alle enheter
- 🔐 **Brukerautentisering** - Sikker innlogging med rollebasert tilgang
- ⭐ **Favoritter og visningshistorikk** - Hold oversikt over innholdet ditt
- 📺 **Chromecast-støtte** - Cast til TV-en din
- 🌐 **Undertekststøtte** - Flere undertekstalternativer
- 🎯 **Jellyseerr-integrasjon** - Be om innhold med admin-godkjenning
- 📰 **Nyhetsfeed** - Hold deg oppdatert med kunngjøringer
- 👥 **Brukerstyring** - Adminpanel for brukerkontroll
- 🔄 **Auto-oppdateringer** - Innebygd oppdateringssporing og -styring
- 📊 **Statistikk** - Se dine seervaner

## 🏗️ Arkitektur

**Frontend**: React + TypeScript + Vite + Tailwind CSS + shadcn/ui  
**Backend**: Lovable Cloud (bygget på Supabase)

```
┌─────────────┐
│   Browser   │
└──────┬──────┘
       │
       ├──────────────────────┐
       │                      │
       ▼                      ▼
┌─────────────┐        ┌────────────┐
│   Jellyfin  │        │  Lovable   │
│    Server   │        │   Cloud    │
│             │        │            │
│  • Video    │        │  • Auth    │
│  • Metadata │        │  • DB      │
│  • Bilder   │        │  • Edge Fn │
└─────────────┘        └────────────┘
```

## 🚀 Kom i gang

### Forutsetninger

- En **Jellyfin-medieserver** (med API-tilgang)
- (Valgfritt) En **Jellyseerr**-instans for innholdsforespørsler

### Første gangs oppsett

1. **Registrer en konto**
   - Gå til applikasjonen
   - Klikk "Registrer" og opprett kontoen din
   - Den første registrerte brukeren blir automatisk admin

2. **Konfigurer Jellyfin-tilkobling**
   - Logg inn med din nye konto
   - Gå til **Admin → Servere**
   - Skriv inn Jellyfin-serverdetaljer:
     - Server-URL (f.eks. `http://192.168.1.100:8096`)
     - API-nøkkel (generer i Jellyfin Dashboard → Avansert → API-nøkler)

3. **(Valgfritt) Konfigurer Jellyseerr**
   - I samme Servere-fane
   - Skriv inn Jellyseerr-URL og API-nøkkel

4. **Begynn å se!**
   - Bla gjennom mediebiblioteket ditt
   - Legg til favoritter
   - Start streaming

## 💻 Utvikling

### 🎯 Local Dev vs Production

- **Local Dev** (`npm run dev`) - For utvikling og testing på din maskin
- **Production** - Deployed til Lovable Cloud eller self-hosted med Nginx

For full utviklingsguide, se [DEVELOPMENT.md](DEVELOPMENT.md)

### ⚡ Quick Start (Local Dev)

```bash
# 1. Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# 2. Klon og installer
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer
npm install

# 3. Konfigurer miljøvariabler
cp .env.example .env
nano .env  # Fyll inn Lovable Cloud-verdier

# 4. Start utviklingsserver
npm run dev
```

Besøk `http://localhost:5173` 🚀

### 🔐 Viktig om .env

⚠️ **KRITISK**: `.env` skal **ALDRI** committes til Git!

Hvis `.env` allerede er i Git-historikken:
1. Se [GIT_CLEANUP.md](GIT_CLEANUP.md) for instruksjoner
2. Roter alle API-nøkler umiddelbart

### 🛠️ Tilgjengelige kommandoer

```bash
npm run dev      # Start utviklingsserver (hot reload)
npm run build    # Bygg for produksjon (output: dist/)
npm run lint     # Kjør ESLint
npm run preview  # Test produksjonsbygg lokalt
```

## 🚀 Deployment

Se [DEPLOYMENT.md](DEPLOYMENT.md) for detaljerte instruksjoner om:
- Lovable Cloud deployment (anbefalt)
- Self-hosted deployment (Ubuntu med Nginx)

### 🔄 Auto-Update Setup

For selvhostede installasjoner med automatiske oppdateringer:

```bash
cd ~/jelly-stream-viewer
chmod +x setup-auto-update.sh
./setup-auto-update.sh
```

Dette scriptet setter opp:
- ✅ Webhook-server for automatiske oppdateringer
- ✅ Systemd-service som starter automatisk
- ✅ Nginx-konfigurasjon (hvis du har domene)
- ✅ Sikkerhetsgenerering (webhook secret)
- ✅ Health checks og testing

**Etter oppsett:**
1. Lim inn webhook secret og URL i admin-panelet
2. (Valgfritt) Konfigurer GitHub webhook for automatiske deployments

Se [WEBHOOK_SETUP.md](WEBHOOK_SETUP.md) for detaljert dokumentasjon.

## 👥 Brukerroller

### Admin
- Full tilgang til alle funksjoner
- Brukerstyring
- Serverkonfigurasjon
- Godkjenning av innholdsforespørsler
- Nyhetsinnlegg

### Bruker
- Bla gjennom og se innhold
- Administrer favoritter og visningshistorikk
- Be om innhold (hvis Jellyseerr er konfigurert)
- Se nyheter

## 🔒 Sikkerhet

- JWT-basert autentisering via Lovable Cloud
- Row-Level Security (RLS) på alle databasetabeller
- API-nøkler lagres sikkert med admin-only tilgang
- Se [SECURITY.md](SECURITY.md) for detaljer

## 📁 Prosjektstruktur

```
jelly-stream-viewer/
├── src/
│   ├── components/        # React-komponenter
│   │   ├── ui/           # shadcn/ui-komponenter
│   │   └── ...           # Feature-komponenter
│   ├── pages/            # Sidekomponenter
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Hjelpefunksjoner
│   └── integrations/     # Eksterne integrasjoner
│
├── supabase/             # Backend-konfigurasjon
│   ├── functions/        # Edge Functions
│   └── setup.sql         # Databaseskjema
│
├── public/               # Statiske assets
├── docs/                 # Dokumentasjon
└── .github/              # GitHub Actions workflows
```

## 🧪 Testing

Prosjektet har omfattende test-dekning:

```bash
# Kjør enhetstester
npm run test

# Kjør E2E-tester
npm run test:e2e

# Se test coverage
npm run test:coverage
```

Se [TESTING.md](TESTING.md) for full testguide.

## 🔍 Feilsøking

### Kan ikke koble til Jellyfin

**Sjekk:**
- Jellyfin-server kjører
- Server-URL er korrekt (inkluder http:// eller https://)
- API-nøkkel er gyldig
- Serveren er tilgjengelig fra nettverket ditt

### Autentiseringsproblemer

**Sjekk:**
- Lovable Cloud backend er tilgjengelig
- Nettleser-cookies er aktivert
- Ingen nettleserutvidelser blokkerer forespørsler

### Video spiller ikke av

**Sjekk:**
- Jellyfin-server kan transkode mediet
- Nettleseren støtter video-codecen
- Nettverkstilkoblingen er stabil
- CORS er riktig konfigurert på Jellyfin

## 📦 Releases

Vi følger [Semantic Versioning](https://semver.org/). Se [RELEASE_PROCESS.md](RELEASE_PROCESS.md) for detaljer.

**Siste versjon**: [Se releases](https://github.com/gjerdet/jelly-stream-viewer/releases)

## 🤝 Bidrag

Bidrag er velkommen! Se [CONTRIBUTING.md](CONTRIBUTING.md) for full guide.

**Quick start**:
1. Fork repository
2. Installer pre-commit hook: `cp .githooks/pre-commit .git/hooks/pre-commit && chmod +x .git/hooks/pre-commit`
3. Opprett feature branch: `git checkout -b feature/min-feature`
4. Gjør endringer og commit: `git commit -m "feat: beskrivelse"`
5. Send Pull Request mot `develop` branch

## 📄 Lisens

MIT License - se [LICENSE](LICENSE) filen for detaljer.

## 🙏 Anerkjennelser

Bygget med:
- [React](https://react.dev/)
- [Lovable](https://lovable.dev/)
- [Jellyfin](https://jellyfin.org/)
- [Jellyseerr](https://github.com/Fallenbagel/jellyseerr)
- [shadcn/ui](https://ui.shadcn.com/)
- [Tailwind CSS](https://tailwindcss.com/)

## 📞 Support

For problemer eller spørsmål:
- Opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues)
- Sjekk eksisterende dokumentasjon
- Gjennomgå lukkede issues for løsninger

---

**Laget med ❤️ for Jellyfin-brukere**
