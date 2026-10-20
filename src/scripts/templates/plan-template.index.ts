import type { AccountNature } from '@/domain/billing/account-nature.js';
import { PRESET_ROLE_NATURE, REQUIRED_PRESET_ROLES } from '@/domain/ledger/preset-roles.js';
import type { PlanNode, PlanTemplate } from '@/scripts/templates/plan-template.js';

export interface IndexedAccount {
    node: PlanNode;
    nature: AccountNature;
}

/** Contas do modelo por `key`, com a natureza herdada dos ancestrais. */
export function indexTemplate(template: PlanTemplate): Map<string, IndexedAccount> {
    const index = new Map<string, IndexedAccount>();
    const walk = (node: PlanNode, inherited: AccountNature | undefined): void => {
        const nature = node.nature ?? inherited;
        if (!nature) throw new Error(`Conta "${node.name}" sem natureza definida`);
        if (node.key) {
            if (index.has(node.key)) throw new Error(`Chave de conta repetida: ${node.key}`);
            index.set(node.key, { node, nature });
        }
        node.children?.forEach(child => walk(child, nature));
    };
    template.roots.forEach(root => walk(root, undefined));
    return index;
}

/**
 * Confere o modelo antes de gravar: chaves únicas, presets com as contas certas (existentes,
 * analíticas e com a natureza do papel) e nomes de preset únicos.
 * @throws Error descrevendo o primeiro problema encontrado
 */
export function assertTemplateConsistent(template: PlanTemplate): void {
    const index = indexTemplate(template);
    const names = new Set<string>();
    for (const preset of template.presets) {
        if (names.has(preset.name)) throw new Error(`Preset repetido: ${preset.name}`);
        names.add(preset.name);
        for (const role of REQUIRED_PRESET_ROLES) {
            if (!preset.accounts[role])
                throw new Error(`Preset "${preset.name}" sem o papel ${role}`);
        }
        for (const [role, key] of Object.entries(preset.accounts)) {
            const account = index.get(key);
            if (!account) throw new Error(`Preset "${preset.name}": conta "${key}" não existe`);
            if (account.node.type !== 'ANALYTIC') {
                throw new Error(`Preset "${preset.name}": "${key}" não é analítica`);
            }
            const wanted = PRESET_ROLE_NATURE[role as keyof typeof PRESET_ROLE_NATURE];
            if (account.nature !== wanted) {
                throw new Error(
                    `Preset "${preset.name}": ${role} exige ${wanted}, mas "${key}" é ${account.nature}`,
                );
            }
        }
    }
}

/** Quantidade de contas do modelo, somando as sintéticas. */
export function countAccounts(template: PlanTemplate): number {
    const count = (node: PlanNode): number =>
        1 + (node.children?.reduce((sum, child) => sum + count(child), 0) ?? 0);
    return template.roots.reduce((sum, root) => sum + count(root), 0);
}
