import { firestore, user } from './auth.js';

export function muralProati() {
  const container = document.getElementById("main");
  if (!container) return;

  const avisos = window.db?.mural || [];

  container.innerHTML = `
    <div class="head">
      <div>
        <h2>📢 Mural de Avisos PROATI</h2>
        <div class="muted">Informaçoes, comunicados e atualizações da infraestrutura</div>
      </div>
      <div>
        <button class="btn-primary" onclick="window.modalNovoAvisoMural()">+ Novo Aviso</button>
      </div>
    </div>

    <div style="display: flex; flex-direction: column; gap: 12px;">
      ${!avisos.length ? `
        <div class="card" style="padding: 24px; text-align: center; color: var(--text-muted);">
          Nenhum aviso publicado no mural até ao momento.
        </div>
      ` : avisos.map(a => `
        <div class="card" style="padding: 16px; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
            <b style="font-size: 16px; color: var(--text-main);">${window.esc(a.titulo)}</b>
            <small style="color: var(--text-muted); font-size: 11px;">${a.createdAt || "—"}</small>
          </div>
          <p style="font-size: 14px; color: var(--text-main); line-height: 1.5; white-space: pre-wrap;">${window.esc(a.conteudo)}</p>
          <div style="margin-top: 12px; font-size: 11px; color: var(--text-muted); display: flex; justify-content: space-between; align-items: center;">
            <span>Postado por: <b>${window.esc(a.autor || "PROATI")}</b></span>
            ${user?.role === "admin" ? `
              <button class="btn-sm danger" onclick="window.excluirAvisoMural('${a.idDoc}')">🗑️ Excluir</button>
            ` : ''}
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

// Modal para criar publicação no Mural
window.modalNovoAvisoMural = function() {
  const m = window.modal(`
    <div style="margin-bottom: 16px;">
      <h2 style="font-size: 20px; font-weight: 800; color: var(--text-main);">📢 Novo Aviso para o Mural</h2>
    </div>
    <form id="fNovoMural">
      <label class="lbl">Título do Aviso
        <input id="muralTitulo" class="inp" placeholder="Ex: Manutenção na Sala de Informática" required style="margin-top: 4px;">
      </label>

      <label class="lbl" style="margin-top: 12px; display: block;">Conteúdo / Mensagem
        <textarea id="muralConteudo" class="inp" rows="4" placeholder="Escreva aqui o comunicado para os professores..." required style="margin-top: 4px; resize: vertical;"></textarea>
      </label>

      <button type="submit" class="btn-primary" style="margin-top: 18px; width: 100%; padding: 12px; border-radius: 10px; font-weight: bold;">Publicar no Mural</button>
    </form>
  `);

  m.querySelector("#fNovoMural").onsubmit = async (e) => {
    e.preventDefault();
    const titulo = document.getElementById("muralTitulo").value.trim();
    const conteudo = document.getElementById("muralConteudo").value.trim();

    try {
      await firestore.collection("mural").add({
        id: window.uid(),
        titulo: titulo,
        conteudo: conteudo,
        autor: user?.name || "PROATI",
        createdAt: window.nowFormatted()
      });

      alert("Aviso publicado no Mural com sucesso!");
      window.fecharModalSeguro();
      window.nav("mural");
    } catch (err) {
      alert("Erro ao publicar no mural: " + err.message);
    }
  };
};

window.excluirAvisoMural = async function(idDoc) {
  if (confirm("Deseja realmente eliminar este aviso do Mural?")) {
    try {
      await firestore.collection("mural").doc(idDoc).delete();
      alert("Aviso eliminado!");
      window.nav("mural");
    } catch (err) {
      alert("Erro ao eliminar: " + err.message);
    }
  }
};