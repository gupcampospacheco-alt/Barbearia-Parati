import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// ===== ELEMENTOS =====
const form = document.getElementById("formAgendamento");
const mensagem = document.getElementById("mensagemAgendamento");

const inputNome = document.getElementById("nome");
const inputTelefone = document.getElementById("telefone");
const selectServico = document.getElementById("servico");
const selectBarbeiro = document.getElementById("barbeiro");
const inputData = document.getElementById("data");
const inputHora = document.getElementById("hora");

// ===== ESTADO =====
let emailClienteLogado = null;

// ===== CONFIG BARBEIROS =====
const barbeiros = {
  "João": {
    email: "joao@barbeariaparati.com",
    inicio: 9,
    fim: 19
  },
  "Carlos": {
    email: "carlos@barbeariaparati.com",
    inicio: 10,
    fim: 20
  },
  "Mateus": {
    email: "mateus@barbeariaparati.com",
    inicio: 8,
    fim: 18
  }
};

const INTERVALO_MINUTOS = 60;

// almoço bloqueado
const BLOQUEIOS_FIXOS = ["12:00"];

// ===== AUTH =====
onAuthStateChanged(auth, (user) => {
  emailClienteLogado = user?.email || null;
});

// ===== UTIL =====
function mostrarMensagem(texto, tipo = "normal") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem";

  if (tipo === "sucesso") {
    mensagem.classList.add("sucesso");
  } else if (tipo === "erro") {
    mensagem.classList.add("erro");
  }
}

function doisDigitos(valor) {
  return String(valor).padStart(2, "0");
}

function obterHojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${doisDigitos(hoje.getMonth() + 1)}-${doisDigitos(hoje.getDate())}`;
}

function definirDataMinima() {
  inputData.min = obterHojeISO();
}

function limparCampoHora() {
  inputHora.innerHTML = "";
}

function adicionarOpcaoHora(valor, texto, desabilitada = false, selecionada = false) {
  const option = document.createElement("option");
  option.value = valor;
  option.textContent = texto;
  option.disabled = desabilitada;
  option.selected = selecionada;
  inputHora.appendChild(option);
}

function iniciarCampoHora() {
  limparCampoHora();
  adicionarOpcaoHora("", "Escolha primeiro a data e o barbeiro", true, true);
}

function telefoneNormalizado(telefone) {
  return telefone.replace(/\D/g, "");
}

function dataPassada(dataSelecionada) {
  if (!dataSelecionada) return false;

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  const data = new Date(`${dataSelecionada}T00:00:00`);
  data.setHours(0, 0, 0, 0);

  return data < hoje;
}

function ehDomingo(dataSelecionada) {
  if (!dataSelecionada) return false;

  const data = new Date(`${dataSelecionada}T00:00:00`);
  return data.getDay() === 0;
}

function horarioJaPassou(dataSelecionada, horaSelecionada) {
  if (!dataSelecionada || !horaSelecionada) return false;

  const agora = new Date();
  const hojeISO = obterHojeISO();

  if (dataSelecionada !== hojeISO) return false;

  const [hora, minuto] = horaSelecionada.split(":").map(Number);

  const horarioSelecionado = new Date();
  horarioSelecionado.setHours(hora, minuto, 0, 0);

  return horarioSelecionado <= agora;
}

function horarioEstaBloqueadoFixamente(hora) {
  return BLOQUEIOS_FIXOS.includes(hora);
}

function gerarHorariosPorBarbeiro(barbeiro) {
  const config = barbeiros[barbeiro];
  if (!config) return [];

  const horarios = [];

  for (let hora = config.inicio; hora <= config.fim; hora++) {
    horarios.push(`${doisDigitos(hora)}:00`);
  }

  return horarios;
}

function dadosValidos({ nome, telefone, servico, barbeiro, data, hora }) {
  return Boolean(nome && telefone && servico && barbeiro && data && hora);
}

// ===== FIRESTORE =====
async function buscarHorariosOcupados(data, barbeiro) {
  const agendamentosRef = collection(db, "agendamentos");

  const q = query(
    agendamentosRef,
    where("data", "==", data),
    where("barbeiro", "==", barbeiro)
  );

  const snapshot = await getDocs(q);
  const horariosOcupados = [];

  snapshot.forEach((docItem) => {
    const dados = docItem.data();
    if (dados.hora) {
      horariosOcupados.push(dados.hora);
    }
  });

  return horariosOcupados;
}

async function horarioDisponivel(data, hora, barbeiro) {
  const agendamentosRef = collection(db, "agendamentos");

  const q = query(
    agendamentosRef,
    where("data", "==", data),
    where("hora", "==", hora),
    where("barbeiro", "==", barbeiro)
  );

  const snapshot = await getDocs(q);
  return snapshot.empty;
}

// ===== HORÁRIOS =====
async function atualizarHorariosDisponiveis() {
  const data = inputData.value;
  const barbeiro = selectBarbeiro.value;

  limparCampoHora();
  adicionarOpcaoHora("", "Escolha um horário", true, true);

  if (!data || !barbeiro) {
    return;
  }

  if (dataPassada(data)) {
    mostrarMensagem("Não é possível agendar em dias passados.", "erro");
    return;
  }

  if (ehDomingo(data)) {
    mostrarMensagem("A barbearia não atende aos domingos.", "erro");
    return;
  }

  try {
    const horariosBase = gerarHorariosPorBarbeiro(barbeiro);
    const horariosOcupados = await buscarHorariosOcupados(data, barbeiro);

    horariosBase.forEach((hora) => {
      const ocupado = horariosOcupados.includes(hora);
      const passou = horarioJaPassou(data, hora);
      const bloqueado = horarioEstaBloqueadoFixamente(hora);

      if (ocupado) {
        adicionarOpcaoHora(hora, `${hora} - ocupado`, true);
      } else if (bloqueado) {
        adicionarOpcaoHora(hora, `${hora} - almoço`, true);
      } else if (passou) {
        adicionarOpcaoHora(hora, `${hora} - indisponível`, true);
      } else {
        adicionarOpcaoHora(hora, hora, false);
      }
    });

    mostrarMensagem("");
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    mostrarMensagem("Erro ao carregar horários disponíveis.", "erro");
  }
}

// ===== EVENTOS =====
inputData.addEventListener("change", async () => {
  if (dataPassada(inputData.value)) {
    mostrarMensagem("Não é possível agendar em dias passados.", "erro");
    iniciarCampoHora();
    return;
  }

  if (ehDomingo(inputData.value)) {
    mostrarMensagem("A barbearia não atende aos domingos.", "erro");
    iniciarCampoHora();
    return;
  }

  await atualizarHorariosDisponiveis();
});

selectBarbeiro.addEventListener("change", atualizarHorariosDisponiveis);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputNome.value.trim();
  const telefone = telefoneNormalizado(inputTelefone.value.trim());
  const servico = selectServico.value;
  const barbeiro = selectBarbeiro.value;
  const data = inputData.value;
  const hora = inputHora.value;

  const configBarbeiro = barbeiros[barbeiro];
  const emailBarbeiro = configBarbeiro?.email || null;

  if (!dadosValidos({ nome, telefone, servico, barbeiro, data, hora })) {
    mostrarMensagem("Preencha todos os campos.", "erro");
    return;
  }

  if (!emailBarbeiro) {
    mostrarMensagem("Barbeiro inválido.", "erro");
    return;
  }

  if (dataPassada(data)) {
    mostrarMensagem("Não é possível agendar em dias passados.", "erro");
    return;
  }

  if (ehDomingo(data)) {
    mostrarMensagem("A barbearia não atende aos domingos.", "erro");
    return;
  }

  if (horarioEstaBloqueadoFixamente(hora)) {
    mostrarMensagem("Esse horário está indisponível.", "erro");
    return;
  }

  if (horarioJaPassou(data, hora)) {
    mostrarMensagem("Esse horário já passou. Escolha outro.", "erro");
    await atualizarHorariosDisponiveis();
    return;
  }

  mostrarMensagem("Verificando horário...");

  try {
    const disponivel = await horarioDisponivel(data, hora, barbeiro);

    if (!disponivel) {
      mostrarMensagem("Esse horário já está ocupado.", "erro");
      await atualizarHorariosDisponiveis();
      return;
    }

    mostrarMensagem("Salvando agendamento...");

    await addDoc(collection(db, "agendamentos"), {
      nome,
      telefone,
      servico,
      barbeiro,
      emailBarbeiro,
      emailCliente: emailClienteLogado,
      data,
      hora,
      status: "pendente",
      criadoEm: new Date().toISOString()
    });

    mostrarMensagem("Agendamento realizado com sucesso!", "sucesso");
    form.reset();
    definirDataMinima();
    iniciarCampoHora();
  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    mostrarMensagem(`Erro ao salvar agendamento: ${error.message}`, "erro");
  }
});

// ===== INÍCIO =====
definirDataMinima();
iniciarCampoHora();