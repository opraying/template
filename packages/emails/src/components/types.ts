export interface CompanyInfo {
  name: string
  url: string
  logo: {
    src: string
    width?: number
    height?: number
    alt?: string
  }
  address?: string
  links?: Array<{
    href: string
    label: string
  }>
  description?: string
}
