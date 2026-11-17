// Single source of truth for organisation branding and contact details.
// Change values here, not in individual screens.
// NOTE: phone numbers / email below should be confirmed with NWSC Jinja
// before go-live.
export const ORG = {
  shortName: 'NWSC',
  name: 'National Water and Sewerage Corporation',
  area: 'Jinja Area',
  appName: 'NWSC e-Participation',
  tagline: 'Report water and sewer issues, track your requests, and help shape better services in Jinja.',
  phones: [
    { label: 'Toll Free', value: '0800-200-977' },
    { label: 'Customer Care', value: '+256 (0)313-315-000' },
  ],
  email: 'info@nwsc.co.ug',
  website: 'https://www.nwsc.co.ug',
  address: 'NWSC Jinja Area Office, Jinja, Uganda',
  copyright: `© ${new Date().getFullYear()} - National Water and Sewerage Corporation, Uganda`,
  assistantName: 'Maji',
};

export const COLORS_BRAND = {
  primary: '#0B5FA5', // NWSC water blue
  primaryDark: '#073E6E',
  accent: '#38BDF8',
};
