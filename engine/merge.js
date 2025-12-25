import { EN_DASH } from "./rules.js";

// Converte lista de temporadas do mesmo clube em passagem "inicio–fim"
function passageYears(seasonStarts) {
  const sorted = [...seasonStarts].sort((a, b) => a - b);
  const start = sorted[0];
  const endSeasonStart = sorted[sorted.length - 1];
  const end = endSeasonStart + 1; // 2023–2024 => fim 2024
  return `${start}${EN_DASH}${end}`;
}

function openEndedFromRange(rangeStr) {
  const start = parseInt(rangeStr, 10);
  return `${start}${EN_DASH}`;
}

/**
 * Merge clubes:
 * - empréstimos viram linhas separadas (emprestimo=true)
 * - "ativo" deve virar "AAAA–" APENAS na última linha (depois do merge+sort)
 */
export function mergeClubPassages(perSeasonClub, { active = false } = {}) {
  const loans = perSeasonClub.filter((r) => r.emprestimo);
  const regular = perSeasonClub.filter((r) => !r.emprestimo);

  const merged = [];

  // helper para agrupar contíguo por clube (temporalidade por seasonStart)
  function groupContiguous(rows) {
    const byClub = new Map();
    for (const r of rows) {
      const key = r.clube;
      if (!byClub.has(key)) byClub.set(key, []);
      byClub.get(key).push(r);
    }

    for (const [club, arr] of byClub.entries()) {
      arr.sort((a, b) => a.seasonStart - b.seasonStart);

      let cur = null;
      for (const r of arr) {
        if (!cur) {
          cur = {
            clube: club,
            emprestimo: false,
            seasons: [r.seasonStart],
            jogos: r.jogos,
            gols: r.gols,
          };
          continue;
        }
        const prev = cur.seasons[cur.seasons.length - 1];

        // temporadas europeias: contíguo se seasonStart == prev + 1
        if (r.seasonStart === prev + 1) {
          cur.seasons.push(r.seasonStart);
          cur.jogos += r.jogos;
          cur.gols += r.gols;
        } else {
          merged.push({
            anos: passageYears(cur.seasons),
            clube: cur.clube,
            jogos_gols: `${cur.jogos} (${cur.gols})`,
          });
          cur = {
            clube: club,
            emprestimo: false,
            seasons: [r.seasonStart],
            jogos: r.jogos,
            gols: r.gols,
          };
        }
      }

      if (cur) {
        merged.push({
          anos: passageYears(cur.seasons),
          clube: cur.clube,
          jogos_gols: `${cur.jogos} (${cur.gols})`,
        });
      }
    }
  }

  // empréstimos: agrupados por clube e contiguidade (sempre linhas separadas)
  function groupLoans(rows) {
    const byClub = new Map();
    for (const r of rows) {
      const key = r.clube;
      if (!byClub.has(key)) byClub.set(key, []);
      byClub.get(key).push(r);
    }
    for (const [club, arr] of byClub.entries()) {
      arr.sort((a, b) => a.seasonStart - b.seasonStart);

      let cur = null;
      for (const r of arr) {
        if (!cur) {
          cur = {
            clube: club,
            seasons: [r.seasonStart],
            jogos: r.jogos,
            gols: r.gols,
          };
          continue;
        }
        const prev = cur.seasons[cur.seasons.length - 1];
        if (r.seasonStart === prev + 1) {
          cur.seasons.push(r.seasonStart);
          cur.jogos += r.jogos;
          cur.gols += r.gols;
        } else {
          merged.push({
            anos: passageYears(cur.seasons),
            clube: cur.clube,
            jogos_gols: `${cur.jogos} (${cur.gols})`,
            emprestimo: true,
          });
          cur = {
            clube: club,
            seasons: [r.seasonStart],
            jogos: r.jogos,
            gols: r.gols,
          };
        }
      }
      if (cur) {
        merged.push({
          anos: passageYears(cur.seasons),
          clube: cur.clube,
          jogos_gols: `${cur.jogos} (${cur.gols})`,
          emprestimo: true,
        });
      }
    }
  }

  groupContiguous(regular);
  groupLoans(loans);

  // Ordena por início do "anos"
  merged.sort((a, b) => parseInt(a.anos, 10) - parseInt(b.anos, 10));

  // ✅ Ativo: só a última passagem vira "AAAA–"
  if (active && merged.length) {
    merged[merged.length - 1].anos = openEndedFromRange(
      merged[merged.length - 1].anos
    );
  }

  return merged;
}

// Seleção: junta por seleção, soma, e só a última linha recebe "–" se active=true
export function mergeSelectionContinuous(items, { active = false } = {}) {
  const bySel = new Map();
  for (const it of items) {
    const key = it.selecao; // agora base já vem como "Brasil (base)"
    if (!bySel.has(key)) bySel.set(key, []);
    bySel.get(key).push(it);
  }

  const out = [];
  for (const [sel, arr] of bySel.entries()) {
    let minStart = Infinity;
    let maxEnd = -Infinity;
    let jogos = 0;
    let gols = 0;

    // se QUALQUER item desse grupo for ativo, a seleção é ativa
    const isActiveSel = arr.some((x) => Boolean(x._active));

    for (const it of arr) {
      const start = parseInt(it.anos, 10);
      minStart = Math.min(minStart, start);

      const endMatch = it.anos.split(EN_DASH)[1];
      const end =
        endMatch && endMatch.trim().length ? parseInt(endMatch, 10) : start;

      maxEnd = Math.max(maxEnd, end);
      jogos += it.jogos;
      gols += it.gols;
    }

    // sempre fechado aqui
    const anos = `${minStart}${EN_DASH}${maxEnd}`;
    out.push({
      anos,
      selecao: sel,
      jogos_gols: `${jogos} (${gols})`,
      _active: isActiveSel,
    });
  }

  // base antes da principal
  out.sort((a, b) => {
    const abase = a.selecao.toLowerCase().includes("base") ? 0 : 1;
    const bbase = b.selecao.toLowerCase().includes("base") ? 0 : 1;
    if (abase !== bbase) return abase - bbase;
    return parseInt(a.anos, 10) - parseInt(b.anos, 10);
  });

  // ✅ Ativo só na última linha E só se aquela seleção for ativa de verdade
  if (active && out.length && out[out.length - 1]._active) {
    const start = parseInt(out[out.length - 1].anos, 10);
    out[out.length - 1].anos = `${start}${EN_DASH}`;
  }

  // remove campo interno
  return out.map(({ _active, ...rest }) => rest);
}
