"use client";

import { useState, useEffect } from "react";
import { updateProfileAction, changePasswordAction, getUserPurchaseHistoryAction, type PurchaseHistoryItem } from "@/app/actions/profile";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale/fr";
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
    return new Intl.NumberFormat("fr-CA", {
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
            <CardTitle>Informations personnelles</CardTitle>
            <CardDescription>
              Mettez à jour vos informations personnelles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
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
                  <Label htmlFor="lastName">Nom</Label>
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
                <Label htmlFor="email">Courriel</Label>
                <Input
                  id="email"
                  type="email"
                  value={profileData.email}
                  disabled
                  className="bg-muted cursor-not-allowed"
                />
              </div>
              <div className="space-y-2">
                <Label>Date d&apos;inscription</Label>
                <p className="text-sm text-muted-foreground">
                  {format(user.signupDate, "d MMMM yyyy", { locale: fr })}
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
            <CardTitle>Changer le mot de passe</CardTitle>
            <CardDescription>
              Mettez à jour votre mot de passe pour sécuriser votre compte
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Mot de passe actuel</Label>
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
                <Label htmlFor="newPassword">Nouveau mot de passe</Label>
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
                <Label htmlFor="confirmPassword">Confirmer le nouveau mot de passe</Label>
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
          <CardTitle>Historique des achats</CardTitle>
          <CardDescription>
            Consultez vos achats et dates d&apos;expiration
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingPurchases ? (
            <div className="text-center py-8 text-muted-foreground">
              Chargement...
            </div>
          ) : purchases.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Aucun achat pour le moment
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Produit</TableHead>
                    <TableHead>Date d&apos;achat</TableHead>
                    <TableHead>Montant</TableHead>
                    <TableHead>Date d&apos;expiration</TableHead>
                    <TableHead>Statut</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {purchases.map((purchase) => (
                    <TableRow key={purchase.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {purchase.productName}
                          <Badge variant="outline" className="text-xs">
                            {purchase.type === "course" ? "Cours" : "Cohorte"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell>
                        {format(purchase.purchaseDate, "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell className="font-medium">
                        {formatCurrency(purchase.amount)}
                      </TableCell>
                      <TableCell>
                        {format(purchase.expiresAt, "d MMM yyyy", { locale: fr })}
                      </TableCell>
                      <TableCell>
                        {isExpired(purchase.expiresAt) ? (
                          <Badge variant="destructive">Expiré</Badge>
                        ) : (
                          <Badge variant="default">Actif</Badge>
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

