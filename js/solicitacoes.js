import { firestore, user } from './auth.js';
import { TABELAS_HORARIOS_MANHA, TABELAS_HORARIOS_TARDE, TURMAS_MANHA, TURMAS_TARDE, MODELOS_EQUIPAMENTO, FINALIDADES } from './config.js';

// Utilitário global seguro para renderização e fecho de modais
if (!window.fecharModalSeguro) {
  window.fecharModalSeguro = function() {
    const wrap = document.getElementById("safeModalWrapper") || document.getElementById("containerModalPerfil");
    if (wrap) wrap.remove();
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") window.fecharModalSeguro();
  });
}

if (!window.modal) {
  window.modal = function(html) {
    window.fecharModalSeguro();

    const wrap = document.createElement("div");
    wrap.id = "safeModalWrapper";
    wrap.className = "modal";
    wrap.innerHTML = `
      <div class="modal-box" style="position:relative;">
        <button type="button" class="modal-close-btn" onclick="window.fecharModalSeguro()">&times;</button>
        ${html}
      </div>
    `;

    wrap.addEventListener("click", (e) => {
      if (e.target === wrap) window.fecharModalSeguro();
    });

    document.body.appendChild(wrap);
    return wrap;
  };
}

if (!window.esc) {
  window.esc = function(str) {
    if (!str) return "";
    return String(str).replace(/[&<>'"]/g, tag => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
  };
}

if (!window.uid) {
  window.uid = () => '_' + Math.random().toString(36).substr(2, 9);
}

if (!window.nowFormatted) {
  window.nowFormatted = () => new Date().toLocaleString();
}

export function solicitacoes() {
  if (window.mostrarLoader) window.mostrarLoader("A carregar solicitações...");

  try {
    const listaProfessores = (window.db?.users || []).filter(u => u.role === "professor" || u.role === "admin");
    const turnoUser = user?.turno || "manhã";
    const isAdminOrAmbos = user?.role === "admin" || turnoUser === "ambos";

    document.getElementById("main").innerHTML = `
      <div class="head" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div>
          <h2 style="font-size:22px; font-weight:800;">Solicitações e Reservas ${isAdminOrAmbos ? '' : `(${turnoUser.toUpperCase()})`}</h2>
          <div class="muted" style="font-size:13px; color:var(--text-muted);">Gerenciamento unificado de solicitações</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
          <button class="btn-secondary" id="btnFiltrarHoje" style="border-radius:20px; padding:6px 14px; font-size:13px;">📅 Hoje</button>
          <button class="btn-secondary" id="btnFiltrarAulaAtual" style="border-radius:20px; padding:6px 14px; font-size:13px;">⏰ Aula Atual</button>
          <button class="btn-secondary" onclick="window.exportarRelatorioCSV()" style="border-radius:20px; padding:6px 16px; font-size:13px; background:#fff; color:#000; font-weight:bold;">📊 Relatório (.CSV)</button>
          <button class="btn-primary" onclick="window.modalReserva()" style="border-radius:20px; padding:6px 18px; font-size:13px; font-weight:bold;">+ Nova Solicitação</button>
        </div>
      </div>

      <!-- BARRA DE AÇÕES EM LOTE -->
      <div id="barraAcoesEmLote" class="card hidden" style="background:rgba(59,130,246,0.15); border-color:rgba(59,130,246,0.4); display:flex; justify-content:space-between; align-items:center; padding:10px 16px; margin-bottom:12px; border-radius:12px;">
        <span id="txtItensSelecionados" style="font-size:13px; font-weight:bold;">0 itens selecionados</span>
        <div style="display:flex; gap:6px;">
          <button class="btn-sm" onclick="window.executarAcaoEmLote('devolver')" style="border-radius:16px;">↩️ Devolver Selecionados</button>
          <button class="btn-sm danger" onclick="window.executarAcaoEmLote('excluir')" style="border-radius:16px;">🗑️ Excluir Selecionados</button>
        </div>
      </div>

      <!-- FILTROS SUPERIORES -->
      <div class="card" style="margin-bottom:16px; padding:14px; border-radius:12px; background:rgba(15,23,42,0.6); border:1px solid var(--border);">
        <div class="filter-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px;">
          <input id="searchSol" placeholder="🔍 Buscar ID, nome, máquina..." class="inp" style="border-radius:8px;">
          <select id="filterProf" class="inp" style="border-radius:8px;">
            <option value="todos">Todos os Professores</option>
            ${listaProfessores.map(p => `<option value="${window.esc(p.name)}">${window.esc(p.name)}</option>`).join("")}
          </select>
          <input id="filterData" type="date" class="inp" style="border-radius:8px;">
          <select id="filterStatus" class="inp" style="border-radius:8px;">
            <option value="todos">Todos os Status</option>
            <option value="aguardando">Aguardando Entrega</option>
            <option value="retirado">Em Uso (Retirado)</option>
            <option value="devolvido">Devolvido</option>
          </select>
        </div>
      </div>

      <!-- CONTAINER DE CARDS SOLTOS -->
      <div id="solicitacoesContainer" style="display:flex; flex-direction:column; gap:12px;">
        ${renderizarCardsSolicitacoes()}
      </div>
    `;

    const trigger = (aulaFiltro = null) => {
      const q = document.getElementById("searchSol")?.value.trim().toLowerCase() || "";
      const p = document.getElementById("filterProf")?.value || "todos";
      const d = document.getElementById("filterData")?.value || "";
      const s = document.getElementById("filterStatus")?.value || "todos";
      
      const container = document.getElementById("solicitacoesContainer");
      if (container) container.innerHTML = renderizarCardsSolicitacoes(q, p, d, s, aulaFiltro);
    };

    document.getElementById("searchSol")?.addEventListener("input", () => trigger());
    document.getElementById("filterProf")?.addEventListener("change", () => trigger());
    document.getElementById("filterData")?.addEventListener("change", () => trigger());
    document.getElementById("filterStatus")?.addEventListener("change", () => trigger());

    document.getElementById("btnFiltrarHoje").onclick = () => {
      document.getElementById("filterData").value = new Date().toISOString().split("T")[0];
      trigger();
    };

    document.getElementById("btnFiltrarAulaAtual").onclick = () => {
      document.getElementById("filterData").value = new Date().toISOString().split("T")[0];
      // Usa a função robusta do config.js com o turno adequado
      const turnoAtual = turnoUser === "ambos" ? "manhã" : turnoUser;
      const aulaAtualIdx = window.obterIndiceAulaAtual ? window.obterIndiceAulaAtual(turnoAtual) : 0;
      trigger(aulaAtualIdx);
    };
  } finally {
    if (window.esconderLoader) {
      setTimeout(() => window.esconderLoader(), 150);
    }
  }
}

function renderizarCardsSolicitacoes(query = "", filterProf = "todos", filterData = "", filterStatus = "todos", filterAulaIdx = null) {
  let raw = window.db?.emprestimos || [];
  
  const turnoUser = user?.turno || "manhã";
  const isAdminOrAmbos = user?.role === "admin" || turnoUser === "ambos";

  if (!isAdminOrAmbos) {
    raw = raw.filter(x => x && (x.userId === user.id || x.userId === user.idDoc));
  } else {
    if (user.role !== "admin" && turnoUser !== "ambos") {
      raw = raw.filter(x => x && (x.turno === turnoUser || (!x.turno && turnoUser === "manhã")));
    }
  }

  const groups = {};
  raw.forEach(x => {
    if (!x || x.status === "cancelado") return;
    const bid = x.batchId || x.idDoc || x.id;
    
    if (!groups[bid]) {
      const primeiroNome = (x.userName || "Não identificado").split(" ")[0];

      groups[bid] = {
        idDoc: x.idDoc,
        batchId: bid,
        userId: x.userId,
        userName: x.userName || "Não identificado",
        primeiroNome: primeiroNome,
        date: x.date || "",
        turno: x.turno || "manhã",
        tipoEquipamento: x.tipoEquipamento || "notebook",
        lessons: new Set(),
        lessonIndexes: new Set(),
        equipments: new Set(),
        status: x.status || "aguardando",
        qtdTotalPedida: 0
      };
    }

    const qtdNoDoc = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0, 1);
    if (qtdNoDoc > groups[bid].qtdTotalPedida) groups[bid].qtdTotalPedida = qtdNoDoc;

    if (x.lessons && Array.isArray(x.lessons)) x.lessons.forEach(l => groups[bid].lessons.add(l));
    else if (x.lesson) groups[bid].lessons.add(x.lesson);

    if (x.lessonIndexes && Array.isArray(x.lessonIndexes)) {
      x.lessonIndexes.forEach(idx => groups[bid].lessonIndexes.add(Number(idx)));
    } else if (x.lessonIndex !== undefined) {
      groups[bid].lessonIndexes.add(Number(x.lessonIndex));
    }

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipments.add(x.equipment);
  });

  let list = Object.values(groups).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (filterProf !== "todos") list = list.filter(g => g.userName === filterProf);
  if (filterData) list = list.filter(g => g.date === filterData);
  
  if (filterAulaIdx !== null && filterAulaIdx !== undefined) {
    const idxNum = Number(filterAulaIdx);
    list = list.filter(g => Array.from(g.lessonIndexes).some(i => Number(i) === idxNum));
  }

  if (filterStatus !== "todos") list = list.filter(g => g.status === filterStatus);

  if (query) {
    list = list.filter(g => {
      const eqStr = Array.from(g.equipments).join(" ").toLowerCase();
      return (g.userName || "").toLowerCase().includes(query) ||
             (g.batchId || "").toLowerCase().includes(query) ||
             eqStr.includes(query);
    });
  }

  if (!list.length) return `<div class="card" style="padding:24px; text-align:center; color:var(--text-muted); border-radius:12px;">Nenhuma solicitação encontrada.</div>`;

  return list.map(g => {
    const isRetirado = g.status === "retirado";
    const isDevolvido = g.status === "devolvido";
    const eqArray = Array.from(g.equipments).filter(x => x && x !== "Pendente");
    const qtdAtribuida = eqArray.length;
    const qtdTotal = g.qtdTotalPedida || 1;

    let stBadge = `<span class="badge" style="border-radius:12px; padding:4px 10px; background:rgba(255,255,255,0.06);">Aguardando</span>`;
    if (isRetirado) stBadge = `<span class="badge active" style="border-radius:12px; padding:4px 10px; background:rgba(16,185,129,0.15); color:#10b981;">Em Uso</span>`;
    else if (isDevolvido) stBadge = `<span class="badge muted" style="border-radius:12px; padding:4px 10px;">Devolvido</span>`;

    const tipoBadge = g.tipoEquipamento === "tablet" ? "📱 Tablet" : "💻 Notebook";

    return `
      <div class="card" style="padding:16px; border-radius:14px; background:rgba(15,23,42,0.6); border:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px;">
        
        <div style="display:flex; align-items:center; gap:14px; flex:1; min-width:200px;">
          <input type="checkbox" class="chk-lote-item" data-batch="${g.batchId}" onclick="window.atualizarBarraAcoesLote()">
          <div>
            <b style="font-size:15px; display:block; color:var(--text-main);">${window.esc(g.primeiroNome)}</b>
            <small style="color:var(--text-muted); font-size:11px;">${g.date ? g.date.split('-').reverse().join('/') : "—"}</small>
          </div>
        </div>

        <div style="min-width:110px;">
          <span class="badge" style="background:rgba(56,189,248,0.1); color:#38bdf8; border-radius:14px; padding:6px 12px; font-weight:600;">
            ${tipoBadge}
          </span>
        </div>

        <div style="min-width:120px;">
          <small style="color:var(--text-muted); font-size:12px; font-weight:500;">${Array.from(g.lessons).join(", ") || "—"}</small>
        </div>

        <div style="min-width:110px; text-align:center;">
          <b style="font-size:13px; display:block;">${qtdAtribuida} / ${qtdTotal} máq.</b>
          ${qtdAtribuida < qtdTotal ? `<small style="color:#f59e0b; font-size:11px; display:block;">(Pendente)</small>` : ''}
        </div>

        <div style="min-width:100px; text-align:center;">
          ${stBadge}
        </div>

        <div style="display:flex; gap:6px; flex-wrap:wrap; justify-content:flex-end; align-items:center;">
          <button class="btn-sm" onclick="window.modalAtribuirPorAula('${g.batchId}')" style="border-radius:20px; padding:6px 12px; background:rgba(255,255,255,0.08); border:1px solid var(--border);">📌 Atribuição por Aula</button>
          <button class="btn-sm" onclick="window.modalEditarReserva('${g.batchId}')" style="border-radius:20px; padding:6px 12px; background:rgba(255,255,255,0.08); border:1px solid var(--border);">✏️ Editar</button>
          ${!isDevolvido ? `<button class="btn-sm danger" onclick="window.devolverLoteComRegistro('${g.batchId}')" style="border-radius:20px; padding:6px 12px; background:rgba(239,68,68,0.15); color:#ef4444;">↩️ Devolver</button>` : ''}
          <button class="btn-sm danger" onclick="window.cancelarLote('${g.batchId}')" style="border-radius:20px; padding:6px 12px; background:rgba(239,68,68,0.15); color:#ef4444;">🗑️ Excluir</button>
        </div>

      </div>
    `;
  }).join("");
}

window.selecionarTodosCheckboxes = function(master) {
  document.querySelectorAll('.chk-lote-item').forEach(cb => cb.checked = master.checked);
  window.atualizarBarraAcoesLote();
};

window.atualizarBarraAcoesLote = function() {
  const selecionados = document.querySelectorAll('.chk-lote-item:checked');
  const barra = document.getElementById("barraAcoesEmLote");
  const txt = document.getElementById("txtItensSelecionados");

  if (barra && txt) {
    if (selecionados.length > 0) {
      barra.classList.remove("hidden");
      txt.textContent = `${selecionados.length} item(ns) selecionado(s)`;
    } else {
      barra.classList.add("hidden");
    }
  }
};

window.executarAcaoEmLote = async function(acao) {
  const selecionados = Array.from(document.querySelectorAll('.chk-lote-item:checked')).map(cb => cb.dataset.batch);
  if (!selecionados.length) return alert("Nenhum item selecionado.");

  if (acao === "excluir" && !confirm(`Deseja realmente excluir ${selecionados.length} lote(s)?`)) return;
  if (acao === "devolver" && !confirm(`Deseja devolver os equipamentos de ${selecionados.length} lote(s)?`)) return;

  if (window.mostrarLoader) window.mostrarLoader("A processar ação em lote...");

  try {
    for (let batchId of selecionados) {
      const itens = (window.db?.emprestimos || []).filter(x => (x.batchId || x.idDoc || x.id) === batchId);
      
      if (acao === "excluir") {
        for (let d of itens) {
          await firestore.collection("emprestimos").doc(d.idDoc).delete();
        }
      } else if (acao === "devolver") {
        const dataDevolucao = window.nowFormatted();
        for (let target of itens) {
          await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });
          const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
          const validEqs = eqList.filter(x => x && x !== "Pendente");
          const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");

          for (let eq of validEqs) {
            await firestore.collection("devolucoes").add({
              id: window.uid(),
              batchId: batchId,
              userName: target.userName,
              equipment: eq,
              lesson: labelAulas,
              dateUse: target.date,
              deliveredAt: target.createdAt || "—",
              returnedAt: dataDevolucao
            });
          }
        }
      }
    }
    alert("Ação em lote realizada com sucesso!");
    window.nav("solicitacoes");
  } catch (err) {
    alert("Erro ao processar ação em lote: " + err.message);
  } finally {
    if (window.esconderLoader) window.esconderLoader();
  }
};

window.exportarRelatorioCSV = function() {
  const raw = window.db?.emprestimos || [];
  if (!raw.length) return alert("Nenhum dado encontrado para gerar o relatório.");

  const groups = {};
  raw.forEach(x => {
    if (!x) return;
    const bid = x.batchId || x.idDoc || x.id;
    if (!groups[bid]) {
      groups[bid] = {
        userName: x.userName || "Não identificado",
        turno: x.turno || "manhã",
        tipoEquipamento: x.tipoEquipamento || "notebook",
        date: x.date || "",
        lessons: new Set(),
        equipments: new Set(),
        status: x.status || "aguardando",
        qtdTotalPedida: 0
      };
    }

    const qtdNoDoc = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (qtdNoDoc > groups[bid].qtdTotalPedida) {
      groups[bid].qtdTotalPedida = qtdNoDoc;
    }

    if (x.lessons && Array.isArray(x.lessons)) x.lessons.forEach(l => groups[bid].lessons.add(l));
    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
  });

  let csvContent = "data:text/csv;charset=utf-8,Professor;Turno;Tipo;Data;Horarios;QtdPedida;QtdAtribuida;Status\n";

  Object.values(groups).forEach(g => {
    const eqArray = Array.from(g.equipments).filter(e => e && e !== "Pendente");
    const prof = `"${(g.userName || "").replace(/"/g, '""')}"`;
    const turno = g.turno.toUpperCase();
    const tipo = g.tipoEquipamento === "tablet" ? "Tablet" : "Notebook";
    const data = g.date ? g.date.split('-').reverse().join('/') : "—";
    const horarios = `"${Array.from(g.lessons).join(", ").replace(/"/g, '""')}"`;
    const qtdPedida = g.qtdTotalPedida || 1;
    const qtdAtribuida = eqArray.length;
    const status = g.status;

    csvContent += `${prof};${turno};${tipo};${data};${horarios};${qtdPedida};${qtdAtribuida};${status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `relatorio_solicitacoes_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

window.modalReserva = function(defaultDate = "", turnoForcado = null) {
  const hoje = defaultDate || new Date().toISOString().split("T")[0];
  const turnoUser = user?.turno || "manhã";
  const turnoAtual = turnoForcado || (turnoUser === "ambos" ? "manhã" : turnoUser);
  const isTarde = turnoAtual === "tarde";

  const tabelasHorarios = isTarde ? TABELAS_HORARIOS_TARDE : TABELAS_HORARIOS_MANHA;
  const turmasTurno = isTarde ? TURMAS_TARDE : TURMAS_MANHA;
  const turnoLabel = isTarde ? "Tarde" : "Manhã";

  const m = window.modal(`
    <div class="modal-top">
      <h2>Nova Solicitação (${turnoLabel})</h2>
    </div>
    <form id="fSolNew">
      ${turnoUser === "ambos" ? `
        <label class="lbl" style="margin-bottom:10px;">Selecionar Turno
          <select id="rsTurnoSelect" class="inp" onchange="window.modalReserva('${hoje}', this.value)">
            <option value="manhã" ${turnoAtual === "manhã" ? "selected" : ""}>☀️ Manhã</option>
            <option value="tarde" ${turnoAtual === "tarde" ? "selected" : ""}>🌙 Tarde</option>
          </select>
        </label>
      ` : ''}

      <div class="filter-grid" style="margin-bottom:12px;">
        <label class="lbl">Tipo de Equipamento
          <select id="rsTipo" class="inp">
            <option value="notebook">💻 Notebook</option>
            <option value="tablet">📱 Tablet</option>
          </select>
        </label>
        <label class="lbl">Data de Uso
          <input id="rsDate" type="date" value="${hoje}" min="${new Date().toISOString().split("T")[0]}" class="inp" required>
        </label>
        <label class="lbl">Segmento / Turma (${turnoLabel})
          <select id="rsSeg" class="inp">
            ${turmasTurno.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </label>
        <label class="lbl">Quantidade (Máx. 30)
          <input id="rsQty" type="number" min="1" max="30" value="30" class="inp" required>
        </label>
        <label class="lbl">Atividade
          <select id="rsPurpose" class="inp">
            ${FINALIDADES.map(f => `<option value="${f.id}">${f.label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div style="margin-bottom:14px;">
        <label class="lbl"><b>Selecione as Aulas (${turnoLabel}):</b></label>
        <div id="lessonsCheckboxes" class="filter-grid" style="grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); margin-top:6px;">
          ${tabelasHorarios.map((a, i) => `
            <label style="display:flex; align-items:center; gap:8px; background:var(--bg-app); padding:8px; border-radius:8px; border:1px solid var(--border); cursor:pointer;">
              <input type="checkbox" name="solLesson" value="${i}"> 
              <div>
                <b style="font-size:12px; display:block;">${a.label}</b>
                <span style="font-size:10px; color:var(--text-muted);">${a.start}–${a.end}</span>
              </div>
            </label>
          `).join("")}
        </div>
      </div>

      <button type="submit" class="btn-primary" style="width:100%;">Confirmar Solicitação</button>
    </form>
  `);

  m.querySelector("#fSolNew").onsubmit = async e => {
    e.preventDefault();
    const tipoEq = document.getElementById("rsTipo").value;
    const d = document.getElementById("rsDate").value;
    const seg = document.getElementById("rsSeg").value;
    const qty = parseInt(document.getElementById("rsQty").value, 10);
    const purp = document.getElementById("rsPurpose").value;
    const selectedLessons = Array.from(m.querySelectorAll('input[name="solLesson"]:checked')).map(cb => parseInt(cb.value, 10));

    if (!selectedLessons.length) return alert("Selecione pelo menos uma aula.");

    if (window.mostrarLoader) window.mostrarLoader("A criar solicitação...");

    const batchId = window.uid();
    const horaCriacao = window.nowFormatted();

    try {
      for (let lIdx of selectedLessons) {
        const slot = tabelasHorarios[lIdx];
        const nomeAula = slot ? slot.label : `Aula ${lIdx + 1}`;

        await firestore.collection("emprestimos").add({
          id: window.uid(),
          batchId: batchId,
          userId: user.id || user.idDoc,
          userName: user.name,
          turno: turnoAtual,
          tipoEquipamento: tipoEq,
          date: d,
          lessons: [nomeAula],
          lessonIndexes: [lIdx],
          lessonIndex: lIdx,
          segment: seg,
          equipments: ["Pendente"],
          qtdTotalPedida: qty,
          purpose: purp,
          status: "aguardando",
          createdAt: horaCriacao
        });
      }

      alert("Solicitação criada com sucesso!");
      window.fecharModalSeguro();
      window.nav("solicitacoes");
    } catch (err) {
      alert("Erro ao criar solicitação: " + err.message);
    } finally {
      if (window.esconderLoader) window.esconderLoader();
    }
  };
};

window.modalAtribuirPorAula = function(batchId) {
  const itens = (window.db?.emprestimos || []).filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return alert("Solicitação não encontrada.");

  const itemPrincipal = itens[0];
  const isTarde = itemPrincipal.turno === "tarde";
  let aulasSelecionadas = itemPrincipal.lessonIndexes || [];
  if (!aulasSelecionadas.length && itemPrincipal.lessonIndex !== undefined) {
    aulasSelecionadas = [itemPrincipal.lessonIndex];
  }
  if (!aulasSelecionadas.length) aulasSelecionadas = [0];

  const tabelaUsada = isTarde ? TABELAS_HORARIOS_TARDE : TABELAS_HORARIOS_MANHA;
  let aulaAtivaIdx = aulasSelecionadas[0];

  let atribuicoesPorAula = {};
  aulasSelecionadas.forEach(idx => { atribuicoesPorAula[idx] = []; });

  itens.forEach(x => {
    const lIdx = x.lessonIndex !== undefined ? x.lessonIndex : aulasSelecionadas[0];
    if (x.equipments && Array.isArray(x.equipments)) {
      x.equipments.forEach(eq => {
        if (eq && eq !== "Pendente" && !atribuicoesPorAula[lIdx]?.includes(eq)) {
          if (!atribuicoesPorAula[lIdx]) atribuicoesPorAula[lIdx] = [];
          atribuicoesPorAula[lIdx].push(eq);
        }
      });
    }
  });

  let prefixoAtual = itemPrincipal.tipoEquipamento === "tablet" ? "TAB" : "M";
  let qtdLimite = itemPrincipal.qtdTotalPedida || 1;

  const m = window.modal(`
    <div class="modal-top">
      <h2>📌 Atribuição de Máquinas por Aula</h2>
    </div>

    <div style="background:rgba(59,130,246,0.1); border:1px solid rgba(59,130,246,0.3); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
      <span style="font-size:13px;">Professor: <b>${window.esc(itemPrincipal.userName)}</b> (${isTarde ? 'Tarde' : 'Manhã'})</span>
      <span id="badgeContadorAulaAtrib" class="badge active" style="font-size:12px;">0 / ${qtdLimite} máq.</span>
    </div>

    <label class="lbl"><b>ESCOLHA A AULA:</b></label>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
      ${aulasSelecionadas.map(idx => {
        const slot = tabelaUsada[idx];
        const nomeAula = slot ? slot.label : `Aula ${idx+1}`;
        const isActive = idx === aulaAtivaIdx;
        return `
          <button type="button" class="btn-secondary btn-sm btn-aula-tab ${isActive ? 'active' : ''}" data-aula="${idx}" style="${isActive ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">
            ${nomeAula}
          </button>
        `;
      }).join("")}
    </div>

    <label class="lbl"><b>PREFIXO:</b></label>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
      ${MODELOS_EQUIPAMENTO.map(cat => `
        <button type="button" class="btn-secondary btn-sm btn-cat-filter ${cat.id === prefixoAtual ? 'active' : ''}" data-cat="${cat.id}" style="${cat.id === prefixoAtual ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">${cat.label}</button>
      `).join("")}
    </div>

    <label class="lbl"><b>DIGITE OS NÚMEROS (SEPARADOS POR VÍRGULA):</b></label>
    <input id="inpAtribComandoAula" class="inp" placeholder="Ex: 1, 2, 3..." autofocus style="padding:10px;">

    <div style="background:var(--bg-app); border:1px solid var(--border); padding:12px; border-radius:8px; margin:12px 0; min-height:50px;">
      <div id="containerTagsAulaAtrib"></div>
    </div>

    <button type="button" id="btnSaveAssignAula" class="btn-primary" style="width:100%; padding:12px;">✅ Salvar Atribuições</button>
  `);

  const inputEl = m.querySelector("#inpAtribComandoAula");
  const containerTags = m.querySelector("#containerTagsAulaAtrib");
  const badgeContador = m.querySelector("#badgeContadorAulaAtrib");

  const atualizarTelaAula = () => {
    const listaAtual = atribuicoesPorAula[aulaAtivaIdx] || [];
    badgeContador.textContent = `${listaAtual.length} / ${qtdLimite} máq.`;

    if (!listaAtual.length) {
      containerTags.innerHTML = `<span class="muted">Nenhuma máquina atribuída para esta aula.</span>`;
    } else {
      containerTags.innerHTML = listaAtual.map(eq => `
        <span class="badge active" style="font-size:12px; padding:4px 8px; display:inline-flex; align-items:center; gap:4px; margin:2px;">
          ${eq} <b style="cursor:pointer; color:#fff;" onclick="window.removerTagAulaAtrib('${eq}')">&times;</b>
        </span>
      `).join("");
    }
  };

  window.removerTagAulaAtrib = (eq) => {
    atribuicoesPorAula[aulaAtivaIdx] = (atribuicoesPorAula[aulaAtivaIdx] || []).filter(x => x !== eq);
    atualizarTelaAula();
  };

  m.querySelectorAll(".btn-aula-tab").forEach(btn => {
    btn.onclick = () => {
      aulaAtivaIdx = parseInt(btn.dataset.aula, 10);
      m.querySelectorAll(".btn-aula-tab").forEach(b => { b.style.background = ""; b.style.color = ""; });
      btn.style.background = "var(--primary)";
      btn.style.color = "#fff";
      atualizarTelaAula();
    };
  });

  m.querySelectorAll(".btn-cat-filter").forEach(btn => {
    btn.onclick = () => {
      prefixoAtual = btn.dataset.cat;
      m.querySelectorAll(".btn-cat-filter").forEach(b => { b.style.background = ""; b.style.color = ""; });
      btn.style.background = "var(--primary)";
      btn.style.color = "#fff";
      inputEl.focus();
    };
  });

  inputEl.addEventListener("input", () => {
    const val = inputEl.value;
    if (val.includes(",")) {
      const pedacos = val.split(",");
      for (let i = 0; i < pedacos.length - 1; i++) {
        let bruto = pedacos[i].trim().toUpperCase();
        if (bruto) {
          if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];
          if (atribuicoesPorAula[aulaAtivaIdx].length >= qtdLimite) break;
          let codigoFinal = bruto;
          if (!/[A-Z]/.test(bruto)) codigoFinal = prefixoAtual + bruto;
          if (!atribuicoesPorAula[aulaAtivaIdx].includes(codigoFinal)) {
            atribuicoesPorAula[aulaAtivaIdx].push(codigoFinal);
          }
        }
      }
      inputEl.value = pedacos[pedacos.length - 1];
      atualizarTelaAula();
    }
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      let bruto = inputEl.value.trim().toUpperCase();
      if (bruto) {
        if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];
        if (atribuicoesPorAula[aulaAtivaIdx].length >= qtdLimite) return alert(`Limite de ${qtdLimite} máquinas atingido!`);
        let codigoFinal = bruto;
        if (!/[A-Z]/.test(bruto)) codigoFinal = prefixoAtual + bruto;
        if (!atribuicoesPorAula[aulaAtivaIdx].includes(codigoFinal)) {
          atribuicoesPorAula[aulaAtivaIdx].push(codigoFinal);
        }
        inputEl.value = "";
        atualizarTelaAula();
      }
    }
  });

  atualizarTelaAula();

  m.querySelector("#btnSaveAssignAula").onclick = async () => {
    const resto = inputEl.value.trim().toUpperCase();
    if (resto) {
      let codigoFinal = resto;
      if (!/[A-Z]/.test(resto)) codigoFinal = prefixoAtual + resto;
      if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];
      if (!atribuicoesPorAula[aulaAtivaIdx].includes(codigoFinal)) {
        atribuicoesPorAula[aulaAtivaIdx].push(codigoFinal);
      }
    }

    if (window.mostrarLoader) window.mostrarLoader("A salvar atribuições...");

    try {
      for (let target of itens) {
        await firestore.collection("emprestimos").doc(target.idDoc).delete();
      }

      for (let lIdx of aulasSelecionadas) {
        const slot = tabelaUsada[lIdx];
        const nomeAulaLabel = slot ? slot.label : `Aula ${lIdx + 1}`;
        const listaEqsAula = atribuicoesPorAula[lIdx] && atribuicoesPorAula[lIdx].length > 0 ? atribuicoesPorAula[lIdx] : ["Pendente"];
        const statusAula = listaEqsAula.includes("Pendente") ? "aguardando" : "retirado";

        await firestore.collection("emprestimos").add({
          id: window.uid(),
          batchId: batchId,
          userId: itemPrincipal.userId,
          userName: itemPrincipal.userName,
          turno: itemPrincipal.turno || "manhã",
          tipoEquipamento: itemPrincipal.tipoEquipamento || "notebook",
          date: itemPrincipal.date,
          lessons: [nomeAulaLabel],
          lessonIndexes: [lIdx],
          lessonIndex: lIdx,
          segment: itemPrincipal.segment || "1º A",
          equipments: listaEqsAula,
          equipment: listaEqsAula[0],
          qtdTotalPedida: qtdLimite,
          purpose: itemPrincipal.purpose || "outros",
          status: statusAula,
          createdAt: itemPrincipal.createdAt || window.nowFormatted()
        });
      }

      alert("Atribuições salvas com sucesso!");
      window.fecharModalSeguro();
      window.nav("solicitacoes");
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    } finally {
      if (window.esconderLoader) window.esconderLoader();
    }
  };
};

window.modalEditarReserva = function(batchId) {
  const itens = (window.db?.emprestimos || []).filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return alert("Solicitação não encontrada.");

  let qtdAtual = 1;
  itens.forEach(x => {
    const q = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (q > qtdAtual) qtdAtual = q;
  });

  const itemPrincipal = itens[0];

  const m = window.modal(`
    <div class="modal-top">
      <h2>✏️ Editar Solicitação</h2>
    </div>
    <form id="fEditSol">
      <label class="lbl">Tipo de Equipamento
        <select id="eTipo" class="inp">
          <option value="notebook" ${itemPrincipal.tipoEquipamento !== 'tablet' ? 'selected' : ''}>Notebook</option>
          <option value="tablet" ${itemPrincipal.tipoEquipamento === 'tablet' ? 'selected' : ''}>Tablet</option>
        </select>
      </label>

      <label class="lbl" style="margin-top:10px;">Data de Uso
        <input id="eDate" type="date" value="${itemPrincipal.date}" class="inp" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Quantidade (Máx. 30)
        <input id="eQty" type="number" min="1" max="30" value="${qtdAtual}" class="inp" required>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Salvar Alterações</button>
    </form>
  `);

  m.querySelector("#fEditSol").onsubmit = async e => {
    e.preventDefault();
    const novoTipo = document.getElementById("eTipo").value;
    const novaData = document.getElementById("eDate").value;
    const novaQtd = parseInt(document.getElementById("eQty").value, 10);

    if (window.mostrarLoader) window.mostrarLoader("A atualizar solicitação...");

    try {
      for (let target of itens) {
        await firestore.collection("emprestimos").doc(target.idDoc).update({
          tipoEquipamento: novoTipo,
          date: novaData,
          qtdTotalPedida: novaQtd
        });
      }
      alert("Solicitação atualizada!");
      window.fecharModalSeguro();
      window.nav("solicitacoes");
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    } finally {
      if (window.esconderLoader) window.esconderLoader();
    }
  };
};

window.devolverLoteComRegistro = async function(batchId) {
  if (!confirm("Confirmar devolução das máquinas com registro em histórico?")) return;

  const itens = (window.db?.emprestimos || []).filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return;
  const dataDevolucao = window.nowFormatted();

  if (window.mostrarLoader) window.mostrarLoader("A registar devolução...");

  try {
    for (let target of itens) {
      await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });

      const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
      const validEqs = eqList.filter(x => x && x !== "Pendente");
      const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");

      for (let eq of validEqs) {
        await firestore.collection("devolucoes").add({
          id: window.uid(),
          batchId: batchId,
          userName: target.userName,
          equipment: eq,
          lesson: labelAulas,
          dateUse: target.date,
          deliveredAt: target.createdAt || "—",
          returnedAt: dataDevolucao
        });
      }
    }
    alert("Equipamentos devolvidos com sucesso!");
    window.nav("solicitacoes");
  } catch (err) {
    alert("Erro ao devolver: " + err.message);
  } finally {
    if (window.esconderLoader) window.esconderLoader();
  }
};

window.cancelarLote = async function(batchId) {
  if (confirm("Deseja realmente excluir esta solicitação?")) {
    if (window.mostrarLoader) window.mostrarLoader("A excluir solicitação...");
    try {
      const itens = (window.db?.emprestimos || []).filter(x => (x.batchId || x.idDoc || x.id) === batchId);
      for (let d of itens) {
        await firestore.collection("emprestimos").doc(d.idDoc).delete();
      }
      alert("Solicitação excluída com sucesso!");
      window.nav("solicitacoes");
    } catch (err) {
      alert("Erro ao excluir: " + err.message);
    } finally {
      if (window.esconderLoader) window.esconderLoader();
    }
  }
};