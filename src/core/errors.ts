/** Distinguishes corrupt serialization from unavailable storage. */
export class InvalidDraftError extends Error {
  constructor(cause: unknown) { super('Invalid serialized form draft', { cause }); this.name = 'InvalidDraftError'; }
}
