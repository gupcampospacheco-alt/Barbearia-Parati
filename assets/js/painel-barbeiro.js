import { firebaseConfig } from "./firebase-config.js";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const listaAgendamentos = document.getElementById("listaAgendamentos");
const barbeiroLogado = document.getElementById("barbeiroLogado");
const btnSair = document.getElementById("btnSair");
const filtroStatus = document.getElementById("filtroStatus");
const filtroData = document.getElementById("filtroData");
const btnLimparFiltro = document.getElementById("btnLimparFiltro");
const resumoHoje = document.getElementById("resumoHoje");
const resumoPendentes = document.getElementById("resumoPendentes");
const resumoAtendidos = document.getElementById("resumoAtendidos");
const resumoCancelados = document.getElementById("resumoCancelados");

const ROTULOS_STATUS = {
  pendente: "Pendente",
  confirmado: "Confirmado",
  atendido: "Atendido",
  cancelado: "Cancelado"
};

const TEXTOS_ACAO = {
  pendente: {
    titulo: "Voltar para pendente?",
    texto: "Esse agendamento voltará para a fila de pedidos pendentes.",
    botao: "Sim, voltar para pendente"
  },
  confirmado: {
    titulo: "Confirmar esse pedido?",
    texto: "O cliente será avisado que o horário foi confirmado pelo barbeiro.",
    botao: "Sim, confirmar pedido"
  },
  atendido: {
    titulo: "Marcar como atendido?",
    texto: "O cliente será avisado que o atendimento foi marcado como concluído.",
    botao: "Sim, marcar como atendido"
  },
  cancelado: {
    titulo: "Cancelar esse pedido?",
    texto: "O cliente será avisado que o horário foi cancelado pelo barbeiro.",
    botao: "Sim, cancelar pedido"
  }
};

let agendamentosCache = [];
let unsubscribeAgenda = null;
let acaoPendente = null;

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "login.html";
    return;
  }

  barbeiroLogado.textContent = `Logado como: ${user.email}`;
  filtroData.value = hojeEmFormatoISO();
  garantirModalConfirmacao();
  carregarAgendaTempoReal(user.email);
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

function escaparHTML(valor) {
  return String(valor ?? "").replace(/[&<>'"]/g, (caractere) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#039;",
    '"': "&quot;"
  }[caractere]));
}

function rotuloStatus(status) {
  return ROTULOS_STATUS[status] || ROTULOS_STATUS.pendente;
}

function statusNormalizado(status) {
  return status || "pendente";
}

function carregarAgendaTempoReal(emailBarbeiro) {
  listaAgendamentos.innerHTML = '<p class="vazio">Carregando agendamentos...</p>';

  if (unsubscribeAgenda) unsubscribeAgenda();

  const q = query(
    collection(db, "agendamentos"),
    where("emailBarbeiro", "==", emailBarbeiro)
  );

  unsubscribeAgenda = onSnapshot(
    q,
    (snapshot) => {
      agendamentosCache = snapshot.docs.map((docItem) => ({
        id: docItem.id,
        ...docItem.data()
      }));
      renderizarAgendamentos();
    },
    (error) => {
      console.error("Erro ao carregar agenda:", error);
      listaAgendamentos.innerHTML = `<p class="vazio">Erro ao carregar agendamentos: ${escaparHTML(error.message)}</p>`;
    }
  );
}

function pegarAgendamentosVisiveis() {
  const hojeISO = hojeEmFormatoISO();
  const dataSelecionada = filtroData.value;

  let lista = agendamentosCache.filter((item) => item.data && item.data >= hojeISO);

  if (dataSelecionada) {
    lista = lista.filter((item) => item.data === dataSelecionada);
  }

  return lista;
}

function atualizarResumo(listaBase) {
  resumoHoje.textContent = listaBase.length;
  resumoPendentes.textContent = listaBase.filter((item) => statusNormalizado(item.status) === "pendente").length;
  resumoAtendidos.textContent = listaBase.filter((item) => ["confirmado", "atendido"].includes(statusNormalizado(item.status))).length;
  resumoCancelados.textContent = listaBase.filter((item) => statusNormalizado(item.status) === "cancelado").length;
}

function ordenarAgendamentos(lista) {
  return [...lista].sort((a, b) => `${a.data || ""} ${a.hora || ""}`.localeCompare(`${b.data || ""} ${b.hora || ""}`));
}

function montarBotoesPorStatus(statusAtual, id) {
  const idSeguro = escaparHTML(id);

  if (statusAtual === "pendente") {
    return `
      <button class="btn-acao btn-atendido" data-id="${idSeguro}" data-status="confirmado">✅ Confirmar pedido</button>
      <button class="btn-acao btn-cancelado" data-id="${idSeguro}" data-status="cancelado">❌ Cancelar pedido</button>
    `;
  }

  if (statusAtual === "confirmado") {
    return `
      <button class="btn-acao btn-atendido" data-id="${idSeguro}" data-status="atendido">✔ Marcar como atendido</button>
      <button class="btn-acao btn-cancelado" data-id="${idSeguro}" data-status="cancelado">❌ Cancelar pedido</button>
      <button class="btn-acao btn-pendente" data-id="${idSeguro}" data-status="pendente">⏳ Voltar para pendente</button>
    `;
  }

  if (statusAtual === "cancelado") {
    return `
      <button class="btn-acao btn-pendente" data-id="${idSeguro}" data-status="pendente">⏳ Reabrir como pendente</button>
    `;
  }

  return `
    <button class="btn-acao btn-pendente" data-id="${idSeguro}" data-status="pendente">⏳ Voltar para pendente</button>
  `;
}

function renderizarAgendamentos() {
  const filtro = filtroStatus.value;
  const ordenados = ordenarAgendamentos(pegarAgendamentosVisiveis());
  atualizarResumo(ordenados);

  const listaFiltrada = filtro === "todos"
    ? ordenados
    : ordenados.filter((item) => statusNormalizado(item.status) === filtro);

  if (listaFiltrada.length === 0) {
    listaAgendamentos.innerHTML = '<p class="vazio">Nenhum agendamento encontrado.</p>';
    return;
  }

  listaAgendamentos.innerHTML = listaFiltrada.map((dados) => {
    const statusAtual = statusNormalizado(dados.status);

    return `
      <article class="agendamento-card">
        <div class="card-topo">
          <h3>${escaparHTML(dados.nome || "Cliente sem nome")}</h3>
          <span class="status ${escaparHTML(statusAtual)}">${escaparHTML(rotuloStatus(statusAtual))}</span>
        </div>

        <p><strong>Serviço:</strong> ${escaparHTML(dados.servico || "-")}</p>
        <p><strong>Telefone:</strong> ${escaparHTML(dados.telefone || "-")}</p>
        <p><strong>Barbeiro:</strong> ${escaparHTML(dados.barbeiro || "-")}</p>
        <p><strong>Data:</strong> ${formatarDataBR(dados.data)}</p>
        <p><strong>Hora:</strong> ${escaparHTML(dados.hora || "-")}</p>
        <p class="observacao-card">Status inicial de todo novo pedido: <strong>pendente</strong>.</p>

        <div class="card-acoes">
          ${montarBotoesPorStatus(statusAtual, dados.id)}
          ${botaoWhatsappCard(dados, statusAtual)}
        </div>
      </article>
    `;
  }).join("");

  adicionarEventosBotoes();
}

function adicionarEventosBotoes() {
  document.querySelectorAll(".btn-acao[data-id]").forEach((botao) => {
    botao.addEventListener("click", () => {
      const id = botao.getAttribute("data-id");
      const novoStatus = botao.getAttribute("data-status");
      const agendamento = agendamentosCache.find((item) => item.id === id);

      if (!agendamento) {
        alert("Agendamento não encontrado. Atualize a página e tente de novo.");
        return;
      }

      abrirModalConfirmacao(agendamento, novoStatus);
    });
  });
}

function garantirModalConfirmacao() {
  if (document.getElementById("modalConfirmacaoStatus")) return;

  document.body.insertAdjacentHTML("beforeend", `
    <div id="modalConfirmacaoStatus" class="modal-confirmacao" aria-hidden="true">
      <div class="modal-caixa" role="dialog" aria-modal="true" aria-labelledby="modalTituloStatus">
        <h2 id="modalTituloStatus">Confirmar ação</h2>
        <p id="modalTextoStatus">Confirme a alteração do agendamento.</p>
        <div id="modalResumoStatus" class="modal-resumo"></div>
        <div class="modal-acoes">
          <button type="button" id="btnFecharModalStatus" class="btn-modal btn-modal-secundario">Voltar</button>
          <button type="button" id="btnConfirmarModalStatus" class="btn-modal btn-modal-principal">Confirmar</button>
        </div>
      </div>
    </div>
  `);

  document.getElementById("btnFecharModalStatus").addEventListener("click", fecharModalConfirmacao);
  document.getElementById("btnConfirmarModalStatus").addEventListener("click", confirmarAcaoStatus);

  document.getElementById("modalConfirmacaoStatus").addEventListener("click", (event) => {
    if (event.target.id === "modalConfirmacaoStatus") fecharModalConfirmacao();
  });
}

function abrirModalConfirmacao(agendamento, novoStatus) {
  garantirModalConfirmacao();

  const textos = TEXTOS_ACAO[novoStatus] || TEXTOS_ACAO.pendente;
  const modal = document.getElementById("modalConfirmacaoStatus");
  const titulo = document.getElementById("modalTituloStatus");
  const texto = document.getElementById("modalTextoStatus");
  const resumo = document.getElementById("modalResumoStatus");
  const btnConfirmar = document.getElementById("btnConfirmarModalStatus");

  acaoPendente = { agendamento, novoStatus };

  titulo.textContent = textos.titulo;
  texto.textContent = textos.texto;
  btnConfirmar.textContent = textos.botao;
  btnConfirmar.className = `btn-modal btn-modal-principal ${novoStatus === "cancelado" ? "perigo" : ""}`;

  resumo.innerHTML = `
    <p><strong>Cliente:</strong> ${escaparHTML(agendamento.nome || "-")}</p>
    <p><strong>Serviço:</strong> ${escaparHTML(agendamento.servico || "-")}</p>
    <p><strong>Data:</strong> ${formatarDataBR(agendamento.data)}</p>
    <p><strong>Hora:</strong> ${escaparHTML(agendamento.hora || "-")}</p>
    <p><strong>Novo status:</strong> ${escaparHTML(rotuloStatus(novoStatus))}</p>
  `;

  modal.classList.add("ativo");
  modal.setAttribute("aria-hidden", "false");
}

function fecharModalConfirmacao() {
  const modal = document.getElementById("modalConfirmacaoStatus");
  if (!modal) return;

  modal.classList.remove("ativo");
  modal.setAttribute("aria-hidden", "true");
  acaoPendente = null;
}

function mensagemParaCliente(agendamento, novoStatus) {
  const data = formatarDataBR(agendamento.data);
  const hora = agendamento.hora || "-";
  const barbeiro = agendamento.barbeiro || "o barbeiro";

  if (novoStatus === "confirmado") {
    return `Seu agendamento com ${barbeiro} no dia ${data} às ${hora} foi confirmado.`;
  }

  if (novoStatus === "atendido") {
    return `Seu atendimento com ${barbeiro} no dia ${data} às ${hora} foi marcado como concluído.`;
  }

  if (novoStatus === "cancelado") {
    return `Seu agendamento com ${barbeiro} no dia ${data} às ${hora} foi cancelado.`;
  }

  return `Seu agendamento com ${barbeiro} no dia ${data} às ${hora} voltou para pendente.`;
}

function normalizarTelefoneWhatsapp(telefone) {
  const numeros = String(telefone || "").replace(/\D/g, "");

  if (!numeros) return "";
  if (numeros.startsWith("55") && numeros.length >= 12) return numeros;
  if (numeros.length === 10 || numeros.length === 11) return `55${numeros}`;

  return numeros;
}

function mensagemWhatsapp(agendamento, status) {
  const nome = agendamento.nome ? `${agendamento.nome}, ` : "";
  const data = formatarDataBR(agendamento.data);
  const hora = agendamento.hora || "-";
  const servico = agendamento.servico || "corte";
  const barbeiro = agendamento.barbeiro || "seu barbeiro";

  if (status === "confirmado") {
    return `Olá, ${nome}seu agendamento na Barbearia Parati foi confirmado. Serviço: ${servico}. Barbeiro: ${barbeiro}. Data: ${data}. Horário: ${hora}.`;
  }

  if (status === "cancelado") {
    return `Olá, ${nome}seu agendamento na Barbearia Parati para ${data} às ${hora} foi cancelado. Entre em contato para escolher outro horário.`;
  }

  if (status === "atendido") {
    return `Olá, ${nome}seu atendimento na Barbearia Parati de ${data} às ${hora} foi marcado como concluído. Obrigado pela preferência!`;
  }

  return `Olá, ${nome}seu agendamento na Barbearia Parati para ${data} às ${hora} voltou para pendente. Aguarde a confirmação do barbeiro.`;
}

function linkWhatsapp(agendamento, status) {
  const telefone = normalizarTelefoneWhatsapp(agendamento.telefone);
  if (!telefone) return "";

  return `https://wa.me/${telefone}?text=${encodeURIComponent(mensagemWhatsapp(agendamento, status))}`;
}

function botaoWhatsappCard(agendamento, status) {
  const link = linkWhatsapp(agendamento, status);

  if (!link || status === "pendente") return "";

  return `
    <a class="btn-whatsapp" href="${escaparHTML(link)}" target="_blank" rel="noopener">
      💬 Avisar cliente no WhatsApp
    </a>
  `;
}

async function confirmarAcaoStatus() {
  if (!acaoPendente) return;

  const { agendamento, novoStatus } = acaoPendente;
  const btnConfirmar = document.getElementById("btnConfirmarModalStatus");
  const textoOriginal = btnConfirmar.textContent;
  const agora = new Date().toISOString();

  btnConfirmar.disabled = true;
  btnConfirmar.textContent = "Salvando...";

  try {
    await updateDoc(doc(db, "agendamentos", agendamento.id), {
      status: novoStatus,
      statusAtualizadoEm: agora,
      statusAtualizadoPor: auth.currentUser?.email || "barbeiro",
      notificacaoCliente: {
        tipo: novoStatus,
        titulo: `Agendamento ${rotuloStatus(novoStatus).toLowerCase()}`,
        mensagem: mensagemParaCliente(agendamento, novoStatus),
        lida: false,
        criadaEm: agora
      }
    });

    fecharModalConfirmacao();

    const linkAviso = linkWhatsapp(agendamento, novoStatus);
    if (linkAviso) {
      const querAvisar = confirm("Status salvo e notificação interna criada. Deseja avisar o cliente pelo WhatsApp agora?");
      if (querAvisar) {
        window.open(linkAviso, "_blank", "noopener");
      }
    } else {
      alert("Status salvo e notificação interna criada. Esse cliente não tem telefone válido para WhatsApp.");
    }
  } catch (error) {
    console.error("Erro ao atualizar status:", error);
    alert("Erro ao atualizar status. Verifique as regras do Firebase.");
  } finally {
    btnConfirmar.disabled = false;
    btnConfirmar.textContent = textoOriginal;
  }
}

filtroStatus.addEventListener("change", renderizarAgendamentos);
filtroData.addEventListener("change", renderizarAgendamentos);

btnLimparFiltro.addEventListener("click", () => {
  filtroData.value = "";
  renderizarAgendamentos();
});

btnSair.addEventListener("click", async (e) => {
  e.preventDefault();
  try {
    await signOut(auth);
    window.location.href = "login.html";
  } catch (error) {
    console.error("Erro ao sair:", error);
  }
});
