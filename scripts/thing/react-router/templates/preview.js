import routes from './routes.js'
import worker from './worker.js'

export default {
  fetch(request, env, context) {
    const { pathname } = new URL(request.url)

    for (const exclude of routes.exclude) {
      if (isRoutingRuleMatch(pathname, exclude)) {
        return env.ASSETS.fetch(request)
      }
    }

    for (const include of routes.include) {
      if (isRoutingRuleMatch(pathname, include)) {
        if (worker.fetch === undefined) {
          throw new TypeError('Entry point missing `fetch` handler')
        }
        return worker.fetch(request, env, context)
      }
    }

    return env.ASSETS.fetch(request)
  },
}

export function isRoutingRuleMatch(pathname, routingRule) {
  // sanity checks
  if (!pathname) {
    throw new Error('Pathname is undefined.')
  }
  if (!routingRule) {
    throw new Error('Routing rule is undefined.')
  }

  const ruleRegExp = transformRoutingRuleToRegExp(routingRule)
  return pathname.match(ruleRegExp) !== null
}

function transformRoutingRuleToRegExp(rule) {
  let transformedRule

  if (rule === '/' || rule === '/*') {
    transformedRule = rule
  } else if (rule.endsWith('/*')) {
    // make `/*` an optional group so we can match both /foo/* and /foo
    // /foo/* => /foo(/*)?
    transformedRule = `${rule.substring(0, rule.length - 2)}(/*)?`
  } else if (rule.endsWith('/')) {
    // make `/` an optional group so we can match both /foo/ and /foo
    // /foo/ => /foo(/)?
    transformedRule = `${rule.substring(0, rule.length - 1)}(/)?`
  } else if (rule.endsWith('*')) {
    transformedRule = rule
  } else {
    transformedRule = `${rule}(/)?`
  }

  // /foo* => /foo.* => ^/foo.*$
  // /*.* => /*\.* => /.*\..* => ^/.*\..*$
  transformedRule = `^${transformedRule.replaceAll(/\./g, '\\.').replaceAll(/\*/g, '.*')}$`

  // ^/foo.*$ => /^\/foo.*$/
  return new RegExp(transformedRule)
}
