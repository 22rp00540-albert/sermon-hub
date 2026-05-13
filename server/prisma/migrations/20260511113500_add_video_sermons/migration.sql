-- CreateTable
CREATE TABLE `VideoSermon` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `title` VARCHAR(191) NOT NULL,
    `scripture` VARCHAR(191) NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdDate` DATETIME(3) NOT NULL,
    `videoUrl` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `preacherId` INTEGER NOT NULL,
    `uploadedById` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `VideoSermon` ADD CONSTRAINT `VideoSermon_preacherId_fkey` FOREIGN KEY (`preacherId`) REFERENCES `Preacher`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `VideoSermon` ADD CONSTRAINT `VideoSermon_uploadedById_fkey` FOREIGN KEY (`uploadedById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
