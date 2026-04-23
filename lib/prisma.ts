import process from 'node:process'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient
}
const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? 'file:./data.db',
})
const prisma
    = globalForPrisma.prisma
        || new PrismaClient({
            adapter,
        })
if (process.env.NODE_ENV !== 'production')
    globalForPrisma.prisma = prisma
export default prisma
