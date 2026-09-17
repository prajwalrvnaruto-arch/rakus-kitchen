// Business configuration — single place to tune how Raku's Kitchen presents itself.

export const BUSINESS = {
  name: "Raku's Kitchen",
  tagline: "Pure Taste of Nati Style",
  instagram: "rakus.kitchen",
  instagramUrl: "https://instagram.com/rakus.kitchen",
  phoneDisplay: "+91 96068 88096",
  phone: "9606888096",
  phoneIntl: "919606888096", // for wa.me links
  address: "Jambusavari Dinne, JP Nagar 8th Phase, Bangalore",
  delivery: "Delivery across Bangalore",
  readyLunch: "12:30 PM",
  readyDinner: "7:30 PM",
  // Kitchen geo-coordinates for Porter/Borzo pickup point.
  // TODO: Confirm exact coordinates with the kitchen.
  lat: 12.8892,
  lng: 77.5985,
  kitchenAddress: "Jambusavari Dinne, JP Nagar 8th Phase, Bengaluru, Karnataka 560078",
} as const;