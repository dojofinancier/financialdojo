"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createCouponAction,
  updateCouponAction,
} from "@/app/actions/coupons";
import { getCoursesAction } from "@/app/actions/courses";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

type CourseOption = {
  id: string;
  title: string;
};

// Form schema (keep inputs as strings for react-hook-form)
const couponFormSchema = z.object({
  code: z.string().min(1, "Le code est requis").toUpperCase(),
  discountType: z.enum(["PERCENTAGE", "FIXED"]),
  discountValue: z.string().min(1, "La valeur de remise est requise"),
  applicableCourses: z.array(z.string()).optional().nullable(),
  usageLimit: z.string().optional().nullable(),
  validFrom: z.string().min(1, "Start date is required"),
  validUntil: z.string().min(1, "La date de fin est requise"),
  active: z.boolean().default(true),
});

// Submit schema (transform strings -> typed values for server actions)
const couponSubmitSchema = couponFormSchema.extend({
  discountValue: z.string().transform((val) => parseFloat(val)),
  usageLimit: z
    .string()
    .transform((val) => (val ? parseInt(val, 10) : null))
    .optional()
    .nullable(),
});

type CouponFormData = z.infer<typeof couponSubmitSchema>;
type CouponFormValues = z.input<typeof couponFormSchema>;

interface CouponFormProps {
  couponId?: string;
  initialData?: Partial<CouponFormData & { applicableCourses: string[] | null }>;
  onSuccess?: () => void;
}

export function CouponForm({ couponId, initialData, onSuccess }: CouponFormProps) {
  const [loading, setLoading] = useState(false);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourses, setSelectedCourses] = useState<string[]>(
    initialData?.applicableCourses || []
  );
  const [applyToAllCourses, setApplyToAllCourses] = useState(
    !initialData?.applicableCourses || initialData.applicableCourses.length === 0
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<CouponFormValues>({
    resolver: zodResolver(couponFormSchema),
    defaultValues: {
      code: initialData?.code || "",
      discountType: initialData?.discountType || "PERCENTAGE",
      discountValue: initialData?.discountValue?.toString() || "0",
      usageLimit: initialData?.usageLimit?.toString() || "",
      validFrom: initialData?.validFrom
        ? new Date(initialData.validFrom).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      validUntil: initialData?.validUntil
        ? new Date(initialData.validUntil).toISOString().split("T")[0]
        : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
      active: initialData?.active ?? true,
    },
  });

  const discountType = watch("discountType");

  useEffect(() => {
    const loadCourses = async () => {
      try {
        const result = await getCoursesAction({ limit: 1000 });
        setCourses(result.items || []);
      } catch (error) {
        toast.error("Error loading courses");
      }
    };
    loadCourses();
  }, []);

  const onSubmit = async (values: CouponFormValues) => {
    try {
      setLoading(true);
      const data = couponSubmitSchema.parse(values);

      const couponData = {
        ...data,
        validFrom: new Date(data.validFrom),
        validUntil: new Date(data.validUntil),
        applicableCourses: applyToAllCourses ? null : selectedCourses,
      };

      let result;
      if (couponId) {
        result = await updateCouponAction(couponId, couponData);
      } else {
        result = await createCouponAction(couponData);
      }

      if (result.success) {
        toast.success(couponId ? "Coupon updated" : "Coupon created");
        onSuccess?.();
      } else {
        toast.error(result.error || "An error occurred");
      }
    } catch (error) {
      toast.error("An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-4xl">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="code">Code du coupon *</Label>
          <Input
            id="code"
            {...register("code")}
            placeholder="EXEMPLE2024"
            className="uppercase"
            onChange={(e) => {
              setValue("code", e.target.value.toUpperCase());
            }}
          />
          {errors.code && (
            <p className="text-sm text-destructive">{errors.code.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="discountType">Type de réduction *</Label>
          <Select
            value={discountType}
            onValueChange={(value: "PERCENTAGE" | "FIXED") =>
              setValue("discountType", value)
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="PERCENTAGE">Pourcentage</SelectItem>
              <SelectItem value="FIXED">Montant fixe ($)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="discountValue">
            {discountType === "PERCENTAGE" ? "Pourcentage (%) *" : "Montant ($) *"}
          </Label>
          <Input
            id="discountValue"
            type="number"
            step={discountType === "PERCENTAGE" ? "1" : "0.01"}
            min="0"
            max={discountType === "PERCENTAGE" ? "100" : undefined}
            {...register("discountValue")}
            placeholder={discountType === "PERCENTAGE" ? "10" : "50.00"}
          />
          {errors.discountValue && (
            <p className="text-sm text-destructive">
              {errors.discountValue.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="usageLimit">Limite d'utilisation</Label>
          <Input
            id="usageLimit"
            type="number"
            min="1"
            {...register("usageLimit")}
            placeholder="Unlimited if empty"
          />
          <p className="text-xs text-muted-foreground">
            Laissez vide pour un usage illimité
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="validFrom">Valide du *</Label>
          <Input
            id="validFrom"
            type="date"
            {...register("validFrom")}
          />
          {errors.validFrom && (
            <p className="text-sm text-destructive">
              {errors.validFrom.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="validUntil">Valide jusqu'au *</Label>
          <Input
            id="validUntil"
            type="date"
            {...register("validUntil")}
          />
          {errors.validUntil && (
            <p className="text-sm text-destructive">
              {errors.validUntil.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center space-x-2">
          <Checkbox
            id="applyToAll"
            checked={applyToAllCourses}
            onCheckedChange={(checked) => {
              setApplyToAllCourses(checked as boolean);
              if (checked) {
                setSelectedCourses([]);
              }
            }}
          />
          <Label htmlFor="applyToAll" className="cursor-pointer">
            Applicable à tous les cours
          </Label>
        </div>

        {!applyToAllCourses && (
          <div className="space-y-2">
            <Label>Cours applicables</Label>
            <div className="border rounded-md p-4 max-h-60 overflow-y-auto">
              {courses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun cours disponible
                </p>
              ) : (
                <div className="space-y-2">
                  {courses.map((course) => (
                    <div key={course.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`course-${course.id}`}
                        checked={selectedCourses.includes(course.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedCourses([...selectedCourses, course.id]);
                          } else {
                            setSelectedCourses(
                              selectedCourses.filter((id) => id !== course.id)
                            );
                          }
                        }}
                      />
                      <Label
                        htmlFor={`course-${course.id}`}
                        className="cursor-pointer flex-1"
                      >
                        {course.title}
                      </Label>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <input
          type="checkbox"
          id="active"
          {...register("active")}
          className="h-4 w-4 rounded border-gray-300"
        />
        <Label htmlFor="active" className="cursor-pointer">
          Coupon actif
        </Label>
      </div>

      <div className="flex gap-4">
        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Enregistrement...
            </>
          ) : couponId ? (
            "Update"
          ) : (
            "Create coupon"
          )}
        </Button>
      </div>
    </form>
  );
}

