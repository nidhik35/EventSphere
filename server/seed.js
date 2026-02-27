const mongoose = require('mongoose');
const dotenv = require('dotenv');

const Event = require('./models/Event');
const Registration = require('./models/Registration');

async function seed() {
  try {
    dotenv.config();

    const MONGO_URL = process.env.MONGO_URL;

    if (!MONGO_URL) {
      console.error('MONGO_URL environment variable is not set.');
      process.exit(1);
    }

    await mongoose.connect(MONGO_URL);
    console.log('Connected to MongoDB for seeding');

    await Registration.deleteMany({});
    await Event.deleteMany({});

    const eventsData = [
      // Academic Project (2)
      {
        title: 'Tech Expo: Future of Engineering',
        description: 'Exhibition of student projects in robotics, AI, IoT, and sustainable tech.',
        date: new Date('2026-03-14'),
        location: 'Central Expo Ground',
        category: 'Academic Project',
      },
      {
        title: 'Final Year Project Showcase (ECE & CSE)',
        description: 'Capstone demos: embedded systems, web apps, ML prototypes, and IoT builds.',
        date: new Date('2026-03-20'),
        location: 'Innovation Atrium',
        category: 'Academic Project',
      },

      // Workshop (2)
      {
        title: 'IoT for Smart Campus Workshop',
        description: 'Hands-on workshop building IoT prototypes for smarter campus infrastructure.',
        date: new Date('2026-03-12'),
        location: 'Electronics Lab 2',
        category: 'Workshop',
      },
      {
        title: 'Advanced React Workshop',
        description: 'Hands-on workshop on hooks, state management, and performance tuning.',
        date: new Date('2026-03-27'),
        location: 'Software Lab 5',
        category: 'Workshop',
      },

      // Hackathon (2)
      {
        title: 'AI & Machine Learning Hackathon',
        description: '24-hour hackathon focused on real-world AI and ML problem statements.',
        date: new Date('2026-03-11'),
        location: 'Computer Science Innovation Lab',
        category: 'Hackathon',
      },
      {
        title: 'Overnight Hack Sprint',
        description: 'Short 12-hour hackathon focusing on campus problem statements.',
        date: new Date('2026-03-29'),
        location: 'Innovation Hub',
        category: 'Hackathon',
      },

      // Competition (2)
      {
        title: 'Robotics Challenge 2026',
        description: 'Build and program autonomous robots to complete obstacle courses and tasks.',
        date: new Date('2026-03-10'),
        location: 'Mechanical Engineering Block Auditorium',
        category: 'Competition',
      },
      {
        title: 'Coding Marathon - Algorithms & Data Structures',
        description: 'Intense competitive programming contest for algorithm enthusiasts.',
        date: new Date('2026-03-13'),
        location: 'Main Seminar Hall',
        category: 'Competition',
      },

      // Fest (2)
      {
        title: 'College Tech Fest Inauguration',
        description: 'Opening ceremony with chief guest talk and cultural performance.',
        date: new Date('2026-03-01'),
        location: 'Main Auditorium',
        category: 'Fest',
      },
      {
        title: 'Open Mic + Cultural Night',
        description: 'Music, poetry, and performances to wrap up the fest with high energy.',
        date: new Date('2026-03-22'),
        location: 'Open Air Theatre',
        category: 'Fest',
      },

      // Talk (2)
      {
        title: 'Sustainability in Tech Panel',
        description: 'Discussion on sustainable engineering practices and green tech initiatives.',
        date: new Date('2026-03-19'),
        location: 'Conference Room 3',
        category: 'Talk',
      },
      {
        title: 'Alumni Tech Talk Series',
        description: 'Alumni share industry experience across software, core, and research.',
        date: new Date('2026-04-02'),
        location: 'Seminar Hall C',
        category: 'Talk',
      },

      // General (2)
      {
        title: 'Hostel Coding Jam',
        description: 'Informal late-night coding meetup in hostel common room.',
        date: new Date('2026-04-04'),
        location: 'Hostel Common Room',
        category: 'General',
      },
      {
        title: 'Dept Open House & Lab Tour',
        description: 'Guided tours of department labs for juniors and school visitors.',
        date: new Date('2026-04-05'),
        location: 'Department Blocks',
        category: 'General',
      },
    ];

    const events = await Event.insertMany(eventsData);
    console.log(`Inserted ${events.length} tech fest events.`);

    const sampleRegistrations = [
      {
        eventId: events[0]._id,
        name: 'Alice Johnson',
        email: 'alice@example.com',
      },
      {
        eventId: events[1]._id,
        name: 'Rahul Verma',
        email: 'rahul@example.com',
      },
      {
        eventId: events[2]._id,
        name: 'Mei Chen',
        email: 'mei@example.com',
      },
      {
        eventId: events[5]._id,
        name: 'Carlos Mendes',
        email: 'carlos@example.com',
      },
      {
        eventId: events[6]._id,
        name: 'Priya Singh',
        email: 'priya@example.com',
      },
      {
        eventId: events[8]._id,
        name: 'Liam O\'Connor',
        email: 'liam@example.com',
      },
    ];

    await Registration.insertMany(sampleRegistrations);
    console.log(`Inserted ${sampleRegistrations.length} sample registrations.`);
  } catch (err) {
    console.error('Seeding error:', err);
  } finally {
    await mongoose.disconnect();
    console.log('Disconnected from MongoDB. Seeding complete.');
    process.exit(0);
  }
}

seed();

