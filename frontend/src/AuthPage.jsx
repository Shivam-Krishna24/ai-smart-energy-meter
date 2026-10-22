
import { useState } from "react";
import { Zap, Eye, EyeOff, LoaderCircle } from "lucide-react";
import api from "./api";

export default function AuthPage({ onLogin }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = isRegister
        ? "/auth/register"
        : "/auth/login";

      const payload = isRegister
        ? { name, email, password }
        : { email, password };

      const response = await api.post(endpoint, payload);

      if (isRegister) {
        setIsRegister(false);
        setPassword("");
        setError("");
        alert("Account created successfully. Please log in.");
        return;
      }

      const token = response.data.token;

      if (!token) {
        throw new Error("The server did not return an authentication token.");
      }

      localStorage.setItem("token", token);
      onLogin();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl bg-white shadow-xl md:grid-cols-2">
        <div className="hidden flex-col justify-between bg-slate-900 p-10 text-white md:flex">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-emerald-500 p-3">
                <Zap size={26} />
              </div>
              <span className="text-xl font-bold">EnergyWise</span>
            </div>

            <h1 className="mt-20 text-4xl font-bold leading-tight">
              Understand your energy.
              <span className="text-emerald-400">
                {" "}Control your usage.
              </span>
            </h1>

            <p className="mt-5 leading-7 text-slate-300">
              Monitor electricity consumption, explore usage trends,
              estimate energy costs, and prepare for future demand.
            </p>
          </div>

          <p className="text-sm text-slate-400">
            Smart Energy Meter · IoT · Analytics
          </p>
        </div>

        <div className="p-7 sm:p-10">
          <div className="mb-8 flex items-center gap-3 md:hidden">
            <div className="rounded-xl bg-emerald-600 p-3 text-white">
              <Zap size={24} />
            </div>
            <span className="text-xl font-bold">EnergyWise</span>
          </div>

          <h2 className="text-3xl font-bold text-slate-900">
            {isRegister ? "Create account" : "Welcome back"}
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            {isRegister
              ? "Register to start monitoring your energy."
              : "Log in to view your energy dashboard."}
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-5">
            {isRegister && (
              <div>
                <label className="mb-2 block text-sm font-medium">
                  Full name
                </label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Your name"
                />
              </div>
            )}

            <div>
              <label className="mb-2 block text-sm font-medium">
                Email address
              </label>
              <input
                required
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium">
                Password
              </label>
              <div className="relative">
                <input
                  required
                  minLength={isRegister ? 8 : undefined}
                  type={showPassword ? "text" : "password"}
                  autoComplete={
                    isRegister ? "new-password" : "current-password"
                  }
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-12 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((value) => !value)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
              {isRegister && (
                <p className="mt-2 text-xs text-slate-500">
                  Use at least 8 characters.
                </p>
              )}
            </div>

            {error && (
              <div role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading && <LoaderCircle className="animate-spin" size={18} />}
              {loading
                ? "Please wait..."
                : isRegister
                  ? "Create account"
                  : "Log in"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            {isRegister
              ? "Already have an account?"
              : "Don't have an account?"}{" "}
            <button
              type="button"
              onClick={() => {
                setIsRegister((value) => !value);
                setError("");
                setPassword("");
              }}
              className="font-semibold text-emerald-700 hover:underline"
            >
              {isRegister ? "Log in" : "Register"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
