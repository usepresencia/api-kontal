import { type PlanTemplate, group, leaf } from '@/scripts/templates/plan-template.js';

/** Contas de apoio comuns aos presets (juros, descontos, perdas e saldo inicial). */
const SUPPORT = {
    interestIncome: 'juros-recebidos',
    discountGranted: 'descontos-concedidos',
    badDebt: 'perdas-inadimplencia',
    interestExpense: 'juros-pagos',
    discountObtained: 'descontos-obtidos',
    debtForgiveness: 'recuperacao-despesas',
    openingBalance: 'saldo-implantacao',
} as const;

/** Plano de contas padrão para empresa de tecnologia (software, assinaturas e serviços). */
export const TECH_COMPANY_PLAN: PlanTemplate = {
    name: 'Plano de Contas — Empresa de Tecnologia',
    description:
        'Estrutura contábil e gerencial para empresa de software e serviços de tecnologia: receita recorrente (SaaS), projetos, custo de nuvem, pessoal e P&D.',
    roots: [
        group(
            'ATIVO',
            [
                group(
                    'Ativo Circulante',
                    [
                        group('Caixa e Equivalentes de Caixa', [
                            leaf('Caixa Geral', 'caixa'),
                            leaf('Banco Conta Movimento', 'banco'),
                            leaf('Conta Digital e Pix', 'conta-digital'),
                            leaf('Aplicações Financeiras de Liquidez Imediata'),
                        ]),
                        group('Contas a Receber', [
                            leaf('Clientes — Assinaturas a Receber', 'clientes-assinaturas'),
                            leaf('Clientes — Serviços e Projetos a Receber', 'clientes-servicos'),
                            leaf('Outros Valores a Receber'),
                        ]),
                        group('Tributos a Recuperar', [
                            leaf('Impostos Retidos na Fonte a Compensar'),
                            leaf('PIS e COFINS a Recuperar'),
                        ]),
                        group('Adiantamentos e Despesas Antecipadas', [
                            leaf('Adiantamentos a Fornecedores'),
                            leaf('Adiantamentos a Colaboradores'),
                            leaf('Licenças e Assinaturas Pagas Antecipadamente'),
                        ]),
                    ],
                    { balance: 'CURRENT_ASSET' },
                ),
                group(
                    'Ativo Não Circulante',
                    [
                        group('Imobilizado', [
                            leaf('Computadores e Periféricos'),
                            leaf('Servidores e Equipamentos de Rede'),
                            leaf('Móveis e Utensílios'),
                            leaf('Instalações'),
                        ]),
                        group('Intangível', [
                            leaf('Software e Plataformas Desenvolvidos'),
                            leaf('Marcas e Patentes'),
                            leaf('Licenças de Software Perpétuas'),
                        ]),
                    ],
                    { balance: 'NON_CURRENT_ASSET' },
                ),
            ],
            { nature: 'ASSET' },
        ),
        group(
            'PASSIVO',
            [
                group(
                    'Passivo Circulante',
                    [
                        group('Fornecedores', [
                            leaf('Fornecedores de Infraestrutura em Nuvem', 'forn-infra'),
                            leaf('Fornecedores de Software e Licenças', 'forn-software'),
                            leaf('Fornecedores — Serviços Profissionais', 'forn-servicos'),
                            leaf('Fornecedores Diversos', 'forn-diversos'),
                        ]),
                        group('Obrigações Trabalhistas', [
                            leaf('Salários a Pagar', 'salarios-a-pagar'),
                            leaf('Pró-labore a Pagar', 'prolabore-a-pagar'),
                            leaf('INSS a Recolher'),
                            leaf('FGTS a Recolher'),
                            leaf('Provisão de Férias e 13º Salário'),
                        ]),
                        group('Obrigações Tributárias', [
                            leaf('Simples Nacional a Recolher', 'das-a-recolher'),
                            leaf('ISS a Recolher'),
                            leaf('PIS e COFINS a Recolher'),
                            leaf('IRPJ e CSLL a Recolher'),
                            leaf('Impostos Retidos a Recolher'),
                        ]),
                        group('Empréstimos e Cartões', [
                            leaf('Empréstimos Bancários de Curto Prazo'),
                            leaf('Cartões de Crédito Corporativos'),
                        ]),
                        group('Outras Obrigações', [
                            leaf('Assinaturas Recebidas Antecipadamente'),
                            leaf('Contas a Pagar Diversas'),
                        ]),
                    ],
                    { balance: 'CURRENT_LIABILITY' },
                ),
                group(
                    'Passivo Não Circulante',
                    [
                        group('Empréstimos e Financiamentos de Longo Prazo', [
                            leaf('Financiamentos Bancários de Longo Prazo'),
                            leaf('Mútuos com Sócios de Longo Prazo'),
                        ]),
                    ],
                    { balance: 'NON_CURRENT_LIABILITY' },
                ),
            ],
            { nature: 'LIABILITY' },
        ),
        group(
            'PATRIMÔNIO LÍQUIDO',
            [
                group('Capital Social', [leaf('Capital Social Subscrito')]),
                group('Reservas e Resultados Acumulados', [
                    leaf('Reservas de Lucros'),
                    leaf('Lucros ou Prejuízos Acumulados', 'lucros-acumulados'),
                    leaf('Saldo Inicial de Implantação', 'saldo-implantacao'),
                ]),
                group('Distribuição de Lucros', [leaf('Distribuição de Lucros a Sócios')]),
            ],
            { nature: 'EQUITY', balance: 'EQUITY' },
        ),
        group(
            'RECEITAS',
            [
                group(
                    'Receita Operacional Bruta',
                    [
                        group('Receita de Software e Assinaturas', [
                            leaf('Assinaturas SaaS Recorrentes', 'receita-saas'),
                            leaf('Licenciamento de Software'),
                            leaf('Implantação e Onboarding'),
                        ]),
                        group('Receita de Serviços', [
                            leaf('Desenvolvimento sob Demanda e Projetos', 'receita-projetos'),
                            leaf('Consultoria e Suporte Técnico'),
                            leaf('Treinamentos e Workshops'),
                        ]),
                        group('Receita de Parcerias', [
                            leaf('Revenda de Licenças e Integrações'),
                            leaf('Comissões e Parcerias Comerciais'),
                        ]),
                    ],
                    { dre: 'GROSS_REVENUE' },
                ),
                group(
                    'Receitas Financeiras',
                    [
                        leaf('Juros e Multas Recebidos', 'juros-recebidos'),
                        leaf('Rendimentos de Aplicações Financeiras'),
                        leaf('Descontos Obtidos', 'descontos-obtidos'),
                        leaf('Variações Cambiais Ativas'),
                    ],
                    { dre: 'FINANCIAL_REVENUE' },
                ),
                group(
                    'Outras Receitas',
                    [
                        leaf('Recuperação de Despesas e Perdão de Dívidas', 'recuperacao-despesas'),
                        leaf('Venda de Ativo Imobilizado'),
                        leaf('Receitas Eventuais'),
                    ],
                    { dre: 'OTHER_REVENUE' },
                ),
            ],
            { nature: 'REVENUE' },
        ),
        group(
            'CUSTOS E DESPESAS',
            [
                group(
                    'Deduções da Receita Bruta',
                    [
                        leaf('Simples Nacional (DAS)', 'das'),
                        leaf('ISS sobre Serviços e Assinaturas'),
                        leaf('PIS e COFINS sobre a Receita'),
                        leaf('Cancelamentos e Devoluções'),
                    ],
                    { dre: 'REVENUE_DEDUCTION' },
                ),
                group(
                    'Custo dos Serviços Prestados',
                    [
                        group(
                            'Infraestrutura',
                            [
                                leaf('Hospedagem e Nuvem', 'nuvem'),
                                leaf('Bancos de Dados e CDN'),
                                leaf('Monitoramento e Observabilidade'),
                            ],
                            { cost: 'VARIABLE' },
                        ),
                        group(
                            'Serviços e APIs de Terceiros',
                            [
                                leaf('Gateways e Taxas de Pagamento'),
                                leaf('APIs de Inteligência Artificial e Mensageria'),
                                leaf('Licenças de Software Revendidas'),
                            ],
                            { cost: 'VARIABLE' },
                        ),
                        group(
                            'Pessoal de Entrega e Suporte',
                            [
                                leaf('Salários e Encargos — Suporte e Sucesso do Cliente'),
                                leaf('Salários e Encargos — Operações e Implantação'),
                                leaf('Prestadores de Serviço de Entrega'),
                            ],
                            { cost: 'FIXED' },
                        ),
                    ],
                    { dre: 'COST_OF_SALES' },
                ),
                group(
                    'Despesas Operacionais',
                    [
                        group(
                            'Pesquisa e Desenvolvimento',
                            [
                                leaf('Salários e Encargos — Engenharia', 'folha'),
                                leaf('Prestadores de Desenvolvimento', 'dev-pj'),
                                leaf('Ferramentas de Desenvolvimento e Licenças', 'ferramentas'),
                            ],
                            { cost: 'FIXED' },
                        ),
                        group('Comercial e Marketing', [
                            leaf('Mídia Paga e Anúncios', 'midia', 'VARIABLE'),
                            leaf('Comissões de Vendas', undefined, 'VARIABLE'),
                            leaf('Eventos e Patrocínios', undefined, 'VARIABLE'),
                            leaf('Salários e Encargos — Comercial e Marketing', undefined, 'FIXED'),
                        ]),
                        group(
                            'Administrativas',
                            [
                                leaf('Pró-labore', 'prolabore'),
                                leaf('Salários e Encargos — Administrativo'),
                                leaf('Aluguel e Coworking', 'aluguel'),
                                leaf('Energia, Internet e Telefonia', 'utilidades'),
                                leaf('Contabilidade e Assessoria Jurídica', 'contabilidade'),
                                leaf('Material de Escritório'),
                                leaf('Viagens e Deslocamentos'),
                                leaf('Seguros'),
                                leaf('Assinaturas de Software Administrativo'),
                                leaf('Depreciação e Amortização', undefined, 'DEPRECIATION'),
                            ],
                            { cost: 'FIXED' },
                        ),
                        group('Perdas e Provisões', [
                            leaf('Perdas com Clientes Inadimplentes', 'perdas-inadimplencia'),
                        ]),
                    ],
                    { dre: 'OPERATING_EXPENSE' },
                ),
                group(
                    'Despesas Financeiras',
                    [
                        leaf('Juros e Multas Pagos', 'juros-pagos'),
                        leaf('Tarifas Bancárias'),
                        leaf('Descontos Concedidos', 'descontos-concedidos'),
                        leaf('IOF e Variações Cambiais Passivas'),
                    ],
                    { dre: 'FINANCIAL_EXPENSE' },
                ),
                group(
                    'Outras Despesas',
                    [leaf('Perda na Baixa de Imobilizado'), leaf('Despesas Eventuais')],
                    { dre: 'OTHER_EXPENSE' },
                ),
                group('Impostos sobre o Lucro', [leaf('IRPJ'), leaf('CSLL')], {
                    dre: 'INCOME_TAX',
                }),
            ],
            { nature: 'EXPENSE' },
        ),
    ],
    presets: [
        {
            name: 'Assinaturas SaaS',
            description: 'Receita recorrente de assinaturas e os custos de nuvem que a sustentam',
            accounts: {
                receivable: 'clientes-assinaturas',
                payable: 'forn-infra',
                revenue: 'receita-saas',
                expense: 'nuvem',
                ...SUPPORT,
            },
        },
        {
            name: 'Projetos e Serviços sob Demanda',
            description: 'Desenvolvimento e consultoria faturados por projeto',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-servicos',
                revenue: 'receita-projetos',
                expense: 'dev-pj',
                ...SUPPORT,
            },
        },
        {
            name: 'Hospedagem e Nuvem',
            description: 'Faturas de provedores de nuvem, banco de dados e CDN',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-infra',
                expense: 'nuvem',
                ...SUPPORT,
            },
        },
        {
            name: 'Licenças e Ferramentas',
            description: 'Assinaturas de software e ferramentas de desenvolvimento',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-software',
                expense: 'ferramentas',
                ...SUPPORT,
            },
        },
        {
            name: 'Mídia e Marketing',
            description: 'Anúncios e mídia paga',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-diversos',
                expense: 'midia',
                ...SUPPORT,
            },
        },
        {
            name: 'Folha de Pagamento',
            description: 'Salários e encargos da equipe',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'salarios-a-pagar',
                expense: 'folha',
                ...SUPPORT,
            },
        },
        {
            name: 'Pró-labore',
            description: 'Retirada dos sócios',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'prolabore-a-pagar',
                expense: 'prolabore',
                ...SUPPORT,
            },
        },
        {
            name: 'Aluguel e Coworking',
            description: 'Aluguel, condomínio e coworking',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-diversos',
                expense: 'aluguel',
                ...SUPPORT,
            },
        },
        {
            name: 'Energia, Internet e Telefonia',
            description: 'Contas de consumo do escritório',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-diversos',
                expense: 'utilidades',
                ...SUPPORT,
            },
        },
        {
            name: 'Contabilidade e Assessoria Jurídica',
            description: 'Honorários contábeis e jurídicos',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'forn-servicos',
                expense: 'contabilidade',
                ...SUPPORT,
            },
        },
        {
            name: 'Impostos sobre Faturamento',
            description: 'Guia do Simples Nacional (DAS)',
            accounts: {
                receivable: 'clientes-servicos',
                payable: 'das-a-recolher',
                expense: 'das',
                ...SUPPORT,
            },
        },
    ],
};
