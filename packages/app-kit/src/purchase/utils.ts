import { AppPlan } from '@xstack/app-kit/schema'

/**
 * Supported billing intervals for subscription plans
 */
export type Interval = 'day' | 'week' | 'month' | 'year'

/**
 * Currency formatting options with sensible defaults
 */
export interface CurrencyFormatOptions {
  /** Currency code (e.g., 'USD', 'EUR') */
  currency: string
  /** Locale for formatting (e.g., 'en-US', 'de-DE') */
  locale: string
  /** Whether to use compact display for large numbers */
  compact?: boolean
  /** Minimum fraction digits to display */
  minimumFractionDigits?: number
  /** Maximum fraction digits to display */
  maximumFractionDigits?: number
}

/**
 * Result type for price formatting operations
 */
export interface FormattedPrice {
  /** The formatted price string */
  formatted: string
  /** The numeric value in the smallest currency unit (e.g., cents) */
  valueInCents: number
  /** The numeric value in the main currency unit */
  valueInCurrency: number
  /** The currency code used */
  currency: string
  /** Whether formatting was successful */
  isValid: boolean
}

/**
 * Plan comparison result interface
 */
export interface PlanComparison {
  /** Whether the new plan is an upgrade */
  isUpgrade: boolean
  /** Whether the new plan is a downgrade */
  isDowngrade: boolean
  /** Whether it's the same plan with different billing */
  isBillingChange: boolean
  /** Price difference in cents (positive for more expensive) */
  priceDifference: number
  /** Whether the change is allowed */
  isAllowed: boolean
}

/**
 * Validates and parses a numeric amount string
 * @param amount - Amount string to validate
 * @returns Parsed number or throws error if invalid
 */
function parseAmount(amount: string | number): number {
  const parsed = typeof amount === 'string' ? Number(amount) : amount

  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Invalid amount: ${amount}. Amount must be a non-negative number.`)
  }

  return parsed
}

/**
 * Validates currency code format
 * @param currencyCode - Currency code to validate
 * @returns true if valid, throws error if invalid
 */
function validateCurrencyCode(currencyCode: string): boolean {
  if (!currencyCode || typeof currencyCode !== 'string') {
    throw new Error('Currency code is required and must be a string')
  }

  // Basic currency code validation (3 letters, uppercase)
  if (!/^[A-Z]{3}$/.test(currencyCode)) {
    console.warn(`Currency code "${currencyCode}" may not be valid. Expected 3 uppercase letters.`)
  }

  return true
}

/**
 * Validates locale string
 * @param locale - Locale to validate
 * @returns true if valid, throws error if invalid
 */
function validateLocale(locale: string): boolean {
  if (!locale || typeof locale !== 'string') {
    throw new Error('Locale is required and must be a string')
  }

  return true
}

/**
 * Creates a robust number formatter with error handling
 * @param options - Currency formatting options
 * @returns Configured Intl.NumberFormat instance
 */
function createCurrencyFormatter(options: CurrencyFormatOptions): Intl.NumberFormat {
  validateCurrencyCode(options.currency)
  validateLocale(options.locale)

  try {
    return new Intl.NumberFormat(options.locale, {
      style: 'currency',
      currency: options.currency,
      compactDisplay: options.compact ? 'short' : undefined,
      minimumFractionDigits: options.minimumFractionDigits,
      maximumFractionDigits: options.maximumFractionDigits,
    })
  } catch (error) {
    console.warn(`Failed to create currency formatter for ${options.currency}/${options.locale}:`, error)
    // Fallback to basic formatter
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    })
  }
}

/**
 * Format a price amount with comprehensive error handling and validation
 * @param amount - Amount in cents (or smallest currency unit)
 * @param options - Currency formatting options
 * @returns Formatted price result with validation info
 */
export function formatPrice(amount: string | number, options: CurrencyFormatOptions): FormattedPrice {
  try {
    const valueInCents = parseAmount(amount)
    const valueInCurrency = valueInCents / 100
    const formatter = createCurrencyFormatter(options)

    return {
      formatted: formatter.format(valueInCurrency),
      valueInCents,
      valueInCurrency,
      currency: options.currency,
      isValid: true,
    }
  } catch (error) {
    console.error('Price formatting failed:', error)

    return {
      formatted: 'Invalid Price',
      valueInCents: 0,
      valueInCurrency: 0,
      currency: options.currency,
      isValid: false,
    }
  }
}

/**
 * Format monthly price with interval conversion and validation
 * @param amount - Amount in cents
 * @param currencyCode - Currency code (e.g., 'USD')
 * @param locale - Locale for formatting
 * @param interval - Billing interval (defaults to 'month')
 * @returns Formatted monthly price string
 */
export function formatMonthlyPrice(
  amount: string | number,
  currencyCode: string,
  locale: string,
  interval: Interval = 'month',
): string {
  try {
    const amountInCents = parseAmount(amount)

    // Convert to monthly amount based on interval
    const monthlyAmountInCents = interval === 'year' ? amountInCents / 12 : amountInCents

    const result = formatPrice(monthlyAmountInCents, {
      currency: currencyCode,
      locale,
      compact: true,
    })

    return result.formatted
  } catch (error) {
    console.error('Monthly price formatting failed:', error)
    return 'Invalid Price'
  }
}

/**
 * Format yearly price with validation
 * @param amount - Amount in cents
 * @param currencyCode - Currency code (e.g., 'USD')
 * @param locale - Locale for formatting
 * @returns Formatted yearly price string
 */
export function formatYearlyPrice(amount: string | number, currencyCode: string, locale: string): string {
  try {
    const result = formatPrice(amount, {
      currency: currencyCode,
      locale,
      compact: true,
    })

    return result.formatted
  } catch (error) {
    console.error('Yearly price formatting failed:', error)
    return 'Invalid Price'
  }
}

/**
 * Calculate yearly discount percentage with comprehensive validation
 * @param yearlyPlan - The yearly subscription plan
 * @param monthlyPlan - The monthly subscription plan
 * @returns Discount percentage (0-100) or 0 if invalid
 */
export function calculateYearlyDiscount(yearlyPlan: AppPlan, monthlyPlan: AppPlan): number {
  try {
    // Validate plan types
    if (!yearlyPlan?.isYearly || !monthlyPlan?.isMonthly) {
      console.warn('Invalid plan types for discount calculation')
      return 0
    }

    // Validate price data exists
    if (!yearlyPlan.price?.amount || !monthlyPlan.price?.amount) {
      console.warn('Missing price data for discount calculation')
      return 0
    }

    // Validate currency codes match
    if (yearlyPlan.price.currencyCode !== monthlyPlan.price.currencyCode) {
      console.warn('Currency mismatch between plans for discount calculation')
      return 0
    }

    const monthlyAmount = parseAmount(monthlyPlan.price.amount)
    const yearlyAmount = parseAmount(yearlyPlan.price.amount)

    // Avoid division by zero
    if (monthlyAmount === 0) {
      console.warn('Monthly amount is zero, cannot calculate discount')
      return 0
    }

    // Calculate equivalent monthly cost of yearly plan
    const yearlyMonthlyEquivalent = yearlyAmount / 12

    // Calculate discount percentage
    const discountPercentage = ((monthlyAmount - yearlyMonthlyEquivalent) / monthlyAmount) * 100

    // Ensure result is non-negative and reasonable
    return Math.max(0, Math.min(100, Math.round(discountPercentage)))
  } catch (error) {
    console.error('Yearly discount calculation failed:', error)
    return 0
  }
}

/**
 * Check if a plan is available for selection with detailed comparison
 * @param plan - Plan to check availability for
 * @param currentPlan - Currently active plan (if any)
 * @returns Detailed comparison result
 */
export function comparePlans(plan: AppPlan, currentPlan: AppPlan | null): PlanComparison {
  try {
    // No current plan means all plans are available
    if (!currentPlan) {
      return {
        isUpgrade: true,
        isDowngrade: false,
        isBillingChange: false,
        priceDifference: parseAmount(plan.price?.amount || 0),
        isAllowed: true,
      }
    }

    // Can't select already active plan
    if (plan.isActive) {
      return {
        isUpgrade: false,
        isDowngrade: false,
        isBillingChange: false,
        priceDifference: 0,
        isAllowed: false,
      }
    }

    const currentAmount = parseAmount(currentPlan.price?.amount || 0)
    const newAmount = parseAmount(plan.price?.amount || 0)
    const priceDifference = newAmount - currentAmount

    // Same plan type - billing interval change
    if (currentPlan.plan === plan.plan) {
      const isBillingChange = currentPlan.isMonthly && plan.isYearly

      return {
        isUpgrade: isBillingChange,
        isDowngrade: false,
        isBillingChange,
        priceDifference,
        isAllowed: isBillingChange,
      }
    }

    // Different plan types
    const isUpgrade = newAmount > currentAmount
    const isDowngrade = newAmount < currentAmount

    return {
      isUpgrade,
      isDowngrade,
      isBillingChange: false,
      priceDifference,
      isAllowed: isUpgrade,
    }
  } catch (error) {
    console.error('Plan comparison failed:', error)
    return {
      isUpgrade: false,
      isDowngrade: false,
      isBillingChange: false,
      priceDifference: 0,
      isAllowed: false,
    }
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use comparePlans instead for more detailed information
 */
export function isPlanAvailable(plan: AppPlan, currentPlan: AppPlan | null): boolean {
  return comparePlans(plan, currentPlan).isAllowed
}

/**
 * Sort plans with comprehensive ordering logic and error handling
 * @param plans - Array of plans to sort
 * @returns Sorted array of plans
 */
export function sortPlans(plans: ReadonlyArray<AppPlan>): AppPlan[] {
  if (!Array.isArray(plans)) {
    console.warn('Invalid plans array provided to sortPlans')
    return []
  }

  try {
    return plans.slice().sort((a, b) => {
      // Handle invalid plan objects
      if (!a || !b) {
        return a ? -1 : b ? 1 : 0
      }

      // Primary sort: One-time payments last
      if (a.isOneTime && !b.isOneTime) return 1
      if (!a.isOneTime && b.isOneTime) return -1

      // Secondary sort: For recurring plans, monthly before yearly
      if (!a.isOneTime && !b.isOneTime) {
        if (a.isMonthly && b.isYearly) return -1
        if (a.isYearly && b.isMonthly) return 1

        // Tertiary sort: By price (ascending)
        const priceA = parseAmount(a.price?.amount || 0)
        const priceB = parseAmount(b.price?.amount || 0)

        if (priceA !== priceB) {
          return priceA - priceB
        }
      }

      // Quaternary sort: By plan name (alphabetical)
      const nameA = a.plan || ''
      const nameB = b.plan || ''

      return nameA.localeCompare(nameB)
    })
  } catch (error) {
    console.error('Plan sorting failed:', error)
    return plans.slice() // Return copy of original array as fallback
  }
}

/**
 * Find the best plan recommendation based on current plan and preferences
 * @param plans - Available plans
 * @param currentPlan - Current active plan
 * @param preferYearly - Whether to prefer yearly billing
 * @returns Recommended plan or null if none suitable
 */
export function findRecommendedPlan(
  plans: ReadonlyArray<AppPlan>,
  currentPlan: AppPlan | null,
  preferYearly: boolean = false,
): AppPlan | null {
  if (!Array.isArray(plans) || plans.length === 0) {
    return null
  }

  try {
    const availablePlans = plans.filter((plan) => comparePlans(plan, currentPlan).isAllowed)

    if (availablePlans.length === 0) {
      return null
    }

    // If no current plan, recommend the most basic plan
    if (!currentPlan) {
      const sortedPlans = sortPlans(availablePlans)
      const basicPlan = sortedPlans.find((plan) => !plan.isOneTime)
      return basicPlan || sortedPlans[0]
    }

    // For existing users, recommend upgrades or billing changes
    const upgrades = availablePlans.filter((plan) => {
      const comparison = comparePlans(plan, currentPlan)
      return comparison.isUpgrade || comparison.isBillingChange
    })

    if (upgrades.length === 0) {
      return null
    }

    // Filter by billing preference if specified
    const filtered = preferYearly ? upgrades.filter((plan) => plan.isYearly) : upgrades

    // Return the most suitable upgrade
    const sortedUpgrades = sortPlans(filtered.length > 0 ? filtered : upgrades)
    return sortedUpgrades[0]
  } catch (error) {
    console.error('Plan recommendation failed:', error)
    return null
  }
}
