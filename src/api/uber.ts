interface UberVoucherResponse {
  voucherId: string;
  claimUrl: string;
  expiresAt: string;
}

export async function issueUberVoucher(
  pnr: string,
  name: string,
  amount: number
): Promise<UberVoucherResponse> {
  const response = await fetch('/api/uber/issue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pnr, name, amount }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Uber API error');
  }

  return response.json();
}
