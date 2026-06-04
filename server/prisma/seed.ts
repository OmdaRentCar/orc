import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';
import { neonConfig, Pool } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaNeon(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const username = process.env.SEED_ADMIN_USERNAME || 'admin';
  const password = process.env.SEED_ADMIN_PASSWORD || 'admin123';
  const email = process.env.SEED_ADMIN_EMAIL || 'omda@omdarentcar.tn';

  const existing = await prisma.adminUser.findUnique({ where: { username } });
  if (!existing) {
    await prisma.adminUser.create({
      data: { username, email, passwordHash: await bcrypt.hash(password, 10) },
    });
    console.log(`Admin created: ${username}`);
  } else {
    console.log(`Admin already exists: ${username}`);
  }

  const carCount = await prisma.car.count();
  if (carCount === 0) {
    await prisma.car.createMany({
      data: [
        {
          brand: 'Tesla',
          model: 'Model S Plaid',
          type: 'Electric',
          year: 2025,
          price: 199,
          image: 'https://images.unsplash.com/photo-1617704548623-340376564e68?w=1200&h=800&fit=crop',
          available: true,
          seats: 5,
          fuel: 'Electric',
          transmission: 'Auto',
          description: 'The quickest production car ever made. 0-60 mph in 1.99 seconds.',
          features: ['Autopilot', 'Glass Roof', '17" Display', 'Hepa Filter'],
        },
        {
          brand: 'BMW',
          model: 'M4 Competition',
          type: 'Sports',
          year: 2025,
          price: 249,
          image: 'https://images.unsplash.com/photo-1555215695-3004980ad54e?w=1200&h=800&fit=crop',
          available: true,
          seats: 4,
          fuel: 'Petrol',
          transmission: 'DCT',
          description: 'Pure driving pleasure with 503 hp twin-turbo inline-6.',
          features: ['M Sport Exhaust', 'Carbon Fiber', 'Laser Lights', 'Harman Kardon'],
        },
        {
          brand: 'Mercedes',
          model: 'G-Class',
          type: 'SUV',
          year: 2025,
          price: 299,
          image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?w=1200&h=800&fit=crop',
          available: false,
          seats: 5,
          fuel: 'Petrol',
          transmission: 'Auto',
          description: 'The legend returns. Unstoppable off-road, refined on-road.',
          features: ['3-Lock Differential', 'Burmester Sound', 'Night View', 'Massage Seats'],
        },
        {
          brand: 'Porsche',
          model: '911 Turbo S',
          type: 'Sports',
          year: 2025,
          price: 399,
          image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=800&fit=crop',
          available: true,
          seats: 4,
          fuel: 'Petrol',
          transmission: 'PDK',
          description: '650 hp flat-six, rear-biased AWD. The ultimate 911.',
          features: ['Active Aero', 'Ceramic Brakes', 'Sport Exhaust', 'Adaptive Suspension'],
        },
        {
          brand: 'Lamborghini',
          model: 'Urus',
          type: 'SUV',
          year: 2025,
          price: 499,
          image: 'https://images.unsplash.com/photo-1612544448445-b8232cff3b6c?w=1200&h=800&fit=crop',
          available: true,
          seats: 5,
          fuel: 'Petrol',
          transmission: 'Auto',
          description: 'The super SUV. 657 hp, 0-62 in 3.6 seconds.',
          features: ['Carbon Ceramic', 'Air Suspension', 'Rear Steering', 'Panoramic Roof'],
        },
        {
          brand: 'Audi',
          model: 'RS e-tron GT',
          type: 'Electric',
          year: 2025,
          price: 179,
          image: 'https://images.unsplash.com/photo-1603584173870-7f23fdae1b7a?w=1200&h=800&fit=crop',
          available: true,
          seats: 4,
          fuel: 'Electric',
          transmission: 'Auto',
          description: '637 hp electric grand tourer. Charged to thrill.',
          features: ['Quattro AWD', 'Matrix LED', 'E-tron Sport', 'Virtual Mirrors'],
        },
        {
          brand: 'Range Rover',
          model: 'Sport SV',
          type: 'SUV',
          year: 2025,
          price: 259,
          image: 'https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?w=1200&h=800&fit=crop',
          available: false,
          seats: 5,
          fuel: 'Petrol',
          transmission: 'Auto',
          description: '635 hp twin-turbo V8. Performance meets luxury SUV.',
          features: ['Air Suspension', 'Terrain Response', 'Meridian Sound', 'Executive Seats'],
        },
        {
          brand: 'Ferrari',
          model: 'SF90 Stradale',
          type: 'Sports',
          year: 2025,
          price: 599,
          image: 'https://images.unsplash.com/photo-1592198084033-aade902d1aae?w=1200&h=800&fit=crop',
          available: true,
          seats: 2,
          fuel: 'Hybrid',
          transmission: 'DCT',
          description: "Ferrari's most powerful road car. 986 hp plug-in hybrid.",
          features: ['Assetto Fiorano', 'Carbon Wheels', 'Scuderia Shields', 'Telemetry'],
        },
      ],
    });
    console.log('8 sample cars seeded');
  } else {
    console.log(`Skipping cars (${carCount} already exist)`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
