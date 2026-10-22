import { getState } from './state.js';
import { hash, rnd, pad2, dayShort } from './util.js';

const CONDITIONS = [
  { id: 'sun', name: 'Ясно', icon: '☀️', rain: 0 },
  { id: 'pc', name: 'Переменная облачность', icon: '⛅', rain: 5 },
  { id: 'cloud', name: 'Облачно', icon: '☁️', rain: 15 },
  { id: 'rain', name: 'Дождь', icon: '🌧️', rain: 75 },
  { id: 'storm', name: 'Гроза', icon: '⛈️', rain: 85 },
  { id: 'fog', name: 'Туман', icon: '🌫️', rain: 25 },
  { id: 'wind', name: 'Ветрено', icon: '💨', rain: 20 },
  { id: 'drizzle', name: 'Морось', icon: '🌦️', rain: 55 }
];

function daySeed(offset = 0) {
  const S = getState();
  const d = new Date(S.time.gameMs);
  d.setDate(d.getDate() + offset);
  const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}-${S.weather.seed}`;
  return hash(key);
}

export function condFor(offset = 0, hour = null) {
  const s = daySeed(offset);
  const base = CONDITIONS[s % CONDITIONS.length];
  if (hour === null) return base;
  // ночью чуть «холоднее» по ощущению
  return base;
}

export function today() {
  const S = getState();
  const d = new Date(S.time.gameMs);
  const s = daySeed(0);
  const c = condFor(0);
  const base = 6 + (s % 12);
  const min = base - 3 - (s % 3);
  const max = base + 5 + (s % 4);
  const h = d.getHours() + d.getMinutes() / 60;
  // суточный ход температуры
  const curve = Math.sin(((h - 4) / 24) * Math.PI * 2 - Math.PI / 2);
  const temp = Math.round((min + max) / 2 + curve * ((max - min) / 2));
  const wind = 2 + (s % 9);
  const hum = 45 + (s % 45);
  const uv = c.id === 'sun' ? 5 + (s % 4) : 1 + (s % 3);
  const sunrise = 6 + (s % 2), sunset = 19 + (s % 2);
  return {
    city: S.weather.city, temp, feels: temp - (wind > 7 ? 3 : 1), min, max, cond: c,
    wind, hum, uv, pressure: 742 + (s % 26),
    sunrise: `${pad2(sunrise)}:${pad2((s % 6) * 10)}`,
    sunset: `${pad2(sunset)}:${pad2(((s >> 3) % 6) * 10)}`,
    visibility: c.id === 'fog' ? 1.2 : 10
  };
}

export function hours(offsetDay = 0) {
  const S = getState();
  const d = new Date(S.time.gameMs);
  const out = [];
  const s = daySeed(offsetDay);
  const c = condFor(offsetDay);
  for (let i = 0; i < 12; i++) {
    const hh = new Date(d.getTime() + i * 3600000);
    const h = hh.getHours();
    const night = h >= 21 || h < 6;
    const base = 6 + ((s + i * 7) % 12);
    const curve = Math.sin(((h - 4) / 24) * Math.PI * 2 - Math.PI / 2);
    const t = Math.round(base + curve * 4 + (i % 3));
    const icon = night ? (c.id === 'rain' || c.id === 'storm' ? '🌧️' : '🌙') : c.icon;
    out.push({ h: `${pad2(h)}:00`, t, icon, rain: c.rain });
  }
  return out;
}

export function days(count = 7) {
  const out = [];
  for (let i = 0; i < count; i++) {
    const s = daySeed(i);
    const c = condFor(i);
    const base = 5 + (s % 13);
    const d = new Date(getState().time.gameMs + i * 86400000);
    out.push({
      label: i === 0 ? 'Сегодня' : i === 1 ? 'Завтра' : dayShort(d.getDay()),
      date: d, min: base - 3, max: base + 4 + (s % 3), cond: c, rain: c.rain
    });
  }
  return out;
}

export function tempRange() {
  const ds = days(7);
  return { min: Math.min(...ds.map((d) => d.min)), max: Math.max(...ds.map((d) => d.max)) };
}

export function summary() {
  const t = today();
  return `${t.temp}° · ${t.cond.name}`;
}
