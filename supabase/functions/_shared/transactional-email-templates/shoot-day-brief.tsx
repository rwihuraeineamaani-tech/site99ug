import * as React from 'npm:react@18.3.1'
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Idea {
  ref?: string
  title?: string
  type?: string
  crew?: string
}

interface Props {
  owner?: string
  date?: string
  callTime?: string
  location?: string
  notes?: string
  ideas?: Idea[]
  gear?: string[]
}

const Email = ({ owner, date, callTime, location, notes, ideas = [], gear = [] }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{`Shoot day brief — ${owner ?? 'Site 99'}${date ? ` on ${date}` : ''}`}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Text style={eyebrow}>SITE 99 — SHOOT DAY BRIEF</Text>
        <Heading style={h1}>{owner ?? 'Shoot day'}</Heading>

        <Section style={box}>
          <Text style={line}><strong>Date:</strong> {date || 'to be set'}</Text>
          <Text style={line}><strong>Call time:</strong> {callTime || 'to be set'}</Text>
          <Text style={line}><strong>Location:</strong> {location || 'to be set'}</Text>
        </Section>

        {notes ? (
          <>
            <Text style={h2}>Notes</Text>
            <Text style={body}>{notes}</Text>
          </>
        ) : null}

        <Text style={h2}>What we are shooting</Text>
        {ideas.length === 0 ? (
          <Text style={body}>No ideas listed yet.</Text>
        ) : (
          ideas.map((i, n) => (
            <Section key={n} style={box}>
              <Text style={line}>
                <strong>{i.ref ? `${i.ref} — ` : ''}{i.title ?? 'Untitled'}</strong>
              </Text>
              {i.type ? <Text style={small}>{i.type}</Text> : null}
              {i.crew ? <Text style={small}>Crew: {i.crew}</Text> : null}
            </Section>
          ))
        )}

        {gear.length > 0 ? (
          <>
            <Text style={h2}>Gear booked</Text>
            <Text style={body}>{gear.join(', ')}</Text>
          </>
        ) : null}

        <Hr style={hr} />
        <Text style={small}>Be on time, be ready. — Site 99</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: Email,
  subject: (d: Props) => `Shoot day brief — ${d?.owner ?? 'Site 99'}${d?.date ? ` (${d.date})` : ''}`,
  displayName: 'Shoot day brief',
  previewData: {
    owner: 'Azawi',
    date: '2026-09-12',
    callTime: '08:00',
    location: 'Kololo, Kampala',
    notes: 'Bring the red backdrop.',
    ideas: [
      { ref: 'IDEA-0007', title: 'Studio freestyle', type: 'Vertical short form video', crew: 'Shooter: Brian, Editor: Faith' },
    ],
    gear: ['Sony FX3', 'Rode wireless'],
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Helvetica, Arial, sans-serif', color: '#0f0f0f' }
const container = { padding: '28px 24px', maxWidth: '560px' }
const eyebrow = { fontSize: '11px', letterSpacing: '0.12em', color: '#8a8a8a', margin: '0 0 6px' }
const h1 = { fontSize: '26px', margin: '0 0 16px', color: '#0f0f0f' }
const h2 = { fontSize: '13px', letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: '#8a8a8a', margin: '22px 0 8px' }
const box = { border: '1px solid #e6e2dc', borderRadius: '6px', padding: '12px 14px', margin: '0 0 10px' }
const line = { fontSize: '14px', margin: '0 0 4px' }
const body = { fontSize: '14px', lineHeight: '22px', margin: '0 0 8px' }
const small = { fontSize: '12px', color: '#6b6b6b', margin: '0 0 2px' }
const hr = { borderColor: '#e6e2dc', margin: '24px 0 12px' }
