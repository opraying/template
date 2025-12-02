import * as it from '@effect/vitest'
import { faker } from '@faker-js/faker'
import { setFaker } from './faker'

setFaker(faker)

it.addEqualityTesters()
