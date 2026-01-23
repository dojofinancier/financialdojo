"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { submitWaitlistAction } from "@/app/actions/waitlist";
import { toast } from "sonner";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface WaitlistPageClientProps {
  type: "investisseur" | "entrepreneur";
}

export function WaitlistPageClient({ type }: WaitlistPageClientProps) {
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const title = type === "investisseur" ? "INVESTISSEURS" : "ENTREPRENEURS";
  const subtitle = type === "investisseur" ? "PARTICULIERS" : "& DIRIGEANTS";
  const description =
    type === "investisseur"
      ? "Manage your wealth. Understand the markets. Make informed decisions."
      : "Corporate finance, financial planning, growth.";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitWaitlistAction({
        email,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        type,
      });

      if (result.success) {
        setIsSuccess(true);
        toast.success(result.message || "Thank you! You have been added to the waiting list.");
        setEmail("");
        setFirstName("");
        setLastName("");
      } else {
        toast.error(result.error || "An error occurred.");
      }
    } catch (error) {
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
        <div className="container mx-auto px-4 py-20 max-w-2xl">
          <Card className="border-4 border-black shadow-[12px_12px_0_0_black]">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 w-16 h-16 bg-primary rounded-full flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-black" />
              </div>
              <CardTitle className="text-3xl font-black uppercase tracking-tight">
                Thank you!
              </CardTitle>
              <CardDescription className="text-lg mt-4">
                You have been added to the waitlist. We will contact you as soon as our courses for{" "}
                {type === "investisseur" ? "investors" : "entrepreneurs"} are available.
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild variant="outline" className="mt-4">
                <Link href="/">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to home
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-neutral-50 to-white">
      <div className="container mx-auto px-4 py-20 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-12">
          <Link
            href="/"
            className="inline-flex items-center text-sm text-neutral-600 hover:text-neutral-900 mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>
          <div className="font-mono text-sm uppercase tracking-[0.3em] text-neutral-500 mb-4">
            [WAITLIST]
          </div>
          <h1 className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tighter mb-4">
            {title}
          </h1>
          <div className="text-sm font-mono uppercase tracking-wider text-neutral-600 mb-6">
            {subtitle}
          </div>
          <p className="text-xl text-neutral-700 max-w-2xl mx-auto leading-relaxed">
            {description}
          </p>
        </div>

        {/* Main Content */}
        <div className="grid md:grid-cols-2 gap-8 items-start">
          {/* Left: Info */}
          <div className="space-y-6">
            <Card className="border-4 border-black shadow-[8px_8px_0_0_black]">
              <CardHeader>
              <CardTitle className="text-2xl font-black uppercase">Coming soon</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-neutral-700 leading-relaxed">
                  Our courses for {type === "investisseur" ? "investors" : "entrepreneurs"} are in development.
                  Join the waitlist to be among the first to know when we launch.
                </p>
                <div className="space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm text-neutral-600">
                      Priority notification at launch
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm text-neutral-600">
                      Early access to courses
                    </p>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-2 h-2 bg-primary rounded-full mt-2 flex-shrink-0" />
                    <p className="text-sm text-neutral-600">
                      Exclusive offers for waitlist members
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right: Form */}
          <Card className="border-4 border-black shadow-[8px_8px_0_0_black]">
            <CardHeader>
              <CardTitle className="text-2xl font-black uppercase">Join the list</CardTitle>
              <CardDescription>
                Fill out the form below to be added to the waitlist.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                    className="border-2 border-black"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      type="text"
                      placeholder="Alex"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      disabled={isSubmitting}
                      className="border-2 border-black"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      type="text"
                      placeholder="Doe"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      disabled={isSubmitting}
                      className="border-2 border-black"
                    />
                  </div>
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting || !email}
                  className="w-full font-black uppercase tracking-wider border-4 border-black shadow-[4px_4px_0_0_black] hover:shadow-[2px_2px_0_0_black] transition-all"
                  size="lg"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Join the waitlist"
                  )}
                </Button>
                <p className="text-xs text-neutral-500 text-center">
                  By signing up, you agree to receive communications from us.
                </p>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
