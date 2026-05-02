import antfu from '@antfu/eslint-config'

export default antfu({
    formatters: true,
    react: true,
    nextjs: true,
    jsonc: true,

    stylistic: {
        indent: 4,
        semi: false,
        quotes: 'single',
        jsx: true,
    },

    rules: {
        'style/curly-newline': ['warn', {
            consistent: true,
            multiline: true,
            minElements: 3,
        }],
        // Next/Node 与 Vitest 中 Buffer、process 作为全局与 `node:` 导入并用时，强制 require 风格噪声大
        'node/prefer-global/buffer': 'off',
        'node/prefer-global/process': 'off',
        // Vitest vi.mock 工厂函数名（useChat、useRouter）易被误判为 React Hook
        'react/component-hook-factories': 'off',
        // Vitest describe 标题常为组件名 / HTTP 方法缩写（POST / GET）
        'test/prefer-lowercase-title': 'off',
        // 设置页删除：原生 confirm
        'no-alert': 'off',
    },

    ignores: [
        'next-env.d.ts',
        // 'canvases/**',
    ],
})
