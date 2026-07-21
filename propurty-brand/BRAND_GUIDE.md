# Propurty brand guide — v0.1

This is a starter guide, scoped for getting the rebrand into the codebase
now. It covers what's needed to build with, not a full corporate identity
(no print/signage specs, no motion or sound branding, no legal trademark
filing). Revisit when a full company rebrand happens.

## 1. Brand basics

**Name**: Propurty
**One-line positioning**: Score homes on what actually matters to you, compare with confidence, and only tour the ones worth seeing in person.
**Tone**: plain-language, confident, unhyped. The product's whole premise is helping people avoid fooling themselves — the brand voice should reflect that same honesty rather than marketing hype.

Words to avoid in product copy: "seamless," "unlock," "empower," "revolutionize," "simply," "just." Say what the feature does instead of dressing it up.

Sentence case everywhere (buttons, headings, labels) — not Title Case, not ALL CAPS.

## 2. Logo

The primary mark is **Option A** from the earlier concept round: a rounded-square tile with a small roofline chevron sitting above a checkmark. It's the one direction that visually encodes what the product actually does — verifying and scoring a home — rather than being a generic house silhouette like most real-estate logos.

### Files (in `/logo`)

| File | Use |
|---|---|
| `propurty-icon-master.svg` | 512x512 master icon, source for all rasterized sizes |
| `propurty-icon.svg` | Icon mark at UI scale (64x64), for in-app use (nav bar, loading states) |
| `propurty-logotype-horizontal.svg` | Icon + wordmark, navy text — primary lockup for light backgrounds |
| `propurty-logotype-horizontal-dark.svg` | Icon + wordmark, white text — for dark/navy backgrounds |
| `propurty-wordmark.svg` | Text-only, navy — for contexts where the icon doesn't fit (legal docs, plain text) |
| `propurty-wordmark-white.svg` | Text-only, white — dark-background equivalent |
| `propurty-lockup-merged.svg` | **Secondary lockup.** The icon mark stands in for the letter P, immediately followed by "ropurty" — navy text, light backgrounds |
| `propurty-lockup-merged-dark.svg` | Same merged lockup, white text, for dark/brand-colored backgrounds |

The merged lockup is the tighter, more integrated option you asked for — it reads as one word rather than icon-plus-text, and it reinforces "P for Propurty" since the mark visually occupies the first letter's position. Use the side-by-side lockup (`propurty-logotype-horizontal.svg`) as the default everywhere (nav bars, headers, email signatures); reach for the merged version somewhere it can be the hero — an app splash screen, the App Store/Play Store listing header image, a landing page hero — anywhere a slightly bolder, more custom treatment is welcome rather than a workhorse header logo.

Rasterized icon sizes are in `/icons` (favicon.ico, apple-touch-icon, Android/PWA sizes, a maskable variant, and masters for both app stores — see the App store & PWA section below).

### Usage rules

- Minimum clear space around the icon: half the icon's own height on all sides.
- Minimum size: don't render the icon below 24px — at very small sizes (browser tab favicon) the mark reads as a simple checkmark, which is expected and fine.
- Don't recolor the icon tile. It's brand green with a white mark, full stop — no outline-only version, no single-color monochrome version for now.
- Don't stretch or skew the lockup. If horizontal space is tight, drop to the icon-only mark rather than compressing the wordmark.
- Don't place the light (navy-text) lockup on a dark or brand-green background, or the white lockup on a light background — use the matching variant.

### A note on the wordmark font

These SVGs reference Manrope with generic sans-serif fallbacks. Manrope isn't installed in the environment that generated these previews, so the rendered PNGs show a fallback system font — in an actual browser with the font loaded (see Typography below), the wordmark will render in Manrope as intended. Once the logo is truly final, it's worth converting the wordmark to outlined vector paths in a proper design tool (Figma/Illustrator/Inkscape) so it reproduces identically everywhere, independent of font availability.

## 3. Color palette

| Token | Hex | Use |
|---|---|---|
| Propurty green | `#106B49` | Primary brand color, icon mark, primary buttons, links |
| Green (hover) | `#0C4F37` | Hover/active state for primary green elements |
| Green tint | `#E4F2EC` | Light backgrounds for success states, subtle highlights |
| Navy (ink) | `#14192E` | Primary text, dark surfaces, header/nav background |
| Navy soft | `#2A3150` | Secondary dark surface, hover state on navy |
| Amber | `#E8A33D` | Accent only — sparingly, for a highlight or a single decorative detail (not a second primary color) |
| Gray 50–800 | see tokens file | Neutral backgrounds, borders, secondary/muted text |
| Danger | `#C6493F` | Errors only |

Green and navy carry the brand. Amber is a spark, not a workhorse — if more than one or two elements on a screen are amber, pull it back.

Full values with semantic names are in `/tokens/tokens.css` and `/tokens/tailwind.tokens.js`.

## 4. Typography

- **Headings**: Manrope, weight 700 (fall back to Plus Jakarta Sans, then system sans).
- **Body/UI text**: Inter, weights 400 and 500.
- Load both via Google Fonts or self-host — either is fine, self-hosting avoids a render-blocking external request if performance matters.

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500&family=Manrope:wght@600;700&display=swap" rel="stylesheet">
```

Type scale (also in `tokens.css`): 12 / 14 / 16 / 18 / 22 / 28 / 36 / 48px. Don't introduce sizes outside this scale — consistency here is one of the cheapest ways to make an app look deliberately designed rather than assembled ad hoc.

## 5. Spacing, radius, shadow

- Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64px. Pick from this list rather than arbitrary values.
- Radius: 8px for controls (buttons, inputs), 12px for cards, 20px for the icon tile specifically, 999px for pills/badges.
- Shadow: three levels only (sm/md/lg, defined in tokens.css) — don't hand-roll one-off box-shadow values per component.

## 6. Voice and tone quick reference

- Verb-first button labels, 1–3 words: "Create project," not "Click here to get started."
- Errors say what happened, then what to do: "Couldn't connect. Try again," not "Error: connection failed."
- Empty states are an invitation, not an apology: "Start your first search," not "Nothing here yet."
- Use "your" for the user's own things ("Your projects"), not "my."
- Contractions are fine and preferred — conversational, not stiff.
- No exclamation points on system copy. No "successfully" on confirmations — the confirmation itself is the success.

## 7. App store & PWA readiness

Everything needed to submit to both stores and pass web/PWA install checks, given the current logo — the pieces that genuinely can't be produced until the app itself exists (screenshots, previews) are called out separately.

### Web / PWA — done
- `manifest.json` (project root) — name, short_name, theme/background color, and icon references already wired to the files in `/icons`.
- `favicon.ico`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png`, `maskable-512.png` — all present in `/icons`.
- `og-image-1200x630.png` (in `/social`) — link-preview image for social shares and messaging apps.

### iOS — done
- `icons/ios/appstore-icon-1024.png` — the single 1024x1024 master Xcode needs (flat RGB, no alpha channel, no pre-applied corner rounding — iOS masks it into the squircle shape itself). Modern Xcode asset catalogs can generate every in-app icon size from this one file if you check "Single Size" on the App Icon asset.
- A splash/launch screen isn't a fixed image asset on modern iOS — implement it as a launch screen storyboard in Xcode: brand green (`#106B49`) or off-white (`#F8F7F4`) background with the icon mark centered, roughly 20% of screen width.

### iOS — still needed (can't be produced yet)
- App Store screenshots (6.7" iPhone required at minimum; iPad if you support it) — needs the actual built UI.
- App Store Connect listing text: app name ("Propurty" fits the 30-character limit easily), a subtitle (30 chars — draft below), description, keywords, support URL, marketing URL, privacy policy URL.
- Suggested subtitle: **"Score homes without the hype"** (28 characters) — edit freely, just note the limit.

### Android — done
- `icons/android/playstore-icon-512.png` — full-bleed 512x512 for the Play Console store listing.
- `icons/android/ic_launcher_foreground.png` — transparent-background mark, sized within the adaptive-icon safe zone, for the actual installed app icon.
- `icons/android/ic_launcher_background.xml` and `ic_launcher.xml` — native Android adaptive-icon resource files (color layer + XML combining foreground/background). If this ends up built with Expo/React Native rather than native Android, skip these two files and instead set `expo.android.adaptiveIcon.foregroundImage` to the foreground PNG and `backgroundColor` to `#106B49` directly in `app.json` — simpler, same visual result.
- `social/play-feature-graphic-1024x500.png` — the required Play Store feature graphic banner.

### Android — still needed (can't be produced yet)
- Play Store phone/tablet screenshots — needs the actual built UI.
- Play Console "Data safety" form and content rating questionnaire — these are policy declarations about what the app actually collects/does, not design assets; fill these out once the data model (contacts, photos, location) is finalized.
- Store listing text: short description (80 chars) and full description (4000 chars) — can reuse the App Store copy as a starting point.

## 8. What's intentionally not in this v0.1

- No print or signage specs (not needed yet).
- No motion/sound branding.
- No monochrome/single-color logo lockup — add one if the icon ever needs to appear on a busy photo background or in a context where full color isn't possible.
- No formal trademark filing has been done — a preliminary web search turned up no conflicting use of "Propurty," but that's not a substitute for a proper USPTO search before filing anything.

## Asset manifest

```
propurty-brand/
├── BRAND_GUIDE.md                        (this file)
├── manifest.json                         (PWA manifest, ready to drop at project root)
├── logo/
│   ├── propurty-icon-master.svg          (512 master, rounded tile)
│   ├── propurty-icon.svg                 (64px UI-scale icon)
│   ├── propurty-icon-fullbleed-source.svg (no rounding/transparency — app store icon source)
│   ├── propurty-icon-foreground-source.svg (mark only, transparent — Android adaptive source)
│   ├── propurty-logotype-horizontal.svg  (primary lockup, light)
│   ├── propurty-logotype-horizontal-dark.svg (primary lockup, dark)
│   ├── propurty-lockup-merged.svg        (secondary/merged lockup, light)
│   ├── propurty-lockup-merged-dark.svg   (secondary/merged lockup, dark)
│   ├── propurty-wordmark.svg             (text only, light)
│   └── propurty-wordmark-white.svg       (text only, dark)
├── icons/
│   ├── favicon.ico, favicon-16/32/48.png, apple-touch-icon.png
│   ├── icon-192.png, icon-512.png, icon-1024.png, maskable-512.png
│   ├── lockup-preview.png / lockup-dark-preview.png
│   ├── merged-preview.png / merged-dark-preview.png
│   ├── ios/appstore-icon-1024.png
│   └── android/playstore-icon-512.png, ic_launcher_foreground.png,
│         ic_launcher_background.xml, ic_launcher.xml
├── social/
│   ├── og-image-1200x630.png
│   └── play-feature-graphic-1024x500.png
└── tokens/
    ├── tokens.css                        (CSS custom properties)
    └── tailwind.tokens.js                (Tailwind theme.extend snippet)
```
