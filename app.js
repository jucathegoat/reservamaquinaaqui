if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) registration.unregister();
  });
}
if ('caches' in window) {
  caches.keys().then(names => {
    for (let name of names) caches.delete(name);
  });
}

const firebaseConfig = {
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

const SESSION_KEY = "controle_sessao_proati_v35";
const USER_CACHE_KEY = "controle_user_data_v35";

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
  { id: "programacao", label: "Programação" },
  { id: "speak", label: "Speak (Inglês)" },
  { id: "matific", label: "Matific (Matemática)" },
  { id: "sem_plataforma", label: "Sem Plataforma" },
  { id: "outros", label: "Outros" }
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
  ["calendario", "Calendário"],
  ["solicitacoes", "Solicitações & Reservas"],
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
    if (user && typeof window[currentPage] === 'function') {
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

const isPastDate = d => d < new Date().toISOString().split("T")[0];
const isWeekend = d => [0, 6].includes(new Date(d + "T00:00:00").getDay());
const isHoliday = d => FERIADOS_FIXOS.includes(d.slice(5));

function verificarSessaoSalva() {
  const savedDocId = localStorage.getItem(SESSION_KEY);
  const cachedUserData = localStorage.getItem(USER_CACHE_KEY);

  if (cachedUserData) {
    try {
      const u = JSON.parse(cachedUserData);
      if (u && u.name) iniciarSessao(u);
    } catch (e) {}
  }

  if (savedDocId) {
    firestore.collection("users").doc(savedDocId).get().then(doc => {
      if (doc.exists) iniciarSessao({ idDoc: doc.id, ...doc.data() });
    }).catch(() => {});
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", verificarSessaoSalva);
} else {
  verificarSessaoSalva();
}

function iniciarSessao(u) {
  user = u;
  if (u.idDoc) {
    localStorage.setItem(SESSION_KEY, u.idDoc);
    localStorage.setItem(USER_CACHE_KEY, JSON.stringify(u));
  }
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
  localStorage.removeItem(USER_CACHE_KEY);
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
      localStorage.setItem(USER_CACHE_KEY, JSON.stringify(user));

      alert("Perfil atualizado!");
      m.remove();
      iniciarSessao(user);
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

  const pctNote = Math.min(100, Math.round((noteHoje / 146) * 100));
  const pctTab = Math.min(100, Math.round((tabHoje / 11) * 100));

  const renderPieSVG = (pct) => `
    <svg width="48" height="48" viewBox="0 0 32 32" style="transform: rotate(-90deg);">
      <circle cx="16" cy="16" r="14" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="4" />
      <circle cx="16" cy="16" r="14" fill="none" stroke="#f8fafc" stroke-width="4" stroke-dasharray="${pct} 100" pathLength="100" />
    </svg>`;

  $("main").innerHTML = `
    <div class="head">
      <div>
        <h2>reservamaquinaaqui</h2>
        <div class="muted">Escola Maria Olímpia · Total: 157 equipamentos</div>
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
          <b style="font-size:20px;">${noteHoje} / 146</b>
          <div style="font-size:11px; color:var(--text-muted);">${pctNote}% ocupado</div>
        </div>
        ${renderPieSVG(pctNote)}
      </div>

      <div class="card" style="display:flex; justify-content:space-between; align-items:center;">
        <div>
          <div class="muted">Tablets Hoje</div>
          <b style="font-size:20px;">${tabHoje} / 11</b>
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
        <button class="btn-secondary" id="btnFiltrarAulaAtual">⏰ Aula Atual (Automática)</button>
        <button class="btn-primary" onclick="exportarRelatorioCSV()">📊 Relatório Mensal (.CSV)</button>
        <button class="btn-primary" onclick="modalReserva()">+ Nova Solicitação</button>
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
    const hojeStr = new Date().toISOString().split("T")[0];
    $("filterData").value = hojeStr;
    trigger();
  };

  $("btnFiltrarAulaAtual").onclick = () => {
    const hojeStr = new Date().toISOString().split("T")[0];
    const idxAula = obterIndiceAulaAtual();
    $("filterData").value = hojeStr;
    trigger(idxAula);
  };
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
    else if (x.lesson) groups[bid].lessons.add(x.lesson);

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipments.add(x.equipment);
  });

  let csvContent = "data:text/csv;charset=utf-8,Professor;Data;Horarios;QtdPedida;QtdAtribuida;Equipamentos;Status\n";

  Object.values(groups).forEach(g => {
    const eqArray = Array.from(g.equipments).filter(e => e && e !== "Pendente");
    const listaOrdenada = ordenarEquipamentos(eqArray);
    const prof = `"${(g.userName || "").replace(/"/g, '""')}"`;
    const data = g.date ? g.date.split('-').reverse().join('/') : "—";
    const horarios = `"${Array.from(g.lessons).join(", ").replace(/"/g, '""')}"`;
    const qtdPedida = g.qtdTotalPedida || 1;
    const qtdAtribuida = listaOrdenada.length;
    const equipamentos = `"${listaOrdenada.join(", ").replace(/"/g, '""')}"`;
    const status = g.status;

    csvContent += `${prof};${data};${horarios};${qtdPedida};${qtdAtribuida};${equipamentos};${status}\n`;
  });

  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `relatorio_solicitacoes_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
        purpose: x.purpose || "outros",
        lessons: new Set(),
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

    if (x.lessons && Array.isArray(x.lessons)) x.lessons.forEach(l => groups[bid].lessons.add(l));
    else if (x.lesson) groups[bid].lessons.add(x.lesson);

    if (x.lessonIndexes && Array.isArray(x.lessonIndexes)) x.lessonIndexes.forEach(idx => groups[bid].lessonIndexes.add(idx));
    else if (x.lessonIndex !== undefined) groups[bid].lessonIndexes.add(x.lessonIndex);

    if (x.equipments && Array.isArray(x.equipments)) x.equipments.forEach(e => groups[bid].equipments.add(e));
    else if (x.equipment) groups[bid].equipments.add(x.equipment);
  });

  let list = Object.values(groups).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  if (filterProf !== "todos") list = list.filter(g => g.userName === filterProf);
  if (filterData) list = list.filter(g => g.date === filterData);
  if (filterAulaIdx !== null) list = list.filter(g => g.lessonIndexes.has(filterAulaIdx));

  if (filterStatus !== "todos") {
    list = list.filter(g => g.status === filterStatus);
  }

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
            <th>Professor</th>
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

            const podeEditar = user.role === "admin" || user.id === g.userId || user.idDoc === g.userId;

            return `
              <tr>
                <td><b>${esc(g.userName)}</b></td>
                <td>${g.date ? g.date.split('-').reverse().join('/') : "—"}</td>
                <td><small>${Array.from(g.lessons).join(", ")}</small></td>
                <td>
                  <b>${qtdAtribuida} / ${qtdTotal} máq.</b>
                  ${qtdAtribuida < qtdTotal ? `<small style="color:#f59e0b; display:block;">(Pendente)</small>` : ''}
                </td>
                <td>${stBadge}</td>
                <td>
                  <div style="display:flex; gap:4px; flex-wrap:wrap;">
                    ${podeEditar ? `<button class="btn-sm" onclick="modalAtribuirMaquinasLegado('${g.batchId}')">📌 Atribuir Máquinas</button>` : ''}
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

/* SISTEMA COM PREFIXOS RÁPIDOS + VÍRGULA AUTOMÁTICA */
function modalAtribuirMaquinasLegado(batchId) {
  const itens = db.emprestimos.filter(x => (x.batchId || x.idDoc || x.id) === batchId);
  if (!itens.length) return alert("Solicitação não encontrada.");

  const itemPrincipal = itens[0];
  const bloqDia = db.bloqueios.filter(b => b.date === itemPrincipal.date);

  if (bloqDia.some(b => b.lesson === "all") && user.role !== "admin") {
    return alert(`🚫 ERRO CRÍTICO: Esta data (${itemPrincipal.date.split('-').reverse().join('/')}) possui BLOQUEIO TOTAL.`);
  }

  let selecionadas = [];
  itens.forEach(x => {
    if (x.equipments && Array.isArray(x.equipments)) {
      x.equipments.forEach(eq => { if (eq && eq !== "Pendente" && !selecionadas.includes(eq)) selecionadas.push(eq); });
    } else if (x.equipment && x.equipment !== "Pendente" && !selecionadas.includes(x.equipment)) {
      selecionadas.push(x.equipment);
    }
  });

  let qtdLimite = 1;
  itens.forEach(x => {
    const q = Math.max(x.qtdTotalPedida || 0, x.qtdPedida || 0, x.quantity || 0);
    if (q > qtdLimite) qtdLimite = q;
  });

  let prefixoAtual = "M";

  const renderTags = () => {
    if (!selecionadas.length) return `<span class="muted" style="font-size:12px;">Nenhuma máquina atribuída ainda.</span>`;
    return selecionadas.map(eq => `
      <span class="badge active" style="font-size:12px; padding:4px 8px; display:inline-flex; align-items:center; gap:4px; margin:2px;">
        ${eq} <b style="cursor:pointer; color:#fff;" onclick="window.removerTagAtribuicao('${eq}')">&times;</b>
      </span>
    `).join("");
  };

  const m = modal(`
    <div class="modal-top">
      <h2>📌 Atribuir Máquinas no Pedido</h2>
      <button class="close">&times;</button>
    </div>

    <div style="background:rgba(59, 130, 246, 0.1); border:1px solid rgba(59, 130, 246, 0.3); padding:10px 14px; border-radius:8px; display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
      <span style="font-size:13px;">Pedido de: <b>${esc(itemPrincipal.userName)}</b></span>
      <span id="badgeContadorAtrib" class="badge active" style="font-size:12px;">${selecionadas.length} / ${qtdLimite} máq.</span>
    </div>

    <label class="lbl"><b>CLIQUE NO PREFIXO PARA SELECIONAR:</b></label>
    <div id="grupoBotoesPrefixos" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;">
      ${MODELOS_EQUIPAMENTO.map(cat => `
        <button type="button" class="btn-secondary btn-sm btn-cat-filter ${cat.id === prefixoAtual ? 'active' : ''}" data-cat="${cat.id}" style="${cat.id === prefixoAtual ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : ''}">${cat.label}</button>
      `).join("")}
    </div>

    <label class="lbl"><b>DIGITE O NÚMERO E APERTE VÍRGULA (,):</b></label>
    <div style="font-size:11px; color:var(--text-muted); margin-bottom:6px;">Ex: com o prefixo ativo, digite <code style="color:#38bdf8;">1, 2, 3,</code> para adicionar instantaneamente.</div>
    
    <input id="inpAtribComando" class="inp" placeholder="Digite o número (ex: 1, 2...)" style="font-size:15px; padding:10px;" autofocus>

    <div style="margin-top:14px; margin-bottom:8px;">
      <label class="check-aula-card" style="display:flex; align-items:center; gap:8px; cursor:pointer; background:rgba(245, 158, 11, 0.1); border-color:rgba(245, 158, 11, 0.3);">
        <input type="checkbox" id="chkExtraTroca">
        <span><b>➕ Permitir Máquinas Extras / Acima do Pedido</b></span>
      </label>
    </div>

    <div style="background:var(--bg-input); border:1px solid var(--border); padding:12px; border-radius:8px; margin-bottom:16px; min-height:60px;">
      <label class="lbl" style="margin-bottom:6px; display:block;">Máquinas Atribuídas:</label>
      <div id="containerTagsAtrib">${renderTags()}</div>
    </div>

    <button type="button" id="btnSaveAssign" class="btn-primary" style="width:100%; padding:12px;">✅ Salvar e Concluir Atribuição</button>
  `);

  const inputEl = m.querySelector("#inpAtribComando");
  const containerTags = m.querySelector("#containerTagsAtrib");
  const badgeContador = m.querySelector("#badgeContadorAtrib");

  const atualizarTelaTags = () => {
    containerTags.innerHTML = renderTags();
    badgeContador.textContent = `${selecionadas.length} / ${qtdLimite} máq.`;
  };

  window.removerTagAtribuicao = (eq) => {
    selecionadas = selecionadas.filter(x => x !== eq);
    atualizarTelaTags();
  };

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
      inputEl.focus();
    };
  });

  inputEl.addEventListener("input", (e) => {
    const val = inputEl.value;
    if (val.includes(",")) {
      const pedacos = val.split(",");
      for (let i = 0; i < pedacos.length - 1; i++) {
        let bruto = pedacos[i].trim().toUpperCase();
        if (bruto) {
          const permitirExtra = m.querySelector("#chkExtraTroca").checked;
          if (!permitirExtra && selecionadas.length >= qtdLimite) {
            alert(`Limite de ${qtdLimite} máquinas atingido! Marque "Permitir Máquinas Extras" se precisar.`);
            break;
          }

          let codigoFinal = bruto;
          if (!/[A-Z]/.test(bruto)) {
            codigoFinal = prefixoAtual + bruto;
          }

          if (!selecionadas.includes(codigoFinal)) {
            selecionadas.push(codigoFinal);
          }
        }
      }
      inputEl.value = pedacos[pedacos.length - 1];
      atualizarTelaTags();
    }
  });

  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      let bruto = inputEl.value.trim().toUpperCase();
      if (bruto) {
        const permitirExtra = m.querySelector("#chkExtraTroca").checked;
        if (!permitirExtra && selecionadas.length >= qtdLimite) {
          return alert(`Limite de ${qtdLimite} máquinas atingido!`);
        }

        let codigoFinal = bruto;
        if (!/[A-Z]/.test(bruto)) {
          codigoFinal = prefixoAtual + bruto;
        }

        if (!selecionadas.includes(codigoFinal)) {
          selecionadas.push(codigoFinal);
        }
        inputEl.value = "";
        atualizarTelaTags();
      }
    }
  });

  m.querySelector(".close").onclick = () => m.remove();

  m.querySelector("#btnSaveAssign").onclick = async () => {
    const resto = inputEl.value.trim().toUpperCase();
    if (resto) {
      let codigoFinal = resto;
      if (!/[A-Z]/.test(resto)) codigoFinal = prefixoAtual + resto;
      if (!selecionadas.includes(codigoFinal)) selecionadas.push(codigoFinal);
    }

    try {
      const novostatus = selecionadas.length > 0 ? "retirado" : "aguardando";
      const listaSalvar = selecionadas.length > 0 ? selecionadas : ["Pendente"];

      for (let target of itens) {
        await firestore.collection("emprestimos").doc(target.idDoc).update({
          equipments: listaSalvar,
          equipment: listaSalvar[0] || "Pendente",
          status: novostatus
        });
      }

      alert("Atribuição salva com sucesso!");
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
      <label class="lbl">Data de Uso
        <input id="eDate" type="date" value="${itemPrincipal.date}" class="inp" required>
      </label>

      <label class="lbl" style="margin-top:10px;">Quantidade Pedida
        <input id="eQty" type="number" min="1" max="50" value="${qtdAtual}" class="inp" required>
      </label>

      <button type="submit" class="btn-primary" style="margin-top:16px; width:100%;">Salvar Alterações</button>
    </form>
  `);

  m.querySelector(".close").onclick = () => m.remove();
  m.querySelector("#fEditSol").onsubmit = async e => {
    e.preventDefault();
    const novaData = $("eDate").value;
    const novaQtd = parseInt($("eQty").value, 10);

    try {
      for (let target of itens) {
        await firestore.collection("emprestimos").doc(target.idDoc).update({
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

/* CALENDÁRIO COM CORES CSS CORRIGIDAS NA RÉGUA */
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
        type: emp.type || "Notebook",
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
            return `
              <tr style="border-bottom:1px solid rgba(255,255,255,0.05);">
                <td style="padding:12px 10px;">
                  <b>👤 ${esc(lote.userName)}</b>
                </td>
                <td style="padding:12px 10px;">
                  💻 ${esc(lote.type)}
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
                  <b>${validEqs.length} / ${qtdPedidaReal} máq.</b>
                </td>
                <td style="padding:12px 10px;">
                  <button class="btn-sm" onclick="modalAtribuirMaquinasLegado('${lote.batchId}')">📌 Atribuir</button>
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

/* TUTORIAL DO APLICATIVO */
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
        <h3 style="margin-bottom:6px; color:#38bdf8;">1. Dashboard (Visão Geral)</h3>
        <p style="font-size:13px; color:var(--text-muted);">
          Exibe a taxa de ocupação diária de notebooks e tablets, os empréstimos ativos no momento e a lista de saídas e retiradas já unificadas por professor.
        </p>
      </div>

      <div style="background:rgba(59, 130, 246, 0.08); padding:14px; border-radius:10px; border:1px solid rgba(59, 130, 246, 0.2);">
        <h3 style="margin-bottom:6px; color:#38bdf8;">2. Calendário e Régua de Ocupação</h3>
        <p style="font-size:13px; color:var(--text-muted);">
          Mostra os dias do mês com uma <b>régua colorida de 7 blocos</b> representando as aulas do dia:<br>
          • <b style="color:#38bdf8;">Azul</b>: Ocupação baixa (1 até 30 máquinas)<br>
          • <b style="color:#f59e0b;">Amarelo</b>: Ocupação média (30 a 70 máquinas)<br>
          • <b style="color:#ef4444;">Vermelho</b>: Ocupação alta ou Bloqueio
        </p>
      </div>

      <div style="background:rgba(59, 130, 246, 0.08); padding:14px; border-radius:10px; border:1px solid rgba(59, 130, 246, 0.2);">
        <h3 style="margin-bottom:6px; color:#38bdf8;">3. Solicitações & Atribuição de Máquinas</h3>
        <p style="font-size:13px; color:var(--text-muted);">
          • <b>Atribuição Rápida</b>: Clique no prefixo desejado e digite os números separados por vírgula <code style="color:#38bdf8;">,</code>.<br>
          • <b>Máquina Extra</b>: Marque a caixa se precisar adicionar mais máquinas do que o limite solicitado.
        </p>
      </div>

      <div style="background:rgba(59, 130, 246, 0.08); padding:14px; border-radius:10px; border:1px solid rgba(59, 130, 246, 0.2);">
        <h3 style="margin-bottom:6px; color:#38bdf8;">4. Avarias e Histórico de Devoluções</h3>
        <p style="font-size:13px; color:var(--text-muted);">
          • <b>Avarias</b>: Registre defeitos e envie fotos.<br>
          • <b>Histórico</b>: Acompanhe todas as devoluções efetuadas com data, hora e equipamento retornado.
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
          <input id="rsQty" type="number" min="1" max="40" value="1" class="inp" required>
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
    const d = $("rsDate").value;
    const seg = $("rsSeg").value;
    const qty = parseInt($("rsQty").value, 10);
    const purp = $("rsPurpose").value;
    const selectedLessons = Array.from(m.querySelectorAll('input[name="solLesson"]:checked')).map(cb => parseInt(cb.value, 10));

    const bloqDia = db.bloqueios.filter(b => b.date === d);
    if (bloqDia.some(b => b.lesson === "all") && user.role !== "admin") {
      return alert("Esta data possui um bloqueio de DIA INTEIRO registrado.");
    }

    if (isPastDate(d) || isWeekend(d) || isHoliday(d)) return alert("Data indisponível para solicitações.");
    if (!selectedLessons.length) return alert("Selecione pelo menos uma aula.");

    const batchId = uid();
    const horaCriacao = nowFormatted();
    const tabelaUsada = TABELAS_HORARIOS[seg] || TABELAS_HORARIOS["6_7"];

    const labelsAulas = selectedLessons.map(lIdx => {
      const slot = tabelaUsada[lIdx];
      return slot ? `${slot.label}` : `Aula ${lIdx + 1}`;
    });

    try {
      await firestore.collection("emprestimos").add({
        id: uid(),
        batchId: batchId,
        userId: user.id || user.idDoc,
        userName: user.name,
        date: d,
        lessons: labelsAulas,
        lessonIndexes: selectedLessons,
        segment: seg,
        equipments: ["Pendente"],
        qtdTotalPedida: qty,
        purpose: purp,
        status: "aguardando",
        createdAt: horaCriacao
      });

      alert("Solicitação criada como Pendente!");
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