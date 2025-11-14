# Jelly Stream Viewer

En moderne webapplikasjon for streaming fra Jellyfin-medieservere med et vakkert, responsivt grensesnitt.

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

## 💻 Lokal utvikling

### Rask start (Ubuntu/Debian)

```bash
# Installer Node.js 18 eller nyere
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs git

# Klon repository
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer

# Installer avhengigheter
npm install

# Opprett .env fil
cp .env.example .env
# Rediger .env og fyll inn dine Lovable Cloud-verdier:
# VITE_SUPABASE_URL=https://xxxxx.supabase.co
# VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbG...
# VITE_SUPABASE_PROJECT_ID=xxxxx

# Start utviklingsserver
npm run dev
```

Besøk `http://localhost:5173`

### Miljøvariabler

Opprett en `.env` fil (bruk `.env.example` som mal):

```env
VITE_SUPABASE_URL=din_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=din_supabase_anon_key
VITE_SUPABASE_PROJECT_ID=ditt_project_id
```

⚠️ **VIKTIG**: `.env` skal ALDRI committes til Git. Den er allerede i `.gitignore`.

### Tilgjengelige kommandoer

```bash
npm run dev      # Start utviklingsserver
npm run build    # Bygg for produksjon
npm run lint     # Kjør linter
npm run preview  # Forhåndsvis produksjonsbygg
```

## 🚀 Deployment

Se [DEPLOYMENT.md](DEPLOYMENT.md) for detaljerte instruksjoner om:
- Lovable Cloud deployment (anbefalt)
- Self-hosted deployment (Ubuntu med Nginx)

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

## 🤝 Bidrag

Bidrag er velkommen! Vennligst:

1. Fork repository
2. Opprett en feature branch
3. Gjør endringene dine
4. Test grundig
5. Send en pull request

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
