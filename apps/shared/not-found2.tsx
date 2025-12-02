import { useLocation } from 'react-router'
import { NotFound } from '@xstack/errors/react/errors'

export default function Main() {
  const { pathname } = useLocation()

  return <NotFound />
}
