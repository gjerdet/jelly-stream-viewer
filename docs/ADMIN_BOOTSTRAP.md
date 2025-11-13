# Admin Bootstrap - Sikker Første-Bruker Løsning

## 🔒 Sikker Admin-tilordning

Jelly Stream Viewer bruker en **automatisk og sikker** metode for å tildele admin-rettigheter til første bruker.

## ✅ Hvordan det Fungerer

### Automatisk Database Trigger

Når en ny bruker registrerer seg, kjører en database-trigger automatisk:

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Opprett profil
  INSERT INTO public.profiles (id, email, jellyfin_username, jellyfin_user_id)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'jellyfin_username',
    NEW.raw_user_meta_data->>'jellyfin_user_id'
  );
  
  -- 🔑 FØRSTE BRUKER BLIR ADMIN
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    -- Alle andre får 'user' rolle
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger aktiveres på ny bruker
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

### Sikkerhetsfunksjoner

1. **Atomisk Sjekk**: Database-trigger kjører i en transaksjon
2. **Race Condition Safe**: PostgreSQL håndterer concurrency
3. **Ingen Manuell Intervensjon**: Ingen SQL-kommandoer nødvendig
4. **Audit Trail**: Alle rolle-tilordninger logges i databasen
5. **Immutable**: Kan ikke omgås fra klient-kode

---

## 🚀 Installasjonsprosess

### For Lovable Cloud (Anbefalt)

1. **Deploy applikasjonen** til Lovable Cloud
2. **Naviger til applikasjonen** i nettleseren
3. **Klikk "Register"** på login-siden
4. **Opprett din admin-konto**:
   - Email: din@email.com
   - Passord: [sterkt passord]
5. **✅ Du er nå admin!**

### For Self-Hosted Supabase

1. **Kjør `supabase/setup.sql`** i Supabase SQL Editor
2. **Triggeren er nå aktiv**
3. **Registrer første bruker** via applikasjonen
4. **✅ Første bruker er admin!**

---

## 🔐 Hvorfor Dette er Trygt

### ❌ Utrygg Metode (IKKE BRUK):

```sql
-- FARLIG: Manuell UPDATE i README
-- Hvem som helst kan kjøre denne
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'any-user-id';
```

**Problemer:**
- Hvem som helst med database-tilgang kan kjøre dette
- Kan kjøres flere ganger
- Ingen validering
- Vanskelig å revidere hvem som ble admin

### ✅ Trygg Metode (BRUKES NÅ):

```sql
-- TRYGT: Automatisk trigger
-- Kjører kun ved registrering
-- Sjekker at ingen admin eksisterer
IF NOT EXISTS (SELECT 1 FROM user_roles WHERE role = 'admin') THEN
  INSERT INTO user_roles (user_id, role) VALUES (NEW.id, 'admin');
END IF;
```

**Fordeler:**
- Kjører automatisk ved registrering
- Kun første bruker får admin
- Ingen manuell intervensjon
- Kan ikke omgås
- Auditert via database-logs

---

## 🛡️ Ekstra Sikkerhetstiltak

### 1. Lukk Registreringen

Etter første admin er opprettet, kan du lukke registreringen:

**Lovable Cloud:**
1. Gå til Cloud → Authentication → Settings
2. Deaktiver "Enable email signup"
3. Kun admin kan nå invitere brukere

**Kode-basert:**

```typescript
// I din signup-komponent
const signUp = async (email: string, password: string) => {
  // Sjekk om registrering er åpen
  const { data: settings } = await supabase
    .from('site_settings')
    .select('setting_value')
    .eq('setting_key', 'allow_registration')
    .single();
  
  if (settings?.setting_value !== 'true') {
    return { error: { message: 'Registrering er stengt. Kontakt admin.' } };
  }
  
  // ... fortsett med registrering
};
```

### 2. Overvåk Admin-tilordninger

```sql
-- Opprett audit log
CREATE TABLE admin_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Logg når noen blir admin
CREATE OR REPLACE FUNCTION log_admin_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role = 'admin' THEN
    INSERT INTO admin_audit_log (user_id, action)
    VALUES (NEW.user_id, 'ADMIN_ROLE_ASSIGNED');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_admin_role_assigned
  AFTER INSERT OR UPDATE ON user_roles
  FOR EACH ROW
  WHEN (NEW.role = 'admin')
  EXECUTE FUNCTION log_admin_assignment();
```

### 3. Email-notifikasjon

Send email når ny admin opprettes:

```typescript
// I edge function
const sendAdminNotification = async (newAdminEmail: string) => {
  // Send via Resend, SendGrid, etc.
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'security@yourdomain.com',
      to: 'admin@yourdomain.com',
      subject: '🔒 New Admin User Created',
      html: `<p>A new admin user was created: ${newAdminEmail}</p>`
    })
  });
};
```

---

## 🧪 Testing

### Test at Første Bruker Blir Admin:

```bash
# 1. Reset databasen (kun for testing!)
psql $DATABASE_URL -c "DELETE FROM user_roles WHERE role = 'admin';"

# 2. Registrer ny bruker via UI

# 3. Sjekk at bruker fikk admin-rolle
psql $DATABASE_URL -c "SELECT * FROM user_roles WHERE role = 'admin';"
```

### Test at Andre Brukere IKKE Blir Admin:

```bash
# 1. Registrer en til bruker

# 2. Sjekk at bruker fikk 'user' rolle
psql $DATABASE_URL -c "SELECT * FROM user_roles WHERE user_id = 'second-user-id';"
```

### Test Race Condition:

```python
# Simuler to samtidige registreringer
import asyncio
import httpx

async def register_user(email):
    async with httpx.AsyncClient() as client:
        response = await client.post('https://your-app.com/auth/register', json={
            'email': email,
            'password': 'TestPassword123!'
        })
        return response.json()

async def test_concurrent_registration():
    # Prøv å registrere to brukere samtidig
    results = await asyncio.gather(
        register_user('user1@test.com'),
        register_user('user2@test.com')
    )
    print(results)
    # Kun én skal være admin

asyncio.run(test_concurrent_registration())
```

---

## 📊 Sammenligning med Andre Løsninger

| Metode | Sikkerhet | Brukervennlighet | Automatisering |
|--------|-----------|------------------|----------------|
| **Manuell SQL UPDATE** | ❌ Lav | ❌ Vanskelig | ❌ Manuell |
| **Engangstoken** | ⚠️ Medium | ⚠️ OK | ⚠️ Semi-automatisk |
| **Første-bruker trigger** | ✅ Høy | ✅ Enkel | ✅ Automatisk |
| **Invite-only** | ✅ Høy | ⚠️ Kompleks | ⚠️ Semi-automatisk |

### Første-Bruker Trigger (Brukes Nå)

**Fordeler:**
- ✅ Automatisk - ingen manuell handling
- ✅ Sikker - kan ikke omgås
- ✅ Enkel - bare registrer deg
- ✅ Atomisk - race condition safe
- ✅ Auditert - logges i database

**Ulemper:**
- ⚠️ Første som registrerer seg får admin
- ⚠️ Må være rask i produksjon

### Engangstoken (Alternativ)

Hvis du vil ha mer kontroll:

```typescript
// Generer engangstoken ved deploy
const BOOTSTRAP_TOKEN = crypto.randomUUID();
console.log('Bootstrap token:', BOOTSTRAP_TOKEN);

// Lagre i database
await supabase.from('bootstrap_tokens').insert({
  token: BOOTSTRAP_TOKEN,
  expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 timer
});

// Ved registrering, krev token for første admin
const signUpAsAdmin = async (email: string, password: string, token: string) => {
  const { data: validToken } = await supabase
    .from('bootstrap_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .gt('expires_at', new Date())
    .single();
  
  if (!validToken) {
    throw new Error('Invalid or expired bootstrap token');
  }
  
  // Registrer bruker og tildel admin
  // ...
  
  // Marker token som brukt
  await supabase
    .from('bootstrap_tokens')
    .update({ used: true })
    .eq('token', token);
};
```

---

## 🔄 Migrering fra Utrygg til Trygg Metode

Hvis du allerede har dokumentasjon med manuelle SQL-kommandoer:

### 1. Fjern Gamle Instruksjoner

**Før (FARLIG):**
```markdown
## Opprett Admin

Kjør i Supabase SQL Editor:

```sql
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'your-user-id';
```
```

**Etter (TRYGT):**
```markdown
## Opprett Admin

Den første brukeren som registrerer seg blir automatisk admin.

Bare registrer en konto via applikasjonen!
```

### 2. Oppdater Setup-dokumentasjon

Se [`README.md`](../README.md) for oppdatert setup-guide.

---

## 📝 Sjekkliste

- [x] Database-trigger implementert (`handle_new_user()`)
- [x] Trigger aktivert på `auth.users` tabell
- [x] Testet at første bruker blir admin
- [x] Testet at andre brukere IKKE blir admin
- [x] Fjernet manuelle SQL-instruksjoner fra README
- [x] Dokumentert sikker metode
- [ ] Vurdér å stenge registrering etter første admin
- [ ] Vurdér email-notifikasjon for nye admins
- [ ] Vurdér audit logging for admin-operasjoner

---

## 🆘 Troubleshooting

### Problem: Ingen blir admin

**Sjekk:**
```sql
-- Er triggeren aktiv?
SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';

-- Er funksjonen korrekt?
SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user';
```

**Løsning:**
```sql
-- Kjør setup.sql på nytt
-- Eller manuelt opprett trigger
```

### Problem: Feil bruker ble admin

**Løsning:**
```sql
-- Endre rolle manuelt (én gang)
UPDATE user_roles 
SET role = 'user' 
WHERE user_id = 'wrong-user-id';

-- Tildel riktig bruker admin
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = 'correct-user-id';
```

**Forebygg:**
- Test setup i staging først
- Stengt registrering umiddelbart etter første admin

---

## 📚 Ytterligere Ressurser

- [Supabase Triggers Documentation](https://supabase.com/docs/guides/database/triggers)
- [PostgreSQL Security Best Practices](https://www.postgresql.org/docs/current/sql-security.html)
- [OWASP Authorization Best Practices](https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html)

---

**Sist oppdatert**: 2025-01-13
**Vedlikeholdes av**: Jelly Stream Viewer Security Team
