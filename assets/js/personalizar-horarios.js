import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const barbeiroLogado = document.getElementById("barbeiroLogado");
const btnSair = document.getElementById("btnSair");
const formConfigAgenda = document.getElementById("formConfigAgenda");
const agendaNome = document.getElementById("agendaNome");
const horaInicio = document.getElementById("horaInicio");
const horaFim = document.getElementById("horaFim");
const intervaloMinutos = document.getElementById("intervaloMinutos");
const bloqueiosAgenda = document.getElementById("bloqueiosAgenda");
const btnUsarPadrao = document.getElementById("btnUsarPadrao");
const mensagemConfigAgenda = document.getElementById("mensagemConfigAgenda");

let usuarioAtual = null;

const CONFIG_PADRAO = {
  nome: "Barbeiro",
  horaInicio: "09:00",
  horaFim: "19:00",
  intervaloMinutos: 60,
  bloqueios: ["12:00"],
  diasFechados: [0]
};

const NOMES_PADRAO_POR_EMAIL = {
  "joao@barbeariaparati.com": "João",
  "carlos@barbeariaparati.com": "Carlos",
  "mateus@barbeariaparati.com": "Mateus"
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  usuarioAtual = user;
  barbeiroLogado.textContent = `Logado como: ${user.email}`;
  await carregarConfiguracaoAgenda(user.email);
});

function idConfigBarbeiro(email) {
  return String(email || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "_");
}

function horaValida(valor) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(String(valor || ""));
}

function horaParaMinutos(hora) {
  const [h, m] = String(hora || "00:00").split(":").map(Number);
  return (h * 60) + (m || 0);
}

function nomePadrao(email) {
  return NOMES_PADRAO_POR_EMAIL[String(email || "").toLowerCase()]
    || String(email || "barbeiro")
      .split("@")[0]
      .replace(/[._-]/g, " ")
      .replace(/\b\w/g, (letra) => letra.toUpperCase());
}

function normalizarBloqueios(texto) {
  return String(texto || "")
    .split(/[\s,;]+/)
    .map((item) => item.trim())
    .filter(Boolean)
    .filter(horaValida)
    .filter((hora, index, lista) => lista.indexOf(hora) === index)
    .sort();
}

function obterDiasFechadosMarcados() {
  return [...document.querySelectorAll('input[name="diasFechados"]:checked')]
    .map((input) => Number(input.value));
}

function marcarDiasFechados(dias = []) {
  document.querySelectorAll('input[name="diasFechados"]').forEach((input) => {
    input.checked = dias.map(Number).includes(Number(input.value));
  });
}

function preencherFormularioConfig(config) {
  agendaNome.value = config.nome || nomePadrao(usuarioAtual?.email);
  horaInicio.value = config.horaInicio || "09:00";
  horaFim.value = config.horaFim || "19:00";
  intervaloMinutos.value = String(config.intervaloMinutos || 60);
  bloqueiosAgenda.value = Array.isArray(config.bloqueios) ? config.bloqueios.join(", ") : "";
  marcarDiasFechados(Array.isArray(config.diasFechados) ? config.diasFechados : [0]);
}

function mostrarMensagemConfig(texto, tipo = "normal") {
  mensagemConfigAgenda.textContent = texto;
  mensagemConfigAgenda.className = "vazio mensagem-config";
  if (tipo === "sucesso") mensagemConfigAgenda.classList.add("sucesso");
  if (tipo === "erro") mensagemConfigAgenda.classList.add("erro");
}

function configPadraoParaUsuario(email) {
  return {
    ...CONFIG_PADRAO,
    nome: nomePadrao(email),
    email
  };
}

async function carregarConfiguracaoAgenda(email) {
  mostrarMensagemConfig("Carregando configuração...");

  try {
    const ref = doc(db, "barbeiros", idConfigBarbeiro(email));
    const snapshot = await getDoc(ref);

    if (snapshot.exists()) {
      preencherFormularioConfig({ ...configPadraoParaUsuario(email), ...snapshot.data() });
      mostrarMensagemConfig("Configuração carregada.", "sucesso");
      return;
    }

    preencherFormularioConfig(configPadraoParaUsuario(email));
    mostrarMensagemConfig("Você ainda não salvou horários personalizados. O site está usando o padrão.");
  } catch (error) {
    console.error("Erro ao carregar configuração:", error);
    preencherFormularioConfig(configPadraoParaUsuario(email));
    mostrarMensagemConfig("Não consegui carregar a configuração. Confira as regras do Firebase.", "erro");
  }
}

async function salvarConfiguracaoAgenda() {
  if (!usuarioAtual) return;

  const nome = agendaNome.value.trim();
  const inicio = horaInicio.value;
  const fim = horaFim.value;
  const intervalo = Number(intervaloMinutos.value);
  const bloqueios = normalizarBloqueios(bloqueiosAgenda.value);
  const diasFechados = obterDiasFechadosMarcados();

  if (!nome || !horaValida(inicio) || !horaValida(fim)) {
    mostrarMensagemConfig("Preencha nome, início e fim corretamente.", "erro");
    return;
  }

  if (horaParaMinutos(inicio) >= horaParaMinutos(fim)) {
    mostrarMensagemConfig("O início precisa ser antes do fim do atendimento.", "erro");
    return;
  }

  if (![30, 45, 60, 90].includes(intervalo)) {
    mostrarMensagemConfig("Escolha um intervalo válido.", "erro");
    return;
  }

  const dados = {
    nome,
    email: usuarioAtual.email,
    horaInicio: inicio,
    horaFim: fim,
    intervaloMinutos: intervalo,
    bloqueios,
    diasFechados,
    atualizadoEm: new Date().toISOString()
  };

  try {
    await setDoc(doc(db, "barbeiros", idConfigBarbeiro(usuarioAtual.email)), dados, { merge: true });
    preencherFormularioConfig(dados);
    mostrarMensagemConfig("Horários salvos! O cliente já verá essa agenda no site.", "sucesso");
  } catch (error) {
    console.error("Erro ao salvar configuração:", error);
    mostrarMensagemConfig(`Erro ao salvar: ${error.message}`, "erro");
  }
}

formConfigAgenda.addEventListener("submit", async (e) => {
  e.preventDefault();
  await salvarConfiguracaoAgenda();
});

btnUsarPadrao.addEventListener("click", () => {
  if (!usuarioAtual) return;
  preencherFormularioConfig(configPadraoParaUsuario(usuarioAtual.email));
  mostrarMensagemConfig("Padrão preenchido. Clique em salvar para aplicar.");
});

btnSair.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
});
