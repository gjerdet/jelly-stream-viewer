# Release Process

Denne guiden beskriver prosessen for å lage nye releases av Jelly Stream Viewer.

## 📋 Release-strategi

Vi følger [Semantic Versioning](https://semver.org/):
- **MAJOR** (v2.0.0) - Breaking changes
- **MINOR** (v1.1.0) - Nye features, backwards-compatible
- **PATCH** (v1.0.1) - Bugfixes, backwards-compatible

## 🚀 Release-prosess

### 1. Forbered release

```bash
# Sørg for at du er på main branch og oppdatert
git checkout main
git pull origin main

# Sjekk at alle tester passerer
npm run test
npm run test:e2e
npm run lint

# Kjør build for å verifisere
npm run build
```

### 2. Oppdater versjonsnummer

Versjonsnummeret må oppdateres i to steder:

#### a) package.json
```json
{
  "version": "1.1.0"
}
```

#### b) Database (app_versions tabell)
Legg til en ny rad i `app_versions` tabellen via Supabase dashboard:

```sql
INSERT INTO app_versions (version_number, description, changelog, is_current, release_date)
VALUES (
  '1.1.0',
  'Kort beskrivelse av denne versjonen',
  '## Nye funksjoner
- Feature 1
- Feature 2

## Bugfixes
- Fix 1
- Fix 2',
  true,
  NOW()
);

-- Sett forrige versjon til ikke-current
UPDATE app_versions 
SET is_current = false 
WHERE version_number != '1.1.0';
```

### 3. Opprett changelog

Oppdater `CHANGELOG.md` med endringene i denne versjonen:

```markdown
## [1.1.0] - 2024-01-15

### Nye funksjoner
- Lagt til funksjon X
- Forbedret funksjon Y

### Bugfixes
- Fikset problem med Z

### Forbedringer
- Forbedret ytelse
```

### 4. Commit og push

```bash
git add package.json CHANGELOG.md
git commit -m "chore: bump version to v1.1.0"
git push origin main
```

### 5. Opprett Git tag

```bash
# Opprett annotated tag
git tag -a v1.1.0 -m "Release v1.1.0"

# Push tag til GitHub
git push origin v1.1.0
```

### 6. Automatisk GitHub Release

Når du pusher en tag, vil GitHub Actions automatisk:
1. Generere changelog basert på commits
2. Opprette en GitHub Release
3. Legge ved release notes

Se `.github/workflows/release.yml` for detaljer.

### 7. Verifiser release

1. Gå til https://github.com/gjerdet/jelly-stream-viewer/releases
2. Sjekk at den nye releasen er publisert
3. Verifiser at release notes ser korrekte ut
4. Test at download-lenker fungerer

## 📝 Release Checklist

Før du lager en release:

- [ ] Alle tester passerer (unit + E2E)
- [ ] Linting passerer uten feil
- [ ] Dokumentasjon er oppdatert
- [ ] CHANGELOG.md er oppdatert
- [ ] package.json version er oppdatert
- [ ] app_versions database-tabell er oppdatert
- [ ] Breaking changes er dokumentert (hvis MAJOR release)
- [ ] Security-issues er addressert
- [ ] Build produserer ingen warnings

## 🐛 Hotfix-prosess

For kritiske bugfixes som må ut raskt:

```bash
# Opprett hotfix branch fra main
git checkout -b hotfix/v1.0.1 main

# Fiks buggen
# ... gjør endringer ...

# Test grundig
npm run test
npm run test:e2e

# Commit
git commit -m "fix: critical bug in X"

# Merge til main
git checkout main
git merge hotfix/v1.0.1

# Opprett tag
git tag -a v1.0.1 -m "Hotfix v1.0.1 - Fix critical bug"
git push origin main --tags

# Rydd opp
git branch -d hotfix/v1.0.1
```

## 🔒 Pre-release

For testing av nye features før offisiell release:

```bash
# Opprett pre-release tag
git tag -a v1.1.0-beta.1 -m "Beta release v1.1.0-beta.1"
git push origin v1.1.0-beta.1
```

GitHub Actions vil markere dette som pre-release automatisk.

## 📊 Release metrics

Etter hver release, overvåk:
- Download-statistikk
- Error tracking (hvis implementert)
- User feedback på GitHub Issues
- Breaking change impact

## 🔄 Rollback

Hvis en release må rulles tilbake:

```bash
# Reverter til forrige versjon
git revert <commit-hash>
git push origin main

# Eller opprett ny patch-versjon
git checkout <previous-version-tag>
git checkout -b hotfix/rollback
# ... fiks problemet ...
git tag -a v1.1.1 -m "Rollback and fix"
git push origin v1.1.1
```

## 📞 Hjelp

Ved spørsmål om release-prosessen:
- Se eksisterende releases for referanse
- Kontakt maintainers på GitHub
- Opprett en discussion på GitHub
