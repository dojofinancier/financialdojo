"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CourseList } from "./course-list";
import { CourseForm } from "./course-form";

interface CourseTabsProps {
  defaultTab?: string;
}

export function CourseTabs({ defaultTab = "list" }: CourseTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleTabChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "create") {
      params.set("tab", "create");
    } else {
      params.delete("tab");
    }
    router.push(`/dashboard/admin/courses?${params.toString()}`);
  };

  return (
    <Tabs value={defaultTab} onValueChange={handleTabChange} className="w-full">
      <TabsList>
        <TabsTrigger value="list">Liste des cours</TabsTrigger>
        <TabsTrigger value="create">Créer un cours</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-6">
        <CourseList />
      </TabsContent>
      <TabsContent value="create" className="mt-6">
        <CourseForm />
      </TabsContent>
    </Tabs>
  );
}

