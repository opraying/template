export const defaultConfig = (env: any, _trigger: string) => {
  const namespace = env.NAMESPACE
  const name = env.NAME

  if (!namespace || !name) {
    throw new Error('Worker namespace or name is empty')
  }

  const provider = env['OTEL.PROVIDER']
  const apiKey = env['OTEL.API_KEY']
  const version = env['OTEL.VERSION']
  let url = env['OTEL.URL']
  const headers: Record<string, string> = {}
  const serviceName = `${namespace}-${name}`

  if (provider === 'baselime') {
    headers['x-api-key'] = apiKey
    headers['x-namespace'] = namespace
    headers['x-service'] = serviceName
    headers['x-baselime-dataset'] = namespace
    url = url ?? 'https://otel.baselime.io'
  } else if (provider === 'axiom') {
    headers.Authorization = `Bearer ${apiKey}`
    url = url ?? 'https://api.axiom.co'
  } else {
    url = url ?? 'http://127.0.0.1:4318'
  }

  return {
    logExporter: {
      url: `${url}/v1/logs`,
      headers,
    },
    traceExporter: {
      url: `${url}/v1/traces`,
      headers,
    },
    service: { name: serviceName, namespace, version },
    sampling: {
      headSampler: { ratio: 1 },
    },
  }
}
