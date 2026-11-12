import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  invoiceNumber?: string
  period?: string
  issueDate?: string
  dueDate?: string
  subtotal?: string
  vat?: string
  total?: string
  paid?: string
  balance?: string
  payLines?: string[]
  terms?: string
  portalUrl?: string
  signoff?: string
}

const Email = ({ clientName, invoiceNumber, period, issueDate, dueDate, subtotal, vat, total, paid, balance, payLines = [], terms, portalUrl, signoff }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Invoice ${invoiceNumber ?? ''} from Site 99, ${balance ?? total ?? ''} due ${dueDate ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={bar} />
        <Text style={eyebrow}>SITE 99 UG LTD · INVOICE</Text>
        <Heading style={h1}>{invoiceNumber ?? 'Your invoice'}</Heading>
        <Text style={body}>{clientName ? `Dear ${clientName},` : 'Hello,'}</Text>
        <Text style={body}>
          Please find the details of your invoice{period ? ` for ${period}` : ''} below. You can download the full PDF any time from your Site 99 client portal.
        </Text>

        <Section style={box}>
          <Text style={row}><span style={k}>Date issued</span> {issueDate}</Text>
          <Text style={row}><span style={k}>Due date</span> {dueDate}</Text>
          <Text style={row}><span style={k}>Subtotal</span> {subtotal}</Text>
          <Text style={row}><span style={k}>VAT</span> {vat}</Text>
          <Text style={row}><span style={k}>Total</span> <strong>{total}</strong></Text>
          {paid ? <Text style={row}><span style={k}>Paid so far</span> {paid}</Text> : null}
          <Text style={due}>Balance due: {balance}</Text>
        </Section>

        {payLines.length > 0 ? (
          <>
            <Text style={h2}>How to pay</Text>
            {payLines.map((l, i) => <Text key={i} style={line}>{l}</Text>)}
            <Text style={small}>Please quote {invoiceNumber} as the reference and send the transaction ID to Finance.</Text>
          </>
        ) : null}

        {portalUrl ? <Button href={portalUrl} style={button}>View and download the invoice</Button> : null}

        {terms ? <Text style={small}>{terms}</Text> : null}
        <Hr style={hr} />
        <Text style={body}>Thank you,<br />{signoff ?? 'Site 99 Finance'}</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Invoice ${d?.invoiceNumber ?? ''} from Site 99${d?.dueDate ? `, due ${d.dueDate}` : ''}`,
  displayName: 'Invoice to a client',
  previewData: {
    clientName: 'Salama Springs',
    invoiceNumber: 'S9926INVA009',
    period: 'November 2026 retainer',
    issueDate: '1 November 2026',
    dueDate: '8 November 2026',
    subtotal: 'UGX 1,500,000',
    vat: 'Not charged',
    total: 'UGX 1,500,000',
    paid: 'UGX 1,000,000',
    balance: 'UGX 500,000',
    payLines: ['MTN MoMo: merchant code 71599788 (KEVIN KYOBE (HEAD FINANCE))'],
    terms: 'Payment is due by the date shown. Please quote the invoice number when you pay.',
    portalUrl: 'https://site99ug.com/residents/portal?tab=contract',
    signoff: 'Site 99 Finance',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#141416' }
const container = { padding: '0 24px 28px', maxWidth: '560px' }
const bar = { backgroundColor: '#C81E24', height: '6px', margin: '0 0 24px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.12em', color: '#8a8a8a', margin: '0 0 6px' }
const h1 = { fontSize: '26px', margin: '0 0 16px', color: '#C81E24' }
const h2 = { fontSize: '12px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a8a8a', margin: '22px 0 8px' }
const box = { border: '1px solid #e6e2dc', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const row = { fontSize: '14px', margin: '0 0 6px' }
const k = { display: 'inline-block', width: '120px', color: '#6b6b6b' }
const due = { fontSize: '16px', fontWeight: 700, color: '#C81E24', margin: '10px 0 0' }
const line = { fontSize: '14px', margin: '0 0 4px' }
const body = { fontSize: '14px', lineHeight: '22px', margin: '0 0 10px' }
const small = { fontSize: '12px', color: '#6b6b6b', lineHeight: '18px', margin: '12px 0 0' }
const button = { backgroundColor: '#C81E24', color: '#ffffff', borderRadius: '999px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', margin: '20px 0 4px' }
const hr = { borderColor: '#e6e2dc', margin: '24px 0 12px' }
