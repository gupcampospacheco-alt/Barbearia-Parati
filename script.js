import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const form = document.getElementById("formAgendamento");
const mensagem = document.getElementById("mensagemAgendamento");

const barbeiros = {
  "João": "joao@barbeariaparati.com",
  "Carlos": "carlos@barbeariaparati.com",
  "Mateus": "mateus@barbeariaparati.com"
};

form.addEventListener("submit", async function (e) {
  e.preventDefault();

  const nome = document.getElementById("nome").value.trim();
  const telefone = document.getElementById("telefone").value.trim();
  const servico = document.getElementById("servico").value;
  const barbeiro = document.getElementById("barbeiro").value;
  const data = document.getElementById("data").value;
  const hora = document.getElementById("hora").value;

  if (!nome || !telefone || !servico || !barbeiro || !data || !hora) {
    mensagem.textContent = "Preencha todos os campos.";
    return;
  }

  const emailBarbeiro = barbeiros[barbeiro];

  if (!emailBarbeiro) {
    mensagem.textContent = "Barbeiro inválido.";
    return;
  }

  mensagem.textContent = "Salvando agendamento...";

  try {
    await addDoc(collection(db, "agendamentos"), {
      nome,
      telefone,
      servico,
      barbeiro,
      emailBarbeiro,
      data,
      hora,
      status: "pendente",
      criadoEm: new Date().toISOString()
    });

    mensagem.textContent = "Agendamento realizado com sucesso!";
    form.reset();
  } catch (error) {
    console.error("Erro ao salvar agendamento:", error);
    mensagem.textContent = "Erro ao salvar agendamento: " + error.message;
  }
});import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const agendamentosRef = collection(db, "agendamentos");

const q = query(
  agendamentosRef,
  where("data", "==", data),
  where("hora", "==", hora),
  where("barbeiro", "==", barbeiro)
);

const existente = await getDocs(q);

if (!existente.empty) {
  mensagem.textContent = "Esse horário já está ocupado.";
  return;
}