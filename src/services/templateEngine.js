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
  // Post type badges
  newListing: 'NEW LISTING',
  openHouse: 'OPEN HOUSE',
  justSold: 'SOLD',
  priceReduced: 'PRICE REDUCED',
  comingSoon: 'COMING SOON',
  // Section headers
  features: 'FEATURES',
  contact: 'CONTACT US FOR MORE!',
  // Stats
  bedrooms: 'BD',
  bathrooms: 'BA',
  // Carousel
  swipeForMore: 'SWIPE FOR MORE'
};

// ============================================================
// COLOR THEME DEFINITIONS (enhanced with panel/divider colors)
// ============================================================
const COLOR_THEMES = {
  dark: {
    bg: '#1a1a1a',
    bgSecondary: '#2d2d2d',
    bgPanel: 'rgba(20, 20, 20, 0.93)',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    accent: '#d4af37',
    accentLight: 'rgba(212, 175, 55, 0.12)',
    overlay: 'rgba(0, 0, 0, 0.65)',
    badge: '#d4af37',
    badgeText: '#1a1a1a',
    divider: 'rgba(212, 175, 55, 0.25)'
  },
  light: {
    bg: '#faf9f6',
    bgSecondary: '#f0ede8',
    bgPanel: 'rgba(250, 249, 246, 0.95)',
    text: '#2c2c2c',
    textSecondary: '#6b6b6b',
    accent: '#b8860b',
    accentLight: 'rgba(184, 134, 11, 0.08)',
    overlay: 'rgba(255, 255, 255, 0.85)',
    badge: '#2c2c2c',
    badgeText: '#ffffff',
    divider: 'rgba(184, 134, 11, 0.2)'
  },
  blue: {
    bg: '#0a1628',
    bgSecondary: '#152238',
    bgPanel: 'rgba(10, 22, 40, 0.94)',
    text: '#ffffff',
    textSecondary: '#8fa4c4',
    accent: '#4a90d9',
    accentLight: 'rgba(74, 144, 217, 0.12)',
    overlay: 'rgba(10, 22, 40, 0.75)',
    badge: '#4a90d9',
    badgeText: '#ffffff',
    divider: 'rgba(74, 144, 217, 0.25)'
  },
  gold: {
    bg: '#0d0d0d',
    bgSecondary: '#1a1a1a',
    bgPanel: 'rgba(13, 13, 13, 0.94)',
    text: '#e8d5a3',
    textSecondary: '#b8a06a',
    accent: '#d4a520',
    accentLight: 'rgba(212, 165, 32, 0.12)',
    overlay: 'rgba(0, 0, 0, 0.7)',
    badge: '#d4a520',
    badgeText: '#0d0d0d',
    divider: 'rgba(212, 165, 32, 0.25)'
  },
  minimal: {
    bg: '#ffffff',
    bgSecondary: '#f5f5f5',
    bgPanel: 'rgba(255, 255, 255, 0.95)',
    text: '#333333',
    textSecondary: '#999999',
    accent: '#333333',
    accentLight: 'rgba(51, 51, 51, 0.06)',
    overlay: 'rgba(255, 255, 255, 0.9)',
    badge: '#333333',
    badgeText: '#ffffff',
    divider: 'rgba(51, 51, 51, 0.15)'
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

    return {
      bg: primary,
      bgSecondary: isDark ? lighten(primary, 15) : darken(primary, 10),
      bgPanel: isDark ? `rgba(${r}, ${g}, ${b}, 0.93)` : `rgba(${r}, ${g}, ${b}, 0.95)`,
      text: isDark ? '#ffffff' : '#1a1a1a',
      textSecondary: isDark ? '#b0b0b0' : '#6b6b6b',
      accent: accent,
      accentLight: isDark ? `rgba(${parseInt(accent.slice(1, 3), 16)}, ${parseInt(accent.slice(3, 5), 16)}, ${parseInt(accent.slice(5, 7), 16)}, 0.12)` : `rgba(${parseInt(accent.slice(1, 3), 16)}, ${parseInt(accent.slice(3, 5), 16)}, ${parseInt(accent.slice(5, 7), 16)}, 0.08)`,
      overlay: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
      badge: accent,
      badgeText: isDark ? '#1a1a1a' : '#ffffff',
      divider: isDark ? `rgba(${parseInt(accent.slice(1, 3), 16)}, ${parseInt(accent.slice(3, 5), 16)}, ${parseInt(accent.slice(5, 7), 16)}, 0.25)` : `rgba(${parseInt(accent.slice(1, 3), 16)}, ${parseInt(accent.slice(3, 5), 16)}, ${parseInt(accent.slice(5, 7), 16)}, 0.2)`
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

// ============================================================
// SVG ICON SYSTEM
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
    arrow: `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none"><path d="M12 4l-1.41 1.41L16.17 11H4v2h12.17l-5.58 5.59L12 20l8-8-8-8z" fill="${color}"/></svg>`
  };
  return icons[name] || '';
}

// ============================================================
// SHARED COMPONENT BUILDERS
// ============================================================

function buildPhotoSlots(photos, count) {
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="800" height="600" fill="%23404040"/><rect x="340" y="230" width="120" height="100" rx="8" fill="none" stroke="%23666" stroke-width="4"/><circle cx="380" cy="270" r="12" fill="%23666"/><path d="M350 310 L380 280 L410 300 L430 285 L450 310" fill="none" stroke="%23666" stroke-width="3"/><text x="400" y="360" text-anchor="middle" font-family="Arial" font-size="18" fill="%23777">Photo</text></svg>'
  );
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(photos && photos[i] ? photos[i] : placeholder);
  }
  return result;
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

function buildBadge(postType, colors, property, openHouse, labels) {
  const label = getPostTypeBadge(postType, labels);
  if (!label) return '';

  let extra = '';
  if (postType === 'price-drop' && property.oldPrice) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:14px;margin-top:6px;">
      <span style="text-decoration:line-through;color:${colors.textSecondary};margin-right:8px;">${escapeHtml(property.oldPrice)}</span>
      <span style="color:${colors.accent};font-weight:700;">${escapeHtml(property.price)}</span>
    </div>`;
  }
  if (postType === 'open-house' && openHouse) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:15px;margin-top:4px;color:${colors.text};">
      ${openHouse.date ? escapeHtml(openHouse.date) : ''}${openHouse.date && openHouse.time ? ' · ' : ''}${openHouse.time ? escapeHtml(openHouse.time) : ''}
    </div>`;
  }

  if (postType === 'just-sold') {
    return `<div style="position:absolute;top:20px;right:20px;z-index:10;">
      <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:800;font-size:22px;padding:10px 24px;letter-spacing:3px;transform:rotate(3deg);border:3px solid ${colors.badgeText};box-shadow:0 4px 20px rgba(0,0,0,0.3);">${escapeHtml(label)}</div>
      ${extra}
    </div>`;
  }

  return `<div style="position:absolute;top:20px;left:20px;z-index:10;">
    <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:700;font-size:15px;padding:10px 24px;letter-spacing:2.5px;box-shadow:0 2px 10px rgba(0,0,0,0.2);">${escapeHtml(label)}</div>
    ${extra}
  </div>`;
}

function buildInlineBadge(postType, colors, labels) {
  const label = getPostTypeBadge(postType, labels);
  if (!label) return '';
  return `<span style="display:inline-block;background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:700;font-size:14px;padding:8px 18px;letter-spacing:2.5px;margin-right:12px;vertical-align:middle;">${escapeHtml(label)}</span>`;
}

function buildSectionHeader(text, colors, fontSize) {
  if (!text) return '';
  return `<div style="font-family:'Raleway','Montserrat',sans-serif;font-weight:800;font-size:${fontSize || '15px'};letter-spacing:3px;color:${colors.accent};text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
    <span style="display:inline-block;width:30px;height:3px;background:${colors.accent};"></span>
    ${escapeHtml(text)}
  </div>`;
}

function buildLocationHtml(location, colors, fontSize) {
  if (!location) return '';
  const fs = parseInt(fontSize) || 16;
  return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
    ${svgIcon('pin', colors.accent, fs + 2)}
    <span style="font-family:'Montserrat',sans-serif;font-size:${fs}px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(location)}</span>
  </div>`;
}

function buildPriceHtml(property, postType, colors, fontSize, style) {
  fontSize = fontSize || '28px';
  style = style || 'banner';

  if (postType === 'price-drop') {
    return `<div style="font-family:'Montserrat',sans-serif;margin-bottom:8px;">
      ${property.oldPrice ? `<span style="text-decoration:line-through;color:${colors.textSecondary};font-size:${parseInt(fontSize) - 6}px;margin-right:10px;">${escapeHtml(property.oldPrice)}</span>` : ''}
      ${property.price ? `<span style="font-weight:800;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;">${escapeHtml(property.price)}</span>` : ''}
    </div>`;
  }
  if (!property.price) return '';

  if (style === 'banner') {
    return `<div style="display:inline-block;background:${colors.accent};padding:8px 20px;margin-bottom:10px;">
      <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${fontSize};color:${colors.badgeText};letter-spacing:1px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  if (style === 'highlight') {
    return `<div style="display:inline-block;background:${colors.accentLight};border-left:3px solid ${colors.accent};padding:6px 16px;margin-bottom:10px;">
      <span style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;">${escapeHtml(property.price)}</span>
    </div>`;
  }

  // 'inline' style
  return `<div style="font-family:'Montserrat',sans-serif;font-weight:800;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;margin-bottom:8px;">${escapeHtml(property.price)}</div>`;
}

function buildPropertyStats(property, colors, isCompact, labels) {
  const stats = [];
  if (property.bedrooms) stats.push({ icon: 'bed', value: property.bedrooms, label: labels.bedrooms });
  if (property.bathrooms) stats.push({ icon: 'bath', value: property.bathrooms, label: labels.bathrooms });
  if (property.area) stats.push({ icon: 'area', value: property.area, label: '' });
  if (stats.length === 0) return '';

  const iconSize = isCompact ? 20 : 24;
  const fontSize = isCompact ? '16px' : '18px';
  const labelSize = isCompact ? '13px' : '14px';
  const gap = isCompact ? '20px' : '28px';

  const items = stats.map(s =>
    `<div style="display:flex;align-items:center;gap:8px;">
      ${svgIcon(s.icon, colors.accent, iconSize)}
      <span style="font-family:'Montserrat',sans-serif;font-weight:600;font-size:${fontSize};color:${colors.text};">${escapeHtml(String(s.value))}</span>
      ${s.label ? `<span style="font-family:'Montserrat',sans-serif;font-size:${labelSize};color:${colors.textSecondary};letter-spacing:1px;">${escapeHtml(s.label)}</span>` : ''}
    </div>`
  ).join('');

  return `<div style="display:flex;align-items:center;gap:${gap};margin:10px 0;">${items}</div>`;
}

function buildFeaturesHtml(features, colors, labels, maxItems) {
  if (!features || features.length === 0) return '';
  const items = features.slice(0, maxItems || 6);

  const header = labels.features
    ? buildSectionHeader(labels.features, colors, '14px')
    : '';

  const list = items.map(f =>
    `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
      ${svgIcon('check', colors.accent, 20)}
      <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.text};line-height:1.4;">${escapeHtml(f)}</span>
    </div>`
  ).join('');

  return `<div style="margin-top:10px;">${header}${list}</div>`;
}

function buildContactSection(colors, size, labels, style) {
  const agent = agentConfig;
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';

  if (style === 'panel') {
    // Embedded contact section (used inside info panels)
    const ctaHeader = labels.contact
      ? `<div style="font-family:'Raleway','Montserrat',sans-serif;font-weight:800;font-size:14px;letter-spacing:3px;color:${colors.accent};text-transform:uppercase;margin-bottom:12px;display:flex;align-items:center;gap:10px;">
          <span style="display:inline-block;width:30px;height:3px;background:${colors.accent};"></span>
          ${escapeHtml(labels.contact)}
        </div>`
      : '';

    return `<div style="margin-top:14px;">
      ${ctaHeader}
      ${agent.phone ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
        ${svgIcon('phone', colors.accent, 20)}
        <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.text};">${escapeHtml(agent.phone)}</span>
      </div>` : ''}
      ${agent.email ? `<div style="display:flex;align-items:center;gap:10px;margin-bottom:7px;">
        ${svgIcon('email', colors.accent, 20)}
        <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.text};">${escapeHtml(agent.email)}</span>
      </div>` : ''}
      <div style="display:flex;align-items:center;gap:12px;margin-top:10px;">
        ${agent.logo ? `<img src="${agent.logo}" style="height:40px;width:40px;object-fit:cover;border-radius:50%;border:2px solid ${colors.accent};" crossorigin="anonymous" onerror="this.style.display='none'"/>` : ''}
        <div>
          <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:16px;color:${colors.text};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
          ${agent.title ? `<div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};letter-spacing:0.5px;">${escapeHtml(agent.title)}</div>` : ''}
        </div>
      </div>
    </div>`;
  }

  // 'bar' style — bottom-anchored enhanced bar
  const barHeight = isFB ? '85px' : '95px';
  const nameSize = isFB ? '14px' : '16px';
  const infoSize = isFB ? '13px' : '14px';

  return `<div style="position:absolute;bottom:0;left:0;right:0;height:${barHeight};background:${colors.bgSecondary};display:flex;align-items:center;padding:0 32px;gap:18px;border-top:3px solid ${colors.accent};">
    ${agent.logo ? `<img src="${agent.logo}" style="height:48px;width:48px;object-fit:cover;border-radius:50%;border:2px solid ${colors.accent};" crossorigin="anonymous" onerror="this.style.display='none'"/>` : ''}
    <div style="flex:1;min-width:0;">
      <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:${nameSize};color:${colors.text};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
      ${agent.title ? `<div style="font-family:'Montserrat',sans-serif;font-size:${isFB ? '12px' : '13px'};color:${colors.textSecondary};margin-top:2px;">${escapeHtml(agent.title)}</div>` : ''}
    </div>
    <div style="display:flex;flex-direction:column;gap:4px;align-items:flex-end;">
      ${agent.phone ? `<div style="display:flex;align-items:center;gap:8px;">
        ${svgIcon('phone', colors.accent, 16)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.textSecondary};">${escapeHtml(agent.phone)}</span>
      </div>` : ''}
      ${agent.email ? `<div style="display:flex;align-items:center;gap:8px;">
        ${svgIcon('email', colors.accent, 16)}
        <span style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.textSecondary};">${escapeHtml(agent.email)}</span>
      </div>` : ''}
    </div>
    ${agent.website ? `<div style="font-family:'Montserrat',sans-serif;font-size:${infoSize};color:${colors.accent};text-align:right;">${escapeHtml(agent.website)}</div>` : ''}
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

  // For all sizes: full-bleed photo background + info panel overlay
  // Square/FB: info panel on the left ~42%
  // Story: info panel at bottom ~48%
  if (isStory) {
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <img src="${photos[0]}" style="width:100%;height:55%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
        <div style="position:absolute;top:0;left:0;right:0;height:55%;background:linear-gradient(to top, ${colors.bg} 0%, transparent 50%);"></div>
        ${buildBadge(postType, colors, property, openHouse, labels)}
        <!-- Info panel bottom -->
        <div style="position:absolute;bottom:0;left:0;right:0;top:52%;background:${colors.bg};padding:30px 40px 40px;display:flex;flex-direction:column;justify-content:center;">
          <div style="width:50px;height:3px;background:${colors.accent};margin-bottom:16px;"></div>
          ${buildPriceHtml(property, postType, colors, '34px', 'banner')}
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:36px;color:${colors.text};line-height:1.15;margin-bottom:10px;">${escapeHtml(truncate(property.title, 55))}</div>
          ${buildLocationHtml(property.location, colors, '14px')}
          ${buildPropertyStats(property, colors, false, labels)}
          ${buildFeaturesHtml(property.features, colors, labels, 5)}
          ${buildContactSection(colors, size, labels, 'panel')}
        </div>
      </div>`;
  }

  // Square (instagram-post) and Facebook
  const panelWidth = isFB ? '44%' : '46%';
  const titleSize = isFB ? '28px' : '36px';
  const priceSize = isFB ? '26px' : '32px';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Photo right side -->
      <div style="position:absolute;top:0;right:0;bottom:0;width:${isFB ? '58%' : '56%'};overflow:hidden;">
        <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/>
      </div>
      <!-- Info panel left side -->
      <div style="position:absolute;top:0;left:0;bottom:0;width:${panelWidth};background:${colors.bg};padding:${isFB ? '24px 28px' : '36px 36px'};display:flex;flex-direction:column;justify-content:center;z-index:2;">
        ${postType !== 'just-sold' ? `<div style="margin-bottom:12px;">${buildInlineBadge(postType, colors, labels)}</div>` : ''}
        <div style="width:40px;height:3px;background:${colors.accent};margin-bottom:14px;"></div>
        ${buildPriceHtml(property, postType, colors, priceSize, 'banner')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${titleSize};color:${colors.text};line-height:1.15;margin-bottom:10px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${buildLocationHtml(property.location, colors, isFB ? '14' : '16')}
        ${buildPropertyStats(property, colors, isFB, labels)}
        ${buildFeaturesHtml(property.features, colors, labels, isFB ? 3 : 4)}
        ${buildContactSection(colors, size, labels, 'panel')}
      </div>
      ${postType === 'just-sold' ? buildBadge(postType, colors, property, openHouse, labels) : ''}
      <!-- Accent stripe between panel and photo -->
      <div style="position:absolute;top:0;bottom:0;left:${panelWidth};width:4px;background:${colors.accent};z-index:3;"></div>
    </div>`;
}

function renderSplitDuo(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 2);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';

  if (isStory) {
    // Story: info panel top ~35%, two photos stacked below
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Info panel top -->
        <div style="padding:36px 40px;height:38%;display:flex;flex-direction:column;justify-content:center;background:${colors.bg};">
          ${buildInlineBadge(postType, colors, labels)}
          <div style="width:40px;height:3px;background:${colors.accent};margin:12px 0;"></div>
          ${buildPriceHtml(property, postType, colors, '32px', 'banner')}
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:34px;color:${colors.text};line-height:1.15;margin-bottom:8px;">${escapeHtml(truncate(property.title, 50))}</div>
          ${buildLocationHtml(property.location, colors, '14px')}
          ${buildPropertyStats(property, colors, false, labels)}
        </div>
        <!-- Accent divider -->
        <div style="height:4px;background:${colors.accent};"></div>
        <!-- Two photos stacked -->
        <div style="display:flex;flex-direction:column;gap:4px;flex:1;height:62%;">
          <div style="flex:1;overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
          <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        </div>
        <!-- Features + Contact overlay at bottom -->
        <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, ${colors.bg} 0%, ${colors.bg}ee 70%, transparent 100%);padding:20px 40px 30px;">
          ${buildFeaturesHtml(property.features, colors, labels, 4)}
          ${buildContactSection(colors, size, labels, 'panel')}
        </div>
      </div>`;
  }

  // Square and Facebook: info panel left ~42%, two photos stacked right ~58%
  const panelWidth = isFB ? '40%' : '44%';
  const photoWidth = isFB ? '60%' : '56%';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Info panel left -->
      <div style="position:absolute;top:0;left:0;bottom:0;width:${panelWidth};background:${colors.bg};padding:${isFB ? '24px 28px' : '34px 36px'};display:flex;flex-direction:column;justify-content:center;z-index:2;">
        ${buildInlineBadge(postType, colors, labels)}
        <div style="width:40px;height:3px;background:${colors.accent};margin:12px 0;"></div>
        ${buildPriceHtml(property, postType, colors, isFB ? '26px' : '30px', 'banner')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isFB ? '26px' : '32px'};color:${colors.text};line-height:1.15;margin-bottom:10px;">${escapeHtml(truncate(property.title, 45))}</div>
        ${buildLocationHtml(property.location, colors, isFB ? '13' : '15')}
        ${buildPropertyStats(property, colors, isFB, labels)}
        ${buildFeaturesHtml(property.features, colors, labels, isFB ? 3 : 5)}
        ${buildContactSection(colors, size, labels, 'panel')}
      </div>
      <!-- Accent stripe -->
      <div style="position:absolute;top:0;bottom:0;left:${panelWidth};width:4px;background:${colors.accent};z-index:3;"></div>
      <!-- Two photos stacked right -->
      <div style="position:absolute;top:0;right:0;bottom:0;width:${photoWidth};display:flex;flex-direction:column;gap:4px;">
        <div style="flex:1;overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
      </div>
    </div>`;
}

function renderFeatureTrio(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 3);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';

  if (isStory) {
    // Story: photos top ~52%, info panel bottom ~48%
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        ${buildBadge(postType, colors, property, openHouse, labels)}
        <!-- L-shape photos at top -->
        <div style="display:flex;height:52%;gap:4px;">
          <div style="flex:1.2;overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
          <div style="flex:0.8;display:flex;flex-direction:column;gap:4px;">
            <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
            <div style="flex:1;overflow:hidden;"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
          </div>
        </div>
        <!-- Accent divider -->
        <div style="height:4px;background:${colors.accent};"></div>
        <!-- Info panel bottom -->
        <div style="padding:28px 36px;display:flex;flex-direction:column;justify-content:center;flex:1;">
          <div style="width:40px;height:3px;background:${colors.accent};margin-bottom:14px;"></div>
          ${buildPriceHtml(property, postType, colors, '30px', 'banner')}
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:32px;color:${colors.text};line-height:1.15;margin-bottom:8px;">${escapeHtml(truncate(property.title, 50))}</div>
          ${buildLocationHtml(property.location, colors, '14px')}
          ${buildPropertyStats(property, colors, false, labels)}
          ${buildFeaturesHtml(property.features, colors, labels, 5)}
          ${buildContactSection(colors, size, labels, 'panel')}
        </div>
      </div>`;
  }

  // Square and Facebook: L-shape photo grid top + info bar bottom
  const photoHeight = isFB ? '58%' : '56%';
  const barHeight = isFB ? '85px' : '95px';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse, labels)}
      <!-- L-shape photo grid -->
      <div style="display:flex;height:${photoHeight};gap:4px;">
        <div style="flex:1.2;overflow:hidden;position:relative;">
          <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/>
          <!-- Floating info on large photo -->
          <div style="position:absolute;bottom:0;left:0;right:0;background:linear-gradient(to top, ${colors.bg}ee 0%, ${colors.bg}cc 60%, transparent 100%);padding:20px 24px;">
            ${buildPriceHtml(property, postType, colors, isFB ? '26px' : '32px', 'inline')}
            <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isFB ? '24px' : '30px'};color:${colors.text};line-height:1.15;">${escapeHtml(truncate(property.title, 40))}</div>
          </div>
        </div>
        <div style="flex:0.8;display:flex;flex-direction:column;gap:4px;">
          <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
          <div style="flex:1;overflow:hidden;"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        </div>
      </div>
      <!-- Info section below photos -->
      <div style="position:absolute;bottom:${parseInt(barHeight)}px;left:0;right:0;top:${photoHeight};background:${colors.bg};padding:${isFB ? '14px 28px' : '18px 36px'};display:flex;align-items:center;gap:28px;border-top:3px solid ${colors.accent};">
        <div style="flex:1;min-width:0;">
          ${buildLocationHtml(property.location, colors, isFB ? '14' : '16')}
          ${buildPropertyStats(property, colors, false, labels)}
        </div>
        <div style="display:flex;flex-direction:column;gap:5px;align-items:flex-end;">
          ${property.features ? property.features.slice(0, 3).map(f =>
            `<div style="display:flex;align-items:center;gap:8px;">
              ${svgIcon('check', colors.accent, 18)}
              <span style="font-family:'Montserrat',sans-serif;font-size:15px;color:${colors.text};">${escapeHtml(f)}</span>
            </div>`
          ).join('') : ''}
        </div>
      </div>
      ${buildContactSection(colors, size, labels, 'bar')}
    </div>`;
}

function renderGridQuad(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 4);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';

  if (isStory) {
    // Story: header + 2x2 grid + features panel
    const barHeight = 90;
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Header -->
        <div style="padding:28px 36px 20px;background:${colors.bg};">
          ${buildInlineBadge(postType, colors, labels)}
          <div style="width:40px;height:3px;background:${colors.accent};margin:10px 0;"></div>
          ${buildPriceHtml(property, postType, colors, '30px', 'banner')}
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:30px;color:${colors.text};line-height:1.15;margin-bottom:6px;">${escapeHtml(truncate(property.title, 45))}</div>
          ${buildLocationHtml(property.location, colors, '13px')}
        </div>
        <!-- Accent divider -->
        <div style="height:3px;background:${colors.accent};"></div>
        <!-- 2x2 photo grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;position:absolute;top:240px;bottom:400px;left:0;right:0;">
          ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>`).join('')}
        </div>
        <!-- Features + Contact at bottom -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:400px;background:${colors.bg};padding:24px 36px;display:flex;flex-direction:column;justify-content:center;border-top:3px solid ${colors.accent};">
          ${buildPropertyStats(property, colors, false, labels)}
          ${buildFeaturesHtml(property.features, colors, labels, 5)}
          ${buildContactSection(colors, size, labels, 'panel')}
        </div>
      </div>`;
  }

  // Square and Facebook: 2x2 grid fills canvas + central floating overlay
  const barHeight = isFB ? 85 : 95;
  const overlayWidth = isFB ? '380px' : '480px';
  const overlayPad = isFB ? '22px 28px' : '30px 38px';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse, labels)}
      <!-- 2x2 photo grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;position:absolute;top:0;bottom:${barHeight}px;left:0;right:0;">
        ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>`).join('')}
      </div>
      <!-- Central floating overlay -->
      <div style="position:absolute;top:50%;left:50%;transform:translate(-50%, -55%);width:${overlayWidth};background:${colors.bgPanel};border:2px solid ${colors.accent};padding:${overlayPad};z-index:5;text-align:center;">
        ${buildPriceHtml(property, postType, colors, isFB ? '28px' : '34px', 'inline')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isFB ? '26px' : '32px'};color:${colors.text};line-height:1.2;margin-bottom:10px;">${escapeHtml(truncate(property.title, 40))}</div>
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:8px;">
          ${svgIcon('pin', colors.accent, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:15px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        <div style="width:50px;height:2px;background:${colors.accent};margin:10px auto;"></div>
        <div style="display:flex;justify-content:center;">${buildPropertyStats(property, colors, false, labels)}</div>
      </div>
      ${buildContactSection(colors, size, labels, 'bar')}
    </div>`;
}

function renderGridSix(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 6);
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const barHeight = isFB ? 85 : 95;

  // Header height varies by size
  const headerHeight = isStory ? 150 : (isFB ? 110 : 130);

  // Open house extra info
  let openHouseInfo = '';
  if (postType === 'open-house' && openHouse) {
    openHouseInfo = `<div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.text};margin-top:4px;">
      ${openHouse.date ? escapeHtml(openHouse.date) : ''}${openHouse.date && openHouse.time ? ' · ' : ''}${openHouse.time ? escapeHtml(openHouse.time) : ''}
    </div>`;
  }

  if (isStory) {
    // Story: tall header + 3x2 grid + features/contact at bottom
    return `
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <!-- Header strip -->
        <div style="padding:24px 32px;background:${colors.bg};height:${headerHeight}px;display:flex;flex-direction:column;justify-content:center;border-bottom:3px solid ${colors.accent};">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:6px;">
            ${buildInlineBadge(postType, colors, labels)}
            <span style="font-family:'Playfair Display',serif;font-weight:700;font-size:26px;color:${colors.text};">${escapeHtml(truncate(property.title, 35))}</span>
          </div>
          <div style="display:flex;align-items:center;gap:16px;">
            ${buildPriceHtml(property, postType, colors, '22px', 'highlight')}
            ${property.location ? `<div style="display:flex;align-items:center;gap:4px;">
              ${svgIcon('pin', colors.accent, 14)}
              <span style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
            </div>` : ''}
          </div>
          ${openHouseInfo}
        </div>
        <!-- 3x2 photo grid -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;position:absolute;top:${headerHeight}px;bottom:480px;left:0;right:0;">
          ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>`).join('')}
        </div>
        <!-- Features + Contact at bottom -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:480px;background:${colors.bg};padding:24px 36px;display:flex;flex-direction:column;justify-content:center;border-top:3px solid ${colors.accent};">
          ${buildPropertyStats(property, colors, false, labels)}
          ${buildFeaturesHtml(property.features, colors, labels, 6)}
          ${buildContactSection(colors, size, labels, 'panel')}
        </div>
      </div>`;
  }

  // Square and Facebook: header strip + grid + agent bar
  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Header strip -->
      <div style="padding:${isFB ? '14px 28px' : '20px 36px'};background:${colors.bg};height:${headerHeight}px;display:flex;flex-direction:column;justify-content:center;border-bottom:3px solid ${colors.accent};">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:8px;">
          ${buildInlineBadge(postType, colors, labels)}
          <span style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isFB ? '22px' : '26px'};color:${colors.text};">${escapeHtml(truncate(property.title, 35))}</span>
        </div>
        <div style="display:flex;align-items:center;gap:18px;">
          ${buildPriceHtml(property, postType, colors, isFB ? '20px' : '22px', 'highlight')}
          ${property.location ? `<div style="display:flex;align-items:center;gap:6px;">
            ${svgIcon('pin', colors.accent, 16)}
            <span style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
          </div>` : ''}
        </div>
        ${openHouseInfo}
      </div>
      <!-- 3x2 photo grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;position:absolute;top:${headerHeight}px;bottom:${barHeight}px;left:0;right:0;">
        ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>`).join('')}
      </div>
      ${buildContactSection(colors, size, labels, 'bar')}
    </div>`;
}

function renderCarouselSlides(property, colors, size, postType, openHouse, labels) {
  const dim = SIZES[size];
  const photos = property.photos || [];
  const slides = [];
  const isStory = size === 'instagram-story';

  // ── Slide 1: Cover slide ──
  const coverPhoto = photos[0] || buildPhotoSlots([], 1)[0];
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <img src="${coverPhoto}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to top, ${colors.bg} 5%, ${colors.overlay} 45%, transparent 75%);"></div>
      ${buildBadge(postType, colors, property, openHouse, labels)}
      <div style="position:absolute;bottom:${isStory ? '60px' : '40px'};left:0;right:0;padding:0 44px;text-align:center;">
        ${buildPriceHtml(property, postType, colors, isStory ? '36px' : '34px', 'banner')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isStory ? '40px' : '36px'};color:${colors.text};line-height:1.15;margin-bottom:10px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:12px;">
          ${svgIcon('pin', colors.text, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        <div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-top:20px;">
          <span style="font-family:'Montserrat',sans-serif;font-size:15px;color:${colors.textSecondary};letter-spacing:1.5px;">${escapeHtml(labels.swipeForMore)}</span>
          ${svgIcon('arrow', colors.accent, 18)}
        </div>
      </div>
    </div>`);

  // ── Photo slides ──
  for (let i = 1; i < photos.length; i++) {
    slides.push(`
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <img src="${photos[i]}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
        <!-- Bottom address strip -->
        <div style="position:absolute;bottom:0;left:0;right:0;height:70px;background:linear-gradient(to top, ${colors.bg}ee, transparent);display:flex;align-items:flex-end;padding:0 24px 16px;justify-content:space-between;">
          ${property.location ? `<div style="display:flex;align-items:center;gap:6px;">
            ${svgIcon('pin', colors.accent, 14)}
            <span style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.text};letter-spacing:1px;">${escapeHtml(property.location)}</span>
          </div>` : '<div></div>'}
          <div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};background:${colors.bgPanel};padding:4px 12px;border-radius:12px;letter-spacing:1px;">${i + 1}/${photos.length + 1}</div>
        </div>
        <!-- Accent frame top -->
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:${colors.accent};"></div>
      </div>`);
  }

  // ── Details slide (last) ──
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:${isStory ? '60px 50px' : '50px 60px'};">
      <!-- Decorative corner -->
      <div style="position:absolute;top:0;left:0;width:80px;height:80px;border-top:4px solid ${colors.accent};border-left:4px solid ${colors.accent};"></div>
      <div style="position:absolute;bottom:0;right:0;width:80px;height:80px;border-bottom:4px solid ${colors.accent};border-right:4px solid ${colors.accent};"></div>

      <div style="text-align:center;width:100%;max-width:600px;">
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isStory ? '38px' : '34px'};color:${colors.text};line-height:1.2;margin-bottom:12px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:14px;">
          ${svgIcon('pin', colors.accent, 18)}
          <span style="font-family:'Montserrat',sans-serif;font-size:16px;color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;">${escapeHtml(property.location)}</span>
        </div>` : ''}
        ${buildPriceHtml(property, postType, colors, isStory ? '36px' : '32px', 'banner')}
        <div style="width:60px;height:2px;background:${colors.accent};margin:16px auto;"></div>
        <div style="display:flex;justify-content:center;">${buildPropertyStats(property, colors, false, labels)}</div>
      </div>

      <!-- Features section -->
      <div style="width:100%;max-width:500px;margin-top:20px;text-align:left;">
        ${buildFeaturesHtml(property.features, colors, labels, 6)}
      </div>

      ${property.description ? `<div style="font-family:'Montserrat',sans-serif;font-size:15px;color:${colors.textSecondary};line-height:1.6;margin-top:20px;max-width:500px;text-align:center;">${escapeHtml(truncate(property.description, 180))}</div>` : ''}

      <!-- Contact section -->
      <div style="width:100%;max-width:500px;margin-top:16px;text-align:left;">
        ${buildContactSection(colors, size, labels, 'panel')}
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
