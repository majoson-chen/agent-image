import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import { defineConfig } from 'vitest/config'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
    plugins: [tsconfigPaths(), react()],
    resolve: {
        // server-only 在 vitest（jsdom）环境中抛错，统一 mock 为空模块
        alias: {
            // tsconfig 排除了 tests/，vite-tsconfig-paths 不一定为测试文件带上 paths；与 AGENTS Import Alias 对齐
            '@': path.resolve(__dirname, 'app'),
            '@lib': path.resolve(__dirname, 'lib'),
            '~': path.resolve(__dirname, '.'),
            'server-only': path.resolve(__dirname, 'tests/helpers/server-only-mock.ts'),
        },
    },
    test: {
        environment: 'jsdom',
    },
})
