import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listaAdmin = document.getElementById("listaAdmin");
const adminLogado = document.getElementById("adminLogado");
const btnSair = document.getElementById("btnSair");
const filtroBarbeiro = document.getElementById("filtroBarbeiro");
const faturamentoEl = document.getElementById("faturamentoAdmin");
const totalAgendamentosEl = document.getElementById("totalAgendamentos");
const clientesUnicosEl = document.getElementById("clientesUnicos");
const agendamentosHojeEl = document.getElementById("agendamentosHoje");

let agendamentosCache = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  adminLogado.textContent = `Admin: ${user.email}`;
  carregarTudoTempoReal();
});

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[caractere]));
}

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

function calcularFaturamento(lista) {
  const valores = { Corte: 35, Barba: 25, Combo: 55 };
  return lista.reduce((total, item) => {
    if ((item.status || "pendente") === "cancelado") return total;
    return total + (valores[item.servico] || 0);
  }, 0);
}

function calcularClientesUnicos(lista) {
  const clientes = new Set(lista.map((item) => item.telefone).filter(Boolean));
  return clientes.size;
}

function ordenarAgendamentos(lista) {
  return [...lista].sort((a, b) => `${a.data || ""} ${a.hora || ""}`.localeCompare(`${b.data || ""} ${b.hora || ""}`));
}

function atualizarFiltroBarbeiros() {
  const selecionado = filtroBarbeiro.value || "todos";
  const nomes = [...new Set(agendamentosCache.map((item) => item.barbeiro).filter(Boolean))].sort();

  filtroBarbeiro.innerHTML = '<option value="todos">Todos os barbeiros</option>';

  nomes.forEach((nome) => {
    const option = document.createElement("option");
    option.value = nome;
    option.textContent = nome;
    filtroBarbeiro.appendChild(option);
  });

  if (selecionado === "todos" || nomes.includes(selecionado)) {
    filtroBarbeiro.value = selecionado;
  }
}

function carregarTudoTempoReal() {
  const ref = collection(db, "agendamentos");

  onSnapshot(ref, (snapshot) => {
    agendamentosCache = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    atualizarFiltroBarbeiros();
    renderizarAdmin();
  }, (error) => {
    console.error("Erro ao carregar admin:", error);
    listaAdmin.innerHTML = `<p class="vazio">Erro ao carregar agendamentos: ${escaparHTML(error.message)}</p>`;
  });
}

function filtrarPorBarbeiro(lista) {
  const barbeiroSelecionado = filtroBarbeiro.value;
  if (barbeiroSelecionado === "todos") return lista;
  return lista.filter((item) => item.barbeiro === barbeiroSelecionado);
}

function atualizarDashboard(lista) {
  const hojeISO = hojeEmFormatoISO();

  faturamentoEl.textContent = `R$ ${calcularFaturamento(lista)}`;
  totalAgendamentosEl.textContent = lista.length;
  clientesUnicosEl.textContent = calcularClientesUnicos(lista);
  agendamentosHojeEl.textContent = lista.filter((item) => item.data === hojeISO).length;
}

function renderizarAdmin() {
  const listaFiltrada = ordenarAgendamentos(filtrarPorBarbeiro(agendamentosCache));
  atualizarDashboard(listaFiltrada);

  if (listaFiltrada.length === 0) {
    listaAdmin.innerHTML = '<p class="vazio">Nenhum agendamento encontrado.</p>';
    return;
  }

  listaAdmin.innerHTML = listaFiltrada.map((dados) => {
    const statusAtual = dados.status || "pendente";

    return `
      <article class="agendamento-card">
        <div class="card-topo">
          <h3>${escaparHTML(dados.nome || "Cliente sem nome")}</h3>
          <span class="status ${escaparHTML(statusAtual)}">${escaparHTML(statusAtual)}</span>
        </div>
        <p><strong>Barbeiro:</strong> ${escaparHTML(dados.barbeiro || "-")}</p>
        <p><strong>Serviço:</strong> ${escaparHTML(dados.servico || "-")}</p>
        <p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>
        <p><strong>Hora:</strong> ${escaparHTML(dados.hora || "-")}</p>
        <p><strong>Telefone:</strong> ${escaparHTML(dados.telefone || "-")}</p>
        <p><strong>E-mail do cliente:</strong> ${escaparHTML(dados.emailCliente || "Não logado")}</p>
      </article>
    `;
  }).join("");
}

filtroBarbeiro.addEventListener("change", renderizarAdmin);

btnSair.addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "login.html";
});
