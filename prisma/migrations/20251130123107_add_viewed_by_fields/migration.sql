/*
  Warnings:

  - A unique constraint covering the columns `[username]` on the table `User` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `account` ADD COLUMN `providerEmail` VARCHAR(191) NULL,
    ADD COLUMN `providerImage` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `conversation` ADD COLUMN `adId` VARCHAR(191) NULL,
    ADD COLUMN `adName` VARCHAR(191) NULL,
    ADD COLUMN `assigneeId` VARCHAR(191) NULL,
    ADD COLUMN `facebookLink` TEXT NULL,
    ADD COLUMN `lastMessageAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `lastReadAt` DATETIME(3) NULL,
    ADD COLUMN `participantId` VARCHAR(191) NULL,
    ADD COLUMN `participantName` VARCHAR(191) NULL,
    ADD COLUMN `viewedAt` DATETIME(3) NULL,
    ADD COLUMN `viewedBy` VARCHAR(191) NULL,
    ADD COLUMN `viewedByName` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `message` ADD COLUMN `attachments` TEXT NULL,
    ADD COLUMN `stickerUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `user` ADD COLUMN `password` TEXT NULL,
    ADD COLUMN `permissions` TEXT NULL,
    ADD COLUMN `username` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `PageSettings` (
    `id` VARCHAR(191) NOT NULL,
    `pageId` VARCHAR(191) NOT NULL,
    `rotationMode` VARCHAR(191) NOT NULL DEFAULT 'OFF',
    `distributionMethod` VARCHAR(191) NOT NULL DEFAULT 'EQUAL',
    `keepAssignment` BOOLEAN NOT NULL DEFAULT false,
    `shuffleUsers` BOOLEAN NOT NULL DEFAULT false,
    `maxUsersPerChat` INTEGER NOT NULL DEFAULT 1,
    `activeRotationUserIds` TEXT NULL,
    `transferIfUnreadMinutes` INTEGER NULL,
    `transferIfOffline` BOOLEAN NOT NULL DEFAULT false,
    `unreadLimitPerUser` INTEGER NULL,
    `rotationSchedule` VARCHAR(191) NOT NULL DEFAULT 'ALWAYS',
    `nonSelectedCanViewAll` BOOLEAN NOT NULL DEFAULT false,
    `assignToNonSelected` VARCHAR(191) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `PageSettings_pageId_key`(`pageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `Conversation_adId_idx` ON `Conversation`(`adId`);

-- CreateIndex
CREATE INDEX `Conversation_lastMessageAt_idx` ON `Conversation`(`lastMessageAt`);

-- CreateIndex
CREATE INDEX `Conversation_assigneeId_idx` ON `Conversation`(`assigneeId`);

-- CreateIndex
CREATE UNIQUE INDEX `User_username_key` ON `User`(`username`);
