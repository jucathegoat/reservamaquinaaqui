import { escapeHtml } from './auth.js';

export function dashboard() {
  const container = document.getElementById("main");
  if (!container) return;
  
  const user = window.user || {};
  const turnoUser = user?.turno || "manhã";
  const isAdminOrAmbos = user?.role === "admin" || turnoUser === "ambos";

  const emprestimos = window.db?.emprestimos || [];
  const hojeStr = new Date().toISOString().split('T')[0];

  // Filtra por turno/perfil
  const emprestimosFiltrados = emprestimos.filter(r => {
    if (!r || r.status === "cancelado") return false;
    if (isAdminOrAmbos) return true;
    return r.turno === turnoUser || (!r.turno && turnoUser === "manhã");
  });

  const emprestimosHoje = emprestimosFiltrados.filter(r => r.date === hojeStr);

  // Totais reais do inventário
  const totalComputadores = 159; 
  const totalMaquinasGlobal = 176;

  // Estrutura das categorias com inventário exato
  const categorias = [
    { id: "M", nome: "💻 Notebooks Multilaser (M)", inventario: 94, cor: "#38bdf8" },
    { id: "SA", nome: "💻 Notebooks Samsung (SA)", inventario: 40, cor: "#0284c7" },
    { id: "PV_PN", nome: "💻 Positivo / Outros (PV/PN)", inventario: 25, cor: "#10b981" },
    { id: "TAB", nome: "📱 Tablets (TAB)", inventario: 17, cor: "#f59e0b" }
  ];

  container.innerHTML = `
    <div class="head">
      <div>
        <h2>📊 Dashboard Principal (${isAdminOrAmbos ? 'Geral / Ambos' : turnoUser.toUpperCase()})</h2>
        <div class="muted">Resumo operacional, inventário e estatísticas do turno</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 20px;">
      <div class="card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <span class="muted" style="font-size: 12px; font-weight: bold;">RESERVAS HOJE</span>
        <h3 style="font-size: 28px; margin-top: 8px; color: #38bdf8;">${emprestimosHoje.length}</h3>
        <span class="muted" style="font-size: 11px; margin-top: 4px;">Agendamentos para a data atual</span>
      </div>

      <div class="card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <span class="muted" style="font-size: 12px; font-weight: bold;">TOTAL DE COMPUTADORES</span>
        <h3 style="font-size: 28px; margin-top: 8px; color: #10b981;">${totalComputadores}</h3>
        <span class="muted" style="font-size: 11px; margin-top: 4px;">Notebooks registrados no inventário</span>
      </div>

      <div class="card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between;">
        <span class="muted" style="font-size: 12px; font-weight: bold;">TOTAL DE MÁQUINAS</span>
        <h3 style="font-size: 28px; margin-top: 8px; color: #f59e0b;">${totalMaquinasGlobal}</h3>
        <span class="muted" style="font-size: 11px; margin-top: 4px;">Capacidade máxima global da escola</span>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 12px; font-size: 14px;">📈 Tabela de Utilização e Percentagens por Categoria</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Modelo / Categoria</th>
              <th>Total Inventário</th>
              <th>Alocados / Em Uso</th>
              <th>Disponíveis</th>
              <th>Taxa de Utilização</th>
            </tr>
          </thead>
          <tbody>
            ${categorias.map(cat => {
              // Contagem em tempo real dos equipamentos alocados hoje
              let emUso = 0;
              emprestimosHoje.forEach(r => {
                const eqList = r.equipments || (r.equipment ? [r.equipment] : []);
                emUso += eqList.filter(e => {
                  if (!e || e === "Pendente") return false;
                  if (cat.id === "PV_PN") return e.startsWith("PV") || e.startsWith("PN");
                  return e.startsWith(cat.id);
                }).length;
              });

              const disponiveis = Math.max(0, cat.inventario - emUso);
              const pct = Math.min(100, Math.round((emUso / cat.inventario) * 100));

              return `
                <tr>
                  <td><b>${escapeHtml(cat.nome)}</b></td>
                  <td>${cat.inventario}</td>
                  <td><b>${emUso}</b></td>
                  <td>${disponiveis}</td>
                  <td>
                    <div style="display:flex; align-items:center; gap:8px;">
                      <div style="flex:1; background:var(--border); border-radius:4px; height:8px; overflow:hidden;">
                        <div style="width:${pct}%; background:${cat.cor}; height:100%;"></div>
                      </div>
                      <small style="min-width:30px; font-weight:bold;">${pct}%</small>
                    </div>
                  </td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;
}