import { redirect } from "next/navigation";
import { auth } from "@/libs/auth";
import config from "@/config";
import Sidebar from "./Sidebar";
import MobileHeader from "./MobileHeader";

// This is a server-side component to ensure the user is logged in and is an admin
// If not, it will redirect to the login page.
// It's applied to all subpages of /admin/dashboard in /app/dashboard/*** pages
export default async function LayoutAdminPrivate({ children }) {
  const session = await auth();

  console.log(session);

  if (!session) {
    redirect(config.auth.loginUrl);
  }

  if (session.user.role !== "admin") {
    redirect(config.auth.callbackUrl);
  }

  return (
    <div className="drawer lg:drawer-open">
      <input id="my-drawer-2" type="checkbox" className="drawer-toggle" />
      <div className="drawer-content">
        {/* Page content here */}
        <div className="p-4">
          <MobileHeader />
          {children}
        </div>
      </div>
      <Sidebar />
    </div>
  );
}
