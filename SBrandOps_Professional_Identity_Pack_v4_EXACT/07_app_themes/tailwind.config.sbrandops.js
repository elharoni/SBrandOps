module.exports = {
  theme: {
    extend: {
      colors: {
        sbo: {
          navy: '#070B1F',
          navy900: '#0D1329',
          navy800: '#161B33',
          slate: '#1F2540',
          cyan: '#06B6D4',
          blue: '#2563EB',
          indigo: '#4F46E5',
          purple: '#7C3AED',
          soft: '#E6EAF2'
        }
      },
      fontFamily: {
        sans: ['Inter', 'Sora', 'Plus Jakarta Sans', 'system-ui', 'sans-serif']
      },
      borderRadius: {
        'sbo-card': '20px',
        'sbo-button': '14px'
      },
      boxShadow: {
        'sbo-card': '0 16px 50px rgba(6, 182, 212, 0.10)',
        'sbo-glow': '0 0 40px rgba(37, 99, 235, 0.28)'
      }
    }
  }
}
