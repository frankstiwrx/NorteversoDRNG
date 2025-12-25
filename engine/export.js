export function exportPlayerJSON({ clubes_profissionais, selecao_nacional }) {
  // export apenas dos blocos (pra colar dentro do jogador)
  const obj = {
    clubes_profissionais,
    selecao_nacional,
  };
  return JSON.stringify(obj, null, 2);
}
