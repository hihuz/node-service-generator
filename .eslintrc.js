module.exports = {
    parser: '@typescript-eslint/parser', // Specifies the ESLint parser
    extends: [
        'plugin:@typescript-eslint/recommended', // Uses the recommended rules from @typescript-eslint/eslint-plugin
        'plugin:prettier/recommended', // Enables eslint-plugin-prettier and displays prettier errors as ESLint errors. Make sure this is always the last configuration in the extends array.
    ],
    parserOptions: {
        ecmaVersion: 2018, // Allows for the parsing of modern ECMAScript features
        sourceType: 'module', // Allows for the use of imports
    },
    rules: {
        // Place to specify ESLint rules. Can be used to overwrite rules specified from the extended configs
        // e.g. "@typescript-eslint/explicit-function-return-type": "off",
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off',
        '@typescript-eslint/interface-name-prefix': 'off',
        '@typescript-eslint/camelcase': 'off',
        '@typescript-eslint/no-unused-vars': [
            'error',
            { argsIgnorePattern: '^_' }
        ],
        'padding-line-between-statements': [
            'error',
            { blankLine: 'always', prev: '*', next: 'return' },
            { blankLine: 'always', prev: 'import', next: '*' },
            { blankLine: 'any', prev: 'import', next: 'import' },
            { blankLine: 'always', prev: 'block-like', next: '*' },
            { blankLine: 'always', prev: '*', next: 'block-like' },
            { blankLine: 'always', prev: '*', next: ['multiline-const', "multiline-let", 'let', 'const'] },
            { blankLine: 'any', prev: ['multiline-const', "multiline-let", 'let', 'const'], next: ['multiline-const', "multiline-let", 'let', 'const'] },
        ],
        'padded-blocks': ['error', 'never'],
        "spaced-comment": ["error", "always", {
            "line": {
                "markers": ["/"],
                "exceptions": ["-", "+"]
            },
            "block": {
                "markers": ["!"],
                "exceptions": ["*"],
                "balanced": true
            }
        }],
    },
};
