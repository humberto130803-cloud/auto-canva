const fs = require('fs');
const path = require('path');

const agentConfig = require('../../config/agent.json');

// Size definitions
const SIZES = {
  'instagram-post': { width: 1080, height: 1080 },
  'instagram-story': { width: 1080, height: 1920 },
  'facebook-post': { width: 1200, height: 630 }
};

// Color theme definitions
const COLOR_THEMES = {
  dark: {
    bg: '#1a1a1a',
    bgSecondary: '#2d2d2d',
    text: '#ffffff',
    textSecondary: '#b0b0b0',
    accent: '#d4af37',
    overlay: 'rgba(0, 0, 0, 0.65)',
    badge: '#d4af37',
    badgeText: '#1a1a1a'
  },
  light: {
    bg: '#faf9f6',
    bgSecondary: '#f0ede8',
    text: '#2c2c2c',
    textSecondary: '#6b6b6b',
    accent: '#b8860b',
    overlay: 'rgba(255, 255, 255, 0.85)',
    badge: '#2c2c2c',
    badgeText: '#ffffff'
  },
  blue: {
    bg: '#0a1628',
    bgSecondary: '#152238',
    text: '#ffffff',
    textSecondary: '#8fa4c4',
    accent: '#4a90d9',
    overlay: 'rgba(10, 22, 40, 0.75)',
    badge: '#4a90d9',
    badgeText: '#ffffff'
  },
  gold: {
    bg: '#0d0d0d',
    bgSecondary: '#1a1a1a',
    text: '#e8d5a3',
    textSecondary: '#b8a06a',
    accent: '#d4a520',
    overlay: 'rgba(0, 0, 0, 0.7)',
    badge: '#d4a520',
    badgeText: '#0d0d0d'
  },
  minimal: {
    bg: '#ffffff',
    bgSecondary: '#f5f5f5',
    text: '#333333',
    textSecondary: '#999999',
    accent: '#333333',
    overlay: 'rgba(255, 255, 255, 0.9)',
    badge: '#333333',
    badgeText: '#ffffff'
  }
};

const LAYOUTS = ['hero-single', 'split-duo', 'feature-trio', 'grid-quad', 'grid-six', 'carousel-slides'];
const POST_TYPES = ['new-listing', 'open-house', 'just-sold', 'price-drop', 'coming-soon'];
const THEME_NAMES = ['dark', 'light', 'blue', 'gold', 'minimal', 'custom'];
const SIZE_NAMES = Object.keys(SIZES);

function getColors(theme, customColors) {
  if (theme === 'custom' && customColors) {
    const primary = customColors.primary || '#1a1a2e';
    const accent = customColors.accent || '#e2b659';
    // Determine if primary is dark or light
    const r = parseInt(primary.slice(1, 3), 16);
    const g = parseInt(primary.slice(3, 5), 16);
    const b = parseInt(primary.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    const isDark = luminance < 0.5;

    return {
      bg: primary,
      bgSecondary: isDark ? lighten(primary, 15) : darken(primary, 10),
      text: isDark ? '#ffffff' : '#1a1a1a',
      textSecondary: isDark ? '#b0b0b0' : '#6b6b6b',
      accent: accent,
      overlay: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(255,255,255,0.85)',
      badge: accent,
      badgeText: isDark ? '#1a1a1a' : '#ffffff'
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

function getPostTypeBadge(postType) {
  const badges = {
    'new-listing': 'NEW LISTING',
    'open-house': 'OPEN HOUSE',
    'just-sold': 'SOLD',
    'price-drop': 'PRICE REDUCED',
    'coming-soon': 'COMING SOON'
  };
  return badges[postType] || '';
}

function truncate(str, maxLen) {
  if (!str) return '';
  return str.length > maxLen ? str.slice(0, maxLen - 1) + '…' : str;
}

function buildPriceHtml(property, postType, colors, fontSize) {
  fontSize = fontSize || '28px';
  if (postType === 'price-drop') {
    return `<div style="font-family:'Montserrat',sans-serif;margin-bottom:6px;">
      ${property.oldPrice ? `<span style="text-decoration:line-through;color:${colors.textSecondary};font-size:${parseInt(fontSize) - 6}px;margin-right:10px;">${escapeHtml(property.oldPrice)}</span>` : ''}
      ${property.price ? `<span style="font-weight:700;font-size:${fontSize};color:${colors.accent};">${escapeHtml(property.price)}</span>` : ''}
    </div>`;
  }
  if (!property.price) return '';
  return `<div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:${fontSize};color:${colors.accent};letter-spacing:1px;margin-bottom:6px;">${escapeHtml(property.price)}</div>`;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildPhotoSlots(photos, count) {
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" fill="%23cccccc"><rect width="800" height="600" fill="%23e0e0e0"/><text x="400" y="300" text-anchor="middle" font-family="Arial" font-size="32" fill="%23999">No Photo</text></svg>'
  );
  const result = [];
  for (let i = 0; i < count; i++) {
    result.push(photos && photos[i] ? photos[i] : placeholder);
  }
  return result;
}

function buildFeaturesHtml(features, colors) {
  if (!features || features.length === 0) return '';
  return features.map(f =>
    `<span style="display:inline-block;padding:4px 12px;margin:2px 4px;border:1px solid ${colors.accent};border-radius:3px;font-size:12px;letter-spacing:1px;color:${colors.text};font-family:'Montserrat',sans-serif;">${escapeHtml(f)}</span>`
  ).join('');
}

function buildPropertyStats(property, colors, isCompact) {
  const stats = [];
  if (property.bedrooms) stats.push(`${property.bedrooms} BD`);
  if (property.bathrooms) stats.push(`${property.bathrooms} BA`);
  if (property.area) stats.push(property.area);
  if (stats.length === 0) return '';

  const sep = `<span style="margin:0 8px;color:${colors.accent};">|</span>`;
  const fontSize = isCompact ? '14px' : '16px';
  return `<div style="font-family:'Montserrat',sans-serif;font-size:${fontSize};color:${colors.textSecondary};letter-spacing:1.5px;margin-top:6px;">${stats.join(sep)}</div>`;
}

function buildAgentBar(colors, size) {
  const agent = agentConfig;
  const isStory = size === 'instagram-story';
  const isFB = size === 'facebook-post';
  const barHeight = isFB ? '60px' : '70px';
  const fontSize = isFB ? '11px' : '12px';
  const nameSize = isFB ? '13px' : '14px';

  return `
    <div style="position:absolute;bottom:0;left:0;right:0;height:${barHeight};background:${colors.bgSecondary};display:flex;align-items:center;padding:0 24px;gap:14px;border-top:2px solid ${colors.accent};">
      ${agent.logo ? `<img src="${agent.logo}" style="height:38px;width:38px;object-fit:contain;border-radius:4px;" crossorigin="anonymous" onerror="this.style.display='none'"/>` : ''}
      <div style="flex:1;min-width:0;">
        <div style="font-family:'Montserrat',sans-serif;font-weight:700;font-size:${nameSize};color:${colors.text};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(agent.name)}</div>
        <div style="font-family:'Montserrat',sans-serif;font-size:${fontSize};color:${colors.textSecondary};margin-top:2px;">
          ${agent.phone ? escapeHtml(agent.phone) : ''}${agent.phone && agent.email ? ' · ' : ''}${agent.email ? escapeHtml(agent.email) : ''}
        </div>
      </div>
      ${agent.website ? `<div style="font-family:'Montserrat',sans-serif;font-size:${fontSize};color:${colors.accent};text-align:right;">${escapeHtml(agent.website)}</div>` : ''}
    </div>`;
}

function buildBadge(postType, colors, property, openHouse) {
  const label = getPostTypeBadge(postType);
  if (!label) return '';

  let extra = '';
  if (postType === 'price-drop' && property.oldPrice) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:14px;margin-top:4px;">
      <span style="text-decoration:line-through;color:${colors.textSecondary};margin-right:8px;">${escapeHtml(property.oldPrice)}</span>
      <span style="color:${colors.accent};font-weight:700;">${escapeHtml(property.price)}</span>
    </div>`;
  }
  if (postType === 'open-house' && openHouse) {
    extra = `<div style="font-family:'Montserrat',sans-serif;font-size:13px;margin-top:4px;color:${colors.text};">
      ${openHouse.date ? escapeHtml(openHouse.date) : ''}${openHouse.date && openHouse.time ? ' · ' : ''}${openHouse.time ? escapeHtml(openHouse.time) : ''}
    </div>`;
  }

  if (postType === 'just-sold') {
    return `<div style="position:absolute;top:20px;right:20px;z-index:10;">
      <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:800;font-size:22px;padding:10px 24px;letter-spacing:3px;transform:rotate(3deg);border:3px solid ${colors.badgeText};box-shadow:0 4px 20px rgba(0,0,0,0.3);">${label}</div>
      ${extra}
    </div>`;
  }

  return `<div style="position:absolute;top:20px;left:20px;z-index:10;">
    <div style="background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:700;font-size:13px;padding:8px 20px;letter-spacing:2.5px;box-shadow:0 2px 10px rgba(0,0,0,0.2);">${label}</div>
    ${extra}
  </div>`;
}

// ============================================================
// LAYOUT RENDERERS
// ============================================================

function renderHeroSingle(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 1);
  const agentBarHeight = size === 'facebook-post' ? 60 : 70;
  const isStory = size === 'instagram-story';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to top, ${colors.bg} 0%, ${colors.overlay} 30%, transparent 60%);"></div>
      ${buildBadge(postType, colors, property, openHouse)}
      <div style="position:absolute;bottom:${agentBarHeight + 20}px;left:0;right:0;padding:0 40px;">
        ${buildPriceHtml(property, postType, colors, isStory ? '36px' : '32px')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isStory ? '38px' : '34px'};color:${colors.text};line-height:1.15;margin-bottom:8px;">${escapeHtml(truncate(property.title, 60))}</div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">${escapeHtml(property.location)}</div>` : ''}
        ${buildPropertyStats(property, colors, false)}
        ${property.features ? `<div style="margin-top:12px;">${buildFeaturesHtml(property.features.slice(0, 4), colors)}</div>` : ''}
      </div>
      ${buildAgentBar(colors, size)}
    </div>`;
}

function renderSplitDuo(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 2);
  const agentBarHeight = size === 'facebook-post' ? 60 : 70;
  const isStory = size === 'instagram-story';
  const photoHeight = isStory ? '55%' : '60%';
  const infoHeight = isStory ? '45%' : '40%';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse)}
      <div style="display:flex;height:${photoHeight};gap:4px;">
        <div style="flex:1;overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
      </div>
      <div style="height:${infoHeight};padding:${isStory ? '30px 36px' : '24px 36px'};display:flex;flex-direction:column;justify-content:center;position:relative;">
        ${buildPriceHtml(property, postType, colors, '28px')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isStory ? '32px' : '28px'};color:${colors.text};line-height:1.2;margin-bottom:6px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:13px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(property.location)}</div>` : ''}
        ${buildPropertyStats(property, colors, false)}
        ${property.features ? `<div style="margin-top:10px;">${buildFeaturesHtml(property.features.slice(0, 4), colors)}</div>` : ''}
      </div>
      ${buildAgentBar(colors, size)}
    </div>`;
}

function renderFeatureTrio(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 3);
  const agentBarHeight = size === 'facebook-post' ? 60 : 70;
  const isStory = size === 'instagram-story';
  const photoSection = isStory ? '58%' : '62%';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse)}
      <div style="display:flex;height:${photoSection};gap:4px;">
        <div style="flex:1.2;overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="flex:0.8;display:flex;flex-direction:column;gap:4px;">
          <div style="flex:1;overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
          <div style="flex:1;overflow:hidden;"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        </div>
      </div>
      <div style="padding:${isStory ? '28px 36px' : '20px 36px'};display:flex;flex-direction:column;justify-content:center;">
        ${buildPriceHtml(property, postType, colors, '28px')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:${isStory ? '30px' : '26px'};color:${colors.text};line-height:1.2;margin-bottom:6px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:13px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;margin-bottom:8px;">${escapeHtml(property.location)}</div>` : ''}
        ${buildPropertyStats(property, colors, false)}
        ${property.features ? `<div style="margin-top:10px;">${buildFeaturesHtml(property.features.slice(0, 4), colors)}</div>` : ''}
      </div>
      ${buildAgentBar(colors, size)}
    </div>`;
}

function renderGridQuad(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 4);
  const agentBarHeight = size === 'facebook-post' ? 60 : 70;
  const isStory = size === 'instagram-story';

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      ${buildBadge(postType, colors, property, openHouse)}
      <!-- Info banner at top -->
      <div style="padding:${isStory ? '24px 32px 18px' : '18px 32px 14px'};background:${colors.bg};">
        <div style="display:flex;align-items:baseline;gap:16px;flex-wrap:wrap;">
          ${buildPriceHtml(property, postType, colors, '26px')}
          <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:24px;color:${colors.text};line-height:1.2;">${escapeHtml(truncate(property.title, 40))}</div>
        </div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:12px;color:${colors.textSecondary};letter-spacing:1.5px;text-transform:uppercase;margin-top:6px;">${escapeHtml(property.location)}</div>` : ''}
        ${buildPropertyStats(property, colors, true)}
      </div>
      <!-- Photo grid -->
      <div style="display:grid;grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr;gap:4px;flex:1;position:absolute;top:${isStory ? '140px' : '110px'};bottom:${agentBarHeight}px;left:0;right:0;">
        <div style="overflow:hidden;"><img src="${photos[0]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="overflow:hidden;"><img src="${photos[1]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="overflow:hidden;"><img src="${photos[2]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
        <div style="overflow:hidden;"><img src="${photos[3]}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>
      </div>
      ${buildAgentBar(colors, size)}
    </div>`;
}

function renderGridSix(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = buildPhotoSlots(property.photos, 6);
  const agentBarHeight = size === 'facebook-post' ? 60 : 70;
  const isStory = size === 'instagram-story';
  const badgeLabel = getPostTypeBadge(postType);

  // Inline badge for grid-six to avoid overlap
  const inlineBadge = badgeLabel ? `<span style="display:inline-block;background:${colors.badge};color:${colors.badgeText};font-family:'Montserrat',sans-serif;font-weight:700;font-size:11px;padding:5px 14px;letter-spacing:2px;margin-right:12px;vertical-align:middle;">${badgeLabel}</span>` : '';

  // Open house extra info
  let openHouseInfo = '';
  if (postType === 'open-house' && openHouse) {
    openHouseInfo = `<div style="font-family:'Montserrat',sans-serif;font-size:11px;color:${colors.text};margin-top:2px;">${openHouse.date ? escapeHtml(openHouse.date) : ''}${openHouse.date && openHouse.time ? ' · ' : ''}${openHouse.time ? escapeHtml(openHouse.time) : ''}</div>`;
  }

  const infoHeight = isStory ? 90 : 76;

  return `
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <!-- Info bar at top -->
      <div style="padding:14px 28px;background:${colors.bg};position:relative;z-index:5;height:${infoHeight}px;display:flex;flex-direction:column;justify-content:center;">
        <div style="display:flex;align-items:center;flex-wrap:wrap;">
          ${inlineBadge}
          <span style="font-family:'Playfair Display',serif;font-weight:700;font-size:20px;color:${colors.text};line-height:1.2;">${escapeHtml(truncate(property.title, 35))}</span>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:4px;">
          ${buildPriceHtml(property, postType, colors, '16px')}
          ${property.location ? `<span style="font-family:'Montserrat',sans-serif;font-size:11px;color:${colors.textSecondary};letter-spacing:1px;text-transform:uppercase;">${escapeHtml(property.location)}</span>` : ''}
        </div>
        ${openHouseInfo}
      </div>
      <!-- Photo grid 3x2 -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;grid-template-rows:1fr 1fr;gap:3px;position:absolute;top:${infoHeight}px;bottom:${agentBarHeight}px;left:0;right:0;">
        ${photos.map(p => `<div style="overflow:hidden;"><img src="${p}" style="width:100%;height:100%;object-fit:cover;" crossorigin="anonymous"/></div>`).join('')}
      </div>
      ${buildAgentBar(colors, size)}
    </div>`;
}

function renderCarouselSlides(property, colors, size, postType, openHouse) {
  const dim = SIZES[size];
  const photos = property.photos || [];
  const slides = [];

  // Slide 1: Cover slide
  const coverPhoto = photos[0] || buildPhotoSlots([], 1)[0];
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
      <img src="${coverPhoto}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
      <div style="position:absolute;top:0;left:0;right:0;bottom:0;background:linear-gradient(to top, ${colors.bg} 5%, ${colors.overlay} 40%, transparent 70%);"></div>
      ${buildBadge(postType, colors, property, openHouse)}
      <div style="position:absolute;bottom:90px;left:0;right:0;padding:0 40px;text-align:center;">
        ${buildPriceHtml(property, postType, colors, '36px')}
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:38px;color:${colors.text};line-height:1.15;margin-bottom:10px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;">${escapeHtml(property.location)}</div>` : ''}
        <div style="font-family:'Montserrat',sans-serif;font-size:13px;color:${colors.textSecondary};margin-top:16px;letter-spacing:1px;">SWIPE FOR MORE →</div>
      </div>
      ${buildAgentBar(colors, size)}
    </div>`);

  // Individual photo slides (skip first since it was cover)
  for (let i = 1; i < photos.length; i++) {
    slides.push(`
      <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};">
        <img src="${photos[i]}" style="width:100%;height:100%;object-fit:cover;position:absolute;top:0;left:0;" crossorigin="anonymous"/>
        <div style="position:absolute;bottom:0;left:0;right:0;height:80px;background:linear-gradient(to top, ${colors.bg}, transparent);"></div>
        <div style="position:absolute;top:16px;right:20px;font-family:'Montserrat',sans-serif;font-size:12px;color:${colors.text};background:${colors.overlay};padding:6px 14px;border-radius:20px;letter-spacing:1px;">${i + 1}/${photos.length + 1}</div>
        ${buildAgentBar(colors, size)}
      </div>`);
  }

  // Details slide (last slide)
  slides.push(`
    <div style="position:relative;width:${dim.width}px;height:${dim.height}px;overflow:hidden;background:${colors.bg};display:flex;flex-direction:column;justify-content:center;align-items:center;padding:60px 50px;">
      <div style="text-align:center;width:100%;">
        <div style="font-family:'Playfair Display',serif;font-weight:700;font-size:32px;color:${colors.text};line-height:1.2;margin-bottom:16px;">${escapeHtml(truncate(property.title, 50))}</div>
        ${property.location ? `<div style="font-family:'Montserrat',sans-serif;font-size:13px;color:${colors.textSecondary};letter-spacing:2px;text-transform:uppercase;margin-bottom:20px;">${escapeHtml(property.location)}</div>` : ''}
        ${buildPriceHtml(property, postType, colors, '40px')}
        <div style="width:60px;height:2px;background:${colors.accent};margin:0 auto 20px;"></div>
        ${buildPropertyStats(property, colors, false)}
        ${property.features ? `<div style="margin-top:20px;text-align:center;">${buildFeaturesHtml(property.features, colors)}</div>` : ''}
        ${property.description ? `<div style="font-family:'Montserrat',sans-serif;font-size:14px;color:${colors.textSecondary};line-height:1.6;margin-top:24px;max-width:500px;">${escapeHtml(truncate(property.description, 200))}</div>` : ''}
      </div>
      ${buildAgentBar(colors, size)}
    </div>`);

  return slides;
}

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
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { width: ${dim.width}px; height: ${dim.height}px; overflow: hidden; }
  </style>
</head>
<body>${bodyContent}</body>
</html>`;
}

function generateTemplate(templateConfig, property, openHouse) {
  const { layout, postType, colorTheme, size, customColors } = templateConfig;
  const colors = getColors(colorTheme, customColors);
  const renderer = LAYOUT_RENDERERS[layout];

  if (!renderer) {
    throw new Error(`Unknown layout: ${layout}`);
  }

  const result = renderer(property, colors, size, postType, openHouse);

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
  COLOR_THEMES
};
