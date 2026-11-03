import { TABELAS_HORARIOS } from './config.js';

export function ocupacao() {
  const hoje = new Date().toISOString().split("T")[0];
  const dataFormatada = hoje.split('-').reverse().join('/');
  const emprestimosHoje = (window.db.emprestimos || []).filter(r => r.date === hoje && r.status !== "cancelado");
  
  const TOTAL_NOTEBOOKS = 153;
  const TOTAL_TABLETS = 23;
  const TOTAL_GERAL = 176;

  const tabelaAulas = TABELAS_HORARIOS["6_7"] || [];
  const usoPorAula = tabelaAulas.map((aula, idx) => {
    let notebooksUsados = 0;
    let tabletsUsados = 0;
    
    emprestimosHoje.forEach(emp => {
      const temAula = (emp.lessonIndexes && emp.lessonIndexes.includes(idx)) || (emp.lessonIndex === idx);
      if (temAula) {
        const qtd = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 1);
        if (emp.tipoEquipamento === "tablet" || emp.type === "tablet" || (emp.equipments && emp.equipments.some(e => e && e.startsWith("TAB")))) {
          tabletsUsados += qtd;
        } else {
          notebooksUsados += qtd;
        }
      }
    });

    const totalAula = notebooksUsados + tabletsUsados;
    return {
      label: aula.label,
      horario: `${aula.start} - ${aula.end}`,
      total: totalAula > TOTAL_GERAL ? TOTAL_GERAL : totalAula
    };
  });

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>📊 Porcentagem de Uso nas Aulas</h2>
        <div class="muted">Acompanhamento percentual da frota total (${TOTAL_GERAL} máquinas) para hoje (${dataFormatada})</div>
      </div>
    </div>

    <div class="filter-grid" style="margin-bottom:16px;">
      <div class="card">
        <div class="muted">Notebooks Disponíveis</div>
        <b style="font-size:20px;">${TOTAL_NOTEBOOKS} un.</b>
      </div>
      <div class="card">
        <div class="muted">Tablets Disponíveis</div>
        <b style="font-size:20px;">${TOTAL_TABLETS} un.</b>
      </div>
      <div class="card">
        <div class="muted">Capacidade Total da Frota</div>
        <b style="font-size:20px;">${TOTAL_GERAL} un.</b>
      </div>
    </div>

    <div class="card">
      <h3>Detalhamento Percentual por Horário de Aula</h3>
      <div class="table-container" style="margin-top:12px;">
        <table>
          <thead>
            <tr>
              <th>Aula / Horário</th>
              <th>Em Uso (Máqs.)</th>
              <th>% de Uso Geral</th>
              <th>Status da Frota</th>
            </tr>
          </thead>
          <tbody>
            ${usoPorAula.map(u => {
              const pct = Math.min(100, Math.round((u.total / TOTAL_GERAL) * 100));
              let badgeStyle = "background:rgba(59,130,246,0.15); color:#38bdf8; border-color:rgba(59,130,246,0.3);";
              let statusLabel = "Livre / Baixa";
              
              if (pct > 70) {
                badgeStyle = "background:rgba(239,68,68,0.15); color:#f87171; border-color:rgba(239,68,68,0.3);";
                statusLabel = "Alta Demanda";
              } else if (pct > 30) {
                badgeStyle = "background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);";
                statusLabel = "Moderado";
              }

              return `
                <tr>
                  <td><b>${u.label}</b> <small class="muted">(${u.horario})</small></td>
                  <td><b>${u.total} / ${TOTAL_GERAL}</b></td>
                  <td>
                    <div style="display:flex; align-items:center; gap:10px;">
                      <div style="flex:1; background:rgba(255,255,255,0.08); border-radius:4px; height:8px; overflow:hidden; min-width:100px;">
                        <div style="width:${pct}%; height:100%; background:${pct > 70 ? '#ef4444' : pct > 30 ? '#f59e0b' : '#38bdf8'};"></div>
                      </div>
                      <b style="min-width:38px; text-align:right;">${pct}%</b>
                    </div>
                  </td>
                  <td><span class="badge" style="${badgeStyle}">${statusLabel}</span></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}