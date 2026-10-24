"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.initSpecialGroupsDatabaseAndMigrate = initSpecialGroupsDatabaseAndMigrate;
const prisma_1 = __importDefault(require("../config/prisma"));
const specialGroupRegistry_1 = require("./specialGroupRegistry");
let isMigrationInitialized = false;
/**
 * Ensures database columns for special groups exist and idempotently migrates legacy groups.
 */
async function initSpecialGroupsDatabaseAndMigrate() {
    if (isMigrationInitialized) {
        return { migratedGroupsCount: 0, migratedMembersCount: 0 };
    }
    isMigrationInitialized = true;
    try {
        // 1. Ensure columns exist on PostgreSQL
        await prisma_1.default.$executeRawUnsafe(`
      ALTER TABLE "Group" 
      ADD COLUMN IF NOT EXISTS "isSpecialGroup" BOOLEAN NOT NULL DEFAULT false;
    `);
        await prisma_1.default.$executeRawUnsafe(`
      ALTER TABLE "Group" 
      ADD COLUMN IF NOT EXISTS "specialPlatform" TEXT;
    `);
        await prisma_1.default.$executeRawUnsafe(`
      ALTER TABLE "GroupMember" 
      ADD COLUMN IF NOT EXISTS "isPotdCommitted" BOOLEAN NOT NULL DEFAULT true;
    `);
        await prisma_1.default.$executeRawUnsafe(`
      ALTER TABLE "Task" 
      ADD COLUMN IF NOT EXISTS "specialActivity" TEXT;
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_group_special" 
      ON "Group"("isSpecialGroup", "specialPlatform");
    `);
        await prisma_1.default.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "idx_task_group_special" 
      ON "Task"("groupId", "specialActivity");
    `);
    }
    catch (err) {
        console.warn('[SpecialGroupMigration] Raw SQL initialization warning (falling back gracefully):', err);
    }
    // 2. Perform idempotent backfill for legacy groups that haven't been classified
    let migratedGroupsCount = 0;
    let migratedMembersCount = 0;
    try {
        // Select groups where specialPlatform is NULL
        const unclassifiedGroups = await prisma_1.default.group.findMany({
            where: {
                specialPlatform: null,
            },
            include: {
                members: true,
            },
        });
        for (const group of unclassifiedGroups) {
            // Check if group was explicitly disabled
            if (group.isSpecialGroup === false && group.specialPlatform === 'DISABLED') {
                continue;
            }
            const platform = (0, specialGroupRegistry_1.detectSpecialPlatform)(group.name);
            if (!platform) {
                // Not a special group; set specialPlatform to empty string to mark as classified ordinary group
                await prisma_1.default.group.update({
                    where: { id: group.id },
                    data: {
                        isSpecialGroup: false,
                        specialPlatform: 'NONE',
                    },
                });
                continue;
            }
            const def = specialGroupRegistry_1.SPECIAL_GROUP_REGISTRY[platform];
            if (!def || !def.isAvailable)
                continue;
            // Migrate group to special mode
            await prisma_1.default.group.update({
                where: { id: group.id },
                data: {
                    isSpecialGroup: true,
                    specialPlatform: platform,
                },
            });
            migratedGroupsCount++;
            // If Daily-POTD model (LeetCode / GeeksforGeeks):
            if (def.activityModel === 'DAILY_POTD') {
                const dailyDef = def.activities.find((a) => a.id === 'daily') || def.activities[0];
                const potdDef = def.activities.find((a) => a.id === 'potd') || def.activities[1];
                for (const member of group.members) {
                    // Initialize missing POTD commitment to true by default
                    await prisma_1.default.groupMember.update({
                        where: {
                            groupId_userId: { groupId: group.id, userId: member.userId },
                        },
                        data: {
                            isPotdCommitted: true,
                        },
                    });
                    // Fetch member's existing tasks for this group
                    const existingTasks = await prisma_1.default.task.findMany({
                        where: {
                            groupId: group.id,
                            userId: member.userId,
                        },
                    });
                    let dailyTask = existingTasks.find((t) => t.specialActivity === 'DAILY');
                    let potdTask = existingTasks.find((t) => t.specialActivity === 'POTD');
                    // If no daily task exists, check if there's an unclassified group task to reuse
                    if (!dailyTask) {
                        const genericTask = existingTasks.find((t) => !t.specialActivity);
                        if (genericTask) {
                            dailyTask = await prisma_1.default.task.update({
                                where: { id: genericTask.id },
                                data: {
                                    title: dailyDef.name,
                                    specialActivity: 'DAILY',
                                },
                            });
                        }
                        else {
                            dailyTask = await prisma_1.default.task.create({
                                data: {
                                    userId: member.userId,
                                    groupId: group.id,
                                    isGroupTask: true,
                                    title: dailyDef.name,
                                    description: dailyDef.description,
                                    scheduledDays: group.scheduledDays,
                                    category: 'Group Task',
                                    recurrence: 'DAILY',
                                    status: 'ACTIVE',
                                    specialActivity: 'DAILY',
                                },
                            });
                        }
                    }
                    // If no POTD task exists, create it
                    if (!potdTask) {
                        potdTask = await prisma_1.default.task.create({
                            data: {
                                userId: member.userId,
                                groupId: group.id,
                                isGroupTask: true,
                                title: potdDef.name,
                                description: potdDef.description,
                                scheduledDays: group.scheduledDays,
                                category: 'Group Task',
                                recurrence: 'DAILY',
                                status: 'ACTIVE',
                                specialActivity: 'POTD',
                            },
                        });
                    }
                    migratedMembersCount++;
                }
            }
        }
    }
    catch (migrationErr) {
        console.error('[SpecialGroupMigration] Error during group backfill:', migrationErr);
    }
    return { migratedGroupsCount, migratedMembersCount };
}
