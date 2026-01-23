import { requireAuth } from "@/lib/auth/require-auth";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";

async function ProfileContent() {
  const user = await requireAuth();

  // Get user with enrollment info for signup date
  const userWithEnrollments = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      enrollments: {
        orderBy: { purchaseDate: "asc" },
        take: 1,
      },
    },
  });

  const signupDate = userWithEnrollments?.enrollments[0]?.purchaseDate || user.createdAt;

  return (
    <ProfileForm
      user={{
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        signupDate,
      }}
    />
  );
}

export default function ProfilePage() {
  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">My profile</h1>
      <Suspense fallback={<div className="text-muted-foreground">Loading profile...</div>}>
        <ProfileContent />
      </Suspense>
    </div>
  );
}
