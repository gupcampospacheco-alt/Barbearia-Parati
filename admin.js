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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listaAdmin = document.getElementById("listaAdmin");
const adminLogado = document.getElementById("adminLogado");
const btnSair = document.getElementById("btnSair");
const filtroBarbeiro = document.getElementById("filtroBarbeiro");

let agendamentosCache = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  adminLogado.textContent = `Logado como: ${user.email}`;
  carregarTudoTempoReal();
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

function carregarTudoTempoReal() {
  const ref = collection(db, "agendamentos");

  onSnapshot(ref, (snapshot) => {
    agendamentosCache = [];

    snapshot.forEach((docItem) => {
      agendamentosCache.push({
        id: docItem.id,
        ...docItem.data()
      });
    });

    renderizarAdmin();
  }, (error) => {
    console.error(error);
    listaAdmin.innerHTML = `<p class="vazio">Erro ao carregar: ${error.message}</p>`;
  });
}

function renderizarAdmin() {
  const hojeISO = hojeEmFormatoISO();
  const filtro = filtroBarbeiro.value;

  let lista = agendamentosCache.filter(item => item.data && item.data >= hojeISO);

  if (filtro !== "todos") {
    lista = lista.filter(item => item.barbeiro === filtro);
  }

  lista.sort((a, b) => {
    const dataA = `${a.data || ""} ${a.hora || ""}`;
    const dataB = `${b.data || ""} ${b.hora || ""}`;
    return dataA.localeCompare(dataB);
  });

  if (lista.length === 0) {
    listaAdmin.innerHTML = '<p class="vazio">Nenhum agendamento encontrado.</p>';
    return;
  }

  listaAdmin.innerHTML = "";

  lista.forEach((dados) => {
    const statusAtual = dados.status || "pendente";

    const card = document.createElement("div");
    card.className = "agendamento-card";

    card.innerHTML = `
      <div class="card-topo">
        <h3>${dados.nome || "Cliente sem nome"}</h3>
        <span class="status ${statusAtual}">${statusAtual}</span>
      </div>

      <p><strong>Barbeiro:</strong> ${dados.barbeiro || "-"}</p>
      <p><strong>Serviço:</strong> ${dados.servico || "-"}</p>
      <p><strong>Telefone:</strong> ${dados.telefone || "-"}</p>
      <p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>
      <p><strong>Hora:</strong> ${dados.hora || "-"}</p>
    `;

    listaAdmin.appendChild(card);
  });
}

filtroBarbeiro.addEventListener("change", renderizarAdmin);

btnSair.addEventListener("click", async (e) => {
  e.preventDefault();

  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error(error);
  }
});