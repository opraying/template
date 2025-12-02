import type { LoaderFunctionArgs } from 'react-router'
import { useLocation } from 'react-router'
import { NotFound } from '@xstack/errors/react/errors'

export const loader = ({ request }: LoaderFunctionArgs) => {
  const _pathname = new URL(request.url).pathname

  return new Response(null, { status: 404, statusText: 'Not Found' })
}

export default function Main() {
  const { pathname } = useLocation()

  return <NotFound />
}
