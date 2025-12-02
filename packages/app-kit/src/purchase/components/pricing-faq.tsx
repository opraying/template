import React, { useMemo } from 'react'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useTranslation } from 'react-i18next'

export const PricingFaq = React.memo(function PricingFaq() {
  const { t } = useTranslation()

  const faqItems = useMemo(
    () =>
      Array.from({ length: 3 }).map((_, index) => ({
        id: `item-${index + 1}`,
        question: t(`pricing.faq.q${index + 1}.question`),
        answer: t(`pricing.faq.q${index + 1}.answer`),
      })),
    [t],
  )

  return (
    <div className="py-4 sm:py-5 px-2 sm:px-4">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-center">{t('pricing.faq.title') || 'Frequently Asked Questions'}</h3>
      </div>
      <Accordion type="multiple" className="w-full">
        {faqItems.map((item) => (
          <AccordionItem key={item.id} value={item.id}>
            <AccordionTrigger className="text-left text-sm sm:text-base">{item.question}</AccordionTrigger>
            <AccordionContent className="text-sm sm:text-base text-muted-foreground">{item.answer}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
})
