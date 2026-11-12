import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Hr, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  clientName?: string
  receiptNumber?: string
  invoiceNumber?: string
  amount?: string
  date?: string
  method?: string
  tid?: string
  balance?: string
  note?: string
  portalUrl?: string
}

const Email = ({ clientName, receiptNumber, invoiceNumber, amount, date, method, tid, balance, note, portalUrl }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`We received ${amount ?? 'your payment'}. Receipt ${receiptNumber ?? ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={bar} />
        <Text style={eyebrow}>SITE 99 UG LTD · RECEIPT</Text>
        <Heading style={h1}>Payment received</Heading>
        <Text style={body}>{clientName ? `Dear ${clientName},` : 'Hello,'}</Text>
        <Text style={body}>Thank you. We have received your payment and recorded it against your account.</Text>
        <Section style={box}>
          <Text style={big}>{amount}</Text>
          <Text style={row}><span style={k}>Receipt</span> {receiptNumber}</Text>
          {invoiceNumber ? <Text style={row}><span style={k}>For invoice</span> {invoiceNumber}</Text> : null}
          <Text style={row}><span style={k}>Date</span> {date}</Text>
          {method ? <Text style={row}><span style={k}>Paid by</span> {method}</Text> : null}
          {tid ? <Text style={row}><span style={k}>Transaction ID</span> {tid}</Text> : null}
          {balance ? <Text style={row}><span style={k}>Balance</span> <strong>{balance}</strong></Text> : null}
        </Section>
        {portalUrl ? <Button href={portalUrl} style={button}>Download your receipt</Button> : null}
        {note ? <Text style={small}>{note}</Text> : null}
        <Hr style={hr} />
        <Text style={body}>Site 99 Finance</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Receipt ${d?.receiptNumber ?? ''}: we received ${d?.amount ?? 'your payment'}`,
  displayName: 'Payment receipt to a client',
  previewData: {
    clientName: 'Salama Springs',
    receiptNumber: 'S9926RCTA042',
    invoiceNumber: 'S9926INVA009',
    amount: 'UGX 1,000,000',
    date: '2 November 2026',
    method: 'MTN MoMo',
    tid: '44749659341',
    balance: 'UGX 500,000',
    note: 'Thank you for your payment.',
    portalUrl: 'https://site99ug.com/residents/portal?tab=contract',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#141416' }
const container = { padding: '0 24px 28px', maxWidth: '560px' }
const bar = { backgroundColor: '#C81E24', height: '6px', margin: '0 0 24px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.12em', color: '#8a8a8a', margin: '0 0 6px' }
const h1 = { fontSize: '26px', margin: '0 0 16px', color: '#16804A' }
const box = { border: '1px solid #e6e2dc', borderRadius: '8px', padding: '14px 16px', margin: '16px 0' }
const big = { fontSize: '24px', fontWeight: 700, margin: '0 0 10px' }
const row = { fontSize: '14px', margin: '0 0 6px' }
const k = { display: 'inline-block', width: '120px', color: '#6b6b6b' }
const body = { fontSize: '14px', lineHeight: '22px', margin: '0 0 10px' }
const small = { fontSize: '12px', color: '#6b6b6b', lineHeight: '18px', margin: '12px 0 0' }
const button = { backgroundColor: '#C81E24', color: '#ffffff', borderRadius: '999px', padding: '12px 22px', fontSize: '14px', fontWeight: 700, textDecoration: 'none', display: 'inline-block', margin: '20px 0 4px' }
const hr = { borderColor: '#e6e2dc', margin: '24px 0 12px' }
