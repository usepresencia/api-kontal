import type { ProvisionCompanyReport } from '@/scripts/provision-company.js';

const STATUS = {
    existing: 'já existe',
    created: 'criado',
    'to-create': 'será criado',
    granted: 'acesso concedido',
    already: 'acesso já concedido',
    'to-grant': 'receberá acesso OWNER',
} as const;

/** Texto do relatório de provisão, em linhas para o terminal. */
export function formatProvisionReport(report: ProvisionCompanyReport): string {
    const lines = [
        report.applied
            ? 'Provisão aplicada.'
            : 'SIMULAÇÃO (nada foi gravado). Para aplicar, rode de novo com --apply.',
        '',
        `Empresa: ${STATUS[report.company.status]}${report.company.id ? ` (${report.company.id})` : ''}`,
        `Plano de contas: ${STATUS[report.plan.status]} — ${report.plan.accounts} contas e ${report.plan.presets} presets`,
        ...(report.plan.applied ? [`  plano ${report.plan.applied.planId}`] : []),
        'Usuários:',
        ...report.owners.map(owner => `  ${owner.email}: ${STATUS[owner.status]}`),
    ];
    return lines.join('\n');
}
