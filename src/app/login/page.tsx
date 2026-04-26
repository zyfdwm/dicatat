"use client";

import { useState } from "react";
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signInWithPopup, 
  GoogleAuthProvider 
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useRouter } from "next/navigation";
import { 
  Mail, 
  Lock, 
  ArrowRight, 
  Globe, 
  CheckCircle, 
  AlertCircle 
} from "lucide-react";
import Link from "next/link";

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (isLogin) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }
      router.push("/dashboard");
    } catch (err: any) {
      console.error("Auth Error:", err.code);
      
      if (isLogin) {
        // Pesan error khusus login
        if (err.code === "auth/user-not-found" || err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
          setError("Email atau password belum terdaftar / salah.");
        } else if (err.code === "auth/too-many-requests") {
          setError("Terlalu banyak percobaan. Coba lagi nanti.");
        } else {
          setError("Gagal masuk. Pastikan akun sudah benar.");
        }
      } else {
        // Pesan error khusus daftar
        if (err.code === "auth/email-already-in-use") {
          setError("Email sudah terdaftar. Silakan masuk.");
        } else if (err.code === "auth/weak-password") {
          setError("Password terlalu lemah (min. 6 karakter).");
        } else {
          setError("Gagal membuat akun. Coba lagi.");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
      router.push("/dashboard");
    } catch (err: any) {
      setError(err.message || "Gagal login dengan Google.");
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBFB] flex flex-col justify-center items-center p-6 font-sans selection:bg-black selection:text-white">
      {/* Logo */}
      <Link href="/" className="flex items-center gap-3 mb-12 group">
        <div className="w-10 h-10 bg-black text-white flex items-center justify-center rounded-xl transition-transform group-hover:rotate-6">
          <span className="font-bold text-lg tracking-tighter">D.</span>
        </div>
        <span className="text-2xl font-black tracking-tighter">Dicatat</span>
      </Link>

      <div className="w-full max-w-md bg-white border border-slate-200 rounded-3xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-500">
        <div className="p-8 md:p-10">
          <div className="text-center mb-10">
            <h1 className="text-2xl font-black tracking-tight mb-3">
              {isLogin ? "Selamat Datang Kembali" : "Buat Akun Baru"}
            </h1>
            <p className="text-slate-500 text-sm">
              {isLogin 
                ? "Kelola project freelance kamu dengan lebih profesional." 
                : "Mulai kelola invoice dan SPK kamu secara terorganisir."}
            </p>
          </div>

          <form onSubmit={handleAuth} className="space-y-5">
            {error && (
              <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 text-xs font-bold animate-in shake-1 duration-300">
                <AlertCircle size={16} />
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Mail size={14} />
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@kamu.com"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Lock size={14} />
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3.5 border border-slate-200 rounded-2xl focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            <button
              disabled={loading}
              className="w-full bg-black hover:bg-slate-800 text-white py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 mt-4 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isLogin ? "Masuk ke Dashboard" : "Daftar Sekarang"}
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
          </form>

          <div className="relative my-10">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] font-bold uppercase tracking-widest">
              <span className="bg-white px-4 text-slate-400">Atau gunakan</span>
            </div>
          </div>

          <button
            onClick={handleGoogleSignIn}
            className="w-full bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 py-3.5 rounded-2xl font-bold transition-all flex items-center justify-center gap-3 text-sm"
          >
            <Globe size={18} />
            Lanjutkan dengan Google
          </button>
        </div>

        <div className="p-6 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-xs font-bold text-slate-500 hover:text-black transition-colors"
          >
            {isLogin 
              ? "Belum punya akun? Daftar gratis" 
              : "Sudah punya akun? Masuk di sini"}
          </button>
        </div>
      </div>

      <div className="mt-12 flex items-center gap-8 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
        <div className="flex items-center gap-2">
          <CheckCircle size={12} className="text-emerald-500" />
          Data Aman
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={12} className="text-emerald-500" />
          Multi-Device
        </div>
        <div className="flex items-center gap-2">
          <CheckCircle size={12} className="text-emerald-500" />
          Simple SPK
        </div>
      </div>
    </div>
  );
}
