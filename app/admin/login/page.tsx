import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

async function login(formData: FormData) {
  "use server";
  const token = String(formData.get("token") ?? "");
  const expected = process.env.ADMIN_TOKEN ?? "dev-admin";
  if (token === expected) {
    cookies().set("admin_token", token, {
      httpOnly: true, sameSite: "lax", path: "/",
      maxAge: 60 * 60 * 8,
    });
    redirect("/admin");
  }
  redirect("/admin/login?error=1");
}

export default function AdminLogin({ searchParams }: { searchParams: { error?: string } }) {
  return (
    <div className="mx-auto max-w-sm">
      <div className="card p-6">
        <h1 className="text-xl font-bold">Admin sign-in</h1>
        <p className="mt-1 text-sm text-ink-500">
          Enter the admin token to manage data and squad availability.
        </p>
        <form action={login} className="mt-4 space-y-3">
          <input
            type="password" name="token" placeholder="Admin token" autoFocus
            className="w-full rounded-lg border border-ink-200 px-3 py-2 text-sm"
          />
          {searchParams.error && (
            <p className="text-sm text-red-600">Invalid token.</p>
          )}
          <button type="submit"
            className="w-full rounded-lg bg-pitch-700 px-3 py-2 text-sm font-medium text-white hover:bg-pitch-900">
            Sign in
          </button>
        </form>
        <p className="mt-3 text-[11px] text-ink-400">Local default token: <code>dev-admin</code></p>
      </div>
    </div>
  );
}
