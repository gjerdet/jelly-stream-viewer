# Sikkerhet Oppsett & Kritiske Fikser

Dette dokumentet beskriver kritiske sikkerhetstiltak som **MÅ** implementeres før produksjon.

## 🔴 KRITISK: Fjern .env fra Git Repository

.env-filen inneholder sensitive nøkler og skal **ALDRI** committes til git.

### Hvorfor er dette farlig?
- Exposes Supabase project ID and anon key
- Kan gi uautorisert tilgang til databasen
- Git-historikk bevarer filen selv etter sletting
- Offentlige repos eksponerer nøkler til hele verden

### Løsning (KJØR DISSE KOMMANDOENE NÅ):

```bash
# 1. Fjern .env fra git tracking
git rm --cached .env

# 2. Bekreft at .env er i .gitignore (den SKAL være der)
echo ".env" >> .gitignore

# 3. Commit endringen
git add .gitignore
git commit -m "🔒 Remove .env from repository"

# 4. Push til GitHub
git push origin main

# 5. Roter nøkler i Lovable Cloud
# Gå til Lovable Cloud dashboard og regenerer:
# - VITE_SUPABASE_PUBLISHABLE_KEY
# - Update local .env with new keys
```

### Fjern fra Git-historikk (Valgfritt men anbefalt):

```bash
# Installer BFG Repo-Cleaner
# macOS:
brew install bfg

# Linux:
wget https://repo1.maven.org/maven2/com/madgag/bfg/1.14.0/bfg-1.14.0.jar

# Kjør BFG for å fjerne .env fra all historikk
bfg --delete-files .env

# Rydd opp
git reflog expire --expire=now --all
git gc --prune=now --aggressive

# Force push (ADVARSEL: Dette omskriver historikk!)
git push --force
```

**VIKTIG**: Varsle alle team-medlemmer før force push!

---

## 🟡 VIKTIG: Webhook Sikkerhet for Oppdateringer

Webhook-systemet for automatiske oppdateringer trenger sterkere sikkerhet.

### Nåværende Problem:
- X-Update-Secret header kan sniffes
- Ingen rate limiting
- Ingen request signing

### Implementer HMAC Signering:

Oppdater `update-server.js` på serveren:

```javascript
const crypto = require('crypto');
const express = require('express');
const app = express();

const WEBHOOK_SECRET = process.env.UPDATE_WEBHOOK_SECRET;

// Verify HMAC signature
function verifySignature(req, res, next) {
  const signature = req.headers['x-hub-signature-256'];
  
  if (!signature) {
    return res.status(401).json({ error: 'Missing signature' });
  }

  const hmac = crypto.createHmac('sha256', WEBHOOK_SECRET);
  const body = JSON.stringify(req.body);
  const expectedSignature = 'sha256=' + hmac.update(body).digest('hex');

  if (!crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )) {
    return res.status(401).json({ error: 'Invalid signature' });
  }

  next();
}

// Rate limiting
const rateLimit = require('express-rate-limit');
const updateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Max 5 updates per 15 minutes
  message: 'Too many update requests'
});

app.post('/update', updateLimiter, verifySignature, (req, res) => {
  // Your update logic here
  console.log('Update triggered securely');
  res.json({ success: true });
});

app.listen(3000);
```

Oppdater `supabase/functions/trigger-update/index.ts`:

```typescript
// Add HMAC signing
const crypto = await import('crypto');

const secret = secretData?.setting_value || '';
const body = JSON.stringify({
  action: 'update',
  timestamp: new Date().toISOString()
});

const hmac = crypto.createHmac('sha256', secret);
const signature = 'sha256=' + hmac.update(body).digest('hex');

const webhookResponse = await fetch(webhookUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature
  },
  body: body
});
```

---

## 🟢 Anbefalt: Ytterligere Sikkerhetstiltak

### 1. GitHub Actions Secrets

Sett opp secrets i GitHub repository:

```bash
# Gå til GitHub repo → Settings → Secrets and variables → Actions
# Legg til:
- VITE_SUPABASE_URL
- VITE_SUPABASE_PUBLISHABLE_KEY
- VITE_SUPABASE_PROJECT_ID
```

Disse er allerede konfigurert i `.github/workflows/ci.yml`.

### 2. Dependabot

Dependabot er nå konfigurert i `.github/dependabot.yml`. Den vil:
- Sjekke avhengigheter ukentlig
- Åpne PRs for sikkerhetoppdateringer
- Gruppere mindre oppdateringer

**Godkjenn PRs fra Dependabot jevnlig!**

### 3. Security Audit Workflow

`.github/workflows/security.yml` kjører automatisk:
- npm audit for sårbarheter
- Sjekker for .env i repo
- Verifiserer at ingen service keys er i klient-kode

**Sjekk workflow-resultater etter hver commit.**

### 4. CORS Konfigurering

Oppdater CORS til å være mer restriktiv. I edge functions:

```typescript
// ❌ DÅRLIG (wildcard)
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
};

// ✅ BEDRE (spesifikt domene)
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.FRONTEND_URL || 'https://yourdomain.com',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};
```

Legg til `FRONTEND_URL` i Lovable Cloud Secrets.

### 5. Content Security Policy

Legg til CSP headers i din Nginx config (self-hosted) eller Lovable settings:

```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://ypjihlfhxqyrpfjfmjdm.supabase.co https://your-jellyfin-server.com;" always;
```

### 6. RLS Policy Testing

Test alle RLS policies regelmessig:

```sql
-- Test som vanlig bruker
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'test-user-uuid';

-- Prøv å lese andres favoritter (skal feile)
SELECT * FROM user_favorites WHERE user_id != 'test-user-uuid';

-- Prøv å endre server settings (skal feile)
UPDATE server_settings SET setting_value = 'hacked' WHERE setting_key = 'jellyfin_api_key';

ROLLBACK;

-- Test som admin
BEGIN;
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims.sub = 'admin-user-uuid';

-- Skal fungere
SELECT * FROM user_favorites;
UPDATE server_settings SET setting_value = 'test' WHERE setting_key = 'jellyfin_api_key';

ROLLBACK;
```

Kjør disse testene etter hver database-endring!

---

## 📋 Sikkerhet Sjekkliste før Produksjon

Før du kjører applikasjonen i produksjon:

- [ ] .env fjernet fra git og historikk
- [ ] Nye Supabase nøkler generert og distribuert
- [ ] Webhook HMAC signering implementert
- [ ] Rate limiting på webhook endpoint
- [ ] GitHub Actions secrets konfigurert
- [ ] Dependabot aktivert og PRs blir reviewet
- [ ] CORS begrenset til spesifikke domener
- [ ] CSP headers konfigurert
- [ ] RLS policies testet grundig
- [ ] npm audit kjørt og sårbarheter fikset
- [ ] HTTPS aktivert med gyldig SSL-sertifikat
- [ ] Firewall konfigurert (kun port 80, 443)
- [ ] Sterke passord på alle admin-kontoer
- [ ] Security advisory policy publisert
- [ ] Sikkerhet kontaktinformasjon oppdatert i SECURITY.md
- [ ] Backup rutine etablert
- [ ] Monitoring og logging aktivert
- [ ] Email-bekreftelse aktivert i Lovable Cloud Auth

---

## 🔍 Verifiser Sikkerheten

Kjør disse kommandoene for å verifisere:

```bash
# 1. Sjekk at .env ikke er i git
git ls-files | grep .env
# (Skal være tomt)

# 2. Sjekk sårbarheter
npm audit --audit-level=moderate

# 3. Sjekk at ingen secrets er hardkodet
grep -r "SUPABASE_SERVICE_ROLE_KEY" src/
# (Skal være tomt)

# 4. Kjør alle tester
npm run test

# 5. Bygg produksjon
npm run build
```

Alle kommandoer skal kjøre uten feil!

---

## 📞 Hjelp og Support

Hvis du oppdager sikkerhetsproblemer:

1. **IKKE** lag public issue på GitHub
2. Bruk GitHub Security Advisory: [your-repo]/security/advisories/new
3. Eller email: security@[your-domain]
4. Inkluder detaljert beskrivelse og reproduksjonssteg

Response tid: 24-48 timer for kritiske sårbarheter.

---

## 🎓 Ressurser

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/platform/security)
- [GitHub Security Best Practices](https://docs.github.com/en/code-security)
- [Lovable Cloud Security](https://docs.lovable.dev/features/security)

---

**HUSK**: Sikkerhet er en kontinuerlig prosess, ikke en engangshendelse!
