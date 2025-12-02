// @ts-nocheck
import { BrowserQRCodeSvgWriter } from '@zxing/browser'
import { type ComponentPropsWithRef, useEffect, useState } from 'react'

function gcd(srcWidth: number, srcHeight: number, ratio: number) {
  const ratio2 = Math.min(ratio / srcWidth, ratio / srcHeight)

  return { width: srcWidth * ratio2, height: srcHeight * ratio2 }
}

export function SVGToPNG(
  svg: string,
  ratio: number,
  cb: (src: string, canvas: HTMLCanvasElement, img: HTMLImageElement) => void,
) {
  const img = document.createElement('img')
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  img.src = url
  img.setAttribute('style', 'position:fixed;left:-200vw;')
  img.onload = function onload() {
    const canvas = document.createElement('canvas')

    const ctx = canvas.getContext('2d')!
    const { height, width } = gcd(img.width, img.height, ratio || Math.min(img.width, img.height))
    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(img, 0, 0, width, height)
    const src = canvas.toDataURL('image/png')
    cb(src, canvas, img)
    img.remove()
    URL.revokeObjectURL(url)
  }
  document.body.appendChild(img)
}

export const QrCodePreview = ({ text, ...props }: ComponentPropsWithRef<'div'> & { text: string }) => {
  const [svg, setSvg] = useState('')

  useEffect(() => {
    const writer = new BrowserQRCodeSvgWriter()

    const element = writer.write(text, 176, 176)
    element.style.touchAction = 'auto'
    element.style.userSelect = 'auto'
    setSvg(element.outerHTML)
  }, [text])

  return <div {...props} className="p-4 bg-white/90 rounded" dangerouslySetInnerHTML={{ __html: svg }} />
}
