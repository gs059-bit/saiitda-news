// 상단 바의 날씨·미세먼지. config.js의 weather(학교 위도·경도)가 없으면 표시하지 않는다
// 자료: Open-Meteo(날씨)와 Copernicus CAMS(미세먼지, 모델 추정값). 바닥글에 출처를 적어야 한다
import { cfg } from './supabase.js';
import { $ } from './utils.js';

// 위치를 바꾸면 예전 위치의 저장값을 쓰지 않도록 좌표를 키에 넣는다
const CACHE_KEY = `saiitda-weather:${cfg.weather?.lat},${cfg.weather?.lon}`;
const CACHE_MS = 30 * 60 * 1000;

// WMO 날씨 코드 → 이모지, 이름
const SKY = [
  [[0], '☀️', '맑음'],
  [[1, 2], '🌤️', '구름 조금'],
  [[3], '☁️', '흐림'],
  [[45, 48], '🌫️', '안개'],
  [[51, 53, 55, 56, 57], '🌦️', '이슬비'],
  [[61, 63, 65, 66, 67, 80, 81, 82], '🌧️', '비'],
  [[71, 73, 75, 77, 85, 86], '🌨️', '눈'],
  [[95, 96, 99], '⛈️', '뇌우']
];

// 환경부 예보 등급 기준(㎍/㎥): 이 값 이하면 각각 좋음·보통·나쁨, 넘으면 매우나쁨
const AIR_GRADES = ['좋음', '보통', '나쁨', '매우나쁨'];
const PM10_LIMITS = [30, 80, 150];
const PM25_LIMITS = [15, 35, 75];
const grade = (value, limits) => {
  const i = limits.findIndex(limit => value <= limit);
  return i === -1 ? limits.length : i;
};

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

// 날씨와 미세먼지를 따로 불러와, 하나가 실패해도 나머지는 보여 준다
async function fetchWeather({ lat, lon }) {
  const where = `latitude=${lat}&longitude=${lon}&timezone=Asia%2FSeoul`;
  const [sky, air] = await Promise.allSettled([
    getJson(`https://api.open-meteo.com/v1/forecast?${where}&current=temperature_2m,weather_code,is_day`),
    getJson(`https://air-quality-api.open-meteo.com/v1/air-quality?${where}&current=pm10,pm2_5`)
  ]);
  return {
    sky: sky.status === 'fulfilled' ? sky.value.current : null,
    air: air.status === 'fulfilled' ? air.value.current : null
  };
}

// 방문할 때마다 부르지 않도록 30분 동안은 브라우저에 저장한 값을 쓴다
function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  } catch {
    // 저장소를 쓸 수 없으면 매번 새로 부른다
  }
  return null;
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // 위와 같음
  }
}

function render({ sky, air }) {
  const parts = [];
  const details = [];
  if (sky) {
    const [, icon, name] = SKY.find(([codes]) => codes.includes(sky.weather_code)) || [[], '🌡️', ''];
    const shownIcon = icon === '☀️' && !sky.is_day ? '🌙' : icon;
    parts.push(`<span class="wx-now">${shownIcon} ${Math.round(sky.temperature_2m)}°</span>`);
    if (name) parts.push(`<span class="wx-sky">${name}</span>`);
  }
  if (Number.isFinite(air?.pm10) && Number.isFinite(air?.pm2_5)) {
    const g = Math.max(grade(air.pm10, PM10_LIMITS), grade(air.pm2_5, PM25_LIMITS));
    parts.push(`<span class="wx-air air-${g}">미세먼지 ${AIR_GRADES[g]}</span>`);
    details.push(`미세먼지 ${Math.round(air.pm10)}㎍/㎥ · 초미세먼지 ${Math.round(air.pm2_5)}㎍/㎥ (예측 모델 추정값)`);
  }
  if (!parts.length) return;
  const el = $('#weather');
  el.innerHTML = parts.join('');
  el.title = [cfg.weather.label, ...details].filter(Boolean).join(' · ');
  el.hidden = false;
}

export async function showWeather() {
  if (!cfg.weather?.lat || !cfg.weather?.lon || !$('#weather')) return;
  let data = readCache();
  if (!data) {
    data = await fetchWeather(cfg.weather);
    if (data.sky || data.air) writeCache(data);
  }
  render(data);
}
