interface CommsResponse {
  messageId: string;
  status: string;
}

export async function sendComms(
  pnr: string,
  contact: string,
  templateId: string,
  data: Record<string, any>
): Promise<CommsResponse> {
  const response = await fetch('/api/15below/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pnr, contact, templateId, data }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || '15below API error');
  }

  return response.json();
}
