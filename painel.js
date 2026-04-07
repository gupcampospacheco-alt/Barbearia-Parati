import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listaAgendamentos = document.getElementById("listaAgendamentos");
const barbeiroLogado = document.getElementById("barbeiroLogado");
const btnSair = document.getElementById("btnSair");
const filtroStatus = document.getElementById("filtroStatus");
const filtroData = document.getElementById("filtroData");
const btnLimparFiltro = document.getElementById("btnLimparFiltro");

const resumoHoje = document.getElementById("resumoHoje");
const resumoPendentes = document.getElementById("resumoPendentes");
const resumoAtendidos = document.getElementById("resumoAtendidos");
const resumoCancelados = document.getElementById("resumoCancelados");

let agendamentosCache = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  const emailBarbeiro = user.email;
  barbeiroLogado.textContent = `Logado como: ${emailBarbeiro}`;
  filtroData.value = hojeEmFormatoISO();

  carregarAgendaTempoReal(emailBarbeiro);
});

function hojeEmFormatoISO() {
  const hoje = new Date();
  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");
  return `${ano}-${mes}-${dia}`;
}

function formatarDataBR(dataISO) {
  if (!dataISO || !dataISO.includes("-")) return dataISO || "-";
  const [ano, mes, dia] = dataISO.split("-");
  return `${dia}/${mes}/${ano}`;
}

function carregarAgendaTempoReal(emailBarbeiro) {
  listaAgendamentos.innerHTML = '<p class="vazio">Carregando agendamentos...</p>';

  const agendamentosRef = collection(db, "agendamentos");
  const q = query(agendamentosRef, where("emailBarbeiro", "==", emailBarbeiro));

  onSnapshot(
    q,
    (snapshot) => {
      agendamentosCache = [];

      snapshot.forEach((docItem) => {
        agendamentosCache.push({
          id: docItem.id,
          ...docItem.data()
        });
      });

      renderizarAgendamentos();
    },
    (error) => {
      console.error("Erro ao carregar agenda:", error);
      listaAgendamentos.innerHTML = `<p class="vazio">Erro ao carregar agendamentos: ${error.message}</p>`;
    }
  );
}

function pegarAgendamentosVisiveis() {
  const hojeISO = hojeEmFormatoISO();
  const dataSelecionada = filtroData.value;

  let lista = agendamentosCache.filter((item) => item.data && item.data >= hojeISO);

  if (dataSelecionada) {
    lista = lista.filter((item) => item.data === dataSelecionada);
  }

  return lista;
}

function atualizarResumo(listaBase) {
  const pendentes = listaBase.filter((item) => (item.status || "pendente") === "pendente");
  const atendidos = listaBase.filter((item) => item.status === "atendido");
  const cancelados = listaBase.filter((item) => item.status === "cancelado");

  resumoHoje.textContent = listaBase.length;
  resumoPendentes.textContent = pendentes.length;
  resumoAtendidos.textContent = atendidos.length;
  resumoCancelados.textContent = cancelados.length;
}

function ordenarAgendamentos(lista) {
  return [...lista].sort((a, b) => {
    const dataA = `${a.data || ""} ${a.hora || ""}`;
    const dataB = `${b.data || ""} ${b.hora || ""}`;
    return dataA.localeCompare(dataB);
  });
}

function renderizarAgendamentos() {
  const filtro = filtroStatus.value;
  const visiveis = pegarAgendamentosVisiveis();
  const ordenados = ordenarAgendamentos(visiveis);

  atualizarResumo(ordenados);

  let listaFiltrada = ordenados;

  if (filtro !== "todos") {
    listaFiltrada = ordenados.filter(
      (item) => (item.status || "pendente") === filtro
    );
  }

  if (listaFiltrada.length === 0) {
    listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento encontrado.</p>';
    return;
  }

  listaAgendamentos.innerHTML = "";

  listaFiltrada.forEach((dados) => {
    const statusAtual = dados.status || "pendente";

    const card = document.createElement("div");
    card.className = "agendamento-card";

    card.innerHTML = `
      <div class="card-topo">
        <h3>${dados.nome || "Cliente sem nome"}</h3>
        <span class="status ${statusAtual}">${statusAtual}</span>
      </div>

      <p><strong>Serviço:</strong> ${dados.servico || "-"}</p>
      <p><strong>Telefone:</strong> ${dados.telefone || "-"}</p>
      <p><strong>Barbeiro:</strong> ${dados.barbeiro || "-"}</p>
      <p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>
      <p><strong>Hora:</strong> ${dados.hora || "-"}</p>

      <div class="card-acoes">
        <button class="btn-acao btn-atendido" data-id="${dados.id}" data-status="atendido">✔ Atendido</button>
        <button class="btn-acao btn-cancelado" data-id="${dados.id}" data-status="cancelado">❌ Cancelar</button>
        <button class="btn-acao btn-pendente" data-id="${dados.id}" data-status="pendente">⏳ Pendente</button>
      </div>
    `;

    listaAgendamentos.appendChild(card);
  });

  adicionarEventosBotoes();
}

function adicionarEventosBotoes() {
  const botoes = document.querySelectorAll(".btn-acao");

  botoes.forEach((botao) => {
    botao.addEventListener("click", async () => {
      const id = botao.getAttribute("data-id");
      const novoStatus = botao.getAttribute("data-status");

      try {
        await updateDoc(doc(db, "agendamentos", id), {
          status: novoStatus
        });
      } catch (error) {
        console.error("Erro ao atualizar status:", error);
        alert("Erro ao atualizar status.");
      }
    });
  });
}

filtroStatus.addEventListener("change", renderizarAgendamentos);
filtroData.addEventListener("change", renderizarAgendamentos);

btnLimparFiltro.addEventListener("click", () => {
  filtroData.value = "";
  renderizarAgendamentos();
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