const fs = require('fs');
const path = require('path');

const agentConfig = require('../../config/agent.json');

// ============================================================
// SIZE DEFINITIONS
// ============================================================
const SIZES = {
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'facebook-post': { width: 1200, height: 630 }
};

// ============================================================
// DEFAULT LABELS (configurable per request for i18n)
// ============================================================
const DEFAULT_LABELS = {
  newListing: 'NEW LISTING',
  openHouse: 'OPEN HOUSE',
  justSold: 'SOLD',
  priceReduced: 'PRICE REDUCED',
  comingSoon: 'COMING SOON',
  features: 'FEATURES',
  contact: 'Contact',
  bedrooms: 'BD',
  bathrooms: 'BA',
  bedroomsFull: 'Bedrooms',
  bathroomsFull: 'Bathrooms',
  areaLabel: 'Area',
  visitUs: 'Visit Us',
  swipeForMore: 'SWIPE FOR MORE'
};

// ============================================================
// FONT SCALE SYSTEM — centralized font sizes per output size
// ============================================================
const FONT_SCALES = {
  'instagram-post': {
    title: '52px', titleSecondary: '36px', price: '44px',
    badge: '18px', statsValue: '28px', statsLabel: '14px',
    feature: '20px', location: '18px', contactName: '18px',
    contactInfo: '16px', sectionHeader: '16px', body: '18px'
  },
  'instagram-story': {
    title: '64px', titleSecondary: '44px', price: '52px',
    badge: '22px', statsValue: '32px', statsLabel: '16px',
    feature: '22px', location: '20px', contactName: '20px',
    contactInfo: '18px', sectionHeader: '18px', body: '20px'
  },
  'facebook-post': {
    title: '40px', titleSecondary: '28px', price: '34px',
    badge: '15px', statsValue: '22px', statsLabel: '12px',
    feature: '16px', location: '15px', contactName: '16px',
    contactInfo: '14px', sectionHeader: '14px', body: '15px'
  }
};

function getFontScale(size) {
  return FONT_SCALES[size] || FONT_SCALES['instagram-post'];
}

// ============================================================
// COLOR THEME DEFINITIONS — Canva-quality vibrant themes
// ============================================================
const COLOR_THEMES = {
  dark: {
    bg: '#111111',
    bgSecondary: '#1e1e1e',
    bgPanel: 'rgba(17, 17, 17, 0.95)',
    text: '#ffffff',
    textSecondary: '#aaaaaa',
    accent: '#D4AF37',
    accentLight: 'rgba(212, 175, 55, 0.15)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    badge: '#D4AF37',
    badgeText: '#111111',
    divider: 'rgba(212, 175, 55, 0.3)',
    panelSolid: '#D4AF37',
    panelSolidText: '#111111',
    footerBg: '#D4AF37',
    footerText: '#111111',
    photoRadius: '0px',
    photoGap: '4px',
    titleFont: 'Playfair Display'
  },
  light: {
    bg: '#FDF8F0',
    bgSecondary: '#F5EDE0',
    bgPanel: 'rgba(253, 248, 240, 0.97)',
    text: '#2D2A26',
    textSecondary: '#7A7268',
    accent: '#E67E22',
    accentLight: 'rgba(230, 126, 34, 0.1)',
    overlay: 'rgba(253, 248, 240, 0.85)',
    badge: '#E67E22',
    badgeText: '#FFFFFF',
    divider: 'rgba(230, 126, 34, 0.25)',
    panelSolid: '#E67E22',
    panelSolidText: '#FFFFFF',
    footerBg: '#E67E22',
    footerText: '#FFFFFF',
    photoRadius: '12px',
    photoGap: '12px',
    titleFont: 'Montserrat'
  },
  blue: {
    bg: '#F0F4F8',
    bgSecondary: '#E2E8F0',
    bgPanel: 'rgba(240, 244, 248, 0.97)',
    text: '#1A2B42',
    textSecondary: '#5A6D85',
    accent: '#2563EB',
    accentLight: 'rgba(37, 99, 235, 0.08)',
    overlay: 'rgba(26, 43, 66, 0.75)',
    badge: '#2563EB',
    badgeText: '#FFFFFF',
    divider: 'rgba(37, 99, 235, 0.2)',
    panelSolid: '#2563EB',
    panelSolidText: '#FFFFFF',
    footerBg: '#1A2B42',
    footerText: '#FFFFFF',
    photoRadius: '10px',
    photoGap: '10px',
    titleFont: 'Montserrat'
  },
  gold: {
    bg: '#FFFFFF',
    bgSecondary: '#F8F4F4',
    bgPanel: 'rgba(255, 255, 255, 0.97)',
    text: '#1A1A1A',
    textSecondary: '#666666',
    accent: '#7B2D26',
    accentLight: 'rgba(123, 45, 38, 0.08)',
    overlay: 'rgba(123, 45, 38, 0.82)',
    badge: '#7B2D26',
    badgeText: '#FFFFFF',
    divider: 'rgba(123, 45, 38, 0.2)',
    panelSolid: '#7B2D26',
    panelSolidText: '#FFFFFF',
    footerBg: '#7B2D26',
    footerText: '#FFFFFF',
    photoRadius: '12px',
    photoGap: '10px',
    titleFont: 'Montserrat'
  },
  minimal: {
    bg: '#FFFFFF',
    bgSecondary: '#F5F5F5',
    bgPanel: 'rgba(30, 30, 30, 0.88)',
    text: '#1A1A1A',
    textSecondary: '#777777',
    accent: '#333333',
    accentLight: 'rgba(51, 51, 51, 0.06)',
    overlay: 'rgba(30, 30, 30, 0.72)',
    badge: '#333333',
    badgeText: '#FFFFFF',
    divider: 'rgba(51, 51, 51, 0.15)',
    panelSolid: 'rgba(30, 30, 30, 0.88)',
    panelSolidText: '#FFFFFF',
    footerBg: '#1A1A1A',
    footerText: '#FFFFFF',
    photoRadius: '0px',
    photoGap: '4px',
    titleFont: 'Playfair Display'
  }
};

const LAYOUTS = ['hero-single', 'split-duo', 'feature-trio', 'grid-quad', 'grid-six', 'carousel-slides'];
const POST_TYPES = ['new-listing', 'open-house', 'just-sold', 'price-drop', 'coming-soon'];
const THEME_NAMES = ['dark', 'light', 'blue', 'gold', 'minimal', 'custom'];
const SIZE_NAMES = Object.keys(SIZES);

// ============================================================
// UTILITY FUNCTIONS
// ============================================================

function getColors(theme, customColors) {
  if (theme === 'custom' && customColors) {
    const primary = customColors.primary || '#1a1a2e';
    const accent = customColors.accent || '#e2b659';
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.5;
    const ar = parseInt(accent.slice(1, 3), 16);
    const ag = parseInt(accent.slice(3, 5), 16);
    const ab = parseInt(accent.slice(5, 7), 16);

    return {
      bg: primary,
      bgSecondary: isDark ? lighten(primary, 12) : darken(primary, 8),
      bgPanel: isDark ? `rgba(${r}, ${g}, ${b}, 0.95)` : `rgba(${r}, ${g}, ${b}, 0.97)`,
      text: isDark ? '#ffffff' : '#1a1a1a',
      textSecondary: isDark ? '#aaaaaa' : '#666666',
      accent: accent,
      accentLight: `rgba(${ar}, ${ag}, ${ab}, 0.1)`,
      overlay: isDark ? 'rgba(0,0,0,0.7)' : `rgba(${r}, ${g}, ${b}, 0.85)`,
      badge: accent,
      badgeText: isDark ? '#111111' : '#ffffff',
      divider: `rgba(${ar}, ${ag}, ${ab}, 0.25)`,
      panelSolid: accent,
      panelSolidText: isDark ? '#111111' : '#ffffff',
      footerBg: accent,
      footerText: isDark ? '#111111' : '#ffffff',
      photoRadius: isDark ? '0px' : '10px',
      photoGap: isDark ? '4px' : '10px',
      titleFont: isDark ? 'Playfair Display' : 'Montserrat'
    };
  }
  return COLOR_THEMES[theme] || COLOR_THEMES.dark;
}

function lighten(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function darken(hex, percent) {
  const num = parseInt(hex.slice(1), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.max(0, (num >> 16) - amt);
  const G = Math.max(0, ((num >> 8) & 0x00ff) - amt);
  const B = Math.max(0, (num & 0x0000ff) - amt);
  return `#${(0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1)}`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

/** Soft truncate — only cuts extremely long titles, allows CSS word-wrap to handle the rest */
function softTruncate(str, maxLen) {
  if (!str) return '';
  const limit = maxLen || 120;
  return str.length > limit ? str.slice(0, limit - 1) + '…' : str;
}

// ============================================================
// SVG ICON SYSTEM (expanded with new icons)
// ============================================================

function svgIcon(name, color, sizePx) {
  const s = sizePx || 20;
  const icons = {
    pin: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z" fill="${color}"/></svg>`,
    phone: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" fill="${color}"/></svg>`,
    email: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" fill="${color}"/></svg>`,
    check: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" fill="${color}"/></svg>`,
    bed: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M7 13c1.66 0 3-1.34 3-3S8.66 7 7 7s-3 1.34-3 3 1.34 3 3 3zm12-6h-8v7H3V5H1v15h2v-3h18v3h2V10c0-2.21-1.79-4-4-4z" fill="${color}"/></svg>`,
    bath: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M7 7c0-1.1.9-2 2-2s2 .9 2 2H7zm13 6v4c0 1.1-.9 2-2 2h-.56c.35-.59.56-1.27.56-2H4c0 .73.21 1.41.56 2H4c-1.1 0-2-.9-2-2v-4h18zM7 7H5v6h14V7h-2c0 2.21-1.79 4-4 4s-4-1.79-4-4z" fill="${color}"/></svg>`,
    area: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M19 12h-2v3h-3v2h5v-5zM7 9h3V7H5v5h2V9zm14-6H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14z" fill="${color}"/></svg>`,
    arrow: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" fill="${color}"/></svg>`,
    kitchen: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M18 2.01L6 2c-1.1 0-2 .89-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.11-.9-1.99-2-1.99zM18 20H6v-9.02h12V20zm0-11H6V4h12v5zM8 5h2v3H8zm0 7h2v5H8z" fill="${color}"/></svg>`,
    car: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z" fill="${color}"/></svg>`,
    house: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" fill="${color}"/></svg>`,
    globe: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" fill="${color}"/></svg>`,
    pool: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M22 21c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.07.64-2.18.64s-1.73-.37-2.18-.64c-.37-.22-.6-.36-1.15-.36-.56 0-.78.13-1.15.36-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64v-2c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36s.78-.13 1.15-.36c.45-.27 1.07-.64 2.18-.64s1.73.37 2.18.64c.37.23.59.36 1.15.36v2zM8.67 12c.56 0 .78-.13 1.15-.36.46-.27 1.08-.64 2.19-.64 1.11 0 1.73.37 2.18.64.37.22.6.36 1.15.36l1.76-6h2.8L17 14c-1.11 0-1.73-.37-2.18-.64-.37-.22-.6-.36-1.15-.36s-.78.13-1.15.36c-.46.27-1.08.64-2.19.64-1.11 0-1.73-.37-2.18-.64-.37-.23-.59-.36-1.15-.36l2.82-8h2.8L8.67 12zM16 6c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" fill="${color}"/></svg>`
  };
  return icons[name] || '';
}

// ============================================================
// FEATURE ICON DETECTION
// ============================================================

function detectFeatureIcon(text) {
  const lower = (text || '').toLowerCase();
  if (/bed|bedroom|habitaci|dormitor|recamar/i.test(lower)) return 'bed';
  if (/bath|bathroom|baño|aseo|wc/i.test(lower)) return 'bath';
  if (/kitchen|cocina|cozinha/i.test(lower)) return 'kitchen';
  if (/park|garage|carport|estaciona|garaje|cochera/i.test(lower)) return 'car';
  if (/pool|piscina|alberca/i.test(lower)) return 'pool';
  if (/view|vista|ocean|mar|lago|panoram/i.test(lower)) return 'globe';
  if (/area|m²|sq\s*ft|superficie|terreno/i.test(lower)) return 'area';
  return 'check';
}

// ============================================================
// SHARED COMPONENT BUILDERS
// ============================================================

const PHOTO_PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="%23404040"/><rect x="340" y="230" width="120" height="100" rx="8" fill="none" stroke="%23666" stroke-width="4"/><circle cx="380" cy="270" r="12" fill="%23666"/><path d="M350 310 L380 280 L410 300 L430 285 L450 310" fill="none" stroke="%23666" stroke-width="3"/><text x="400" y="360" text-anchor="middle" font-family="Arial" font-size="18" fill="%23777">Photo</text></svg>'
);

function buildPhotoSlots(photos, count) {
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(photos && photos[i] ? photos[i] : PHOTO_PLACEHOLDER);
  }
  return result;
}

/** Wrap a photo img tag with border-radius, overflow hidden, and fallback on error */
function photoImg(src, colors, extraStyle) {
  const radius = colors.photoRadius || '0px';
  // onerror: if the image fails to load (e.g., expired CDN URL), show a gray placeholder with a subtle icon
  const fallbackBg = colors.bg === '#FFFFFF' || colors.bg === '#FDF8F0' ? '#e0e0e0' : '#404040';
  return `<div style="overflow:hidden;border-radius:${radius};height:100%;background:${fallbackBg};${extraStyle || ''}"><img src="${src}" style="width:100%;height:100%;object-fit:cover;display:block;" crossorigin="anonymous" onerror="this.onerror=null;this.src='${PHOTO_PLACEHOLDER}';"/></div>`;
}

function getPostTypeBadge(postType, labels) {
  const badges = {
    'new-listing': labels.newListing,
    'open-house': labels.openHouse,
    'just-sold': labels.justSold,
    'price-drop': labels.priceReduced,
    'coming-soon': labels.comingSoon
  };
  return badges[postType] || '';
}

function buildBadge(postType, colors, property, openHouse, labels, fs) {
  const label = getPostTypeBadge(postType, labels);
  if (!label) return '';
  const badgeFontSize = fs ? fs.badge : '18px';

  let extra = '';
  if (postType === 'price-drop' && property.oldPrice) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:16px;margin-top:6px;">
      <span style="text-decoration:line-through;color:${colors.textSecondary};margin-right:8px;">${escapeHtml(property.oldPrice)}</span>
      <span style="color:${colors.accent};font-weight:700;">${escapeHtml(property.price)}</span>
    </div>`;
  }
  if (postType === 'open-house' && openHouse) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:16px;margin-top:6px;color:${colors.text};">
      ${openHouse.date ? escapeHtml(openHouse.date) : ''}${openHouse.date && openHouse.time ? ' · ' : ''}${openHouse.time ? escapeHtml(openHouse.time) : ''}
    </div>`;
  }

  if (postType === 'just-sold') {
    return `<div style="position:absolute;top:24px;right:24px;z-index:10;">
      <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:900;font-size:24px;padding:12px 28px;letter-spacing:3px;transform:rotate(3deg);border:3px solid ${colors.badgeText};box-shadow:0 6px 24px rgba(0,0,0,0.35);border-radius:4px;">${escapeHtml(label)}</div>
      ${extra}
    </div>`;
  }

  return `<div style="position:absolute;top:24px;left:24px;z-index:10;">
    <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:800;font-size:${badgeFontSize};padding:10px 24px;letter-spacing:2.5px;box-shadow:0 4px 16px rgba(0,0,0,0.25);border-radius:4px;">${escapeHtml(label)}</div>
    ${extra}
  </div>`;
}

function buildInlineBadge(postType, colors, labels, fs) {
  const label = getPostTypeBadge(postType, labels);
  if (!label) return '';
  const badgeFontSize = fs ? fs.badge : '18px';
  return `<span style="display:inline-block;background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:800;font-size:${badgeFontSize};padding:10px 22px;letter-spacing:2.5px;border-radius:4px;vertical-align:middle;">${escapeHtml(label)}</span>`;
}

function buildSectionHeader(text, colors, fontSize) {
  if (!text) return '';
  return `<div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize || '16px'};letter-spacing:3px;color:${colors.accent};text-transform:uppercase;margin-bottom:14px;display:flex;align-items:center;gap:12px;">
    <span style="display:inline-block;width:40px;height:4px;background:${colors.accent};border-radius:2px;"></span>
    ${escapeHtml(text)}
  </div>`;
}

function buildLocationHtml(location, colors, fontSize) {
  if (!location) return '';
  const sz = parseInt(fontSize) || 18;
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
    ${svgIcon('pin', colors.accent, sz + 4)}
    <span style="font-family:'Montserrat',sans-serif;font-size:${sz}px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;font-weight:500;">${escapeHtml(location)}</span>
  </div>`;
}

function buildTitleHtml(title, colors, fs, style) {
  style = style || 'standard';
  const font = colors.titleFont || 'Montserrat';
  const isSerif = font === 'Playfair Display';

  if (style === 'split') {
    // Reference 2 style: first words smaller, last word ENORMOUS
    const words = (title || '').split(' ');
    if (words.length <= 1) {
      return `<div style="font-family:'${font}',${isSerif ? 'serif' : 'sans-serif'};font-weight:900;font-size:${fs.title};color:${colors.text};line-height:1.0;text-transform:uppercase;letter-spacing:2px;margin-bottom:16px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(title, 60))}</div>`;
    }
    const lastWord = words.pop();
    const firstPart = words.join(' ');
    return `<div style="margin-bottom:16px;">
      <div style="font-family:'${font}',${isSerif ? 'serif' : 'sans-serif'};font-weight:700;font-size:${fs.titleSecondary};color:${colors.text};line-height:1.05;text-transform:uppercase;letter-spacing:2px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(firstPart, 80))}</div>
      <div style="font-family:'${font}',${isSerif ? 'serif' : 'sans-serif'};font-weight:900;font-size:${fs.title};color:${colors.text};line-height:1.0;text-transform:uppercase;letter-spacing:3px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(lastWord, 40))}</div>
    </div>`;
  }

  // 'standard' — large clean title, allows word-wrap across multiple lines
  return `<div style="font-family:'${font}',${isSerif ? 'serif' : 'sans-serif'};font-weight:800;font-size:${fs.title};color:${colors.text};line-height:1.1;margin-bottom:14px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(title, 120))}</div>`;
}

function buildBrandingHtml(colors, fs) {
  const agent = agentConfig;
  return `<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
    ${agent.logo
      ? `<img src="${agent.logo}" style="height:48px;width:48px;object-fit:cover;border-radius:10px;border:2px solid ${colors.accent};" crossorigin="anonymous" onerror="this.style.display='none'"/>`
      : `<div style="width:48px;height:48px;display:flex;align-items:center;justify-content:center;background:${colors.accentLight};border-radius:10px;border:2px solid ${colors.accent};">${svgIcon('house', colors.accent, 28)}</div>`
    }
    <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${fs ? fs.contactName : '18px'};color:${colors.text};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
  </div>`;
}

function buildPriceHtml(property, postType, colors, fontSize, style) {
  fontSize = fontSize || '44px';
  style = style || 'banner';

  if (postType === 'price-drop') {
    return `<div style="font-family:'Montserrat',sans-serif;margin-bottom:12px;">
      ${property.oldPrice ? `<span style="text-decoration:line-through;color:${colors.textSecondary};font-size:${parseInt(fontSize) * 0.7}px;margin-right:12px;">${escapeHtml(property.oldPrice)}</span>` : ''}
      ${property.price ? `<span style="font-weight:900;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;">${escapeHtml(property.price)}</span>` : ''}
    </div>`;
  }
  if (!property.price) return '';

  if (style === 'banner') {
    return `<div style="display:inline-block;background:${colors.accent};padding:12px 28px;margin-bottom:14px;border-radius:4px;">
      <span style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize};color:${colors.badgeText};letter-spacing:1.5px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  if (style === 'overlap') {
    return `<div style="display:inline-block;background:${colors.panelSolid};padding:14px 32px;border-radius:6px;box-shadow:0 6px 24px rgba(0,0,0,0.2);">
      <span style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize};color:${colors.panelSolidText};letter-spacing:1.5px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  if (style === 'boxed') {
    return `<div style="display:inline-block;border:3px solid ${colors.text};padding:12px 28px;margin-bottom:14px;">
      <span style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize};color:${colors.text};letter-spacing:1.5px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  if (style === 'highlight') {
    return `<div style="display:inline-block;background:${colors.accentLight};border-left:4px solid ${colors.accent};padding:10px 20px;margin-bottom:14px;">
      <span style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  // 'inline' style
  return `<div style="font-family:'Montserrat',sans-serif;font-weight:900;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;margin-bottom:12px;">${escapeHtml(property.price)}</div>`;
}

function buildPropertyStats(property, colors, fs, labels, expanded) {
  const stats = [];
  if (property.bedrooms) stats.push({ icon: 'bed', value: property.bedrooms, label: expanded ? labels.bedroomsFull : labels.bedrooms });
  if (property.bathrooms) stats.push({ icon: 'bath', value: property.bathrooms, label: expanded ? labels.bathroomsFull : labels.bathrooms });
  if (property.area) stats.push({ icon: 'area', value: property.area, label: '' });
  if (stats.length === 0) return '';

  const iconSize = fs ? parseInt(fs.statsValue) : 28;
  const valueSize = fs ? fs.statsValue : '28px';
  const labelSize = fs ? fs.statsLabel : '14px';

  const items = stats.map(s =>
    `<div style="display:flex;align-items:center;gap:10px;">
      ${svgIcon(s.icon, colors.accent, iconSize)}
      <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${valueSize};color:${colors.text};">${escapeHtml(String(s.value))}</span>
      ${s.label ? `<span style="font-family:'Montserrat',sans-serif;font-size:${labelSize};color:${colors.textSecondary};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(s.label)}</span>` : ''}
    </div>`
  ).join('');

  return `<div style="display:flex;align-items:center;gap:32px;margin:14px 0;">${items}</div>`;
}

function buildFeaturesHtml(features, colors, labels, maxItems, mode, fs) {
  if (!features || features.length === 0) return '';
  const items = features.slice(0, maxItems || 6);
  mode = mode || 'vertical';
  const featureSize = fs ? fs.feature : '20px';
  const iconSize = parseInt(featureSize) + 4;

  const header = labels.features
    ? buildSectionHeader(labels.features, colors, fs ? fs.sectionHeader : '16px')
    : '';

  if (mode === 'grid') {
    const gridItems = items.map(f => {
      const icon = detectFeatureIcon(f);
      return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
        ${svgIcon(icon, colors.accent, iconSize)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${featureSize};font-weight:500;color:${colors.text};line-height:1.3;">${escapeHtml(f)}</span>
      </div>`;
    }).join('');
    return `<div style="margin-top:12px;">${header}<div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 24px;">${gridItems}</div></div>`;
  }

  if (mode === 'horizontal') {
    const hItems = items.map(f => {
      const icon = detectFeatureIcon(f);
      return `<div style="display:flex;align-items:center;gap:8px;">
        ${svgIcon(icon, colors.accent, parseInt(featureSize))}
        <span style="font-family:'Montserrat',sans-serif;font-size:${featureSize};font-weight:500;color:${colors.text};">${escapeHtml(f)}</span>
      </div>`;
    }).join('');
    return `<div style="display:flex;flex-wrap:wrap;gap:16px;margin:10px 0;">${hItems}</div>`;
  }

  // 'vertical' mode (default)
  const list = items.map(f => {
    const icon = detectFeatureIcon(f);
    return `<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px;">
      ${svgIcon(icon, colors.accent, iconSize)}
      <span style="font-family:'Montserrat',sans-serif;font-size:${featureSize};font-weight:500;color:${colors.text};line-height:1.3;">${escapeHtml(f)}</span>
    </div>`;
  }).join('');

  return `<div style="margin-top:12px;">${header}${list}</div>`;
}

function buildContactSection(colors, size, labels, style, fs) {
  const agent = agentConfig;
  const isFB = size === 'facebook-post';
  const nameSize = fs ? fs.contactName : '18px';
  const infoSize = fs ? fs.contactInfo : '16px';

  if (style === 'solidPanel') {
    // Solid colored contact box (Reference 1 orange box)
    return `<div style="background:${colors.panelSolid};border-radius:${colors.photoRadius || '8px'};padding:24px 28px;margin-top:14px;">
      <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${nameSize};letter-spacing:2px;color:${colors.panelSolidText};text-transform:uppercase;margin-bottom:14px;">${escapeHtml(labels.contact)}</div>
      ${agent.phone ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${svgIcon('phone', colors.panelSolidText, 20)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.panelSolidText};font-weight:500;">${escapeHtml(agent.phone)}</span>
      </div>` : ''}
      ${agent.email ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${svgIcon('email', colors.panelSolidText, 20)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.panelSolidText};font-weight:500;">${escapeHtml(agent.email)}</span>
      </div>` : ''}
      ${agent.website ? `<div style="display:flex;align-items:center;gap:10px;">
        ${svgIcon('globe', colors.panelSolidText, 20)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.panelSolidText};font-weight:500;">${escapeHtml(agent.website)}</span>
      </div>` : ''}
    </div>`;
  }

  if (style === 'solidBar') {
    // Full-width solid colored footer bar (References 1 & 2)
    const barHeight = isFB ? '80px' : '95px';
    return `<div style="position:absolute;bottom:0;left:0;right:0;height:${barHeight};background:${colors.footerBg};display:flex;align-items:center;padding:0 40px;gap:24px;">
      ${agent.logo
        ? `<img src="${agent.logo}" style="height:44px;width:44px;object-fit:cover;border-radius:50%;border:2px solid ${colors.footerText};" crossorigin="anonymous" onerror="this.style.display='none'"/>`
        : `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,0.15);border-radius:50%;">${svgIcon('house', colors.footerText, 24)}</div>`
      }
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${nameSize};color:${colors.footerText};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
      </div>
      <div style="display:flex;gap:28px;align-items:center;">
        ${agent.phone ? `<div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon('phone', colors.footerText, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.footerText};font-weight:500;">${escapeHtml(agent.phone)}</span>
        </div>` : ''}
        ${agent.email ? `<div style="display:flex;align-items:center;gap:8px;">
          ${svgIcon('email', colors.footerText, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.footerText};font-weight:500;">${escapeHtml(agent.email)}</span>
        </div>` : ''}
      </div>
    </div>`;
  }

  if (style === 'panel') {
    // Embedded contact section (inside info panels, uses theme text colors)
    const ctaHeader = labels.contact
      ? buildSectionHeader(labels.contact, colors, fs ? fs.sectionHeader : '16px')
      : '';
    return `<div style="margin-top:16px;">
      ${ctaHeader}
      ${agent.phone ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${svgIcon('phone', colors.accent, 22)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.text};font-weight:500;">${escapeHtml(agent.phone)}</span>
      </div>` : ''}
      ${agent.email ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px;">
        ${svgIcon('email', colors.accent, 22)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.text};font-weight:500;">${escapeHtml(agent.email)}</span>
      </div>` : ''}
      <div style="display:flex;align-items:center;gap:14px;margin-top:12px;">
        ${agent.logo
          ? `<img src="${agent.logo}" style="height:42px;width:42px;object-fit:cover;border-radius:50%;border:2px solid ${colors.accent};" crossorigin="anonymous" onerror="this.style.display='none'"/>`
          : `<div style="width:42px;height:42px;display:flex;align-items:center;justify-content:center;background:${colors.accentLight};border-radius:50%;">${svgIcon('house', colors.accent, 22)}</div>`
        }
        <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:${nameSize};color:${colors.text};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
      </div>
    </div>`;
  }

  // 'bar' style — bottom-anchored bar with bgSecondary (subtle)
  const barHeight = isFB ? '80px' : '95px';
  return `<div style="position:absolute;bottom:0;left:0;right:0;height:${barHeight};background:${colors.bgSecondary};display:flex;align-items:center;padding:0 36px;gap:18px;border-top:3px solid ${colors.accent};">
    ${agent.logo
      ? `<img src="${agent.logo}" style="height:44px;width:44px;object-fit:cover;border-radius:50%;border:2px solid ${colors.accent};" crossorigin="anonymous" onerror="this.style.display='none'"/>`
      : `<div style="width:44px;height:44px;display:flex;align-items:center;justify-content:center;background:${colors.accentLight};border-radius:50%;">${svgIcon('house', colors.accent, 22)}</div>`
    }
    <div style="flex:1;min-width:0;">
      <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:${nameSize};color:${colors.text};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
      ${agent.phone ? `<div style="display:flex;align-items:center;gap:8px;">
        ${svgIcon('phone', colors.accent, 16)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.textSecondary};font-weight:500;">${escapeHtml(agent.phone)}</span>
      </div>` : ''}
      ${agent.email ? `<div style="display:flex;align-items:center;gap:8px;">
        ${svgIcon('email', colors.accent, 16)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.textSecondary};font-weight:500;">${escapeHtml(agent.email)}</span>
      </div>` : ''}
    </div>
  </div>`;
}

// ============================================================
// LAYOUT RENDERERS
// ============================================================

function renderHeroSingle(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 1);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const fs = getFontScale(size);
  const gap = colors.photoGap || '0px';
  const radius = colors.photoRadius || '0px';
  const hasRadius = parseInt(radius) > 0;

  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Photo top -->
        <div style="position:absolute;top:${hasRadius ? '16px' : '0'};left:${hasRadius ? '16px' : '0'};right:${hasRadius ? '16px' : '0'};height:${hasRadius ? '44%' : '45%'};overflow:hidden;border-radius:${hasRadius ? radius : '0'};">
          <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/>
        </div>
        ${buildBadge(postType, colors, property, openHouse, labels, fs)}
        <!-- Price overlap -->
        <div style="position:absolute;top:43%;left:40px;z-index:5;">
          ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
        </div>
        <!-- Info panel bottom -->
        <div style="position:absolute;bottom:95px;left:0;right:0;top:48%;padding:20px 44px;display:flex;flex-direction:column;justify-content:center;">
          ${buildTitleHtml(property.title, colors, fs, 'standard')}
          ${buildLocationHtml(property.location, colors, fs.location)}
          ${buildPropertyStats(property, colors, fs, labels, true)}
          ${buildFeaturesHtml(property.features, colors, labels, 5, 'vertical', fs)}
        </div>
        ${buildContactSection(colors, size, labels, 'solidBar', fs)}
      </div>`;
  }

  // Square and Facebook
  const panelW = isFB ? '46%' : '48%';
  const photoW = isFB ? '54%' : '52%';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Photo right -->
      <div style="position:absolute;top:${hasRadius ? gap : '0'};right:${hasRadius ? gap : '0'};bottom:${hasRadius ? gap : '0'};width:${photoW};overflow:hidden;border-radius:${hasRadius ? radius : '0'};">
        <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/>
      </div>
      ${postType === 'just-sold' ? buildBadge(postType, colors, property, openHouse, labels, fs) : ''}
      <!-- Info panel left -->
      <div style="position:absolute;top:0;left:0;bottom:0;width:${panelW};padding:${isFB ? '28px 32px' : '40px 44px'};display:flex;flex-direction:column;justify-content:center;z-index:2;">
        ${buildBrandingHtml(colors, fs)}
        ${postType !== 'just-sold' ? `<div style="margin-bottom:14px;">${buildInlineBadge(postType, colors, labels, fs)}</div>` : ''}
        ${buildPriceHtml(property, postType, colors, fs.price, 'banner')}
        ${buildTitleHtml(property.title, colors, fs, 'standard')}
        ${buildLocationHtml(property.location, colors, fs.location)}
        ${buildPropertyStats(property, colors, fs, labels, false)}
        ${buildFeaturesHtml(property.features, colors, labels, isFB ? 3 : 4, 'vertical', fs)}
        ${buildContactSection(colors, size, labels, 'panel', fs)}
      </div>
    </div>`;
}

function renderSplitDuo(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 2);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const fs = getFontScale(size);
  const gap = colors.photoGap || '0px';
  const radius = colors.photoRadius || '0px';
  const hasRadius = parseInt(radius) > 0;

  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Top: branding + title -->
        <div style="padding:40px 44px 20px;">
          ${buildBrandingHtml(colors, fs)}
          ${buildInlineBadge(postType, colors, labels, fs)}
          ${buildTitleHtml(property.title, colors, fs, 'split')}
        </div>
        <!-- Two photos side by side -->
        <div style="display:flex;gap:${gap};padding:0 ${hasRadius ? '16px' : '0'};height:40%;">
          <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
          <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
        </div>
        <!-- Price overlap -->
        <div style="position:relative;z-index:5;margin-top:-30px;margin-left:44px;">
          ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
        </div>
        <!-- Bottom info -->
        <div style="padding:16px 44px;flex:1;">
          ${buildLocationHtml(property.location, colors, fs.location)}
          ${buildPropertyStats(property, colors, fs, labels, true)}
          ${buildFeaturesHtml(property.features, colors, labels, 4, 'grid', fs)}
        </div>
        ${buildContactSection(colors, size, labels, 'solidBar', fs)}
      </div>`;
  }

  // Square and Facebook — cream/white background with photos + info
  const photoAreaW = isFB ? '55%' : '52%';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Left: info panel -->
      <div style="position:absolute;top:0;left:0;bottom:${hasRadius ? '95px' : '95px'};width:${isFB ? '45%' : '48%'};padding:${isFB ? '28px 28px' : '36px 40px'};display:flex;flex-direction:column;justify-content:center;">
        ${buildBrandingHtml(colors, fs)}
        ${buildInlineBadge(postType, colors, labels, fs)}
        <div style="margin-top:14px;">
          ${buildTitleHtml(property.title, colors, fs, 'split')}
        </div>
        ${buildLocationHtml(property.location, colors, fs.location)}
        ${buildPropertyStats(property, colors, fs, labels, false)}
        ${buildFeaturesHtml(property.features, colors, labels, isFB ? 3 : 4, 'vertical', fs)}
      </div>
      <!-- Right: two photos stacked -->
      <div style="position:absolute;top:${hasRadius ? gap : '0'};right:${hasRadius ? gap : '0'};bottom:${hasRadius ? `calc(95px + ${gap})` : '95px'};width:${photoAreaW};display:flex;flex-direction:column;gap:${gap};">
        <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
        <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
      </div>
      ${buildContactSection(colors, size, labels, 'solidBar', fs)}
    </div>`;
}

function renderFeatureTrio(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 3);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const fs = getFontScale(size);
  const gap = colors.photoGap || '0px';
  const radius = colors.photoRadius || '0px';
  const hasRadius = parseInt(radius) > 0;
  const pad = hasRadius ? '16px' : '0';

  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Top: badge + title -->
        <div style="padding:36px 44px 16px;">
          ${buildBrandingHtml(colors, fs)}
          ${buildInlineBadge(postType, colors, labels, fs)}
          <div style="margin-top:12px;">${buildTitleHtml(property.title, colors, fs, 'standard')}</div>
        </div>
        <!-- L-shape photos -->
        <div style="display:flex;gap:${gap};padding:0 ${pad};height:42%;">
          <div style="flex:0.4;display:flex;flex-direction:column;gap:${gap};">
            <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
            <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
          </div>
          <div style="flex:0.6;overflow:hidden;border-radius:${radius};position:relative;">
            <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/>
          </div>
        </div>
        <!-- Price overlap -->
        <div style="position:relative;z-index:5;margin-top:-30px;margin-left:44px;">
          ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
        </div>
        <!-- Bottom info -->
        <div style="padding:16px 44px;">
          ${buildLocationHtml(property.location, colors, fs.location)}
          ${buildPropertyStats(property, colors, fs, labels, true)}
          ${buildFeaturesHtml(property.features, colors, labels, 5, 'grid', fs)}
        </div>
        ${buildContactSection(colors, size, labels, 'solidBar', fs)}
      </div>`;
  }

  // Square and Facebook
  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Top: badge + title strip -->
      <div style="padding:${isFB ? '16px 32px' : '24px 40px'};display:flex;align-items:center;gap:16px;">
        ${buildInlineBadge(postType, colors, labels, fs)}
        <div style="font-family:'${colors.titleFont}',${colors.titleFont === 'Playfair Display' ? 'serif' : 'sans-serif'};font-weight:800;font-size:${fs.titleSecondary};color:${colors.text};line-height:1.1;flex:1;min-width:0;">${escapeHtml(softTruncate(property.title, 90))}</div>
      </div>
      <!-- L-shape photo grid -->
      <div style="display:flex;gap:${gap};padding:0 ${pad};height:${isFB ? '52%' : '50%'};">
        <div style="flex:0.38;display:flex;flex-direction:column;gap:${gap};">
          <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
          <div style="flex:1;overflow:hidden;border-radius:${radius};"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>
        </div>
        <div style="flex:0.62;overflow:hidden;border-radius:${radius};position:relative;">
          <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/>
        </div>
      </div>
      <!-- Price overlap -->
      <div style="position:relative;z-index:5;margin-top:-28px;margin-left:${hasRadius ? '56%' : '50%'};margin-right:20px;text-align:right;">
        ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
      </div>
      <!-- Bottom info: two columns -->
      <div style="position:absolute;bottom:${isFB ? '80px' : '95px'};left:0;right:0;padding:8px ${isFB ? '32px' : '40px'};display:flex;gap:24px;align-items:flex-start;">
        <div style="flex:1;">
          ${buildBrandingHtml(colors, fs)}
          ${buildFeaturesHtml(property.features, colors, labels, 4, 'grid', fs)}
        </div>
        <div style="flex:0;min-width:${isFB ? '220px' : '280px'};">
          ${buildContactSection(colors, size, labels, 'solidPanel', fs)}
        </div>
      </div>
      ${buildContactSection(colors, size, labels, 'solidBar', fs)}
    </div>`;
}

function renderGridQuad(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 4);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const fs = getFontScale(size);
  const gap = colors.photoGap || '0px';
  const radius = colors.photoRadius || '0px';
  const hasRadius = parseInt(radius) > 0;
  const pad = hasRadius ? '16px' : '0';

  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Header -->
        <div style="padding:36px 44px 16px;">
          ${buildBrandingHtml(colors, fs)}
          ${buildInlineBadge(postType, colors, labels, fs)}
          <div style="margin-top:12px;">${buildTitleHtml(property.title, colors, fs, 'standard')}</div>
        </div>
        <!-- 2x2 photo grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:${gap};padding:0 ${pad};height:38%;">
          ${photos.map(p => `<div style="overflow:hidden;border-radius:${radius};"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>`).join('')}
        </div>
        <!-- Price overlap -->
        <div style="position:relative;z-index:5;margin-top:-28px;margin-left:44px;">
          ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
        </div>
        <!-- Bottom info -->
        <div style="padding:16px 44px;">
          ${buildLocationHtml(property.location, colors, fs.location)}
          ${buildPropertyStats(property, colors, fs, labels, true)}
          ${buildFeaturesHtml(property.features, colors, labels, 5, 'grid', fs)}
        </div>
        ${buildContactSection(colors, size, labels, 'solidBar', fs)}
      </div>`;
  }

  // Square and Facebook
  if (hasRadius) {
    // Light/colorful themes: structured layout with bg showing through
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Top: title + badge -->
        <div style="padding:${isFB ? '16px 32px' : '24px 40px'};display:flex;align-items:center;gap:16px;">
          ${buildInlineBadge(postType, colors, labels, fs)}
          <div style="font-family:'${colors.titleFont}',${colors.titleFont === 'Playfair Display' ? 'serif' : 'sans-serif'};font-weight:800;font-size:${fs.titleSecondary};color:${colors.text};line-height:1.1;flex:1;min-width:0;">${escapeHtml(softTruncate(property.title, 90))}</div>
        </div>
        <!-- 2x2 photo grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:${gap};padding:0 ${pad};height:${isFB ? '48%' : '48%'};">
          ${photos.map(p => `<div style="overflow:hidden;border-radius:${radius};"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>`).join('')}
        </div>
        <!-- Price overlap -->
        <div style="position:relative;z-index:5;margin-top:-28px;margin-left:${isFB ? '32px' : '40px'};">
          ${buildPriceHtml(property, postType, colors, fs.price, 'overlap')}
        </div>
        <!-- Bottom info -->
        <div style="padding:8px ${isFB ? '32px' : '40px'};display:flex;gap:24px;align-items:flex-start;">
          <div style="flex:1;">
            ${buildLocationHtml(property.location, colors, fs.location)}
            ${buildPropertyStats(property, colors, fs, labels, false)}
            ${buildFeaturesHtml(property.features, colors, labels, isFB ? 3 : 4, 'horizontal', fs)}
          </div>
        </div>
        ${buildContactSection(colors, size, labels, 'solidBar', fs)}
      </div>`;
  }

  // Dark/minimal themes: edge-to-edge grid with floating overlay
  const overlayWidth = isFB ? '400px' : '500px';
  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse, labels, fs)}
      <!-- 2x2 photo grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;position:absolute;top:0;bottom:95px;left:0;right:0;">
        ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>`).join('')}
      </div>
      <!-- Central floating overlay -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-55%);width:${overlayWidth};background:${colors.panelSolid};padding:${isFB ? '28px 36px' : '36px 44px'};z-index:5;text-align:center;box-shadow:0 8px 40px rgba(0,0,0,0.3);">
        ${buildPriceHtml(property, postType, colors, isFB ? '30px' : '38px', 'inline')}
        <div style="font-family:'${colors.titleFont}',serif;font-weight:800;font-size:${isFB ? '28px' : '34px'};color:${colors.panelSolidText};line-height:1.2;margin-bottom:12px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(property.title, 90))}</div>
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:10px;">
          ${svgIcon('pin', colors.panelSolidText, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.panelSolidText};letter-spacing:1.5px;text-transform:uppercase;opacity:0.8;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        <div style="width:50px;height:3px;background:${colors.panelSolidText};margin:12px auto;opacity:0.3;"></div>
        <div style="display:flex;justify-content:center;gap:28px;">
          ${property.bedrooms ? `<div style="display:flex;align-items:center;gap:8px;">${svgIcon('bed', colors.panelSolidText, 22)}<span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${colors.panelSolidText};">${property.bedrooms}</span></div>` : ''}
          ${property.bathrooms ? `<div style="display:flex;align-items:center;gap:8px;">${svgIcon('bath', colors.panelSolidText, 22)}<span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${colors.panelSolidText};">${property.bathrooms}</span></div>` : ''}
          ${property.area ? `<div style="display:flex;align-items:center;gap:8px;">${svgIcon('area', colors.panelSolidText, 22)}<span style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:20px;color:${colors.panelSolidText};">${escapeHtml(property.area)}</span></div>` : ''}
        </div>
      </div>
      ${buildContactSection(colors, size, labels, 'solidBar', fs)}
    </div>`;
}

function renderGridSix(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 6);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const fs = getFontScale(size);
  const gap = colors.photoGap || '0px';
  const radius = colors.photoRadius || '0px';
  const hasRadius = parseInt(radius) > 0;
  const pad = hasRadius ? '16px' : '0';

  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Header -->
        <div style="padding:36px 44px 16px;">
          ${buildBrandingHtml(colors, fs)}
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
            ${buildInlineBadge(postType, colors, labels, fs)}
            <div style="font-family:'${colors.titleFont}',${colors.titleFont === 'Playfair Display' ? 'serif' : 'sans-serif'};font-weight:800;font-size:${fs.titleSecondary};color:${colors.text};line-height:1.1;flex:1;min-width:0;">${escapeHtml(softTruncate(property.title, 80))}</div>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            ${buildPriceHtml(property, postType, colors, fs.price, 'highlight')}
          </div>
        </div>
        <!-- 3x2 photo grid with featured first photo -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:${gap};padding:0 ${pad};height:38%;">
          ${photos.map(p => `<div style="overflow:hidden;border-radius:${radius};"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>`).join('')}
        </div>
        <!-- Bottom: features + contact -->
        <div style="position:absolute;bottom:0;left:0;right:0;padding:24px 44px 36px;background:${colors.bg};border-top:4px solid ${colors.accent};">
          ${buildLocationHtml(property.location, colors, fs.location)}
          ${buildPropertyStats(property, colors, fs, labels, true)}
          ${buildFeaturesHtml(property.features, colors, labels, 6, 'grid', fs)}
          ${buildContactSection(colors, size, labels, 'panel', fs)}
        </div>
      </div>`;
  }

  // Square and Facebook
  const barH = isFB ? 80 : 95;
  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Header strip -->
      <div style="padding:${isFB ? '16px 32px' : '22px 40px'};background:${colors.bgSecondary};display:flex;align-items:center;gap:16px;border-bottom:4px solid ${colors.accent};">
        <div style="flex:0 0 auto;">
          ${buildInlineBadge(postType, colors, labels, fs)}
        </div>
        <div style="flex:1;min-width:0;">
          <div style="font-family:'${colors.titleFont}',${colors.titleFont === 'Playfair Display' ? 'serif' : 'sans-serif'};font-weight:800;font-size:${isFB ? fs.titleSecondary : fs.titleSecondary};color:${colors.text};line-height:1.1;">${escapeHtml(softTruncate(property.title, 80))}</div>
          ${property.location ? `<div style="display:flex;align-items:center;gap:6px;margin-top:4px;">
            ${svgIcon('pin', colors.accent, 16)}
            <span style="font-family:'Montserrat',sans-serif;font-size:${fs.location};color:${colors.textSecondary};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
          </div>` : ''}
        </div>
        <div style="flex:0 0 auto;">
          ${buildPriceHtml(property, postType, colors, isFB ? '24px' : '28px', 'banner')}
        </div>
      </div>
      <!-- 3x2 photo grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:${gap};padding:${hasRadius ? pad : '0'};position:absolute;top:${isFB ? '95px' : '110px'};bottom:${barH}px;left:0;right:0;">
        ${photos.map(p => `<div style="overflow:hidden;border-radius:${radius};"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous" onerror="this.onerror=null;this.style.background='#404040';this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22800%22 height=%22600%22%3E%3Crect width=%22800%22 height=%22600%22 fill=%22%23404040%22/%3E%3C/svg%3E';"/></div>`).join('')}
      </div>
      ${buildContactSection(colors, size, labels, 'solidBar', fs)}
    </div>`;
}

function renderCarouselSlides(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = property.photos || [];
  const slides = [];
  const isStory = size === 'instagram-story';
  const fs = getFontScale(size);
  const radius = colors.photoRadius || '0px';

  // ── Slide 1: Cover slide ──
  const coverPhoto = photos[0] || buildPhotoSlots([], 1)[0];
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <img src="${coverPhoto}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to top, ${colors.bg} 5%, ${colors.overlay} 40%, transparent 70%);"></div>
      ${buildBadge(postType, colors, property, openHouse, labels, fs)}
      <div style="position:absolute;bottom:${isStory ? '70px' : '50px'};left:0;right:0;padding:0 48px;text-align:center;">
        ${buildPriceHtml(property, postType, colors, isStory ? fs.price : '38px', 'banner')}
        <div style="font-family:'${colors.titleFont}',${colors.titleFont === 'Playfair Display' ? 'serif' : 'sans-serif'};font-weight:900;font-size:${isStory ? '48px' : '42px'};color:${colors.text};line-height:1.1;margin-bottom:14px;word-wrap:break-word;overflow-wrap:break-word;">${escapeHtml(softTruncate(property.title, 100))}</div>
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;">
          ${svgIcon('pin', colors.text, 20)}
          <span style="font-family:'Montserrat',sans-serif;font-size:${fs.location};color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-top:24px;">
          <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.textSecondary};letter-spacing:2px;font-weight:600;">${escapeHtml(labels.swipeForMore)}</span>
          ${svgIcon('arrow', colors.accent, 20)}
        </div>
      </div>
    </div>`);

  // ── Photo slides ──
  for (let i = 1; i < photos.length; i++) {
    slides.push(`
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <img src="${photos[i]}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
        <!-- Bottom address strip -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to top, ${colors.bg}ee, transparent);display:flex;align-items:flex-end;padding:0 28px 18px;justify-content:space-between;">
          ${property.location ? `<div style="display:flex;align-items:center;gap:8px;">
            ${svgIcon('pin', colors.accent, 16)}
            <span style="font-family:'Montserrat',sans-serif;font-size:15px;color:${colors.text};letter-spacing:1px;font-weight:500;">${escapeHtml(property.location)}</span>
          </div>` : '<div></div>'}
          <div style="font-family:'Montserrat',sans-serif;font-size:14px;font-weight:600;color:${colors.panelSolidText};background:${colors.panelSolid};padding:6px 16px;border-radius:20px;letter-spacing:1px;">${i + 1}/${photos.length + 1}</div>
        </div>
        <!-- Accent frame top -->
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:${colors.accent};"></div>
      </div>`);
  }

  // ── Details slide (last) ──
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:${isStory ? '60px 50px' : '50px 60px'};">
      <!-- Decorative corners -->
      <div style="position:absolute;top:0;left:0;width:100px;height:100px;border-top:6px solid ${colors.accent};border-left:6px solid ${colors.accent};"></div>
      <div style="position:absolute;bottom:0;right:0;width:100px;height:100px;border-bottom:6px solid ${colors.accent};border-right:6px solid ${colors.accent};"></div>

      <div style="text-align:center;width:100%;max-width:650px;">
        ${buildTitleHtml(property.title, colors, fs, 'standard')}
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:16px;">
          ${svgIcon('pin', colors.accent, 20)}
          <span style="font-family:'Montserrat',sans-serif;font-size:${fs.location};color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        ${buildPriceHtml(property, postType, colors, isStory ? fs.price : '38px', 'banner')}
        <div style="width:60px;height:3px;background:${colors.accent};margin:18px auto;"></div>
        <div style="display:flex;justify-content:center;">${buildPropertyStats(property, colors, fs, labels, true)}</div>
      </div>

      <!-- Features section -->
      <div style="width:100%;max-width:550px;margin-top:24px;text-align:left;">
        ${buildFeaturesHtml(property.features, colors, labels, 6, 'grid', fs)}
      </div>

      ${property.description ? `<div style="font-family:'Montserrat',sans-serif;font-size:${fs.body};color:${colors.textSecondary};line-height:1.6;margin-top:24px;max-width:550px;text-align:center;">${escapeHtml(truncate(property.description, 180))}</div>` : ''}

      <!-- Contact section -->
      <div style="width:100%;max-width:550px;margin-top:20px;text-align:left;">
        ${buildContactSection(colors, size, labels, 'panel', fs)}
      </div>
    </div>`);

  return slides;
}

// ============================================================
// LAYOUT REGISTRY & ENTRY POINT
// ============================================================

const LAYOUT_RENDERERS = {
  'hero-single': renderHeroSingle,
  'split-duo': renderSplitDuo,
  'feature-trio': renderFeatureTrio,
  'grid-quad': renderGridQuad,
  'grid-six': renderGridSix,
  'carousel-slides': renderCarouselSlides
};

function buildFullHtml(bodyContent, size) {
  const dim = SIZES[size];
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800;900&family=Playfair+Display:wght@400;600;700;800;900&family=Raleway:wght@500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${dim.width}px; height: ${dim.height}px; overflow: hidden; -webkit-font-smoothing: antialiased; }
    img { display: block; }
  </style>
</head>
<body>${bodyContent}</body>
</html>`;
}

function generateTemplate(templateConfig, property, openHouse, userLabels) {
  const { layout, postType, colorTheme, size, customColors } = templateConfig;
  const colors = getColors(colorTheme, customColors);
  const labels = { ...DEFAULT_LABELS, ...(userLabels || {}) };
  const renderer = LAYOUT_RENDERERS[layout];

  if (!renderer) {
    throw new Error(`Unknown layout: ${layout}`);
  }

  const result = renderer(property, colors, size, postType, openHouse, labels);

  // Carousel returns array of HTML strings
  if (Array.isArray(result)) {
    return result.map(slide => buildFullHtml(slide, size));
  }

  return buildFullHtml(result, size);
}

module.exports = {
  generateTemplate,
  LAYOUTS,
  POST_TYPES,
  THEME_NAMES,
  SIZE_NAMES,
  SIZES,
  COLOR_THEMES,
  DEFAULT_LABELS
};
