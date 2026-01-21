/**
 * Route Testing Script
 * Tests all migrated routes for correctness
 */

const BASE_URL = process.env.TEST_URL || "http://localhost:3000";

interface RouteTest {
  name: string;
  path: string;
  expectedStatus: number;
  shouldRedirect?: string;
  description: string;
}

const routesToTest: RouteTest[] = [
  // Public routes
  {
    name: "Homepage",
    path: "/",
    expectedStatus: 200,
    description: "Homepage should load",
  },
  {
    name: "Courses listing",
    path: "/courses",
    expectedStatus: 200,
    description: "Courses page should load",
  },
  {
    name: "Panier",
    path: "/cart",
    expectedStatus: 200,
    description: "Cart page should load",
  },
  
  // Backward compatibility redirects
  {
    name: "Checkout redirect",
    path: "/checkout",
    expectedStatus: 307,
    shouldRedirect: "/payment",
    description: "/checkout should redirect to /payment",
  },
  {
    name: "Formations redirect",
    path: "/formations",
    expectedStatus: 307,
    shouldRedirect: "/courses",
    description: "/formations should redirect to /courses",
  },
  
  // New French routes (protected - may redirect to login when not authenticated)
  // NOTE: These are expected to redirect to /login when not authenticated (307 status)
  // This is CORRECT behavior, not a failure
  {
    name: "Tableau de bord",
    path: "/dashboard",
    expectedStatus: 307, // Redirects to login or role-specific dashboard
    description: "Dashboard should redirect (to login if not auth, or role-specific if auth)",
  },
  {
    name: "Student dashboard",
    path: "/dashboard/student",
    expectedStatus: 307, // Redirects to login if not authenticated
    description: "Student dashboard should redirect to login if not authenticated",
  },
  {
    name: "Admin dashboard",
    path: "/dashboard/admin",
    expectedStatus: 307, // Redirects to login if not authenticated
    description: "Admin dashboard should redirect to login if not authenticated",
  },
  {
    name: "Profile",
    path: "/dashboard/profile",
    expectedStatus: 307, // Redirects to login if not authenticated
    description: "Profile page should redirect to login if not authenticated",
  },
  {
    name: "Payments",
    path: "/dashboard/payments",
    expectedStatus: 307, // Redirects to login if not authenticated
    description: "Payments page should redirect to login if not authenticated",
  },
  {
    name: "Paiement",
    path: "/payment",
    expectedStatus: 307, // May redirect to /cart if cart is empty
    description: "Payment checkout may redirect (to cart if empty, or login if not auth)",
  },
];

async function testRoute(route: RouteTest): Promise<{ success: boolean; error?: string; actualStatus?: number; actualRedirect?: string }> {
  try {
    const response = await fetch(`${BASE_URL}${route.path}`, {
      method: "GET",
      redirect: "manual", // Don't follow redirects automatically
    });

    const status = response.status;
    const location = response.headers.get("location");

    // Check status
    if (status !== route.expectedStatus) {
      return {
        success: false,
        error: `Expected status ${route.expectedStatus}, got ${status}`,
        actualStatus: status,
      };
    }

    // Check redirect if specified
    if (route.shouldRedirect) {
      if (!location || !location.includes(route.shouldRedirect)) {
        return {
          success: false,
          error: `Expected redirect to ${route.shouldRedirect}, got ${location || "none"}`,
          actualRedirect: location || undefined,
        };
      }
    }

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

async function runTests() {
  console.log("🧪 Starting Route Tests\n");
  console.log(`Base URL: ${BASE_URL}\n`);

  const results: Array<{ route: RouteTest; result: { success: boolean; error?: string } }> = [];

  for (const route of routesToTest) {
    process.stdout.write(`Testing ${route.name} (${route.path})... `);
    const result = await testRoute(route);
    results.push({ route, result });

    if (result.success) {
      console.log("✅ PASS");
    } else {
      console.log(`❌ FAIL: ${result.error}`);
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("📊 Test Summary");
  console.log("=".repeat(60));

  const passed = results.filter((r) => r.result.success).length;
  const failed = results.filter((r) => !r.result.success).length;

  console.log(`✅ Passed: ${passed}/${results.length}`);
  console.log(`❌ Failed: ${failed}/${results.length}`);

  if (failed > 0) {
    console.log("\n❌ Failed Tests:");
    results
      .filter((r) => !r.result.success)
      .forEach(({ route, result }) => {
        console.log(`  - ${route.name} (${route.path})`);
        console.log(`    ${result.error}`);
      });
  }

  console.log("\n" + "=".repeat(60));

  // Exit with error code if any tests failed
  process.exit(failed > 0 ? 1 : 0);
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { testRoute, routesToTest };

