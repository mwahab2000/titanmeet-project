/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

const LOGO_URL = 'https://agfsnvywlltiiigkatar.supabase.co/storage/v1/object/public/event-assets/logo.png'

export const SignupEmail = ({
  siteName,
  siteUrl,
  recipient,
  confirmationUrl,
}: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to TitanMeet — verify your email</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src={LOGO_URL} alt="TitanMeet" width="140" height="auto" style={logo} />
        <Heading style={h1}>Welcome aboard!</Heading>
        <Text style={text}>
          Thanks for signing up for{' '}
          <Link href={siteUrl} style={link}>
            <strong>TitanMeet</strong>
          </Link>
          . We're excited to have you.
        </Text>
        <Text style={text}>
          Please verify your email address (
          <Link href={`mailto:${recipient}`} style={link}>
            {recipient}
          </Link>
          ) to get started:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Confirm
        </Button>
        <Text style={footer}>
          If you didn't create an account, you can safely ignore this email.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail

const main = { backgroundColor: '#ffffff', fontFamily: "'Inter', Arial, sans-serif" }
const container = { padding: '40px 32px', maxWidth: '560px', margin: '0 auto' }
const logo = { marginBottom: '24px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold' as const,
  color: 'hsl(210, 40%, 10%)',
  fontFamily: "'Space Grotesk', Arial, sans-serif",
  margin: '0 0 20px',
}
const text = {
  fontSize: '15px',
  color: 'hsl(210, 10%, 45%)',
  lineHeight: '1.6',
  margin: '0 0 24px',
}
const link = { color: 'hsl(210, 70%, 50%)', textDecoration: 'underline' }
const button = {
  backgroundColor: 'hsl(145, 63%, 42%)',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600' as const,
  borderRadius: '0.75rem',
  padding: '14px 28px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '32px 0 0' }
