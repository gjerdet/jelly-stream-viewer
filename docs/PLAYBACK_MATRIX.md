# Avspillingsmatrise (Playback Matrix)

Dette dokumentet beskriver hvordan Jelly Stream Viewer håndterer direkte avspilling vs. transkoding basert på format, codec, container, og nettleser.

## Oversikt

Jellyfin Stream Viewer bruker Jellyfin's innebygde transcoding-funksjonalitet når nødvendig. Applikasjonen forsøker alltid **Direct Play** først for å spare servere ressurser og redusere latency.

## Direkteavspilling (Direct Play)

Direkteavspilling brukes når:
1. Nettleseren støtter video codec
2. Nettleseren støtter audio codec
3. Container-formatet er kompatibelt
4. Ingen undertekster brenner inn (hardcoded)

### Fordeler med Direct Play
- Ingen server-belastning (ingen transcoding)
- Lavere latency
- Bedre kvalitet (ingen re-encoding)
- Lavere strømforbruk på server

### Ulemper med Direct Play
- Høyere båndbredde-krav
- Ikke alle formater støttes i alle nettlesere

---

## Støttede Formater

### Video Codecs

| Codec | Chrome | Firefox | Safari | Edge | Direct Play | Transcode |
|-------|--------|---------|--------|------|-------------|-----------|
| **H.264 (AVC)** | ✅ | ✅ | ✅ | ✅ | ✅ | Hvis inkompatibel profil |
| **H.265 (HEVC)** | ⚠️ | ❌ | ✅ | ⚠️ | Safari: ✅<br>Andre: ❌ | ✅ |
| **VP9** | ✅ | ✅ | ⚠️ | ✅ | Chrome/Firefox/Edge: ✅ | På Safari |
| **AV1** | ✅ | ✅ | ❌ | ✅ | Moderne Chrome/Firefox: ✅ | På eldre |
| **MPEG-4 (xvid, divx)** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | ❌ | ✅ |
| **MPEG-2** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **VC-1** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

**Legende:**
- ✅ = Full støtte
- ⚠️ = Delvis støtte / avhenger av versjon
- ❌ = Ingen støtte

### Audio Codecs

| Codec | Chrome | Firefox | Safari | Edge | Direct Play | Transcode |
|-------|--------|---------|--------|------|-------------|-----------|
| **AAC** | ✅ | ✅ | ✅ | ✅ | ✅ | Hvis inkompatibel profil |
| **MP3** | ✅ | ✅ | ✅ | ✅ | ✅ | Sjelden nødvendig |
| **Opus** | ✅ | ✅ | ⚠️ | ✅ | Chrome/Firefox/Edge: ✅ | På Safari |
| **Vorbis** | ✅ | ✅ | ❌ | ✅ | Chrome/Firefox/Edge: ✅ | På Safari |
| **AC3 (Dolby Digital)** | ❌ | ❌ | ✅ | ❌ | Safari: ✅<br>Andre: ❌ | ✅ |
| **EAC3 (Dolby Digital Plus)** | ❌ | ❌ | ✅ | ❌ | Safari: ✅<br>Andre: ❌ | ✅ |
| **DTS** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **TrueHD** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| **FLAC** | ✅ | ✅ | ✅ | ✅ | ✅ | Sjelden nødvendig |

### Containers

| Container | Chrome | Firefox | Safari | Edge | Direct Play | Notes |
|-----------|--------|---------|--------|------|-------------|-------|
| **MP4** | ✅ | ✅ | ✅ | ✅ | ✅ | Beste kompatibilitet |
| **WebM** | ✅ | ✅ | ⚠️ | ✅ | Chrome/Firefox/Edge: ✅ | Safari krever transcode |
| **MKV** | ⚠️ | ⚠️ | ❌ | ⚠️ | ❌ | Må remuxes til MP4 |
| **AVI** | ❌ | ❌ | ❌ | ❌ | ❌ | Må transkodes |
| **TS** | ⚠️ | ⚠️ | ⚠️ | ⚠️ | HLS/DASH streaming | Brukes for live TV |
| **OGG** | ✅ | ✅ | ❌ | ✅ | Chrome/Firefox/Edge: ✅ | Safari krever transcode |

---

## Transcoding Beslutningstre

```
┌─────────────────────────────┐
│   Forespørsel om avspilling │
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│ Sjekk: Nettleser støtter video codec? │
└──────┬──────────────────────┬───────┘
       │ JA                   │ NEI
       ▼                      ▼
┌──────────────────┐   ┌──────────────┐
│ Sjekk audio codec│   │  TRANSCODE   │
└──────┬───────────┘   │  (H.264 + AAC)│
       │ JA            └──────────────┘
       ▼
┌─────────────────────┐
│ Sjekk container     │
└──────┬──────────────┘
       │ Støttet
       ▼
┌─────────────────────┐
│ Sjekk undertekster  │
└──────┬──────────────┘
       │ Ingen eller VTT
       ▼
┌─────────────────────┐
│   DIRECT PLAY ✅    │
└─────────────────────┘
```

---

## Transcoding-innstillinger

Når transcoding er nødvendig, bruker Jelly Stream Viewer følgende innstillinger via Jellyfin API:

### Video Transcoding
```
Codec: H.264 (libx264)
Profil: Main/High
Level: 4.1
Preset: veryfast (for lavere latency)
CRF: 23 (balanse mellom kvalitet og størrelse)
Bitrate: Dynamisk basert på original + nettverksbåndbredde
```

### Audio Transcoding
```
Codec: AAC (aac)
Bitrate: 128-192 kbps (stereo)
Sample Rate: 48 kHz
Channels: Opprettholdes (stereo/5.1 → stereo downmix om nødvendig)
```

### Streaming Protocol
```
HLS (HTTP Live Streaming) for adaptiv bitrate
Segment lengde: 6 sekunder
Buffer: 3 segmenter (18 sekunder)
```

---

## Bitrate Beslutninger

| Oppløsning | Direct Play Bitrate | Transcode Bitrate | Anbefalt Båndbredde |
|------------|---------------------|-------------------|---------------------|
| 4K (2160p) | Original (50-100 Mbps) | 15-25 Mbps | 30+ Mbps |
| 1080p | Original (10-20 Mbps) | 8-12 Mbps | 15+ Mbps |
| 720p | Original (5-10 Mbps) | 4-6 Mbps | 8+ Mbps |
| 480p | Original (2-5 Mbps) | 2-3 Mbps | 5+ Mbps |

**Automatisk kvalitetsjustering:**
- Jellyfin måler nettverksbåndbredde
- Justerer bitrate dynamisk ved buffering
- Fallback til lavere oppløsning ved treg forbindelse

---

## Undertekst-håndtering

### VTT (WebVTT) - Direct Play
- Native browser support
- Ingen transcoding nødvendig
- Lav CPU-bruk

### SRT (SubRip) - Konvertering
- Konverteres til VTT on-the-fly
- Ingen video transcoding nødvendig
- Hurtig konvertering

### ASS/SSA (Hardcoded) - Transcoding
- Krever innbrenning av undertekster
- Tvinger video transcoding
- Høy CPU-bruk
- Brukes kun når nødvendig

### PGS (Blu-ray) - Transcoding
- Bilde-baserte undertekster
- Må brennes inn i video
- Høy CPU-bruk

**Anbefaling:** Bruk VTT eller SRT for best ytelse.

---

## Optimalisering for Server

### Reduser Transcoding-belastning

1. **Forhåndskonverter media til H.264 + AAC + MP4**
   ```bash
   ffmpeg -i input.mkv -c:v libx264 -preset medium -crf 23 \
          -c:a aac -b:a 192k -movflags +faststart output.mp4
   ```

2. **Bruk hardware-akselerasjon i Jellyfin**
   - Intel Quick Sync (QSV)
   - NVIDIA NVENC
   - AMD VCE
   - VAAPI (Linux)

3. **Juster Jellyfin transcoding settings**
   - Enable hardware acceleration
   - Set lower CRF for better quality (higher CPU)
   - Set higher CRF for faster encoding (lower CPU)

4. **Bruk SSD for transcode cache**
   - Reduserer I/O latency
   - Bedre ytelse under høy load

---

## Feilsøking Avspillingsproblemer

### Videoer buffrer konstant
**Årsaker:**
- Transcoding er for treg for nettverkshastighet
- Server CPU overload
- Nettverksbåndbredde for lav

**Løsninger:**
1. Reduser avspillingskvalitet manuelt
2. Aktiver hardware-akselerasjon
3. Oppgrader server CPU/GPU
4. Sjekk nettverksbåndbredde

### Ingen lyd i nettleseren
**Årsaker:**
- Audio codec ikke støttet (AC3, DTS)
- Manglende transkoding

**Løsninger:**
1. Jellyfin skal automatisk transkode audio
2. Sjekk Jellyfin logs for feilmeldinger
3. Test i annen nettleser (Safari støtter AC3)

### Undertekster vises ikke
**Årsaker:**
- Codec ikke støttet (ASS/SSA/PGS)
- Undertekstfil mangler

**Løsninger:**
1. Velg annen underteksttrack (VTT/SRT)
2. Aktiver "Burn subtitles" i Jellyfin (tvinger transcoding)
3. Last opp undertekster i SRT/VTT format

### Video fungerer i Safari men ikke Chrome
**Årsak:** HEVC video (H.265)

**Løsning:**
- Chrome transcoder automatisk til H.264
- Sjekk at transcoding er aktivert i Jellyfin

---

## Anbefalte Videoformater

For best kompatibilitet på tvers av nettlesere:

### Optimalt format
```
Container: MP4
Video: H.264 (Main/High profile, level 4.1)
Audio: AAC (192 kbps, stereo eller 5.1)
Undertekster: VTT eller SRT (external)
```

### Moderne format (når nettleseren støtter)
```
Container: WebM
Video: VP9 eller AV1
Audio: Opus (128-160 kbps)
Undertekster: VTT
```

### Unngå disse formatene (krever alltid transcoding)
```
Video: MPEG-2, VC-1, MPEG-4 (DivX/Xvid)
Audio: DTS, TrueHD, AC3 (unntatt Safari)
Container: AVI, MKV (uten remux)
Undertekster: ASS/SSA, PGS
```

---

## Testing Matrix

Test avspilling med disse videoene for å verifisere kompatibilitet:

| Testfil | Codec | Container | Forventet resultat |
|---------|-------|-----------|-------------------|
| H264_AAC.mp4 | H.264 + AAC | MP4 | Direct Play |
| HEVC_AAC.mp4 | H.265 + AAC | MP4 | Transcode (ikke Safari) |
| VP9_Opus.webm | VP9 + Opus | WebM | Direct Play (ikke Safari) |
| AC3_Audio.mkv | H.264 + AC3 | MKV | Transcode audio + remux |
| DTS_Audio.mkv | H.264 + DTS | MKV | Full transcode |
| 4K_HDR.mkv | H.265 HDR + TrueHD | MKV | Full transcode |

---

## Ytterligere Ressurser

- [Jellyfin Codec Support](https://jellyfin.org/docs/general/clients/codec-support.html)
- [Browser Video Format Support](https://caniuse.com/?search=video)
- [FFmpeg Documentation](https://ffmpeg.org/documentation.html)
- [HLS Streaming Protocol](https://developer.apple.com/streaming/)

---

**Sist oppdatert:** 2025-01-13
**Vedlikeholdes av:** Jelly Stream Viewer utviklere
