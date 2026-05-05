# Barbearia Parati

Versão organizada do site com agenda do barbeiro, personalização de horários, painel do cliente e avisos sem precisar pagar Cloud Functions.

## O que tem nesta versão

- Agendamento pelo cliente.
- Horários puxados do Firebase de acordo com a agenda personalizada do barbeiro.
- Agendamentos novos entram como `pendente`.
- Barbeiro confirma, cancela, marca como atendido ou volta para pendente.
- Antes de mudar o status, aparece uma confirmação.
- Cliente vê notificações internas na área dele.
- Se o cliente estiver com a área aberta, aparece aviso em tempo real na tela.
- Barbeiro ganha botão **Avisar cliente no WhatsApp** com mensagem pronta.

## Importante sobre notificações

Esta versão é gratuita e não usa Cloud Functions.

Por isso:

- Com o site aberto: o cliente vê aviso em tempo real.
- Dentro da conta: o cliente vê as notificações salvas.
- Com o site fechado: o barbeiro avisa pelo botão de WhatsApp.

Notificação automática na barra do celular com o site fechado exige backend/Cloud Functions ou outro servidor.

## Arquivos principais

- `index.html`: site principal e formulário de agendamento.
- `cliente-login.html`: login do cliente.
- `cliente-dashboard.html`: área do cliente.
- `login.html`: login do barbeiro/admin.
- `painel-barbeiro.html`: agenda do barbeiro.
- `painel-admin.html`: visão geral do dono/admin.
- `personalizar-horarios.html`: tela para o barbeiro personalizar a agenda.

## Como subir no GitHub Pages

No terminal, dentro da pasta do projeto:

```powershell
git add .
git commit -m "Versao gratis com WhatsApp"
git push origin main
```

Se estiver usando uma pasta nova sem Git:

```powershell
git init
git branch -M main
git remote add origin https://github.com/gupcampospacheco-alt/Barbearia-Parati.git
git add .
git commit -m "Versao gratis com WhatsApp"
git push -u origin main --force
```
