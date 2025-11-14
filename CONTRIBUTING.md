# Bidragsguide

Takk for at du vurderer å bidra til Jelly Stream Viewer! 🎉

## 🚀 Kom i gang

1. **Fork repository**
   ```bash
   # Klikk "Fork" på GitHub
   # Klon din fork
   git clone https://github.com/[ditt-brukernavn]/jelly-stream-viewer.git
   cd jelly-stream-viewer
   ```

2. **Installer dependencies**
   ```bash
   npm install
   ```

3. **Sett opp miljøvariabler**
   ```bash
   cp .env.example .env
   # Fyll inn dine Lovable Cloud verdier
   ```

4. **Installer pre-commit hook** (anbefalt)
   ```bash
   cp .githooks/pre-commit .git/hooks/pre-commit
   chmod +x .git/hooks/pre-commit
   ```

## 🌿 Branching strategi

Vi bruker en forenklet Git-flow:

- **`main`** - Produksjonsklar kode
- **`develop`** - Utviklingsbranch (merge hit først)
- **`feature/*`** - Feature branches
- **`fix/*`** - Bugfix branches

### Eksempel workflow

```bash
# Opprett feature branch fra develop
git checkout develop
git pull origin develop
git checkout -b feature/min-nye-feature

# Gjør endringer
git add .
git commit -m "feat: legg til ny feature"

# Push til din fork
git push origin feature/min-nye-feature

# Opprett Pull Request på GitHub: feature/min-nye-feature → develop
```

## 📝 Commit-meldinger

Vi følger [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: Ny feature
- **fix**: Bugfix
- **docs**: Dokumentasjonsendringer
- **style**: Kodeformatering (ikke CSS)
- **refactor**: Kode refactoring
- **test**: Test-relatert
- **chore**: Build-prosess, dependencies, etc.

### Eksempler

```bash
feat(player): legg til støtte for undertekstvalg

fix(auth): rett opp logout-bug som slettet session

docs(readme): oppdater installasjonsinstruksjoner

refactor(api): forenkle Jellyfin API-kall
```

## 🧪 Testing

Før du sender Pull Request:

```bash
# Lint kode
npm run lint

# Type check
npx tsc --noEmit

# Test produksjonsbygg
npm run build
npm run preview

# Manuell testing i nettleser
npm run dev
```

## 📋 Pull Request prosess

1. **Opprett PR** mot `develop` branch (ikke `main`)
2. **Beskriv endringen**:
   - Hva endres?
   - Hvorfor?
   - Screenshots/video hvis relevant
3. **Sjekk at CI passerer**:
   - Linting
   - Type checking
   - Build test
   - Security audit
4. **Vente på review**
5. **Adresser eventuelle kommentarer**
6. **Merge** (utføres av maintainers)

### PR mal

```markdown
## Beskrivelse
[Beskriv endringen]

## Type endring
- [ ] Bugfix
- [ ] Ny feature
- [ ] Breaking change
- [ ] Dokumentasjon

## Testing
- [ ] Lokal testing utført
- [ ] Produksjonsbygg testet
- [ ] Manuell testing på mobil/desktop

## Screenshots
[Hvis relevant]

## Checklist
- [ ] Kode følger prosjektets stil
- [ ] Pre-commit hook passerer
- [ ] Dokumentasjon oppdatert
- [ ] Ingen hardkodede secrets
```

## 🎨 Kode-stil

### TypeScript

- Bruk **TypeScript** for alle nye filer
- Unngå `any` - bruk spesifikke typer
- Eksporter typer/interfaces separat

```typescript
// ✅ Bra
interface MediaItem {
  id: string;
  title: string;
}

export function getMedia(id: string): MediaItem {
  // ...
}

// ❌ Unngå
function getMedia(id: any): any {
  // ...
}
```

### React

- Bruk **functional components** med hooks
- Bruk **TypeScript** for props
- Unngå inline styles - bruk Tailwind

```tsx
// ✅ Bra
interface ButtonProps {
  label: string;
  onClick: () => void;
}

export function Button({ label, onClick }: ButtonProps) {
  return (
    <button className="btn-primary" onClick={onClick}>
      {label}
    </button>
  );
}

// ❌ Unngå
export function Button(props) {
  return (
    <button style={{ color: 'blue' }} onClick={props.onClick}>
      {props.label}
    </button>
  );
}
```

### Tailwind CSS

- Bruk **semantic tokens** fra `index.css`
- Ikke hardkod farger

```tsx
// ✅ Bra
<div className="bg-background text-foreground">

// ❌ Unngå
<div className="bg-white text-black">
```

## 🏗️ Prosjektstruktur

Når du legger til ny funksjonalitet:

```
src/
├── components/
│   ├── ui/              # Ikke endre (shadcn/ui)
│   └── [DinKomponent]/  # Nye komponenter her
│
├── pages/
│   └── [DinSide].tsx    # Nye sider her
│
├── hooks/
│   └── use[DinHook].tsx # Custom hooks her
│
└── lib/
    └── [dinUtil].ts     # Utility funksjoner her
```

## 🔒 Sikkerhet

**ALDRI commit sensitive data:**

- ❌ `.env` filer
- ❌ API-nøkler
- ❌ Passord
- ❌ Private tokens

Pre-commit hooken vil fange de fleste tilfeller, men vær obs!

## 📚 Dokumentasjon

Når du legger til ny funksjonalitet:

1. **JSDoc** for funksjoner/komponenter
2. **README.md** hvis det påvirker brukeropplevelsen
3. **ARCHITECTURE.md** hvis det endrer arkitekturen

```typescript
/**
 * Henter media fra Jellyfin server
 * @param id - Media ID
 * @returns Media item med metadata
 * @throws Error hvis media ikke finnes
 */
export async function getMediaById(id: string): Promise<MediaItem> {
  // ...
}
```

## 🐛 Rapporter bugs

Opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues/new) med:

- **Beskrivelse** av problemet
- **Steg for å reprodusere**
- **Forventet oppførsel**
- **Faktisk oppførsel**
- **Screenshots** (hvis relevant)
- **Miljø**: OS, nettleser, versjon

## 💡 Feature requests

Opprett en [GitHub Issue](https://github.com/gjerdet/jelly-stream-viewer/issues/new) med:

- **Beskrivelse** av featuren
- **Brukstilfelle** (hvorfor er det nyttig?)
- **Foreslått løsning** (valgfritt)
- **Alternativer** du har vurdert

## 🙏 Takk!

Vi setter stor pris på alle bidrag - store som små! 🎉

---

**Spørsmål?** Opprett en GitHub Issue eller kontakt maintainers.
