import { createImageUrlBuilder } from '@sanity/image-url'
import type { Image } from '@xstack/cms/sanity'

import { dataset, projectId } from '@xstack/cms/env'

const builder = createImageUrlBuilder({ projectId, dataset })

export function urlFor(source: Image) {
  return builder.image(source)
}
