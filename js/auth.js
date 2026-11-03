import { firebaseConfig } from './config.js';

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

export const firestore = firebase.firestore();

try {
  firestore.settings({ experimentalForceLongPolling: true, merge: true });
} catch (e) {}

export let user = null;
let callbackSessao = null;

// ---------- Utilitários ----------
export function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

const loginValido = l => /^[a-z._-]+$/.test(l); // sem espaços, números ou acentos

// ---------- Rotas das telas de autenticação (Sem Hash no URL) ----------
export function mudarTelaAuth(rota) {
  const telaInicio = document.getElementById("welcomeScreen") || document.getElementById("tela-inicio");
  const telaLogin = document.getElementById("loginScreen") || document.getElementById("tela-login");
  const telaRegistro = document.getElementById("registerScreen") || document.getElementById("tela-registro");
  if (!telaInicio || !telaLogin || !telaRegistro) return;

  [telaInicio, telaLogin, telaRegistro].forEach(t => t.classList.remove("active", "ativa"));

  if (rota === "entrar") {
    telaLogin.classList.add("active");
  } else if (rota === "cadastro") {
    telaRegistro.classList.add("active");
  } else {
    telaInicio.classList.add("active");
  }

  // Remove qualquer hash remanescente do URL de forma limpa sem recarregar a página
  if (window.history && window.history.replaceState) {
    window.history.replaceState('', document.title, window.location.pathname);
  }
}

// ---------- Gestão de Sessão Local (LocalStorage) ----------
const SESSION_KEY = "proati_session_user";

export function verificarSessaoSalva(callbackIniciado) {
  callbackSessao = callbackIniciado;
  const salvo = localStorage.getItem(SESSION_KEY);
  if (salvo) {
    try {
      const u = JSON.parse(salvo);
      user = u;
      window.user = u;
      if (callbackSessao) callbackSessao(u);
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
    }
  }
}

export function iniciarSessao(u, callbackNav) {
  if (window.mostrarLoader) window.mostrarLoader("A iniciar sessão...");
  
  user = u;
  window.user = u;
  localStorage.setItem(SESSION_KEY, JSON.stringify(u));

  const welcomeEl = document.getElementById("welcomeScreen");
  const loginEl = document.getElementById("loginScreen");
  const registerEl = document.getElementById("registerScreen");
  const appEl = document.getElementById("app");

  if (welcomeEl) welcomeEl.classList.remove("active");
  if (loginEl) loginEl.classList.add("hidden");
  if (registerEl) registerEl.classList.remove("active");
  if (appEl) appEl.classList.remove("hidden");

  const whoEl = document.getElementById("who");
  if (whoEl) {
    whoEl.innerHTML = `
      <div style="display:flex; align-items:center; gap:8px;">
        <span><b>${escapeHtml(u.name)}</b> (${u.role === "admin" ? "Admin" : "Prof. " + escapeHtml(u.turno || "manhã")})</span>
        <button class="btn-sm" id="btnPerfilApp">✏️ Perfil</button>
        <button class="btn-sm danger" id="btnLogoutApp">🚪 Sair</button>
      </div>
    `;
  }

  const btnPerfil = document.getElementById("btnPerfilApp");
  if (btnPerfil) btnPerfil.onclick = () => modalEditarMeuPerfil();

  const btnLogout = document.getElementById("btnLogoutApp");
  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem(SESSION_KEY);
      user = null;
      window.user = null;
      mudarTelaAuth("inicio");
      window.location.reload();
    };
  }

  if (callbackNav) callbackNav("dashboard");
  
  setTimeout(() => {
    if (window.esconderLoader) window.esconderLoader();
  }, 200);
}

// ---------- Editar meu perfil (nome e PIN) ----------
export function modalEditarMeuPerfil() {
  if (!user) return;

  const existente = document.getElementById("containerModalPerfil");
  if (existente) existente.remove();

  const divModal = document.createElement("div");
  divModal.id = "containerModalPerfil";
  divModal.innerHTML = `
    <div class="modal" id="modalPerfil">
      <div class="modal-box card" style="max-width: 400px; margin: 10% auto; padding: 20px;">
        <div class="form-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
          <h2 style="font-size:18px;">✏️ Editar Meu Perfil</h2>
          <button class="btn-sm danger" id="fecharModalPerfil" style="cursor:pointer; padding:2px 8px;">&times;</button>
        </div>
        <form id="fMeuPerfil">
          <label class="lbl">Nome Completo
            <input id="mpNome" class="inp" maxlength="80" value="${escapeHtml(user.name)}" required style="margin-top:4px;">
          </label>
          <label class="lbl" style="margin-top:10px;">Novo PIN (4 números) — deixe vazio para manter
            <input id="mpPass" type="password" maxlength="4" pattern="\\d{4}" inputmode="numeric" class="inp" style="margin-top:4px;">
          </label>
          <div style="margin-top:18px;">
            <button type="submit" class="btn-primary" style="width:100%;">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  `;
  document.body.appendChild(divModal);

  document.getElementById("fecharModalPerfil").onclick = () => divModal.remove();

  document.getElementById("fMeuPerfil").onsubmit = async (e) => {
    e.preventDefault();
    if (window.mostrarLoader) window.mostrarLoader("A atualizar perfil...");
    
    const nome = document.getElementById("mpNome").value.trim();
    const novoPin = document.getElementById("mpPass").value.trim();

    if (novoPin && !/^\d{4}$/.test(novoPin)) {
      if (window.esconderLoader) window.esconderLoader();
      alert("O PIN deve conter exatamente 4 números.");
      return;
    }

    try {
      const updateData = { name: nome };
      if (novoPin) updateData.senha = novoPin;

      await firestore.collection("users").doc(user.idDoc).update(updateData);
      user.name = nome;
      if (novoPin) user.senha = novoPin;

      alert("Perfil atualizado com sucesso!");
      divModal.remove();
      iniciarSessao(user, window.nav);
    } catch (err) {
      alert("Erro ao atualizar perfil: " + err.message);
    } finally {
      if (window.esconderLoader) window.esconderLoader();
    }
  };
}

// ---------- Constantes de Segurança de Registo ----------
const TEMPO_BLOQUEIO_DISPOSITIVO = 24 * 60 * 60 * 1000; // 24 horas em ms
const CHAVE_DEVICE_REGISTRO = "proati_ultimo_registro_dispositivo";

// ---------- Eventos de tela ----------
document.addEventListener("DOMContentLoaded", () => {
  mudarTelaAuth("inicio");

  document.addEventListener("click", (e) => {
    const target = e.target.closest('#btnIrParaLogin, #btnIrParaPrimeiroAcesso, #btnVoltarWelcome, #btnVoltarLogin');
    if (target) {
      e.preventDefault();
      if (target.id === "btnIrParaLogin") {
        mudarTelaAuth("entrar");
      } else if (target.id === "btnIrParaPrimeiroAcesso") {
        mudarTelaAuth("cadastro");
      } else if (target.id === "btnVoltarWelcome" || target.id === "btnVoltarLogin") {
        mudarTelaAuth("inicio");
      }
    }
  });

  const rTurno = document.getElementById("rTurno") || document.getElementById("paTurno");
  const rAmbosBox = document.getElementById("rAmbosBox") || document.getElementById("divSenhaAmbosContainerMobile");
  if (rTurno && rAmbosBox) {
    rTurno.onchange = (e) => {
      const ambos = e.target.value === "ambos";
      rAmbosBox.style.display = ambos ? "block" : "none";
      rAmbosBox.hidden = !ambos;
    };
  }

  // ----- LOGIN COM RATE LIMITING E VALIDAÇÃO DE SEGURANÇA -----
  const loginForm = document.getElementById("loginForm");
  if (loginForm) {
    let ultimaTentativa = 0;
    let tentativasErradas = 0;
    let tempoBloqueioAte = 0;
    const INTERVALO_CLIQUE = 2000; // 2 segundos entre envios

    loginForm.onsubmit = async (e) => {
      e.preventDefault();
      
      const agora = Date.now();
      const errEl = document.getElementById("loginError");
      if (errEl) errEl.hidden = true;
      const mostrarErro = msg => { if (errEl) { errEl.textContent = msg; errEl.hidden = false; } };

      // 1. Verificação de Bloqueio Temporário (Anti-Brute Force)
      if (agora < tempoBloqueioAte) {
        const segundosRestantes = Math.ceil((tempoBloqueioAte - agora) / 1000);
        return mostrarErro(`🔒 Muitas tentativas inválidas. Aguarde ${segundosRestantes} segundos.`);
      }

      // 2. Rate Limiting por Tempo (Anti-Spam de cliques)
      if (agora - ultimaTentativa < INTERVALO_CLIQUE) {
        return mostrarErro("⚠️ Calma! Aguarde um momento antes de tentar novamente.");
      }
      ultimaTentativa = agora;

      const loginInput = document.getElementById("loginUser").value.trim().toLowerCase();
      const pinInput = document.getElementById("loginPass").value.trim();

      // 3. Validação Rígida de Dados
      if (!loginInput || !pinInput) {
        return mostrarErro("Por favor, preencha o utilizador e a senha.");
      }

      if (!/^\d{4}$/.test(pinInput)) {
        return mostrarErro("O PIN deve conter exatamente 4 números.");
      }

      if (window.mostrarLoader) window.mostrarLoader("A validar credenciais...");

      try {
        const snap = await firestore.collection("users").where("login", "==", loginInput).get();
        if (snap.empty) {
          tentativasErradas++;
          if (tentativasErradas >= 5) {
            tempoBloqueioAte = Date.now() + 30000; // Bloqueia por 30 segundos
            tentativasErradas = 0;
            return mostrarErro("🚫 Excedeu o limite de tentativas. Bloqueado por 30 segundos.");
          }
          return mostrarErro("Utilizador não encontrado.");
        }

        let utilizadorEncontrado = null;
        snap.forEach(doc => {
          const data = doc.data();
          const senhaCadastrada = String(data.senha || data.pass || data.password || "");
          if (senhaCadastrada === pinInput) {
            utilizadorEncontrado = { idDoc: doc.id, ...data };
          }
        });

        if (!utilizadorEncontrado) {
          tentativasErradas++;
          if (tentativasErradas >= 5) {
            tempoBloqueioAte = Date.now() + 30000;
            tentativasErradas = 0;
            return mostrarErro("🚫 Excedeu o limite de tentativas. Bloqueado por 30 segundos.");
          }
          return mostrarErro("Senha incorreta.");
        }

        // Login bem-sucedido: reseta o contador de erros
        tentativasErradas = 0;
        iniciarSessao(utilizadorEncontrado, window.nav);

      } catch (err) {
        console.error("Erro no login:", err);
        mostrarErro("Erro de conexão com o banco de dados. Tente novamente.");
      } finally {
        if (window.esconderLoader) window.esconderLoader();
      }
    };
  }

  // ----- CADASTRO DIRETO NO FIRESTORE (COM TRAVAS DE SEGURANÇA) -----
  const registroForm = document.getElementById("registroForm") || document.getElementById("registerForm");
  if (registroForm) {
    registroForm.onsubmit = async (e) => {
      e.preventDefault();
      const nome = (document.getElementById("rNome") || document.getElementById("paNome")).value.trim();
      const login = (document.getElementById("rLogin") || document.getElementById("paLogin")).value.trim().toLowerCase();
      const pin = (document.getElementById("rPass") || document.getElementById("paPass")).value.trim();
      const turno = (document.getElementById("rTurno") || document.getElementById("paTurno")).value;
      const errEl = document.getElementById("registroError") || document.getElementById("loginError");
      if (errEl) errEl.hidden = true;

      const mostrarErro = msg => { if (errEl) { errEl.textContent = msg; errEl.hidden = false; } };

      if (!nome || nome.length > 80) return mostrarErro("Informe um nome válido (até 80 caracteres).");

      // TRAVA 1: BLOQUEIO DE 24H POR DISPOSITIVO
      const ultimoRegistroDisp = localStorage.getItem(CHAVE_DEVICE_REGISTRO);
      const agora = Date.now();
      if (ultimoRegistroDisp) {
        const tempoDecorrido = agora - parseInt(ultimoRegistroDisp, 10);
        if (tempoDecorrido < TEMPO_BLOQUEIO_DISPOSITIVO) {
          const horasRestantes = Math.ceil((TEMPO_BLOQUEIO_DISPOSITIVO - tempoDecorrido) / (1000 * 60 * 60));
          return mostrarErro(`🚫 Este dispositivo já efetuou um registo recentemente. Aguarde ${horasRestantes} hora(s) para criar outra conta.`);
        }
      }

      if (!loginValido(login)) return mostrarErro("Erro: o login deve ter apenas letras (sem espaços, números ou acentos).");
      if (!/^\d{4}$/.test(pin)) return mostrarErro("Erro: a senha deve conter exatamente 4 números.");
      if (!["manhã", "tarde", "ambos"].includes(turno)) return mostrarErro("Turno inválido.");

      if (turno === "ambos") {
        const campoAmbos = document.getElementById("rAmbos") || document.getElementById("paSenhaAmbos");
        const informada = campoAmbos ? campoAmbos.value.trim() : "";
        const correta = window.db?.configSistema?.senhaAmbos || "proati2026";
        if (informada !== correta) {
          return mostrarErro("🚫 Senha do perfil 'Ambos' incorreta!");
        }
      }

      if (window.mostrarLoader) window.mostrarLoader("A efetuar registo...");

      try {
        // TRAVA 2: VERIFICAÇÃO DE NOME / SOBRENOME DUPLICADO NO FIRESTORE
        const nomeFormatado = nome.toLowerCase().replace(/\s+/g, ' ');
        const checkUsuarios = await firestore.collection("users").get();
        let nomeDuplicado = false;

        checkUsuarios.forEach(doc => {
          const dadosUser = doc.data();
          const nomeCadastrado = (dadosUser.name || "").toLowerCase().replace(/\s+/g, ' ');
          if (nomeCadastrado === nomeFormatado) {
            nomeDuplicado = true;
          }
        });

        if (nomeDuplicado) {
          if (window.esconderLoader) window.esconderLoader();
          return mostrarErro("⚠️ Já existe uma conta registada com este exato nome e sobrenome.");
        }

        // Verifica se o login já existe
        const checkLogin = await firestore.collection("users").where("login", "==", login).get();
        if (!checkLogin.empty) {
          if (window.esconderLoader) window.esconderLoader();
          return mostrarErro("Esse login já existe. Escolha outro.");
        }

        await firestore.collection("users").add({
          name: nome,
          login: login,
          senha: pin,
          role: "professor",
          turno: turno,
          createdAt: new Date().toISOString()
        });

        // Regista o timestamp atual no localStorage para ativar o bloqueio de 24h no dispositivo
        localStorage.setItem(CHAVE_DEVICE_REGISTRO, Date.now().toString());

        alert("Cadastro efetuado com sucesso! Faça login com as suas credenciais.");
        mudarTelaAuth("entrar");
        registroForm.reset();
      } catch (err) {
        console.error("Erro no cadastro:", err);
        mostrarErro("Não foi possível cadastrar. Verifique a conexão com o banco de dados.");
      } finally {
        if (window.esconderLoader) window.esconderLoader();
      }
    };
  }
});

// --- CARREGADOR GLOBAL PARA TODAS AS TELAS (Instância Única) ---
if (!document.getElementById('global-loader')) {
  const loaderDiv = document.createElement('div');
  loaderDiv.id = 'global-loader';
  loaderDiv.innerHTML = `
    <div class="spinner-ring"></div>
    <span id="loader-text">A carregar...</span>
  `;
  document.body.appendChild(loaderDiv);
}

window.mostrarLoader = function(mensagem = "A carregar...") {
  const textEl = document.getElementById('loader-text');
  if (textEl) textEl.textContent = mensagem;
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.add('active');
};

window.esconderLoader = function() {
  const loader = document.getElementById('global-loader');
  if (loader) loader.classList.remove('active');
};