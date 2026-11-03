import { firestore, user } from './auth.js';
import { TABELAS_HORARIOS_TARDE } from './config.js';

export function moduloTardeAtribuicao() {
  const container = document.getElementById("main");
  
  // Filtra os empréstimos/reservas do dia atual ou pendentes de atribuição
  const reservasTarde = (window.db.emprestimos || []).filter(r => r.status !== "cancelado");

  container.innerHTML = `
    <div class="head">
      <div>
        <h2>☀️ Painel de Atribuição - Turno Tarde</h2>
        <div class="muted">Interface simplificada para os professores gerirem e atribuírem máquinas</div>
      </div>
    </div>

    <div class="card">
      <h3 style="margin-bottom: 12px; font-size: 14px;">📋 Reservas Ativas do Turno</h3>
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Data</th>
              <th>Professor</th>
              <th>Aulas / Horário</th>
              <th>Qtd. Máquinas</th>
              <th>Ação Rápida</th>
            </tr>
          </thead>
          <tbody>
            ${reservasTarde.length ? reservasTarde.map(res => `
              <tr>
                <td><b>${res.date ? res.date.split('-').reverse().join('/') : ''}</b></td>
                <td>👤 ${window.esc(res.userName)}</td>
                <td>
                  <span class="badge active">
                    ${res.lessonIndexes ? res.lessonIndexes.map(idx => TABELAS_HORARIOS_TARDE[idx]?.label).join(', ') : 'Horário Geral'}
                  </span>
                </td>
                <td><b>${res.quantity || res.qtdPedida || 1} máq.</b></td>
                <td>
                  <button class="btn-primary btn-sm" onclick="window.atribuirRapidoTarde('${res.idDoc || res.id}')">
                    ⚡ Atribuir Máquinas
                  </button>
                </td>
              </tr>
            `).join('') : `<tr><td colspan="5" style="text-align:center;" class="muted">Sem reservas registadas no momento.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Função simples para o professor atribuir o lote/intervalo rapidamente
window.atribuirRapidoTarde = function(idDoc) {
  const reserva = (window.db.emprestimos || []).find(r => (r.idDoc === idDoc || r.id === idDoc));
  if (!reserva) return alert("Reserva não encontrada.");

  const m = window.modal(`
    <div class="modal-box" style="max-width: 450px;">
      <div class="modal-top">
        <h2>⚡ Atribuição Rápida</h2>
        <button class="close">&times;</button>
      </div>
      <p class="muted" style="margin-bottom: 12px; font-size: 13px;">
        Professor(a): <b>${window.esc(reserva.userName)}</b><br>
        Quantidade solicitada: <b>${reserva.quantity || 1} unidades</b>
      </p>
      
      <form id="fAtribTarde">
        <label class="lbl">Insira ou pistole os números dos equipamentos (separados por vírgula ou espaço):
          <textarea id="eqsAtribuidas" class="inp" rows="4" placeholder="Ex: NB-01, NB-02, NB-03..." required style="margin-top:4px;"></textarea>
        </label>
        <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Concluir Atribuição</button>
      </form>
    </div>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fAtribTarde").onsubmit = async (e) => {
    e.preventDefault();
    const textoEqs = document.getElementById("eqsAtribuidas").value.trim();
    const listaEqs = textoEqs.split(/[\s,]+/).filter(Boolean);

    try {
      await firestore.collection("emprestimos").doc(idDoc).update({
        equipments: listaEqs,
        status: "atribuido",
        atribuidoPor: user?.name || "Professor"
      });
      alert("Máquinas atribuídas com sucesso!");
      m.remove();
      window.nav("tarde");
    } catch (err) {
      alert("Erro ao atribuir: " + err.message);
    }
  };
};