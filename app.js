import {
  DEFAULT_TRANSFER_SPLIT,
  ERAS,
  ROLE_PCTS,
  toSeasonStr,
  buildSeasonList,
} from "./engine/rules.js";
import { calcSeasonClubStats, calcSelectionStats } from "./engine/calc.js";
import { mergeClubPassages, mergeSelectionContinuous } from "./engine/merge.js";
import { exportPlayerJSON } from "./engine/export.js";

const $ = (id) => document.getElementById(id);

const state = {
  clubes: [],
  temporadas: [],
};

function enDash(a, b) {
  return `${a}\u2013${b}`;
}

function addClubeRow(preset = {}) {
  const row = {
    clube: preset.clube ?? "",
    ini: preset.ini ?? 2015, // ano inicial (temporada ini–ini+1)
    fim: preset.fim ?? 2016, // ano inicial última temporada
    emprestimo: preset.emprestimo ?? false,
    dono: preset.dono ?? false,
    divisao: preset.divisao ?? 1, // 1/2/3
  };
  state.clubes.push(row);
  renderClubes();
}

function removeClube(i) {
  state.clubes.splice(i, 1);
  renderClubes();
}

function renderClubes() {
  const wrap = $("clubesList");
  wrap.innerHTML = "";

  state.clubes.forEach((c, idx) => {
    const el = document.createElement("div");
    el.className = "item";

    el.innerHTML = `
      <div class="itemHead">
        <div class="itemTitle">Passagem #${idx + 1}</div>
        <button class="btn" data-del="${idx}">Remover</button>
      </div>
      <div class="itemGrid">
        <div class="row">
          <label>Clube</label>
          <input data-k="clube" data-i="${idx}" value="${
      c.clube
    }" placeholder="Ex: Norte44" />
        </div>
        <div class="row">
          <label>Início (ano)</label>
          <input data-k="ini" data-i="${idx}" type="number" value="${
      c.ini
    }" min="1950" max="2025" />
        </div>
        <div class="row">
          <label>Fim (ano)</label>
          <input data-k="fim" data-i="${idx}" type="number" value="${
      c.fim
    }" min="1950" max="2025" />
        </div>
        <div class="row">
          <label>Divisão</label>
          <select data-k="divisao" data-i="${idx}">
            <option value="1" ${c.divisao === 1 ? "selected" : ""}>1ª</option>
            <option value="2" ${c.divisao === 2 ? "selected" : ""}>2ª</option>
            <option value="3" ${c.divisao === 3 ? "selected" : ""}>3ª</option>
          </select>
        </div>
      </div>
      <div class="row2">
        <label><input data-k="emprestimo" data-i="${idx}" type="checkbox" ${
      c.emprestimo ? "checked" : ""
    }/> Empréstimo</label>
        <label><input data-k="dono" data-i="${idx}" type="checkbox" ${
      c.dono ? "checked" : ""
    }/> Dono do contrato</label>
      </div>
      <p class="hint">
        Observação: empréstimos não quebram a passagem do clube dono no export. Se a temporada tiver 2 clubes, o preset padrão é ${
          DEFAULT_TRANSFER_SPLIT.label
        }.
      </p>
    `;

    wrap.appendChild(el);
  });

  wrap.querySelectorAll("button[data-del]").forEach((btn) => {
    btn.addEventListener("click", () => removeClube(Number(btn.dataset.del)));
  });

  wrap.querySelectorAll("input[data-k], select[data-k]").forEach((inp) => {
    inp.addEventListener("input", () => {
      const i = Number(inp.dataset.i);
      const k = inp.dataset.k;
      if (k === "emprestimo" || k === "dono") {
        state.clubes[i][k] = inp.checked;
      } else if (k === "ini" || k === "fim" || k === "divisao") {
        state.clubes[i][k] = Number(inp.value);
      } else {
        state.clubes[i][k] = inp.value;
      }
    });
  });
}

function gerarTemporadas() {
  const inicio = Number($("inicio").value);
  const fim = Number($("fim").value);

  const seasons = buildSeasonList(inicio, fim); // lista de anos iniciais: [2015, 2016, ...]
  const clubes = normalizeClubes(state.clubes);

  // construir mapa season -> clubes ativos nessa season
  const seasonMap = new Map();
  for (const y of seasons) seasonMap.set(y, []);

  for (const c of clubes) {
    for (let y = c.ini; y <= c.fim; y++) {
      if (!seasonMap.has(y)) continue;
      seasonMap.get(y).push(c);
    }
  }

  // temporadas editáveis: papel/fase/evento; e preset se houver 2+ clubes
  state.temporadas = seasons.map((y) => {
    const clubsInSeason = seasonMap.get(y) ?? [];
    // ordena: dono primeiro (se houver), depois resto
    clubsInSeason.sort((a, b) => Number(b.dono) - Number(a.dono));

    return {
      y, // ano inicial da temporada
      seasonStr: toSeasonStr(y),
      role: "reserva", // default
      phase: "comum", // comum/bom/excelente/craque/decadencia/aposentando/recem_base_normal/recem_base_fenomeno
      event: "nenhum", // nenhum/lesao_grave/lesao_recorrente/explosao/ano_apagado/queda_brusca/renascimento/transferencia_conturbada
      transferSplit: DEFAULT_TRANSFER_SPLIT.key, // só usado se 2 clubes na temporada
      clubs: clubsInSeason.map((c) => ({ ...c })), // snapshot
    };
  });

  renderTemporadas();
}

function normalizeClubes(rows) {
  // filtra vazios e corrige ranges
  return rows
    .filter((r) => (r.clube ?? "").trim().length > 0)
    .map((r) => {
      const ini = Number(r.ini);
      const fim = Number(r.fim);
      return {
        clube: r.clube.trim(),
        ini: Math.min(ini, fim),
        fim: Math.max(ini, fim),
        emprestimo: Boolean(r.emprestimo),
        dono: Boolean(r.dono),
        divisao: [1, 2, 3].includes(Number(r.divisao)) ? Number(r.divisao) : 1,
      };
    });
}

function renderTemporadas() {
  const wrap = $("temporadasList");
  wrap.innerHTML = "";

  state.temporadas.forEach((t, idx) => {
    const el = document.createElement("div");
    el.className = "item";

    const clubsTxt = t.clubs
      .map(
        (c) =>
          `${c.clube}${c.emprestimo ? " (emp.)" : ""}${c.dono ? " [dono]" : ""}`
      )
      .join(" • ");
    const hasTransfer = t.clubs.length >= 2;

    el.innerHTML = `
      <div class="itemHead">
        <div class="itemTitle">${t.seasonStr} — ${
      clubsTxt || "<sem clubes>"
    }</div>
        <div class="muted small">#${idx + 1}</div>
      </div>

      <div class="itemGrid">
        <div class="row">
          <label>Papel no elenco</label>
          <select data-k="role" data-i="${idx}">
            ${Object.keys(ROLE_PCTS)
              .map(
                (k) =>
                  `<option value="${k}" ${t.role === k ? "selected" : ""}>${
                    ROLE_PCTS[k].label
                  }</option>`
              )
              .join("")}
          </select>
        </div>

        <div class="row">
          <label>Fase</label>
          <select data-k="phase" data-i="${idx}">
            <option value="recem_base_normal" ${
              t.phase === "recem_base_normal" ? "selected" : ""
            }>Recém subiu (normal)</option>
            <option value="recem_base_fenomeno" ${
              t.phase === "recem_base_fenomeno" ? "selected" : ""
            }>Recém subiu (fenômeno)</option>
            <option value="comum" ${
              t.phase === "comum" ? "selected" : ""
            }>Jogador comum</option>
            <option value="bom" ${
              t.phase === "bom" ? "selected" : ""
            }>Bom</option>
            <option value="excelente" ${
              t.phase === "excelente" ? "selected" : ""
            }>Excelente</option>
            <option value="craque" ${
              t.phase === "craque" ? "selected" : ""
            }>Craque</option>
            <option value="decadencia" ${
              t.phase === "decadencia" ? "selected" : ""
            }>Decadência</option>
            <option value="aposentando" ${
              t.phase === "aposentando" ? "selected" : ""
            }>Quase aposentando</option>
          </select>
        </div>

        <div class="row">
          <label>Evento raro</label>
          <select data-k="event" data-i="${idx}">
            <option value="nenhum" ${
              t.event === "nenhum" ? "selected" : ""
            }>Nenhum</option>
            <option value="lesao_grave" ${
              t.event === "lesao_grave" ? "selected" : ""
            }>Lesão grave</option>
            <option value="lesao_recorrente" ${
              t.event === "lesao_recorrente" ? "selected" : ""
            }>Lesão recorrente</option>
            <option value="explosao" ${
              t.event === "explosao" ? "selected" : ""
            }>Explosão</option>
            <option value="ano_apagado" ${
              t.event === "ano_apagado" ? "selected" : ""
            }>Ano apagado</option>
            <option value="queda_brusca" ${
              t.event === "queda_brusca" ? "selected" : ""
            }>Queda brusca</option>
            <option value="renascimento" ${
              t.event === "renascimento" ? "selected" : ""
            }>Renascimento</option>
            <option value="transferencia_conturbada" ${
              t.event === "transferencia_conturbada" ? "selected" : ""
            }>Transferência conturbada</option>
          </select>
        </div>

        <div class="row" style="${hasTransfer ? "" : "opacity:.5"}">
          <label>Preset transferência (A/B)</label>
          <select data-k="transferSplit" data-i="${idx}" ${
      hasTransfer ? "" : "disabled"
    }>
            <option value="curta" ${
              t.transferSplit === "curta" ? "selected" : ""
            }>25/75 (curta)</option>
            <option value="media" ${
              t.transferSplit === "media" ? "selected" : ""
            }>40/60 (média — default)</option>
            <option value="meio" ${
              t.transferSplit === "meio" ? "selected" : ""
            }>50/50</option>
            <option value="longa" ${
              t.transferSplit === "longa" ? "selected" : ""
            }>60/40</option>
            <option value="muito_longa" ${
              t.transferSplit === "muito_longa" ? "selected" : ""
            }>75/25</option>
          </select>
        </div>
      </div>

      <p class="hint">${
        hasTransfer
          ? "Tem 2+ clubes na temporada: motor divide jogos/gols com base no preset (padrão 40/60)."
          : "Sem transferência na temporada."
      }</p>
    `;

    wrap.appendChild(el);
  });

  wrap.querySelectorAll("select[data-k]").forEach((sel) => {
    sel.addEventListener("change", () => {
      const i = Number(sel.dataset.i);
      const k = sel.dataset.k;
      state.temporadas[i][k] = sel.value;
    });
  });
}

function gerarJSON() {
  // 1) coletar DNA
  const dna = {
    nome: $("nome").value.trim(),
    posicao: $("posicao").value,
    nivel: Number($("nivel").value),
    perfilGols: $("perfilGols").value, // nao/sim/extra
    fisico: $("fisico").value, // fragil/normal/tanque
    inicio: Number($("inicio").value),
    fim: Number($("fim").value),
    ativo: $("ativo").checked,
  };

  const clubes = normalizeClubes(state.clubes);

  // 2) gerar stats por temporada e por clube (interno)
  const perSeasonClub = [];
  for (const t of state.temporadas) {
    const stats = calcSeasonClubStats({ dna, season: t, eras: ERAS });
    // stats retorna array por clube na temporada
    perSeasonClub.push(...stats);
  }

  // 3) merge/passagens (export)
  const mergedClubs = mergeClubPassages(perSeasonClub, { active: dna.ativo });

  // 4) seleção
  const selecaoRaw = [];
  const baseOn = $("baseSim").checked;
  const selOn = $("selSim").checked;

  if (baseOn) {
    const base = calcSelectionStats({
      dna,
      kind: "base",
      name: $("baseNome").value.trim() || "Seleção (base)",
      ini: Number($("baseIni").value),
      fim: Number($("baseFim").value),
      papel: $("basePapel").value,
      perfil: $("basePerfil").value,
    });
    selecaoRaw.push(base);
  }

  if (selOn) {
    const principal = calcSelectionStats({
      dna,
      kind: "principal",
      name: $("selNome").value.trim() || "Seleção",
      ini: Number($("selIni").value),
      fim: Number($("selFim").value),
      papel: $("selPapel").value,
      perfil: $("selPerfil").value,
      active: dna.ativo,
    });
    selecaoRaw.push(principal);
  }

  const mergedSelection = mergeSelectionContinuous(selecaoRaw, {
    active: dna.ativo,
  });

  // 5) export JSON final (só os blocos)
  const out = exportPlayerJSON({
    clubes_profissionais: mergedClubs,
    selecao_nacional: mergedSelection,
  });
  $("out").value = out;
}

function copyOut() {
  const ta = $("out");
  ta.select();
  document.execCommand("copy");
}

$("addClube").addEventListener("click", () =>
  addClubeRow({
    ini: Number($("inicio").value),
    fim: Math.min(Number($("inicio").value) + 1, Number($("fim").value)),
  })
);

$("gerarTemp").addEventListener("click", () => gerarTemporadas());
$("gerarJson").addEventListener("click", () => gerarJSON());
$("copiar").addEventListener("click", () => copyOut());

// setup inicial
addClubeRow({
  clube: "Norte44",
  ini: 2015,
  fim: 2025,
  emprestimo: false,
  dono: true,
  divisao: 1,
});
