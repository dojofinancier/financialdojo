"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CouponList } from "@/components/admin/coupons/coupon-list";
import { CouponForm } from "@/components/admin/coupons/coupon-form";
import { useState } from "react";

export function CouponTabs() {
  const [activeTab, setActiveTab] = useState("list");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      <TabsList>
        <TabsTrigger value="list">Liste des coupons</TabsTrigger>
        <TabsTrigger value="create">Create coupon</TabsTrigger>
      </TabsList>
      <TabsContent value="list" className="mt-6">
        <CouponList onEdit={(couponId) => {
          // TODO: Implement edit flow
          console.log("Edit coupon:", couponId);
        }} />
      </TabsContent>
      <TabsContent value="create" className="mt-6">
        <CouponForm
          onSuccess={() => {
            setActiveTab("list");
          }}
        />
      </TabsContent>
    </Tabs>
  );
}

