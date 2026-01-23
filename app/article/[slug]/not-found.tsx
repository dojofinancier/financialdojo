import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function ArticleNotFound() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center px-4">
      <div className="text-center max-w-md">
        <h1 className="text-4xl font-bold mb-4">Article not found</h1>
        <p className="text-gray-600 mb-8">
          The article you are looking for does not exist or has been deleted.
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/article">View all articles</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
