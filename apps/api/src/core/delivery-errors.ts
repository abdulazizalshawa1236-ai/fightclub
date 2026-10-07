export class ProviderRejected extends Error {
  constructor(
    readonly retryable: boolean,
    message: string,
  ) {
    super(message);
  }
}
export class ProviderUnknown extends Error {}
