import { PrismaClient, Priority, Recurrence, TaskStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { getLocalDateString, getYesterdayDateString } from '../src/services/timezoneService';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding StreakUp database...');

  // Default demo password
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('StreakUp2026!', salt);

  const tz = 'Asia/Kolkata';
  const today = getLocalDateString(tz);
  const yesterday = getYesterdayDateString(tz);

  // Helper date offset
  const getDateOffset = (daysAgo: number) => {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return getLocalDateString(tz, d);
  };

  // 1. Create Demo Users with distinct streaks
  const usersData = [
    {
      name: 'Alex Rivera',
      username: 'AlexRivera',
      email: 'alex@streakup.app',
      currentStreak: 14,
      longestStreak: 21,
      profileImage: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Sarah Chen',
      username: 'SarahDev',
      email: 'sarah@streakup.app',
      currentStreak: 12,
      longestStreak: 12,
      profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Marcus Vance',
      username: 'MarcusV',
      email: 'marcus@streakup.app',
      currentStreak: 9,
      longestStreak: 15,
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Priya Sharma',
      username: 'PriyaCode',
      email: 'priya@streakup.app',
      currentStreak: 6,
      longestStreak: 8,
      profileImage: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=150&auto=format&fit=crop&q=80',
    },
    {
      name: 'Leo Morales',
      username: 'LeoM',
      email: 'leo@streakup.app',
      currentStreak: 3,
      longestStreak: 5,
      profileImage: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
    }
  ];

  const createdUsers: any[] = [];

  for (const u of usersData) {
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        currentStreak: u.currentStreak,
        longestStreak: u.longestStreak,
      },
      create: {
        name: u.name,
        username: u.username,
        normalizedUsername: u.username.toLowerCase(),
        email: u.email,
        passwordHash,
        timezone: tz,
        currentStreak: u.currentStreak,
        longestStreak: u.longestStreak,
        profileImage: u.profileImage,
      }
    });
    createdUsers.push(user);
  }

  console.log(`✅ Seeded ${createdUsers.length} users with password: StreakUp2026!`);

  // 2. Create sample tasks and completions for Alex (14 day streak)
  const alex = createdUsers[0];
  const alexTask1 = await prisma.task.create({
    data: {
      userId: alex.id,
      title: 'Daily 45-min Deep Focus Coding',
      description: 'Focused coding session without distractions',
      category: 'Coding',
      priority: Priority.HIGH,
      recurrence: Recurrence.DAILY,
      dueTime: '10:00',
      status: TaskStatus.ACTIVE,
    }
  });

  const alexTask2 = await prisma.task.create({
    data: {
      userId: alex.id,
      title: 'Drink 3L Water & Morning Run',
      description: 'Physical wellness habit',
      category: 'Health',
      priority: Priority.MEDIUM,
      recurrence: Recurrence.DAILY,
      dueTime: '08:00',
      status: TaskStatus.ACTIVE,
    }
  });

  // Seed completions for Alex for past 14 days
  for (let i = 0; i < 14; i++) {
    const compDate = getDateOffset(i);
    await prisma.taskCompletion.upsert({
      where: {
        taskId_completionDate: {
          taskId: alexTask1.id,
          completionDate: compDate
        }
      },
      update: {},
      create: {
        taskId: alexTask1.id,
        userId: alex.id,
        completionDate: compDate
      }
    });
  }

  // 3. Create mutual friendships between sample users
  // Alex <-> Sarah
  const [u1, u2] = alex.id < createdUsers[1].id ? [alex.id, createdUsers[1].id] : [createdUsers[1].id, alex.id];
  await prisma.friendship.upsert({
    where: { user1Id_user2Id: { user1Id: u1, user2Id: u2 } },
    update: {},
    create: { user1Id: u1, user2Id: u2 }
  });

  // Alex <-> Marcus
  const [m1, m2] = alex.id < createdUsers[2].id ? [alex.id, createdUsers[2].id] : [createdUsers[2].id, alex.id];
  await prisma.friendship.upsert({
    where: { user1Id_user2Id: { user1Id: m1, user2Id: m2 } },
    update: {},
    create: { user1Id: m1, user2Id: m2 }
  });

  console.log('✅ Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
