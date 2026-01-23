"use client";

import { logoutAction } from "@/app/actions/auth";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function LogoutButton() {
  const handleLogout = async () => {
    try {
      await logoutAction();
      toast.success("Logout successful");
    } catch (error) {
      toast.error("Error logging out");
    }
  };

  return (
    <Button variant="outline" onClick={handleLogout}>
      Sign out
    </Button>
  );
}

