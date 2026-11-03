import { firestore, user } from './auth.js';
import { MODELOS_EQUIPAMENTO } from './config.js';

export function avarias() {
  document.getElementById("main").innerHTML = `
    <div class="head">
      <div><h2>Central de Avarias</h2><div class="muted">Relatórios de manutenção com fotos</div></div>
      <button class="btn-primary" onclick="window.modalReportDefeito()">+ Reportar Defeito</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Equipamento</th>
              <th>Defeito</th>
              <th>Foto</th>
              <th>Reportado por</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            ${(window.db.reports || []).map(r => `
              <tr>
                <td><b>[${window.esc(r.model)}] Nº ${window.esc(r.number)}</b></td>
                <td>${window.esc(r.description)}</td>
                <td>
                  ${r.imageUrl ? `<button class="btn-sm" onclick="window.open('${window.esc(r.imageUrl)}', '_blank')">🖼️ Ver Foto</button>` : '<span class="muted">Sem foto</span>'}
                </td>
                <td>${window.esc(r.reporterName)}</td>
                <td><span class="badge ${r.status === 'pendente' ? 'danger' : 'muted'}">${window.esc(r.status)}</span></td>
                <td>
                  <div style="display:flex; gap:4px;">
                    ${user.role === "admin" ? `<button class="btn-sm" onclick="window.modalResponderReport('${r.idDoc}')">💬 Parecer</button>` : ''}
                    ${user.role === "admin" ? `<button class="btn-sm danger" onclick="window.apagarReportAvaria('${r.idDoc}')">🗑️ Apagar</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join("") || "<tr><td colspan=6 class='muted' style='text-align:center;'>Nenhum registro.</td></tr>"}
          </tbody>
        </table>
      </div>
    </div>`;
}

window.apagarReportAvaria = function(idDoc) {
  if (user.role !== "admin") return alert("Apenas administradores podem apagar chamados.");
  if (confirm("Apagar este chamado permanentemente?")) {
    firestore.collection("reports").doc(idDoc).delete();
  }
}

window.modalReportDefeito = function() {
  const m = window.modal(`
    <div class="modal-top"><h2>Reportar Defeito</h2><button class="close">&times;</button></div>
    <form id="fReportDef">
      <div class="filter-grid">
        <label class="lbl">Modelo
          <select id="repModel" class="inp" required>
            ${MODELOS_EQUIPAMENTO.map(mod => `<option value="${mod.id}">${mod.label}</option>`).join("")}
          </select>
        </label>
        <label class="lbl">Número / ID
          <input id="repNum" class="inp" placeholder="Ex: SA3, M12" required>
        </label>
      </div>

      <label class="lbl" style="margin-top:10px;">Enviar Foto do Equipamento
        <input id="repFile" type="file" accept="image/*" class="inp" style="padding:6px;">
      </label>
      <div id="previewContainerReport" style="margin-top:8px; text-align:center;"></div>

      <label class="lbl" style="margin-top:10px;">Descrição do Problema
        <textarea id="repDesc" class="inp" rows="3" placeholder="Descreva o problema..." required></textarea>
      </label>
      <button type="submit" class="btn-primary" style="margin-top:14px; width:100%;">Enviar Relato</button>
    </form>
  `);

  let base64Image = "";
  m.querySelector("#repFile").onchange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (uploadEvt) => {
        base64Image = uploadEvt.target.result;
        m.querySelector("#previewContainerReport").innerHTML = `<img src="${base64Image}" style="max-height:100px; border-radius:8px; border:1px solid var(--border);">`;
      };
      reader.readAsDataURL(file);
    }
  };

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fReportDef").onsubmit = async e => {
    e.preventDefault();
    await firestore.collection("reports").add({
      id: window.uid(),
      reporterId: user.id || user.idDoc,
      reporterName: user.name,
      model: document.getElementById("repModel").value,
      number: document.getElementById("repNum").value.trim(),
      imageUrl: base64Image,
      description: document.getElementById("repDesc").value.trim(),
      status: "pendente",
      createdAt: window.nowFormatted()
    });
    alert("Relato enviado com sucesso!");
    m.remove();
  };
}

window.modalResponderReport = function(idDoc) {
  const r = (window.db.reports || []).find(x => x.idDoc === idDoc);
  if (!r) return;

  const m = window.modal(`
    <div class="modal-top"><h2>Parecer Técnico</h2><button class="close">&times;</button></div>
    <form id="fRepResp">
      <p><b>Avaria:</b> ${window.esc(r.description)}</p>
      <label class="lbl" style="margin-top:10px;">Comentário
        <textarea id="admComm" class="inp" rows="3" required>${window.esc(r.adminComment || '')}</textarea>
      </label>
      <label class="lbl" style="margin-top:10px;">Status
        <select id="admStatus" class="inp">
          <option value="pendente" ${r.status === 'pendente' ? 'selected' : ''}>Pendente</option>
          <option value="resolvido" ${r.status === 'resolvido' ? 'selected' : ''}>Resolvido</option>
        </select>
      </label>
      <button type="submit" class="btn-primary" style="margin-top:14px; width:100%;">Atualizar</button>
    </form>
  `);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fRepResp").onsubmit = async e => {
    e.preventDefault();
    await firestore.collection("reports").doc(idDoc).update({
      adminComment: document.getElementById("admComm").value.trim(),
      status: document.getElementById("admStatus").value
    });
    alert("Parecer atualizado!");
    m.remove();
  };
}