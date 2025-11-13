# 🔴 KRITISK SIKKERHETSFIX - GJØR DETTE NÅ!

## ⚠️ Problem: .env-fil committet til Git

Din `.env` fil er committet til git repository og **må fjernes umiddelbart**. Dette er et kritisk sikkerhetsproblem.

### Hvorfor er dette farlig?

- ❌ Supabase nøkler er eksponert i git-historikken
- ❌ Alle som kloner repoet får tilgang til nøklene
- ❌ GitHub scanner etter secrets og kan flagge repoet
- ❌ Potensielt uautorisert database-tilgang
- ❌ Selv etter sletting er filen i git-historikken

---

## 🛠️ Løsning: Fjern og Scrub Git-historikken

### Metode 1: BFG Repo-Cleaner (Anbefalt - Raskest)

```bash
# ============================================
# STEG 1: Installer BFG
# ============================================

# macOS (med Homebrew):
brew install bfg

# Linux (manuell download):
cd ~
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar
alias bfg='java -jar ~/bfg-1.14.0.jar'

# Windows (med Scoop):
scoop install bfg

# ============================================
# STEG 2: Forbered Git Repo
# ============================================

# Naviger til repo root
cd /path/to/jelly-stream-viewer

# Lag en backup først (viktig!)
cd ..
cp -r jelly-stream-viewer jelly-stream-viewer-backup
cd jelly-stream-viewer

# Fjern .env fra working directory (hvis den fortsatt er der)
rm .env

# Commit endringen
git add .
git commit -m "🔒 Remove .env file"

# ============================================
# STEG 3: Scrub Git-historikken
# ============================================

# Kjør BFG for å slette .env fra ALL historikk
bfg --delete-files .env

# Alternativt: Hvis du har flere .env-filer
bfg --delete-files '.env*'

# ============================================
# STEG 4: Rydd opp Git-objekter
# ============================================

# Expire reflog umiddelbart
git reflog expire --expire=now --all

# Kjør garbage collection
git gc --prune=now --aggressive

# ============================================
# STEG 5: Verifiser at .env er borte
# ============================================

# Søk etter .env i hele historikken
git log --all --full-history --source --oneline -- .env
# (Skal være tomt hvis vellykket)

# Søk etter innhold fra .env
git log -S "VITE_SUPABASE" --all
# (Skal ikke vise noe)

# ============================================
# STEG 6: Force Push til Remote
# ============================================

# ADVARSEL: Dette omskriver historikken!
# Varsle alle team-medlemmer først!

git push origin --force --all
git push origin --force --tags

# ============================================
# FERDIG!
# ============================================
```

---

### Metode 2: git-filter-repo (Alternativ)

```bash
# ============================================
# STEG 1: Installer git-filter-repo
# ============================================

# macOS:
brew install git-filter-repo

# Linux (Ubuntu/Debian):
sudo apt install git-filter-repo

# Pip (alle plattformer):
pip3 install git-filter-repo

# ============================================
# STEG 2: Kjør Filter
# ============================================

cd /path/to/jelly-stream-viewer

# Lag backup først
cd ..
cp -r jelly-stream-viewer jelly-stream-viewer-backup
cd jelly-stream-viewer

# Fjern .env fra hele historikken
git filter-repo --path .env --invert-paths --force

# ============================================
# STEG 3: Re-add Remote og Push
# ============================================

# Legg til remote igjen (git-filter-repo fjerner den)
git remote add origin https://github.com/yourusername/jelly-stream-viewer.git

# Force push
git push origin --force --all
git push origin --force --tags
```

---

## 🔑 Roter Supabase-nøkler

**KRITISK**: Etter at .env er fjernet fra git, **MÅ** du rotere alle nøkler.

### I Lovable Cloud Dashboard:

1. Gå til Cloud → Project Settings
2. Klikk på "Regenerate Keys"
3. Kopiér de nye nøklene

### Oppdater Lokal .env:

```bash
# Opprett ny .env fil (IKKE commit denne!)
cat > .env << 'EOF'
VITE_SUPABASE_URL=https://[NY-PROJECT-ID].supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=[NY-ANON-KEY]
VITE_SUPABASE_PROJECT_ID=[NY-PROJECT-ID]
EOF
```

### Oppdater GitHub Secrets:

```bash
# Gå til GitHub repo → Settings → Secrets and variables → Actions
# Oppdater:
# - VITE_SUPABASE_URL
# - VITE_SUPABASE_PUBLISHABLE_KEY
# - VITE_SUPABASE_PROJECT_ID
```

---

## ✅ Verifiser at Alt er Trygt

```bash
# ============================================
# Test 1: Sjekk at .env ikke er i repo
# ============================================
git ls-files | grep .env
# (Skal være tomt)

# ============================================
# Test 2: Sjekk at .env ikke er i historikken
# ============================================
git log --all --full-history -- .env
# (Skal være tomt)

# ============================================
# Test 3: Søk etter Supabase nøkler i historikk
# ============================================
git log --all -S "VITE_SUPABASE_URL" -p
# (Skal ikke vise noe etter cleanup)

# ============================================
# Test 4: Verifiser at .gitignore fungerer
# ============================================
echo "test" > .env
git status
# (Skal IKKE vise .env som untracked file)
rm .env

# ============================================
# Test 5: Sjekk at nye nøkler fungerer
# ============================================
npm run dev
# (Applikasjonen skal starte uten feil)
```

---

## 🔒 Forhindre Fremtidige Lekkasjer

### 1. Pre-commit Hook (Anbefalt)

```bash
# Opprett pre-commit hook
cat > .git/hooks/pre-commit << 'EOF'
#!/bin/bash

# Sjekk om .env er staged
if git diff --cached --name-only | grep -q "^\.env"; then
  echo "❌ FEIL: .env fil kan ikke committes!"
  echo "Fjern .env fra staging area:"
  echo "  git reset HEAD .env"
  exit 1
fi

# Sjekk etter hardkodede secrets
if git diff --cached | grep -E "(SUPABASE_SERVICE_ROLE_KEY|password.*=.*['\"])"; then
  echo "⚠️  ADVARSEL: Mulig hardkodet secret oppdaget!"
  echo "Vennligst sjekk endringene nøye."
  exit 1
fi

exit 0
EOF

chmod +x .git/hooks/pre-commit
```

### 2. GitHub Secret Scanning

Aktivér GitHub secret scanning:

1. Gå til GitHub repo → Settings → Security
2. Aktivér "Secret scanning"
3. Aktivér "Push protection"

### 3. Dependabot Alerts

Allerede konfigurert via `.github/dependabot.yml` ✅

---

## 📋 Sjekkliste (Må gjøres i denne rekkefølgen!)

- [ ] **1. Lag backup av repoet** (`cp -r jelly-stream-viewer jelly-stream-viewer-backup`)
- [ ] **2. Varsle team-medlemmer** om force push
- [ ] **3. Installer BFG eller git-filter-repo**
- [ ] **4. Kjør cleanup script** (BFG eller git-filter-repo)
- [ ] **5. Verifiser at .env er borte** (`git log --all -- .env`)
- [ ] **6. Force push til GitHub** (`git push --force --all`)
- [ ] **7. Roter Supabase nøkler** i Lovable Cloud dashboard
- [ ] **8. Oppdater lokal .env** med nye nøkler
- [ ] **9. Oppdater GitHub Secrets** med nye nøkler
- [ ] **10. Test at applikasjonen fungerer** (`npm run dev`)
- [ ] **11. Installer pre-commit hook** (se over)
- [ ] **12. Aktiver GitHub secret scanning** (hvis public repo)
- [ ] **13. Slett backup** når alt fungerer

---

## 🆘 Hvis Noe Går Galt

### Restore fra Backup:

```bash
cd ..
rm -rf jelly-stream-viewer
cp -r jelly-stream-viewer-backup jelly-stream-viewer
cd jelly-stream-viewer
```

### Force Pull fra GitHub:

```bash
git fetch origin
git reset --hard origin/main
```

### Kontakt Support:

- GitHub Support (hvis public repo og bekymret for exposure)
- Lovable Support (for hjelp med nøkkelrotering)

---

## 📞 Hjelp

Hvis du trenger hjelp:

1. **Ikke panikkk** - dette er fiksbart
2. **Ta backup først** - alltid!
3. **Les instruksjonene nøye** - hvert steg er viktig
4. **Verifiser etter hver steg** - bruk test-kommandoene
5. **Spør om hjelp** hvis usikker - bedre trygt enn lei seg

---

## ✅ Når du er ferdig

Kommenter i issue/PR:

```
✅ .env fjernet fra git-historikken
✅ Supabase nøkler rotert
✅ GitHub Secrets oppdatert
✅ Pre-commit hook installert
✅ Verifisert at applikasjonen fungerer

Klar for neste review!
```

---

**VIKTIG**: Ikke fortsett med andre oppgaver før denne fiksen er gjennomført!

Dette er en **kritisk sikkerhetssårbarhet** som må fikses umiddelbart.
