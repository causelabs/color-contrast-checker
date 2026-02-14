# Color Contrast Checker

A zero-dependency, WCAG 2.2 compliant color contrast checker that helps designers and developers find accessible color combinations.

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**[Live Demo](https://www.causelabs.com/contrast-checker/)**

## Features

- **Real-time contrast checking** against WCAG 2.2 Level A, AA, and AAA standards
- **Automatic color suggestions** when combinations fail — finds the nearest accessible variation of your background color
- **Universal color finder** — discovers background colors that work with both light AND dark text simultaneously
- **Copy to clipboard** with one click
- **Zero dependencies** — pure vanilla HTML, CSS, and JavaScript (~50KB total)
- **Fully accessible** — keyboard navigable, screen reader friendly, respects `prefers-reduced-motion`

## WCAG Compliance

This tool checks contrast ratios for normal text:

| Level | Required Ratio |
|-------|----------------|
| A     | 3:1            |
| AA    | 4.5:1          |
| AAA   | 7:1            |

The tool itself is built to WCAG 2.2 AA standards:

- Skip link for keyboard navigation (2.4.1)
- Focus indicators with 3px solid outline (2.4.7, 2.4.13)
- Minimum 44x44px touch targets (2.5.8)
- Color not used as sole indicator (1.4.1) — uses checkmarks/X symbols alongside pass/fail
- All UI colors checked for AA contrast compliance

## How It Works

1. Enter a **background color** (hex format)
2. Optionally adjust **light text** and **dark text** colors
3. Select your target **WCAG level** (A, AA, or AAA)
4. View instant results:
   - **With Light Text** — contrast ratio and pass/fail status
   - **With Dark Text** — contrast ratio and pass/fail status
   - **Universal Color** — a background variation that works with both

When a combination fails, the tool suggests the nearest accessible color by adjusting the background lightness while preserving hue and saturation.

## Technical Details

### Color Suggestion Algorithm

The tool uses HSL color space for perceptual manipulation:

1. Convert hex to HSL
2. Binary search on lightness (L) to find the nearest passing value
3. Preserve original hue and saturation
4. For universal colors: find L where BOTH light and dark text pass simultaneously

### Luminance Calculation

Per WCAG 2.2 specification:

```javascript
function getLuminance(r, g, b) {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}
```

### Contrast Ratio Formula

```
ratio = (L1 + 0.05) / (L2 + 0.05)
```

Where L1 is the lighter color's luminance and L2 is the darker.

## Installation

No build step required. Simply clone and serve:

```bash
git clone https://github.com/MikeGillihan/color-contrast-checker.git
cd color-contrast-checker
# Serve with any static server, e.g.:
npx serve .
```

Or just open `index.html` in your browser.

## File Structure

```
├── index.html    # Semantic HTML structure
├── styles.css    # CSS with custom properties for theming
├── app.js        # All logic: contrast calc, color conversion, suggestions
└── .htaccess     # Apache config (if needed)
```

## Browser Support

Works in all modern browsers (Chrome, Firefox, Safari, Edge). Uses:

- CSS custom properties
- CSS `:has()` selector
- Clipboard API (with fallback)
- ES6+ JavaScript

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Author

**Michael Gillihan** — [GitHub](https://github.com/MikeGillihan)

## License

MIT License — see [LICENSE](LICENSE) for details.

## Acknowledgments

- [WCAG 2.2 Guidelines](https://www.w3.org/WAI/WCAG22/Understanding/)
- [Understanding Contrast Minimum](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html)
