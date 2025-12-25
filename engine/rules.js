export const EN_DASH = "\u2013";

export function toSeasonStr(y) {
  return `${y}${EN_DASH}${y + 1}`;
}

// Lista de anos iniciais de temporada: ex [2020,2021,2022,2023]
export function buildSeasonList(startYear, endYear) {
  const s = Math.min(startYear, endYear);
  const e = Math.max(startYear, endYear);
  const arr = [];
  for (let y = s; y <= e; y++) arr.push(y);
  return arr;
}

// Tetos por era: baseado no ANO INICIAL da temporada
export const ERAS = [
  { from: 1990, to: 2000, cap: 50 },
  { from: 2001, to: 2006, cap: 60 },
  { from: 2007, to: 2022, cap: 70 },
  { from: 2023, to: 2024, cap: 90 },
  { from: 2025, to: 2025, cap: 156 }, // fenômeno
];

export function getCapForYear(y) {
  for (const e of ERAS) {
    if (y >= e.from && y <= e.to) return e.cap;
  }
  // fallback
  return y >= 2025 ? 156 : 70;
}

// Papéis -> faixa % teto
export const ROLE_PCTS = {
  recuperando: { label: "Recuperando de lesão (15–30%)", min: 0.15, max: 0.3 },
  encostado: { label: "Encostado (0–5%)", min: 0.0, max: 0.05 },
  compoe: { label: "Compõe elenco (5–15%)", min: 0.05, max: 0.15 },
  reserva: { label: "Reserva (35–60%)", min: 0.35, max: 0.6 },
  reserva_imp: { label: "Reserva importante (65–75%)", min: 0.65, max: 0.75 },
  titular: { label: "Titular absoluto (85–95%)", min: 0.85, max: 0.95 },
  tanque: { label: "Tanque de guerra (95–100%)", min: 0.95, max: 1.0 },
};

// Presets (2 clubes na mesma temporada)
export const TRANSFER_SPLITS = {
  curta: { key: "curta", label: "25/75", a: 0.25, b: 0.75 },
  media: { key: "media", label: "40/60", a: 0.4, b: 0.6 }, // default
  meio: { key: "meio", label: "50/50", a: 0.5, b: 0.5 },
  longa: { key: "longa", label: "60/40", a: 0.6, b: 0.4 },
  muito_longa: { key: "muito_longa", label: "75/25", a: 0.75, b: 0.25 },
};

export const DEFAULT_TRANSFER_SPLIT = TRANSFER_SPLITS.media;

// Hard caps de gols por temporada (clubes), por nível real e “tipo atacante”
export const GOAL_CAPS_ATTACKER = {
  1: 8,
  2: 12, // Jarvin
  3: 18,
  4: 30,
  5: 45,
  6: 70,
  7: 90,
};

// Seleção: caps anuais aproximados (jogos por ano)
export const SELECTION_GAMES_PER_YEAR = {
  base: { min: 8, max: 15 },
  principal: { min: 6, max: 14 },
};
