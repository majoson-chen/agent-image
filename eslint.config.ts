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
    },
})
