import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, 
  signInWithEmailAndPassword 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const btnLogin = document.getElementById("btnLogin");
const mensagem = document.getElementById("mensagem");

btnLogin.addEventListener("click", async () => {
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();

  if (!email || !senha) {
    mensagem.textContent = "Preencha e-mail e senha.";
    return;
  }

  mensagem.textContent = "Entrando...";

  try {
    await signInWithEmailAndPassword(auth, email, senha);
    mensagem.textContent = "Login realizado com sucesso!";
    window.location.href = "painel-barbeiro.html";
  } catch (error) {
    console.error("Erro no login:", error);
    mensagem.textContent = "Erro ao entrar: " + error.message;
  }
});