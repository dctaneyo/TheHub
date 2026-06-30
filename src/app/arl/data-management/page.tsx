// Data Management has been relocated to the Admin Console.
// Tenant staff no longer have self-service access to destructive data
// operations — platform admins perform them from /admin/tenants/[id]/data-management.
// Redirect any bookmarked link back to the ARL overview.
import { redirect } from "next/navigation";

export default function DataManagementPage() {
  redirect("/arl");
}
