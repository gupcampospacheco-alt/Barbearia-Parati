import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const emailInput = document.getElementById("email");
const senhaInput = document.getElementById("senha");
const mensagem = document.getElementById("mensagem");
const btnLoginBarbeiro = document.getElementById("btnLoginBarbeiro");
const btnLoginAdmin = document.getElementById("btnLoginAdmin");

function mostrarMensagem(texto, tipo = "normal") {
  mensagem.textContent = texto;
  mensagem.className = "mensagem-login";
  if (tipo === "erro") mensagem.classList.add("erro");
  if (tipo === "sucesso") mensagem.classList.add("sucesso");
}

async function fazerLogin(destino) {
  const email = emailInput.value.trim();
  const senha = senhaInput.value.trim();

  if (!email || !senha) {
    mostrarMensagem("Preencha e-mail e senha.", "erro");
    return;
  }

  mostrarMensagem("Entrando...");

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    mostrarMensagem("Login realizado com sucesso!", "sucesso");
    window.location.href = destino;
  } catch (error) {
    console.error("Erro no login:", error);
    mostrarMensagem("Erro ao entrar. Confira o e-mail e a senha.", "erro");
  }
}

btnLoginBarbeiro.addEventListener("click", () => fazerLogin("painel-barbeiro.html"));
btnLoginAdmin.addEventListener("click", () => fazerLogin("painel-admin.html"));
