import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = document.getElementById("email");
const senha = document.getElementById("senha");
const msg = document.getElementById("msg");
const btnCadastro = document.getElementById("btnCadastro");
const btnLogin = document.getElementById("btnLogin");

function mostrarMensagem(texto, tipo = "normal") {
  msg.textContent = texto;
  msg.className = "mensagem-login";
  if (tipo === "erro") msg.classList.add("erro");
  if (tipo === "sucesso") msg.classList.add("sucesso");
}

function camposPreenchidos() {
  if (!email.value.trim() || !senha.value.trim()) {
    mostrarMensagem("Preencha e-mail e senha.", "erro");
    return false;
  }
  return true;
}

btnCadastro.addEventListener("click", async () => {
  if (!camposPreenchidos()) return;

  try {
    await createUserWithEmailAndPassword(auth, email.value.trim(), senha.value.trim());
    mostrarMensagem("Conta criada com sucesso!", "sucesso");
    window.location.href = "cliente-dashboard.html";
  } catch (error) {
    console.error("Erro ao criar conta:", error);
    mostrarMensagem("Erro ao criar conta. Verifique os dados.", "erro");
  }
});

btnLogin.addEventListener("click", async () => {
  if (!camposPreenchidos()) return;

  try {
    await signInWithEmailAndPassword(auth, email.value.trim(), senha.value.trim());
    window.location.href = "cliente-dashboard.html";
  } catch (error) {
    console.error("Erro no login do cliente:", error);
    mostrarMensagem("Erro ao entrar. Confira o e-mail e a senha.", "erro");
  }
});
