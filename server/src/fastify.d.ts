import "fastify";
import type { AdminRole } from "./auth/adminPermissions.js";

declare module "fastify" {
  interface FastifyRequest {
    auth?: {
      customerId: string;
      sessionId: string;
      cpfHash: string;
    };
    /** Sessao administrativa (modulo Avisos da Central) -- nunca confundir com `auth` (cliente); os dois sao independentes. */
    adminAuth?: {
      adminUserId: string;
      sessionId: string;
      role: AdminRole;
    };
  }
}
