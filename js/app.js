export const firebaseConfig = {
  apiKey: "AIzaSyCaz1JCXX1RLOZviyG3Ggf47B0blheSa68",
  authDomain: "reserva-escolamariaolimpia.firebaseapp.com",
  projectId: "reserva-escolamariaolimpia",
  storageBucket: "reserva-escolamariaolimpia",
  messagingSenderId: "reserva-escolamariaolimpia",
  appId: "1:122324755743:web:9060239e2572733dd4fc2a"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const firestore = firebase.firestore();

const SESSION_KEY = "controle_sessao_proati_v53";

const MODELOS_EQUIPAMENTO = [
  { id: "M", label: "M (Multilaser)" },
  { id: "SA", label: "SA (Samsung)" },
  { id: "PV", label: "PV (Positivo V.)" },
  { id: "PN", label: "PN (Positivo N.)" },
  { id: "TAB", label: "TAB (Tablet)" }
];

let deferredPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
});

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const modals = document.querySelectorAll('.modal');
    if (modals.length > 0) modals[modals.length - 1].remove();
  }
});

const TABELAS_HORARIOS = {
  "6_7": [
    { label: "1ª Aula", start: "07:00", end: "07:50" },
    { label: "2ª Aula", start: "07:50", end: "08:40" },
    { label: "3ª Aula", start: "08:40", end: "09:30" },
    { label: "4ª Aula", start: "09:50", end: "10:40" },
    { label: "5ª Aula", start: "10:40", end: "11:30" },
    { label: "6ª Aula", start: "11:30", end: "12:20" },
    { label: "7ª Aula", start: "13:10", end: "14:00" }
  ],
  "8_9": [
    { label: "1ª Aula", start: "07:00", end: "07:50" },
    { label: "2ª Aula", start: "07:50", end: "08:40" },
    { label: "3ª Aula", start: "09:00", end: "09:50" },
    { label: "4ª Aula", start: "09:50", end: "10:40" },
    { label: "5ª Aula", start: "10:40", end: "11:30" },
    { label: "6ª Aula", start: "12:20", end: "13:10" },
    { label: "7ª Aula", start: "13:10", end: "14:00" }
  ]
};

const FINALIDADES = [
  { id: "redacao", label: "Redação" },
  { id: "programacao", label: "Alura" },
  { id: "speak", label: "Speak (Inglês)" },
  { id: "matific", label: "Matific (Matemática)" },
  { id: "sem_plataforma", label: "Sem Plataforma" },
];

const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

let db = { users: [], machines: [], reservas: [], bloqueios: [], emprestimos: [], transferencias: [], reports: [], devolucoes: [] };
let user = null;
let currentPage = "dashboard";

const hojeData = new Date();
let calYear = hojeData.getFullYear();
let calMonth = hojeData.getMonth();

const $ = id => document.getElementById(id);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2);
const esc = x => String(x ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const menus = [
  ["dashboard", "Dashboard"],
  ["ocupacao", "📊 Ocupação %"],
  ["calendario", "Calendário"],
  ["solicitacoes", "Solicitações & Reservas"],
  ["inspetoras", "💻 Controle de Saídas"],
  ["devolucoes", "Histórico Devoluções"],
  ["avarias", "Avarias"],
  ["bloqueios", "Bloqueios"],
  ["usuarios", "Usuários"],
  ["tutorial", "❓ Tutorial"]
];

function nowFormatted() {
  const d = new Date();
  const dia = String(d.getDate()).padStart(2, '0');
  const mes = String(d.getMonth() + 1).padStart(2, '0');
  const ano = d.getFullYear();
  const hora = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${ano} às ${hora}:${min}`;
}

function obterIndiceAulaAtual() {
  const agora = new Date();
  const mins = agora.getHours() * 60 + agora.getMinutes();
  const tabela = TABELAS_HORARIOS["6_7"];

  for (let i = 0; i < tabela.length; i++) {
    const [hIni, mIni] = tabela[i].start.split(":").map(Number);
    const [hFim, mFim] = tabela[i].end.split(":").map(Number);
    const iniMins = hIni * 60 + mIni;
    const fimMins = hFim * 60 + mFim;

    if (mins >= iniMins && mins <= fimMins) return i;
  }
  return 0;
}

function ordenarEquipamentos(listaEq) {
  const ordemPrefixo = { "M": 1, "PN": 2, "PV": 3, "SA": 4, "TAB": 5 };

  return listaEq.sort((a, b) => {
    const matchA = a.match(/^([A-Z]+)(\d+)?/i);
    const matchB = b.match(/^([A-Z]+)(\d+)?/i);

    const prefA = matchA ? matchA[1].toUpperCase() : a;
    const prefB = matchB ? matchB[1].toUpperCase() : b;

    const numA = matchA && matchA[2] ? parseInt(matchA[2], 10) : 0;
    const numB = matchB && matchB[2] ? parseInt(matchB[2], 10) : 0;

    const pesoA = ordemPrefixo[prefA] || 99;
    const pesoB = ordemPrefixo[prefB] || 99;

    if (pesoA !== pesoB) return pesoA - pesoB;
    return numA - numB;
  });
}

function escutarColecao(colecao, chaveDb) {
  firestore.collection(colecao).onSnapshot(snapshot => {
    db[chaveDb] = snapshot.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
    
    if (user && currentPage === 'solicitacoes') {
      const q = $("searchSol") ? $("searchSol").value.trim().toLowerCase() : "";
      const p = $("filterProf") ? $("filterProf").value : "todos";
      const d = $("filterData") ? $("filterData").value : "";
      const s = $("filterStatus") ? $("filterStatus").value : "todos";
      const container = $("solicitacoesContainer");
      if (container) {
        container.innerHTML = renderizarTabelaSolicitacoes(q, p, d, s);
      }
    } else if (user && typeof window[currentPage] === 'function') {
      window[currentPage]();
    }
  });
}

function inicializarBancoEmNuvem() {
  escutarColecao("users", "users");
  escutarColecao("machines", "machines");
  escutarColecao("reservas", "reservas");
  escutarColecao("bloqueios", "bloqueios");
  escutarColecao("emprestimos", "emprestimos");
  escutarColecao("transferencias", "transferencias");
  escutarColecao("reports", "reports");
  escutarColecao("devolucoes", "devolucoes");
}
inicializarBancoEmNuvem();

function verificarDevolucaoAutomaticaPorHorario() {
  const agora = new Date();
  const hora = agora.getHours();
  const min = agora.getMinutes();
  const hojeStr = agora.toISOString().split("T")[0];

  if (hora > 13 || (hora === 13 && min >= 30)) {
    const ativosHoje = (db.emprestimos || []).filter(x => x && x.date === hojeStr && x.status === "retirado");
    
    ativosHoje.forEach(async target => {
      try {
        await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });
        const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
        const validEqs = eqList.filter(x => x && x !== "Pendente");
        const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");

        for (let eq of validEqs) {
          await firestore.collection("devolucoes").add({
            id: uid(),
            batchId: target.batchId || target.idDoc,
            userName: target.userName,
            equipment: eq,
            lesson: labelAulas,
            dateUse: target.date,
            deliveredAt: target.createdAt || "—",
            returnedAt: nowFormatted() + " (Auto 13h30)"
          });
        }
      } catch (err) {
        console.error("Erro na devolução automática:", err);
      }
    });
  }
}
setInterval(verificarDevolucaoAutomaticaPorHorario, 5 * 60 * 1000);

const isPastDate = d => d < new Date().toISOString().split("T")[0];
const isWeekend = d => [0, 6].includes(new Date(d + "T00:00:00").getDay());
const isHoliday = d => FERIADOS_FIXOS.includes(d.slice(5));

function verificarSessaoSalva() {
  const cachedUserData = localStorage.getItem(SESSION_KEY);
  if (cachedUserData) {
    try {
      const u = JSON.parse(cachedUserData);
      if (u && (u.name || u.idDoc || u.id)) {
        user = u;
        $("login").classList.add("hidden");
        $("app").classList.remove("hidden");

        $("who").innerHTML = `
          <span><b>${esc(u.name)}</b> (${u.role === "admin" ? "Admin" : "Prof."})</span>
          <button class="btn-sm" onclick="modalEditarMeuPerfil()">✏️ Perfil</button>
          <button class="btn-sm danger" id="btnLogoutApp">🚪 Sair</button>
        `;

        $("btnLogoutApp").onclick = encerrarSessao;
        nav("dashboard");
        return;
      }
    } catch (e) {}
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verificarSessaoSalva);
} else {
  verificarSessaoSalva();
}

function iniciarSessao(u) {
  user = u;
  localStorage.setItem(SESSION_KEY, JSON.stringify(u));
  
  $("login").classList.add("hidden");
  $("app").classList.remove("hidden");

  $("who").innerHTML = `
    <span><b>${esc(u.name)}</b> (${u.role === "admin" ? "Admin" : "Prof."})</span>
    <button class="btn-sm" onclick="modalEditarMeuPerfil()">✏️ Perfil</button>
    <button class="btn-sm danger" id="btnLogoutApp">🚪 Sair</button>
  `;

  $("btnLogoutApp").onclick = encerrarSessao;
  nav("dashboard");
}

function encerrarSessao() {
  user = null;
  localStorage.removeItem(SESSION_KEY);
  $("app").classList.add("hidden");
  $("login").classList.remove("hidden");
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();
  const entered = $("loginUser").value.trim().toLowerCase();
  const pass = $("loginPass").value.trim();

  let u = db.users.find(x => 
    (x.userLogin && x.userLogin.toLowerCase() === entered) || 
    x.name.toLowerCase() === entered
  );

  if (!u) {
    try {
      const snap = await firestore.collection("users").get();
      const todos = snap.docs.map(doc => ({ idDoc: doc.id, ...doc.data() }));
      u = todos.find(x => 
        (x.userLogin && x.userLogin.toLowerCase() === entered) || 
        x.name.toLowerCase() === entered
      );
    } catch (err) {}
  }

  if (!u || u.pass !== pass) {
    return $("loginError").textContent = "Usuário ou senha incorretos.";
  }
  iniciarSessao(u);
});

function modalPrimeiroAcesso() {
  const m = modal(`
    <div class="modal-top">
      <h2>🆕 Primeiro Acesso</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fPrimeiroAcesso">
      <label class="lbl">Nome Completo
        <input id="paNome" class="inp" placeholder="Ex: Maria Oliveira" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Usuário de Acesso (Login)
        <input id="paLogin" class="inp" placeholder="Ex: maria.oliveira" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Senha (4 números)
        <input id="paPass" type="password" maxlength="4" pattern="\\d{4}" class="inp" placeholder="Ex: 1234" required>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Cadastrar</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fPrimeiroAcesso").onsubmit = async e => {
    e.preventDefault();
    const name = $("paNome").value.trim();
    const userLogin = $("paLogin").value.trim().toLowerCase();
    const pass = $("paPass").value.trim();

    if (pass.length !== 4 || isNaN(pass)) return alert("A senha deve conter exatamente 4 números.");

    try {
      await firestore.collection("users").add({ id: uid(), name, userLogin, pass, role: "professor" });
      alert("Cadastro efetuado! Faça login com suas credenciais.");
      m.remove();
    } catch (err) {
      alert("Erro ao cadastrar: " + err.message);
    }
  };
}

function nav(page) {
  currentPage = page;
  const pendentesCount = db.emprestimos.filter(x => x.status === "aguardando").length;
  const badge = pendentesCount > 0 ? `<span class="badge">${pendentesCount}</span>` : '';

  $("nav").innerHTML = menus
    .filter(x => user.role === "admin" || !["bloqueios", "usuarios", "devolucoes"].includes(x[0]))
    .map(x => `<button class="${x[0] === page ? "active" : ""}" data-p="${x[0]}">${x[1]} ${x[0] === "solicitacoes" ? badge : ""}</button>`)
    .join("");

  document.querySelectorAll("#nav button").forEach(b => b.onclick = () => nav(b.dataset.p));
  if (typeof window[page] === 'function') window[page]();
}

function modalEditarMeuPerfil() {
  if (!user) return;
  const currentUser = db.users.find(x => (x.idDoc && x.idDoc === user.idDoc) || x.id === user.id) || user;

  const m = modal(`
    <div class="modal-top">
      <h2>✏️ Meu Perfil</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fMeuPerfil">
      <label class="lbl">Nome Completo
        <input id="mpNome" class="inp" value="${esc(currentUser.name)}" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Usuário de Acesso
        <input id="mpLogin" class="inp" value="${esc(currentUser.userLogin || currentUser.name)}" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Senha (4 números)
        <div style="display:flex; gap:6px;">
          <input id="mpPass" type="password" maxlength="4" pattern="\\d{4}" class="inp" value="${esc(currentUser.pass)}" required>
          <button type="button" id="btnTogglePass" class="btn-secondary">👁️ Ver</button>
        </div>
      </label>

      <div style="margin-top:18px; display:flex; gap:6px;">
        <button type="submit" class="btn-primary" style="flex:1;">Salvar</button>
        <button type="button" class="btn-secondary close-btn" style="flex:1;">Cancelar</button>
      </div>
    </form>
  `);

  const passInp = m.querySelector("#mpPass");
  const toggleBtn = m.querySelector("#btnTogglePass");

  toggleBtn.onclick = () => {
    if (passInp.type === "password") {
      passInp.type = "text";
      toggleBtn.textContent = "🙈 Ocultar";
    } else {
      passInp.type = "password";
      toggleBtn.textContent = "👁️ Ver";
    }
  };

  m.querySelectorAll(".close, .close-btn").forEach(b => b.onclick = () => m.remove());

  m.querySelector("#fMeuPerfil").onsubmit = async e => {
    e.preventDefault();
    const n = $("mpNome").value.trim();
    const l = $("mpLogin").value.trim().toLowerCase();
    const p = $("mpPass").value.trim();

    if (p.length !== 4 || isNaN(p)) return alert("A senha deve conter exatamente 4 números.");

    try {
      if (currentUser.idDoc) {
        await firestore.collection("users").doc(currentUser.idDoc).update({ name: n, userLogin: l, pass: p });
      }
      user.name = n;
      user.userLogin = l;
      user.pass = p;
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));

      alert("Perfil atualizado com sucesso!");
      m.remove();
      
      $("who").innerHTML = `
        <span><b>${esc(user.name)}</b> (${user.role === "admin" ? "Admin" : "Prof."})</span>
        <button class="btn-sm" onclick="modalEditarMeuPerfil()">✏️ Perfil</button>
        <button class="btn-sm danger" id="btnLogoutApp">🚪 Sair</button>
      `;
      $("btnLogoutApp").onclick = encerrarSessao;
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    }
  };
}

/* DASHBOARD */
function dashboard() {
  const hoje = new Date().toISOString().split("T")[0];
  const resHoje = db.reservas.filter(r => r.date === hoje && r.status === "confirmed");
  const noteHoje = new Set(resHoje.filter(r => r.type === "notebook").map(r => r.equipment)).size;
  const tabHoje = new Set(resHoje.filter(r => r.type === "tablet").map(r => r.equipment)).size;

  const pctNote = Math.min(100, Math.round((noteHoje / 153) * 100));
  const pctTab = Math.min(100, Math.round((tabHoje / 23) * 100));

  const renderPieSVG = (pct) => `
    <svg width="48" height="48" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
      <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="#f8fafc" stroke-width="4" stroke-dasharray="${pct} 100" pathLength="100" />
    </svg>`;

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>reservamaquinaaqui</h2>
        <div class="muted">Escola Maria Olímpia · Total: 176 equipamentos (153 Notebooks, 23 Tablets)</div>
      </div>
      <div class="action-bar">
        <button class="btn-primary" onclick="modalReserva()">+ Criar Solicitação</button>
        <button class="btn-secondary" onclick="modalReportDefeito()">Reportar Avaria</button>
      </div>
    </div>

    <div class="filter-grid" style="margin-bottom:16px;">
      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="muted">Notebooks Hoje</div>
          <b style="font-size:20px;">${noteHoje} / 153</b>
          <div style="font-size:11px; color:var(--text-muted);">${pctNote}% ocupado</div>
        </div>
        ${renderPieSVG(pctNote)}
      </div>

      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="muted">Tablets Hoje</div>
          <b style="font-size:20px;">${tabHoje} / 23</b>
          <div style="font-size:11px; color:var(--text-muted);">${pctTab}% ocupado</div>
        </div>
        ${renderPieSVG(pctTab)}
      </div>

      <div class="card">
        <div class="muted">Empréstimos Ativos</div>
        <b style="font-size:22px;">${obterContagemAtivos()}</b>
      </div>
    </div>

    <div class="card">
      <h3>Retiradas Hoje (${hoje.split('-').reverse().join('/')})</h3>
      ${usoTabela()}
    </div>`;
}

function obterContagemAtivos() {
  let count = 0;
  (db.emprestimos || []).forEach(x => {
    if (x.status === "retirado") {
      const eqList = x.equipments || (x.equipment ? [x.equipment] : []);
      count += eqList.filter(e => e && e !== "Pendente").length;
    }
  });
  return count;
}

function usoTabela() {
  const ativos = (db.emprestimos || []).filter(x => x && x.status === "retirado");
  if (!ativos.length) return `<p class="muted" style="padding:12px 0;">Nenhum equipamento em uso no momento.</p>`;

  const lotesAgrupados = {};
  ativos.forEach(x => {
    const bid = x.batchId || x.idDoc || x.id;
    if (!lotesAgrupados[bid]) {
      lotesAgrupados[bid] = {
        userName: x.userName,
        date: x.date,
        lessons: new Set(),
        equipments: new Set()
      };
    }

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => lotesAgrupados[bid].equipments.add(e));
    else if (x.equipment) lotesAgrupados[bid].equipments.add(x.equipment);

    if (x.lessons && Array.isArray(x.lessons)) x.lessons.forEach(l => lotesAgrupados[bid].lessons.add(l));
    else if (x.lesson) lotesAgrupados[bid].lessons.add(x.lesson);
  });

  const lista = Object.values(lotesAgrupados);

  return `
    <div class="table-container">
      <table>
        <thead>
          <tr><th>Professor</th><th>Qtd.</th><th>Equipamentos</th><th>Data</th><th>Horários</th></tr>
        </thead>
        <tbody>
          ${lista.map(g => {
            const eqArray = Array.from(g.equipments).filter(x => x && x !== "Pendente");
            const listaOrdenada = ordenarEquipamentos(eqArray);
            return `
              <tr>
                <td><b>${esc(g.userName)}</b></td>
                <td><b>${listaOrdenada.length}</b></td>
                <td><code>${esc(listaOrdenada.join(", "))}</code></td>
                <td>${g.date ? g.date.split('-').reverse().join('/') : "—"}</td>
                <td>${esc(Array.from(g.lessons).join(", "))}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

/* ABA DE PORCENTAGEM DE USO NAS AULAS */
function ocupacao() {
  const hoje = new Date().toISOString().split("T")[0];
  const emprestimosHoje = db.emprestimos.filter(r => r.date === hoje && r.status !== "cancelado");
  
  const TOTAL_NOTEBOOKS = 153;
  const TOTAL_TABLETS = 23;
  const TOTAL_GERAL = 176;

  const tabelaAulas = TABELAS_HORARIOS["6_7"];
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
      notebooks: notebooksUsados,
      tablets: tabletsUsados,
      total: totalAula > TOTAL_GERAL ? TOTAL_GERAL : totalAula
    };
  });

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>📊 Porcentagem de Uso nas Aulas</h2>
        <div class="muted">Acompanhamento percentual da frota total (${TOTAL_GERAL} máquinas) para hoje (${hoje.split('-').reverse().join('/')})</div>
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
                  <td><b>${u.total}</b> / ${TOTAL_GERAL}</td>
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

/* SOLICITAÇÕES */
function solicitacoes() {
  const listaProfessores = db.users.filter(u => u.role === "professor" || u.role === "admin");

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Solicitações e Reservas</h2>
        <div class="muted">Gerenciamento unificado de solicitações</div>
      </div>
      <div style="display:flex; gap:6px; flex-wrap:wrap;">
        <button class="btn-secondary" id="btnFiltrarHoje">📅 Hoje</button>
        <button class="btn-secondary" id="btnFiltrarAulaAtual">⏰ Aula Atual</button>
        <button class="btn-primary" onclick="exportarRelatorioCSV()">📊 Relatório (.CSV)</button>
        <button class="btn-primary" onclick="modalReserva()">+ Nova Solicitação</button>
      </div>
    </div>

    <!-- BARRA DE AÇÕES EM LOTE -->
    <div id="barraAcoesEmLote" class="card hidden" style="background:rgba(59,130,246,0.15); border-color:rgba(59,130,246,0.4); display:flex; justify-content:space-between; align-items:center; padding:10px 16px; margin-bottom:12px;">
      <span id="txtItensSelecionados" style="font-size:13px; font-weight:bold;">0 itens selecionados</span>
      <div style="display:flex; gap:6px;">
        <button class="btn-sm" onclick="executarAcaoEmLote('devolver')">↩️ Devolver Selecionados</button>
        <button class="btn-sm danger" onclick="executarAcaoEmLote('excluir')">🗑️ Excluir Selecionados</button>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="filter-grid">
        <input id="searchSol" placeholder="🔍 Buscar ID, nome, máquina..." class="inp">
        <select id="filterProf" class="inp">
          <option value="todos">Todos os Professores</option>
          ${listaProfessores.map(p => `<option value="${esc(p.name)}">${esc(p.name)}</option>`).join("")}
        </select>
        <input id="filterData" type="date" class="inp">
        <select id="filterStatus" class="inp">
          <option value="todos">Todos os Status</option>
          <option value="aguardando">Aguardando Entrega</option>
          <option value="retirado">Em Uso (Retirado)</option>
          <option value="devolvido">Devolvido</option>
        </select>
      </div>
    </div>

    <div class="card">
      <div id="solicitacoesContainer">
        ${renderizarTabelaSolicitacoes()}
      </div>
    </div>`;

  const trigger = (aulaFiltro = null) => {
    const q = $("searchSol").value.trim().toLowerCase();
    const p = $("filterProf").value;
    const d = $("filterData").value;
    const s = $("filterStatus").value;
    
    $("solicitacoesContainer").innerHTML = renderizarTabelaSolicitacoes(q, p, d, s, aulaFiltro);
  };

  $("searchSol").addEventListener("input", () => trigger());
  $("filterProf").addEventListener("change", () => trigger());
  $("filterData").addEventListener("change", () => trigger());
  $("filterStatus").addEventListener("change", () => trigger());

  $("btnFiltrarHoje").onclick = () => {
    $("filterData").value = new Date().toISOString().split("T")[0];
    trigger();
  };

  $("btnFiltrarAulaAtual").onclick = () => {
    $("filterData").value = new Date().toISOString().split("T")[0];
    trigger(obterIndiceAulaAtual());
  };
}

function selecionarTodosCheckboxes(master) {
  const checkboxes = document.querySelectorAll('.chk-lote-item');
  checkboxes.forEach(cb => cb.checked = master.checked);
  atualizarBarraAcoesLote();
}

function atualizarBarraAcoesLote() {
  const selecionados = document.querySelectorAll('.chk-lote-item:checked');
  const barra = $("barraAcoesEmLote");
  const txt = $("txtItensSelecionados");

  if (selecionados.length > 0) {
    barra.classList.remove("hidden");
    txt.textContent = `${selecionados.length} item(ns) selecionado(s)`;
  } else {
    barra.classList.add("hidden");
  }
}

async function executarAcaoEmLote(acao) {
  const selecionados = Array.from(document.querySelectorAll('.chk-lote-item:checked')).map(cb => cb.dataset.batch);
  if (!selecionados.length) return alert("Nenhum item selecionado.");

  if (acao === "excluir" && !confirm(`Deseja realmente excluir ${selecionados.length} lote(s) selecionado(s)?`)) return;
  if (acao === "devolver" && !confirm(`Deseja devolver os equipamentos de ${selecionados.length} lote(s) selecionado(s)?`)) return;

  try {
    for (let batchId of selecionados) {
      const itens = db.emprestimos.filter(x => (x.batchId || x.idDoc || x.id) === batchId);
      
      if (acao === "excluir") {
        for (let d of itens) {
          await firestore.collection("emprestimos").doc(d.idDoc).delete();
        }
      } else if (acao === "devolver") {
        const dataDevolucao = nowFormatted();
        for (let target of itens) {
          await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });
          const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
          const validEqs = eqList.filter(x => x && x !== "Pendente");
          const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");

          for (let eq of validEqs) {
            await firestore.collection("devolucoes").add({
              id: uid(),
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
  } catch (err) {
    alert("Erro ao processar ação em lote: " + err.message);
  }
}

function renderizarTabelaSolicitacoes(query = "", filterProf = "todos", filterData = "", filterStatus = "todos", filterAulaIdx = null) {
  let raw = db.emprestimos || [];
  if (user.role !== "admin") {
    raw = raw.filter(x => x && (x.userId === user.id || x.userId === user.idDoc));
  }

  const groups = {};
  raw.forEach(x => {
    if (!x) return;
    const bid = x.batchId || x.idDoc || x.id;
    
    if (!groups[bid]) {
      groups[bid] = {
        idDoc: x.idDoc,
        batchId: bid,
        userId: x.userId,
        userName: x.userName || "Não identificado",
        date: x.date || "",
        tipoEquipamento: x.tipoEquipamento || "notebook",
        purpose: x.purpose || "outros",
        lessons: [],
        lessonIndexes: new Set(),
        equipments: new Set(),
        status: x.status || "aguardando",
        qtdTotalPedida: 0
      };
    }

    const qtdNoDoc = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (qtdNoDoc > groups[bid].qtdTotalPedida) {
      groups[bid].qtdTotalPedida = qtdNoDoc;
    }

    if (x.lessons && Array.isArray(x.lessons)) {
      x.lessons.forEach(l => {
        if (!groups[bid].lessons.includes(l)) groups[bid].lessons.push(l);
      });
    } else if (x.lesson && !groups[bid].lessons.includes(x.lesson)) {
      groups[bid].lessons.push(x.lesson);
    }

    if (x.lessonIndexes && Array.isArray(x.lessonIndexes)) x.lessonIndexes.forEach(idx => groups[bid].lessonIndexes.add(idx));
    else if (x.lessonIndex !== undefined) groups[bid].lessonIndexes.add(x.lessonIndex);

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipments.add(x.equipment);
  });

  let list = Object.values(groups).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (filterProf !== "todos") list = list.filter(g => g.userName === filterProf);
  if (filterData) list = list.filter(g => g.date === filterData);
  if (filterAulaIdx !== null) list = list.filter(g => g.lessonIndexes.has(filterAulaIdx));
  if (filterStatus !== "todos") list = list.filter(g => g.status === filterStatus);

  if (query) {
    list = list.filter(g => {
      const eqStr = Array.from(g.equipments).join(" ").toLowerCase();
      return (g.userName || "").toLowerCase().includes(query) ||
             (g.batchId || "").toLowerCase().includes(query) ||
             eqStr.includes(query);
    });
  }

  if (!list.length) return `<p class="muted" style="padding:16px; text-align:center;">Nenhuma solicitação encontrada.</p>`;

  return `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th style="width:30px;"><input type="checkbox" id="chkMasterLote" onclick="selecionarTodosCheckboxes(this)"></th>
            <th>Professor</th>
            <th>Tipo</th>
            <th>Data Uso</th>
            <th>Horários</th>
            <th>Atribuição</th>
            <th>Status</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(g => {
            const isRetirado = g.status === "retirado";
            const isDevolvido = g.status === "devolvido";
            const eqArray = Array.from(g.equipments).filter(x => x && x !== "Pendente");
            const qtdAtribuida = eqArray.length;
            const qtdTotal = g.qtdTotalPedida || 1;

            let stBadge = `<span class="badge">Aguardando</span>`;
            if (isRetirado) stBadge = `<span class="badge active">Em Uso</span>`;
            else if (isDevolvido) stBadge = `<span class="badge muted">Devolvido</span>`;

            const tipoBadge = g.tipoEquipamento === "tablet" ? "📱 Tablet" : "💻 Notebook";
            const podeEditar = user.role === "admin" || user.id === g.userId || user.idDoc === g.userId;

            return `
              <tr>
                <td><input type="checkbox" class="chk-lote-item" data-batch="${g.batchId}" onclick="atualizarBarraAcoesLote()"></td>
                <td><b>${esc(g.userName)}</b></td>
                <td><span class="badge" style="background:rgba(59,130,246,0.1); color:#38bdf8;">${tipoBadge}</span></td>
                <td>${g.date ? g.date.split('-').reverse().join('/') : "—"}</td>
                <td><small>${g.lessons.join(", ")}</small></td>
                <td>
                  <b>${qtdAtribuida} / ${qtdTotal} máq.</b>
                  ${qtdAtribuida < qtdTotal ? `<small style="color:#f59e0b; display:block;">(Pendente)</small>` : ''}
                </td>
                <td>${stBadge}</td>
                <td>
                  <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    ${podeEditar ? `<button class="btn-sm" style="background:var(--primary); color:#fff; font-weight:bold;" onclick="modalAtribuirPorAula('${g.batchId}')">💻 Atribuir Máquinas</button>` : ''}
                    ${podeEditar ? `<button class="btn-sm" onclick="modalEditarReserva('${g.batchId}')">✏️ Editar</button>` : ''}
                    ${podeEditar && !isDevolvido ? `<button class="btn-sm danger" onclick="devolverLoteComRegistro('${g.batchId}')">↩️ Devolver</button>` : ''}
                    ${podeEditar ? `<button class="btn-sm danger" onclick="cancelarLote('${g.batchId}')">🗑️ Excluir</button>` : ''}
                  </div>
                </td>
              </tr>`;
          }).join("")}
        </tbody>
      </table>
    </div>`;
}

function exportarRelatorioCSV() {
  const raw = db.emprestimos || [];
  if (!raw.length) return alert("Nenhum dado encontrado para gerar o relatório.");

  const groups = {};
  raw.forEach(x => {
    if (!x) return;
    const bid = x.batchId || x.idDoc || x.id;
    if (!groups[bid]) {
      groups[bid] = {
        userName: x.userName || "Não identificado",
        tipoEquipamento: x.tipoEquipamento || "notebook",
        date: x.date || "",
        lessons: [],
        equipments: new Set(),
        status: x.status || "aguardando",
        qtdTotalPedida: 0
      };
    }

    const qtdNoDoc = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (qtdNoDoc > groups[bid].qtdTotalPedida) {
      groups[bid].qtdTotalPedida = qtdNoDoc;
    }

    if (x.lessons && Array.isArray(x.lessons)) {
      x.lessons.forEach(l => {
        if (!groups[bid].lessons.includes(l)) groups[bid].lessons.push(l);
      });
    } else if (x.lesson && !groups[bid].lessons.includes(x.lesson)) {
      groups[bid].lessons.push(x.lesson);
    }

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipments.add(x.equipment);
  });

  let csvContent = "data:text/csv;charset=utf-8,Professor;Tipo;Data;Horarios;QtdPedida;QtdAtribuida;Equipamentos;Status\n";

  Object.values(groups).forEach(g => {
    const eqArray = Array.from(g.equipments).filter(e => e && e !== "Pendente");
    const listaOrdenada = ordenarEquipamentos(eqArray);
    const prof = `"${(g.userName || "").replace(/"/g, '""')}"`;
    const tipo = g.tipoEquipamento === "tablet" ? "Tablet" : "Notebook";
    const data = g.date ? g.date.split('-').reverse().join('/') : "—";
    const horarios = `"${g.lessons.join(", ").replace(/"/g, '""')}"`;
    const qtdPedida = g.qtdTotalPedida || 1;
    const qtdAtribuida = listaOrdenada.length;
    const equipamentos = `"${listaOrdenada.join(", ").replace(/"/g, '""')}"`;
    const status = g.status;

    csvContent += `${prof};${tipo};${data};${horarios};${qtdPedida};${qtdAtribuida};${equipamentos};${status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `relatorio_solicitacoes_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/* MODAL DE ATRIBUIÇÃO POR AULA COM SELEÇÃO DE AULA LIMPA E ORGANIZADA */
function modalAtribuirPorAula(batchId) {
  const itens = db.emprestimos.filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return alert("Solicitação não encontrada.");

  const itemPrincipal = itens[0];
  const bloqDia = db.bloqueios.filter(b => b.date === itemPrincipal.date);

  if (bloqDia.some(b => b.lesson === "all")) {
    return alert(`🚫 ERRO CRÍTICO: Esta data (${itemPrincipal.date.split('-').reverse().join('/')}) possui BLOQUEIO TOTAL e não pode receber atribuições.`);
  }

  // Coleta limpa e única dos índices de aulas (evita duplicações)
  let aulasSet = new Set();
  itens.forEach(x => {
    if (x.lessonIndexes && Array.isArray(x.lessonIndexes)) {
      x.lessonIndexes.forEach(idx => aulasSet.add(idx));
    } else if (x.lessonIndex !== undefined) {
      aulasSet.add(x.lessonIndex);
    }
  });
  let aulasSelecionadas = Array.from(aulasSet).sort((a, b) => a - b);
  if (!aulasSelecionadas.length) aulasSelecionadas = [0];

  const tabelaUsada = TABELAS_HORARIOS[itemPrincipal.segment || "6_7"] || TABELAS_HORARIOS["6_7"];
  let aulaAtivaIdx = aulasSelecionadas[0];

  let atribuicoesPorAula = {};
  let historicoUndoPorAula = {};

  aulasSelecionadas.forEach(idx => {
    atribuicoesPorAula[idx] = [];
    historicoUndoPorAula[idx] = null;
  });

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

  const m = modal(`
    <div class="modal-top">
      <h2>📌 Atribuir Máquinas por Aula</h2>
      <button class="close">&times;</button>
    </div>

    <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; flex-wrap:wrap; gap:8px;">
      <span style="font-size:13px;">Professor: <b>${esc(itemPrincipal.userName)}</b> (${itemPrincipal.tipoEquipamento === 'tablet' ? 'Tablet' : 'Notebook'})</span>
      <div style="display:flex; align-items:center; gap:12px;">
        <span id="badgeContadorAulaAtrib" class="badge active" style="font-size:12px;">0 máquinas</span>
        <label style="display:flex; align-items:center; gap:6px; font-size:12px; cursor:pointer; font-weight:bold; color:#f59e0b;">
          <input type="checkbox" id="chkAtivarIlimitado" checked style="cursor:pointer; width:16px; height:16px;"> 🔓 Atribuir sem limite
        </label>
      </div>
    </div>

    <label class="lbl"><b>ESCOLHA A AULA PARA CONFIGURAR AS MÁQUINAS:</b></label>
    <div id="botoesAulasAtrib" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
      ${aulasSelecionadas.map(idx => {
        const slot = tabelaUsada[idx];
        const nomeAula = slot ? slot.label : `Aula ${idx+1}`;
        const isActive = idx === aulaAtivaIdx;
        const aulaBloqueada = bloqDia.some(b => String(b.lesson) === String(idx));
        
        return `
          <button type="button" class="btn-secondary btn-sm btn-aula-tab ${isActive ? 'active' : ''} ${aulaBloqueada ? 'blocked-btn' : ''}" data-aula="${idx}" style="${isActive ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''} ${aulaBloqueada ? 'border-color:#ef4444; color:#ef4444;' : ''}">
            ${nomeAula} ${aulaBloqueada ? '🔒 (Bloqueada)' : `(${slot ? slot.start : ''})`}
          </button>
        `;
      }).join("")}
    </div>

    <label class="lbl"><b>PREFIXO ATIVO:</b></label>
    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:10px;">
      ${MODELOS_EQUIPAMENTO.map(cat => `
        <button type="button" class="btn-secondary btn-sm btn-cat-filter ${cat.id === prefixoAtual ? 'active' : ''}" data-cat="${cat.id}" style="${cat.id === prefixoAtual ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">${cat.label}</button>
      `).join("")}
    </div>

    <div style="display:flex; gap:6px; margin-bottom:10px;">
      <input id="inpAtribComandoAula" class="inp" placeholder="Ex: 1, 2, 3 (digite e aperte vírgula ou Enter)..." style="font-size:15px; padding:10px; flex:1;" autofocus>
      <button type="button" id="btnUndoAula" class="btn-secondary" title="Desfazer última remoção (Ctrl+Z)">↩️ Desfazer</button>
    </div>

    <div style="background:var(--bg-input); border:1px solid var(--border); padding:12px; border-radius:8px; margin-top:12px; margin-bottom:16px; min-height:55px;">
      <label class="lbl" style="margin-bottom:6px; display:block;" id="labelAulaAtualContainer">Máquinas da Aula Atual:</label>
      <div id="containerTagsAulaAtrib"></div>
    </div>

    <button type="button" id="btnSaveAssignAula" class="btn-primary" style="width:100%; padding:12px;">✅ Salvar Atribuições de Todas as Aulas</button>
  `);

  const inputEl = m.querySelector("#inpAtribComandoAula");
  const containerTags = m.querySelector("#containerTagsAulaAtrib");
  const badgeContador = m.querySelector("#badgeContadorAulaAtrib");
  const btnUndo = m.querySelector("#btnUndoAula");

  const atualizarTelaAula = () => {
    const aulaBloqueadaAtual = bloqDia.some(b => String(b.lesson) === String(aulaAtivaIdx));
    if (aulaBloqueadaAtual) {
      inputEl.disabled = true;
      inputEl.placeholder = "🚫 Esta aula está BLOQUEADA!";
    } else {
      inputEl.disabled = false;
      inputEl.placeholder = "Ex: 1, 2, 3...";
    }

    const listaAtual = atribuicoesPorAula[aulaAtivaIdx] || [];
    badgeContador.textContent = `${listaAtual.length} máquinas`;

    if (aulaBloqueadaAtual) {
      containerTags.innerHTML = `<span class="badge blocked" style="background:#ef4444; color:#fff; font-size:12px; padding:6px 10px;">🔒 Impossível atribuir: Esta aula possui um bloqueio ativo!</span>`;
    } else if (!listaAtual.length) {
      containerTags.innerHTML = `<span class="muted" style="font-size:12px;">Nenhuma máquina atribuída para esta aula específica.</span>`;
    } else {
      containerTags.innerHTML = listaAtual.map(eq => `
        <span class="badge active" style="font-size:12px; padding:4px 8px; display:inline-flex; align-items:center; gap:6px; margin:2px;">
          ${eq} 
          <button type="button" class="btn-sm danger" style="padding:0px 4px; font-size:10px; line-height:1.2;" onclick="window.removerTagAulaAtrib('${eq}')" title="Apagar máquina">🗑️ Apagar</button>
        </span>
      `).join("");
    }
  };

  window.removerTagAulaAtrib = (eq) => {
    const lista = atribuicoesPorAula[aulaAtivaIdx] || [];
    historicoUndoPorAula[aulaAtivaIdx] = { lista: [...lista], removido: eq };
    atribuicoesPorAula[aulaAtivaIdx] = lista.filter(x => x !== eq);
    atualizarTelaAula();
  };

  btnUndo.onclick = () => {
    const undoData = historicoUndoPorAula[aulaAtivaIdx];
    if (!undoData) return alert("Nada para desfazer nesta aula.");
    atribuicoesPorAula[aulaAtivaIdx] = [...undoData.lista];
    historicoUndoPorAula[aulaAtivaIdx] = null;
    atualizarTelaAula();
  };

  m.querySelectorAll(".btn-aula-tab").forEach(btn => {
    btn.onclick = () => {
      aulaAtivaIdx = parseInt(btn.dataset.aula, 10);
      m.querySelectorAll(".btn-aula-tab").forEach(b => {
        b.style.background = "";
        b.style.color = "";
        b.style.borderColor = "";
      });
      btn.style.background = "var(--primary)";
      btn.style.color = "#fff";
      btn.style.borderColor = "var(--primary)";
      atualizarTelaAula();
      if (!inputEl.disabled) inputEl.focus();
    };
  });

  m.querySelectorAll(".btn-cat-filter").forEach(btn => {
    btn.onclick = () => {
      prefixoAtual = btn.dataset.cat;
      m.querySelectorAll(".btn-cat-filter").forEach(b => {
        b.style.background = "";
        b.style.color = "";
        b.style.borderColor = "";
      });
      btn.style.background = "var(--primary)";
      btn.style.color = "#fff";
      btn.style.borderColor = "var(--primary)";
      if (!inputEl.disabled) inputEl.focus();
    };
  });

  inputEl.addEventListener("input", (e) => {
    const aulaBloqueadaAtual = bloqDia.some(b => String(b.lesson) === String(aulaAtivaIdx));
    if (aulaBloqueadaAtual) {
      inputEl.value = "";
      return alert("🚫 Esta aula está bloqueada e não pode receber atribuições.");
    }

    const val = inputEl.value;
    if (val.includes(",")) {
      const pedacos = val.split(",");
      for (let i = 0; i < pedacos.length - 1; i++) {
        let bruto = pedacos[i].trim().toUpperCase();
        if (bruto) {
          if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];
          
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
    const aulaBloqueadaAtual = bloqDia.some(b => String(b.lesson) === String(aulaAtivaIdx));
    if (aulaBloqueadaAtual) {
      e.preventDefault();
      return alert("🚫 Esta aula está bloqueada e não pode receber atribuições.");
    }

    if (e.key === "Enter") {
      e.preventDefault();
      let bruto = inputEl.value.trim().toUpperCase();
      if (bruto) {
        if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];

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

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#btnSaveAssignAula").onclick = async () => {
    for (let lIdx of aulasSelecionadas) {
      const aulaBloq = bloqDia.some(b => String(b.lesson) === String(lIdx));
      const eqsDestaAula = atribuicoesPorAula[lIdx] || [];
      if (aulaBloq && eqsDestaAula.length > 0) {
        return alert(`🚫 ERRO: A aula ${lIdx + 1} está BLOQUEADA! Remova as máquinas dela antes de salvar.`);
      }
    }

    const resto = inputEl.value.trim().toUpperCase();
    if (resto && !bloqDia.some(b => String(b.lesson) === String(aulaAtivaIdx))) {
      let codigoFinal = resto;
      if (!/[A-Z]/.test(resto)) codigoFinal = prefixoAtual + resto;
      if (!atribuicoesPorAula[aulaAtivaIdx]) atribuicoesPorAula[aulaAtivaIdx] = [];
      if (!atribuicoesPorAula[aulaAtivaIdx].includes(codigoFinal)) {
        atribuicoesPorAula[aulaAtivaIdx].push(codigoFinal);
      }
    }

    const qtdTotalFinal = Math.max(
      ...Object.values(atribuicoesPorAula).map(arr => arr.length),
      itemPrincipal.qtdTotalPedida || 1
    );

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
          id: uid(),
          batchId: batchId,
          userId: itemPrincipal.userId,
          userName: itemPrincipal.userName,
          tipoEquipamento: itemPrincipal.tipoEquipamento || "notebook",
          date: itemPrincipal.date,
          lessons: [nomeAulaLabel],
          lessonIndexes: aulasSelecionadas,
          lessonIndex: lIdx,
          segment: itemPrincipal.segment || "6_7",
          equipments: listaEqsAula,
          equipment: listaEqsAula[0],
          qtdTotalPedida: qtdTotalFinal,
          purpose: itemPrincipal.purpose || "outros",
          status: statusAula,
          createdAt: itemPrincipal.createdAt || nowFormatted()
        });
      }

      alert("Atribuições salvas com sucesso!");
      m.remove();
    } catch (err) {
      alert("Erro ao salvar: " + err.message);
    }
  };
}

/* HISTÓRICO DE DEVOLUÇÕES */
function devolucoes() {
  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Histórico de Devoluções</h2>
        <div class="muted">Registro cronológico de entregas e devoluções</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <input id="searchDevol" placeholder="🔍 Pesquisar por professor, equipamento ou data..." class="inp">
    </div>

    <div class="card">
      <div id="devolucoesTableContainer">
        ${renderTabelaDevolucoes()}
      </div>
    </div>`;

  $("searchDevol").addEventListener("input", (e) => {
    const q = e.target.value.trim().toLowerCase();
    $("devolucoesTableContainer").innerHTML = renderTabelaDevolucoes(q);
  });
}

function renderTabelaDevolucoes(query = "") {
  let list = db.devolucoes || [];

  if (query) {
    list = list.filter(d => 
      (d.userName || "").toLowerCase().includes(query) ||
      (d.equipment || "").toLowerCase().includes(query) ||
      (d.dateUse || "").toLowerCase().includes(query) ||
      (d.lesson || "").toLowerCase().includes(query)
    );
  }

  list.sort((a, b) => (b.returnedAt || "").localeCompare(a.returnedAt || ""));

  if (!list.length) return `<p class="muted" style="text-align:center; padding:16px 0;">Nenhum histórico encontrado.</p>`;

  return `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Professor</th>
            <th>Equipamento</th>
            <th>Data de Uso</th>
            <th>Horários</th>
            <th>Data/Hora Devolução</th>
          </tr>
        </thead>
        <tbody>
          ${list.map(d => `
            <tr>
              <td><b>${esc(d.userName)}</b></td>
              <td><span class="badge active">${esc(d.equipment)}</span></td>
              <td>${d.dateUse ? d.dateUse.split('-').reverse().join('/') : "—"}</td>
              <td><small>${esc(d.lesson)}</small></td>
              <td><small>${esc(d.returnedAt)}</small></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>`;
}

/* EDITAR RESERVA */
function modalEditarReserva(batchId) {
  const itens = db.emprestimos.filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return alert("Solicitação não encontrada.");

  let qtdAtual = 1;
  itens.forEach(x => {
    const q = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (q > qtdAtual) qtdAtual = q;
  });

  const itemPrincipal = itens[0];

  const m = modal(`
    <div class="modal-top">
      <h2>✏️ Editar Solicitação</h2>
      <button class="close">&times;</button>
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

      <label class="lbl" style="margin-top:10px;">Quantidade Pedida
        <input id="eQty" type="number" min="1" max="100" value="${qtdAtual}" class="inp" required>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Salvar Alterações</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fEditSol").onsubmit = async e => {
    e.preventDefault();
    const novoTipo = $("eTipo").value;
    const novaData = $("eDate").value;
    const novaQtd = parseInt($("eQty").value, 10);

    try {
      for (let target of itens) {
        await firestore.collection("emprestimos").doc(target.idDoc).update({
          tipoEquipamento: novoTipo,
          date: novaData,
          qtdTotalPedida: novaQtd
        });
      }
      alert("Solicitação atualizada!");
      m.remove();
    } catch (err) {
      alert("Erro ao atualizar: " + err.message);
    }
  };
}

/* DEVOLUÇÃO */
async function devolverLoteComRegistro(batchId) {
  if (!confirm("Confirmar devolução das máquinas com registro em histórico?")) return;

  const itens = db.emprestimos.filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return;
  const dataDevolucao = nowFormatted();

  try {
    for (let target of itens) {
      await firestore.collection("emprestimos").doc(target.idDoc).update({ status: "devolvido" });

      const eqList = target.equipments || (target.equipment ? [target.equipment] : []);
      const validEqs = eqList.filter(x => x && x !== "Pendente");
      const labelAulas = target.lessons ? target.lessons.join(", ") : (target.lesson || "—");

      for (let eq of validEqs) {
        await firestore.collection("devolucoes").add({
          id: uid(),
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
    alert("Equipamentos devolvidos e registrados no histórico!");
  } catch (err) {
    alert("Erro ao devolver: " + err.message);
  }
}

function cancelarLote(batchId) {
  if (confirm("Deseja realmente excluir esta solicitação?")) {
    db.emprestimos
      .filter(x => (x.batchId || x.idDoc || x.id) === batchId)
      .forEach(d => firestore.collection("emprestimos").doc(d.idDoc).delete());
  }
}

/* CALENDÁRIO */
function calendario() {
  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Calendário de Reservas</h2>
        <div class="muted">Visualização mensal com régua de ocupação</div>
      </div>
      <div class="action-bar" style="display:flex; gap:8px; align-items:center;">
        <button class="btn-secondary btn-sm" onclick="mudarMes(-1)">&lt; Anterior</button>
        <b id="calMonthTitle" style="font-size:14px; white-space:nowrap;"></b>
        <button class="btn-secondary btn-sm" onclick="mudarMes(1)">Próximo &gt;</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 12px; padding: 12px;">
      <h3 style="margin-bottom: 8px; font-size: 12px;">📊 Legenda da Régua por Aula</h3>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        ${TABELAS_HORARIOS["6_7"].map((aula, idx) => `
          <div style="background: rgba(255,255,255,0.05); padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border); font-size: 10px;">
            <b>${aula.label}:</b> ${aula.start}–${aula.end}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="padding: 10px;">
      <div class="cal-grid-wrapper">
        <div class="cal-grid" style="text-align:center; font-weight:bold; font-size:11px; margin-bottom:6px; color:var(--text-muted);">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div id="monthGrid" class="cal-grid"></div>
      </div>
    </div>`;

  renderMonthGrid();
}

function mudarMes(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  else if (calMonth > 11) { calMonth = 0; calYear++; }
  renderMonthGrid();
}

function renderMonthGrid() {
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  if ($("calMonthTitle")) $("calMonthTitle").textContent = `${meses[calMonth]} / ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay();
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();

  let html = "";
  for (let i = 0; i < firstDay; i++) {
    html += `<div style="min-height:75px; background:rgba(255,255,255,0.01); border-radius:8px;"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isPast = isPastDate(dateStr);
    const isWk = isWeekend(dateStr);
    const bloqDia = db.bloqueios.filter(b => b.date === dateStr);
    const temBloqueioTotal = bloqDia.some(b => b.lesson === "all");
    const emprestimosDia = db.emprestimos.filter(r => r.date === dateStr && r.status !== "cancelado");

    const ocupacaoPorAula = [0, 0, 0, 0, 0, 0, 0];
    const lotesPorAula = Array.from({ length: 7 }, () => new Map());

    emprestimosDia.forEach(emp => {
      const bid = emp.batchId || emp.idDoc || emp.id;
      const qtdDoc = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 1);

      for (let idx = 0; idx < 7; idx++) {
        const temAula = (emp.lessonIndexes && emp.lessonIndexes.includes(idx)) || (emp.lessonIndex === idx);
        if (temAula) {
          lotesPorAula[idx].set(bid, qtdDoc);
        }
      }
    });

    for (let idx = 0; idx < 7; idx++) {
      let soma = 0;
      lotesPorAula[idx].forEach(q => soma += q);
      ocupacaoPorAula[idx] = soma;
    }

    let totalMaquinasUnicas = 0;
    const mapaLotesDia = new Map();
    emprestimosDia.forEach(emp => {
      const bid = emp.batchId || emp.idDoc || emp.id;
      const qtdDoc = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 1);
      mapaLotesDia.set(bid, qtdDoc);
    });
    mapaLotesDia.forEach(q => totalMaquinasUnicas += q);

    let extraStyle = "";
    if (isPast || isWk) extraStyle = "opacity:0.3; cursor:not-allowed; background:rgba(0,0,0,0.2);";
    else if (temBloqueioTotal) extraStyle = "border:1px solid #ef4444; background:rgba(239,68,68,0.12);";

    html += `
      <div class="cal-day-cell" style="${extraStyle}" onclick="clickCalDay('${dateStr}', ${!isPast && !isWk})">
        <div class="cal-day-header">
          <b>${d}</b>
          ${temBloqueioTotal ? `<span class="badge blocked" style="background:#ef4444; color:#fff;">Bloq.</span>` : (totalMaquinasUnicas > 0 ? `<span class="badge active" style="background:#3b82f6; color:#ffffff; font-weight:bold;">${totalMaquinasUnicas}m</span>` : '')}
        </div>

        ${!isPast && !isWk ? `
          <div class="cal-ruler" style="display:flex; gap:2px; margin-top:6px; background:rgba(0,0,0,0.4); padding:3px; border-radius:4px;">
            ${ocupacaoPorAula.map((qtd, idx) => {
              const aulaBloqueada = bloqDia.some(b => String(b.lesson) === String(idx));
              let color = "rgba(255,255,255,0.08)";
              let textColor = "#ffffff";
              if (aulaBloqueada || temBloqueioTotal) {
                color = "#ef4444";
              } else if (qtd > 0 && qtd <= 30) {
                color = "#38bdf8";
                textColor = "#0f172a";
              } else if (qtd > 30 && qtd <= 70) {
                color = "#f59e0b";
                textColor = "#0f172a";
              } else if (qtd > 70) {
                color = "#ef4444";
              }

              return `
                <div class="cal-ruler-slot" style="flex:1; height:18px; border-radius:2px; background:${color}; display:flex; align-items:center; justify-content:center; font-size:9px; font-weight:bold; color:${textColor};" title="${aulaBloqueada || temBloqueioTotal ? `Aula ${idx+1} Bloqueada` : `${idx+1}ª Aula: ${qtd} máquinas`}">
                  ${aulaBloqueada || temBloqueioTotal ? '🔒' : (qtd > 0 ? qtd : '')}
                </div>
              `;
            }).join("")}
          </div>
        ` : ''}
      </div>`;
  }
  if ($("monthGrid")) $("monthGrid").innerHTML = html;
}

function clickCalDay(dateStr, ok) {
  if (!ok) return;
  const bloqDia = db.bloqueios.filter(b => b.date === dateStr);
  if (bloqDia.some(b => b.lesson === "all") && user.role !== "admin") {
    return alert(`🚫 ERRO: Esta data (${dateStr.split('-').reverse().join('/')}) está BLOQUEADA.`);
  }

  const empDia = db.emprestimos.filter(r => r.date === dateStr && r.status !== "cancelado");
  if (empDia.length > 0) modalResumoProfessoresDia(dateStr);
  else modalReserva(dateStr);
}

function modalResumoProfessoresDia(dateStr) {
  const dataFormatada = dateStr.split('-').reverse().join('/');
  const emprestimosDia = db.emprestimos.filter(r => r.date === dateStr && r.status !== "cancelado");

  const lotesAgrupados = {};
  emprestimosDia.forEach(emp => {
    const bid = emp.batchId || emp.idDoc || emp.id;
    if (!lotesAgrupados[bid]) {
      lotesAgrupados[bid] = {
        batchId: bid,
        userName: emp.userName || "Não identificado",
        tipoEquipamento: emp.tipoEquipamento || "notebook",
        segment: emp.segment === "8_9" ? "8º/9º Ano" : "6º/7º Ano",
        purposeLabel: FINALIDADES.find(f => f.id === emp.purpose)?.label || emp.purpose || "Outros",
        aulasSlots: [],
        equipamentos: new Set(),
        qtdTotalPedida: 0
      };
    }

    const qtdNoDoc = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 0);
    if (qtdNoDoc > lotesAgrupados[bid].qtdTotalPedida) {
      lotesAgrupados[bid].qtdTotalPedida = qtdNoDoc;
    }

    if (emp.equipments && Array.isArray(emp.equipments)) emp.equipments.forEach(e => lotesAgrupados[bid].equipamentos.add(e));
    else if (emp.equipment) lotesAgrupados[bid].equipamentos.add(emp.equipment);

    const tabelaUsada = TABELAS_HORARIOS[emp.segment || "6_7"] || TABELAS_HORARIOS["6_7"];

    if (emp.lessonIndexes && Array.isArray(emp.lessonIndexes)) {
      emp.lessonIndexes.forEach(idx => {
        const slot = tabelaUsada[idx];
        if (slot) lotesAgrupados[bid].aulasSlots.push(`${slot.label} (${slot.start}–${slot.end})`);
      });
    } else if (emp.lessons && Array.isArray(emp.lessons)) {
      emp.lessons.forEach(l => lotesAgrupados[bid].aulasSlots.push(l));
    } else if (emp.lesson) {
      lotesAgrupados[bid].aulasSlots.push(emp.lesson);
    }
  });

  const listaLotes = Object.values(lotesAgrupados);
  let totalMaquinasDia = 0;
  listaLotes.forEach(l => totalMaquinasDia += (l.qtdTotalPedida || 1));

  const m = modal(`
    <div class="modal-top">
      <h2 style="display:flex; align-items:center; gap:8px;">
        <span>📅</span> Agendamentos do Dia ${dataFormatada}
      </h2>
      <button class="close">&times;</button>
    </div>

    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; gap:8px;">
      <span style="color:#6366f1; font-weight:bold; font-size:14px;">
        Total de máquinas reservadas: <b style="color:#4f46e5;">${totalMaquinasDia} máquina(s)</b>
      </span>
      <button class="btn-primary" id="btnNovaSolDia" style="padding:8px 16px;">+ Agendar Nesta Data</button>
    </div>

    <div class="table-container" style="max-height:380px; overflow-y:auto; border:1px solid rgba(255,255,255,0.08); border-radius:12px;">
      <table style="width:100%; border-collapse:collapse; font-size:13px;">
        <thead>
          <tr style="border-bottom:1px solid rgba(255,255,255,0.1); text-align:left; color:var(--text-muted);">
            <th style="padding:10px;">Professor Solicitante</th>
            <th style="padding:10px;">Tipo</th>
            <th style="padding:10px;">Segmento</th>
            <th style="padding:10px;">Atividade / Matéria</th>
            <th style="padding:10px;">Horários Reservados</th>
            <th style="padding:10px;">Qtd. Máquinas</th>
            <th style="padding:10px;">Ação</th>
          </tr>
        </thead>
        <tbody>
          ${listaLotes.map(lote => {
            const listaAulasUnicas = Array.from(new Set(lote.aulasSlots));
            const validEqs = Array.from(lote.equipamentos).filter(x => x && x !== "Pendente");
            const qtdPedidaReal = lote.qtdTotalPedida || 1;
            const tipoLabel = lote.tipoEquipamento === "tablet" ? "📱 Tablet" : "💻 Notebook";
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px 10px;">
                  <b>👤 ${esc(lote.userName)}</b>
                </td>
                <td style="padding:12px 10px;">
                  <span class="badge" style="background:rgba(59,130,246,0.1); color:#38bdf8;">${tipoLabel}</span>
                </td>
                <td style="padding:12px 10px;">
                  <b>${esc(lote.segment)}</b>
                </td>
                <td style="padding:12px 10px;">
                  📌 ${esc(lote.purposeLabel)}
                </td>
                <td style="padding:12px 10px;">
                  <div style="display:flex; flex-direction:column; gap:4px;">
                    ${listaAulasUnicas.map(a => `
                      <span class="badge active" style="font-size:11px; padding:4px 8px; font-weight:normal; text-align:center;">
                        ${esc(a)}
                      </span>
                    `).join("")}
                  </div>
                </td>
                <td style="padding:12px 10px;">
                  <b>${validEqs.length} /${qtdPedidaReal} máq.</b>
                </td>
                <td style="padding:12px 10px;">
                  <button class="btn-sm" style="background:var(--primary); color:#fff; font-weight:bold;" onclick="modalAtribuirPorAula('${lote.batchId}')">💻 Atribuir Máquinas</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#btnNovaSolDia").onclick = () => {
    const bloqDia = db.bloqueios.filter(b => b.date === dateStr);
    if (bloqDia.some(b => b.lesson === "all") && user.role !== "admin") {
      return alert("Esta data possui bloqueio de dia inteiro.");
    }
    m.remove();
    modalReserva(dateStr);
  };
}

/* TUTORIAL */
function tutorial() {
  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>📖 Tutorial do Sistema</h2>
        <div class="muted">Guia completo com todas as funções e recursos</div>
      </div>
    </div>

    <div class="card" style="display:flex; flex-direction:column; gap:16px;">
      <div style="background:rgba(59, 130, 246, 0.08); padding:14px; border-radius:10px; border:1px solid rgba(59, 130, 246, 0.2);">
        <h3 style="margin-bottom:6px; color:#38bdf8;">1. Atribuição sem Limite</h3>
        <p style="font-size:13px; color:var(--text-muted);">
          No modal de atribuição, utilize a caixa de seleção para liberar a quantidade de máquinas de forma livre.
        </p>
      </div>
    </div>`;
}

/* BLOQUEIOS */
function bloqueios() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Bloqueios</h2><div class="muted">Gerenciar bloqueios por dia ou por aula</div></div>
      <button class="btn-primary" onclick="modalBloqueio()">+ Novo Bloqueio</button>
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead><tr><th>Data</th><th>Escopo do Bloqueio</th><th>Motivo</th><th>Ação</th></tr></thead>
          <tbody>
            ${db.bloqueios.map(b => `
              <tr>
                <td><b>${b.date.split('-').reverse().join('/')}</b></td>
                <td><span class="badge blocked">${b.lesson === "all" ? "🔒 Dia Inteiro" : `🔒 ${parseInt(b.lesson)+1}ª Aula`}</span></td>
                <td>${esc(b.reason)}</td>
                <td><button class="btn-sm danger" onclick="delBlock('${b.idDoc}')">Remover</button></td>
              </tr>
            `).join("") || "<tr><td colspan=4 class='muted' style='text-align:center;'>Nenhum bloqueio registrado.</td></tr>"}
          </tbody>
        </table>
      </div>
    </div>`;
}

function modalBloqueio() {
  const m = modal(`
    <div class="modal-top"><h2>Novo Bloqueio</h2><button class="close">&times;</button></div>
    <form id="fBlk">
      <label class="lbl">Data do Bloqueio
        <input id="bd" type="date" class="inp" min="${new Date().toISOString().split("T")[0]}" required>
      </label>

      <label class="lbl" style="margin-top:10px;"><b>Selecione o Escopo:</b></label>
      <label class="check-aula-card" style="margin-bottom:8px;">
        <input type="checkbox" id="blkAllDay" value="all">
        <b>🔒 Bloquear Dia Inteiro</b>
      </label>

      <div id="blkLessonsList" class="filter-grid" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));">
        ${TABELAS_HORARIOS["6_7"].map((a, i) => `
          <label class="check-aula-card">
            <input type="checkbox" name="blkLesson" value="${i}"> 
            <span>${a.label}</span>
          </label>
        `).join("")}
      </div>

      <label class="lbl" style="margin-top:10px;">Motivo
        <input id="br" class="inp" placeholder="Ex: Prova / Reunião Geral" required>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Salvar Bloqueio</button>
    </form>
  `);

  const allDayCb = m.querySelector("#blkAllDay");
  const lessonCbs = m.querySelectorAll('input[name="blkLesson"]');

  allDayCb.onchange = () => {
    lessonCbs.forEach(cb => {
      cb.disabled = allDayCb.checked;
      if (allDayCb.checked) cb.checked = false;
    });
  };

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fBlk").onsubmit = async e => {
    e.preventDefault();
    const d = $("bd").value;
    const reason = $("br").value.trim();

    if (allDayCb.checked) {
      await firestore.collection("bloqueios").add({ id: uid(), date: d, lesson: "all", reason });
    } else {
      const selected = Array.from(m.querySelectorAll('input[name="blkLesson"]:checked')).map(cb => cb.value);
      if (!selected.length) return alert("Selecione pelo menos uma aula ou marque Dia Inteiro.");

      for (let l of selected) {
        await firestore.collection("bloqueios").add({ id: uid(), date: d, lesson: l, reason });
      }
    }

    alert("Bloqueio gravado!");
    m.remove();
  };
}

function delBlock(idDoc) {
  if (confirm("Remover este bloqueio?")) {
    firestore.collection("bloqueios").doc(idDoc).delete();
  }
}

/* AVARIAS */
function avarias() {
  $("main").innerHTML = `
    <div class="head">
      <div><h2>Central de Avarias</h2><div class="muted">Relatórios de manutenção com fotos</div></div>
      <button class="btn-primary" onclick="modalReportDefeito()">+ Reportar Defeito</button>
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
            ${(db.reports || []).map(r => `
              <tr>
                <td><b>[${esc(r.model)}] Nº ${esc(r.number)}</b></td>
                <td>${esc(r.description)}</td>
                <td>
                  ${r.imageUrl ? `<button class="btn-sm" onclick="window.open('${esc(r.imageUrl)}', '_blank')">🖼️ Ver Foto</button>` : '<span class="muted">Sem foto</span>'}
                </td>
                <td>${esc(r.reporterName)}</td>
                <td><span class="badge ${r.status === 'pendente' ? 'danger' : 'muted'}">${esc(r.status)}</span></td>
                <td>
                  <div style="display:flex; gap:4px;">
                    ${user.role === "admin" ? `<button class="btn-sm" onclick="modalResponderReport('${r.idDoc}')">💬 Parecer</button>` : ''}
                    ${user.role === "admin" ? `<button class="btn-sm danger" onclick="apagarReportAvaria('${r.idDoc}')">🗑️ Apagar</button>` : ''}
                  </div>
                </td>
              </tr>
            `).join("") || "<tr><td colspan=6 class='muted' style='text-align:center;'>Nenhum registro.</td></tr>"}
          </tbody>
        </table>
      </div>
    </div>`;
}

function apagarReportAvaria(idDoc) {
  if (user.role !== "admin") return alert("Apenas administradores podem apagar chamados.");
  if (confirm("Apagar este chamado permanentemente?")) {
    firestore.collection("reports").doc(idDoc).delete();
  }
}

function modalReportDefeito() {
  const m = modal(`
    <div class="modal-top"><h2>Reportar Defeito</h2><button class="close">&times;</button></div>
    <form id="fReportDef">
      <div class="filter-grid">
        <label class="lbl">Modelo
          <select id="repModel" class="inp" required>
            ${MODELOS_EQUIPAMENTO.map(m => `<option value="${m.id}">${m.label}</option>`).join("")}
          </select>
        </label>
        <label class="lbl">Número / ID
          <input id="repNum" class="inp" placeholder="Ex: SA3, M12" required>
        </label>
      </div>

      <label class="lbl" style="margin-top:10px;">Link da Imagem / Foto do Defeito (Opcional)
        <input id="repImgUrl" class="inp" placeholder="https://exemplo.com/foto.jpg">
      </label>

      <label class="lbl" style="margin-top:10px;">Descrição do Problema
        <textarea id="repDesc" class="inp" rows="3" placeholder="Descreva o problema..." required></textarea>
      </label>
      <button type="submit" class="btn-primary" style="margin-top:14px; width:100%;">Enviar Relato</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fReportDef").onsubmit = async e => {
    e.preventDefault();
    await firestore.collection("reports").add({
      id: uid(),
      reporterId: user.id,
      reporterName: user.name,
      model: $("repModel").value,
      number: $("repNum").value.trim(),
      imageUrl: $("repImgUrl").value.trim(),
      description: $("repDesc").value.trim(),
      status: "pendente",
      createdAt: nowFormatted()
    });
    m.remove();
  };
}

function modalResponderReport(idDoc) {
  const r = db.reports.find(x => x.idDoc === idDoc);
  if (!r) return;

  const m = modal(`
    <div class="modal-top"><h2>Parecer Técnico</h2><button class="close">&times;</button></div>
    <form id="fRepResp">
      <p><b>Avaria:</b> ${esc(r.description)}</p>
      <label class="lbl" style="margin-top:10px;">Comentário
        <textarea id="admComm" class="inp" rows="3" required>${esc(r.adminComment || '')}</textarea>
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
      adminComment: $("admComm").value.trim(),
      status: $("admStatus").value
    });
    m.remove();
  };
}

/* USUÁRIOS */
function usuarios() {
  const isAdm = user && user.role === "admin";

  $("main").innerHTML = `
    <div class="head">
      <div><h2>Usuários</h2><div class="muted">Cadastro e controle de acessos</div></div>
      ${isAdm ? `<button class="btn-primary" onclick="modalUser()">+ Novo Usuário</button>` : ''}
    </div>
    <div class="card">
      <div class="table-container">
        <table>
          <thead>
            <tr>
              <th>Nome Completo</th>
              <th>Login</th>
              <th>Senha</th>
              <th>Perfil</th>
              ${isAdm ? `<th>Ações</th>` : ''}
            </tr>
          </thead>
          <tbody>
            ${db.users.map(u => `
              <tr>
                <td><b>${esc(u.name)}</b></td>
                <td><code>${esc(u.userLogin || u.name)}</code></td>
                <td><code>${esc(u.pass || "****")}</code></td>
                <td><span class="badge ${u.role === 'admin' ? 'active' : ''}">${u.role === "admin" ? "Admin" : "Professor"}</span></td>
                ${isAdm ? `
                  <td>
                    <div style="display:flex; gap:4px;">
                      <button class="btn-sm" onclick="modalEditarUsuarioAdm('${u.idDoc}')">✏️ Editar</button>
                      ${u.id !== "adm" ? `<button class="btn-sm danger" onclick="delUser('${u.idDoc}')">🗑️</button>` : ''}
                    </div>
                  </td>
                ` : ''}
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>`;
}

function modalUser() {
  const m = modal(`
    <div class="modal-top"><h2>Novo Usuário</h2><button class="close">&times;</button></div>
    <form id="fUser">
      <label class="lbl">Nome<input id="un" class="inp" required></label>
      <label class="lbl" style="margin-top:8px;">Login<input id="ul" class="inp" required></label>
      <label class="lbl" style="margin-top:8px;">Senha (4 números)<input id="up" type="password" maxlength="4" pattern="\\d{4}" class="inp" required></label>
      <label class="lbl" style="margin-top:8px;">Perfil
        <select id="ur" class="inp">
          <option value="professor">Professor</option>
          <option value="admin">Administrador</option>
        </select>
      </label>
      <button type="submit" class="btn-primary" style="margin-top:14px; width:100%;">Cadastrar</button>
    </form>
  `);
  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fUser").onsubmit = async e => {
    e.preventDefault();
    const pass = $("up").value.trim();
    if (pass.length !== 4 || isNaN(pass)) return alert("A senha deve conter 4 números.");

    await firestore.collection("users").add({
      id: uid(),
      name: $("un").value.trim(),
      userLogin: $("ul").value.trim().toLowerCase(),
      pass: pass,
      role: $("ur").value
    });
    m.remove();
  };
}

function modalEditarUsuarioAdm(idDoc) {
  const targetUser = db.users.find(u => u.idDoc === idDoc);
  if (!targetUser) return alert("Usuário não encontrado.");

  const m = modal(`
    <div class="modal-top">
      <h2>✏️ Editar Usuário</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fEditUserAdm">
      <label class="lbl">Nome Completo
        <input id="eUn" class="inp" value="${esc(targetUser.name)}" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Login de Acesso
        <input id="eUl" class="inp" value="${esc(targetUser.userLogin || targetUser.name)}" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Senha (4 números)
        <div style="display:flex; gap:4px;">
          <input id="eUp" type="password" maxlength="4" pattern="\\d{4}" class="inp" value="${esc(targetUser.pass || '')}" required>
          <button type="button" id="btnToggleUserPass" class="btn-secondary">👁️ Ver</button>
        </div>
      </label>

      <label class="lbl" style="margin-top:10px;">Perfil
        <select id="eUr" class="inp">
          <option value="professor" ${targetUser.role === 'professor' ? 'selected' : ''}>Professor</option>
          <option value="admin" ${targetUser.role === 'admin' ? 'selected' : ''}>Administrador</option>
        </select>
      </label>

      <div style="margin-top:16px; display:flex; gap:6px;">
        <button type="submit" class="btn-primary" style="flex:1;">Salvar Alterações</button>
        <button type="button" class="btn-secondary close-btn" style="flex:1;">Cancelar</button>
      </div>
    </form>
  `);

  const passInp = m.querySelector("#eUp");
  const toggleBtn = m.querySelector("#btnToggleUserPass");

  toggleBtn.onclick = () => {
    if (passInp.type === "password") {
      passInp.type = "text";
      toggleBtn.textContent = "🙈 Ocultar";
    } else {
      passInp.type = "password";
      toggleBtn.textContent = "👁️ Ver";
    }
  };

  m.querySelectorAll(".close, .close-btn").forEach(b => b.onclick = () => m.remove());

  m.querySelector("#fEditUserAdm").onsubmit = async e => {
    e.preventDefault();
    const pass = $("eUp").value.trim();
    if (pass.length !== 4 || isNaN(pass)) return alert("A senha deve conter 4 números.");

    await firestore.collection("users").doc(idDoc).update({
      name: $("eUn").value.trim(),
      userLogin: $("eUl").value.trim().toLowerCase(),
      pass: pass,
      role: $("eUr").value
    });
    alert("Usuário atualizado!");
    m.remove();
  };
}

function delUser(idDoc) {
  if (confirm("Excluir usuário?")) firestore.collection("users").doc(idDoc).delete();
}

function modalPWAInstalacao() {
  const m = modal(`
    <div class="modal-top">
      <h2>📲 Como Criar Atalho na Tela Inicial</h2>
      <button class="close">&times;</button>
    </div>

    <div style="display:flex; flex-direction:column; gap:14px; font-size:13px; max-height:380px; overflow-y:auto; padding-right:4px;">
      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid var(--border);">
        <b style="color:#38bdf8;">🤖 Android (Chrome)</b>
        <p style="margin-top:4px; color:var(--text-muted);">1. Clique nos 3 pontinhos (⋮) no canto superior direito.<br>2. Toque em <b>"Adicionar à tela inicial"</b> ou <b>"Instalar aplicativo"</b>.</p>
      </div>

      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid var(--border);">
        <b style="color:#f43f5e;">🍎 iPhone / iPad (Safari)</b>
        <p style="margin-top:4px; color:var(--text-muted);">1. Toque no ícone de <b>Compartilhar</b> (quadrado com seta para cima na barra inferior).<br>2. Role para baixo e toque em <b>"Adicionar à Tela de Início"</b>.</p>
      </div>

      <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid var(--border);">
        <b style="color:#10b981;">💻 Computador / Chromebook (Chrome / Edge)</b>
        <p style="margin-top:4px; color:var(--text-muted);">1. Clique no ícone de tela/instalação ao lado da barra de endereço URL.<br>2. Ou vá em Menu (⋮) &gt; <b>Mais ferramentas</b> &gt; <b>Criar atalho...</b></p>
      </div>
    </div>

    <button class="btn-primary close-btn" style="margin-top:16px; width:100%;">Entendi</button>
  `);

  m.querySelectorAll(".close, .close-btn").forEach(b => b.onclick = () => m.remove());
}

/* CRIAR NOVA SOLICITAÇÃO */
function modalReserva(defaultDate = "") {
  const hoje = defaultDate || new Date().toISOString().split("T")[0];

  const m = modal(`
    <div class="modal-top">
      <h2>Nova Solicitação</h2>
      <button class="close">&times;</button>
    </div>
    <form id="fSolNew">
      <div class="filter-grid">
        <label class="lbl">Tipo de Equipamento
          <select id="rsTipo" class="inp">
            <option value="notebook">💻 Notebook (153 disp.)</option>
            <option value="tablet">📱 Tablet (23 disp.)</option>
          </select>
        </label>
        <label class="lbl">Data de Uso
          <input id="rsDate" type="date" value="${hoje}" min="${new Date().toISOString().split("T")[0]}" class="inp" required>
        </label>
        <label class="lbl">Segmento
          <select id="rsSeg" class="inp">
            <option value="6_7">6º e 7º Anos</option>
            <option value="8_9">8º e 9º Anos</option>
          </select>
        </label>
        <label class="lbl">Quantidade de Máquinas
          <input id="rsQty" type="number" min="1" max="100" value="1" class="inp" required>
        </label>
        <label class="lbl">Atividade
          <select id="rsPurpose" class="inp">
            ${FINALIDADES.map(f => `<option value="${f.id}">${f.label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div style="margin-top:14px;">
        <label class="lbl"><b>Selecione as Aulas:</b></label>
        <div id="lessonsCheckboxes" class="filter-grid" style="grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));">
          ${TABELAS_HORARIOS["6_7"].map((a, i) => `
            <label class="check-aula-card">
              <input type="checkbox" name="solLesson" value="${i}"> 
              <div>
                <b>${a.label}</b>
                <span style="font-size:10px; color:var(--text-muted);">${a.start} às ${a.end}</span>
              </div>
            </label>
          `).join("")}
        </div>
      </div>

      <button type="submit" class="btn-primary" style="margin-top:18px; width:100%;">Confirmar Solicitação</button>
    </form>
  `);

  m.querySelector("#rsSeg").onchange = (e) => {
    const segKey = e.target.value;
    const listaAulas = TABELAS_HORARIOS[segKey] || TABELAS_HORARIOS["6_7"];
    m.querySelector("#lessonsCheckboxes").innerHTML = listaAulas.map((a, i) => `
      <label class="check-aula-card">
        <input type="checkbox" name="solLesson" value="${i}"> 
        <div>
          <b>${a.label}</b>
          <span style="font-size:10px; color:var(--text-muted);">${a.start} às ${a.end}</span>
        </div>
      </label>
    `).join("");
  };

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#fSolNew").onsubmit = async e => {
    e.preventDefault();
    const tipoEq = $("rsTipo").value;
    const d = $("rsDate").value;
    const seg = $("rsSeg").value;
    const qty = parseInt($("rsQty").value, 10);
    const purp = $("rsPurpose").value;
    const selectedLessons = Array.from(m.querySelectorAll('input[name="solLesson"]:checked')).map(cb => parseInt(cb.value, 10));

    const bloqDia = db.bloqueios.filter(b => b.date === d);
    
    if (bloqDia.some(b => b.lesson === "all") && user.role !== "admin") {
      return alert("🚫 ERRO: Esta data possui um bloqueio de DIA INTEIRO registrado.");
    }

    if (user.role !== "admin") {
      const aulasBloqueadasNoDia = bloqDia.map(b => String(b.lesson));
      const conflitoAula = selectedLessons.some(lIdx => aulasBloqueadasNoDia.includes(String(lIdx)));
      if (conflitoAula) {
        return alert("🚫 ERRO: Uma ou mais aulas que você selecionou estão BLOQUEADAS nesta data.");
      }
    }

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) return alert("Data indisponível para solicitações.");
    if (!selectedLessons.length) return alert("Selecione pelo menos uma aula.");

    const batchId = uid();
    const horaCriacao = nowFormatted();
    const tabelaUsada = TABELAS_HORARIOS[seg] || TABELAS_HORARIOS["6_7"];

    try {
      for (let lIdx of selectedLessons) {
        const slot = tabelaUsada[lIdx];
        const nomeAula = slot ? slot.label : `Aula ${lIdx + 1}`;

        await firestore.collection("emprestimos").add({
          id: uid(),
          batchId: batchId,
          userId: user.id || user.idDoc,
          userName: user.name,
          tipoEquipamento: tipoEq,
          date: d,
          lessons: [nomeAula],
          lessonIndexes: selectedLessons,
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
      m.remove();
      nav("solicitacoes");
    } catch (err) {
      alert("Erro ao criar solicitação: " + err.message);
    }
  };
}

function modal(html) {
  const m = document.createElement("div");
  m.className = "modal";
  m.innerHTML = `<div class="modal-box">${html}</div>`;
  document.body.appendChild(m);
  return m;
}