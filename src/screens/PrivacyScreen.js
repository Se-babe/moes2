import React from 'react';
import { ScrollView, View, Text, StyleSheet } from 'react-native';
import { PageHeader, Container, Card } from '../components/ui';
import Footer from '../components/Footer';
import { COLORS, TYPE, SPACE } from '../theme';
import { ORG } from '../config/org';

// NOTE: plain-language starting point. Have NWSC's legal / data protection
// officer review before go-live (Data Protection and Privacy Act, 2019).
const SECTIONS = [
  {
    title: 'What we collect',
    body: [
      'When you submit an enquiry, complaint, suggestion or compliment we collect the details you give us: your name, phone number, email address, the location of the issue, a description and any photo you attach.',
      'If you create an account we also store your email address, name and phone number so you can see your requests in one place.',
    ],
  },
  {
    title: 'Why we collect it',
    body: [
      'To investigate and resolve the issue you reported, to contact you about it, and to send you your reference number and progress updates by SMS or email.',
      'To produce anonymous statistics (for example the number of complaints resolved each month) that help us improve services.',
    ],
  },
  {
    title: 'Who can see it',
    body: [
      'Your contact details are visible only to authorised NWSC staff handling your request. They are never shown on public pages.',
      'Anyone with your reference number can see the status and public updates of that request, but not your name, phone number or email. Keep your reference number private.',
      'SMS and email messages are delivered through our messaging providers, who process your phone number or email address only to deliver them.',
    ],
  },
  {
    title: 'How long we keep it',
    body: ['We keep request records for as long as needed to resolve them and to meet NWSC record-keeping obligations, after which they are deleted or anonymised.'],
  },
  {
    title: 'Your rights',
    body: [
      `You may ask to see, correct or delete the personal data we hold about you. Contact us at ${ORG.email} or call ${ORG.phones[0].value}.`,
    ],
  },
  {
    title: 'Using this website',
    body: [
      'Please give accurate information and do not submit offensive content, other people’s personal data without their consent, or deliberately false reports. We may remove content from public forums that breaks these rules.',
      'Service updates on this site are official NWSC information and show when they were last updated. For emergencies always call the toll-free line.',
    ],
  },
];

export default function PrivacyScreen() {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: COLORS.bg }}>
      <PageHeader title="Privacy & terms" subtitle="How we handle your information and the rules for using this website." icon="shield-checkmark-outline" />
      <Container narrow style={{ marginTop: -24 }}>
        <Card elevated>
          {SECTIONS.map((s, i) => (
            <View key={s.title} style={[styles.section, i > 0 && styles.divider]}>
              <Text style={TYPE.h3} accessibilityRole="header">{s.title}</Text>
              {s.body.map((p, j) => (
                <Text key={j} style={[TYPE.body, { marginTop: SPACE.sm }]}>{p}</Text>
              ))}
            </View>
          ))}
          <Text style={[TYPE.small, { marginTop: SPACE.xl }]}>Last updated: November 2026</Text>
        </Card>
      </Container>
      <Footer />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  section: { paddingVertical: SPACE.lg },
  divider: { borderTopWidth: 1, borderTopColor: COLORS.gray200 },
});
