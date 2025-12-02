import { NewPurchase } from '@xstack/app-kit/purchase/components/new-purchase'
import { openPricingDialog } from '@xstack/app-kit/purchase/components/pricing-dialog'
import { useSubscription, useTransactions } from '@xstack/app-kit/purchase/hooks'
import type { AppSubscription } from '@xstack/app-kit/schema'
import * as Settings from '@xstack/app-kit/settings'
import * as Option from 'effect/Option'
import { Fragment, Suspense } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SpinFallback } from '@/components/ui/loading'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { SupportSection } from '@xstack/app-kit/purchase/components/pricing-block'

const formatDate = (date: Date) => {
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

const formatAmount = (amount: string, currency: string) => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(Number(amount) / 100)
}

const STATUS_CONFIG = {
  active: {
    color: 'bg-green-100 text-green-800',
    icon: 'i-lucide-check-circle',
    iconColor: 'text-green-600',
  },
  trialing: {
    color: 'bg-blue-100 text-blue-800',
    icon: 'i-lucide-credit-card',
    iconColor: 'text-blue-600',
  },
  past_due: {
    color: 'bg-yellow-100 text-yellow-800',
    icon: 'i-lucide-alert-circle',
    iconColor: 'text-yellow-600',
  },
  canceled: {
    color: 'bg-gray-100 text-gray-800',
    icon: 'i-lucide-x-circle',
    iconColor: 'text-gray-600',
  },
  paused: {
    color: 'bg-purple-100 text-purple-800',
    icon: 'i-lucide-alert-circle',
    iconColor: 'text-purple-600',
  },
} as const

export function SubscriptionSettings() {
  const { t } = useTranslation()

  return (
    <Fragment>
      <Settings.SettingGroup>
        <Suspense fallback={<SpinFallback className="min-h-64" />}>
          <Subscription />
        </Suspense>
        <Settings.SettingItem
          title={t('pricing.subscription.transactions.title')}
          description={t('pricing.subscription.transactions.description')}
          orientation="vertical"
        >
          <Suspense fallback={<SpinFallback className="min-h-64" />}>
            <TransactionHistory />
          </Suspense>
        </Settings.SettingItem>
        <SupportSection />
      </Settings.SettingGroup>
    </Fragment>
  )
}

function StatusBadge({ status }: { status: keyof typeof STATUS_CONFIG }) {
  const { t } = useTranslation()
  const config = STATUS_CONFIG[status]

  return (
    <Badge variant="secondary" className={cn('font-medium', config.color)}>
      <i className={cn(config.icon, 'mr-1.5 size-3.5', config.iconColor)} />
      {t(`pricing.subscription.status.${status}`)}
    </Badge>
  )
}

function PriceDisplay({ subscription }: { subscription: AppSubscription }) {
  const { t } = useTranslation()
  const isYearly = subscription.billingCycle?.interval === 'year'
  const isOneTime = !subscription.billingCycle

  return (
    <div className="flex flex-col gap-fl-xs">
      <div className="flex flex-col gap-fl-3xs">
        <p className="text-lg font-semibold tracking-tight inline-flex items-center gap-2">
          <i className="i-lucide-check-circle size-5 text-primary" />
          {subscription.name}
          <StatusBadge status={subscription.status} />
        </p>
        <p className="text-sm text-muted-foreground">{subscription.description}</p>
      </div>
      <div>
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tracking-tight">
            {formatAmount(subscription.price.amount, subscription.price.currencyCode)}
          </span>
          <span className="text-sm text-muted-foreground">
            {isOneTime
              ? t('pricing.billing.period.perFiveYears')
              : isYearly
                ? t('pricing.billing.period.monthlyYearly')
                : t('pricing.billing.period.perMonth')}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">
          {isOneTime
            ? t('pricing.billing.info.oneTimeAccess')
            : isYearly
              ? t('pricing.billing.info.yearlyBilling', {
                  price: formatAmount(subscription.price.amount, subscription.price.currencyCode),
                })
              : t('pricing.billing.info.monthlyBilling')}
        </p>
      </div>
    </div>
  )
}

function PeriodDisplay({ subscription }: { subscription: AppSubscription }) {
  const { t } = useTranslation()
  if (!subscription.billingPeriod) return null

  return (
    <div className="rounded-md bg-muted/50 p-4 text-sm">
      <div className="space-y-1">
        <p className="font-medium">{t('pricing.subscription.period.current')}</p>
        <p className="text-muted-foreground">
          {formatDate(new Date(subscription.billingPeriod.startsAt))} -{' '}
          {formatDate(new Date(subscription.billingPeriod.endsAt))}
        </p>
      </div>
    </div>
  )
}

function SubscriptionAlerts({ subscription }: { subscription: AppSubscription }) {
  const { t } = useTranslation()

  return (
    <>
      {subscription.isPaused && (
        <Alert variant="destructive">
          <i className="i-lucide-alert-circle size-4" />
          <AlertTitle>{t('pricing.subscription.period.payment.title')}</AlertTitle>
          <AlertDescription>{t('pricing.subscription.period.payment.description')}</AlertDescription>
        </Alert>
      )}
      {subscription.isTrialing && subscription.trialDates && (
        <Alert>
          <AlertTitle icon={<i className="i-lucide-alert-circle size-4" />}>
            {t('pricing.subscription.period.trial.title')}
          </AlertTitle>
          <AlertDescription>
            {t('pricing.subscription.period.trial.description', {
              date: formatDate(new Date(subscription.trialDates.endsAt)),
            })}
          </AlertDescription>
        </Alert>
      )}
    </>
  )
}

function ManagementButtons({ subscription }: { subscription: AppSubscription }) {
  const { t } = useTranslation()

  const handleUpgrade = () => openPricingDialog()

  return (
    <>
      <Button variant="default" size="sm" onClick={handleUpgrade}>
        <i className="i-lucide-arrow-up-circle mr-2 size-4" />
        {t('pricing.subscription.actions.upgrade')}
      </Button>
      {subscription.managementUrls.updatePaymentMethod && (
        <Button variant="outline" size="sm" asChild>
          <a href={subscription.managementUrls.updatePaymentMethod} target="_blank" rel="noopener noreferrer">
            <i className="i-lucide-credit-card mr-2 size-4" />
            {t('pricing.subscription.actions.manage')}
          </a>
        </Button>
      )}
    </>
  )
}

function Subscription() {
  const { t } = useTranslation()
  const { value: subscription } = useSubscription()

  if (Option.isNone(subscription)) {
    return <NewPurchase />
  }

  const value = subscription.value

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm @container">
      <div className="flex flex-col p-fl-xs-sm gap-fl-xs">
        <div className="flex flex-col @2xl:flex-row @2xl:items-start @2xl:justify-between gap-fl-xs">
          <PriceDisplay subscription={value} />
          <div className="flex flex-col gap-fl-xs">
            <PeriodDisplay subscription={value} />
            <div className="flex flex-wrap gap-2">
              <ManagementButtons subscription={value} />
            </div>
          </div>
        </div>
        <SubscriptionAlerts subscription={value} />
      </div>
    </div>
  )
}

function TransactionHistory() {
  const { t } = useTranslation()
  const { value: subscription } = useSubscription()

  const { loading, hasNextPage, hasPrevPage, next, previous, value: transactions } = useTransactions()

  if (Option.isNone(subscription)) {
    return null
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t('pricing.subscription.transactions.columns.date')}</TableHead>
            <TableHead>{t('pricing.subscription.transactions.columns.description')}</TableHead>
            <TableHead>{t('pricing.subscription.transactions.columns.status')}</TableHead>
            <TableHead>{t('pricing.subscription.transactions.columns.amount')}</TableHead>
            <TableHead className="w-16">{t('pricing.subscription.transactions.columns.receipt')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center">
                <p className="text-muted-foreground">{t('pricing.subscription.transactions.noTransactions')}</p>
              </TableCell>
            </TableRow>
          ) : (
            transactions.map((transaction) => (
              <TableRow key={transaction.id}>
                <TableCell>{formatDate(new Date(transaction.createdAt))}</TableCell>
                <TableCell>{transaction.description}</TableCell>
                <TableCell>{t(`pricing.subscription.transactions.status.${transaction.status}`)}</TableCell>
                <TableCell>
                  {transaction.price && formatAmount(transaction.price.amount, transaction.price.currencyCode)}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={`/api/purchase/transactions/invoice-pdf/${transaction.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <i className="i-lucide-download" />
                    </a>
                  </Button>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
      <div className="border-t py-1">
        <Pagination>
          <PaginationContent>
            <PaginationItem className={cn('min-w-28', !hasPrevPage && 'opacity-60')}>
              <PaginationPrevious onClick={() => previous()} />
            </PaginationItem>
            <PaginationItem className={cn('min-w-28', !hasNextPage && 'opacity-60')}>
              <PaginationNext onClick={() => next()} loading={loading} />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    </div>
  )
}
