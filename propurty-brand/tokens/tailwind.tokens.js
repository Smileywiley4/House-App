// Propurty Tailwind token extension — v0.1
// Merge this into the `theme.extend` block of tailwind.config.js.
// Mirrors tokens.css so both systems stay in sync if the project uses
// Tailwind utility classes rather than raw CSS variables.

module.exports = {
  colors: {
    propurty: {
      green: '#106B49',
      'green-hover': '#0C4F37',
      'green-tint': '#E4F2EC',
      navy: '#14192E',
      'navy-soft': '#2A3150',
      amber: '#E8A33D',
      'amber-hover': '#B87A1F',
      'amber-tint': '#FCF1E1',
    },
    gray: {
      50: '#F8F7F4',
      100: '#EFEDE7',
      200: '#DEDCD3',
      400: '#9C9A91',
      600: '#6B6963',
      800: '#3A3935',
    },
  },
  fontFamily: {
    heading: ['Manrope', 'Plus Jakarta Sans', 'system-ui', 'sans-serif'],
    body: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
  },
  borderRadius: {
    control: '8px',
    card: '12px',
    tile: '20px',
  },
  boxShadow: {
    sm: '0 1px 2px rgba(20, 25, 46, 0.06)',
    md: '0 4px 12px rgba(20, 25, 46, 0.08)',
    lg: '0 12px 32px rgba(20, 25, 46, 0.12)',
  },
  spacing: {
    18: '4.5rem',
  },
};
