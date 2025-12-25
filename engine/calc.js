import {
  getCapForYear,
  ROLE_PCTS,
  TRANSFER_SPLITS,
  GOAL_CAPS_ATTACKER,
  SELECTION_GAMES_PER_YEAR,
} from "./rules.js";

// random determinístico simples (p/ MVP): usa Math.random
function rand(min, max) {
  return min + Math.random() * (max - min);
}
function rint(min, max) {
  return Math.round(rand(min, max));
}
function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function physMultiplier(fisico) {
  if (fisico === "fragil") return 0.88;
  if (fisico === "tanque") return 1.04;
  return 1.0;
}

function phaseMultiplier(phase) {
  switch (phase) {
    case "recem_base_normal":
      return { games: 0.85, goals: 0.75 };
    case "recem_base_fenomeno":
      return { games: 1.0, goals: 1.05 };
    case "bom":
      return { games: 1.02, goals: 1.05 };
    case "excelente":
      return { games: 1.03, goals: 1.12 };
    case "craque":
      return { games: 1.04, goals: 1.2 };
    case "decadencia":
      return { games: 0.95, goals: 0.85 };
    case "aposentando":
      return { games: 0.85, goals: 0.7 };
    default:
      return { games: 1.0, goals: 1.0 };
  }
}

function eventOverride(event, baseGames, baseGoals) {
  let g = baseGames;
  let gl = baseGoals;

  if (event === "lesao_grave") {
    g = Math.round(baseGames * rand(0.2, 0.4));
    gl = Math.round(baseGoals * rand(0.35, 0.6));
  } else if (event === "lesao_recorrente") {
    g = Math.round(baseGames * rand(0.65, 0.8));
    gl = Math.round(baseGoals * rand(0.75, 0.9));
  } else if (event === "explosao") {
    gl = Math.round(baseGoals * rand(1.25, 1.5));
  } else if (event === "ano_apagado") {
    gl = Math.round(baseGoals * rand(0.5, 0.7));
  } else if (event === "queda_brusca") {
    g = Math.round(baseGames * rand(0.65, 0.8));
    gl = Math.round(baseGoals * rand(0.55, 0.7));
  } else if (event === "renascimento") {
    g = Math.round(baseGames * rand(1.05, 1.15));
    gl = Math.round(baseGoals * rand(1.15, 1.3));
  } else if (event === "transferencia_conturbada") {
    gl = Math.round(baseGoals * rand(0.85, 0.95));
  }

  return { games: Math.max(0, g), goals: Math.max(0, gl) };
}

// Taxa base de gols (por jogo) por posição + perfil simples
function baseGoalsPerGame(pos, perfilGols) {
  // perfilGols: nao/sim/extra
  const bump =
    perfilGols === "extra" ? 1.25 : perfilGols === "sim" ? 1.0 : 0.65;

  switch (pos) {
    case "CA":
      return 0.75 * bump;
    case "SS":
      return 0.55 * bump;
    case "PE":
    case "PD":
      return 0.42 * bump;
    case "MEI":
      return 0.32 * bump;
    case "MC":
      return 0.18 * bump;
    case "VOL":
      return 0.08 * bump;
    case "LE":
    case "LD":
      return 0.1 * bump;
    case "ZAG":
      return 0.04 * bump;
    case "GK":
      return 0.0;
    default:
      return 0.18 * bump;
  }
}

function divisionGoalMultiplier(divisao) {
  if (divisao === 2) return 0.75;
  if (divisao === 3) return 0.5;
  return 1.0;
}

// Hard cap para gols por temporada, principalmente pra atacantes/pontas
function seasonGoalCap(dna) {
  const lvl = clamp(Number(dna.nivel), 1, 7);
  const pos = dna.posicao;

  // atacantes/pontas/meias: cap alto; defensores: cap baixo
  if (["CA", "SS", "PE", "PD", "MEI"].includes(pos))
    return GOAL_CAPS_ATTACKER[lvl];

  if (pos === "MC")
    return Math.max(2, Math.round(GOAL_CAPS_ATTACKER[lvl] * 0.35));
  if (pos === "VOL")
    return Math.max(1, Math.round(GOAL_CAPS_ATTACKER[lvl] * 0.2));
  if (pos === "LE" || pos === "LD")
    return Math.max(1, Math.round(GOAL_CAPS_ATTACKER[lvl] * 0.22));
  if (pos === "ZAG")
    return Math.max(0, Math.round(GOAL_CAPS_ATTACKER[lvl] * 0.12));
  return 0;
}

// Calcula estatísticas por clube na temporada (retorna array [{club, anos:"2020–2021", jogos, gols, emprestimo, dono}])
export function calcSeasonClubStats({ dna, season }) {
  const cap = getCapForYear(season.y);

  const role = ROLE_PCTS[season.role] ?? ROLE_PCTS.reserva;
  const pct = rand(role.min, role.max);

  const pm = phaseMultiplier(season.phase);
  const baseGames = Math.round(
    cap * pct * physMultiplier(dna.fisico) * pm.games
  );

  // gols brutos antes de hard cap
  const gpg = baseGoalsPerGame(dna.posicao, dna.perfilGols);
  let baseGoals = Math.round(baseGames * gpg * pm.goals);

  // se o clube for divisão inferior, reduz um pouco a conversão (opcional): aqui aplicamos multiplicador
  // mas o player pode ter números altos de jogos independentemente da divisão.
  // Aqui multiplicamos gols por divisão.
  const out = [];

  if (season.clubs.length === 0) return out;

  // Caso 1: 1 clube
  if (season.clubs.length === 1) {
    const c = season.clubs[0];
    const divM = divisionGoalMultiplier(c.divisao);
    let goals = Math.round(baseGoals * divM);

    // hard cap por temporada
    goals = clamp(goals, 0, seasonGoalCap(dna));

    // evento raro
    const ev = eventOverride(season.event, baseGames, goals);

    out.push({
      seasonStart: season.y,
      anos: season.seasonStr,
      clube: c.clube,
      jogos: clamp(ev.games, 0, 999),
      gols: clamp(ev.goals, 0, 999),
      emprestimo: Boolean(c.emprestimo),
      dono: Boolean(c.dono),
    });

    return out;
  }

  // Caso 2: 2+ clubes (transferência na temporada)
  // MVP: trata 2 clubes com preset; se houver 3+, aplica divisão proporcional simples aos 2 primeiros e o resto recebe 0 (depois melhoramos)
  const split = TRANSFER_SPLITS[season.transferSplit] ?? TRANSFER_SPLITS.media;

  // primeiro clube = A (mais antigo), segundo = B (novo)
  const A = season.clubs[0];
  const B = season.clubs[1];

  const gamesA = Math.round(baseGames * split.a);
  const gamesB = Math.max(0, baseGames - gamesA);

  // gols por clube: divide pelo split também
  const goalsTotal = clamp(baseGoals, 0, seasonGoalCap(dna));

  let goalsA = Math.round(goalsTotal * split.a);
  let goalsB = Math.max(0, goalsTotal - goalsA);

  // ajuste de adaptação no clube novo (opcional)
  let adapt = 1.0;
  const lvl = clamp(Number(dna.nivel), 1, 7);
  if (lvl <= 3) adapt *= 0.9;
  else if (lvl <= 5) adapt *= 0.95;

  if (season.event === "explosao") adapt *= 1.1;
  if (season.event === "ano_apagado") adapt *= 0.85;
  if (season.event === "transferencia_conturbada") adapt *= 0.9;

  goalsB = Math.round(goalsB * adapt);

  // divisão influencia gols
  goalsA = Math.round(goalsA * divisionGoalMultiplier(A.divisao));
  goalsB = Math.round(goalsB * divisionGoalMultiplier(B.divisao));

  // evento raro aplicado no total (depois dividido de novo) — MVP simples:
  const evA = eventOverride(season.event, gamesA, goalsA);
  const evB = eventOverride(season.event, gamesB, goalsB);

  out.push({
    seasonStart: season.y,
    anos: season.seasonStr,
    clube: A.clube,
    jogos: clamp(evA.games, 0, 999),
    gols: clamp(evA.goals, 0, 999),
    emprestimo: Boolean(A.emprestimo),
    dono: Boolean(A.dono),
  });

  out.push({
    seasonStart: season.y,
    anos: season.seasonStr,
    clube: B.clube,
    jogos: clamp(evB.games, 0, 999),
    gols: clamp(evB.goals, 0, 999),
    emprestimo: Boolean(B.emprestimo),
    dono: Boolean(B.dono),
  });

  // se houverem clubes extras, coloca “0” (amanhã a gente melhora com split triplo)
  for (let i = 2; i < season.clubs.length; i++) {
    const c = season.clubs[i];
    out.push({
      seasonStart: season.y,
      anos: season.seasonStr,
      clube: c.clube,
      jogos: 0,
      gols: 0,
      emprestimo: Boolean(c.emprestimo),
      dono: Boolean(c.dono),
    });
  }

  return out;
}

// Seleção: agrega por intervalo e retorna um bloco (depois merge se contínuo)
// Seleção: agrega por intervalo e retorna um bloco (depois merge se contínuo)
export function calcSelectionStats({
  dna,
  kind,
  name,
  ini,
  fim,
  papel,
  perfil,
  active = false,
}) {
  const years = Math.max(1, Math.max(ini, fim) - Math.min(ini, fim) + 1);
  const range = SELECTION_GAMES_PER_YEAR[kind];

  // papel -> % de jogos (simplificado)
  const pct =
    papel === "lesionado"
      ? rand(0.0, 0.15)
      : papel === "reserva"
      ? rand(0.2, 0.4)
      : papel === "reserva_imp"
      ? rand(0.45, 0.65)
      : papel === "titular"
      ? rand(0.75, 0.9)
      : papel === "tanque"
      ? rand(0.9, 1.0)
      : rand(0.3, 0.55);

  const gamesPerYear = rand(range.min, range.max);
  const jogos = Math.round(years * gamesPerYear * pct);

  // gols: usa taxa base e aplica perfil
  const gpg = baseGoalsPerGame(dna.posicao, dna.perfilGols);

  const prof =
    kind === "base"
      ? perfil === "medio"
        ? 0.8
        : perfil === "regular"
        ? 1.0
        : perfil === "excelente"
        ? 1.15
        : 1.3
      : perfil === "pessimo"
      ? 0.6
      : perfil === "clube"
      ? 0.8
      : perfil === "regular"
      ? 1.0
      : 1.25;

  let gols = Math.round(jogos * gpg * prof);

  // hard cap “macro” para seleção (mais conservador)
  const cap = Math.round(
    seasonGoalCap(dna) * (kind === "base" ? 0.45 : 0.55) * years
  );
  gols = clamp(gols, 0, cap);

  const start = Math.min(ini, fim);
  const end = Math.max(ini, fim);

  // ✅ força "(base)" no nome quando for seleção de base
  const selecaoNome =
    kind === "base" && !String(name).toLowerCase().includes("base")
      ? `${name} (base)`
      : name;

  return {
    anos: `${start}\u2013${end}`, // ✅ sempre fechado aqui
    selecao: selecaoNome, // ✅ base sempre separada
    jogos,
    gols,
    _active: Boolean(active), // ✅ flag interno para o merge decidir abrir "–"
  };
}
