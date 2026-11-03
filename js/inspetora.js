import { firestore } from './auth.js';
import { TABELAS_HORARIOS } from './config.js';

export function inspetoraPainel() {
  const usuarioLogado = window.user || {};
  const turnoAtual = usuarioLogado.turno || "manhã";
  const hojeStr = new Date().toISOString().split('T')[0];

  // Filtra empréstimos/agendamentos ativos do dia
  const emprestimosDia = (window.db?.emprestimos || []).filter(r => 
    r && r.date === hojeStr && r.status !== "cancelado"
  );

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Controle de Saídas (Inspetoria)</h2>
        <div class="muted">Lista rápida de computadores e equipamentos previstos para saída hoje</div>
      </div>
      <div>
        <button class="btn-primary btn-sm" onclick="window.nav('inspetoras')">🔄 Atualizar Fila</button>
      </div>
    </div>

    <div class="card">
      <h3 style="font-size: 14px; margin-bottom: 14px; color: var(--text-main);">💻 Fila de Equipamentos para Saída e Retorno</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>PROFESSOR</th>
              <th>TIPO</th>
              <th>QTD.</th>
              <th>EQUIPAMENTOS</th>
              <th>HORÁRIOS</th>
              <th>STATUS</th>
              <th>AÇÃO RÁPIDA</th>
            </tr>
          </thead>
          <tbody>
            ${emprestimosDia.length ? emprestimosDia.map(emp => {
              const idReg = emp.idDoc || emp.id;
              const nomeProf = emp.userName || 'Professor(a)';
              const qtd = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 1);
              const status = emp.status || 'aguardando';
              const tipo = emp.tipoEquipamento === 'tablet' ? '📱 Tablet' : '💻 Notebook';
              
              const eqList = emp.equipments || (emp.equipment ? [emp.equipment] : []);
              const validEqs = eqList.filter(x => x && x !== "Pendente");
              
              let aulasTxt = emp.lessons ? emp.lessons.join(", ") : "—";

              let badgeStyle = "background:rgba(59, 130, 246, 0.15); color: #38bdf8;";
              if (status === 'retirado') badgeStyle = "background:rgba(16, 185, 129, 0.15); color: #34d399;";
              if (status === 'devolvido') badgeStyle = "background:rgba(107, 114, 128, 0.15); color: #9ca3af;";

              return `
                <tr>
                  <td><b>${window.esc(nomeProf)}</b></td>
                  <td><span class="badge" style="background:rgba(59,130,246,0.1); color:#38bdf8;">${tipo}</span></td>
                  <td><b>${validEqs.length > 0 ? validEqs.length : qtd} máq.</b></td>
                  <td><code>${validEqs.length > 0 ? window.esc(validEqs.join(", ")) : "Aguardando Atribuição"}</code></td>
                  <td><small>${window.esc(aulasTxt)}</small></td>
                  <td><span class="badge" style="${badgeStyle}">${status.toUpperCase()}</span></td>
                  <td>
                    <div style="display:flex; gap:6px;">
                      ${status === 'aguardando' ? `
                        <button class="btn-sm" style="background:var(--primary); color:#fff; font-weight:bold;" onclick="window.inspetoraRegistrarAcao('${idReg}', 'retirado')">✅ Entregar</button>
                      ` : (status === 'retirado' ? `
                        <button class="btn-sm danger" onclick="window.inspetoraRegistrarAcao('${idReg}', 'devolvido')">↩️ Devolver</button>
                      ` : `
                        <span class="muted" style="font-size:11px;">Concluído</span>
                      `)}
                    </div>
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="7" style="text-align:center;" class="muted">Nenhum equipamento agendado para saída hoje.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Ação rápida da inspetora para marcar Entrega ou Devolução com histórico automático
window.inspetoraRegistrarAcao = async function(idReg, novoStatus) {
  const target = (window.db?.emprestimos || []).find(x => (x.idDoc === idReg || x.id === idReg));
  if (!target) return alert("Registro não encontrado.");

  if (novoStatus === 'devolvido') {
    if (!confirm("Confirmar a devolução deste equipamento?")) return;
    try {
      await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });
      
      const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
      const validEqs = eqList.filter(x => x && x !== "Pendente");
      const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");
      
      const nowStr = new Date();
      const dataDevolucao = `${String(nowStr.getDate()).padStart(2, '0')}/${String(nowStr.getMonth() + 1).padStart(2, '0')}/${nowStr.getFullYear()} às ${String(nowStr.getHours()).padStart(2, '0')}:${String(nowStr.getMinutes()).padStart(2, '0')}`;

      for (let eq of validEqs) {
        await firestore.collection("devolucoes").add({
          id: Date.now().toString(36),
          batchId: target.batchId || target.idDoc,
          userName: target.userName,
          equipment: eq,
          lesson: labelAulas,
          dateUse: target.date,
          deliveredAt: target.createdAt || "—",
          returnedAt: dataDevolucao + " (Inspetoria)"
        });
      }

      alert("Devolução registrada com sucesso!");
      window.nav("inspetoras");
    } catch (err) {
      alert("Erro ao registrar devolução: " + err.message);
    }
  } else {
    if (!confirm("Confirmar a entrega deste equipamento ao professor?")) return;
    try {
      await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "retirado" });
      alert("Entrega registrada com sucesso!");
      window.nav("inspetoras");
    } catch (err) {
      alert("Erro ao registrar entrega: " + err.message);
    }
  }
};