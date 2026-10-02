# V1 UI-AC-006 Screenshot Evidence Index

**Directory**: `apps/web/evidence/ui-r5/`
**Total Files**: 40 PNG screenshots
**Total Size**: ~3.5 MB
**Captured**: 2026-10-02T14:04Z
**Test**: ui-acceptance.spec.mjs:15

---

## Desktop Viewport (1280px)

### Light Theme - English
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-1280-light-en-75.png | 56K | 10189f8d |
| 100% | settings-1280-light-en-100.png | 80K | eb2b59d1 |
| 125% | settings-1280-light-en-125.png | 105K | 69322016 |
| 150% | settings-1280-light-en-150.png | 127K | 4c98d17a |
| 175% | settings-1280-light-en-175.png | 148K | 06f64c5f |

### Light Theme - Chinese
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-1280-light-zh-75.png | 55K | 34fc066c |
| 100% | settings-1280-light-zh-100.png | 75K | cbcc2f5f |
| 125% | settings-1280-light-zh-125.png | 99K | 98132642 |
| 150% | settings-1280-light-zh-150.png | 118K | 74e6b658 |
| 175% | settings-1280-light-zh-175.png | 139K | 1703aa30 |

### Dark Theme - English
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-1280-dark-en-75.png | 57K | 2a985b9d |
| 100% | settings-1280-dark-en-100.png | 81K | 1cdd2c42 |
| 125% | settings-1280-dark-en-125.png | 107K | 94048320 |
| 150% | settings-1280-dark-en-150.png | 130K | 291a18d8 |
| 175% | settings-1280-dark-en-175.png | 151K | a4521646 |

### Dark Theme - Chinese
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-1280-dark-zh-75.png | 55K | 0e194cf5 |
| 100% | settings-1280-dark-zh-100.png | 76K | c3c31092 |
| 125% | settings-1280-dark-zh-125.png | 100K | cf247f7d |
| 150% | settings-1280-dark-zh-150.png | 119K | 95638bd6 |
| 175% | settings-1280-dark-zh-175.png | 141K | e7e2b5d4 |

---

## Mobile Viewport (390px)

### Light Theme - English
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-390-light-en-75.png | 37K | 85fee2b1 |
| 100% | settings-390-light-en-100.png | 53K | 9e8b94f8 |
| 125% | settings-390-light-en-125.png | 68K | 5fb9f4a0 |
| 150% | settings-390-light-en-150.png | 82K | c88b7688 |
| 175% | settings-390-light-en-175.png | 97K | 292b15f0 |

### Light Theme - Chinese
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-390-light-zh-75.png | 36K | edef9e3c |
| 100% | settings-390-light-zh-100.png | 51K | 01db5f9b |
| 125% | settings-390-light-zh-125.png | 63K | cb11dd2d |
| 150% | settings-390-light-zh-150.png | 75K | 964e7f92 |
| 175% | settings-390-light-zh-175.png | 87K | eed78be5 |

### Dark Theme - English
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-390-dark-en-75.png | 38K | ddac2c04 |
| 100% | settings-390-dark-en-100.png | 54K | 33a0b5d6 |
| 125% | settings-390-dark-en-125.png | 70K | f61e1964 |
| 150% | settings-390-dark-en-150.png | 84K | 3352c635 |
| 175% | settings-390-dark-en-175.png | 99K | cd46b3eb |

### Dark Theme - Chinese
| Scale | Filename | Size | Hash (first 8 chars) |
|-------|----------|------|---------------------|
| 75% | settings-390-dark-zh-75.png | 37K | e5595522 |
| 100% | settings-390-dark-zh-100.png | 52K | 388fe5c3 |
| 125% | settings-390-dark-zh-125.png | 64K | 3df34f8c |
| 150% | settings-390-dark-zh-150.png | 77K | fe5645ef |
| 175% | settings-390-dark-zh-175.png | 89K | e8eb9637 |

---

## Verification

**Aggregate Hash**: `8eb6df98c5700f0f2ddaca0bec7d0f41c94d5f9552a37f4e09c6838151748ec0`

**Verify Command**:
```bash
shasum -a 256 apps/web/evidence/ui-r5/*.png | shasum -a 256
```

**Individual Hashes**: See `V1-UI-r5-manifest.json` for complete SHA-256 hashes

---

## Layout Validation Results

All 40 screenshots passed automated layout validation:

✅ **No horizontal scrollbar** (scrollWidth ≤ clientWidth + 2px)
✅ **Content within viewport bounds** (left ≥ -2px, right ≤ width + 2px)
✅ **Primary controls visible**:
   - Top navigation (.dgos-top)
   - Content area (.dgos-content)
   - Form controls (.dgos-content form)
   - Save button (explicitly verified)

---

## Coverage Matrix

| Dimension | Values | Count |
|-----------|--------|-------|
| Viewports | 1280px, 390px | 2 |
| Themes | light, dark | 2 |
| Languages | en, zh | 2 |
| Scales | 75%, 100%, 125%, 150%, 175% | 5 |
| **Total** | **2 × 2 × 2 × 5** | **40** |

---

## File Size Analysis

| Category | Min | Max | Avg |
|----------|-----|-----|-----|
| Desktop (1280px) | 55K | 151K | ~95K |
| Mobile (390px) | 36K | 99K | ~64K |
| Light theme | 36K | 148K | ~85K |
| Dark theme | 37K | 151K | ~89K |
| 75% scale | 36K | 57K | ~46K |
| 175% scale | 87K | 151K | ~119K |

**Observation**: File size increases with viewport size and scale percentage, as expected. Dark theme slightly larger due to text anti-aliasing on dark backgrounds.

---

## Usage Notes

- **Primary AC**: UI-AC-006 (Display Scaling) and UI-AC-001 (Theme Consistency)
- **Test Surface**: Settings page (`/settings` route)
- **Capture Method**: Playwright `.screenshot()` with `.dgos-shell` selector
- **API Mode**: Fixture (mocked responses via `page.route()`)
- **Test Duration**: 5.3 seconds for all 40 screenshots

---

**Generated**: 2026-10-02T14:04:28Z
**Related**: V1-UI-AC-EVIDENCE-COMPLETE.md
