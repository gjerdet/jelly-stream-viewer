# Development Guide

Denne guiden forklarer hvordan du setter opp og utvikler på Jelly Stream Viewer lokalt.

## 📋 Oversikt

**Type**: Frontend-only lokal utvikling  
**Backend**: Lovable Cloud (hosted eksternt)  
**Deployment**: Se [DEPLOYMENT.md](DEPLOYMENT.md)

## 🎯 Forskjell: Local Dev vs Self-Hosted

| Aspekt | Local Dev | Self-Hosted Production |
|--------|-----------|------------------------|
| **Formål** | Utvikling og testing | Produksjon hosting |
| **Backend** | Lovable Cloud (eksternt) | Lovable Cloud (eksternt) |
| **Frontend** | `npm run dev` på localhost | Nginx på server |
| **Port** | 5173 (Vite default) | 80/443 (HTTP/HTTPS) |
| **Hot reload** | ✅ Ja | ❌ Nei |
| **SSL** | ❌ Nei (unødvendig) | ✅ Ja (anbefalt) |
| **Bruksområde** | Kode, test, debug | Produksjon for brukere |

**TL;DR**: 
- **Local dev** = `npm run dev` for å utvikle
- **Self-hosted** = `npm run build` + Nginx for å hoste appen på egen server

## 🚀 Lokal oppsett

### Forutsetninger

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install -y git curl

# Installer Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Verifiser installasjon
node --version  # Skal være v18.x eller høyere
npm --version
```

### Installasjon

```bash
# 1. Klon repository
git clone https://github.com/gjerdet/jelly-stream-viewer.git
cd jelly-stream-viewer

# 2. Installer dependencies
npm install

# 3. Opprett .env fil
cp .env.example .env
```

### Konfigurer .env

Rediger `.env` og fyll inn verdier fra Lovable Cloud Dashboard:

```env
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_SUPABASE_PROJECT_ID=xxxxx
```

**Hvor finner jeg disse?**
1. Gå til Lovable editor
2. Klikk på Project → Settings → Cloud
3. Kopier verdiene

⚠️ **VIKTIG**: `.env` skal ALDRI committes til Git! Se [GIT_CLEANUP.md](GIT_CLEANUP.md) hvis den allerede er i Git.

### Start development server

```bash
npm run dev
```

Appen kjører nå på `http://localhost:5173`

### Dev server med nettverkstilgang

Nyttig hvis du vil teste fra mobil eller andre enheter:

```bash
npm run dev -- --host 0.0.0.0
```

Appen blir tilgjengelig på `http://[din-ip]:5173`

## 🛠️ Tilgjengelige kommandoer

```bash
# Development
npm run dev              # Start dev server med hot reload
npm run dev -- --host    # Dev server tilgjengelig på nettverk

# Production build
npm run build            # Bygg for produksjon (output: dist/)
npm run preview          # Test produksjonsbygg lokalt

# Code quality
npm run lint             # Kjør ESLint
npm run lint -- --fix    # Fiks automatisk linting-feil

# Type checking
npx tsc --noEmit         # Sjekk TypeScript-typer
```

## 📁 Prosjektstruktur

```
jelly-stream-viewer/
├── src/
│   ├── components/          # React komponenter
│   │   ├── ui/              # shadcn/ui komponenter (Radix + Tailwind)
│   │   ├── Header.tsx       # Global header
│   │   ├── MediaCard.tsx    # Media kort komponent
│   │   └── ...
│   │
│   ├── pages/               # Side-komponenter (React Router)
│   │   ├── Index.tsx        # Hjemmeside
│   │   ├── Browse.tsx       # Bla gjennom media
│   │   ├── Player.tsx       # Video player
│   │   └── ...
│   │
│   ├── hooks/               # Custom React hooks
│   │   ├── useAuth.tsx      # Autentisering
│   │   ├── useJellyfinApi.tsx
│   │   └── ...
│   │
│   ├── lib/                 # Utility funksjoner
│   │   ├── utils.ts         # Generelle hjelpere
│   │   └── jellyfinApi.ts   # Jellyfin API klient
│   │
│   ├── integrations/        # Eksterne integrasjoner
│   │   └── supabase/
│   │       ├── client.ts    # Supabase klient (AUTO-GENERERT)
│   │       └── types.ts     # TypeScript typer (AUTO-GENERERT)
│   │
│   ├── translations/        # i18n oversettelser
│   │   ├── en.ts
│   │   └── no.ts
│   │
│   ├── index.css            # Global CSS + Tailwind
│   ├── App.tsx              # Root komponent
│   └── main.tsx             # Entry point
│
├── supabase/                # Backend konfigurasjon (Lovable Cloud)
│   ├── functions/           # Edge Functions (serverless)
│   │   ├── jellyfin-proxy/  # Proxy for Jellyfin API
│   │   ├── jellyfin-stream/ # Video streaming
│   │   └── ...
│   ├── setup.sql            # Database skjema
│   └── policies.sql         # Row Level Security policies
│
├── public/                  # Statiske filer
├── docs/                    # Dokumentasjon
├── .github/                 # GitHub Actions workflows
│   └── workflows/
│       ├── ci.yml           # CI pipeline
│       └── security.yml     # Security scanning
│
├── .env.example             # Mal for miljøvariabler
├── .gitignore               # Git ignore regler
├── package.json             # Dependencies
├── vite.config.ts           # Vite konfigurasjon
├── tailwind.config.ts       # Tailwind CSS konfig
└── tsconfig.json            # TypeScript konfig
```

## 🔧 Viktige filer

### DO NOT EDIT (auto-generert)

- `src/integrations/supabase/client.ts` - Genereres av Lovable Cloud
- `src/integrations/supabase/types.ts` - Genereres fra database schema
- `.env` - Skal ikke committes

### Safe to edit

- Alt annet i `src/` mappen
- `supabase/functions/` - Edge functions (deployes automatisk)
- Styling filer (`index.css`, `tailwind.config.ts`)

## 🧪 Testing

```bash
# Lint kode
npm run lint

# Type check
npx tsc --noEmit

# Build test (sjekk at produksjonsbygg fungerer)
npm run build
npm run preview
```

## 🐛 Debugging

### Console logs

Åpne DevTools (F12) og se Console-fanen for feilmeldinger.

### Network requests

1. Åpne DevTools → Network tab
2. Se etter feilede requests til:
   - Jellyfin server (direkte streaming)
   - Lovable Cloud edge functions (proxy, auth, etc.)

### Common issues

**Port 5173 allerede i bruk:**
```bash
# Finn prosess på port 5173
lsof -i :5173

# Drep prosessen
kill -9 <PID>
```

**Supabase connection error:**
- Sjekk at `.env` har riktige verdier
- Restart dev server: Ctrl+C og kjør `npm run dev` igjen

**Jellyfin ikke tilgjengelig:**
- Verifiser at Jellyfin server kjører
- Sjekk at URL i Admin → Servere er riktig
- Test direkte i nettleser: `http://[jellyfin-url]:8096`

## 🔐 Sikkerhet under utvikling

1. **Aldri commit `.env`** - Den inneholder sensitive nøkler
2. **Bruk HTTPS for Jellyfin** hvis mulig (unngå MitM-angrep)
3. **Ikke hardkode API-nøkler** i koden
4. **Test RLS policies** - Sjekk at brukere bare ser sine egne data

## 🚀 Neste steg

- For produksjon hosting: Se [DEPLOYMENT.md](DEPLOYMENT.md)
- For Git cleanup: Se [GIT_CLEANUP.md](GIT_CLEANUP.md)
- For sikkerhet: Se [SECURITY.md](SECURITY.md)
- For bidrag: Se [CONTRIBUTING.md](CONTRIBUTING.md) (hvis den finnes)

## 📚 Ressurser

- [React dokumentasjon](https://react.dev/)
- [Vite dokumentasjon](https://vitejs.dev/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui komponenter](https://ui.shadcn.com/)
- [Lovable Cloud docs](https://docs.lovable.dev/)
- [Jellyfin API docs](https://api.jellyfin.org/)

---

**Spørsmål?** Opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues)
