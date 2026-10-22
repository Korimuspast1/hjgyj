// Набор SVG-иконок системы (Material-подобные)
const s = (inner, vb = '0 0 24 24', extra = '') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" ${extra}>${inner}</svg>`;
const f = (inner, vb = '0 0 24 24', extra = '') =>
  `<svg viewBox="${vb}" fill="currentColor" ${extra}>${inner}</svg>`;

export const ICON = {
  // сеть
  signal: (bars = 4) => {
    const h = [5, 9, 13, 17];
    let out = '';
    for (let i = 0; i < 4; i++) {
      const on = i < bars;
      out += `<rect x="${2 + i * 5}" y="${19 - h[i]}" width="3.4" height="${h[i]}" rx="1" fill="currentColor" opacity="${on ? 1 : 0.28}"/>`;
    }
    return f(out, '0 0 24 24');
  },
  signalCross: () => f(`<rect x="2" y="14" width="3.4" height="5" rx="1" opacity=".28"/><rect x="7" y="10" width="3.4" height="9" rx="1" opacity=".28"/><rect x="12" y="6" width="3.4" height="13" rx="1" opacity=".28"/><rect x="17" y="2" width="3.4" height="17" rx="1" opacity=".28"/><path d="M3 3l18 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  wifi: (lvl = 3) => {
    const arcs = [
      'M2.2 8.4a15 15 0 0 1 19.6 0',
      'M5.6 12a10 10 0 0 1 12.8 0',
      'M8.9 15.6a5 5 0 0 1 6.2 0'
    ];
    let out = arcs.map((d, i) => `<path d="${d}" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none" opacity="${i < lvl ? 1 : 0.25}"/>`).join('');
    out += `<circle cx="12" cy="19.2" r="1.5" fill="currentColor"/>`;
    return f(out);
  },
  wifiOff: () => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M2.2 8.4a15 15 0 0 1 6-3.6M15.6 4.9a15 15 0 0 1 6.2 3.5M5.6 12a10 10 0 0 1 3.2-2M15.4 10.2a10 10 0 0 1 3 1.8M8.9 15.6a5 5 0 0 1 4-.9"/><circle cx="12" cy="19.2" r="1.5" fill="currentColor" stroke="none"/><path d="M3 3l18 18"/></svg>`,
  data: () => f(`<path d="M12 3.2 6.6 12h3.2v8.8L15.2 12H12z" opacity=".95"/>`),
  airplane: () => f(`<path d="M21.5 15.5v-2l-8-4.2V4a1.6 1.6 0 0 0-3.2 0v5.3l-8 4.2v2l8-2.4v4.3l-2.4 1.6v1.6l4-1 4 1v-1.6L13.5 19v-4.3z"/>`),
  bt: () => f(`<path d="M11 2.5 17 8l-4 3.9V2.5zm0 19L17 16l-4-3.9V21.5zM6.4 7.6 11 12l-4.6 4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M11 2.5 17 8l-6 5.5L17 16l-6 5.5V2.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/>`),
  dnd: () => f(`<path d="M12 3a9 9 0 0 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1.1.9-2 2-2h1.8c2 0 3.7-1.7 3.7-3.7C20.5 6.2 16.7 3 12 3z"/><circle cx="8.5" cy="10" r="1" fill="#0b1020"/><circle cx="12" cy="7.5" r="1" fill="#0b1020"/><circle cx="15.5" cy="10" r="1" fill="#0b1020"/>`),
  location: () => f(`<path d="M12 2a7 7 0 0 0-7 7c0 5.2 7 13 7 13s7-7.8 7-13a7 7 0 0 0-7-7zm0 9.6A2.6 2.6 0 1 1 12 6.4a2.6 2.6 0 0 1 0 5.2z"/>`),
  flashlight: (on = false) => f(`<path d="M8 2h8v3l-2 3v9a2 2 0 0 1-4 0v-9L8 5V2z" opacity="${on ? 1 : 0.85}"/><path d="${on ? 'M12 12.5l-.9 2h1.8l-.9 2 2.4-2.7h-1.6l1.2-1.3z' : ''}" fill="#0b1020"/>`),
  rotate: () => s(`<path d="M4 12a8 8 0 0 1 13.7-5.6M20 12a8 8 0 0 1-13.7 5.6"/><path d="M17.5 3v3.6h-3.6M6.5 21v-3.6h3.6"/>`),
  hotspot: () => f(`<circle cx="12" cy="18" r="2"/><path d="M8.2 14.2a5.4 5.4 0 0 1 7.6 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M5 11a10 10 0 0 1 14 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>`),
  batterySaver: () => f(`<path d="M13 2 4.5 13.5H11L9.5 22 19 9.5h-6.5z"/>`),
  // навигация
  back: () => s(`<path d="M15 5l-7 7 7 7"/>`),
  chevR: () => s(`<path d="M9 5l7 7-7 7"/>`),
  chevD: () => s(`<path d="M5 9l7 7 7-7"/>`),
  close: () => s(`<path d="M6 6l12 12M18 6L6 18"/>`),
  more: () => f(`<circle cx="12" cy="5" r="1.9"/><circle cx="12" cy="12" r="1.9"/><circle cx="12" cy="19" r="1.9"/>`),
  search: () => s(`<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>`),
  plus: () => s(`<path d="M12 5v14M5 12h14"/>`),
  check: () => s(`<path d="M4.5 12.5l5 5 10-11"/>`),
  edit: () => s(`<path d="M4 20h4L20 8l-4-4L4 16v4z"/><path d="M14.5 5.5 18.5 9.5"/>`),
  trash: () => s(`<path d="M4 7h16M9 7V4h6v3M6.5 7l1 13h9l1-13"/>`),
  share: () => s(`<circle cx="18" cy="5.5" r="2.8"/><circle cx="6" cy="12" r="2.8"/><circle cx="18" cy="18.5" r="2.8"/><path d="M8.5 10.7 15.5 7M8.5 13.3l7 4"/>`),
  settings: () => s(`<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-3-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 2.9-1.2V3a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17 4.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.7 1z"/>`),
  // коммуникации
  phone: () => f(`<path d="M6.6 3h2.9l1.5 3.8-2 1.3a12 12 0 0 0 5.9 5.9l1.3-2L20 13.5v2.9c0 1.3-1.1 2.4-2.4 2.3C10.2 18.3 5.7 13.8 4.3 5.4A2.3 2.3 0 0 1 6.6 3z"/>`),
  phoneOff: () => f(`<path d="M6.6 3h2.9l1.5 3.8-2 1.3a12 12 0 0 0 5.9 5.9l1.3-2L20 13.5v2.9c0 1.3-1.1 2.4-2.4 2.3C10.2 18.3 5.7 13.8 4.3 5.4A2.3 2.3 0 0 1 6.6 3z"/><path d="M2 2l20 20" stroke="#fff" stroke-width="2"/>`),
  chat: () => f(`<path d="M4 4h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-5 4V5a1 1 0 0 1 1-1z"/>`),
  send: () => f(`<path d="M3.4 20.4 21 12 3.4 3.6 3.4 10l12 2-12 2z"/>`),
  mic: () => s(`<rect x="9" y="2.5" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3.5"/>`),
  video: () => f(`<path d="M4 5.5h11a1.5 1.5 0 0 1 1.5 1.5v10A1.5 1.5 0 0 1 15 18.5H4A1.5 1.5 0 0 1 2.5 17V7A1.5 1.5 0 0 1 4 5.5z"/><path d="M17.5 10.2 22 7.5v9l-4.5-2.7z"/>`),
  mail: () => s(`<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="m3.5 7 8.5 6 8.5-6"/>`),
  // медиа
  camera: () => s(`<path d="M3 8.5A2.5 2.5 0 0 1 5.5 6h1.8l1.3-2h6.8l1.3 2h1.8A2.5 2.5 0 0 1 21 8.5v9A2.5 2.5 0 0 1 18.5 20h-13A2.5 2.5 0 0 1 3 17.5z"/><circle cx="12" cy="13" r="3.6"/>`),
  gallery: () => s(`<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><circle cx="8.5" cy="9.8" r="1.7"/><path d="m4 17 5-5 3.5 3.5L16 12l4 4.5"/>`),
  play: () => f(`<path d="M7 4.5v15l13-7.5z"/>`),
  pause: () => f(`<rect x="6.5" y="4.5" width="4" height="15" rx="1.4"/><rect x="13.5" y="4.5" width="4" height="15" rx="1.4"/>`),
  next: () => f(`<path d="M6 4.5 16 12 6 19.5zM17 4.5h2.5v15H17z"/>`),
  prev: () => f(`<path d="M18 4.5 8 12l10 7.5zM4.5 4.5H7v15H4.5z"/>`),
  shuffle: () => s(`<path d="M17 3.5 21 7l-4 3.5M17 13.5 21 17l-4 3.5M3 7h4c3 0 4 10 8 10h3M3 17h4c1.6 0 2.7-1.4 3.7-3M14 9.4c.8-1.4 1.7-2.4 3-2.4h0"/>`),
  repeat: () => s(`<path d="M17 2.5 21 6l-4 3.5M7 21.5 3 18l4-3.5"/><path d="M21 6H7a4 4 0 0 0-4 4v2M3 18h14a4 4 0 0 0 4-4v-2"/>`),
  volUp: () => f(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.8 8.6a5 5 0 0 1 0 6.8M18.4 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  volDown: () => f(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M16 9.8a3.4 3.4 0 0 1 0 4.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  volMute: () => f(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="m16 9.5 5 5m0-5-5 5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  brightness: () => f(`<circle cx="12" cy="12" r="4.2"/><path d="M12 1.8v2.6M12 19.6v2.6M4.2 4.2l1.9 1.9M17.9 17.9l1.9 1.9M1.8 12h2.6M19.6 12h2.6M4.2 19.8l1.9-1.9M17.9 6.1l1.9-1.9" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" fill="none"/>`),
  // прочее
  clock: () => s(`<circle cx="12" cy="12" r="9"/><path d="M12 7v5.4l3.4 2"/>`),
  alarm: () => s(`<circle cx="12" cy="13" r="8"/><path d="M12 9.4V13l2.6 1.6M4.5 5.5 2 8M19.5 5.5 22 8"/>`),
  calc: () => s(`<rect x="4.5" y="2.5" width="15" height="19" rx="2.5"/><rect x="7.5" y="5.5" width="9" height="3.5" rx="1"/><path d="M8 13h.01M12 13h.01M16 13h.01M8 17h.01M12 17h.01M16 17h.01" stroke-width="2.4"/>`),
  note: () => s(`<path d="M5.5 3h9L19 7.5v13a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M8 13h8M8 17h5"/>`),
  weather: () => s(`<circle cx="9" cy="9.5" r="3.4"/><path d="M9 2.6v1.4M9 15v1.4M2.6 9.5H4M14 9.5h1.4M4.6 5.1l1 1M12.4 12.9l1 1M4.6 13.9l1-1M12.4 6.1l1-1"/><path d="M13.5 19.5a3.2 3.2 0 0 1 .4-6.4 4.6 4.6 0 0 1 8.6 1.6 2.9 2.9 0 0 1-.6 5.8z"/>`),
  bank: () => s(`<path d="M3 10.2 12 4l9 6.2M4.8 10.6v7.6M9.6 10.6v7.6M14.4 10.6v7.6M19.2 10.6v7.6M3 20.4h18"/>`),
  store: () => s(`<path d="M4.5 8.5h15l-1 12h-13z"/><path d="M8.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5"/>`),
  files: () => s(`<path d="M3 6.5A1.5 1.5 0 0 1 4.5 5h4.6l1.8 2.2h8.6A1.5 1.5 0 0 1 21 8.7v9.8a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 18.5z"/>`),
  game: () => s(`<rect x="2.5" y="7" width="19" height="11" rx="4"/><path d="M7 10.8v3.4M5.3 12.5h3.4M15.8 11.6h.01M18 13.8h.01" stroke-width="2.2"/>`),
  globe: () => s(`<circle cx="12" cy="12" r="9"/><path d="M3.2 9.5h17.6M3.2 14.5h17.6M12 3a15 15 0 0 1 0 18A15 15 0 0 1 12 3z"/>`),
  fingerprint: () => s(`<path d="M12 3.5c-3 0-5.5 1.4-7 3.6M19 7.1A8.6 8.6 0 0 0 12 3.5"/><path d="M5.6 18.6c-.5-1.3-.8-2.7-.8-4.2a7.2 7.2 0 0 1 14.4 0c0 .9-.1 1.8-.3 2.6"/><path d="M8.6 19.8A10 10 0 0 1 8 14.4a4 4 0 0 1 8 0c0 2-.4 3.9-1.2 5.6"/><path d="M12 10.4a4 4 0 0 0-4 4c0 1.7.3 3.3.9 4.8M12 10.4a4 4 0 0 1 4 4c0 1-.1 2-.4 3"/>`),
  face: () => s(`<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><path d="M8 10h.01M16 10h.01M8.5 15a4.6 4.6 0 0 0 7 0" stroke-width="2.2"/>`),
  lock: () => s(`<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>`),
  unlock: () => s(`<rect x="4.5" y="10" width="15" height="11" rx="2.5"/><path d="M8 10V7a4 4 0 0 1 7.5-1.9"/>`),
  sim: () => s(`<path d="M6 3.5h8L18.5 8v12.5a1 1 0 0 1-1 1h-11a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1z"/><rect x="9" y="10" width="6.5" height="6" rx="1.4"/><path d="M12.2 10v6M9 13h6.5"/>`),
  info: () => s(`<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5M12 7.8h.01" stroke-width="2.2"/>`),
  warn: () => f(`<path d="M12 2.5 22.5 21H1.5z" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/><path d="M12 9v5M12 17.3h.01" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>`),
  bell: () => s(`<path d="M6.5 9.5a5.5 5.5 0 0 1 11 0c0 4 1.5 5.5 1.5 5.5H5s1.5-1.5 1.5-5.5z"/><path d="M10 18.5a2.2 2.2 0 0 0 4 0"/>`),
  bellOff: () => s(`<path d="M8.2 5.6A5.5 5.5 0 0 1 17.5 9.5c0 4 1.5 5.5 1.5 5.5H8M5 15h1.5S6 13.5 6 9.5c0-.4 0-.8.1-1.2"/><path d="M10 18.5a2.2 2.2 0 0 0 4 0M3.5 3.5l17 17"/>`),
  storage: () => s(`<rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01" stroke-width="2.4"/>`),
  power: () => s(`<path d="M12 3.5v8"/><path d="M17.7 6.6a8 8 0 1 1-11.4 0"/>`),
  refresh: () => s(`<path d="M20.5 12a8.5 8.5 0 1 1-2.6-6.1"/><path d="M20.5 3.5V10h-6.5"/>`),
  download: () => s(`<path d="M12 3.5v11M7.5 10.5 12 15l4.5-4.5M4 19.5h16"/>`),
  qr: () => s(`<rect x="3.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.4"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.4"/><path d="M14 14h2.5v2.5H14zM18.5 18.5H21V21h-2.5z"/>`),
  plug: () => f(`<path d="M9 2.5v6M15 2.5v6M6.5 8.5h11v3a5.5 5.5 0 0 1-11 0z"/><path d="M12 17v4.5" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  star: () => f(`<path d="m12 3 2.7 5.7 6.3.8-4.6 4.3 1.2 6.2L12 17l-5.6 3 1.2-6.2L3 9.5l6.3-.8z"/>`),
  pin: () => f(`<path d="M14.5 2.5 21.5 9.5l-3 1-1 4-5-5-4 5 1-6-2-2 4-1 1-3z"/>`),
  eye: () => s(`<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`),
  user: () => s(`<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.2a7.8 7.8 0 0 1 15 0"/>`),
  emoji: () => s(`<circle cx="12" cy="12" r="9"/><path d="M8.5 14.2a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01" stroke-width="2.2"/>`),
  attach: () => s(`<path d="M20 11.5 12.3 19a4.6 4.6 0 0 1-6.5-6.5l8-8a3.2 3.2 0 0 1 4.6 4.6l-8 8a1.8 1.8 0 0 1-2.6-2.6l7.3-7.3"/>`),
  copy: () => s(`<rect x="8.5" y="8.5" width="12" height="12" rx="2.2"/><path d="M15.5 5.5v-1a1 1 0 0 0-1-1h-10a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h1"/>`),
  block: () => s(`<circle cx="12" cy="12" r="8.8"/><path d="m6 6 12 12"/>`),
  speaker: () => f(`<path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4z"/><path d="M15.8 8.6a5 5 0 0 1 0 6.8M18.4 6a8.6 8.6 0 0 1 0 12" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>`),
  keypad: () => f(`<circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="18" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="6" cy="18" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/>`),
  add: () => s(`<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>`),
  history: () => s(`<path d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1"/><path d="M3.5 3.5V10H10M12 7.5V12l3 2"/>`),
  bookmark: () => s(`<path d="M6.5 3.5h11a1 1 0 0 1 1 1v16l-6.5-4-6.5 4v-16a1 1 0 0 1 1-1z"/>`),
  tab: () => s(`<rect x="3" y="5.5" width="18" height="13" rx="2.5"/><path d="M7 5.5v13"/>`),
  shield: () => s(`<path d="M12 3 20 6v6c0 4.6-3.3 8.2-8 9.4C7.3 20.2 4 16.6 4 12V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>`),
  language: () => s(`<path d="M3.5 6h9M8 4v2c0 4-2 7.5-4.5 9M6 10c.6 2.6 2.7 4.6 5 5.4M13 20l4-10 4 10M14.4 16.5h5.2"/>`),
  palette: () => s(`<path d="M12 3a9 9 0 0 0 0 18c1.4 0 2-1 2-1.8 0-1.3-1-1.6-1-2.7 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"/><circle cx="7.8" cy="11.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="10" cy="7.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="14.6" cy="7.8" r="1.2" fill="currentColor" stroke="none"/>`),
  moon: () => f(`<path d="M20.5 14.8A8.7 8.7 0 0 1 9.2 3.5a8.8 8.8 0 1 0 11.3 11.3z"/>`),
  sun: () => f(`<circle cx="12" cy="12" r="4.6"/><path d="M12 1.5v3M12 19.5v3M3.5 3.5l2.1 2.1M18.4 18.4l2.1 2.1M1.5 12h3M19.5 12h3M3.5 20.5l2.1-2.1M18.4 5.6l2.1-2.1" stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"/>`),
  cloud: () => f(`<path d="M7.5 19a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.6 11 4 4 0 0 1 18 19z"/>`),
  rain: () => f(`<path d="M7.5 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.6 7 4 4 0 0 1 18 15z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" fill="none"/>`),
  snow: () => f(`<path d="M7.5 15a4.5 4.5 0 0 1-.4-9A6 6 0 0 1 18.6 7 4 4 0 0 1 18 15z"/><circle cx="8" cy="18.5" r="1.1"/><circle cx="12" cy="19.5" r="1.1"/><circle cx="16" cy="18.5" r="1.1"/>`),
  money: () => s(`<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.8"/><path d="M6 12h.01M18 12h.01" stroke-width="2.4"/>`),
  gift: () => s(`<rect x="3.5" y="8.5" width="17" height="4" rx="1.2"/><path d="M5 12.5v7a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-7M12 8.5v12"/><path d="M12 8.5S10.8 3.5 8.3 3.5a2.5 2.5 0 0 0 0 5zM12 8.5s1.2-5 3.7-5a2.5 2.5 0 0 1 0 5z"/>`),
  cart: () => s(`<circle cx="9.5" cy="20" r="1.5"/><circle cx="17.5" cy="20" r="1.5"/><path d="M2.5 3.5h3l2.4 11.2a1.6 1.6 0 0 0 1.6 1.3h8.3a1.6 1.6 0 0 0 1.6-1.3L21 7.5H6"/>`),
  swipeUp: () => s(`<path d="M12 20V5M6.5 10.5 12 5l5.5 5.5"/>`),
  help: () => s(`<circle cx="12" cy="12" r="9"/><path d="M9.4 9.2a2.7 2.7 0 0 1 5.3.7c0 1.8-2.7 2.2-2.7 4M12 17.2h.01" stroke-width="2"/>`)
};

export const icon = (name, ...args) => (typeof ICON[name] === 'function' ? ICON[name](...args) : '');
