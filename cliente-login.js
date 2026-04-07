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

document.getElementById("btnCadastro").onclick = async () => {
  try {
    await createUserWithEmailAndPassword(auth, email.value, senha.value);
    msg.textContent = "Conta criada!";
  } catch (e) {
    msg.textContent = e.message;
  }
};

document.getElementById("btnLogin").onclick = async () => {
  try {
    await signInWithEmailAndPassword(auth, email.value, senha.value);
    window.location.href = "cliente-dashboard.html";
  } catch (e) {
    msg.textContent = e.message;
  }
};