"use client";

import Link from "next/link";
import { useState } from "react";
import { submitContactFormAction } from "@/app/actions/contact";
import { toast } from "sonner";

export function ContactPageClient() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await submitContactFormAction(formData);

      if (result.success) {
        toast.success("Thank you for your message! We will reply shortly.");
        setFormData({
          name: "",
          email: "",
          subject: "",
          message: "",
        });
      } else {
        toast.error(result.error || "Error sending message");
      }
    } catch (error) {
      toast.error("Error sending the message. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <>
      {/* Main content */}
      <main className="min-h-screen bg-black text-white pt-32 pb-20">
        {/* Hard grid pattern */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(white 2px, transparent 2px),
              linear-gradient(90deg, white 2px, transparent 2px)
            `,
            backgroundSize: "80px 80px"
          }}
        />

        <div className="relative px-4 sm:px-8">
          <div className="max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="mb-16">
              <span className="text-primary font-mono text-sm uppercase tracking-[0.3em] block mb-4">
                [CONTACT]
              </span>
              <h1 className="text-6xl sm:text-7xl md:text-8xl font-black uppercase tracking-tighter leading-[0.9] mb-8">
                CONTACTEZ
                <br />
                <span className="text-primary">NOUS</span>
              </h1>
              <div className="max-w-2xl">
                <div className="border-l-4 border-primary pl-6 py-2">
                  <p className="text-xl sm:text-2xl font-light leading-relaxed opacity-80">
                    Une question ? Besoin d'aide ? Nous sommes là pour vous.
                  </p>
                </div>
              </div>
            </div>

            {/* Content grid */}
            <div className="grid lg:grid-cols-2 gap-16 items-start">
              {/* Left: Contact form */}
              <div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block font-mono text-sm uppercase tracking-wider mb-2 opacity-70">
                      NOM *
                    </label>
                    <input
                      type="text"
                      id="name"
                      name="name"
                      required
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full bg-transparent border-4 border-white text-white font-mono px-6 py-4 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block font-mono text-sm uppercase tracking-wider mb-2 opacity-70">
                      COURRIEL *
                    </label>
                    <input
                      type="email"
                      id="email"
                      name="email"
                      required
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full bg-transparent border-4 border-white text-white font-mono px-6 py-4 focus:outline-none focus:border-primary transition-colors"
                    />
                  </div>

                  {/* Subject */}
                  <div>
                    <label htmlFor="subject" className="block font-mono text-sm uppercase tracking-wider mb-2 opacity-70">
                      SUJET *
                    </label>
                    <select
                      id="subject"
                      name="subject"
                      required
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full bg-black border-4 border-white text-white font-mono px-6 py-4 focus:outline-none focus:border-primary transition-colors"
                    >
                      <option value="">Sélectionnez un sujet</option>
                      <option value="formation">Question sur une formation</option>
                      <option value="inscription">Inscription</option>
                      <option value="technique">Problème technique</option>
                      <option value="autre">Autre</option>
                    </select>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="message" className="block font-mono text-sm uppercase tracking-wider mb-2 opacity-70">
                      MESSAGE *
                    </label>
                    <textarea
                      id="message"
                      name="message"
                      required
                      rows={6}
                      value={formData.message}
                      onChange={handleChange}
                      className="w-full bg-transparent border-4 border-white text-white font-mono px-6 py-4 focus:outline-none focus:border-primary transition-colors resize-none"
                    />
                  </div>

                  {/* Submit button */}
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white text-black font-black uppercase text-lg tracking-wider px-10 py-5 border-4 border-white hover:bg-primary hover:border-primary hover:text-black transition-colors shadow-[8px_8px_0_0_hsl(var(--primary))] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? "Envoi..." : "Send →"}
                  </button>
                </form>
              </div>

              {/* Right: Contact info */}
              <div className="space-y-8">
                <div className="border-4 border-white p-8">
                  <h3 className="font-black uppercase tracking-wider text-xl mb-6 border-b-4 border-white pb-4 inline-block">
                    INFORMATIONS
                  </h3>
                  <div className="space-y-6 font-mono text-sm">
                    <div>
                      <div className="uppercase tracking-wider opacity-70 mb-2">COURRIEL</div>
                      <a href="mailto:contact@dojofinancier.ca" className="hover:text-primary transition-colors">
                        contact@dojofinancier.ca
                      </a>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider opacity-70 mb-2">ADRESSE</div>
                      <div>Montréal, Québec</div>
                    </div>
                    <div>
                      <div className="uppercase tracking-wider opacity-70 mb-2">HEURES</div>
                      <div>Lundi - Vendredi: 9h - 17h</div>
                    </div>
                  </div>
                </div>

                {/* FAQ link */}
                <div className="border-4 border-primary bg-primary text-black p-8">
                  <h3 className="font-black uppercase tracking-wider text-xl mb-4">
                    QUESTIONS FRÉQUENTES
                  </h3>
                  <p className="font-mono text-sm mb-6 opacity-90">
                    Consultez notre FAQ pour des réponses rapides.
                  </p>
                  <Link 
                    href="/courses"
                    className="inline-block bg-black text-white font-black uppercase text-sm tracking-wider px-6 py-3 border-4 border-black hover:bg-white hover:border-white hover:text-black transition-colors"
                  >
                    Voir les formations →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

