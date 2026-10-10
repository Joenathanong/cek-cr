// Ikon garis sederhana (inline SVG) untuk sidebar
const P = {
  truck: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>,
  list: <path d="M4 5h16M4 12h16M4 19h10" />,
  clock: <><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></>,
  tag: <path d="M4 7h16v12H4zM8 7V5h8v2" />,
  building: <path d="M4 20V6l8-3 8 3v14M9 20v-5h6v5M8 9h1M15 9h1M8 12h1M15 12h1" />,
  box: <path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8" />,
  users: <><circle cx="9" cy="8" r="3.5" /><path d="M3 20c0-3.5 3-5.5 6-5.5s6 2 6 5.5M16 4.5a3.5 3.5 0 0 1 0 7" /></>,
  pin: <><path d="M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="9" r="2.5" /></>,
  map: <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2zM9 4v14M15 6v14" />,
  home: <path d="M3 11l9-7 9 7v9H3zM9 20v-6h6v6" />,
  log: <path d="M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5" />,
  key: <><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9M17 6l3 3" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-6 8-6s8 2 8 6" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" /></>,
  chevron: <path d="M6 9l6 6 6-6" />,
};
export default function Icon({ name, size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {P[name]}
    </svg>
  );
}
