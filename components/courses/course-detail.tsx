"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { formatCurrency } from "@/lib/utils/format";
import { BookOpen, Clock, Users, CheckCircle2, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { addToCart, isInCart } from "@/lib/utils/cart";
import { useState, useEffect } from "react";
import { toast } from "sonner";

type Course = {
  id: string;
  code: string | null;
  slug: string | null;
  title: string;
  description: string | null;
  price: number;
  paymentType: string;
  accessDuration: number;
  category: {
    id: string;
    name: string;
  };
  modules: Array<{
    id: string;
    title: string;
    description: string | null;
    contentItems: Array<{
      id: string;
      contentType: string;
      order: number;
    }>;
  }>;
  faqs?: Array<{
    id: string;
    question: string;
    answer: string;
    order: number;
  }>;
  _count: {
    enrollments: number;
    modules: number;
  };
};

interface CourseDetailProps {
  course: Course;
  isEnrolled: boolean;
  enrollment: any;
}

export function CourseDetail({ course, isEnrolled, enrollment }: CourseDetailProps) {
  const router = useRouter();
  const [inCart, setInCart] = useState(false);

  useEffect(() => {
    setInCart(isInCart(course.id, "course"));
    
    // Listen for cart updates
    const handleCartUpdate = () => {
      setInCart(isInCart(course.id, "course"));
    };
    window.addEventListener("cartUpdated", handleCartUpdate);
    return () => window.removeEventListener("cartUpdated", handleCartUpdate);
  }, [course.id]);

  const handleAddToCart = () => {
    addToCart({
      id: course.id,
      type: "course",
      slug: course.slug,
      title: course.title,
      price: course.price,
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
    router.push(`/learn/${course.slug || course.id}`);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{course.category.name}</Badge>
              {course.code && (
                <Badge variant="secondary" className="font-mono text-xs">
                  {course.code}
                </Badge>
              )}
            </div>
            <h1 className="text-3xl font-bold mb-2">{course.title}</h1>
            {course.description && (
              <div 
                className="prose max-w-none mt-4 text-muted-foreground"
                dangerouslySetInnerHTML={{ __html: course.description }}
              />
            )}
          </div>

          {/* Modules Preview */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Course content
              </CardTitle>
              <CardDescription>
                {course._count.modules} module{course._count.modules !== 1 ? "s" : ""}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {course.modules.map((module, index) => (
                  <div key={module.id} className="border rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold mb-1">{module.title}</h3>
                        {module.description && (
                          <div 
                            className="text-sm text-muted-foreground mb-2"
                            dangerouslySetInnerHTML={{ __html: module.description }}
                          />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {module.contentItems.length} item{module.contentItems.length !== 1 ? "s" : ""}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* FAQ Section */}
          {course.faqs && course.faqs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Frequently asked questions</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {course.faqs.map((faq) => (
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
              <CardTitle>Enrollment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEnrolled ? (
                <>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    <span className="font-semibold">You are enrolled</span>
                  </div>
                  <Button onClick={handleContinue} className="w-full" size="lg">
                    Continue learning
                  </Button>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Prix</span>
                      <span className="text-2xl font-bold">
                        {formatCurrency(Number(course.price))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Payment type</span>
                      <span>
                        {course.paymentType === "SUBSCRIPTION" ? "Subscription" : "One-time payment"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Access duration</span>
                      <span>{course.accessDuration} days</span>
                    </div>
                  </div>
                  <Separator />
                  {inCart ? (
                    <>
                      <Button onClick={handleGoToCart} className="w-full" size="lg" variant="outline">
                        <ShoppingCart className="h-4 w-4 mr-2" />
                        View cart
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        This course is already in your cart
                      </p>
                    </>
                  ) : (
                    <>
                      <Button onClick={handleAddToCart} className="w-full" size="lg">
                        Enroll now
                      </Button>
                      <p className="text-xs text-center text-muted-foreground">
                        Immediate access after payment
                      </p>
                    </>
                  )}
                </>
              )}

              <Separator />

              {/* Course Stats */}
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Users className="h-4 w-4" />
                  <span>{course._count.enrollments} student{course._count.enrollments !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <BookOpen className="h-4 w-4" />
                  <span>{course._count.modules} module{course._count.modules !== 1 ? "s" : ""}</span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Clock className="h-4 w-4" />
                  <span>Access {course.accessDuration} days</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

