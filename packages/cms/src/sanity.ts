export type ClientPerspective = 'published' | 'drafts' | 'raw'

export type ResponseQueryOptions = {
  perspective?: ClientPerspective
  returnQuery?: boolean
  tag?: string
  cache?: string
  useCdn?: string
}
export interface QueryResponseInitial<QueryResponseResult> {
  data: QueryResponseResult
  sourceMap: any
  perspective?: ClientPerspective
}

export type QueryParams = {
  [key: string]: unknown
}

export type QueryResult<T> = {
  initial: QueryResponseInitial<T>
  query: string
  params: Record<string, unknown>
}

export interface ImageDimensions {
  _type: 'sanity.imageDimensions'
  height: number
  width: number
  aspectRatio: number
}

export interface ImagePalette {
  _type: 'sanity.imagePalette'
  darkMuted?: ImageSwatch
  darkVibrant?: ImageSwatch
  dominant?: ImageSwatch
  lightMuted?: ImageSwatch
  lightVibrant?: ImageSwatch
  muted?: ImageSwatch
  vibrant?: ImageSwatch
}

export interface ImageSwatch {
  _type: 'sanity.imagePaletteSwatch'
  background: string
  foreground: string
  population: number
  title?: string
}

export interface ImageMetadata {
  [key: string]: unknown
  _type: 'sanity.imageMetadata'
  dimensions: ImageDimensions
  palette?: ImagePalette
  lqip?: string
  blurHash?: string
  hasAlpha: boolean
  isOpaque: boolean
}

interface Reference {
  _type: string
  _ref: string
  _key?: string
  _weak?: boolean
  _strengthenOnPublish?: {
    type: string
    weak?: boolean
    template?: {
      id: string
      params: Record<string, string | number | boolean>
    }
  }
}

interface ImageCrop {
  _type?: 'sanity.imageCrop'
  left: number
  bottom: number
  right: number
  top: number
}

interface ImageHotspot {
  _type?: 'sanity.imageHotspot'
  width: number
  height: number
  x: number
  y: number
}

interface Image_2 {
  [key: string]: unknown
  asset?: Reference
  crop?: ImageCrop
  hotspot?: ImageHotspot
}
export type { Image_2 as Image }

export interface Slug {
  _type: 'slug'
  current: string
}

export interface PortableTextSpan {
  _key: string
  _type: 'span'
  text: string
  marks?: string[]
}
