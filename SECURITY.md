# Security Documentation

## Security Architecture

Jelly Stream Viewer implements multiple layers of security to protect user data and prevent unauthorized access.

## Authentication

### JWT-Based Authentication
- **Provider**: Lovable Cloud / Supabase Auth
- **Token Type**: JWT (JSON Web Tokens)
- **Storage**: localStorage with automatic cleanup on logout
- **Lifecycle**: Access tokens auto-refresh via refresh tokens
- **Session Duration**: 7 days of inactivity before expiration

### Authentication Flow

```
1. User submits credentials
   ↓
2. Lovable Cloud validates credentials
   ↓
3. JWT token issued (access + refresh)
   ↓
4. Tokens stored in localStorage
   ↓
5. All API calls include Authorization header
   ↓
6. Tokens auto-refresh before expiration
```

## Row-Level Security (RLS)

Every database table has RLS enabled with granular access controls.

### User Roles System

**Secure Role Function**
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

This function:
- Runs with SECURITY DEFINER to bypass RLS
- Prevents recursive RLS checks
- Used in all admin-level policies
- Immutable for performance

### Key RLS Policies

#### user_roles
```sql
-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all roles
CREATE POLICY "Admins can manage roles"
  ON user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));
```

#### user_favorites
```sql
-- Users can only access their own favorites
CREATE POLICY "Users can view their own favorites"
  ON user_favorites FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);
```

#### server_settings
```sql
-- Everyone can read server settings (for configuration)
CREATE POLICY "Everyone can read server settings"
  ON server_settings FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Only admins can update server settings"
  ON server_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));
```

#### news_posts
```sql
-- Everyone can read published posts
CREATE POLICY "Everyone can read published posts"
  ON news_posts FOR SELECT
  USING (published = true);

-- Admins can manage all posts
CREATE POLICY "Admins can create posts"
  ON news_posts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
```

## Edge Functions Security

### JWT Verification

Configured in `supabase/config.toml`:

```toml
# Most functions require JWT
[functions.jellyfin-authenticate]
verify_jwt = true

[functions.check-updates]
verify_jwt = true

# Some functions validate internally
[functions.trigger-update]
verify_jwt = true
```

### CORS Configuration

All edge functions use secure CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Input Validation

Edge functions validate all inputs using Zod schemas:

```typescript
import { z } from "zod";

const authSchema = z.object({
  username: z.string().min(1).max(100),
  password: z.string().min(8),
  serverUrl: z.string().url(),
});

// Validate input
const result = authSchema.safeParse(input);
if (!result.success) {
  return new Response(JSON.stringify({ 
    error: 'Invalid input' 
  }), { status: 400 });
}
```

## API Key Management

### Storage
- **Jellyfin API Keys**: Stored in `server_settings` table
- **Jellyseerr API Keys**: Stored in `server_settings` table
- **Access**: Only admins can read/write via RLS policies
- **Encryption**: At-rest encryption via Lovable Cloud

### Usage in Edge Functions

```typescript
// Secure retrieval from database
const { data } = await supabase
  .from('server_settings')
  .select('setting_value')
  .eq('setting_key', 'jellyfin_api_key')
  .single();

// Never expose to client
const apiKey = data?.setting_value;

// Use in server-side requests only
const response = await fetch(jellyfinUrl, {
  headers: {
    'X-Emby-Token': apiKey
  }
});
```

## Frontend Security

### XSS Prevention
- React automatically escapes output
- No `dangerouslySetInnerHTML` usage
- Content Security Policy headers

### CSRF Protection
- JWT tokens in Authorization header (not cookies)
- SameSite cookie attributes
- CORS properly configured

### Secure Storage
```typescript
// DO NOT store sensitive data in localStorage
// Only store non-sensitive user preferences
localStorage.setItem('theme', 'dark');

// JWT tokens are handled by Supabase client
// Automatic secure storage and refresh
```

## Real-Time Subscriptions Security

### Channel Authorization

```typescript
// Only subscribe to channels the user has access to
const channel = supabase
  .channel(`user:${userId}:updates`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'user_favorites',
    filter: `user_id=eq.${userId}` // Critical: filter by user
  }, handleUpdate)
  .subscribe();
```

### RLS Enforcement

Real-time subscriptions respect RLS policies:
- Users only receive updates for data they can access
- Admin-only tables require admin role
- Personal data filtered by user_id

## Update System Security

### Webhook Authentication

```typescript
// Verify secret before processing update
const secret = req.headers.get('X-Update-Secret');
if (secret !== Deno.env.get('UPDATE_SECRET')) {
  return new Response('Unauthorized', { status: 403 });
}
```

### Update Status Access

```sql
-- Only admins can view update status
CREATE POLICY "Admins can view update status"
  ON update_status FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));
```

## Deployment Security

### Production Checklist

- [ ] **HTTPS Enabled**: Use SSL/TLS certificates
- [ ] **Environment Variables**: Never commit `.env` to git
- [ ] **Strong Passwords**: Enforce minimum password requirements
- [ ] **Firewall Configured**: Only necessary ports open (80, 443)
- [ ] **RLS Enabled**: All tables have active RLS policies
- [ ] **JWT Verification**: Edge functions validate JWTs
- [ ] **Rate Limiting**: API rate limits configured
- [ ] **Monitoring**: Log analysis and alerting set up
- [ ] **Backups**: Regular automated backups
- [ ] **Updates**: Keep dependencies updated

### Lovable Cloud Settings

**Recommended Configuration**:
- **Auth**: Email confirmation enabled in production
- **Database**: Connection pooling enabled
- **Functions**: Rate limits on all edge functions
- **Storage**: Maximum file size limits
- **Logs**: Enable detailed logging for security events

### Self-Hosted Settings

**Nginx Security Headers**:
```nginx
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header X-XSS-Protection "1; mode=block" always;
add_header Referrer-Policy "no-referrer-when-downgrade" always;
add_header Content-Security-Policy "default-src 'self' https: data: 'unsafe-inline' 'unsafe-eval'" always;
```

## Vulnerability Management

### Dependency Scanning

Run regularly:
```bash
npm audit
npm audit fix
```

### Critical Dependencies

Monitor these packages for security updates:
- `@supabase/supabase-js`
- `react`
- `react-dom`
- `react-router-dom`
- `@tanstack/react-query`

### Update Process

1. Check security advisories
2. Update dependencies
3. Run `npm audit`
4. Test thoroughly
5. Deploy update

## Incident Response

### Reporting Security Issues

**DO NOT** create public GitHub issues for security vulnerabilities.

Instead:
1. Email security contact (see repository)
2. Include:
   - Description of vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)
3. Expected response: Within 48 hours
4. Fix timeline: Within 7 days for critical issues

### Disclosure Policy

- **Private disclosure** to maintainers first
- **Public disclosure** after fix is released
- **Credit** given to responsible reporters
- **CVE** assigned for significant vulnerabilities

## Logging and Monitoring

### Edge Function Logs

View in Lovable Cloud backend panel or via CLI:
```bash
# View logs for specific function
supabase functions logs check-updates --limit 100

# Stream live logs
supabase functions logs trigger-update --tail
```

### Security Events to Monitor

- Failed authentication attempts
- Admin role changes
- Server settings modifications
- Unusual API usage patterns
- Database policy violations
- Update system activities

### Database Audit Trail

```sql
-- Track changes to sensitive tables
CREATE TRIGGER audit_user_roles
  AFTER INSERT OR UPDATE OR DELETE ON user_roles
  FOR EACH ROW 
  EXECUTE FUNCTION log_audit_event();

CREATE TRIGGER audit_server_settings
  AFTER UPDATE ON server_settings
  FOR EACH ROW
  EXECUTE FUNCTION log_audit_event();
```

## Compliance

### GDPR Compliance

- **Right to Access**: Users can view their data
- **Right to Deletion**: Users can delete their account and data
- **Data Export**: Export functionality available
- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Data used only for stated purposes

### Data Retention

- **User Data**: Retained while account is active
- **Session Data**: 7 days of inactivity
- **Logs**: 30 days retention
- **Backups**: 90 days retention

### Encryption

- **In Transit**: HTTPS/TLS for all connections
- **At Rest**: Database encryption via Lovable Cloud
- **Backups**: Encrypted backups

## Security Best Practices

### For Administrators

1. **Use Strong Passwords**: Minimum 12 characters, mixed case, numbers, symbols
2. **Enable 2FA**: On GitHub and Lovable accounts
3. **Rotate API Keys**: Regular rotation of Jellyfin/Jellyseerr keys
4. **Review Logs**: Regular security log reviews
5. **Keep Updated**: Apply security patches promptly
6. **Least Privilege**: Only grant necessary permissions
7. **Backup Regularly**: Test backup restoration
8. **Monitor Activity**: Watch for unusual patterns

### For Users

1. **Strong Passwords**: Use unique, complex passwords
2. **Don't Share Accounts**: Each user should have their own account
3. **Logout When Done**: Especially on shared devices
4. **Report Issues**: Report suspicious activity
5. **Keep Browser Updated**: Use latest browser versions

### For Developers

1. **Input Validation**: Validate all user inputs
2. **SQL Injection**: Use parameterized queries only
3. **XSS Prevention**: Never use `dangerouslySetInnerHTML`
4. **Authentication**: Always check auth on sensitive operations
5. **Authorization**: Verify permissions before actions
6. **Secrets Management**: Never commit secrets
7. **Code Review**: Peer review all security-related code
8. **Test RLS**: Test all RLS policies thoroughly

## Security Contact

For security inquiries:
- Create issue on GitHub (for general security questions)
- Email security contact (for vulnerability reports)

## Changelog

Security-related changes are documented in CHANGELOG.md with 🔒 emoji.

---

**Last Updated**: Check git history for latest security updates
**Review Schedule**: Quarterly security audits recommended
