import bcrypt from 'bcryptjs';
import db from './db.js';

function seed() {
  const existing = db.prepare('SELECT COUNT(*) as count FROM admin_users').get().count;
  if (existing === 0) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admin_users (username, email, password_hash) VALUES (?, ?, ?)').run('admin', 'admin@omdarentcar.com', hash);
    console.log('[SEED] Admin user created: admin / admin123');
  } else {
    console.log('[SEED] Admin user already exists');
  }

  const carCount = db.prepare('SELECT COUNT(*) as count FROM cars').get().count;
  if (carCount === 0) {
    const insertStmt = db.prepare(`
      INSERT INTO cars (brand, model, type, year, price, image, available, seats, fuel, transmission, description, features)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const cars = [
      ['Tesla', 'Model S Plaid', 'Electric', 2025, 199, 'https://images.unsplash.com/photo-1617788138017-80ad40651399?w=600', 1, 5, 'Electric', 'Auto', 'Luxury electric sedan with insane acceleration. 0-60 in 1.99s.', '["Autopilot","Glass Roof","17\\" Display","Hepa Filter"]'],
      ['BMW', 'M4 Competition', 'Sports', 2025, 249, 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=600', 1, 4, 'Petrol', 'Auto', 'Twin-turbo inline-6 beast. 503 hp of pure driving pleasure.', '["M Sport Exhaust","Carbon Fiber","Laser Lights","Harman Kardon"]'],
      ['Mercedes', 'G-Class', 'SUV', 2025, 299, 'https://images.unsplash.com/photo-1520031441872-265e4ff50366?w=600', 0, 5, 'Petrol', 'Auto', 'Iconic luxury SUV. Commanding presence, unmatched off-road capability.', '["3-Lock Differential","Burmester Sound","Night View","Massage Seats"]'],
      ['Porsche', '911 Turbo S', 'Sports', 2025, 399, 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=600', 1, 4, 'Petrol', 'PDK', '640 hp of pure adrenaline. 0-60 in 2.6 seconds.', '["Active Aero","Ceramic Brakes","Sport Exhaust","Adaptive Suspension"]'],
      ['Lamborghini', 'Urus', 'SUV', 2025, 499, 'https://images.unsplash.com/photo-1544636331-e26879cd4d9b?w=600', 1, 5, 'Petrol', 'Auto', 'The worlds first Super SUV. 650 hp, 190 mph top speed.', '["Carbon Ceramic","Air Suspension","Rear Steering","Panoramic Roof"]'],
      ['Audi', 'RS e-tron GT', 'Electric', 2025, 179, 'https://images.unsplash.com/photo-1614200187524-dc4b892acf16?w=600', 1, 4, 'Electric', 'Auto', 'Electric Gran Turismo with 637 hp and 300 mile range.', '["Quattro AWD","Matrix LED","E-tron Sport","Virtual Mirrors"]'],
      ['Range Rover', 'Sport SV', 'SUV', 2025, 259, 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=600', 0, 5, 'Hybrid', 'Auto', 'British luxury meets off-road dominance. The ultimate SUV.', '["Air Suspension","Terrain Response","Meridian Sound","Executive Seats"]'],
      ['Ferrari', 'SF90 Stradale', 'Sports', 2025, 599, 'https://images.unsplash.com/photo-1583121274602-3e2820c69888?w=600', 1, 2, 'Hybrid', 'DCT', '986 hp hybrid hypercar. V8 + 3 electric motors. 211 mph.', '["Assetto Fiorano","Carbon Wheels","Scuderia Shields","Telemetry"]'],
    ];

    const insertMany = db.transaction(() => {
      for (const car of cars) {
        insertStmt.run(...car);
      }
    });

    insertMany();
    console.log(`[SEED] ${cars.length} cars inserted`);
  } else {
    console.log('[SEED] Cars already exist');
  }

  console.log('[SEED] Done!');
}

seed();
