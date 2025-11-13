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

**How to Report:**

1. **For Critical Vulnerabilities** (SQL injection, authentication bypass, data leaks):
   - Create a private security advisory on GitHub: https://github.com/[your-repo]/security/advisories/new
   - Or email: security@[your-domain] (create this mailbox!)
   - Expected response: Within 24 hours
   - Fix timeline: Within 48-72 hours for critical issues

2. **For Non-Critical Issues** (info disclosure, configuration issues):
   - Create a private security advisory on GitHub
   - Expected response: Within 48 hours
   - Fix timeline: Within 7-14 days

3. **What to Include in Your Report:**
   - Clear description of the vulnerability
   - Step-by-step reproduction steps
   - Proof of concept (if applicable)
   - Potential impact and severity assessment
   - Affected versions
   - Suggested fix (optional but appreciated)
   - Your contact information for follow-up

4. **What Constitutes a Security Issue:**
   - Authentication/authorization bypass
   - SQL injection or other injection attacks
   - XSS vulnerabilities
   - Exposure of sensitive data (API keys, passwords, PII)
   - CSRF vulnerabilities
   - RLS policy bypasses
   - Denial of service vulnerabilities
   - Insecure direct object references

5. **What is NOT a Security Issue:**
   - Feature requests
   - Performance issues
   - UI/UX bugs
   - Compatibility issues
   - Issues requiring physical access to the server
   - Social engineering attacks

### Disclosure Policy

- **Private Disclosure**: Report privately through security advisory or email
- **Acknowledgment**: We'll acknowledge receipt within 24-48 hours
- **Investigation**: We'll investigate and confirm the issue
- **Fix Development**: We'll develop and test a fix
- **Coordinated Disclosure**: We'll coordinate public disclosure with you
- **Public Disclosure**: After fix is released and users have time to update (typically 7-14 days)
- **Credit**: We give credit to responsible reporters in:
  - Security advisory
  - Release notes
  - CHANGELOG.md (with 🔒 emoji)
  - Security hall of fame (if applicable)
- **CVE Assignment**: For significant vulnerabilities, we'll:
  - Request CVE ID from MITRE or GitHub
  - Include CVE in advisory and release notes
  - Document in National Vulnerability Database

### Security Hall of Fame

We maintain a list of security researchers who have helped improve Jelly Stream Viewer:

- (Add names here as vulnerabilities are reported and fixed)

Thank you to everyone who practices responsible disclosure!

### Vulnerability Severity Levels

**Critical (CVSS 9.0-10.0)**
- Authentication bypass allowing full admin access
- SQL injection leading to database compromise
- Remote code execution
- **Response Time**: Within 24 hours
- **Fix Timeline**: 24-48 hours

**High (CVSS 7.0-8.9)**
- XSS allowing account takeover
- RLS bypass exposing all user data
- API key exposure in client code
- **Response Time**: Within 48 hours
- **Fix Timeline**: 3-7 days

**Medium (CVSS 4.0-6.9)**
- CSRF on sensitive operations
- Information disclosure (non-PII)
- Weak encryption or hashing
- **Response Time**: Within 1 week
- **Fix Timeline**: 7-14 days

**Low (CVSS 0.1-3.9)**
- Missing security headers
- Verbose error messages
- Minor information leaks
- **Response Time**: Within 2 weeks
- **Fix Timeline**: Next minor release

### Security Update Process

1. **Hotfix Release** (Critical/High):
   - Immediate patch release (e.g., 1.2.3 → 1.2.4)
   - Security advisory published
   - Users notified via GitHub and in-app notification
   - Backport to supported versions if applicable

2. **Regular Release** (Medium/Low):
   - Included in next scheduled release
   - Documented in release notes
   - Security advisory for transparency

3. **User Notification**:
   - GitHub Security Advisory
   - Release notes with 🔒 emoji
   - In-app update notification for admins
   - Email notification (if email list exists)

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

## Data Classification

Understanding what data is considered sensitive:

### Personally Identifiable Information (PII)
- User email addresses
- Jellyfin usernames
- IP addresses (in logs)
- Session tokens

**Protection**: RLS policies, encryption at rest, HTTPS in transit

### Authentication Data
- Password hashes
- JWT tokens
- API keys (Jellyfin, Jellyseerr)
- Webhook secrets

**Protection**: Never stored in client code, hashed/encrypted, edge functions only

### User Content
- Watch history
- Favorites
- Content requests
- Feedback

**Protection**: RLS policies ensuring user-specific access only

### Public Data
- News posts (published)
- Site settings (name, logo)
- App versions
- Server URLs (without credentials)

**Protection**: Minimal, intended for public consumption

## Compliance

### GDPR Compliance

This application collects and processes personal data. Here's how we comply:

**Data Controller Information:**
- Administrator of the Jelly Stream Viewer instance is the data controller
- Contact: [Add your contact information]

**Legal Basis for Processing:**
- Consent: Users create accounts voluntarily
- Legitimate Interest: Providing streaming service functionality

**User Rights Implementation:**

1. **Right to Access (GDPR Art. 15)**:
   - Users can view all their data in Profile → My Data
   - Export functionality available (JSON format)

2. **Right to Rectification (GDPR Art. 16)**:
   - Users can update their profile and preferences
   - Contact admin for corrections

3. **Right to Erasure (GDPR Art. 17)**:
   - Users can delete their account in Profile → Delete Account
   - All personal data removed within 30 days
   - Cascade deletes: favorites, history, requests, feedback

4. **Right to Data Portability (GDPR Art. 20)**:
   - Export function provides machine-readable JSON
   - Includes: profile, favorites, watch history, requests

5. **Right to Object (GDPR Art. 21)**:
   - Users can opt out of optional features
   - Essential functionality requires data processing

**Data Retention:**
- Active user data: Retained while account exists
- Deleted account data: Purged after 30 days
- Logs: 30 days retention
- Backups: 90 days (then deleted)

**Data Breach Notification:**
- Users notified within 72 hours of confirmed breach
- Supervisory authority notified if required
- Incident documented in security log

### Privacy by Design

- **Data Minimization**: Only collect necessary data
- **Purpose Limitation**: Data used only for stated purposes
- **Storage Limitation**: Automatic deletion of old data
- **Integrity**: Checksums and validation
- **Confidentiality**: Encryption and access controls

## Security Audit Checklist

Use this checklist for security reviews:

### Infrastructure Security
- [ ] HTTPS enabled with valid SSL certificate
- [ ] Firewall configured (only ports 80, 443 open)
- [ ] SSH key-based authentication (no password login)
- [ ] Fail2ban or similar intrusion prevention
- [ ] Regular security updates (unattended-upgrades)
- [ ] Strong server passwords (if any)
- [ ] Database not exposed to internet
- [ ] Backup encryption enabled

### Application Security
- [ ] No .env file in git repository
- [ ] All secrets in Lovable Cloud Secrets (not code)
- [ ] VITE_ prefix only for public keys
- [ ] RLS enabled on all tables
- [ ] RLS policies tested for bypasses
- [ ] JWT verification enabled on edge functions
- [ ] Input validation on all user inputs
- [ ] CORS properly configured (not wildcard)
- [ ] Rate limiting on API endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (no dangerouslySetInnerHTML)
- [ ] CSRF tokens where applicable

### Authentication & Authorization
- [ ] Strong password requirements (min 12 chars)
- [ ] Email confirmation enabled (production)
- [ ] Session timeout configured (7 days)
- [ ] Logout functionality works correctly
- [ ] Admin role properly protected
- [ ] has_role() function used correctly
- [ ] No privilege escalation possible

### Monitoring & Logging
- [ ] Edge function logs reviewed regularly
- [ ] Failed auth attempts monitored
- [ ] Admin actions logged
- [ ] Unusual traffic patterns detected
- [ ] Security alerts configured
- [ ] Log retention policy defined (30 days)

### Dependency Management
- [ ] npm audit run regularly (weekly)
- [ ] Critical vulnerabilities fixed immediately
- [ ] Dependencies updated monthly
- [ ] Dependabot enabled
- [ ] Security advisories subscribed

### Data Protection
- [ ] PII properly protected
- [ ] User data exportable
- [ ] Account deletion works correctly
- [ ] Data retention policy enforced
- [ ] GDPR rights implemented

### Documentation
- [ ] SECURITY.md up to date
- [ ] RLS policies documented
- [ ] Security contact information current
- [ ] Incident response plan defined
- [ ] User privacy policy available

## Security Contact

**For Security Vulnerabilities:**
- GitHub Security Advisory: https://github.com/[your-repo]/security/advisories/new
- Email: security@[your-domain] (for critical issues)
- PGP Key: [Add PGP key fingerprint if using encrypted email]

**For General Security Questions:**
- GitHub Discussions: https://github.com/[your-repo]/discussions
- Create issue with [SECURITY] tag

**Response Times:**
- Critical vulnerabilities: Within 24 hours
- High severity: Within 48 hours
- Medium/Low: Within 1-2 weeks

## Changelog

Security-related changes are documented in CHANGELOG.md with 🔒 emoji.

Example entries:
- 🔒 Fixed SQL injection in search endpoint (CVE-2024-XXXXX)
- 🔒 Updated dependency with known vulnerability
- 🔒 Improved RLS policies on user_favorites table

## Security Resources

**Documentation:**
- Supabase Security Best Practices: https://supabase.com/docs/guides/platform/security
- OWASP Top 10: https://owasp.org/www-project-top-ten/
- OWASP API Security: https://owasp.org/www-project-api-security/

**Tools:**
- npm audit: Built-in dependency scanner
- Dependabot: Automated dependency updates
- GitHub Security: Security advisories and scanning
- Supabase RLS: Row-level security policies

**Training:**
- OWASP Secure Coding Practices
- Web Security Academy (PortSwigger)
- Supabase Security Documentation

---

**Last Updated**: 2025-01-13
**Review Schedule**: Quarterly security audits recommended
**Next Review**: 2025-04-13

**Document Version**: 2.0
**Maintained By**: [Your name/organization]
**Security Team**: [List security team members or admin contacts]
