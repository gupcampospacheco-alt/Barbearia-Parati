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

const faturamentoEl = document.getElementById("faturamentoAdmin");
const totalAgendamentosEl = document.getElementById("totalAgendamentos");
const clientesUnicosEl = document.getElementById("clientesUnicos");

let agendamentosCache = [];

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  adminLogado.textContent = `Admin: ${user.email}`;
  carregarTudoTempoReal();
});

function calcularFaturamento(lista) {
  const valores = {
    "Corte": 35,
    "Barba": 25,
    "Combo": 55
  };

  return lista.reduce((total, item) => {
    return total + (valores[item.servico] || 0);
  }, 0);
}

function calcularClientesUnicos(lista) {
  const clientes = new Set(lista.map(item => item.telefone));
  return clientes.size;
}

function carregarTudoTempoReal() {
  const ref = collection(db, "agendamentos");

  onSnapshot(ref, (snapshot) => {
    agendamentosCache = [];

    snapshot.forEach(doc => {
      agendamentosCache.push({
        id: doc.id,
        ...doc.data()
      });
    });

    renderizarAdmin();
  });
}

function renderizarAdmin() {
  if (agendamentosCache.length === 0) {
    listaAdmin.innerHTML = "<p>Nenhum agendamento</p>";
    return;
  }

  // DASHBOARD
  faturamentoEl.textContent = "R$ " + calcularFaturamento(agendamentosCache);
  totalAgendamentosEl.textContent = agendamentosCache.length;
  clientesUnicosEl.textContent = calcularClientesUnicos(agendamentosCache);

  listaAdmin.innerHTML = "";

  agendamentosCache.forEach((dados) => {
    const card = document.createElement("div");

    card.innerHTML = `
      <div style="border:1px solid #333; padding:15px; margin-bottom:10px; border-radius:10px;">
        <strong>${dados.nome}</strong><br>
        💈 ${dados.barbeiro}<br>
        📅 ${dados.data} - ${dados.hora}<br>
        📞 ${dados.telefone}<br>
        🔧 ${dados.servico}
      </div>
    `;

    listaAdmin.appendChild(card);
  });
}

btnSair.addEventListener("click", async () => {
  await signOut(auth);
  window.location.href = "login.html";
});