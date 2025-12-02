import * as ScreenClient from './screen.client'

export default import.meta.env.SSR ? () => null : ScreenClient.Component
