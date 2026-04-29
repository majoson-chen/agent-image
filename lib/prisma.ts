import process from 'node:process'
import { PrismaClient } from '../generated/prisma/client'

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient }

let _prisma: PrismaClient | undefined

/**
 * 懒初始化 Prisma client。
 * 仅在首次调用时加载 better-sqlite3 原生模块。
 * Bun 测试环境中，路由 handler 通过 ctx.prisma 注入实例，此函数不会被调用。
 */
export function getPrisma(): PrismaClient {
    if (_prisma)
        return _prisma
    if (globalForPrisma.prisma) {
        _prisma = globalForPrisma.prisma
        return _prisma
    }

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')

    const url = process.env.DATABASE_URL ?? 'file:./data.db'
    const adapter = new PrismaBetterSqlite3({ url })
    _prisma = new PrismaClient({ adapter })

    if (process.env.NODE_ENV !== 'production')
        globalForPrisma.prisma = _prisma

    return _prisma
}

// Proxy 实现懒加载：import prisma 时不执行任何 DB 操作
// 只有当真正访问 prisma.xxx 时才触发 getPrisma()
const lazyPrisma: PrismaClient = new Proxy({} as PrismaClient, {
    get(_, prop) {
        return (getPrisma() as Record<string | symbol, unknown>)[prop]
    },
})

export default lazyPrisma
