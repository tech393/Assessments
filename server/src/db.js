import { PrismaClient } from '@prisma/client';

// One shared client for the whole process (each client opens its own connection pool).
export const prisma = new PrismaClient();
