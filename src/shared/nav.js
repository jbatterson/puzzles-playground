const base = import.meta.env.BASE_URL

const NAV = [
  { href: `${base}`, icon: '🏠', title: 'Home' },
  { href: `${base}puzzlegames/productiles/`, icon: '➗', title: 'Productiles' },
  { href: `${base}puzzlegames/sumtiles/`, icon: '⬛', title: 'Sum Tiles' },
]

export default NAV
