import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  getFirestore,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const lista = document.getElementById("listaCliente");

onAuthStateChanged(auth, async (user) => {
  if (!user) return;

  const q = query(
    collection(db, "agendamentos"),
    where("emailCliente", "==", user.email)
  );

  const snapshot = await getDocs(q);

  snapshot.forEach(doc => {
    const dados = doc.data();

    const div = document.createElement("div");
    div.innerHTML = `
      <div style="border:1px solid #333; margin:10px; padding:10px;">
        💈 ${dados.barbeiro} <br>
        📅 ${dados.data} <br>
        ⏰ ${dados.hora}
      </div>
    `;

    lista.appendChild(div);
  });
});