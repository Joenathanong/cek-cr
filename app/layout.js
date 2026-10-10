import './globals.css';

export const metadata = {
  title: 'Cek Cost Ratio Ekspedisi',
  description: 'Rekomendasi ekspedisi dan cost ratio pengiriman',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
