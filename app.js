/**
 * Color Contrast Checker - Main Application
 * 
 * Provides WCAG-compliant color contrast checking and suggests
 * accessible color alternatives when combinations fail.
 */

(function() {
  'use strict';

  /* ============================================
     Constants
     ============================================ */

  /**
   * WCAG contrast ratio requirements for normal text.
   * Large text (18pt+ or 14pt bold) has lower requirements,
   * but we use normal text ratios as the stricter standard.
   */
  const WCAG_RATIOS = {
    'A': 3,
    'AA': 4.5,
    'AAA': 7
  };

  /**
   * Debounce delay for input handlers (milliseconds).
   */
  const DEBOUNCE_DELAY = 100;

  /**
   * Binary search precision for finding accessible colors.
   */
  const SEARCH_PRECISION = 0.001;

  /* ============================================
     Color Utility Functions
     ============================================ */

  /**
   * Validates a hex color string.
   * 
   * @param {string} hex - The hex color string to validate
   * @returns {boolean} True if valid hex color
   */
  function isValidHex(hex) {
    return /^#[0-9A-Fa-f]{6}$/.test(hex);
  }

  /**
   * Normalizes a hex input (adds # if missing, handles 3-char hex, fixes double ##).
   * 
   * @param {string} hex - The hex color string to normalize
   * @returns {string} Normalized 6-character hex with #
   */
  function normalizeHex(hex) {
    let cleaned = hex.trim().toUpperCase();
    
    // Remove all # symbols and re-add single one
    cleaned = cleaned.replace(/^#+/, '');
    cleaned = '#' + cleaned;
    
    // Expand 3-character hex
    if (/^#[0-9A-Fa-f]{3}$/.test(cleaned)) {
      cleaned = '#' + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2] + cleaned[3] + cleaned[3];
    }
    
    return cleaned;
  }

  /**
   * Converts a hex color to RGB components.
   * 
   * @param {string} hex - The hex color string (#RRGGBB)
   * @returns {{r: number, g: number, b: number}} RGB values (0-255)
   */
  function hexToRgb(hex) {
    const result = /^#([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/.exec(hex);
    if (!result) {
      return null;
    }
    return {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    };
  }

  /**
   * Converts RGB values to a hex color string.
   * 
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} Hex color string (#RRGGBB)
   */
  function rgbToHex(r, g, b) {
    const toHex = (c) => {
      const hex = Math.round(Math.max(0, Math.min(255, c))).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return '#' + toHex(r) + toHex(g) + toHex(b);
  }

  /**
   * Converts RGB values to HSL.
   * 
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {{h: number, s: number, l: number}} HSL values (h: 0-360, s: 0-1, l: 0-1)
   */
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;

    let h = 0;
    let s = 0;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s, l };
  }

  /**
   * Converts HSL values to RGB.
   * 
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-1)
   * @param {number} l - Lightness (0-1)
   * @returns {{r: number, g: number, b: number}} RGB values (0-255)
   */
  function hslToRgb(h, s, l) {
    h /= 360;

    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255)
    };
  }

  /**
   * Converts a hex color to HSL.
   * 
   * @param {string} hex - The hex color string
   * @returns {{h: number, s: number, l: number}|null} HSL values or null if invalid
   */
  function hexToHsl(hex) {
    const rgb = hexToRgb(hex);
    if (!rgb) return null;
    return rgbToHsl(rgb.r, rgb.g, rgb.b);
  }

  /**
   * Converts HSL to hex color string.
   * 
   * @param {number} h - Hue (0-360)
   * @param {number} s - Saturation (0-1)
   * @param {number} l - Lightness (0-1)
   * @returns {string} Hex color string
   */
  function hslToHex(h, s, l) {
    const rgb = hslToRgb(h, s, l);
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }

  /* ============================================
     WCAG Contrast Calculation
     ============================================ */

  /**
   * Calculates the relative luminance of a color per WCAG 2.2.
   * 
   * @see https://www.w3.org/TR/WCAG21/#dfn-relative-luminance
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {number} Relative luminance (0-1)
   */
  function getLuminance(r, g, b) {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  }

  /**
   * Calculates the contrast ratio between two colors.
   * 
   * @see https://www.w3.org/TR/WCAG21/#dfn-contrast-ratio
   * @param {string} hex1 - First hex color
   * @param {string} hex2 - Second hex color
   * @returns {number} Contrast ratio (1-21)
   */
  function getContrastRatio(hex1, hex2) {
    const rgb1 = hexToRgb(hex1);
    const rgb2 = hexToRgb(hex2);

    if (!rgb1 || !rgb2) return 1;

    const l1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
    const l2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);

    const lighter = Math.max(l1, l2);
    const darker = Math.min(l1, l2);

    return (lighter + 0.05) / (darker + 0.05);
  }

  /**
   * Checks if a contrast ratio meets the specified WCAG level.
   * 
   * @param {number} ratio - The contrast ratio to check
   * @param {string} level - WCAG level ('A', 'AA', or 'AAA')
   * @returns {boolean} True if the ratio meets the level requirement
   */
  function meetsWcagLevel(ratio, level) {
    return ratio >= WCAG_RATIOS[level];
  }

  /* ============================================
     Accessible Color Finder
     ============================================ */

  /**
   * Finds the nearest accessible variation of a background color
   * that meets the required contrast ratio with a given text color.
   * 
   * Uses binary search on HSL lightness to find the closest match
   * while preserving hue and saturation.
   * 
   * @param {string} bgHex - Background color hex
   * @param {string} textHex - Text color hex
   * @param {number} targetRatio - Required contrast ratio
   * @returns {string|null} Accessible hex color or null if impossible
   */
  function findAccessibleColor(bgHex, textHex, targetRatio) {
    const bgHsl = hexToHsl(bgHex);
    const textRgb = hexToRgb(textHex);
    
    if (!bgHsl || !textRgb) return null;

    const textLuminance = getLuminance(textRgb.r, textRgb.g, textRgb.b);
    const currentRatio = getContrastRatio(bgHex, textHex);

    // Already passes
    if (currentRatio >= targetRatio) {
      return bgHex;
    }

    // Determine search direction based on text luminance
    // Dark text (low luminance) needs lighter background
    // Light text (high luminance) needs darker background
    const textIsLight = textLuminance > 0.5;

    let low, high;
    if (textIsLight) {
      // Search toward darker (lower L)
      low = 0;
      high = bgHsl.l;
    } else {
      // Search toward lighter (higher L)
      low = bgHsl.l;
      high = 1;
    }

    // Binary search for the nearest accessible lightness
    let bestL = null;
    let iterations = 0;
    const maxIterations = 50;

    while (high - low > SEARCH_PRECISION && iterations < maxIterations) {
      const mid = (low + high) / 2;
      const testHex = hslToHex(bgHsl.h, bgHsl.s, mid);
      const testRatio = getContrastRatio(testHex, textHex);

      if (testRatio >= targetRatio) {
        bestL = mid;
        // Try to get closer to original
        if (textIsLight) {
          low = mid;
        } else {
          high = mid;
        }
      } else {
        // Need more contrast
        if (textIsLight) {
          high = mid;
        } else {
          low = mid;
        }
      }
      iterations++;
    }

    // If no valid lightness found in the preferred direction,
    // try the opposite direction
    if (bestL === null) {
      if (textIsLight) {
        low = bgHsl.l;
        high = 1;
      } else {
        low = 0;
        high = bgHsl.l;
      }

      while (high - low > SEARCH_PRECISION && iterations < maxIterations * 2) {
        const mid = (low + high) / 2;
        const testHex = hslToHex(bgHsl.h, bgHsl.s, mid);
        const testRatio = getContrastRatio(testHex, textHex);

        if (testRatio >= targetRatio) {
          bestL = mid;
          if (textIsLight) {
            high = mid;
          } else {
            low = mid;
          }
        } else {
          if (textIsLight) {
            low = mid;
          } else {
            high = mid;
          }
        }
        iterations++;
      }
    }

    if (bestL !== null) {
      return hslToHex(bgHsl.h, bgHsl.s, bestL);
    }

    // Last resort: pure black or white
    const blackRatio = getContrastRatio('#000000', textHex);
    const whiteRatio = getContrastRatio('#ffffff', textHex);
    
    if (blackRatio >= targetRatio) return '#000000';
    if (whiteRatio >= targetRatio) return '#ffffff';
    
    return null;
  }

  /**
   * Finds the highest lightness L where contrast with light text passes.
   * (Light text needs darker background, so we find the upper bound of valid L.)
   */
  function findMaxLForLightText(bgHsl, lightTextHex, targetRatio) {
    let low = 0;
    let high = 1;
    let bestL = null;
    for (let i = 0; i < 50; i++) {
      if (high - low <= SEARCH_PRECISION) break;
      const mid = (low + high) / 2;
      const ratio = getContrastRatio(hslToHex(bgHsl.h, bgHsl.s, mid), lightTextHex);
      if (ratio >= targetRatio) {
        bestL = mid;
        low = mid;
      } else {
        high = mid;
      }
    }
    return bestL;
  }

  /**
   * Finds the lowest lightness L where contrast with dark text passes.
   * (Dark text needs lighter background, so we find the lower bound of valid L.)
   */
  function findMinLForDarkText(bgHsl, darkTextHex, targetRatio) {
    let low = 0;
    let high = 1;
    let bestL = null;
    for (let i = 0; i < 50; i++) {
      if (high - low <= SEARCH_PRECISION) break;
      const mid = (low + high) / 2;
      const ratio = getContrastRatio(hslToHex(bgHsl.h, bgHsl.s, mid), darkTextHex);
      if (ratio >= targetRatio) {
        bestL = mid;
        high = mid;
      } else {
        low = mid;
      }
    }
    return bestL;
  }

  /**
   * Finds a universal color that works with both light and dark text.
   * Uses the same binary-search approach as findAccessibleColor for consistency.
   * 
   * @param {string} bgHex - Original background color hex
   * @param {string} lightTextHex - Light text color hex
   * @param {string} darkTextHex - Dark text color hex
   * @param {number} targetRatio - Required contrast ratio
   * @returns {{hex: string, lightRatio: number, darkRatio: number}|null}
   */
  function findUniversalColor(bgHex, lightTextHex, darkTextHex, targetRatio) {
    const bgHsl = hexToHsl(bgHex);
    if (!bgHsl) return null;

    const brandLightRatio = getContrastRatio(bgHex, lightTextHex);
    const brandDarkRatio = getContrastRatio(bgHex, darkTextHex);
    if (brandLightRatio >= targetRatio && brandDarkRatio >= targetRatio) {
      return {
        hex: bgHex.toUpperCase(),
        lightRatio: brandLightRatio,
        darkRatio: brandDarkRatio
      };
    }

    const originalL = bgHsl.l;
    const L_light_max = findMaxLForLightText(bgHsl, lightTextHex, targetRatio);
    const L_dark_min = findMinLForDarkText(bgHsl, darkTextHex, targetRatio);

    if (L_light_max === null || L_dark_min === null || L_dark_min > L_light_max) {
      return null;
    }

    // Valid range: [L_dark_min, L_light_max]. Pick L closest to original.
    const bestL = Math.max(L_dark_min, Math.min(L_light_max, originalL));
    const bestHex = hslToHex(bgHsl.h, bgHsl.s, bestL);
    return {
      hex: bestHex.toUpperCase(),
      lightRatio: getContrastRatio(bestHex, lightTextHex),
      darkRatio: getContrastRatio(bestHex, darkTextHex)
    };
  }

  /* ============================================
     UI Management
     ============================================ */

  /**
   * DOM element cache for performance.
   */
  const elements = {};

  /**
   * Caches DOM elements for faster access.
   */
  function cacheElements() {
    // Inputs
    elements.bgColor = document.getElementById('bg-color');
    elements.bgColorPicker = document.getElementById('bg-color-picker');
    elements.lightText = document.getElementById('light-text');
    elements.lightTextPicker = document.getElementById('light-text-picker');
    elements.darkText = document.getElementById('dark-text');
    elements.darkTextPicker = document.getElementById('dark-text-picker');
    elements.wcagRadios = document.querySelectorAll('input[name="wcag-level"]');

    // Brand / Light results
    elements.lightPreview1 = document.getElementById('light-preview-1');
    elements.lightPreview2 = document.getElementById('light-preview-2');
    elements.lightPreviewText1 = document.getElementById('light-preview-text-1');
    elements.lightPreviewText2 = document.getElementById('light-preview-text-2');
    elements.lightRatio = document.getElementById('light-ratio');
    elements.lightStatus = document.getElementById('light-status');
    elements.lightSuggestion = document.getElementById('light-suggestion');
    elements.lightSuggestedPreview = document.getElementById('light-suggested-preview');
    elements.lightSuggestedText = document.getElementById('light-suggested-text');
    elements.lightSuggestedHex = document.getElementById('light-suggested-hex');
    elements.lightSuggestedRatio = document.getElementById('light-suggested-ratio');
    elements.lightCopy = document.getElementById('light-copy');

    // Brand / Dark results
    elements.darkPreview1 = document.getElementById('dark-preview-1');
    elements.darkPreview2 = document.getElementById('dark-preview-2');
    elements.darkPreviewText1 = document.getElementById('dark-preview-text-1');
    elements.darkPreviewText2 = document.getElementById('dark-preview-text-2');
    elements.darkRatio = document.getElementById('dark-ratio');
    elements.darkStatus = document.getElementById('dark-status');
    elements.darkSuggestion = document.getElementById('dark-suggestion');
    elements.darkSuggestedPreview = document.getElementById('dark-suggested-preview');
    elements.darkSuggestedText = document.getElementById('dark-suggested-text');
    elements.darkSuggestedHex = document.getElementById('dark-suggested-hex');
    elements.darkSuggestedRatio = document.getElementById('dark-suggested-ratio');
    elements.darkCopy = document.getElementById('dark-copy');

    // Universal results
    elements.universalPreviewLight = document.getElementById('universal-preview-light');
    elements.universalPreviewDark = document.getElementById('universal-preview-dark');
    elements.universalLightText = document.getElementById('universal-light-text');
    elements.universalDarkText = document.getElementById('universal-dark-text');
    elements.universalHex = document.getElementById('universal-hex');
    elements.universalLightRatio = document.getElementById('universal-light-ratio');
    elements.universalDarkRatio = document.getElementById('universal-dark-ratio');
    elements.universalInfo = document.getElementById('universal-info');
    elements.universalSuccess = document.getElementById('universal-success');
    elements.universalInfoMsg = document.getElementById('universal-info-msg');
    elements.universalPreviewGroup = document.getElementById('universal-preview-group');
    elements.noUniversal = document.getElementById('no-universal');
    elements.universalCopy = document.getElementById('universal-copy');

    // Error messages
    elements.bgColorError = document.getElementById('bg-color-error');
    elements.lightTextError = document.getElementById('light-text-error');
    elements.darkTextError = document.getElementById('dark-text-error');

    // Toast
    elements.toast = document.getElementById('toast');
  }

  /**
   * Validates a hex input and updates its error message.
   * 
   * @param {HTMLInputElement} input - The hex input element
   * @param {HTMLElement} errorEl - The error message element
   * @returns {boolean} True if valid
   */
  function validateHexInput(input, errorEl) {
    const normalized = normalizeHex(input.value);
    const isValid = isValidHex(normalized);
    
    if (input.value.trim() === '') {
      errorEl.textContent = 'Color is required';
      input.setAttribute('aria-invalid', 'true');
      return false;
    } else if (!isValid) {
      errorEl.textContent = 'Invalid hex format (use #RRGGBB)';
      input.setAttribute('aria-invalid', 'true');
      return false;
    } else {
      errorEl.textContent = '';
      input.setAttribute('aria-invalid', 'false');
      return true;
    }
  }

  /**
   * Gets the currently selected WCAG level.
   * 
   * @returns {string} The selected WCAG level ('A', 'AA', or 'AAA')
   */
  function getSelectedWcagLevel() {
    const checked = document.querySelector('input[name="wcag-level"]:checked');
    return checked ? checked.value : 'AA';
  }

  /**
   * Formats a contrast ratio for display.
   * 
   * @param {number} ratio - The contrast ratio
   * @returns {string} Formatted ratio string
   */
  function formatRatio(ratio) {
    return ratio.toFixed(2) + ':1';
  }

  /**
   * Shows a toast notification.
   * 
   * @param {string} message - The message to display
   */
  function showToast(message) {
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    elements.toast.classList.add('visible');

    setTimeout(() => {
      elements.toast.classList.remove('visible');
      setTimeout(() => {
        elements.toast.hidden = true;
      }, 250);
    }, 2000);
  }

  /**
   * Copies text to clipboard and shows toast.
   * 
   * @param {string} text - Text to copy
   */
  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied to clipboard!');
    } catch (err) {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      showToast('Copied to clipboard!');
    }
  }

  /**
   * Updates all results based on current input values.
   */
  function updateResults() {
    // Validate all inputs and show error messages per WCAG 3.3.1
    const bgValid = validateHexInput(elements.bgColor, elements.bgColorError);
    const lightValid = validateHexInput(elements.lightText, elements.lightTextError);
    const darkValid = validateHexInput(elements.darkText, elements.darkTextError);

    // Don't proceed if any input is invalid
    if (!bgValid || !lightValid || !darkValid) {
      return;
    }

    const bgHex = normalizeHex(elements.bgColor.value);
    const lightHex = normalizeHex(elements.lightText.value);
    const darkHex = normalizeHex(elements.darkText.value);
    const wcagLevel = getSelectedWcagLevel();
    const targetRatio = WCAG_RATIOS[wcagLevel];

    // Calculate contrast ratios
    const lightRatio = getContrastRatio(bgHex, lightHex);
    const darkRatio = getContrastRatio(bgHex, darkHex);
    const lightPasses = meetsWcagLevel(lightRatio, wcagLevel);
    const darkPasses = meetsWcagLevel(darkRatio, wcagLevel);

    // Update Brand / Light results
    // Swatch 1: Light text on Brand bg; Swatch 2: Brand text on Light bg
    elements.lightPreview1.style.backgroundColor = bgHex;
    elements.lightPreviewText1.style.color = lightHex;
    elements.lightPreview2.style.backgroundColor = lightHex;
    elements.lightPreviewText2.style.color = bgHex;
    elements.lightRatio.textContent = formatRatio(lightRatio);
    elements.lightStatus.textContent = lightPasses ? '\u2713 Pass' : '\u2717 Fail';
    elements.lightStatus.className = 'pass-fail ' + (lightPasses ? 'pass' : 'fail');

    if (lightPasses) {
      elements.lightSuggestion.hidden = true;
    } else {
      const lightSuggested = findAccessibleColor(bgHex, lightHex, targetRatio);
      if (lightSuggested) {
        elements.lightSuggestion.hidden = false;
        elements.lightSuggestedPreview.style.backgroundColor = lightSuggested;
        elements.lightSuggestedText.style.color = lightHex;
        elements.lightSuggestedHex.textContent = lightSuggested.toUpperCase();
        const suggestedRatio = getContrastRatio(lightSuggested, lightHex);
        elements.lightSuggestedRatio.textContent = formatRatio(suggestedRatio);
      } else {
        elements.lightSuggestion.hidden = true;
      }
    }

    // Update Brand / Dark results
    // Swatch 1: Dark text on Brand bg; Swatch 2: Brand text on Dark bg
    elements.darkPreview1.style.backgroundColor = bgHex;
    elements.darkPreviewText1.style.color = darkHex;
    elements.darkPreview2.style.backgroundColor = darkHex;
    elements.darkPreviewText2.style.color = bgHex;
    elements.darkRatio.textContent = formatRatio(darkRatio);
    elements.darkStatus.textContent = darkPasses ? '\u2713 Pass' : '\u2717 Fail';
    elements.darkStatus.className = 'pass-fail ' + (darkPasses ? 'pass' : 'fail');

    if (darkPasses) {
      elements.darkSuggestion.hidden = true;
    } else {
      const darkSuggested = findAccessibleColor(bgHex, darkHex, targetRatio);
      if (darkSuggested) {
        elements.darkSuggestion.hidden = false;
        elements.darkSuggestedPreview.style.backgroundColor = darkSuggested;
        elements.darkSuggestedText.style.color = darkHex;
        elements.darkSuggestedHex.textContent = darkSuggested.toUpperCase();
        const suggestedRatio = getContrastRatio(darkSuggested, darkHex);
        elements.darkSuggestedRatio.textContent = formatRatio(suggestedRatio);
      } else {
        elements.darkSuggestion.hidden = true;
      }
    }

    // Update universal color results
    const universalResult = findUniversalColor(bgHex, lightHex, darkHex, targetRatio);

    if (universalResult) {
      elements.universalInfo.removeAttribute('hidden');
      elements.universalInfo.style.display = '';
      elements.noUniversal.setAttribute('hidden', '');
      elements.noUniversal.style.display = 'none';
      elements.universalPreviewGroup.classList.remove('disabled');

      const isBrandUniversal = universalResult.hex === bgHex.toUpperCase();
      if (isBrandUniversal) {
        elements.universalSuccess.removeAttribute('hidden');
        elements.universalSuccess.style.display = '';
        elements.universalInfoMsg.setAttribute('hidden', '');
        elements.universalInfoMsg.style.display = 'none';
      } else {
        elements.universalSuccess.setAttribute('hidden', '');
        elements.universalSuccess.style.display = 'none';
        elements.universalInfoMsg.removeAttribute('hidden');
        elements.universalInfoMsg.style.display = '';
      }

      // Swatch 1: Universal text on Light bg; Swatch 2: Universal text on Dark bg
      elements.universalPreviewLight.style.backgroundColor = lightHex;
      elements.universalPreviewDark.style.backgroundColor = darkHex;
      elements.universalLightText.style.color = universalResult.hex;
      elements.universalDarkText.style.color = universalResult.hex;
      elements.universalHex.textContent = universalResult.hex;
      elements.universalLightRatio.textContent = 'Light: ' + formatRatio(universalResult.lightRatio);
      elements.universalDarkRatio.textContent = 'Dark: ' + formatRatio(universalResult.darkRatio);
    } else {
      elements.universalInfo.setAttribute('hidden', '');
      elements.universalInfo.style.display = 'none';
      elements.universalSuccess.setAttribute('hidden', '');
      elements.universalSuccess.style.display = 'none';
      elements.universalInfoMsg.setAttribute('hidden', '');
      elements.universalInfoMsg.style.display = 'none';
      elements.noUniversal.removeAttribute('hidden');
      elements.noUniversal.style.display = '';
      elements.universalPreviewGroup.classList.add('disabled');
      elements.universalPreviewLight.style.backgroundColor = '#e9ecef';
      elements.universalPreviewDark.style.backgroundColor = '#e9ecef';
      elements.universalLightText.style.color = '#6c757d';
      elements.universalDarkText.style.color = '#6c757d';
    }
  }

  /**
   * Syncs a hex input with its color picker and auto-corrects the input value.
   * 
   * @param {HTMLInputElement} hexInput - The hex text input
   * @param {HTMLInputElement} picker - The color picker input
   */
  function syncHexToPicker(hexInput, picker) {
    const normalized = normalizeHex(hexInput.value);
    const hexDigits = (hexInput.value.match(/[0-9A-Fa-f]/g) || []).length;

    if (isValidHex(normalized)) {
      picker.value = normalized;
      // Don't overwrite input when expanding 3-char to 6-char - user may be typing a 6-char code
      if (hexDigits === 3) {
        return;
      }
      if (hexInput.value !== normalized) {
        hexInput.value = normalized;
      }
    }
  }

  /**
   * Syncs a color picker with its hex input.
   * 
   * @param {HTMLInputElement} picker - The color picker input
   * @param {HTMLInputElement} hexInput - The hex text input
   */
  function syncPickerToHex(picker, hexInput) {
    hexInput.value = picker.value.toUpperCase();
  }

  /**
   * Creates a debounced function.
   * 
   * @param {Function} func - Function to debounce
   * @param {number} wait - Debounce delay in milliseconds
   * @returns {Function} Debounced function
   */
  function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  /**
   * Handles paste events on hex inputs to clean up common issues.
   * Fixes double ## when pasting #RRGGBB after double-clicking to select digits.
   * 
   * @param {ClipboardEvent} e - The paste event
   */
  function handleHexPaste(e) {
    e.preventDefault();
    const input = e.target;
    const pastedText = (e.clipboardData || window.clipboardData).getData('text');
    
    // Get current selection info
    const start = input.selectionStart;
    const end = input.selectionEnd;
    const currentValue = input.value;
    
    // Build the new value with pasted text inserted
    const newValue = currentValue.substring(0, start) + pastedText + currentValue.substring(end);
    
    // Clean up the result - remove all # and add single one at start
    const cleaned = '#' + newValue.replace(/#/g, '').toUpperCase().substring(0, 6);
    
    input.value = cleaned;
    
    // Set cursor position after the pasted content
    const newCursorPos = Math.min(cleaned.length, start + pastedText.replace(/#/g, '').length + 1);
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    // Trigger input event to update the UI
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }

  /**
   * Sets up all event listeners.
   */
  function setupEventListeners() {
    const debouncedUpdate = debounce(updateResults, DEBOUNCE_DELAY);

    // Paste handlers for hex inputs (fixes double ## issue)
    elements.bgColor.addEventListener('paste', handleHexPaste);
    elements.lightText.addEventListener('paste', handleHexPaste);
    elements.darkText.addEventListener('paste', handleHexPaste);

    // Background color inputs
    elements.bgColor.addEventListener('input', () => {
      syncHexToPicker(elements.bgColor, elements.bgColorPicker);
      debouncedUpdate();
    });
    elements.bgColorPicker.addEventListener('input', () => {
      syncPickerToHex(elements.bgColorPicker, elements.bgColor);
      updateResults();
    });

    // Light text inputs
    elements.lightText.addEventListener('input', () => {
      syncHexToPicker(elements.lightText, elements.lightTextPicker);
      debouncedUpdate();
    });
    elements.lightTextPicker.addEventListener('input', () => {
      syncPickerToHex(elements.lightTextPicker, elements.lightText);
      updateResults();
    });

    // Dark text inputs
    elements.darkText.addEventListener('input', () => {
      syncHexToPicker(elements.darkText, elements.darkTextPicker);
      debouncedUpdate();
    });
    elements.darkTextPicker.addEventListener('input', () => {
      syncPickerToHex(elements.darkTextPicker, elements.darkText);
      updateResults();
    });

    // WCAG level radios
    elements.wcagRadios.forEach(radio => {
      radio.addEventListener('change', updateResults);
    });

    // Copy buttons
    elements.lightCopy.addEventListener('click', () => {
      copyToClipboard(elements.lightSuggestedHex.textContent);
    });
    elements.darkCopy.addEventListener('click', () => {
      copyToClipboard(elements.darkSuggestedHex.textContent);
    });
    elements.universalCopy.addEventListener('click', () => {
      copyToClipboard(elements.universalHex.textContent);
    });
  }

  /**
   * Initializes the application.
   */
  function init() {
    cacheElements();
    setupEventListeners();
    updateResults();
  }

  // Start when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
