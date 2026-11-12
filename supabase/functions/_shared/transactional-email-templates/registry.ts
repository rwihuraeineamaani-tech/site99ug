import type * as React from 'npm:react@18.3.1'
import { template as shootDayBrief } from './shoot-day-brief.tsx'
import { template as invoiceIssued } from './invoice-issued.tsx'
import { template as paymentReceipt } from './payment-receipt.tsx'

export interface TemplateEntry {
  // deno-lint-ignore no-explicit-any
  component: (props: any) => React.ReactElement
  // deno-lint-ignore no-explicit-any
  subject: string | ((data: any) => string)
  displayName?: string
  // deno-lint-ignore no-explicit-any
  previewData?: Record<string, any>
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  'shoot-day-brief': shootDayBrief,
  'invoice-issued': invoiceIssued,
  'payment-receipt': paymentReceipt,
}
