import { SessionGuard } from "@/components/auth/session-guard";

export default function ApprendreLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <SessionGuard />
      {children}
    </>
  );
}
