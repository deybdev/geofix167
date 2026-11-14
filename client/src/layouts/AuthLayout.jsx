import { Outlet } from "react-router-dom";

import Logo from "../shared/components/Logo";

export default function AuthLayout() {
  return (
    <main className="flex min-h-screen items-start justify-center bg-slate-50 px-4 py-6 sm:items-center sm:px-8 sm:py-10">
      <div className="flex w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <Logo
          showCard={false}
          className="[&>img]:h-11 [&>h1]:mt-2 [&>h1]:text-[22px] [&>p]:mt-0.5 [&>p]:text-[11px]"
        />

        <Outlet />
      </div>
    </main>
  );
}
