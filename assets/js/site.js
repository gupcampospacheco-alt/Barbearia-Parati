import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
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
const selectHora = document.getElementById("hora");

let emailClienteLogado = null;
let barbeiros = {};

const BARBEIROS_PADRAO = {
  "João": {
    nome: "João",
    email: "joao@barbeariaparati.com",
    horaInicio: "09:00",
    horaFim: "19:00",
    intervaloMinutos: 60,
    bloqueios: ["12:00"],
    diasFechados: [0]
  },
  "Carlos": {
    nome: "Carlos",
    email: "carlos@barbeariaparati.com",
    horaInicio: "10:00",
    horaFim: "20:00",
    intervaloMinutos: 60,
    bloqueios: ["12:00"],
    diasFechados: [0]
  },
  "Mateus": {
    nome: "Mateus",
    email: "mateus@barbeariaparati.com",
    horaInicio: "08:00",
    horaFim: "18:00",
    intervaloMinutos: 60,
    bloqueios: ["12:00"],
    diasFechados: [0]
  }
};

onAuthStateChanged(auth, (user) => {
  emailClienteLogado = user?.email || null;
});

function mostrarMensagem(texto, tipo = "normal") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem";
  if (tipo === "sucesso") mensagem.classList.add("sucesso");
  if (tipo === "erro") mensagem.classList.add("erro");
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
  selectHora.innerHTML = "";
}

function adicionarOpcaoHora(valor, texto, desabilitada = false, selecionada = false) {
  const option = document.createElement("option");
  option.value = valor;
  option.textContent = texto;
  option.disabled = desabilitada;
  option.selected = selecionada;
  selectHora.appendChild(option);
}

function iniciarCampoHora(texto = "Escolha primeiro a data e o barbeiro") {
  limparCampoHora();
  adicionarOpcaoHora("", texto, true, true);
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

function diaDaSemana(dataSelecionada) {
  if (!dataSelecionada) return null;
  const data = new Date(`${dataSelecionada}T00:00:00`);
  return data.getDay();
}

function horarioJaPassou(dataSelecionada, horaSelecionada) {
  if (!dataSelecionada || !horaSelecionada) return false;
  if (dataSelecionada !== obterHojeISO()) return false;

  const [hora, minuto] = horaSelecionada.split(":").map(Number);
  const horarioSelecionado = new Date();
  horarioSelecionado.setHours(hora, minuto, 0, 0);

  return horarioSelecionado <= new Date();
}

function horaParaMinutos(hora) {
  const [h, m] = String(hora || "00:00").split(":").map(Number);
  return (h * 60) + (m || 0);
}

function minutosParaHora(minutos) {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${doisDigitos(h)}:${doisDigitos(m)}`;
}

function intervaloSeguro(valor) {
  const intervalo = Number(valor || 60);
  return intervalo > 0 ? intervalo : 60;
}

function nomePadraoPorEmail(email) {
  return String(email || "barbeiro")
    .split("@")[0]
    .replace(/[._-]/g, " ")
    .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function normalizarConfigBarbeiro(dados = {}) {
  const email = String(dados.email || "").trim().toLowerCase();

  return {
    nome: dados.nome || nomePadraoPorEmail(email),
    email,
    horaInicio: dados.horaInicio || dados.inicio || "09:00",
    horaFim: dados.horaFim || dados.fim || "18:00",
    intervaloMinutos: intervaloSeguro(dados.intervaloMinutos),
    bloqueios: Array.isArray(dados.bloqueios) ? dados.bloqueios : [],
    diasFechados: Array.isArray(dados.diasFechados) ? dados.diasFechados.map(Number) : []
  };
}

async function carregarBarbeiros() {
  iniciarCampoHora("Carregando horários...");

  try {
    const snapshot = await getDocs(collection(db, "barbeiros"));
    const barbeirosDoFirebase = {};

    snapshot.forEach((docItem) => {
      const config = normalizarConfigBarbeiro(docItem.data());
      if (config.nome && config.email) {
        barbeirosDoFirebase[config.nome] = config;
      }
    });

    // Mantém os barbeiros padrão caso algum ainda não tenha salvo agenda personalizada.
    barbeiros = { ...BARBEIROS_PADRAO, ...barbeirosDoFirebase };
  } catch (error) {
    console.warn("Não foi possível carregar barbeiros personalizados. Usando padrão.", error);
    barbeiros = { ...BARBEIROS_PADRAO };
    mostrarMensagem("Não consegui carregar a agenda personalizada. Confira as regras do Firebase.", "erro");
  }

  preencherSelectBarbeiros();
  await atualizarHorariosDisponiveis();
}

function preencherSelectBarbeiros() {
  const barbeiroSelecionado = selectBarbeiro.value;
  selectBarbeiro.innerHTML = '<option value="">Escolha o barbeiro</option>';

  Object.keys(barbeiros).sort().forEach((nome) => {
    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    selectBarbeiro.appendChild(option);
  });

  if (barbeiroSelecionado && barbeiros[barbeiroSelecionado]) {
    selectBarbeiro.value = barbeiroSelecionado;
  }
}

function gerarHorariosPorBarbeiro(barbeiro) {
  const config = barbeiros[barbeiro];
  if (!config) return [];

  const inicio = horaParaMinutos(config.horaInicio);
  const fim = horaParaMinutos(config.horaFim);
  const intervalo = intervaloSeguro(config.intervaloMinutos);
  const horarios = [];

  // Exemplo: início 09:00, fim 18:00 e intervalo 60.
  // O último horário será 17:00, porque 18:00 é o fim do expediente.
  for (let minuto = inicio; minuto + intervalo <= fim; minuto += intervalo) {
    horarios.push(minutosParaHora(minuto));
  }

  return horarios;
}

function barbeiroAtendeNoDia(barbeiro, dataSelecionada) {
  const config = barbeiros[barbeiro];
  const dia = diaDaSemana(dataSelecionada);
  if (!config || dia === null) return true;
  return !config.diasFechados.includes(dia);
}

function dadosValidos({ nome, telefone, servico, barbeiro, data, hora }) {
  return Boolean(nome && telefone && servico && barbeiro && data && hora);
}

function agendamentoAtivo(dados = {}) {
  const status = dados.status || "pendente";
  return Boolean(dados.hora && status !== "cancelado");
}

async function buscarHorariosOcupados(data, barbeiro) {
  const config = barbeiros[barbeiro];
  const emailBarbeiro = String(config?.email || "").toLowerCase();

  const q = query(
    collection(db, "agendamentos"),
    where("data", "==", data)
  );

  const snapshot = await getDocs(q);
  const horariosOcupados = [];

  snapshot.forEach((docItem) => {
    const dados = docItem.data();
    const mesmoEmail = emailBarbeiro && String(dados.emailBarbeiro || "").toLowerCase() === emailBarbeiro;
    const mesmoNome = dados.barbeiro === barbeiro;

    if ((mesmoEmail || mesmoNome) && agendamentoAtivo(dados)) {
      horariosOcupados.push(dados.hora);
    }
  });

  return [...new Set(horariosOcupados)].sort();
}

function horarioConflitaComAgendamento(horaCandidata, horariosOcupados, intervaloMinutos) {
  const inicioCandidato = horaParaMinutos(horaCandidata);
  const fimCandidato = inicioCandidato + intervaloSeguro(intervaloMinutos);

  return horariosOcupados.some((horaOcupada) => {
    const inicioOcupado = horaParaMinutos(horaOcupada);
    const fimOcupado = inicioOcupado + intervaloSeguro(intervaloMinutos);

    // Existe conflito quando os blocos de tempo se cruzam.
    // Ex: agendamento 15:00 e intervalo 60 => 15:00 até 16:00 fica ocupado.
    return inicioCandidato < fimOcupado && fimCandidato > inicioOcupado;
  });
}

function horarioBloqueadoPorPausa(horaCandidata, bloqueios = [], intervaloMinutos = 60) {
  if (!Array.isArray(bloqueios) || bloqueios.length === 0) return false;
  return horarioConflitaComAgendamento(horaCandidata, bloqueios, intervaloMinutos);
}

async function horarioDisponivel(data, hora, barbeiro) {
  const config = barbeiros[barbeiro];
  if (!config) return false;

  if (dataPassada(data) || horarioJaPassou(data, hora)) return false;
  if (!barbeiroAtendeNoDia(barbeiro, data)) return false;
  if (horarioBloqueadoPorPausa(hora, config.bloqueios, config.intervaloMinutos)) return false;

  const horariosOcupados = await buscarHorariosOcupados(data, barbeiro);
  return !horarioConflitaComAgendamento(hora, horariosOcupados, config.intervaloMinutos);
}

async function atualizarHorariosDisponiveis() {
  const data = inputData.value;
  const barbeiro = selectBarbeiro.value;
  const config = barbeiros[barbeiro];

  limparCampoHora();

  if (!data || !barbeiro) {
    adicionarOpcaoHora("", "Escolha primeiro a data e o barbeiro", true, true);
    return;
  }

  adicionarOpcaoHora("", "Carregando horários disponíveis...", true, true);

  if (!config) {
    iniciarCampoHora("Barbeiro não encontrado");
    mostrarMensagem("Barbeiro não encontrado.", "erro");
    return;
  }

  if (dataPassada(data)) {
    iniciarCampoHora("Data inválida");
    mostrarMensagem("Não é possível agendar em dias passados.", "erro");
    return;
  }

  if (!barbeiroAtendeNoDia(barbeiro, data)) {
    iniciarCampoHora("Esse barbeiro não atende nesse dia");
    mostrarMensagem("Esse barbeiro não atende nesse dia.", "erro");
    return;
  }

  try {
    const horariosBase = gerarHorariosPorBarbeiro(barbeiro);
    const horariosOcupados = await buscarHorariosOcupados(data, barbeiro);

    const horariosDisponiveis = horariosBase.filter((hora) => {
      if (horarioJaPassou(data, hora)) return false;
      if (horarioBloqueadoPorPausa(hora, config.bloqueios, config.intervaloMinutos)) return false;
      if (horarioConflitaComAgendamento(hora, horariosOcupados, config.intervaloMinutos)) return false;
      return true;
    });

    limparCampoHora();

    if (horariosDisponiveis.length === 0) {
      adicionarOpcaoHora("", "Nenhum horário disponível para esse dia", true, true);
    } else {
      adicionarOpcaoHora("", "Escolha um horário", true, true);
      horariosDisponiveis.forEach((hora) => adicionarOpcaoHora(hora, hora));
    }

    mostrarMensagem("");
  } catch (error) {
    console.error("Erro ao carregar horários:", error);
    iniciarCampoHora("Erro ao carregar horários");
    mostrarMensagem("Erro ao carregar horários disponíveis. Verifique as regras do Firebase.", "erro");
  }
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
  const hora = selectHora.value;
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

  mostrarMensagem("Verificando horário...");

  try {
    const disponivel = await horarioDisponivel(data, hora, barbeiro);

    if (!disponivel) {
      mostrarMensagem("Esse horário acabou de ficar indisponível. Escolha outro.", "erro");
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
      intervaloMinutos: intervaloSeguro(configBarbeiro.intervaloMinutos),
      status: "pendente",
      criadoEm: new Date().toISOString()
    });

    mostrarMensagem("Agendamento realizado com sucesso!", "sucesso");
    form.reset();
    definirDataMinima();
    iniciarCampoHora();
    await carregarBarbeiros();
  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    mostrarMensagem(`Erro ao salvar agendamento: ${error.message}`, "erro");
  }
});

definirDataMinima();
iniciarCampoHora("Carregando barbeiros...");
carregarBarbeiros();
