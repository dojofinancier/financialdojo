"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils/format";
import { BookOpen, Clock, Users, CheckCircle2, ShoppingCart, Calendar, AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart, isInCart } from "@/lib/utils/cart";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

type Cohort = {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  maxStudents: number;
  enrollmentClosingDate: Date;
  accessDuration: number;
  instructor: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
  } | null;
  cohortModules: Array<{
    id: string;
    order: number;
    module: {
      id: string;
      title: string;
      description: string | null;
      contentItems: Array<{
        id: string;
        contentType: string;
        order: number;
      }>;
    };
  }>;
  faqs?: Array<{
    id: string;
    question: string;
    answer: string;
    order: number;
  }>;
  _count: {
    enrollments: number;
  };
  isEnrollmentOpen: boolean;
  spotsRemaining: number;
};

interface CohortDetailProps {
  cohort: Cohort;
  isEnrolled: boolean;
  enrollment: any;
}

export function CohortDetail({ cohort, isEnrolled, enrollment }: CohortDetailProps) {
  const router = useRouter();
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    setInCart(isInCart(cohort.id, "cohort"));
    
    // Listen for cart updates
    const handleCartUpdate = () => {
      setInCart(isInCart(cohort.id, "cohort"));
    };
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, [cohort.id]);

  const handleAddToCart = () => {
    if (!cohort.isEnrollmentOpen) {
      toast.error("Registrations are closed for this cohort");
      return;
    }
    if (cohort.spotsRemaining <= 0) {
      toast.error("This cohort is full");
      return;
    }
    
    addToCart({
      id: cohort.id,
      type: "cohort",
      slug: cohort.slug,
      title: cohort.title,
      price: cohort.price,
    });
    toast.success("Added to cart");
    setInCart(true);
    // Redirect to cart page
    router.push("/cart");
  };

  const handleGoToCart = () => {
    router.push("/cart");
  };

  const handleContinue = () => {
    router.push(`/cohorts/${cohort.slug || cohort.id}/learn`);
  };

  const instructorName = cohort.instructor
    ? `${cohort.instructor.firstName || ""} ${cohort.instructor.lastName || ""}`.trim() || cohort.instructor.email
    : "Instructor not assigned";

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">Cohorte de coaching</Badge>
              {cohort.instructor && (
                <Badge variant="secondary">
                  {instructorName}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">{cohort.title}</h1>
            {cohort.description && (
              <div 
                className="prose max-w-none mt-4 text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: cohort.description }}
              />
            )}
          </div>

          {/* Enrollment Status */}
          {!cohort.isEnrollmentOpen && (
            <Card className="border-orange-200 bg-orange-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-orange-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-semibold">Les inscriptions sont fermées</span>
                </div>
                <p className="text-sm text-orange-600 mt-2">
                  La date limite d'inscription était le {format(new Date(cohort.enrollmentClosingDate), "d MMMM yyyy", { locale: fr })}
                </p>
              </CardContent>
            </Card>
          )}

          {cohort.isEnrollmentOpen && cohort.spotsRemaining <= 0 && (
            <Card className="border-red-200 bg-red-50">
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertCircle className="h-5 w-5" />
                  <span className="font-semibold">Cohorte complète</span>
                </div>
                <p className="text-sm text-red-600 mt-2">
                  Tous les {cohort.maxStudents} places sont occupées
                </p>
              </CardContent>
            </Card>
          )}

          {/* Modules Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Contenu de la cohorte
              </CardTitle>
              <CardDescription>
                {cohort.cohortModules.length} module{cohort.cohortModules.length !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {cohort.cohortModules.map((cohortModule, index) => (
                  <div key={cohortModule.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{cohortModule.module.title}</h3>
                        {cohortModule.module.description && (
                          <div 
                            className="text-sm text-muted-foreground mb-2"
                            dangerouslySetInnerHTML={{ __html: cohortModule.module.description }}
                          />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {cohortModule.module.contentItems.length} élément{cohortModule.module.contentItems.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          {cohort.faqs && cohort.faqs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Questions fréquentes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {cohort.faqs.map((faq) => (
                    <div key={faq.id} className="border-b last:border-b-0 pb-4 last:pb-0">
                      <h4 className="font-semibold mb-2">{faq.question}</h4>
                      <p className="text-sm text-muted-foreground">{faq.answer}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Enrollment CTA */}
        <div className="lg:col-span-1">
          <Card className="sticky top-6">
            <CardHeader>
              <CardTitle>Inscription</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEnrolled ? (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">Vous êtes inscrit</span>
                  </div>
                  <Button onClick={handleContinue} className="w-full" size="lg">
                    Accéder à la cohorte
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Prix</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(Number(cohort.price))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Durée d'accès</span>
                      <span>{cohort.accessDuration} jours</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Places disponibles</span>
                      <span>{cohort.spotsRemaining} / {cohort.maxStudents}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Date limite</span>
                      <span className="text-xs">
                        {format(new Date(cohort.enrollmentClosingDate), "d MMM yyyy", { locale: fr })}
                      </span>
                    </div>
                  </div>
                  <Separator />
                  {!cohort.isEnrollmentOpen || cohort.spotsRemaining <= 0 ? (
                    <Button disabled className="w-full" size="lg">
                      Inscription fermée
                    </Button>
                  ) : inCart ? (
                    <>
                      <Button onClick={handleGoToCart} className="w-full" size="lg" variant="outline">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        Voir le panier
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Cette cohorte est déjà dans votre panier
                      </p>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleAddToCart} className="w-full" size="lg">
                        S'inscrire maintenant
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Accès immédiat après paiement
                      </p>
                    </>
                  )}
                </>
              )}

              <Separator />

              {/* Cohort Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{cohort._count.enrollments} participant{cohort._count.enrollments !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>{cohort.cohortModules.length} module{cohort.cohortModules.length !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Accès {cohort.accessDuration} jours</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span className="text-xs">
                    Clôture: {format(new Date(cohort.enrollmentClosingDate), "d MMM yyyy", { locale: fr })}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

