import { verificarSessaoSalva, iniciarSessao, user, firestore } from './auth.js';
import { dashboard } from './dashboard.js';
import { solicitacoes } from './solicitacoes.js';
import { calendario } from './calendario.js';
import { avarias } from './avarias.js';
import { ocupacao } from './ocupacao.js';
import { devolucoes } from './devolucoes.js';
import { bloqueios } from './bloqueios.js';
import { usuarios } from './usuarios.js';
import { muralProati } from './mural.js';

// Inicialização das coleções globais (sem dúvidas)
window.db = { 
  users: [], 
  machines: [], 
  reservas: [], 
  bloqueios: [], 
  emprestimos: [], 
  transferencias: [], 
  reports: [], 
  devolucoes: [], 
  mural: []
};

window.currentPage = "dashboard";

const menusAdminProf = [
  ["dashboard", "Dashboard"],
  ["calendario", "Calendário"],
  ["solicitacoes", "Solicitações & Reservas"],
  ["devolucoes", "Histórico Devoluções"],
  ["avarias", "Avarias"],
  ["mural", "📢 Mural"],
  ["bloqueios", "Bloqueios"],
  ["usuarios", "Usuários"],
  ["tutorial", "💡 Tutorial"]
];

window.nav = function(page) {
  window.currentPage = page;
  const userRole = user?.role || "professor";

  // Se for Inspetora, redireciona diretamente para a vista restrita de consulta rápida
  if (userRole === "inspetora") {
    renderizarPainelInspetora();
    return;
  }

  const navEl = document.getElementById("nav");
  if (navEl) {
    navEl.innerHTML = menusAdminProf
      .filter(x => userRole === "admin" || !["bloqueios", "usuarios"].includes(x[0]))
      .map(x => `<button class="${x[0] === page ? "active" : ""}" onclick="window.nav('${x[0]}')">${x[1]}</button>`)
      .join("");
  }

  if (page === "dashboard") dashboard();
  else if (page === "ocupacao") ocupacao();
  else if (page === "calendario") calendario();
  else if (page === "solicitacoes") solicitacoes();
  else if (page === "devolucoes") devolucoes();
  else if (page === "avarias") avarias();
  else if (page === "mural") muralProati();
  else if (page === "bloqueios") bloqueios();
  else if (page === "usuarios") usuarios();
  else if (page === "tutorial") {
    document.getElementById("main").innerHTML = `
      <div class="card">
        <h2>💡 Tutorial do Sistema</h2>
        <p class="muted">Guia de utilização rápida para professores e administradores da PEI Maria Olímpia.</p>
      </div>
    `;
  }
}

// Ecrã Exclusivo e Rápido para a Inspetora (Consulta de Agendamentos e Entrega)
function renderizarPainelInspetora() {
  const navEl = document.getElementById("nav");
  if (navEl) navEl.innerHTML = ""; 

  const hoje = new Date().toISOString().split("T")[0];
  const emprestimosHoje = (window.db?.emprestimos || []).filter(x => x && x.date === hoje);

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>📋 Consulta Rápida de Agendamentos (Inspetoria)</h2>
        <div class="muted">Controle de entregas e devoluções para hoje (${hoje.split('-').reverse().join('/')})</div>
      </div>
      <div>
        <button class="btn-primary btn-sm" onclick="window.nav('inspetora')">🔄 Atualizar Lista</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 14px; padding: 14px;">
      <input id="searchInspetora" placeholder="🔍 Pesquisar por nome do professor ou número da máquina..." class="inp">
    </div>

    <div class="card">
      <div id="tabelaInspetoraContainer">
        ${renderTabelaRapidaInspetora(emprestimosHoje)}
      </div>
    </div>
  `;

  document.getElementById("searchInspetora")?.addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    const filtrados = emprestimosHoje.filter(x => {
      const eqStr = Array.isArray(x.equipments) ? x.equipments.join(" ").toLowerCase() : (x.equipment || "").toLowerCase();
      return (x.userName || "").toLowerCase().includes(q) || eqStr.includes(q);
    });
    document.getElementById("tabelaInspetoraContainer").innerHTML = renderTabelaRapidaInspetora(filtrados);
  });
}

function renderTabelaRapidaInspetora(lista) {
  if (!lista.length) {
    return `<p class="muted" style="text-align:center; padding:24px;">Nenhum agendamento encontrado para hoje.</p>`;
  }

  const groups = {};
  lista.forEach(x => {
    const bid = x.batchId || x.idDoc || x.id;
    if (!groups[bid]) {
      groups[bid] = {
        batchId: bid,
        userName: x.userName || "Não identificado",
        turno: x.turno || "manhã",
        tipoEquipamento: x.tipoEquipamento || "notebook",
        lessons: new Set(),
        equipments: new Set(),
        status: x.status || "aguardando",
        qtdTotalPedida: x.qtdTotalPedida || 1
      };
    }
    if (x.lessons && Array.isArray(x.lessons)) x.lessons.forEach(l => groups[bid].lessons.add(l));
    else if (x.lesson) groups[bid].lessons.add(x.lesson);

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipment.add(x.equipment);
  });

  const lotes = Object.values(groups);

  return `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Professor</th>
            <th>Turno</th>
            <th>Tipo</th>
            <th>Horários</th>
            <th>Atribuição / Estado</th>
            <th>Ações Rápidas</th>
          </tr>
        </thead>
        <tbody>
          ${lotes.map(g => {
            const eqArray = Array.from(g.equipments).filter(e => e && e !== "Pendente");
            const qtdAtribuida = eqArray.length;
            const isDevolvido = g.status === "devolvido";
            const isRetirado = g.status === "retirado";

            let badgeSt = `<span class="badge">Aguardando Entrega</span>`;
            if (isRetirado) badgeSt = `<span class="badge active">Em Uso</span>`;
            else if (isDevolvido) badgeSt = `<span class="badge muted">Devolvido</span>`;

            return `
              <tr>
                <td><b>${window.esc ? window.esc(g.userName) : g.userName}</b></td>
                <td><span class="badge" style="background:rgba(59,130,246,0.1); color:#38bdf8;">${g.turno.toUpperCase()}</span></td>
                <td>${g.tipoEquipamento === 'tablet' ? '📱 Tablet' : '💻 Notebook'}</td>
                <td><small>${Array.from(g.lessons).join(", ") || "—"}</small></td>
                <td>
                  <b>${qtdAtribuida} / ${g.qtdTotalPedida} máq.</b><br>
                  ${badgeSt}
                </td>
                <td>
                  <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn-sm btn-primary" onclick="window.modalAtribuirPorAula('${g.batchId}')">📌 Atribuir / Entregar</button>
                    ${!isDevolvido ? `<button class="btn-sm danger" onclick="window.devolverLoteComRegistro('${g.batchId}')">↩️ Registar Devolução</button>` : ''}
                  </div>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

document.addEventListener("DOMContentLoaded", () => {
  // Sincronização em tempo real das coleções ativas
  ["users", "machines", "reservas", "bloqueios", "emprestimos", "transferencias", "reports", "devolucoes", "mural"].forEach(col => {
    firestore.collection(col).onSnapshot(snapshot => {
      window.db[col] = snapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
      if (window.user && typeof window.nav === 'function') {
        window.nav(window.currentPage);
      }
    }, err => {
      console.error(`Erro ao carregar coleção ${col}:`, err);
    });
  });

  verificarSessaoSalva((u) => {
    iniciarSessao(u, window.nav);
  });
});

// Impede que Alt + Scroll do mouse/trackpad acione a navegação de histórico do navegador
window.addEventListener('wheel', (e) => {
  if (e.altKey) {
    e.preventDefault();
  }
}, { passive: false });