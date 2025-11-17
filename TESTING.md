# Testing Guide

Denne guiden beskriver teststrategien og hvordan man kjører tester i Jelly Stream Viewer.

## 📋 Innhold

- [Testing-stack](#testing-stack)
- [Kjøre tester](#kjøre-tester)
- [Skrive tester](#skrive-tester)
- [Test-strategi](#test-strategi)
- [CI/CD Testing](#cicd-testing)

## 🛠️ Testing-stack

### Enhetstester (Unit Tests)
- **Vitest** - Rask test runner med ESM-støtte
- **@testing-library/react** - Testing utilities for React
- **@testing-library/jest-dom** - Custom Jest matchers

### End-to-End (E2E) Tester
- **Playwright** - Browser automation for E2E-testing
- Støtter Chromium, Firefox og WebKit

## 🚀 Kjøre tester

### Enhetstester

```bash
# Kjør alle enhetstester
npm run test

# Kjør tester i watch mode
npm run test:watch

# Kjør tester med coverage
npm run test:coverage

# Åpne Vitest UI
npm run test:ui
```

### E2E-tester

```bash
# Installer Playwright browsers (første gang)
npx playwright install

# Kjør E2E-tester
npm run test:e2e

# Kjør E2E-tester i UI mode
npm run test:e2e:ui

# Kjør E2E-tester i debug mode
npm run test:e2e:debug
```

## 📝 Skrive tester

### Enhetstest-eksempel

Plasser enhetstester i `__tests__` mapper ved siden av koden:

```typescript
// src/lib/__tests__/jellyfinClient.test.ts
import { describe, it, expect, vi } from 'vitest';
import { authenticateJellyfin } from '../jellyfinClient';

describe('jellyfinClient', () => {
  it('should authenticate successfully', async () => {
    // Arrange
    const mockResponse = { AccessToken: 'test-token' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });

    // Act
    const result = await authenticateJellyfin(
      'http://localhost:8096',
      'user',
      'pass'
    );

    // Assert
    expect(result).toEqual(mockResponse);
  });
});
```

### E2E-test-eksempel

Plasser E2E-tester i `e2e/` mappen:

```typescript
// e2e/login.spec.ts
import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
  await page.goto('/login');
  
  await page.fill('input[type="email"]', 'test@example.com');
  await page.fill('input[type="password"]', 'password');
  await page.click('button[type="submit"]');
  
  await expect(page).toHaveURL('/');
});
```

## 🎯 Test-strategi

### Hva skal testes?

#### ✅ Enhetstester for:
- **Utility functions** - Rene funksjoner uten side effects
- **API clients** - Jellyfin og Jellyseerr klienter
- **Custom hooks** - React hooks med kompleks logikk
- **Helpers** - Formattering, validering, etc.

#### ✅ E2E-tester for:
- **Kritiske brukerflyter** - Login, registrering, videoavspilling
- **Navigasjon** - Rutingfunksjonalitet
- **Integrasjoner** - Jellyfin og Jellyseerr interaksjoner

#### ❌ Ikke test:
- Third-party libraries (de har egne tester)
- Trivielle getters/setters
- Rene UI-komponenter uten logikk (bruk visual testing i stedet)

### Test Coverage-mål

- **Kritiske funksjoner**: 90%+ coverage
- **Business logic**: 80%+ coverage
- **Totalt prosjekt**: 70%+ coverage

## 🔄 CI/CD Testing

Tester kjøres automatisk i GitHub Actions:

### På Pull Requests
```yaml
# .github/workflows/ci.yml
- Unit tests (Vitest)
- E2E tests (Playwright)
- Lint checks
- Type checks
- Build verification
```

### Testing-strategi i CI
1. **Fast feedback** - Enhetstester kjøres først (raskest)
2. **Integration** - E2E-tester kjøres etter build
3. **Parallellisering** - Tester kjøres parallelt for å spare tid
4. **Artifacts** - Test reports lagres som artifacts

## 🐛 Debugging

### Debug Vitest
```bash
# Kjør spesifikk test
npm run test -- jellyfinClient.test.ts

# Debug med breakpoints
node --inspect-brk node_modules/.bin/vitest --run
```

### Debug Playwright
```bash
# Kjør med visuell browser
npm run test:e2e:debug

# Kjør spesifikk test
npx playwright test login.spec.ts

# Se test trace
npx playwright show-report
```

## 📊 Best Practices

### 1. Arrange-Act-Assert
Struktur testene dine tydelig:
```typescript
it('should do something', () => {
  // Arrange - sett opp test data
  const input = { foo: 'bar' };
  
  // Act - utfør handlingen
  const result = myFunction(input);
  
  // Assert - verifiser resultatet
  expect(result).toBe(expected);
});
```

### 2. Test Isolation
- Hver test skal være uavhengig
- Bruk `beforeEach` for å sette opp clean state
- Unngå å dele state mellom tester

### 3. Beskrivende navn
```typescript
// ❌ Dårlig
it('works', () => { ... });

// ✅ Bra
it('should return user data when authentication succeeds', () => { ... });
```

### 4. Mock eksterne avhengigheter
```typescript
import { vi } from 'vitest';

// Mock fetch
global.fetch = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({ data: 'test' }),
});
```

## 🔗 Nyttige lenker

- [Vitest Documentation](https://vitest.dev/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles/)
- [React Testing Recipes](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## 🆘 Hjelp

Hvis tester feiler:
1. Les feilmeldingen nøye
2. Sjekk at dependencies er oppdatert: `npm install`
3. Slett cache: `rm -rf node_modules/.vite`
4. Se på test reports i CI
5. Opprett en issue på GitHub hvis problemet vedvarer
