"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RichTextEditor } from "./rich-text-editor";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { updateCourseAboutAction } from "@/app/actions/courses";

interface CourseAboutManagementProps {
  courseId: string;
  initialShortDescription: string;
  initialAboutText: string;
}

export function CourseAboutManagement({ 
  courseId, 
  initialShortDescription,
  initialAboutText 
}: CourseAboutManagementProps) {
  const [shortDescription, setShortDescription] = useState(initialShortDescription || "");
  const [aboutText, setAboutText] = useState(initialAboutText || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      const result = await updateCourseAboutAction(courseId, { shortDescription, aboutText });
      if (result.success) {
        toast.success("Information updated successfully");
      } else {
        toast.error(result.error || "Error updating");
      }
    } catch (error) {
      toast.error("Error saving");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Short description</CardTitle>
          <CardDescription>
            This description will appear in the hero section of the course page (2-3 sentences)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="shortDescription">Short description</Label>
            <Input
              id="shortDescription"
              value={shortDescription}
              onChange={(e) => setShortDescription(e.target.value)}
              placeholder="Eg: Prepare effectively for the CCVM exam with our comprehensive training..."
              className="w-full"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>About the course</CardTitle>
          <CardDescription>
            Detailed text that appears in the "About" section of the course page
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RichTextEditor
            content={aboutText}
            onChange={setAboutText}
            placeholder="Describe in detail your training, its objectives, its methodology..."
          />
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Saving..." : "Save"}
        </Button>
      </div>
    </div>
  );
}













