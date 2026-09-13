const base = import.meta.env.BASE_URL

const NAV = [
  { href: `${base}`, icon: '🏠', title: 'Home' },
  { href: `${base}puzzlegames/sumtiles/`, icon: '⬛', title: 'Sum Tiles' },
  { href: `${base}puzzlegames/productiles/`, icon: '➗', title: 'Productiles' },
  { href: `${base}puzzlegames/rolypoly/`, icon: '🐛', title: 'Roly Poly' },
  { href: `${base}puzzlegames/dungbeetle/`, icon: '🪲', title: 'Dung Beetle' },
  { href: `${base}puzzlegames/scuttlebug/`, icon: '🐞', title: 'Scuttlebug' },
]

export default NAV
