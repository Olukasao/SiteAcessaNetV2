import type { ContractSummary, PublicTicketVisit, TicketStatus, TicketSummary } from "../../types.js";
import type { SgpContractRaw, SgpOccurrenceRaw } from "./sgpClient.js";
import { sha256 } from "../../security/hash.js";
import { mapSgpStatus, normalizeChamadoStatus } from "./statusMapper.js";

/** Alguns campos de ocorrencia trazem ordens de servico aninhadas -- nao e uma chamada SGP separada. */
type SgpServiceOrderRaw = Record<string, unknown>;

export function mapSgpCustomer(cpf: string, contracts: SgpContractRaw[]) {
  const firstContract = contracts[0];
  if (!firstContract) {
    return null;
  }

  const normalizedCpf = cpf.replace(/\D/g, "");
  const customerId = `customer_sgp_${sha256(normalizedCpf).slice(0, 16)}`;
  const customerName = pickString(firstContract, [
    "cliente",
    "cliente_nome",
    "clienteNome",
    "nome",
    "razao",
    "razao_social",
    "razaoSocial",
    "nome_razaosocial"
  ]) || "Cliente Acessanet";

  const customer = {
    id: customerId,
    name: customerName,
    cpf: normalizedCpf,
    phone: findPhone(contracts),
    email: findEmail(contracts)
  };

  /**
   * CAUSA RAIZ de um vazamento de dados confirmado entre clientes: "id" de
   * CLIENTE e "id" de CONTRATO compartilham a mesma sequencia numerica no
   * SGP. Um registro de /api/ura/clientes/ (identificado pela presenca da
   * chave "contratos", mesmo vazia) e SEMPRE um CLIENTE, nunca um contrato
   * -- so os itens DENTRO de "contratos" sao contratos de verdade. Antes,
   * quando um cliente nao tinha nenhum contrato aninhado (ex.: cadastro de
   * teste "PATRICIA TESTE", id de cliente 34007, sem contrato nenhum), o
   * codigo caia num fallback que tratava o PROPRIO registro de cliente como
   * se fosse um contrato, usando o id do CLIENTE (34007) como "contractId".
   * Esse id colidiu com um contratoId real de OUTRO cliente (34007 =
   * contrato de Renan da Silva Santos, clienteId 26983) -- resultado:
   * Patricia via um "contrato 34007" na propria Central que, ao ser
   * consultado por id, trazia endereco/plano/fatura/conexao do Renan.
   *
   * Registros SEM a chave "contratos" vem de um endpoint diferente
   * (/api/ura/consultacliente/, usado como fallback de busca por CPF, e
   * tambem por consultCustomerByContract) -- esses SIM sao contratos
   * "chatos" (sem wrapper de cliente), com cpfCnpj/clienteId proprios.
   * Mesmo nesse caso, nunca aceitar sem checar: o cpf/cnpj do PROPRIO
   * registro precisa bater com o CPF pesquisado, nunca confiar so no fato
   * de ter vindo de uma busca por esse CPF (SGP pode, em tese, devolver
   * casamento incorreto/parcial).
   */
  const mappedContracts = contracts.flatMap((contract) => {
    const isCustomerWrapper = "contratos" in contract;

    if (isCustomerWrapper) {
      const nestedContracts = Array.isArray(contract.contratos) ? (contract.contratos as SgpContractRaw[]) : [];
      return nestedContracts.map((nested) => mapSgpContract(nested, customerId)).filter(Boolean);
    }

    if (!contractCpfMatches(contract, normalizedCpf)) {
      return [];
    }

    const direct = mapSgpContract(contract, customerId);
    return direct ? [direct] : [];
  });

  return {
    customer,
    contracts: mappedContracts.filter((contract): contract is ContractSummary => Boolean(contract))
  };
}

/**
 * Defesa extra (nunca confiar so no fato de um registro ter vindo de uma
 * busca por este CPF): se o registro tiver seu proprio campo de cpf/cnpj
 * (acontece no formato "contrato chato" de /api/ura/consultacliente/,
 * ver SgpUraClient#consultCustomerByContract), ele precisa bater com o CPF
 * pesquisado. Sem campo proprio pra checar, deixa passar (nao e o caso
 * que causou o vazamento -- esse ja fica bloqueado antes, pelo wrapper de
 * cliente).
 */
function contractCpfMatches(contract: SgpContractRaw, normalizedCpf: string): boolean {
  const rawCpf = pickString(contract, ["cpfCnpj", "cpfcnpj", "cpf_cnpj", "cpf"]);
  if (!rawCpf) {
    return true;
  }

  return rawCpf.replace(/\D/g, "") === normalizedCpf;
}

export function mapSgpContract(contract: SgpContractRaw, customerId: string): ContractSummary | null {
  const id = pickString(contract, ["id", "id_contrato", "contratoId", "contrato_id", "idContrato", "contrato"]);

  if (!id) {
    return null;
  }

  const addressLine = buildAddressLine(contract);
  const city = pickString(contract, ["endereco_cidade", "enderecoCidade", "cidade"]);
  const state = pickString(contract, ["endereco_uf", "enderecoUf", "uf"]);
  const planName = pickString(contract, [
    "servicos.0.plano.descricao",
    "plano.descricao",
    "plano",
    "plano_nome",
    "planoNome",
    "servico",
    "servico_nome"
  ]) || "Plano Acessanet";
  const status = mapContractStatus(pickString(contract, ["status", "status_contrato", "situacao"]));

  return { id, customerId, addressLine, city, state, planName, status };
}

function findPhone(contracts: SgpContractRaw[]) {
  for (const record of contracts) {
    const direct = pickStringDeep(record, [
      "celular",
      "celular1",
      "celular2",
      "cliente_celular",
      "clienteCelular",
      "telefone_celular",
      "telefoneCelular",
      "whatsapp",
      "telefone",
      "telefone1",
      "telefone2",
      "fone",
      "fone1",
      "fone2"
    ]);
    const phone = normalizeBrazilianPhone(direct);
    if (phone) {
      return phone;
    }

    const nestedPhone = pickPhoneFromNestedCollections(record);
    if (nestedPhone) {
      return nestedPhone;
    }

    const contatos = record.contatos as Record<string, unknown> | undefined;
    const celulares = Array.isArray(contatos?.celulares) ? contatos.celulares : [];
    for (const raw of celulares) {
      const normalized = normalizeBrazilianPhone(String(raw));
      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Dois formatos confirmados ao vivo (2026-09-28) e um fallback defensivo:
 *  - /api/ura/consultacliente/ (contrato 3005): campo "emails" no proprio
 *    registro, lista de {tipoContato: "E-Mail", contato: "end@dominio.com"}.
 *  - /api/ura/clientes/ (cpfcnpj=22158468874): campo "contatos.emails",
 *    lista de strings puras (["end@dominio.com"]) -- mesmo formato aninhado
 *    que findPhone ja trata para "contatos.celulares".
 *  - Nomes de campo plano abaixo sao so um fallback defensivo, nunca
 *    confirmados nesta instancia do SGP.
 * consultCustomerByCpf tenta /api/ura/clientes/ primeiro e so cai pra
 * /api/ura/consultacliente/ se o primeiro nao achar nada -- entao os dois
 * formatos precisam ser tratados aqui.
 */
function findEmail(contracts: SgpContractRaw[]) {
  for (const record of contracts) {
    const emails = Array.isArray(record.emails) ? (record.emails as Record<string, unknown>[]) : [];
    for (const entry of emails) {
      const tipo = String(entry.tipoContato ?? "").toLowerCase();
      const value = String(entry.contato ?? "").trim();
      if (tipo.includes("mail") && EMAIL_PATTERN.test(value)) {
        return value.toLowerCase();
      }
    }

    const contatos = record.contatos as Record<string, unknown> | undefined;
    const contatosEmails = Array.isArray(contatos?.emails) ? contatos.emails : [];
    for (const raw of contatosEmails) {
      const value = String(raw ?? "").trim();
      if (EMAIL_PATTERN.test(value)) {
        return value.toLowerCase();
      }
    }

    const direct = pickString(record, ["email", "cliente_email", "clienteEmail", "e_mail"]);
    if (EMAIL_PATTERN.test(direct)) {
      return direct.toLowerCase();
    }
  }

  return "";
}

function pickPhoneFromNestedCollections(record: Record<string, unknown>) {
  const collections = ["telefones", "telefone", "telefones_cargos", "phones", "contatos"];
  for (const key of collections) {
    const value = record[key];
    if (!Array.isArray(value)) {
      continue;
    }

    for (const item of value) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const phone = pickStringDeep(item as Record<string, unknown>, [
        "celular",
        "celular1",
        "telefone",
        "telefone1",
        "numero",
        "fone",
        "whatsapp"
      ]);
      const normalized = normalizeBrazilianPhone(phone);
      if (normalized) {
        return normalized;
      }
    }
  }

  return "";
}

function normalizeBrazilianPhone(value: string) {
  const rawDigits = value.replace(/\D/g, "");
  const candidates = [rawDigits, ...Array.from(value.matchAll(/(?:55)?\d{10,11}/g), (match) => match[0])];

  for (const candidate of candidates) {
    let digits = candidate.replace(/\D/g, "");
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
      digits = digits.slice(2);
    }

    if (digits.length === 10 || digits.length === 11) {
      return digits;
    }
  }

  return "";
}

function pickStringDeep(record: Record<string, unknown>, fields: string[]) {
  const targets = new Set(fields.map(normalizeFieldName));
  const stack: unknown[] = [record];

  while (stack.length > 0) {
    const current = stack.shift();
    if (!current || typeof current !== "object" || Array.isArray(current)) {
      continue;
    }

    for (const [key, value] of Object.entries(current)) {
      if (targets.has(normalizeFieldName(key)) && value !== undefined && value !== null && String(value).trim()) {
        return String(value).trim();
      }

      if (value && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return "";
}

function normalizeFieldName(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function buildAddressLine(contract: SgpContractRaw) {
  const endereco = contract.endereco as Record<string, unknown> | undefined;
  const source = endereco && typeof endereco === "object" ? endereco : contract;

  return [
    pickString(source, ["logradouro", "endereco_logradouro", "enderecoLogradouro", "endereco"]),
    pickString(source, ["numero", "endereco_numero", "enderecoNumero"]),
    pickString(source, ["bairro", "endereco_bairro", "enderecoBairro"])
  ]
    .filter(Boolean)
    .join(", ");
}

export function pickString(record: Record<string, unknown>, fields: string[]) {
  for (const field of fields) {
    const value = getNestedValue(record, field);
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function getNestedValue(record: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = record;

  for (const part of parts) {
    if (!current || typeof current !== "object") {
      return undefined;
    }

    if (Array.isArray(current)) {
      const index = Number(part);
      if (Number.isNaN(index) || index < 0 || index >= current.length) {
        return undefined;
      }
      current = current[index];
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

function mapContractStatus(value: string): ContractSummary["status"] {
  const normalized = value.toLowerCase();
  if (normalized.includes("ativo") || normalized.includes("active")) {
    return "ACTIVE";
  }
  if (normalized.includes("susp") || normalized.includes("bloq")) {
    return "SUSPENDED";
  }
  if (normalized.includes("cancel")) {
    return "CANCELED";
  }
  return "UNKNOWN";
}

export function mapSgpOccurrence(raw: SgpOccurrenceRaw, contractId: string): TicketSummary | null {
  const numero = String(pickString(raw, ["numero", "ocorrencia", "protocolo"]) || "");
  if (!numero) {
    return null;
  }

  const status = mapSgpStatus(String(pickString(raw, ["status"]) || ""));
  const openedAt = pickString(raw, ["data_cadastro", "data"]) || new Date().toISOString().slice(0, 10);
  const openedTime = pickString(raw, ["hora_cadastro", "hora"]) || "00:00";

  const ordensServicos = Array.isArray((raw as Record<string, unknown>).ordens_servicos)
    ? ((raw as Record<string, unknown>).ordens_servicos as SgpServiceOrderRaw[])
    : [];

  const primaryOs = ordensServicos[0];
  const osStatus = primaryOs ? mapSgpStatus(String(pickString(primaryOs, ["status"]) || "")) : undefined;
  const appointmentDate = pickString(raw, ["data_agendamento", "data"]) || pickString(primaryOs ?? {}, ["data_agendamento", "data"]) || "";
  const appointmentStart = pickString(raw, ["hora_agendamento", "hora"]) || pickString(primaryOs ?? {}, ["hora_agendamento", "hora"]) || extractTimeFromContent(raw) || "";
  const finalStatus = applyAppointmentStatus(osStatus ?? status, appointmentDate);
  const normalized = normalizeChamadoStatus(finalStatus);

  return {
    id: numero,
    protocol: numero,
    contractId,
    status: finalStatus,
    statusInterno: normalized.status,
    title: pickString(raw, ["tipo", "motivo", "assunto"]) || "Chamado",
    description: pickString(raw, ["conteudo", "descricao", "observacao"]) || "",
    createdAt: `${openedAt}T${openedTime}:00`,
    updatedAt: `${openedAt}T${appointmentStart || openedTime}:00`,
    ...(appointmentDate
      ? {
          appointment: {
            id: numero,
            ticketId: numero,
            contractId,
            date: appointmentDate,
            windowStart: appointmentStart,
            windowEnd: "",
            addressLine: pickString(raw, ["endereco", "endereco_instalacao"]) || "",
            city: pickString(raw, ["cidade", "endereco_cidade"]) || "",
            state: pickString(raw, ["uf", "endereco_uf"]) || ""
          }
        }
      : {})
  };
}

export function mapSgpOsToCustomerVisit(raw: SgpOccurrenceRaw, contractId: string): PublicTicketVisit | null {
  const numero = String(pickString(raw, ["numero", "ocorrencia", "protocolo"]) || "");
  if (!numero) {
    return null;
  }

  const status = mapSgpStatus(String(pickString(raw, ["status"]) || ""));
  const openedAt = pickString(raw, ["data_cadastro", "data"]) || new Date().toISOString().slice(0, 10);
  const openedTime = pickString(raw, ["hora_cadastro", "hora"]) || "00:00";

  const ordensServicos = Array.isArray((raw as Record<string, unknown>).ordens_servicos)
    ? ((raw as Record<string, unknown>).ordens_servicos as SgpServiceOrderRaw[])
    : [];

  const primaryOs = ordensServicos[0];
  const osStatus = primaryOs ? mapSgpStatus(String(pickString(primaryOs, ["status"]) || "")) : undefined;
  const appointmentDate = pickString(raw, ["data_agendamento", "data"]) || pickString(primaryOs ?? {}, ["data_agendamento", "data"]) || "";
  const appointmentStart = pickString(raw, ["hora_agendamento", "hora"]) || pickString(primaryOs ?? {}, ["hora_agendamento", "hora"]) || extractTimeFromContent(raw) || "";
  const finalStatus = applyAppointmentStatus(osStatus ?? status, appointmentDate);
  const normalized = normalizeChamadoStatus(finalStatus);

  /** Quando fechado, "data_finalizacao" (confirmado ao vivo em 2026-09-28) e a data real de encerramento -- usada pra "updatedAt", de onde o corte de 30 dias do historico conta. */
  const finalizedAt = normalized.status === "closed" ? pickString(raw, ["data_finalizacao"]) : "";

  const appointment = appointmentDate
    ? {
        id: numero,
        ticketId: numero,
        contractId,
        date: appointmentDate,
        windowStart: appointmentStart,
        windowEnd: "",
        addressLine: pickString(raw, ["endereco", "endereco_instalacao"]) || "",
        city: pickString(raw, ["cidade", "endereco_cidade"]) || "",
        state: pickString(raw, ["uf", "endereco_uf"]) || ""
      }
    : undefined;

  const base = {
    id: numero,
    protocol: numero,
    contractId,
    status: finalStatus,
    statusInterno: normalized.status,
    title: pickString(raw, ["tipo", "motivo", "assunto"]) || "Chamado",
    createdAt: `${openedAt}T${openedTime}:00`,
    updatedAt: finalizedAt ? `${finalizedAt}T${openedTime}:00` : `${openedAt}T${appointmentStart || openedTime}:00`,
    appointment
  };

  /**
   * Quando o chamado e encerrado no SGP, o campo "conteudo" deixa de ser a
   * descricao de abertura e passa a guardar a nota/motivo do encerramento
   * (confirmado ao vivo em 2026-09-28, contrato 3005: status "Encerrada" com
   * conteudo "Chamado finalizado pois o teste foi concluido."). So extrai
   * quando o chamado esta realmente fechado, para nao confundir com a
   * descricao original de um chamado ainda aberto.
   */
  const closureReason = normalized.status === "closed" ? pickString(raw, ["conteudo"]) : "";

  const withClosureReason = closureReason ? { ...base, closureReason } : base;
  const connectionStatus = extractConnectionStatus(raw);
  return connectionStatus ? { ...withClosureReason, connectionStatus } : withClosureReason;
}

export function extractConnectionStatus(raw: SgpOccurrenceRaw): "ONLINE" | "OFFLINE" | undefined {
  const content = String(pickString(raw, ["conteudo", "descricao", "observacao"]) || "");
  const osContent = Array.isArray((raw as Record<string, unknown>).ordens_servicos)
    ? ((raw as Record<string, unknown>).ordens_servicos as SgpServiceOrderRaw[])[0]
    : undefined;

  const osContentText = osContent ? String(pickString(osContent, ["conteudo", "descricao", "observacao"]) || "") : "";
  const combined = normalizeDiagnosticText(`${content} ${osContentText}`);

  if (
    /status\s+do\s+equipamento:\s*offline/.test(combined) ||
    /cliente\s+offline\b/.test(combined) ||
    /\bonu\s+offline\b/.test(combined) ||
    /\bsem\s+conexao\b/.test(combined) ||
    /\bsem\s+sinal\b/.test(combined) ||
    /\bperda\s+de\s+sinal\b/.test(combined) ||
    /\blos\b/.test(combined) ||
    // "LOSS" (Loss Of Signal, confirmado ao vivo em ordens de servico reais, contrato 5989:
    // "Status:LOSS" / "Ultimo Alarme:LOSS") e uma palavra DIFERENTE de "LOS" pro regex (o \b
    // final de /\blos\b/ nao bate com o "s" extra de "loss") -- faltava este caso.
    /\bloss\b/.test(combined) ||
    // Formato usado nas anotacoes reais de diagnostico do time (confirmado ao vivo em 2026-09-28,
    // contrato 5989): "DIAGNOSTICO: Cliente OFFLINE ..." / "DIAGNOSTICO: Offline ...", sem
    // "status do equipamento" nem "cliente" logo antes de "offline".
    /diagnostico:\s*(cliente\s+)?offline\b/.test(combined) ||
    // Formato gerado pelo PROPRIO app (DIAGNOSTICO APP ACESSANET, ver diagnosis/engine.ts
    // buildConnectionLines) quando o cliente faz autodiagnose: "ONU: Offline | PON: Offline |
    // PPPoE: Offline". Sem isso, o diagnostico que o proprio sistema gerou numa ocorrencia
    // ficava invisivel pra ele mesmo numa consulta seguinte (confirmado 2026-10-05, contrato
    // 5989 -- nao mudou o resultado desse caso especifico pq a ocorrencia ja estava fora da
    // janela de 48h, mas o gap existia). PPPoE e o sinal mais direto de sessao de internet
    // ativa -- ONU/PON online nao garante PPPoE autenticado.
    /\bpppoe:\s*offline\b/.test(combined)
  ) {
    return "OFFLINE";
  }

  if (
    /status\s+do\s+equipamento:\s*online/.test(combined) ||
    /cliente\s+online\b/.test(combined) ||
    /status\s+da\s+onu:\s*normal/.test(combined) ||
    /verificacao\s+de\s+status\s+da\s+onu:\s*normal/.test(combined) ||
    /analise\s+de\s+extrato\s+de\s+trafego:\s*sem\s+quedas\s+constantes/.test(combined) ||
    // Mesmo formato real acima, variante ONLINE: "DIAGNOSTICO: ONLINE ..." / "DIAGNOSTICO: Online.".
    /diagnostico:\s*(cliente\s+)?online\b/.test(combined) ||
    // Mesmo caso do PPPoE offline acima, variante ONLINE: "PPPoE: Online" gerado pelo proprio app.
    /\bpppoe:\s*online\b/.test(combined)
  ) {
    return "ONLINE";
  }

  return undefined;
}

function normalizeDiagnosticText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

function extractTimeFromContent(raw: SgpOccurrenceRaw): string {
  const content = String(pickString(raw, ["conteudo", "descricao", "observacao"]) || "");
  const osContent = Array.isArray((raw as Record<string, unknown>).ordens_servicos)
    ? ((raw as Record<string, unknown>).ordens_servicos as SgpServiceOrderRaw[])[0]
    : undefined;

  const osContentText = osContent ? String(pickString(osContent, ["conteudo", "descricao", "observacao"]) || "") : "";
  const combined = `${osContentText} ${content}`;

  const match = combined.match(/(\d{1,2}:\d{2})(?::\d{2})?/);
  if (!match || !match[1]) {
    return "";
  }

  return match[1];
}

function applyAppointmentStatus(status: TicketStatus, appointmentDate: string): TicketStatus {
  if (!appointmentDate) {
    return status;
  }

  const keepStatuses = new Set<TicketStatus>(["TECH_ON_THE_WAY", "IN_PROGRESS", "RESOLVED", "CANCELED"]);
  if (keepStatuses.has(status)) {
    return status;
  }

  return "SCHEDULED";
}
