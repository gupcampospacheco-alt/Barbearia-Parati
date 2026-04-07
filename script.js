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

const form = document.getElementById("formAgendamento");
const mensagem = document.getElementById("mensagemAgendamento");

const inputNome = document.getElementById("nome");
const inputTelefone = document.getElementById("telefone");
const selectServico = document.getElementById("servico");
const selectBarbeiro = document.getElementById("barbeiro");
const inputData = document.getElementById("data");
const inputHora = document.getElementById("hora");

let emailClienteLogado = null;

const barbeiros = {
  "João": "joao@barbeariaparati.com",
  "Carlos": "carlos@barbeariaparati.com",
  "Mateus": "mateus@barbeariaparati.com"
};

const HORARIO_INICIO = 9;
const HORARIO_FIM = 19;
const INTERVALO_MINUTOS = 60;

onAuthStateChanged(auth, (user) => {
  emailClienteLogado = user?.email || null;
});

function mostrarMensagem(texto, tipo = "normal") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem";

  if (tipo === "sucesso") {
    mensagem.classList.add("sucesso");
  } else if (tipo === "erro") {
    mensagem.classList.add("erro");
  }
}

function formatarNumero(numero) {
  return String(numero).padStart(2, "0");
}

function hojeISO() {
  const hoje = new Date();
  return `${hoje.getFullYear()}-${formatarNumero(hoje.getMonth() + 1)}-${formatarNumero(hoje.getDate())}`;
}

function definirDataMinima() {
  inputData.min = hojeISO();
}

function gerarHorariosBase() {
  const horarios = [];

  for (let hora = HORARIO_INICIO; hora <= HORARIO_FIM; hora++) {
    horarios.push(`${formatarNumero(hora)}:00`);
  }

  return horarios;
}

function limparHorarios() {
  inputHora.innerHTML = "";
}

function criarOpcaoHora(valor, texto, desabilitada = false) {
  const option = document.createElement("option");
  option.value = valor;
  option.textContent = texto;
  option.disabled = desabilitada;
  return option;
}

function horarioJaPassou(dataSelecionada, horaSelecionada) {
  const agora = new Date();
  const hoje = hojeISO();

  if (dataSelecionada !== hoje) return false;

  const [hora, minuto] = horaSelecionada.split(":").map(Number);
  const horarioComparado = new Date();
  horarioComparado.setHours(hora, minuto, 0, 0);

  return horarioComparado <= agora;
}

async function buscarHorariosOcupados(data, barbeiro) {
  const agendamentosRef = collection(db, "agendamentos");

  const q = query(
    agendamentosRef,
    where("data", "==", data),
    where("barbeiro", "==", barbeiro)
  );

  const snapshot = await getDocs(q);
  const horarios = [];

  snapshot.forEach((docItem) => {
    const dados = docItem.data();
    if (dados.hora) {
      horarios.push(dados.hora);
    }
  });

  return horarios;
}

async function atualizarHorariosDisponiveis() {
  const data = inputData.value;
  const barbeiro = selectBarbeiro.value;

  limparHorarios();

  inputHora.appendChild(
    criarOpcaoHora("", "Escolha um horário", true)
  );
  inputHora.value = "";

  if (!data || !barbeiro) {
    return;
  }

  try {
    const horariosBase = gerarHorariosBase();
    const horariosOcupados = await buscarHorariosOcupados(data, barbeiro);

    horariosBase.forEach((hora) => {
      const ocupado = horariosOcupados.includes(hora);
      const passou = horarioJaPassou(data, hora);

      if (ocupado) {
        inputHora.appendChild(
          criarOpcaoHora(hora, `${hora} - ocupado`, true)
        );
      } else if (passou) {
        inputHora.appendChild(
          criarOpcaoHora(hora, `${hora} - indisponível`, true)
        );
      } else {
        inputHora.appendChild(
          criarOpcaoHora(hora, hora, false)
        );
      }
    });
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    mostrarMensagem("Erro ao carregar horários disponíveis.", "erro");
  }
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

function dadosValidos({ nome, telefone, servico, barbeiro, data, hora }) {
  return nome && telefone && servico && barbeiro && data && hora;
}

function telefoneNormalizado(telefone) {
  return telefone.replace(/\D/g, "");
}

inputData.addEventListener("change", atualizarHorariosDisponiveis);
selectBarbeiro.addEventListener("change", atualizarHorariosDisponiveis);

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const nome = inputNome.value.trim();
  const telefone = telefoneNormalizado(inputTelefone.value.trim());
  const servico = selectServico.value;
  const barbeiro = selectBarbeiro.value;
  const data = inputData.value;
  const hora = inputHora.value;
  const emailBarbeiro = barbeiros[barbeiro] || null;

  if (!dadosValidos({ nome, telefone, servico, barbeiro, data, hora })) {
    mostrarMensagem("Preencha todos os campos.", "erro");
    return;
  }

  if (!emailBarbeiro) {
    mostrarMensagem("Barbeiro inválido.", "erro");
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
    limparHorarios();
    inputHora.appendChild(
      criarOpcaoHora("", "Escolha primeiro a data e o barbeiro", true)
    );
  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    mostrarMensagem(`Erro ao salvar agendamento: ${error.message}`, "erro");
  }
});

function iniciarCampoHora() {
  limparHorarios();
  inputHora.appendChild(
    criarOpcaoHora("", "Escolha primeiro a data e o barbeiro", true)
  );
}

definirDataMinima();
iniciarCampoHora();