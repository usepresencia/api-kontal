/** Repete a asserção até passar ou estourar o tempo; relança a última falha. */
export async function waitFor(
    assertion: () => Promise<void>,
    timeoutMs = 5000,
    intervalMs = 100,
): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
        try {
            await assertion();
            return;
        } catch (error) {
            if (Date.now() >= deadline) throw error;
            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }
    }
}
