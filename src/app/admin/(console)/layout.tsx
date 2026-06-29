import { redirect } from "next/navigation";
import { getAdminSession } from "@/lib/admin-auth";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

// Desktop-only shell: Stripe/Vercel-dense reference anchor, no mobile
// drawer — this manages other people's tenants at a glance, not daily work
// inside one, so the responsive complexity a kiosk surface needs doesn't
// apply here.
export default async function AdminConsoleLayout({ children }: { children: React.ReactNode }) {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex h-screen">
      <AdminSidebar />
      <main className="flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
