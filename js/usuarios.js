import { firestore } from './auth.js';

export function usuarios() {
  const listaUsers = window.db?.users || [];
  const esc = window.esc || (s => String(s ?? ""));

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Gestão de Usuários</h2>
        <div class="muted">Controlo seguro de acessos, turnos e permissões</div>
      </div>
      <div>
        <button class="btn-primary btn-sm" onclick="window.modalSalvarUsuario()">+ Novo Usuário</button>
      </div>
    </div>

    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>NOME COMPLETO</th>
              <th>LOGIN</th>
              <th>TURNO</th>
              <th>PERFIL</th>
              <th>AÇÕES</th>
            </tr>
          </thead>
          <tbody>
            ${listaUsers.length ? listaUsers.map(u => `
              <tr>
                <td><b>${esc(u.name || u.nome)}</b></td>
                <td><code>${esc(u.login || u.email)}</code></td>
                <td><span class="badge" style="background:rgba(139,92,246,0.15); color:#a78bfa;">${u.turno ? esc(u.turno.toUpperCase()) : 'NÃO DEFINIDO'}</span></td>
                <td><span class="badge ${u.role === 'admin' ? 'active' : ''}">${esc(u.role || 'professor')}</span></td>
                <td>
                  <div style="display:flex; gap:6px;">
                    <button class="btn-sm btn-secondary" onclick="window.modalSalvarUsuario('${u.idDoc || u.id}')">✏️ Editar</button>
                    <button class="btn-sm danger" onclick="window.excluirUsuario('${u.idDoc || u.id}')">🗑️</button>
                  </div>
                </td>
              </tr>
            `).join("") : `<tr><td colspan="5" style="text-align:center;" class="muted">Nenhum usuário registado.</td></tr>`}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

window.modalSalvarUsuario = function(idDoc = null) {
  let userObj = { name: '', login: '', senha: '', turno: 'manhã', role: 'professor' };
  if (idDoc) {
    const found = (window.db?.users || []).find(u => (u.idDoc === idDoc || u.id === idDoc));
    if (found) userObj = found;
  }

  const esc = window.esc || (s => String(s ?? ""));

  // Removido o botão redundante do topo para evitar duplicação com o modal global
  const m = window.modal(`
    <div class="modal-top" style="margin-bottom: 12px;">
      <h2>${idDoc ? '✏️ Editar Usuário' : '+ Novo Usuário'}</h2>
    </div>
    <form id="fUserSave">
      <label class="lbl">Nome Completo
        <input id="uName" class="inp" value="${esc(userObj.name || userObj.nome || '')}" required style="margin-top:4px;">
      </label>
      <label class="lbl" style="margin-top:10px;">Login / Usuário
        <input id="uLogin" class="inp" value="${esc(userObj.login || userObj.email || '')}" required style="margin-top:4px;">
      </label>
      <label class="lbl" style="margin-top:10px;">PIN / Senha (4 números) ${idDoc ? '— deixe em branco para manter a atual' : ''}
        <input id="uSenha" type="password" maxlength="4" pattern="\\d{4}" class="inp" placeholder="${idDoc ? '••••' : '1234'}" ${!idDoc ? 'required' : ''} style="margin-top:4px;">
      </label>
      <label class="lbl" style="margin-top:10px;">Turno
        <select id="uTurno" class="inp" style="margin-top:4px;">
          <option value="manhã" ${(userObj.turno === 'manhã') ? 'selected' : ''}>Manhã</option>
          <option value="tarde" ${(userObj.turno === 'tarde') ? 'selected' : ''}>Tarde</option>
          <option value="ambos" ${(userObj.turno === 'ambos') ? 'selected' : ''}>Ambos (Manhã e Tarde)</option>
        </select>
      </label>
      <label class="lbl" style="margin-top:10px;">Perfil / Cargo
        <select id="uRole" class="inp" style="margin-top:4px;">
          <option value="professor" ${(userObj.role === 'professor') ? 'selected' : ''}>Professor</option>
          <option value="admin" ${(userObj.role === 'admin') ? 'selected' : ''}>Admin</option>
          <option value="inspetora" ${(userObj.role === 'inspetora') ? 'selected' : ''}>Inspetora</option>
        </select>
      </label>
      <button type="submit" class="btn-primary" style="margin-top:18px; width:100%;">Salvar Usuário</button>
    </form>
  `);

  // Vincula o fechar ao botão automático gerado pela framework de modais (ou esconde se necessário)
  const closeBtn = m.querySelector(".close") || m.querySelector(".modal-close-btn");
  if (closeBtn) {
    closeBtn.onclick = () => m.remove();
  }

  m.querySelector("#fUserSave").onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById("uName").value.trim();
    const login = document.getElementById("uLogin").value.trim().toLowerCase();
    const senhaInput = document.getElementById("uSenha").value.trim();
    const turno = document.getElementById("uTurno").value;
    const role = document.getElementById("uRole").value;

    try {
      const dadosUpdate = { name, login, turno, role };
      
      if (senhaInput) {
        if (!/^\d{4}$/.test(senhaInput)) {
          return alert("O PIN deve conter exatamente 4 números.");
        }
        dadosUpdate.senha = senhaInput;
      }

      if (idDoc) {
        await firestore.collection("users").doc(idDoc).update(dadosUpdate);
      } else {
        if (!senhaInput) return alert("Insira um PIN de 4 números para o novo utilizador.");
        const newId = window.uid ? window.uid() : '_' + Math.random().toString(36).substr(2, 9);
        dadosUpdate.id = newId;
        dadosUpdate.senha = senhaInput;
        await firestore.collection("users").doc(newId).set(dadosUpdate);
      }

      alert("Usuário salvo com sucesso!");
      m.remove();
      window.nav("usuarios");
    } catch (err) {
      alert("Erro ao salvar usuário: " + err.message);
    }
  };
};

window.excluirUsuario = async function(idDoc) {
  if (!confirm("Deseja realmente excluir este usuário?")) return;
  try {
    await firestore.collection("users").doc(idDoc).delete();
    alert("Usuário excluído com sucesso!");
    window.nav("usuarios");
  } catch (err) {
    alert("Erro ao excluir: " + err.message);
  }
};