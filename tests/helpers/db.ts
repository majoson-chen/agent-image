import { execSync } from 'node:child_process'
/**
 * 测试用 Prisma 客户端工厂
 * 每次调用创建独立临时 sqlite 文件，afterAll 中清理
 */
import * as fs from 'node:fs/promises'
import * as os from 'node:os'
import * as path from 'node:path'
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite'
import { PrismaClient } from '../../generated/prisma/client'

export async function createTestDb(): Promise<{
    prisma: PrismaClient
    cleanup: () => Promise<void>
}> {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-image-test-'))
    const dbPath = path.join(tmpDir, 'test.db')

    execSync(`DATABASE_URL="file:${dbPath}" bun --bun run prisma migrate deploy`, {
        stdio: 'pipe',
        cwd: process.cwd(),
    })

    const adapter = new PrismaBunSqlite({ url: `file:${dbPath}` })
    const prisma = new PrismaClient({ adapter })

    return {
        prisma,
        cleanup: async () => {
            await prisma.$disconnect()
            await fs.rm(tmpDir, { recursive: true, force: true })
        },
    }
}
