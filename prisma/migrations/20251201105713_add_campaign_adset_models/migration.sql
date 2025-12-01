-- AlterTable
ALTER TABLE `adaccount` ADD COLUMN `activeAds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `lastSyncAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `pausedAds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `timezone` VARCHAR(191) NULL,
    ADD COLUMN `timezoneOffset` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalAds` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalClicks` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalImpressions` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalReach` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `totalSpend` DOUBLE NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE `Campaign` (
    `id` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveStatus` VARCHAR(191) NOT NULL,
    `objective` VARCHAR(191) NULL,
    `dailyBudget` DOUBLE NULL,
    `lifetimeBudget` DOUBLE NULL,
    `budgetRemaining` DOUBLE NULL,
    `startTime` DATETIME(3) NULL,
    `stopTime` DATETIME(3) NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `spend` DOUBLE NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `results` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Campaign_adAccountId_idx`(`adAccountId`),
    INDEX `Campaign_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdSet` (
    `id` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveStatus` VARCHAR(191) NOT NULL,
    `dailyBudget` DOUBLE NULL,
    `lifetimeBudget` DOUBLE NULL,
    `budgetRemaining` DOUBLE NULL,
    `optimizationGoal` VARCHAR(191) NULL,
    `billingEvent` VARCHAR(191) NULL,
    `bidAmount` DOUBLE NULL,
    `startTime` DATETIME(3) NULL,
    `endTime` DATETIME(3) NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `spend` DOUBLE NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `results` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdSet_campaignId_idx`(`campaignId`),
    INDEX `AdSet_adAccountId_idx`(`adAccountId`),
    INDEX `AdSet_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Campaign` ADD CONSTRAINT `Campaign_adAccountId_fkey` FOREIGN KEY (`adAccountId`) REFERENCES `AdAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AdSet` ADD CONSTRAINT `AdSet_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `Campaign`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `FacebookAd` ADD CONSTRAINT `FacebookAd_adSetId_fkey` FOREIGN KEY (`adSetId`) REFERENCES `AdSet`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
