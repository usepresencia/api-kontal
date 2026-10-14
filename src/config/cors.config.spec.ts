import { buildCorsOptions, parseCorsOrigins } from '@/config/cors.config.js';

describe('parseCorsOrigins', () => {
    it.each([[undefined], [''], ['  '], [' , ,']])('lista vazia para %j', raw => {
        expect(parseCorsOrigins(raw)).toEqual([]);
    });

    it('separa por vírgula, apara espaços e descarta itens vazios', () => {
        expect(parseCorsOrigins('http://a.com, http://b.com ,,')).toEqual([
            'http://a.com',
            'http://b.com',
        ]);
    });
});

describe('buildCorsOptions', () => {
    it('bloqueia qualquer origem quando a lista é vazia', () => {
        expect(buildCorsOptions([]).origin).toBe(false);
    });

    it('libera as origens configuradas e expõe o header de correlação', () => {
        const options = buildCorsOptions(['http://a.com']);
        expect(options.origin).toEqual(['http://a.com']);
        expect(options.credentials).toBe(true);
        expect(options.exposedHeaders).toEqual(['x-correlation-id']);
    });
});
