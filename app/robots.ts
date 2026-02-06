import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://financedojo.ca";

    return {
        rules: {
            userAgent: "*",
            allow: "/",
            disallow: [
                "/api/",
                "/admin/",
                "/tableau-de-bord/",
                "/dashboard/",
                "/r/",
                "/checkout/",
                "/paiement/",
                "/cart/",
                "/panier/"
            ],
        },
        sitemap: `${siteUrl}/sitemap.xml`,
    };
}
