export type StagedClaim = {
  username: string;
  birthDate: string;
};

let staged: StagedClaim | null = null;

export function stageClaim(next: StagedClaim | null): void {
  staged = next;
}

export function peekClaim(): StagedClaim | null {
  return staged;
}

export function clearClaim(): void {
  staged = null;
}
