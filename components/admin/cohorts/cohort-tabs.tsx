"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CohortList } from "./cohort-list";
import { CohortForm } from "./cohort-form";

interface CohortTabsProps {
  defaultTab?: string;
}

export function CohortTabs({ defaultTab = "list" }: CohortTabsProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentTab, setCurrentTab] = useState<string>(defaultTab);
  
  // Sync tab state with URL params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam === "create") {
      setCurrentTab("create");
    } else if (tabParam === "list") {
      setCurrentTab("list");
    } else {
      setCurrentTab(defaultTab);
    }
  }, [searchParams, defaultTab]);

  const handleTabChange = (value: string) => {
    setCurrentTab(value);
    const params = new URLSearchParams();
    if (value === "create") {
      params.set("tab", "create");
    }
    // Use replace to avoid adding to history stack
    router.replace(`/dashboard/admin/cohorts?${params.toString()}`);
  };

  return (
    <Tabs value={currentTab} onValueChange={handleTabChange} className="w-full">
      <TabsList>
        <TabsTrigger value="list">Cohort list</TabsTrigger>
        <TabsTrigger value="create">Create cohort</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-6">
        <CohortList />
      </TabsContent>
      <TabsContent value="create" className="mt-6">
        <CohortForm />
      </TabsContent>
    </Tabs>
  );
}
