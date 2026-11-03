export const firebaseConfig = {
  apiKey: "AIzaSyCaz1JCXX1RLOZviyG3Ggf47B0blheSa68",
  authDomain: "reserva-escolamariaolimpia.firebaseapp.com",
  projectId: "reserva-escolamariaolimpia",
  storageBucket: "reserva-escolamariaolimpia",
  messagingSenderId: "reserva-escolamariaolimpia",
  appId: "1:122324755743:web:9060239e2572733dd4fc2a"
};

export const SESSION_KEY = "controle_sessao_proati_v55";

export const MODELOS_EQUIPAMENTO = [
  { id: "M", label: "M (Multilaser)" },
  { id: "SA", label: "SA (Samsung)" },
  { id: "PV", label: "PV (Positivo V.)" },
  { id: "PN", label: "PN (Positivo N.)" },
  { id: "TAB", label: "TAB (Tablet)" }
];

export const TABELAS_HORARIOS_MANHA = [
  { index: 0, label: "1ª Aula", start: "07:00", end: "07:50" },
  { index: 1, label: "2ª Aula", start: "07:50", end: "08:40" },
  { index: 2, label: "3ª Aula", start: "08:40", end: "09:30" },
  { index: 3, label: "4ª Aula", start: "09:50", end: "10:40" },
  { index: 4, label: "5ª Aula", start: "10:40", end: "11:30" },
  { index: 5, label: "6ª Aula", start: "11:30", end: "12:20" },
  { index: 6, label: "7ª Aula", start: "13:10", end: "14:00" }
];

export const TABELAS_HORARIOS_TARDE = [
  { index: 0, label: "1ª Aula", start: "14:15", end: "15:05" },
  { index: 1, label: "2ª Aula", start: "15:05", end: "15:55" },
  { index: 2, label: "3ª Aula", start: "16:15", end: "17:05" },
  { index: 3, label: "4ª Aula", start: "17:05", end: "17:55" },
  { index: 4, label: "5ª Aula", start: "18:45", end: "19:35" },
  { index: 5, label: "6ª Aula", start: "19:35", end: "20:25" },
  { index: 6, label: "7ª Aula", start: "20:25", end: "21:15" }
];

export const TABELAS_HORARIOS = {
  "6_7": TABELAS_HORARIOS_MANHA,
  "8_9": TABELAS_HORARIOS_MANHA,
  "manha": TABELAS_HORARIOS_MANHA,
  "tarde": TABELAS_HORARIOS_TARDE
};

export const TURMAS_MANHA = [
  "6º A", "6º B", "6º C",
  "7º A", "7º B", "7º C",
  "8º A", "8º B", "8º C",
  "9º A", "9º B", "9º C"
];

export const TURMAS_TARDE = [
  "1º A", "1º B", "1º C", "1º D",
  "2º A ADM", "2º B ADM", "2º C",
  "3º A", "3º C", "3º ADM"
];

export const FINALIDADES = [
  { id: "redacao", label: "Redação" },
  { id: "programacao", label: "Programação" },
  { id: "speak", label: "Speak (Inglês)" },
  { id: "matific", label: "Matific (Matemática)" },
  { id: "sem_plataforma", label: "Sem Plataforma" },
  { id: "outros", label: "Outros" }
];

export const FERIADOS_FIXOS = ["01-01", "04-21", "05-01", "09-07", "10-12", "11-02", "11-15", "11-20", "12-25"];

// ---------- Função Utilitária para Obter a Aula Atual ----------
export function obterIndiceAulaAtual(turno = "manhã") {
  const agora = new Date();
  const minutosTotaisAgora = agora.getHours() * 60 + agora.getMinutes();

  const tabela = turno.toLowerCase() === "tarde" ? TABELAS_HORARIOS_TARDE : TABELAS_HORARIOS_MANHA;

  for (let i = 0; i < tabela.length; i++) {
    const aula = tabela[i];
    const [hInicio, mInicio] = aula.start.split(":").map(Number);
    const [hFim, mFim] = aula.end.split(":").map(Number);

    const minutosInicio = hInicio * 60 + mInicio;
    const minutosFim = hFim * 60 + mFim;

    if (minutosTotaisAgora >= minutosInicio && minutosTotaisAgora <= minutosFim) {
      return aula.index;
    }
  }

  return 0;
}

window.obterIndiceAulaAtual = obterIndiceAulaAtual;