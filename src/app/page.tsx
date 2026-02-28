import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import LandingPage from "@/components/landing-page";

const hubDomains = ["meetthehub.com", "meethehub.com"];

export default async function Home() {
  const h = await headers();
  const host = (h.get("host") || "").split(":")[0];

  // Show landing page on bare root domain
  const isRootDomain = hubDomains.includes(host) || hubDomains.some((d) => host === `www.${d}`);
  if (isRootDomain) {
    return <LandingPage />;
  }

  // Tenant subdomain or localhost — redirect to login/dashboard
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  if (session.userType === "location") {
    redirect("/dashboard");
  } else {
    redirect("/arl");
  }
}
