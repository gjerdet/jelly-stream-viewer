# Versjonshåndtering og Mappestruktur

## Oversikt
Jelly Stream Viewer bruker en manuell versjonshåndtering som krever bekreftelse før oppgradering.

## Mappestruktur på GitHub

```
jelly-stream-viewer/
├── src/                          # Kildekode
│   ├── components/               # React-komponenter
│   │   ├── ui/                   # shadcn UI-komponenter
│   │   ├── VersionManager.tsx    # Versjonshåndteringskomponent
│   │   └── ...
│   ├── pages/                    # Side-komponenter
│   ├── hooks/                    # Custom React hooks
│   │   ├── useVersions.tsx       # Versjonshåndtering hook
│   │   └── ...
│   └── integrations/             # Eksterne integrasjoner
│       └── supabase/             # Supabase-klient (auto-generert)
│
├── supabase/                     # Backend-konfigurering
│   ├── functions/                # Edge Functions
│   │   ├── jellyfin-proxy/       # Jellyfin API-proxy
│   │   ├── jellyfin-authenticate/
│   │   └── ...
│   ├── migrations/               # Database-migrasjoner (auto-generert)
│   └── config.toml               # Supabase-konfig
│
├── public/                       # Statiske filer
├── docs/                         # Dokumentasjon
│   └── VERSIONING.md             # Denne filen
│
├── README.md                     # Prosjektdokumentasjon
├── package.json                  # NPM-avhengigheter
└── vite.config.ts                # Vite-konfigurasjon
```

## Hvordan Versjonssystemet Fungerer

### 1. Database-tabell
Versjoner lagres i `app_versions`-tabellen i databasen:
- `version_number`: Versjonsnummer (f.eks. "1.0.0", "1.2.0")
- `release_date`: Når versjonen ble utgitt
- `description`: Kort beskrivelse
- `changelog`: Detaljert endringslogg
- `is_current`: Om denne versjonen er aktiv

### 2. Admin-grensesnitt
I Admin-panelet under "Versjoner"-fanen kan du:
- Se gjeldende aktiv versjon
- Legge til nye versjoner
- Bytte mellom versjoner (krever bekreftelse)
- Se endringslogger

### 3. Versjonering av Kode

#### Git-tagging
Hver versjon bør tagges i Git:
```bash
# Etter å ha committed alle endringer for v1.2.0:
git tag -a v1.2.0 -m "Version 1.2.0: Nye funksjoner og forbedringer"
git push origin v1.2.0
```

#### Mappestruktur for Versjoner
Hold koden organisert per funksjon:
- En funksjon per mappe i `src/components/`
- Edge functions i egne mapper under `supabase/functions/`
- Database-endringer i migrations (auto-generert ved bruk av migrations-verktøyet)

## Oppgraderingsprosess

### Steg 1: Utvikle Nye Funksjoner
1. Arbeid på nye funksjoner i Lovable
2. Test grundig i preview-miljøet
3. Commit og push til GitHub

### Steg 2: Opprett Ny Versjon i Admin
1. Gå til Admin → Versjoner
2. Klikk "Ny versjon"
3. Fyll inn:
   - Versjonsnummer (f.eks. "1.2.0")
   - Beskrivelse
   - Endringslogg
4. Lagre

### Steg 3: Tag i Git
```bash
git tag -a v1.2.0 -m "Version 1.2.0"
git push origin v1.2.0
```

### Steg 4: Aktiver Ny Versjon
1. I Admin → Versjoner
2. Finn den nye versjonen
3. Klikk "Aktiver"
4. Bekreft endringen
5. Last siden på nytt

## Rollback

### Rask Rollback via Admin
1. Gå til Admin → Versjoner
2. Velg forrige stabile versjon
3. Klikk "Aktiver" og bekreft
4. Last siden på nytt

### Git Rollback (for større problemer)
```bash
# Se tilgjengelige tags
git tag -l

# Checkout til forrige versjon
git checkout v1.0.0

# Hvis du vil gjøre det permanent:
git reset --hard v1.0.0
git push -f origin main
```

## Best Practices

### Versjonsnummerering
Følg Semantic Versioning (SemVer):
- **MAJOR.MINOR.PATCH** (f.eks. 1.2.3)
- **MAJOR**: Brudd på bakoverkompatibilitet
- **MINOR**: Nye funksjoner, bakoverkompatibel
- **PATCH**: Bugfikser, bakoverkompatibel

### Changelog
Inkluder alltid i endringsloggen:
- ✨ Nye funksjoner
- 🐛 Bugfikser
- ⚡ Forbedringer
- 🔒 Sikkerhetsfikser
- 📝 Dokumentasjon

Eksempel:
```
✨ Nye funksjoner:
- Lagt til versjonshåndtering i Admin-panel
- Nye knapper i header (Sync, Refresh, Status, Settings)

⚡ Forbedringer:
- Forbedret Jellyfin-autentisering
- Bedre feilhåndtering

🐛 Bugfikser:
- Fikset problem med søkefunksjon
```

### Testing
Før du aktiverer en ny versjon:
1. Test alle nye funksjoner
2. Sjekk at gamle funksjoner fortsatt virker
3. Test i ulike nettlesere
4. Verifiser at database-endringer er korrekte

### Backup
Før større oppgraderinger:
1. Tag gjeldende stabil versjon i Git
2. Ta backup av databasen (via Lovable Cloud backend-panel)
3. Dokumenter alle manuelle konfigurasjoner

## Deployment

### Automatisk Deployment (Lovable)
- Alle endringer synkes automatisk til GitHub
- Preview-miljøet oppdateres automatisk
- Produksjon oppdateres når du publiserer

### Manuell Deployment (Self-hosted)
Hvis du kjører self-hosted:
```bash
# 1. Pull nyeste kode
git pull origin main

# 2. Installer avhengigheter
npm install

# 3. Bygg produksjon
npm run build

# 4. Deploy build-mappen
# (avhenger av din hosting-løsning)
```

## Feilsøking

### Versjon endret, men intet skjer
- Tøm nettleser-cache (Ctrl+Shift+R)
- Sjekk at `is_current` er satt korrekt i databasen
- Verifiser at koden faktisk er deployet til produksjon

### Kan ikke bytte versjon
- Sjekk at du er logget inn som admin
- Verifiser at RLS-policies er korrekte
- Se etter feilmeldinger i nettleser-konsollen

### Database-feil etter oppdatering
- Sjekk at alle migrations er kjørt
- Verifiser at tabeller har korrekte kolonner
- Se på database-logs i backend-panelet

## Support

For spørsmål eller problemer:
1. Sjekk denne dokumentasjonen
2. Se i GitHub Issues
3. Kontakt prosjektadministrator
