export function findCookieByName(key: string, cookie: string) {
  const cookies = cookie.split(';')
  for (const c of cookies) {
    const [name, value] = c.split('=')
    if (name?.trim() === key) {
      return value
    }
  }
  return undefined
}
