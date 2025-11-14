# Fjern .env fra Git

**KRITISK**: `.env` filen ligger i Git-historikken og må fjernes umiddelbart.

## 🚨 Hvorfor dette er viktig

`.env` inneholder sensitive API-nøkler som kan brukes til å få uautorisert tilgang til backend. Disse nøklene må roteres og filen må fjernes fra Git-historikken.

## 📋 Steg 1: Fjern .env fra tracking

```bash
# Fjern .env fra Git tracking (beholder lokalt)
git rm --cached .env

# Commit endringen
git commit -m "Remove .env from version control"

# Push til GitHub
git push origin main
```

## 🧹 Steg 2: Fjern fra Git-historikk

### Metode A: BFG Repo-Cleaner (anbefalt)

```bash
# Installer BFG
# macOS:
brew install bfg

# Ubuntu/Debian:
sudo apt install bfg

# Backup først!
cd ..
git clone --mirror https://github.com/gjerdet/jelly-stream-viewer.git backup-jelly-stream-viewer

# Kjør BFG
cd jelly-stream-viewer
bfg --delete-files .env

# Rydd opp
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (ADVARSEL: Dette omskriver historikk!)
git push origin --force --all
```

### Metode B: git-filter-repo

```bash
# Installer git-filter-repo
pip3 install git-filter-repo

# Backup først!
cd ..
git clone https://github.com/gjerdet/jelly-stream-viewer.git backup-jelly-stream-viewer

# Kjør filter
cd jelly-stream-viewer
git filter-repo --invert-paths --path .env

# Force push
git push origin --force --all
```

## 🔑 Steg 3: Roter API-nøkler

**VIKTIG**: Nøklene i den gamle `.env` er kompromittert og må roteres:

1. Gå til Lovable Cloud Dashboard
2. Naviger til Project Settings → API
3. Regenerer alle nøkler:
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_SUPABASE_URL` (sjekk om ny URL)
   - `VITE_SUPABASE_PROJECT_ID`

4. Oppdater lokal `.env` med nye verdier
5. Oppdater GitHub Secrets hvis du bruker CI/CD:
   - Gå til Repository Settings → Secrets → Actions
   - Oppdater alle `VITE_SUPABASE_*` secrets

## ✅ Steg 4: Verifiser

```bash
# Sjekk at .env ikke finnes i historikk
git log --all --full-history --oneline -- .env

# Sjekk at .env ikke er tracked
git ls-files | grep .env

# Verifiser at .gitignore inneholder .env
cat .gitignore | grep "\.env"
```

## 🛡️ Steg 5: Sikre fremtidig beskyttelse

### Legg til pre-commit hook

```bash
# Opprett hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash
if git diff --cached --name-only | grep -q "^\.env$"; then
  echo "❌ ERROR: Forsøkte å committe .env fil!"
  echo "Denne filen inneholder sensitive data og skal ikke være i Git."
  exit 1
fi
EOF

# Gjør den kjørbar
chmod +x .git/hooks/pre-commit
```

### GitHub Secret Scanning

1. Gå til Repository Settings → Code security and analysis
2. Aktiver:
   - **Secret scanning**
   - **Push protection**

## 📝 Sjekkliste

- [ ] `.env` fjernet fra Git tracking (`git rm --cached .env`)
- [ ] `.env` fjernet fra Git-historikk (BFG eller git-filter-repo)
- [ ] API-nøkler rotert i Lovable Cloud Dashboard
- [ ] Lokal `.env` oppdatert med nye nøkler
- [ ] GitHub Secrets oppdatert
- [ ] Pre-commit hook installert
- [ ] GitHub Secret Scanning aktivert
- [ ] Verifisert at appen fortsatt fungerer

## ⚠️ Hvis noe går galt

```bash
# Gjenopprett fra backup
cd ..
rm -rf jelly-stream-viewer
git clone backup-jelly-stream-viewer jelly-stream-viewer
cd jelly-stream-viewer
```

## 🆘 Hjelp

Hvis du trenger hjelp:
1. Sjekk [CRITICAL_SECURITY_FIX.md](CRITICAL_SECURITY_FIX.md)
2. Opprett en GitHub Issue
3. Kontakt Lovable Support

---

**Status**: ⚠️ Ikke fullført før alle steg over er gjennomført!
