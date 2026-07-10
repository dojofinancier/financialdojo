import { SessionGuard } from "@/components/auth/session-guard";

export default function LearnLayout({
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
