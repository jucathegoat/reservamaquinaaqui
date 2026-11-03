import { firestore, user } from './auth.js';
import { TABELAS_HORARIOS, FINALIDADES } from './config.js';

let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth();
let turnoVisualizacaoAtivo = null; // Usado para quem tem perfil 'ambos' ou 'admin'

export function calendario() {
  const turnoUser = user.turno || "manhã";
  const isAdminOrAmbos = user.role === "admin" || turnoUser === "ambos";
  
  if (!turnoVisualizacaoAtivo) {
    turnoVisualizacaoAtivo = isAdminOrAmbos ? "manhã" : turnoUser;
  }

  const keyHorarios = TABELAS_HORARIOS["6_7"] ? "6_7" : Object.keys(TABELAS_HORARIOS)[0];
  const listaAulasHorario = TABELAS_HORARIOS[keyHorarios] || [];

  document.getElementById("main").innerHTML = `
    <div class="head">
      <div>
        <h2>Calendário de Reservas (${turnoVisualizacaoAtivo.toUpperCase()})</h2>
        <div class="muted">Gestão de equipamentos por turno e régua de ocupação</div>
      </div>
      <div class="action-bar" style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        ${isAdminOrAmbos ? `
          <div style="display:flex; gap:4px; align-items:center; background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:6px; border:1px solid var(--border);">
            <span style="font-size:12px;" class="muted">Turno:</span>
            <select id="selTurnoGlobal" class="inp" style="padding:2px 6px; font-size:12px;" onchange="window.mudarTurnoVisualizacao(this.value)">
              <option value="manhã" ${turnoVisualizacaoAtivo === "manhã" ? "selected" : ""}>☀️ Manhã</option>
              <option value="tarde" ${turnoVisualizacaoAtivo === "tarde" ? "selected" : ""}>🌙 Tarde</option>
            </select>
          </div>
        ` : ''}
        <button class="btn-secondary btn-sm" onclick="window.mudarMes(-1)">&lt; Anterior</button>
        <b id="calMonthTitle" style="font-size:14px; white-space:nowrap;"></b>
        <button class="btn-secondary btn-sm" onclick="window.mudarMes(1)">Próximo &gt;</button>
      </div>
    </div>

    <div class="card" style="margin-bottom: 12px; padding: 12px;">
      <h3 style="margin-bottom: 8px; font-size: 12px;">📊 Legenda da Régua por Aula (${turnoVisualizacaoAtivo.toUpperCase()})</h3>
      <div style="display: flex; gap: 4px; flex-wrap: wrap;">
        ${listaAulasHorario.map((aula) => `
          <div style="background: rgba(255,255,255,0.05); padding: 3px 6px; border-radius: 4px; border: 1px solid var(--border); font-size: 10px;">
            <b>${aula.label}:</b> ${aula.start}–${aula.end}
          </div>
        `).join("")}
      </div>
    </div>

    <div class="card" style="padding: 10px;">
      <div class="calendar-grid-container" style="width: 100%; overflow-x: auto; -webkit-overflow-scrolling: touch;">
        <div class="calendar-header">
          <div>Dom</div><div>Seg</div><div>Ter</div><div>Qua</div><div>Qui</div><div>Sex</div><div>Sáb</div>
        </div>
        <div id="monthGrid" class="calendar-grid"></div>
      </div>
    </div>`;

  renderMonthGrid();
}

window.mudarTurnoVisualizacao = function(novoTurno) {
  turnoVisualizacaoAtivo = novoTurno;
  calendario();
}

window.mudarMes = function(delta) {
  calMonth += delta;
  if (calMonth < 0) { calMonth = 11; calYear--; }
  else if (calMonth > 11) { calMonth = 0; calYear++; }
  renderMonthGrid();
}

function renderMonthGrid() {
  const meses = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
  const titleEl = document.getElementById("calMonthTitle");
  if (titleEl) titleEl.textContent = `${meses[calMonth]} / ${calYear}`;

  const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0 = Domingo, 1 = Segunda, etc.
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const todayStr = new Date().toISOString().split('T')[0];

  const turnoUser = user.turno || "manhã";
  const isAdminOrAmbos = user.role === "admin" || turnoUser === "ambos";
  const turnoAlvo = isAdminOrAmbos ? (turnoVisualizacaoAtivo || "manhã") : turnoUser;

  const keyHorarios = TABELAS_HORARIOS["6_7"] ? "6_7" : Object.keys(TABELAS_HORARIOS)[0];
  const totalAulas = (TABELAS_HORARIOS[keyHorarios] || []).length || 7;

  let html = "";
  
  // Preenche os espaços vazios antes do dia 1 para alinhar na coluna correta da semana
  for (let i = 0; i < firstDay; i++) {
    html += `<div class="calendar-day-card" style="visibility:hidden; height:85px;"></div>`;
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(calYear, calMonth, d).getDay();
    const isWk = window.isWeekend ? window.isWeekend(dateStr) : (dayOfWeek === 0 || dayOfWeek === 6);
    const isPast = dateStr < todayStr;
    
    // Filtra bloqueios considerando o turno ativo
    const bloqDia = (window.db?.bloqueios || []).filter(b => b.date === dateStr);
    const temBloqueioTotal = bloqDia.some(b => b.lesson === "all" || b.tipo === "total");
    const temBloqueioTurno = bloqDia.some(b => b.lesson === `turno_${turnoAlvo}` || b.tipo === turnoAlvo);
    const bloqueioEfetivo = temBloqueioTotal || temBloqueioTurno;

    // Filtra empréstimos estritamente pelo turno ativo
    const emprestimosDia = (window.db?.emprestimos || []).filter(r => 
      r && r.date === dateStr && r.status !== "cancelado" && 
      (r.turno === turnoAlvo || (!r.turno && turnoAlvo === "manhã"))
    );

    const ocupacaoPorAula = Array(totalAulas).fill(0);
    const lotesPorAula = Array.from({ length: totalAulas }, () => new Map());

    emprestimosDia.forEach(emp => {
      const bid = emp.batchId || emp.idDoc || emp.id;
      const qtdDoc = Math.max(emp.qtdTotalPedida || 0, emp.qtdPedida || 0, emp.quantity || 1);

      for (let idx = 0; idx < totalAulas; idx++) {
        const temAula = (emp.lessonIndexes && emp.lessonIndexes.includes(idx)) || (emp.lessonIndex === idx);
        if (temAula) {
          lotesPorAula[idx].set(bid, qtdDoc);
        }
      }
    });

    for (let idx = 0; idx < totalAulas; idx++) {
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
    if (isWk) {
      extraStyle = "opacity:0.25; cursor:not-allowed; background:rgba(0,0,0,0.2);";
    } else if (bloqueioEfetivo) {
      extraStyle = "border:1px solid #ef4444; background:rgba(239,68,68,0.12);";
    } else if (isPast) {
      extraStyle = "background: rgba(0, 0, 0, 0.45); border-color: rgba(255,255,255,0.03);";
    } else {
      extraStyle = "background: rgba(255, 255, 255, 0.03);";
    }

    html += `
      <div class="calendar-day-card" style="height:85px; display:flex; flex-direction:column; justify-content:space-between; cursor:pointer; box-sizing:border-box; padding:4px; ${extraStyle}" onclick="window.clickCalDay('${dateStr}', '${turnoAlvo}')">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <b style="font-size:11px; ${isPast ? 'color:var(--text-muted);' : ''}">${d}</b>
          ${bloqueioEfetivo ? `<span class="badge blocked" style="background:#ef4444; color:#fff; font-size:8px; padding:1px 3px;">Bloq.</span>` : (totalMaquinasUnicas > 0 ? `<span class="badge active" style="background:${turnoAlvo === 'tarde' ? '#eab308' : '#3b82f6'}; color:#0f172a; font-weight:bold; font-size:8px; padding:1px 3px;">${totalMaquinasUnicas}m</span>` : '')}
        </div>

        ${!isWk ? `
          <div style="display:flex; gap:1px; margin-top:2px; background:rgba(0,0,0,0.5); padding:2px; border-radius:4px;">
            ${ocupacaoPorAula.map((qtd, idx) => {
              const aulaBloqueada = bloqDia.some(b => String(b.lesson) === String(idx) || (b.lesson === `turno_${turnoAlvo}`));
              let color = "rgba(255,255,255,0.08)";
              let textColor = "#ffffff";
              if (aulaBloqueada || bloqueioEfetivo) {
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
                <div style="flex:1; height:14px; border-radius:2px; background:${color}; display:flex; align-items:center; justify-content:center; font-size:7px; font-weight:bold; color:${textColor};" title="Aula ${idx+1}: ${qtd} máquinas">
                  ${aulaBloqueada || bloqueioEfetivo ? '🔒' : (qtd > 0 ? qtd : '')}
                </div>
              `;
            }).join("")}
          </div>
        ` : ''}
      </div>`;
  }
  const gridEl = document.getElementById("monthGrid");
  if (gridEl) gridEl.innerHTML = html;
}

window.clickCalDay = function(dateStr, turnoAlvo) {
  const dayOfWeek = new Date(dateStr + 'T00:00:00').getDay();
  const isWk = dayOfWeek === 0 || dayOfWeek === 6;
  if (isWk) return;

  const bloqDia = (window.db?.bloqueios || []).filter(b => b.date === dateStr);
  const bloqueioEfetivo = bloqDia.some(b => b.lesson === "all" || b.tipo === "total" || b.lesson === `turno_${turnoAlvo}` || b.tipo === turnoAlvo);
  
  if (bloqueioEfetivo && user.role !== "admin") {
    return alert(`🚫 Esta data (${dateStr.split('-').reverse().join('/')}) está bloqueada para o turno da ${turnoAlvo}.`);
  }

  if (window.modalReservaTurno) {
    window.modalReservaTurno(dateStr, turnoAlvo);
  } else if (window.modalReserva) {
    window.modalReserva(dateStr);
  }
}