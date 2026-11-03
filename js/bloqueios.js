import { firestore, user } from './auth.js';
import { TABELAS_HORARIOS_MANHA, TABELAS_HORARIOS_TARDE } from './config.js';

export function bloqueios() {
  const listaBloqueios = window.db?.bloqueios || [];

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Gestão de Bloqueios por Turno e Aula</h2>
        <div class="muted">Controlo granular de indisponibilidade de horários</div>
      </div>
      <div>
        <button class="btn-primary btn-sm" onclick="window.modalSalvarBloqueio()">+ Novo Bloqueio</button>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>DATA</th>
              <th>TURNO / AULA</th>
              <th>MOTIVO</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            ${listaBloqueios.length ? listaBloqueios.map(b => {
              let badgeHtml = '<span class="badge" style="background:#ef4444; color:#fff;">Dia Inteiro</span>';
              if (b.lesson !== "all") {
                const [turno, aulaIdx] = b.lesson.split("_");
                const nomeTurno = turno === "manha" ? "☀️ Manhã" : "🌙 Tarde";
                const numAula = Number(aulaIdx) + 1;
                badgeHtml = `<span class="badge active">${nomeTurno} - ${numAula}ª Aula</span>`;
              }
              return `
                <tr>
                  <td><b>${b.date ? b.date.split('-').reverse().join('/') : ''}</b></td>
                  <td>${badgeHtml}</td>
                  <td>${window.esc ? window.esc(b.motivo || b.reason || 'Sem motivo') : ''}</td>
                  <td>
                    <button class="btn-sm danger" onclick="window.excluirBloqueio('${b.idDoc || b.id}')">🗑️ Eliminar</button>
                  </td>
                </tr>
              `;
            }).join("") : `<tr><td colspan="4" style="text-align:center;" class="muted">Nenhum bloqueio registado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.modalSalvarBloqueio = function() {
  const m = window.modal(`
    <div class="modal-box" style="max-width: 520px;">
      <div class="modal-top">
        <h2>Novo Bloqueio Específico</h2>
        <button class="close">&times;</button>
      </div>
      <form id="fBloqueioSave">
        <label class="lbl">DATA DO BLOQUEIO
          <input type="date" id="bDate" class="inp" required style="margin-top:4px;">
        </label>

        <label class="lbl" style="margin-top:12px; display:block;">SELECIONE O ESCOPO:</label>
        
        <div style="margin-top:6px; display:flex; flex-direction:column; gap:10px;">
          <label style="display:flex; align-items:center; gap:8px; background:rgba(239,68,68,0.1); padding:8px 12px; border-radius:6px; border:1px solid #ef4444; cursor:pointer;">
            <input type="checkbox" id="bDiaInteiro" onchange="window.toggleBloqueioTotal(this)">
            <span>🔒 <b>Bloquear Dia Inteiro (Todos os Turnos e Aulas)</b></span>
          </label>

          <!-- Bloco Manhã -->
          <div style="background:rgba(59,130,246,0.05); padding:10px; border-radius:6px; border:1px solid var(--border);">
            <div style="font-weight:bold; font-size:12px; margin-bottom:6px; color:#38bdf8;">☀️ Período da Manhã (Aulas Específicas)</div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
              ${TABELAS_HORARIOS_MANHA.map(a => `
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;">
                  <input type="checkbox" class="chk-aula-bloq" value="manha_${a.index}"> ${a.label}
                </label>
              `).join('')}
            </div>
          </div>

          <!-- Bloco Tarde -->
          <div style="background:rgba(234,179,8,0.05); padding:10px; border-radius:6px; border:1px solid var(--border);">
            <div style="font-weight:bold; font-size:12px; margin-bottom:6px; color:#facc15;">🌙 Período da Tarde (Aulas Específicas)</div>
            <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:6px;">
              ${TABELAS_HORARIOS_TARDE.map(a => `
                <label style="display:flex; align-items:center; gap:4px; font-size:11px; cursor:pointer;">
                  <input type="checkbox" class="chk-aula-bloq" value="tarde_${a.index}"> ${a.label}
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <label class="lbl" style="margin-top:12px;">MOTIVO
          <input id="bMotivo" class="inp" placeholder="Ex: Prova Paulista / Manutenção" required style="margin-top:4px;">
        </label>

        <button type="submit" class="btn-primary" style="margin-top:18px; width:100%;">Salvar Bloqueio</button>
      </form>
    </div>
  `);

  m.querySelector(".close").onclick = () => m.remove();

  window.toggleBloqueioTotal = function(chk) {
    const checkboxes = m.querySelectorAll(".chk-aula-bloq");
    checkboxes.forEach(c => {
      c.checked = false;
      c.disabled = chk.checked;
    });
  };

  m.querySelector("#fBloqueioSave").onsubmit = async (e) => {
    e.preventDefault();
    const date = document.getElementById("bDate").value;
    const diaInteiro = document.getElementById("bDiaInteiro").checked;
    const motivo = document.getElementById("bMotivo").value.trim();

    if (!date) return alert("Selecione a data.");

    try {
      if (diaInteiro) {
        const newId = '_' + Math.random().toString(36).substr(2, 9);
        await firestore.collection("bloqueios").doc(newId).set({
          id: newId,
          date,
          lesson: "all",
          motivo,
          createdBy: user?.name || "Admin"
        });
      } else {
        const chkAulas = m.querySelectorAll(".chk-aula-bloq:checked");
        if (chkAulas.length === 0) return alert("Selecione pelo menos uma aula específica ou marque 'Bloquear Dia Inteiro'.");

        for (let chk of chkAulas) {
          const lessonVal = chk.value; // ex: "manha_2" ou "tarde_0"
          const newId = '_' + Math.random().toString(36).substr(2, 9);
          await firestore.collection("bloqueios").doc(newId).set({
            id: newId,
            date,
            lesson: lessonVal,
            motivo,
            createdBy: user?.name || "Admin"
          });
        }
      }

      alert("Bloqueio(s) guardado(s) com sucesso!");
      m.remove();
      window.nav("bloqueios");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };
};

window.excluirBloqueio = async function(idDoc) {
  if (!confirm("Deseja realmente remover este bloqueio?")) return;
  await firestore.collection("bloqueios").doc(idDoc).delete();
  window.nav("bloqueios");
};