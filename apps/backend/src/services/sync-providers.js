export function getSyncProvider(service) {
  return {
    async execute(job) {
      throw new Error(`Sync provider not configured: ${service} (${job.id})`);
    }
  };
}
