import type { FastifyRequest } from "fastify";
import type {
  ActivityFilters,
  AnalyticsRange,
  CentralActivityEvent,
  CentralActivityRepository,
  CentralActivitySessionInput
} from "../repositories/centralActivityRepository.js";
import type { AuthProfileRepository } from "../repositories/authProfileRepository.js";
import type { InMemoryStore } from "../repositories/inMemoryStore.js";
import { sha256 } from "../security/hash.js";

export interface AuthenticatedActivityInput {
  auth: {
    customerId: string;
    sessionId: string;
    cpfHash: string;
  };
  request: FastifyRequest;
  eventType: CentralActivityEvent | string;
  page?: string | null | undefined;
  contractId?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export interface LoginActivityInput {
  sessionId: string;
  customerId: string;
  cpfHash: string;
  request: FastifyRequest;
  customerName?: string | null | undefined;
  cpfMasked?: string | null | undefined;
  sgpCustomerId?: string | null | undefined;
  contractId?: string | null | undefined;
  metadata?: Record<string, unknown> | null | undefined;
}

export class CentralActivityService {
  constructor(
    private readonly repository: CentralActivityRepository,
    private readonly authProfiles: AuthProfileRepository,
    private readonly store: InMemoryStore
  ) {}

  async recordAuthenticated(input: AuthenticatedActivityInput): Promise<void> {
    const base = await this.baseInput(input.auth, input.request, input.contractId);
    await this.repository.record({
      ...base,
      eventType: input.eventType,
      page: input.page,
      metadata: input.metadata
    });
  }

  async safeRecordAuthenticated(input: AuthenticatedActivityInput): Promise<void> {
    try {
      await this.recordAuthenticated(input);
    } catch (error) {
      input.request.log.warn(
        { err: error, eventType: input.eventType, page: input.page, contractId: input.contractId },
        "Failed to record central activity"
      );
    }
  }

  async recordLogin(input: LoginActivityInput): Promise<void> {
    const profile = await this.authProfiles.findByCpfHash(input.cpfHash);
    await this.repository.record({
      sessionId: input.sessionId,
      customerId: input.customerId,
      cpfHash: input.cpfHash,
      cpfMasked: input.cpfMasked ?? maskFromLastDigits(profile?.cpfLastDigits),
      customerName: input.customerName,
      sgpCustomerId: input.sgpCustomerId ?? profile?.sgpCustomerId ?? null,
      contractId: input.contractId ?? null,
      ipHash: hashIp(input.request),
      userAgent: requestUserAgent(input.request),
      deviceType: detectDeviceType(requestUserAgent(input.request)),
      eventType: "LOGIN",
      page: "login",
      metadata: input.metadata
    });
  }

  async safeRecordLogin(input: LoginActivityInput): Promise<void> {
    try {
      await this.recordLogin(input);
    } catch (error) {
      input.request.log.warn({ err: error, customerId: input.customerId }, "Failed to record central login activity");
    }
  }

  async endSession(auth: { customerId: string; sessionId: string; cpfHash: string }, request: FastifyRequest): Promise<void> {
    await this.recordAuthenticated({ auth, request, eventType: "LOGOUT", page: "logout" });
    await this.repository.endSession(auth.sessionId, new Date());
  }

  async safeEndSession(auth: { customerId: string; sessionId: string; cpfHash: string }, request: FastifyRequest): Promise<void> {
    try {
      await this.endSession(auth, request);
    } catch (error) {
      request.log.warn({ err: error, customerId: auth.customerId }, "Failed to record central logout activity");
    }
  }

  overview(range: AnalyticsRange) {
    return this.repository.overview(range);
  }

  listActivity(filters: ActivityFilters) {
    return this.repository.listActivity(filters);
  }

  listClients(filters: Parameters<CentralActivityRepository["listClients"]>[0]) {
    return this.repository.listClients(filters);
  }

  getClient(customerId: string, range: AnalyticsRange) {
    return this.repository.getClient(customerId, range);
  }

  listEventTypes() {
    return this.repository.listEventTypes();
  }

  private async baseInput(
    auth: { customerId: string; sessionId: string; cpfHash: string },
    request: FastifyRequest,
    contractId?: string | null | undefined
  ): Promise<CentralActivitySessionInput> {
    const customer = this.store.getCustomer(auth.customerId);
    const profile = await this.authProfiles.findByCpfHash(auth.cpfHash);

    return {
      sessionId: auth.sessionId,
      customerId: auth.customerId,
      cpfHash: auth.cpfHash,
      cpfMasked: customer?.maskedCpf ?? maskFromLastDigits(profile?.cpfLastDigits),
      customerName: customer?.name ?? null,
      sgpCustomerId: profile?.sgpCustomerId ?? null,
      contractId: contractId ?? null,
      ipHash: hashIp(request),
      userAgent: requestUserAgent(request),
      deviceType: detectDeviceType(requestUserAgent(request))
    };
  }
}

function requestUserAgent(request: FastifyRequest) {
  const value = request.headers["user-agent"];
  return Array.isArray(value) ? value[0] : value;
}

function hashIp(request: FastifyRequest) {
  return sha256(request.ip || "unknown");
}

function detectDeviceType(userAgent: string | undefined) {
  const ua = String(userAgent || "").toLowerCase();
  if (!ua) return "unknown";
  if (/ipad|tablet/.test(ua)) return "tablet";
  if (/mobi|android|iphone|ipod/.test(ua)) return "mobile";
  return "desktop";
}

function maskFromLastDigits(lastDigits: string | null | undefined) {
  if (!lastDigits) return null;
  return `***.***.***-${lastDigits.padStart(2, "*").slice(-2)}`;
}
