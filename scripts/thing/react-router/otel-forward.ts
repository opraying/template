export const otelForward = (provider: 'axiom' | 'local' = 'local') => {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  let url = 'http://localhost:4318'

  if (provider === 'axiom') {
    headers.Authorization = `Bearer xaat-7a316966-eabc-42f5-b776-fdcedef15344`
    headers['X-Axiom-Dataset'] = 'xstack'
    url = 'https://api.axiom.co'
  }

  const send = (url: string, prefix: string, body: any, headers: Record<string, string>) =>
    fetch(`${url}${prefix}`, {
      body,
      headers,
      method: 'POST',
      // undici needs this
      duplex: 'half',
    } as any)
      .then((_) => _.json())
      .catch(() => {})

  return {
    traces: (body: any) => send(url, '/v1/traces', body, headers),
    logs: (body: any) => send(url, '/v1/logs', body, headers),
    metrics: (body: any) => send(url, '/v1/metrics', body, headers),
  }
}
