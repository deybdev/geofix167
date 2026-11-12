import { Outlet } from "react-router-dom";

import Logo from "../shared/components/Logo";

export default function GuestLayout() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-white px-5 py-10 sm:px-8">
      <div className="flex w-full max-w-sm flex-col">
        <Outlet />
      </div>
    </main>
  );
}
