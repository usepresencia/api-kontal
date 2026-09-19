module.exports = {
    extends: ['@commitlint/config-conventional'],
    /**
     * Ignora commits que claramente não seguem o formato convencional
     * (por exemplo, mensagens geradas por ferramentas ou merges).
     * Assim, só validamos de fato os commits que começam com "tipo(scope):".
     */
    ignores: [message => !/^[a-z]+(\([\w-]+\))?:/.test(message)],
    rules: {
        /**
         * Permite nomes próprios / termos técnicos no subject
         * (ex.: Kontal, Prisma, DRE).
         */
        'subject-case': [0, 'never'],
    },
};
