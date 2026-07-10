import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ice: '#F4F8FC',
        navy: {
          DEFAULT: '#0A2A6B',
          light: '#123A8C',
        },
        brand: {
          DEFAULT: '#1456E8',
          light: '#2B6FFF',
          sky: '#5AA9FF',
        },
        selection: '#16A34A',
      },
      fontFamily: {
        display: ['var(--font-jakarta)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
        mono: ['var(--font-plex)', 'monospace'],
      },
      backgroundImage: {
        'brand-gradient': 'linear-gradient(135deg, #1456E8 0%, #5AA9FF 100%)',
        'navy-gradient': 'linear-gradient(180deg, #0A2A6B 0%, #123A8C 100%)',
        'radial-glow': 'radial-gradient(circle at 50% 0%, rgba(20,86,232,0.12), transparent 60%)',
      },
      boxShadow: {
        glass: '0 8px 32px rgba(10, 42, 107, 0.08)',
        'glass-lg': '0 20px 60px rgba(10, 42, 107, 0.12)',
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.75rem',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        float: 'float 6s ease-in-out infinite',
        shimmer: 'shimmer 2.5s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
