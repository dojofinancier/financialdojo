"use client";

import { useState, useEffect } from "react";
import { updateProfileAction, changePasswordAction, getUserPurchaseHistoryAction, type PurchaseHistoryItem } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { enCA } from "date-fns/locale";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

type ProfileFormProps = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    signupDate: Date;
  };
};

export function ProfileForm({ user }: ProfileFormProps) {
  const [isLoadingProfile, setIsLoadingProfile] = useState(false);
  const [isLoadingPassword, setIsLoadingPassword] = useState(false);
  const [isLoadingPurchases, setIsLoadingPurchases] = useState(true);
  const [purchases, setPurchases] = useState<PurchaseHistoryItem[]>([]);
  const [profileData, setProfileData] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    email: user.email,
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    async function loadPurchases() {
      setIsLoadingPurchases(true);
      const result = await getUserPurchaseHistoryAction();
      if (result.success && result.data) {
        setPurchases(result.data);
      }
      setIsLoadingPurchases(false);
    }
    loadPurchases();
  }, []);

  const handleProfileSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsLoadingProfile(true);

    try {
      const result = await updateProfileAction({
        firstName: profileData.firstName || undefined,
        lastName: profileData.lastName || undefined,
        // Email cannot be changed - it's used for authentication
      });

      if (result.success) {
        toast.success("Profile updated successfully!");
      } else {
        toast.error(result.error || "Error updating profile");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsLoadingProfile(false);
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error("Password must contain at least 6 characters");
      return;
    }

    setIsLoadingPassword(true);

    try {
      const result = await changePasswordAction(
        passwordData.currentPassword,
        passwordData.newPassword
      );

      if (result.success) {
        toast.success("Password changed successfully!");
        setPasswordData({
          currentPassword: "",
          newPassword: "",
          confirmPassword: "",
        });
      } else {
        toast.error(result.error || "Error while changing password");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setIsLoadingPassword(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-CA", {
      style: "currency",
      currency: "CAD",
    }).format(amount);
  };

  const isExpired = (expiresAt: Date) => {
    return new Date(expiresAt) < new Date();
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Profile Information */}
        <Card>
          <CardHeader>
            <CardTitle>Personal information</CardTitle>
            <CardDescription>
              Update your personal information
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First name</Label>
                  <Input
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, firstName: e.target.value })
                    }
                    disabled={isLoadingProfile}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last name</Label>
                  <Input
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) =>
                      setProfileData({ ...profileData, lastName: e.target.value })
                    }
                    disabled={isLoadingProfile}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label>Signup date</Label>
                <p className="text-sm text-muted-foreground">
                  {format(user.signupDate, "d MMMM yyyy", { locale: enCA })}
                </p>
              </div>
              <Button type="submit" disabled={isLoadingProfile}>
                {isLoadingProfile ? "Updating..." : "Update profile"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Password Change */}
        <Card>
          <CardHeader>
            <CardTitle>Change password</CardTitle>
            <CardDescription>
              Update your password to secure your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      currentPassword: e.target.value,
                    })
                  }
                  disabled={isLoadingPassword}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="newPassword">New password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      newPassword: e.target.value,
                    })
                  }
                  disabled={isLoadingPassword}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm new password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) =>
                    setPasswordData({
                      ...passwordData,
                      confirmPassword: e.target.value,
                    })
                  }
                  disabled={isLoadingPassword}
                  required
                  minLength={6}
                />
              </div>
              <Button type="submit" disabled={isLoadingPassword}>
                {isLoadingPassword ? "Updating..." : "Change password"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Purchase History */}
      <Card>
        <CardHeader>
          <CardTitle>Purchase history</CardTitle>
          <CardDescription>
            View your purchases and expiration dates
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPurchases ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading...
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No purchases yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Purchase date</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Expiration date</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {purchase.productName}
                          <Badge variant="outline" className="text-xs">
                            {purchase.type === "course" ? "Course" : "Cohort"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(purchase.purchaseDate, "d MMM yyyy", { locale: enCA })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(purchase.amount)}
                      </TableCell>
                      <TableCell>
                        {format(purchase.expiresAt, "d MMM yyyy", { locale: enCA })}
                      </TableCell>
                      <TableCell>
                        {isExpired(purchase.expiresAt) ? (
                          <Badge variant="destructive">Expired</Badge>
                        ) : (
                          <Badge variant="default">Active</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

