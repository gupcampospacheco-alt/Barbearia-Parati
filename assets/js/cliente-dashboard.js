import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const clienteLogado = document.getElementById("clienteLogado");
const listaCliente = document.getElementById("listaCliente");
const listaNotificacoes = document.getElementById("listaNotificacoes");
const btnSair = document.getElementById("btnSair");
const totalCliente = document.getElementById("totalCliente");
const proximosCliente = document.getElementById("proximosCliente");
const atendidosCliente = document.getElementById("atendidosCliente");
const canceladosCliente = document.getElementById("canceladosCliente");
const btnAtivarAvisosTempoReal = document.getElementById("btnAtivarAvisosTempoReal");
const statusAvisosTempoReal = document.getElementById("statusAvisosTempoReal");

const ROTULOS_STATUS = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado"
};

let agendamentosCache = [];
let unsubscribeCliente = null;
let primeiroCarregamento = true;
const notificacoesConhecidas = new Set();

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "cliente-login.html";
    return;
  }

  clienteLogado.textContent = `Logado como: ${user.email}`;
  atualizarStatusAvisosTempoReal();
  carregarAgendamentosDoCliente(user.email);
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

function statusNormalizado(status) {
  return status || "pendente";
}

function rotuloStatus(status) {
  return ROTULOS_STATUS[status] || ROTULOS_STATUS.pendente;
}

function ordenarAgendamentos(lista) {
  return [...lista].sort((a, b) => `${a.data || ""} ${a.hora || ""}`.localeCompare(`${b.data || ""} ${b.hora || ""}`));
}

function carregarAgendamentosDoCliente(emailCliente) {
  if (unsubscribeCliente) unsubscribeCliente();

  const q = query(
    collection(db, "agendamentos"),
    where("emailCliente", "==", emailCliente)
  );

  unsubscribeCliente = onSnapshot(q, (snapshot) => {
    const novosAgendamentos = snapshot.docs.map((docItem) => ({
      id: docItem.id,
      ...docItem.data()
    }));

    verificarAvisosTempoReal(novosAgendamentos);
    agendamentosCache = novosAgendamentos;
    renderizarCliente();
  }, (error) => {
    console.error("Erro ao carregar cliente:", error);
    listaCliente.innerHTML = `<p class="vazio">Erro ao carregar agendamentos: ${escaparHTML(error.message)}</p>`;
  });
}

function atualizarResumo() {
  const hojeISO = hojeEmFormatoISO();
  const proximos = agendamentosCache.filter((item) => item.data >= hojeISO && statusNormalizado(item.status) !== "cancelado");

  totalCliente.textContent = agendamentosCache.length;
  proximosCliente.textContent = proximos.length;
  atendidosCliente.textContent = agendamentosCache.filter((item) => ["confirmado", "atendido"].includes(statusNormalizado(item.status))).length;
  canceladosCliente.textContent = agendamentosCache.filter((item) => statusNormalizado(item.status) === "cancelado").length;
}

function notificacaoFallback(dados) {
  const status = statusNormalizado(dados.status);
  const barbeiro = dados.barbeiro || "o barbeiro";
  const data = formatarDataBR(dados.data);
  const hora = dados.hora || "-";

  if (status === "confirmado") {
    return `Seu agendamento com ${barbeiro} no dia ${data} às ${hora} foi confirmado.`;
  }

  if (status === "atendido") {
    return `Seu atendimento com ${barbeiro} no dia ${data} às ${hora} foi marcado como concluído.`;
  }

  if (status === "cancelado") {
    return `Seu agendamento com ${barbeiro} no dia ${data} às ${hora} foi cancelado.`;
  }

  return "";
}

function dadosNotificacao(item) {
  const status = statusNormalizado(item.status);
  const tituloPadrao = `Agendamento ${rotuloStatus(status).toLowerCase()}`;

  return {
    id: item.id,
    status,
    tipo: item.notificacaoCliente?.tipo || status,
    titulo: item.notificacaoCliente?.titulo || tituloPadrao,
    mensagem: item.notificacaoCliente?.mensagem || notificacaoFallback(item),
    criadaEm: item.notificacaoCliente?.criadaEm || item.statusAtualizadoEm || item.criadoEm || ""
  };
}

function chaveNotificacao(item) {
  const dados = dadosNotificacao(item);
  return `${dados.id}:${dados.tipo}:${dados.criadaEm}`;
}

function verificarAvisosTempoReal(novosAgendamentos) {
  const notificaveis = novosAgendamentos
    .filter((item) => statusNormalizado(item.status) !== "pendente")
    .filter((item) => dadosNotificacao(item).mensagem);

  if (primeiroCarregamento) {
    notificaveis.forEach((item) => notificacoesConhecidas.add(chaveNotificacao(item)));
    primeiroCarregamento = false;
    return;
  }

  notificaveis.forEach((item) => {
    const chave = chaveNotificacao(item);
    if (notificacoesConhecidas.has(chave)) return;

    notificacoesConhecidas.add(chave);
    const notificacao = dadosNotificacao(item);
    mostrarAvisoTempoReal(notificacao);
  });
}

function garantirToastContainer() {
  let container = document.getElementById("toastContainer");

  if (!container) {
    container = document.createElement("div");
    container.id = "toastContainer";
    container.className = "toast-container";
    document.body.appendChild(container);
  }

  return container;
}

function mostrarAvisoTempoReal(notificacao) {
  const container = garantirToastContainer();
  const toast = document.createElement("div");
  toast.className = `toast-aviso ${notificacao.tipo}`;
  toast.innerHTML = `
    <strong>${escaparHTML(notificacao.titulo)}</strong>
    <span>${escaparHTML(notificacao.mensagem)}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add("ativo"), 30);
  setTimeout(() => {
    toast.classList.remove("ativo");
    setTimeout(() => toast.remove(), 250);
  }, 7000);

  if (podeMostrarNotificacaoLocal()) {
    try {
      new Notification("Barbearia Parati", {
        body: notificacao.mensagem,
        icon: "assets/img/icon-192.png"
      });
    } catch (error) {
      console.warn("Não foi possível mostrar notificação local:", error);
    }
  }
}

function podeMostrarNotificacaoLocal() {
  return "Notification" in window
    && Notification.permission === "granted"
    && localStorage.getItem("avisosTempoRealAtivos") === "true";
}

function atualizarStatusAvisosTempoReal() {
  if (!statusAvisosTempoReal) return;

  if (!("Notification" in window)) {
    statusAvisosTempoReal.textContent = "Seu navegador não permite notificação local, mas os avisos dentro da página continuam funcionando.";
    statusAvisosTempoReal.className = "mensagem-config erro";
    return;
  }

  if (Notification.permission === "granted" && localStorage.getItem("avisosTempoRealAtivos") === "true") {
    statusAvisosTempoReal.textContent = "Avisos em tempo real ativados enquanto esta página estiver aberta.";
    statusAvisosTempoReal.className = "mensagem-config sucesso";
    return;
  }

  if (Notification.permission === "denied") {
    statusAvisosTempoReal.textContent = "As notificações foram bloqueadas no navegador. Ainda assim, os avisos internos aparecem nesta página.";
    statusAvisosTempoReal.className = "mensagem-config erro";
    return;
  }

  statusAvisosTempoReal.textContent = "Os avisos internos já funcionam. Ative o aviso do navegador para reforçar quando a página estiver aberta.";
  statusAvisosTempoReal.className = "mensagem-config";
}

async function ativarAvisosTempoReal() {
  if (!("Notification" in window)) {
    atualizarStatusAvisosTempoReal();
    return;
  }

  try {
    const permissao = await Notification.requestPermission();

    if (permissao === "granted") {
      localStorage.setItem("avisosTempoRealAtivos", "true");
      mostrarAvisoTempoReal({
        tipo: "confirmado",
        titulo: "Avisos ativados",
        mensagem: "Você verá avisos enquanto esta página estiver aberta."
      });
    }
  } catch (error) {
    console.error("Erro ao ativar avisos:", error);
  } finally {
    atualizarStatusAvisosTempoReal();
  }
}

function renderizarNotificacoes() {
  const notificacoes = ordenarAgendamentos(agendamentosCache)
    .filter((item) => statusNormalizado(item.status) !== "pendente")
    .map(dadosNotificacao)
    .filter((item) => item.mensagem)
    .sort((a, b) => String(b.criadaEm).localeCompare(String(a.criadaEm)));

  if (notificacoes.length === 0) {
    listaNotificacoes.innerHTML = '<p class="vazio">Nenhuma notificação no momento.</p>';
    return;
  }

  listaNotificacoes.innerHTML = notificacoes.map((notificacao) => `
    <div class="notificacao ${escaparHTML(notificacao.tipo)}">
      <strong>${escaparHTML(notificacao.titulo)}</strong>
      <span>${escaparHTML(notificacao.mensagem)}</span>
    </div>
  `).join("");
}

function renderizarAgendamentos() {
  const ordenados = ordenarAgendamentos(agendamentosCache);

  if (ordenados.length === 0) {
    listaCliente.innerHTML = '<p class="vazio">Você ainda não tem agendamentos.</p>';
    return;
  }

  listaCliente.innerHTML = ordenados.map((dados) => {
    const statusAtual = statusNormalizado(dados.status);

    return `
      <article class="agendamento-card">
        <div class="card-topo">
          <h3>${escaparHTML(dados.servico || "Agendamento")}</h3>
          <span class="status ${escaparHTML(statusAtual)}">${escaparHTML(rotuloStatus(statusAtual))}</span>
        </div>
        <p><strong>Barbeiro:</strong> ${escaparHTML(dados.barbeiro || "-")}</p>
        <p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>
        <p><strong>Hora:</strong> ${escaparHTML(dados.hora || "-")}</p>
        <p><strong>Telefone usado:</strong> ${escaparHTML(dados.telefone || "-")}</p>
      </article>
    `;
  }).join("");
}

function renderizarCliente() {
  atualizarResumo();
  renderizarNotificacoes();
  renderizarAgendamentos();
}

if (btnAtivarAvisosTempoReal) {
  btnAtivarAvisosTempoReal.addEventListener("click", ativarAvisosTempoReal);
}

btnSair.addEventListener("click", async (e) => {
  e.preventDefault();
  await signOut(auth);
  window.location.href = "cliente-login.html";
});
