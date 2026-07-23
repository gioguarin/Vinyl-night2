import { PrismaClient } from "@prisma/client";

const g = globalThis as unknown as { __vn_prisma?: PrismaClient };
export const prisma = g.__vn_prisma ?? (g.__vn_prisma = new PrismaClient());
