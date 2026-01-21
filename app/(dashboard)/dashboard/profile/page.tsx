import { requireAuth } from "@/lib/auth/require-auth";
import { prisma } from "@/lib/prisma";
import { ProfileForm } from "@/components/profile/profile-form";

export default async function ProfilePage() {
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
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Mon profil</h1>

      <ProfileForm
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          signupDate,
        }}
      />
    </div>
  );
}
