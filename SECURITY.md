# Sikkerhetsdokumentasjon

## Sikkerhetsarkitektur

### Autentisering
- **JWT-basert**: Alle API-kall krever gyldig JWT fra Supabase Auth
- **Token lifecycle**: Access tokens fornyes automatisk via refresh tokens
- **Session storage**: Lagret i localStorage med automatisk cleanup ved utlogging

### Row Level Security (RLS)

Alle tabeller har RLS aktivert. Nøkkelpolicyer:

#### user_roles
```sql
-- Brukere kan kun se sine egne roller
CREATE POLICY "Users can view own roles"
ON user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Admins har full tilgang via sikker funksjon
CREATE POLICY "Admins have full access"
ON user_roles FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

#### user_favorites
```sql
CREATE POLICY "Users can manage own favorites"
ON user_favorites FOR ALL
USING (auth.uid() = user_id);
```

#### server_settings
```sql
CREATE POLICY "Admins can manage server settings"
ON server_settings FOR ALL
USING (has_role(auth.uid(), 'admin'));
```

### Edge Functions Sikkerhet

#### JWT-verifisering
Konfigurert i `supabase/config.toml`:

```toml
[functions.jellyfin-proxy]
verify_jwt = true  # Krever JWT

[functions.jellyfin-stream]
verify_jwt = false  # Valideres internt med token-parameter
```

#### CORS
Alle edge functions bruker sikre CORS-headere:
```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Input-validering

Zod-schemas brukes for all input-validering:

```typescript
const authSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(1),
});
```

### API-nøkkelhåndtering

- **Jellyfin/Jellyseerr API-nøkler**: Lagres i `server_settings` tabell
- **RLS**: Kun admins har tilgang til server_settings
- **Edge functions**: Henter nøkler direkte fra database, eksponeres aldri til klient

### Sikker rolle-sjekk

Bruker security definer function for å unngå RLS-rekursjon:

```sql
CREATE OR REPLACE FUNCTION has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;
```

## Rapportere sikkerhetsproblemer

Hvis du oppdager et sikkerhetsproblem:

1. **IKKE** opprett en offentlig GitHub issue
2. Send epost til [sikkerhet@dindomene.no] med:
   - Beskrivelse av sårbarheten
   - Steg for å reprodusere
   - Potensielt omfang
3. Vi vil svare innen 48 timer
4. Vi publiserer fix innen 7 dager (kritiske saker)

## Beste praksis for deployment

### Produksjonssjekkliste
- [ ] HTTPS aktivert (Certbot)
- [ ] `.env` ikke committet til git
- [ ] Unik, sterk database-passord
- [ ] Firewall konfigurert (kun port 80/443 åpne)
- [ ] Supabase RLS aktivert på alle tabeller
- [ ] Edge function JWT-verifisering aktivert
- [ ] Auto-confirm email deaktivert i produksjon
- [ ] Logging og monitoring satt opp
- [ ] Backup-strategi på plass

### Anbefalte Supabase-innstillinger
- **Auth**: Deaktiver auto-confirm email i produksjon
- **Database**: Aktiver connection pooling
- **API**: Sett rate limits på edge functions
- **Storage**: Konfigurer max file size

## Tredjepartsavhengigheter

Kritiske avhengigheter overvåkes for sårbarheter:
- `@supabase/supabase-js`
- `react-router-dom`
- `@tanstack/react-query`

Kjør `npm audit` regelmessig for å sjekke sårbarheter.

## Logging og monitoring

### Edge function logs
Tilgjengelig i Lovable Cloud backend-grensesnitt eller via Supabase CLI:
```bash
supabase functions logs jellyfin-proxy
```

### Database audit
Alle endringer i kritiske tabeller logges:
```sql
CREATE TRIGGER audit_server_settings
AFTER INSERT OR UPDATE OR DELETE ON server_settings
FOR EACH ROW EXECUTE FUNCTION audit_log();
```

## Compliance

- **GDPR**: Brukere kan slette egne data via profil-side
- **Data retention**: Sessions utløper etter 7 dager inaktivitet
- **Encryption**: All kommunikasjon via HTTPS i produksjon
