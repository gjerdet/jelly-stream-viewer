# GitHub Repository Setup

Denne guiden hjelper deg med å sette opp GitHub-repositoryet korrekt.

## 📝 Repository-beskrivelse

Legg til følgende beskrivelse i GitHub:

```
En moderne, fullstack media streaming-løsning for Jellyfin med autentisering, brukerroller og innholdsforespørsler. Bygget med React, TypeScript, Tailwind CSS og Lovable Cloud.
```

## 🏷️ Topics

Legg til følgende topics i GitHub repository settings:

```
jellyfin
jellyseerr
react
typescript
vite
tailwindcss
supabase
media-server
streaming
self-hosted
fullstack
pwa
shadcn-ui
tanstack-query
```

## 🖼️ Screenshots

For å legge til screenshots:

1. Ta screenshots av følgende views:
   - Hjemmeside/Hero-view
   - Mediebibliotek/Browse-view
   - Videospiller
   - Admin panel

2. Optimaliser bildene (anbefalt størrelse: 1280x720px)

3. Last opp til `docs/screenshots/` mappen:
   ```bash
   mkdir -p docs/screenshots
   # Kopier screenshots hit
   ```

4. Oppdater README.md:
   ```markdown
   ## 📸 Screenshots
   
   <p align="center">
     <img src="docs/screenshots/home.png" alt="Hjemmeside" width="45%">
     <img src="docs/screenshots/browse.png" alt="Bla gjennom" width="45%">
   </p>
   <p align="center">
     <img src="docs/screenshots/player.png" alt="Videospiller" width="45%">
     <img src="docs/screenshots/admin.png" alt="Admin panel" width="45%">
   </p>
   ```

## 🔖 GitHub Features

### About Section
I repository settings → About:
- ✅ Description (fra over)
- ✅ Website: Din deployment URL
- ✅ Topics (fra over)
- ✅ Releases
- ✅ Packages (hvis relevant)

### Social Preview
Opprett et social preview-bilde (1280x640px) med:
- Logo eller app-navn
- Kort beskrivelse
- Visuelt tiltalende design

Last opp under Settings → Social Preview.

### Repository Features

Aktiver følgende i Settings → Features:
- ✅ Wikis (valgfritt)
- ✅ Issues
- ✅ Sponsorships (valgfritt)
- ✅ Projects
- ✅ Discussions (anbefalt for community)

### Branch Protection

Sett opp branch protection for `main`:

Settings → Branches → Add rule:
- Branch name pattern: `main`
- ✅ Require a pull request before merging
- ✅ Require status checks to pass before merging
  - CI tests
  - TypeScript build
- ✅ Require branches to be up to date before merging
- ✅ Include administrators (anbefalt)

### GitHub Actions Secrets

Legg til følgende secrets i Settings → Secrets and variables → Actions:

```
VITE_SUPABASE_URL
VITE_SUPABASE_PUBLISHABLE_KEY
VITE_SUPABASE_PROJECT_ID
```

Disse er nødvendige for at CI/CD skal fungere.

## 📊 Insights og Analytics

### Enable Insights
Gå til Insights-fanen for å se:
- Pulse (aktivitet siste uken)
- Contributors
- Community standards
- Traffic (krever visse rettigheter)

### Community Health Files

Sjekk at følgende filer eksisterer (✅ = allerede på plass):
- ✅ README.md
- ✅ LICENSE
- ✅ CONTRIBUTING.md
- ✅ CODE_OF_CONDUCT.md (opprett hvis relevant)
- ✅ SECURITY.md
- ✅ .github/ISSUE_TEMPLATE/
- ✅ .github/PULL_REQUEST_TEMPLATE.md

## 🎨 GitHub Badges

Legg til badges i README.md:

```markdown
[![CI](https://github.com/gjerdet/jelly-stream-viewer/actions/workflows/ci.yml/badge.svg)](https://github.com/gjerdet/jelly-stream-viewer/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18.3-blue)](https://react.dev/)
[![GitHub release](https://img.shields.io/github/release/gjerdet/jelly-stream-viewer.svg)](https://github.com/gjerdet/jelly-stream-viewer/releases/)
[![GitHub stars](https://img.shields.io/github/stars/gjerdet/jelly-stream-viewer.svg)](https://github.com/gjerdet/jelly-stream-viewer/stargazers)
```

## 🔗 Links og Integrationer

### Useful Links
Legg til i repository description eller README:
- 📚 [Documentation](https://github.com/gjerdet/jelly-stream-viewer/wiki)
- 🐛 [Report Bug](https://github.com/gjerdet/jelly-stream-viewer/issues/new?template=bug_report.md)
- ✨ [Request Feature](https://github.com/gjerdet/jelly-stream-viewer/issues/new?template=feature_request.md)
- 💬 [Discussions](https://github.com/gjerdet/jelly-stream-viewer/discussions)

## ✅ Sjekkliste

- [ ] Repository description satt
- [ ] Topics lagt til
- [ ] Screenshots tatt og lagt til README
- [ ] Social preview-bilde opprettet
- [ ] Branch protection aktivert
- [ ] GitHub Actions secrets konfigurert
- [ ] Community health files på plass
- [ ] Badges lagt til README
- [ ] Issue templates konfigurert
- [ ] PR template konfigurert
- [ ] First release publisert

## 📞 Hjelp

For mer informasjon om GitHub features:
- [GitHub Docs](https://docs.github.com/)
- [About repository topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)
- [Branch protection rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
