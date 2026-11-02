import { Outlet } from "react-router-dom";

import Logo from "../shared/components/Logo";

export default function AuthLayout() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-white px-5 py-10 sm:px-8">
      <div className="flex w-full max-w-sm flex-col">
        <Logo
          showCard={false}
          className="[&>img]:h-14 [&>h1]:mt-3 [&>h1]:text-[25px] [&>p]:mt-1 [&>p]:text-[11px]"
        />

        <Outlet />
      </div>
    </main>
  );
}
