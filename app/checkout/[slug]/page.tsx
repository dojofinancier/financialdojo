import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { ReactElement } from "react";

interface CheckoutSlugPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Redirect /checkout/[slug] to /payment/[slug] for backward compatibility
 */
async function CheckoutSlugRedirect({ params }: CheckoutSlugPageProps): Promise<ReactElement> {
  const { slug } = await params;
  redirect(`/payment/${slug}`);

  // `redirect()` throws and never returns, but this keeps TS happy.
  return <></>;
}

export default function CheckoutSlugPage(props: CheckoutSlugPageProps) {
  return (
    <Suspense
      fallback={
        <div className="container mx-auto p-6">
          <div className="text-muted-foreground">Redirection...</div>
        </div>
      }
    >
      <CheckoutSlugRedirect {...props} />
    </Suspense>
  );
}
