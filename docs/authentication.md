# Autenticação da Central do Assinante (frontend)

Este site consome o login por CPF + senha implementado no backend
`AcessaNet app` (`apps/backend`, repositório separado em
`/home/noc/AcessaNet app`). A documentação completa — banco de dados,
sessões, primeiro acesso, SGP, segurança — está em
`AcessaNet app/docs/authentication.md`. Este arquivo cobre só a parte que
vive neste repositório.

## Onde fica cada peça

- `src/services/clienteApi.js` — cliente HTTP: `loginWithPassword`,
  `firstAccessChangePassword`, `changePasswordWithCurrent`,
  `logoutCustomer`, `isValidCpf`, além das funções que já existiam
  (`clienteRequest`, `normalizeCpf`, `maskCpf`, tokens em `localStorage`).
- `src/pages/ClienteArea.jsx` — telas:
  - `ClienteLogin`: CPF + senha, com botão mostrar/ocultar senha e link
    "Alterar minha senha".
  - `PrimeiroAcessoScreen`: tela obrigatória quando o login responde
    `requirePasswordChange: true` (o cliente usou a senha inicial do SGP).
    Não tem como fechar sem concluir a troca ou sair.
  - `AlterarSenhaPanel`: formulário de troca de senha (CPF + senha atual +
    nova senha), reaproveitado tanto na tela de login (cliente
    deslogado) quanto dentro de "Perfil" (cliente já logado) — o CPF é
    pedido nos dois casos porque o frontend nunca guarda o CPF em texto
    puro do cliente autenticado.
- `src/styles/clienteArea.css` — classes novas: `.cliente-password-field`,
  `.cliente-password-toggle`, `.cliente-login-switch`,
  `.cliente-first-access-notice`, `.cliente-form-success`,
  `.cliente-password-panel`.

## O que não muda

O fluxo antigo por CPF apenas (`loginWithCpf`, endpoint
`POST /api/auth/cpf`) continua existindo no backend, sem alterações, porque
o app mobile (Expo, `AcessaNet app/apps/mobile`) ainda depende dele. Este
site não usa mais essa função — foi substituída por `loginWithPassword` em
`ClienteArea.jsx`.

O restante da Central do Assinante (faturas, internet, chamados, chat) não
foi alterado: continua usando `clienteRequest` com os mesmos
access/refresh tokens em `localStorage`, agora emitidos pelo novo fluxo de
login por senha em vez do fluxo antigo por CPF.

## Variável de ambiente

Nenhuma nova. Os novos endpoints (`/api/auth/login`,
`/api/auth/first-access/change-password`, `/api/auth/change-password`,
`/api/auth/logout`) são servidos pelo mesmo backend já apontado por
`VITE_ACESSANET_API_URL` (`.env.local`).
