import { PhotoProvider as ReactPhotoProvider, PhotoView as ReactPhotoView } from 'react-image-previewer'

export const PhotoProvider = (
  import.meta.env.SSR ? ({ children }: { children: React.ReactNode }) => children : ReactPhotoProvider
) as typeof ReactPhotoProvider

export const PhotoView = (
  import.meta.env.SSR ? ({ children }: { children: React.ReactNode }) => children : ReactPhotoView
) as typeof ReactPhotoView
