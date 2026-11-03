import { user } from './auth.js';

export function devolucoes() {
  const emprestimos = window.db?.emprestimos || [];
  const devolucoesReg = window.db?.devolucoes || [];

  const lotesMap = {};

  // Apenas lotes com entrega realizada (ignora os "aguardando")
  emprestimos.forEach(emp => {
    if (!emp) return;
    if (emp.status === "aguardando") return;

    const bid = emp.batchId || emp.idDoc || emp.id;
    if (!lotesMap[bid]) {
      lotesMap[bid] = {
        batchId: bid,
        professor: emp.userName || "Não identificado",
        dataUso: emp.date || "—",
        tipo: emp.tipoEquipamento || "notebook",
        aulas: new Set(),
        retiradaEm: emp.createdAt || "—",
        status: emp.status || "retirado",
        maquinas: new Set()
      };
    }
    if (emp.lessons && Array.isArray(emp.lessons)) {
      emp.lessons.forEach(l => lotesMap[bid].aulas.add(l));
    } else if (emp.lesson) {
      lotesMap[bid].aulas.add(emp.lesson);
    }

    const eqs = emp.equipments || (emp.equipment ? [emp.equipment] : []);
    eqs.forEach(eq => {
      if (eq && eq !== "Pendente") {
        lotesMap[bid].maquinas.add({ nome: eq });
      }
    });
  });

  // Integrar histórico de devoluções
  devolucoesReg.forEach(dev => {
    if (!dev) return;
    const bid = dev.batchId || dev.idDoc || dev.id;
    if (!lotesMap[bid]) {
      lotesMap[bid] = {
        batchId: bid,
        professor: dev.userName || "Não identificado",
        dataUso: dev.dateUse || "—",
        tipo: "notebook",
        aulas: new Set([dev.lesson || "—"]),
        retiradaEm: dev.deliveredAt || "—",
        status: "devolvido",
        maquinas: new Set()
      };
    }
    if (dev.equipment) {
      lotesMap[bid].maquinas.add({ nome: dev.equipment });
    }
  });

  // Ordenar do mais recente para o mais velho com base na data de uso
  let listaLotes = Object.values(lotesMap).sort((a, b) => (b.dataUso || "").localeCompare(a.dataUso || ""));

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Movimentações e Lotes da Frota</h2>
        <div class="muted">Visualização em blocos compactos (minimizado por padrão) do mais recente para o mais velho</div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn-secondary btn-sm" onclick="window.filtrarLotesMov('todos')">🔄 Todos</button>
        <button class="btn-secondary btn-sm" onclick="window.filtrarLotesMov('retirado')">🟢 Em Uso</button>
        <button class="btn-secondary btn-sm" onclick="window.filtrarLotesMov('devolvido')">⚪ Devolvidos</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 14px; padding: 12px;">
      <input id="searchLoteMov" placeholder="🔍 Pesquisar por professor ou máquina (ex: M1)..." class="inp" style="max-width:380px;">
    </div>

    <div id="containerCaixinhasLotes" style="display: flex; flex-direction: column; gap: 12px;">
      ${renderizarCaixinhasLotes(listaLotes)}
    </div>
  `;

  window._lotesMovCache = listaLotes;

  document.getElementById("searchLoteMov")?.addEventListener("input", (e) => {
    const q = e.target.value.toLowerCase();
    const filtrados = (window._lotesMovCache || []).filter(l => {
      const matchProf = l.professor.toLowerCase().includes(q);
      const matchMaq = Array.from(l.maquinas).some(m => m.nome.toLowerCase().includes(q));
      const matchId = l.batchId.toLowerCase().includes(q);
      return matchProf || matchMaq || matchId;
    });
    document.getElementById("containerCaixinhasLotes").innerHTML = renderizarCaixinhasLotes(filtrados);
  });
}

window.filtrarLotesMov = function(filtro) {
  const cache = window._lotesMovCache || [];
  let lista = cache;
  if (filtro !== 'todos') {
    lista = cache.filter(l => l.status === filtro);
  }
  document.getElementById("containerCaixinhasLotes").innerHTML = renderizarCaixinhasLotes(lista);
}

function renderizarCaixinhasLotes(lotes) {
  if (!lotes.length) {
    return `<p class="muted" style="padding:24px; text-align:center;">Nenhum lote com entrega realizada encontrado.</p>`;
  }

  return lotes.map(l => {
    const dataFmt = l.dataUso && l.dataUso !== '—' ? l.dataUso.split('-').reverse().join('/') : '—';
    const listaMaquinas = Array.from(l.maquinas);
    
    let statusBadge = '<span class="badge active">🟢 Em Uso</span>';
    if (l.status === 'devolvido') statusBadge = '<span class="badge muted">⚪ Devolvido</span>';

    const tipoIcon = l.tipo === 'tablet' ? '📱' : '💻';

    return `
      <details class="card" style="border-left: 4px solid var(--primary); padding: 14px 18px; border-radius: 12px; transition: border-color 0.2s;">
        <summary style="cursor: pointer; display: flex; justify-content: space-between; align-items: center; list-style: none; outline: none;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <span style="font-size: 18px;">${tipoIcon}</span>
            <div>
              <h3 style="font-size: 15px; margin: 0; display: inline-block;"><b>${window.esc ? window.esc(l.professor) : l.professor}</b></h3>
              <span class="muted" style="margin-left: 10px; font-size: 12px;">Data: ${dataFmt}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px;">
            ${statusBadge}
            <span style="font-size: 12px; color: var(--text-muted); font-weight: 500;">▼ Expandir</span>
          </div>
        </summary>

        <div style="margin-top: 14px; padding-top: 14px; border-top: 1px solid var(--border);">
          <div style="font-size: 13px; margin-bottom: 12px; display: flex; flex-direction: column; gap: 6px;">
            <div><b>Lote ID:</b> <span style="font-family: monospace; color: var(--accent-cyan);">${l.batchId.substring(0, 10)}...</span></div>
            <div><b>Aulas Utilizadas:</b> ${Array.from(l.aulas).join(", ") || "—"}</div>
            <div><small class="muted">Horário de Retirada: ${l.retiradaEm}</small></div>
          </div>

          <hr style="border: none; border-top: 1px solid var(--border); margin: 10px 0;">

          <div style="font-size: 12px; font-weight: 600; margin-bottom: 6px; color: var(--text-muted);">MÁQUINAS DO LOTE (${listaMaquinas.length}):</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 0;">
            ${listaMaquinas.length ? listaMaquinas.map(m => `
              <span class="badge" style="background: rgba(59,130,246,0.15); color: #38bdf8; border-color: rgba(59,130,246,0.3); font-size: 12px; padding: 4px 8px;">
                💻 ${m.nome}
              </span>
            `).join("") : '<span class="muted" style="font-size: 12px;">Nenhuma máquina atribuída.</span>'}
          </div>
        </div>
      </details>
    `;
  }).join("");
}