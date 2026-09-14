-- CreateTable
CREATE TABLE "face_references" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dniPhotoUrl" TEXT NOT NULL,
    "selfiePhotoUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "face_references_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "face_references_userId_key" ON "face_references"("userId");

-- AddForeignKey
ALTER TABLE "face_references" ADD CONSTRAINT "face_references_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
