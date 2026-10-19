import { describe, expect, it } from "vitest";
import { CONTRACT_PROTOCOL_PATTERN, generateContractProtocol } from "../src/contracting/protocol.js";
import { SqliteContractRequestRepository } from "../src/repositories/contractRequestRepository.js";
import { createDatabase } from "../src/repositories/sqlite.js";

const base = {
  idempotencyKey: "k-1",
  planId: "800",
  planName: "Plano 800 Mega",
  planPriceCents: 16999,
  planPriceText: "R$ 169,99",
  cep: "07700000",
  street: "Rua A",
  number: "10",
  complement: null,
  district: "Centro",
  city: "Caieiras",
  uf: "SP",
  cityCovered: true,
  customerName: "Maria Silva",
  whatsapp: "11999999999",
  email: "m@x.com",
  cpf: "52998224725",
  contactPeriod: null,
  notes: null,
  privacyNoticeVersion: "v1",
  marketingOptIn: false,
  ipHash: null,
  userAgent: null
};

describe("protocolo curto", () => {
  it("gera AC + 6 e aceita o formato antigo", () => {
    const protocol = generateContractProtocol();
    expect(protocol).toMatch(/^AC[0-9A-HJKMNP-TV-Z]{6}$/);
    expect(protocol).toMatch(CONTRACT_PROTOCOL_PATTERN);
    expect("AC261017-7KQ3XD").toMatch(CONTRACT_PROTOCOL_PATTERN);
    expect("AC7KQ3X").not.toMatch(CONTRACT_PROTOCOL_PATTERN);
  });
});

describe("CPF na contratacao", () => {
  it("grava, devolve no detalhe e acha na busca", async () => {
    const db = createDatabase(":memory:");
    const repo = new SqliteContractRequestRepository(db);
    const created = await repo.create({ ...base, protocol: generateContractProtocol() });
    expect(created.cpf).toBe("52998224725");
    const found = await repo.list({ page: 1, limit: 10, search: "529.982.247" });
    expect(found.total).toBe(1);
  });
});
