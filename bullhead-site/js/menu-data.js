// =========================================================
// BULLHEAD - menu data
// unit: 'kg' — sold by weight. The stepper moves in 0.5kg
// steps and price is treated as KES per kg.
// price: null — not yet priced. Shown on the menu but
// cannot be added to an order until the client confirms.
// =========================================================

const MENU_ITEMS = [
  // Hot Beverages
  { id: 'teacup', category: 'Hot Beverages', name: 'Teacup', price: 20 },
  { id: 'tea-mug', category: 'Hot Beverages', name: 'Tea mug', price: 50 },
  { id: 'milk-glass', category: 'Hot Beverages', name: 'Milk glass', price: 40 },
  { id: 'porridge', category: 'Hot Beverages', name: 'Porridge', price: 40 },
  { id: 'white-coffee', category: 'Hot Beverages', name: 'White coffee', price: 40 },
  { id: 'black-coffee', category: 'Hot Beverages', name: 'Black coffee', price: 20 },
  { id: 'lemon-tea', category: 'Hot Beverages', name: 'Lemon tea', price: 40 },

  // Snacks & Bites
  { id: 'andazi', category: 'Snacks & Bites', name: 'Andazi', price: 10 },
  { id: 'chapati', category: 'Snacks & Bites', name: 'Chapati', price: 20 },
  { id: 'pancakes', category: 'Snacks & Bites', name: 'Pancakes', price: 50 },
  { id: 'toast-plain', category: 'Snacks & Bites', name: 'Toast plain', price: 30 },
  { id: 'toast-mafuta', category: 'Snacks & Bites', name: 'Toast mafuta', price: 40 },
  { id: 'sausage', category: 'Snacks & Bites', name: 'Sausage', price: 50 },
  { id: 'fried-grade-egg', category: 'Snacks & Bites', name: 'Fried grade egg', price: 25 },
  { id: 'fried-kienyeji-egg', category: 'Snacks & Bites', name: 'Fried kienyeji egg', price: 30 },

  // Cold Beverages
  { id: 'afia-juice', category: 'Cold Beverages', name: 'Afia juice', price: 80 },
  { id: 'soda-300ml', category: 'Cold Beverages', name: 'Soda 300ML', price: 40 },
  { id: 'soda-500ml', category: 'Cold Beverages', name: 'Soda 500ML', price: 60 },
  { id: 'novida', category: 'Cold Beverages', name: 'Novida', price: 40 },
  { id: 'water-300ml', category: 'Cold Beverages', name: 'Water 300ML', price: 30 },
  { id: 'water-500ml', category: 'Cold Beverages', name: 'Water 500ML', price: 60 },
  { id: 'dasani-water-half-l', category: 'Cold Beverages', name: 'Dasani water 1/2L', price: 50 },
  { id: 'dasani-water-1l', category: 'Cold Beverages', name: 'Dasani water 1L', price: 100 },

  // Main Dishes
  { id: 'ugali', category: 'Main Dishes', name: 'Ugali', price: 30 },
  { id: 'chapati-main', category: 'Main Dishes', name: 'Chapati', price: 20 },
  { id: 'beans-chapati', category: 'Main Dishes', name: 'Beans chapati', price: 50 },
  { id: 'pilau', category: 'Main Dishes', name: 'Pilau', price: 70 },
  { id: 'githeri-small', category: 'Main Dishes', name: 'Githeri (small)', price: 50 },
  { id: 'githeri-large', category: 'Main Dishes', name: 'Githeri (large)', price: 80 },
  { id: 'cabbage-ugali', category: 'Main Dishes', name: 'Cabbage ugali', price: 60 },
  { id: 'sukuma-ugali', category: 'Main Dishes', name: 'Sukuma ugali', price: 60 },
  { id: 'kunde-ugali', category: 'Main Dishes', name: 'Kunde ugali', price: 80 },
  { id: 'ndengu-chapati', category: 'Main Dishes', name: 'Ndengu chapati', price: 50 },
  { id: 'ndengu-ugali', category: 'Main Dishes', name: 'Ndengu ugali', price: 60 },
  { id: 'rice-plain', category: 'Main Dishes', name: 'Rice plain', price: 50 },
  { id: 'baazi-chapati', category: 'Main Dishes', name: 'Baazi chapati', price: 80 },
  { id: 'chicken-wings', category: 'Main Dishes', name: 'Chicken wings', price: 100 },
  { id: 'chicken-thigh', category: 'Main Dishes', name: 'Chicken thigh', price: 150 },
  { id: 'chicken-leg', category: 'Main Dishes', name: 'Chicken leg', price: 150 },
  { id: 'chicken-back', category: 'Main Dishes', name: 'Chicken back', price: 120 },
  { id: 'chicken-chest', category: 'Main Dishes', name: 'Chicken chest', price: 150 },
  { id: 'chicken-breast-fillet', category: 'Main Dishes', name: 'Chicken breast fillet', price: 150 },
  { id: 'matumbo-ugali', category: 'Main Dishes', name: 'Matumbo ugali', price: 110 },
  { id: 'kuku-ugali', category: 'Main Dishes', name: 'Kuku ugali', price: 180 },
  { id: 'beef-fry-rice', category: 'Main Dishes', name: 'Beef fry+rice', price: 150 },
  { id: 'beef-fry-chapati', category: 'Main Dishes', name: 'Beef fry+chapati', price: 120 },
  { id: 'beef-fry-plain', category: 'Main Dishes', name: 'Beef fry plain', price: 100 },

  // Butchery — per kg
  { id: 'beef', category: 'Butchery — per kg', name: 'Beef', price: 900, unit: 'kg' },
  { id: 'goat-meat', category: 'Butchery — per kg', name: 'Goat meat', price: 900, unit: 'kg' },
  { id: 'matumbo', category: 'Butchery — per kg', name: 'Matumbo', price: 400, unit: 'kg' },

  // The Grill — prices to confirm with client
  { id: 'grill-beef', category: 'The Grill', name: 'Grilled beef plate', price: null },
  { id: 'grill-goat', category: 'The Grill', name: 'Grilled goat plate', price: null },
  { id: 'grill-mixed', category: 'The Grill', name: 'Mixed grill plate', price: null },

  // Fish Specialty — prices to confirm with client
  { id: 'tilapia-whole', category: 'Fish Specialty', name: 'Tilapia & ugali — whole', price: null },
  { id: 'tilapia-half', category: 'Fish Specialty', name: 'Tilapia & ugali — half', price: null },

  // Sides & Extras
  { id: 'extra-ugali', category: 'Sides & Extras', name: 'Extra ugali', price: 30 },
  { id: 'kachumbari', category: 'Sides & Extras', name: 'Kachumbari', price: 50 }
];
