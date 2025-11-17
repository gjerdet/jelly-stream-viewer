import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateJellyfin, searchSubtitles, downloadSubtitle } from '../jellyfinClient';

describe('jellyfinClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
  });

  describe('authenticateJellyfin', () => {
    it('should authenticate successfully with valid credentials', async () => {
      const mockResponse = {
        AccessToken: 'test-token',
        ServerId: 'test-server',
        User: { Id: 'user-1', Name: 'Test User' },
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await authenticateJellyfin(
        'http://localhost:8096',
        'testuser',
        'testpass'
      );

      expect(result).toEqual(mockResponse);
      expect(global.fetch).toHaveBeenCalledWith(
        'http://localhost:8096/Users/AuthenticateByName',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    it('should throw error with invalid credentials', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      });

      await expect(
        authenticateJellyfin('http://localhost:8096', 'baduser', 'badpass')
      ).rejects.toThrow('Autentisering feilet');
    });
  });

  describe('searchSubtitles', () => {
    it('should search subtitles successfully', async () => {
      const mockSubtitles = [
        { Id: 'sub1', Name: 'English', ProviderName: 'OpenSubtitles' },
      ];

      localStorage.setItem(
        'jellyfin_session',
        JSON.stringify({ AccessToken: 'test-token' })
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => mockSubtitles,
      });

      const result = await searchSubtitles('http://localhost:8096', 'item-1');

      expect(result).toEqual(mockSubtitles);
    });

    it('should throw error when not authenticated', async () => {
      await expect(
        searchSubtitles('http://localhost:8096', 'item-1')
      ).rejects.toThrow('Ikke logget inn');
    });
  });

  describe('downloadSubtitle', () => {
    it('should download subtitle successfully', async () => {
      localStorage.setItem(
        'jellyfin_session',
        JSON.stringify({ AccessToken: 'test-token' })
      );

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({}),
      });

      const result = await downloadSubtitle(
        'http://localhost:8096',
        'item-1',
        'sub-1'
      );

      expect(result).toEqual({
        success: true,
        message: 'Undertekst lastet ned',
      });
    });
  });
});
