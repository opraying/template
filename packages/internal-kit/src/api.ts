import * as HttpApi from '@effect/platform/HttpApi'
import * as HttpApiEndpoint from '@effect/platform/HttpApiEndpoint'
import * as HttpApiGroup from '@effect/platform/HttpApiGroup'
import * as OpenApi from '@effect/platform/OpenApi'
import * as Schema from 'effect/Schema'

export class InternalApi extends HttpApiGroup.make('internal')
  .add(HttpApiEndpoint.get('get r2 object', '/r2/:key').setPath(Schema.Struct({ key: Schema.String })))
  .prefix('/api/internal')
  .annotateContext(
    OpenApi.annotations({
      title: 'Internal API',
      description: 'Internal',
      version: '0.0.1',
    }),
  ) {}

export class MyHttpApi extends HttpApi.make('api').add(InternalApi) {}
