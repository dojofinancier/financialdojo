"use client";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Card, CardContent } from "@/components/ui/card";
import { Quote } from "lucide-react";

interface Testimonial {
  id: string;
  name: string;
  role: string;
  text: string;
  avatar?: string;
}

interface TestimonialCarouselProps {
  testimonials: Testimonial[];
}

export function TestimonialCarousel({ testimonials }: TestimonialCarouselProps) {
  if (!testimonials || testimonials.length === 0) return null;

  return (
    <Carousel
      opts={{
        align: "start",
        loop: true,
      }}
      className="w-full"
    >
      <CarouselContent className="-ml-2 md:-ml-4">
        {testimonials.map((item) => (
          <CarouselItem key={item.id} className="pl-2 md:pl-4 md:basis-1/2 lg:basis-1/3">
            <div className="p-1 h-full">
              <Card className="h-full bg-transparent border-2 border-white/20 hover:border-primary transition-colors group">
                <CardContent className="p-6 flex flex-col h-full">
                  <Quote className="h-8 w-8 text-primary mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  <p className="text-white/80 leading-relaxed italic mb-6 flex-grow">
                    &quot;{item.text}&quot;
                  </p>
                  <div className="flex items-center gap-4 mt-auto">
                    {item.avatar && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.avatar}
                        alt={item.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-primary"
                      />
                    )}
                    <div>
                      <p className="font-bold text-white group-hover:text-primary transition-colors">
                        {item.name}
                      </p>
                      <p className="text-xs text-white/50 uppercase tracking-wider">
                        {item.role}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CarouselItem>
        ))}
      </CarouselContent>
      <div className="flex justify-end gap-2 mt-8 px-4">
        <CarouselPrevious className="static transform-none bg-transparent border-2 border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary" />
        <CarouselNext className="static transform-none bg-transparent border-2 border-white/20 text-white hover:bg-primary hover:text-black hover:border-primary" />
      </div>
    </Carousel>
  );
}
