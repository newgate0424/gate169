-- CreateTable
CREATE TABLE `AdAccount` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `accountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `currency` VARCHAR(191) NOT NULL DEFAULT 'THB',
    `accountStatus` INTEGER NOT NULL DEFAULT 1,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AdAccount_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `FacebookAd` (
    `id` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `effectiveStatus` VARCHAR(191) NOT NULL,
    `campaignId` VARCHAR(191) NULL,
    `campaignName` VARCHAR(191) NULL,
    `adSetId` VARCHAR(191) NULL,
    `adSetName` VARCHAR(191) NULL,
    `thumbnail` TEXT NULL,
    `budget` VARCHAR(191) NULL,
    `pageId` VARCHAR(191) NULL,
    `pageName` VARCHAR(191) NULL,
    `pageUsername` VARCHAR(191) NULL,
    `impressions` INTEGER NOT NULL DEFAULT 0,
    `reach` INTEGER NOT NULL DEFAULT 0,
    `spend` DOUBLE NOT NULL DEFAULT 0,
    `clicks` INTEGER NOT NULL DEFAULT 0,
    `results` INTEGER NOT NULL DEFAULT 0,
    `roas` DOUBLE NOT NULL DEFAULT 0,
    `cpm` DOUBLE NOT NULL DEFAULT 0,
    `videoPlays` INTEGER NOT NULL DEFAULT 0,
    `videoP25` INTEGER NOT NULL DEFAULT 0,
    `videoP50` INTEGER NOT NULL DEFAULT 0,
    `videoP75` INTEGER NOT NULL DEFAULT 0,
    `videoP95` INTEGER NOT NULL DEFAULT 0,
    `videoP100` INTEGER NOT NULL DEFAULT 0,
    `videoAvgTime` DOUBLE NOT NULL DEFAULT 0,
    `postEngagements` INTEGER NOT NULL DEFAULT 0,
    `linkClicks` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lastSyncAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `FacebookAd_adAccountId_idx`(`adAccountId`),
    INDEX `FacebookAd_status_idx`(`status`),
    INDEX `FacebookAd_pageId_idx`(`pageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AdSyncLog` (
    `id` VARCHAR(191) NOT NULL,
    `userId` VARCHAR(191) NOT NULL,
    `adAccountId` VARCHAR(191) NULL,
    `syncType` VARCHAR(191) NOT NULL,
    `status` VARCHAR(191) NOT NULL,
    `adsCount` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `completedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `FacebookAd` ADD CONSTRAINT `FacebookAd_adAccountId_fkey` FOREIGN KEY (`adAccountId`) REFERENCES `AdAccount`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
