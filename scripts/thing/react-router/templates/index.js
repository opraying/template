// @ts-ignore
import { contextBuilder } from 'ENTRY_POINT_APP'
// @ts-ignore
import { make } from 'ENTRY_POINT_MAKE'
// @ts-ignore
import * as reactRouterBuild from 'ENTRY_POINT_REACT_ROUTER_BUILD'
// @ts-ignore
import { routingRules } from 'ENTRY_POINT_ROUTING_RULES'

export default {
  fetch: make({
    contextBuilder,
    reactRouterBuild,
    routingRules,
  }),
}
