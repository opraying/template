import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Carousel, type CarouselApi, CarouselContent, CarouselItem } from '@/lib/ui/carousel'
import { cn } from '@/lib/utils'
import { m } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface Feature {
  id: string
  title: React.ReactNode
  description: React.ReactNode
  img: string
  className?: string | undefined
  style?: React.CSSProperties | undefined
}

export function FeatureBlock() {
  const { t } = useTranslation()
  const [api, setApi] = useState<CarouselApi>()
  const isAnimating = useRef(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const features: Feature[] = [
    {
      id: 'feature-1',
      title: t('pricing.slider.feature-1.title'),
      description: t('pricing.slider.feature-1.description'),
      img: '/images/feature-1.svg',
      // className: 'bg-gradient-to-r from-primary to-primary/50',
      style: {
        backgroundColor: '#C7FDCC',
      },
    },
    {
      id: 'feature-2',
      title: t('pricing.slider.feature-2.title'),
      description: t('pricing.slider.feature-2.description'),
      img: '/images/feature-2.svg',
      style: {
        backgroundColor: '#CEC7FD',
      },
    },
    {
      id: 'feature-3',
      title: t('pricing.slider.feature-3.title'),
      description: t('pricing.slider.feature-3.description'),
      img: '/images/feature-3.svg',
      style: {
        backgroundColor: '#FAFDC8',
      },
    },
    {
      id: 'feature-4',
      title: t('pricing.slider.feature-4.title'),
      description: t('pricing.slider.feature-4.description'),
      img: '/images/feature-4.svg',
      style: {
        backgroundColor: '#FDD8C8',
      },
    },
  ]

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault()

      if (!api || isAnimating.current) return

      // 获取主要滚动方向的值
      const mainDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      const direction = mainDelta > 0 ? 1 : -1

      // 只有滚动量超过阈值才触发切换
      if (Math.abs(mainDelta) > 0) {
        isAnimating.current = true

        if (direction > 0) {
          api.scrollNext()
        } else {
          api.scrollPrev()
        }
      }
    },
    [api],
  )

  useEffect(() => {
    if (!api) return

    api.on('settle', () => {
      isAnimating.current = false
    })
  }, [api])

  useEffect(() => {
    const container = containerRef.current
    if (container) {
      container.addEventListener('wheel', handleWheel, { passive: false })
      return () => container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  return (
    <Carousel
      ref={containerRef}
      setApi={setApi}
      opts={{
        align: 'center',
        loop: true,
        // duration: 20,
        containScroll: 'trimSnaps',
      }}
      className="max-w-3xl mx-auto"
    >
      <CarouselContent className="-ml-4">
        {features.map((feature) => (
          <CarouselItem key={feature.id} className="basis-full md:basis-[80%] h-[260px]">
            <div
              className={cn(
                'flex flex-col items-center rounded-xl h-full border border-border/50 shadow-sm select-none',
                feature.className,
              )}
              style={feature.style}
            >
              <img draggable={false} src={feature.img} alt={'pricing-feature'} className="h-[65%] mt-4" />
              <div className="flex flex-col gap-1 items-center pt-2">
                <h3 className="text-fl-base font-semibold">{feature.title}</h3>
                <p className="leading-relaxed text-fl">{feature.description}</p>
              </div>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
    </Carousel>
  )
}

interface VersionFeatureProps {
  label: string
  tooltip?: string
}

function VersionFeature({ label, tooltip }: VersionFeatureProps) {
  return (
    <div className="inline-flex items-center gap-2" title={tooltip}>
      <div className="size-7 flex items-center justify-center">
        <i className="i-lucide-check w-4 h-4" />
      </div>
      <span>{label}</span>
    </div>
  )
}

interface ProVersionCardProps {
  onUpgrade: () => void
}

export function ProVersionCard({ onUpgrade }: ProVersionCardProps) {
  const { t } = useTranslation()

  return (
    <m.div whileHover={{ scale: 1.01 }}>
      <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="flex items-center justify-between gap-4 px-4 py-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2.5">
              <i className="i-lucide-rocket w-5 h-5 text-primary" />
              <h3 className="font-medium">{t('pricing.display.pro.title')}</h3>
            </div>
            <div className="flex items-center gap-4 text-sm text-muted-foreground pl-5">
              <VersionFeature label={t('pricing.display.pro.feature1')} />
              <VersionFeature label={t('pricing.display.pro.feature2')} />
              <VersionFeature label={t('pricing.display.pro.feature3')} />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <Button size="sm" onClick={onUpgrade}>
              {t('pricing.display.pro.learn-more')}
            </Button>
          </div>
        </CardContent>
      </Card>
    </m.div>
  )
}

export function FreeVersionCard() {
  const { t } = useTranslation()

  return (
    <div className="px-4 py-3 rounded-lg border bg-card @container">
      <div className="flex @xs:flex-col @md:flex-row @md:justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="rounded-md bg-muted size-7 flex items-center justify-center">
            <i className="i-lucide-zap w-4 h-4 text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-sm font-medium">{t('pricing.display.free.title')}</h3>
            <p className="text-xs text-muted-foreground pt-0.5">{t('pricing.display.free.subtitle')}</p>
          </div>
        </div>
        <div className="flex items-center gap-6 text-sm text-muted-foreground">
          <VersionFeature label={t('pricing.display.free.feature1')} />
          <VersionFeature label={t('pricing.display.free.feature2')} />
          <VersionFeature label={t('pricing.display.free.feature3')} />
        </div>
      </div>
    </div>
  )
}

export function SupportSection() {
  const { t } = useTranslation()
  return (
    <div className="pt-6">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">{t('support.desc')}</p>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" className="h-8 px-3 text-xs font-medium" asChild>
            <a href="/contact">
              <i className="i-lucide-mail w-3.5 h-3.5 mr-1.5" />
              {t('support.contact')}
            </a>
          </Button>
          {/* <Button variant="secondary" size="sm" className="h-8 px-3 text-xs font-medium">
              <i className="i-lucide-book-open w-3.5 h-3.5 mr-1.5" />
              {t('support.documentation')}
            </Button> */}
        </div>
      </div>
    </div>
  )
}
