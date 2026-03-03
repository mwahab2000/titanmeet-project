import { Outlet } from "react-router-dom";
import { DashboardSidebar } from "./DashboardSidebar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/contexts/AuthContext";

export const DashboardLayout = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      <DashboardSidebar />
      <div className="ml-64 min-h-screen">
        <header className="flex items-center justify-end border-b border-border px-8 py-3">
          <NotificationBell />
        </header>
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
