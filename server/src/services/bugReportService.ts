import type { FastifyRequest } from "fastify";
import { AppError } from "../errors.js";
import type {
  BugReportFilters,
  BugReportRepository,
  BugReportStatus,
  CreateBugReportInput,
  UpdateBugReportInput
} from "../repositories/bugReportRepository.js";
import { BUG_REPORT_STATUSES } from "../repositories/bugReportRepository.js";
import type { InMemoryStore } from "../repositories/inMemoryStore.js";
import type { AuthProfileRepository } from "../repositories/authProfileRepository.js";
import type { InMemoryRateLimiter } from "../auth/rateLimiter.js";
import { OwnershipService } from "../security/ownership.js";
import type { SgpUraClient } from "../integrations/sgp/sgpClient.js";

const BUG_REPORT_RATE_RULE = { limit: 5, windowMs: 10 * 60 * 1000, cooldownMs: 10 * 60 * 1000 };
const MAX_CONTEXT_DEPTH = 4;
const MAX_CONTEXT_KEYS = 80;
const MAX_CONTEXT_STRING = 800;

const BLOCKED_CONTEXT_KEYS = /^(customerId|clienteId|clientId|cpf|cpfCnpj|cpfHash|nome|nomeCliente|customerName)$/i;

interface AuthenticatedBugReportInput {
  auth: NonNullable<FastifyRequest["auth"]>;
  request: FastifyRequest;
  category: string;
  description: string;
  page?: string | null | undefined;
  url?: string | null | undefined;
  contractId?: string | null | undefined;
  frontendVersion?: string | null | undefined;
  clientContext?: Record<string, unknown> | null | undefined;
}

interface AdminIdentity {
  adminUserId?: string | null | undefined;
  adminEmail?: string | null | undefined;
}

function userAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function maskFromLastDigits(lastDigits: string | null | undefined) {
  const digits = (lastDigits || "").replace(/\D/g, "").slice(-2);
  return digits ? `***.***.***-${digits}` : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function sanitizeContextValue(value: unknown, depth: number, state: { keys: number }): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.slice(0, MAX_CONTEXT_STRING);
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "boolean") return value;
  if (Array.isArray(value)) {
    if (depth >= MAX_CONTEXT_DEPTH) return [];
    return value.slice(0, 30).map((item) => sanitizeContextValue(item, depth + 1, state));
  }
  if (!isPlainObject(value)) return String(value).slice(0, MAX_CONTEXT_STRING);
  if (depth >= MAX_CONTEXT_DEPTH) return {};

  const output: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    if (state.keys >= MAX_CONTEXT_KEYS) break;
    if (BLOCKED_CONTEXT_KEYS.test(key)) continue;
    state.keys += 1;
    output[key.slice(0, 80)] = sanitizeContextValue(raw, depth + 1, state);
  }
  return output;
}

function sanitizeContext(value: Record<string, unknown> | null | undefined) {
  if (!value) return null;
  const sanitized = sanitizeContextValue(value, 0, { keys: 0 });
  return isPlainObject(sanitized) ? sanitized : null;
}

export class BugReportService {
  constructor(
    private readonly repository: BugReportRepository,
    private readonly store: InMemoryStore,
    private readonly authProfiles: AuthProfileRepository,
    private readonly rateLimiter: InMemoryRateLimiter,
    private readonly sgpClient: SgpUraClient
  ) {}

  async createAuthenticated(input: AuthenticatedBugReportInput) {
    this.rateLimiter.consume(`bug_report:customer:${input.auth.customerId}`, BUG_REPORT_RATE_RULE);

    const ownership = new OwnershipService(this.store, this.sgpClient);
    const contract = input.contractId
      ? await ownership.assertContract(input.auth.customerId, input.contractId, {
          log: input.request.log,
          cpfHash: input.auth.cpfHash,
          endpoint: input.request.routeOptions?.url || input.request.url
        })
      : null;

    const customer = this.store.getCustomer(input.auth.customerId);
    const profile = customer ? null : await this.authProfiles.findByCpfHash(input.auth.cpfHash);

    const record: CreateBugReportInput = {
      customerId: input.auth.customerId,
      cpfHash: input.auth.cpfHash,
      cpfMasked: customer?.maskedCpf ?? maskFromLastDigits(profile?.cpfLastDigits),
      customerName: customer?.name ?? null,
      sgpCustomerId: profile?.sgpCustomerId ?? null,
      contractId: contract?.id ?? null,
      category: input.category,
      description: input.description.trim(),
      page: input.page ?? null,
      url: input.url ?? null,
      userAgent: userAgent(input.request) ?? null,
      frontendVersion: input.frontendVersion ?? null,
      context: sanitizeContext({
        ...(input.clientContext ?? {}),
        selectedContract: contract
          ? {
              id: contract.id,
              status: contract.status,
              planName: contract.planName,
              addressLine: contract.addressLine,
              city: contract.city,
              state: contract.state
            }
          : null
      })
    };

    return this.repository.create(record);
  }

  list(filters: BugReportFilters) {
    return this.repository.list(filters);
  }

  summary() {
    return this.repository.summary();
  }

  async getForAdmin(id: number) {
    const report = await this.repository.findById(id);
    if (!report) {
      throw new AppError(404, "BUG_REPORT_NOT_FOUND", "Relatorio nao encontrado.");
    }
    const history = await this.repository.listHistory(id);
    return { report, history };
  }

  async updateAdmin(input: UpdateBugReportInput & AdminIdentity) {
    const current = await this.repository.findById(input.id);
    if (!current) {
      throw new AppError(404, "BUG_REPORT_NOT_FOUND", "Relatorio nao encontrado.");
    }
    if (input.status && !BUG_REPORT_STATUSES.includes(input.status as BugReportStatus)) {
      throw new AppError(400, "INVALID_STATUS", "Status invalido.");
    }
    return this.repository.updateAdmin(input);
  }
}
