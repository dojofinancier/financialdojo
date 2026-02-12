"use client";

import { ProfileForm } from "@/components/profile/profile-form";

type User = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  createdAt: Date;
};

interface ProfileTabProps {
  user: User;
}

export function ProfileTab({ user }: ProfileTabProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My profile</h2>
        <p className="text-muted-foreground">
          Manage your personal information and account security
        </p>
      </div>
      <ProfileForm
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          signupDate: user.createdAt,
        }}
      />
    </div>
  );
}

