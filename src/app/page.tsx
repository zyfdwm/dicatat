"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight, PenTool, LayoutTemplate, Printer, Check, LogOut, LayoutDashboard } from "lucide-react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged, signOut, User } from "firebase/auth";

export default function LandingPage() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out", error);
    }
  };
  return (
    <div className="min-h-screen bg-[#FBFBFB] font-sans text-slate-900 selection:bg-black selection:text-white">

      {/* Navbar */}
      <nav className="w-full border-b border-slate-200 bg-[#FBFBFB]/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 md:h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded">
              <span className="font-bold text-sm tracking-tighter">D.</span>
            </div>
            <span className="text-xl font-bold tracking-tight">Dicatat</span>
          </div>
          <div className="flex items-center gap-4 md:gap-6">
            {!loading && (
              <>
                {user ? (
                  <>
                    <button
                      onClick={handleLogout}
                      className="text-sm font-bold text-slate-500 hover:text-red-600 transition-colors flex items-center gap-2"
                    >
                      <LogOut size={16} />
                      Keluar
                    </button>
                    <Link
                      href="/dashboard"
                      className="bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded text-sm font-bold transition-all shadow-sm flex items-center gap-2"
                    >
                      <LayoutDashboard size={16} />
                      Dashboard
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/login"
                      className="text-sm font-bold text-slate-600 hover:text-black transition-colors"
                    >
                      Masuk
                    </Link>
                    <Link
                      href="/login"
                      className="bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded text-sm font-bold transition-colors shadow-sm"
                    >
                      Mulai Gratis
                    </Link>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="max-w-6xl mx-auto px-6 pt-20 md:pt-32 pb-24">
        <div className="flex flex-col items-center text-center">
          <div className="border border-slate-200 rounded-full px-4 py-1.5 text-[10px] md:text-xs font-bold text-slate-500 uppercase tracking-[0.2em] mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            Bantu Freelancer Lebih Mudah
          </div>

          <h1 className="text-4xl md:text-7xl font-extrabold tracking-tighter leading-[1.05] max-w-4xl mb-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-150">
            Kelola Project & Invoice<br className="hidden md:block" />
            Jadi makin mudah
          </h1>

          <p className="text-base md:text-lg text-slate-500 max-w-2xl mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
            Dicatat - Platform pembuatan surat perjanjian kerja sama & cetak Invoice yang cepat, rapi, siap cetak, dan di desain khusus untuk freelancer agar tetap professional dan cepat.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 items-center animate-in fade-in slide-in-from-bottom-10 duration-1000 delay-500">
            {!loading && (
              <Link
                href={user ? "/dashboard" : "/login"}
                className="group bg-black hover:bg-slate-800 text-white px-8 py-4 rounded font-bold text-base transition-all flex items-center gap-2 shadow-lg hover:shadow-xl"
              >
                {user ? "Masuk ke Dashboard" : "Coba Sekarang Gratis"}
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            )}
            <a
              href="#features"
              className="px-8 py-4 rounded font-medium text-base text-slate-600 hover:text-black transition-colors"
            >
              Pelajari Fitur
            </a>
          </div>
        </div>

        {/* Minimalist Dashboard Preview */}
        <div className="w-full max-w-5xl mt-24 mx-auto animate-in fade-in zoom-in-95 duration-1000 delay-700">
          <div className="bg-white border border-slate-200 rounded-4xl overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.05)]">
            {/* Fake Browser Window Header */}
            <div className="h-10 border-b border-slate-100 bg-[#FBFBFB] flex items-center px-4 gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
              <div className="w-2.5 h-2.5 rounded-full bg-slate-200"></div>
            </div>
            {/* Fake App Layout */}
            <div className="flex flex-col md:flex-row h-[300px] md:h-[500px]">
              {/* Sidebar (Form Mockup) */}
              <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-100 p-6 flex flex-col gap-5 bg-white">
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <div className="h-2 w-20 bg-slate-200 rounded"></div>
                    <div className="h-9 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-3 text-[10px] font-medium text-slate-400">
                      Website Company Profile
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-16 bg-slate-200 rounded"></div>
                    <div className="h-9 w-full bg-slate-50 border border-slate-100 rounded-lg flex items-center px-3 text-[10px] font-medium text-slate-400">
                      PT. Teknologi Maju
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-2 w-24 bg-slate-200 rounded"></div>
                    <div className="h-20 w-full bg-slate-50 border border-slate-100 rounded-lg p-3 text-[10px] font-medium text-slate-400 leading-relaxed">
                      - Desain UI/UX<br />
                      - Pengembangan Frontend<br />
                      - Integrasi API
                    </div>
                  </div>
                </div>
                <div className="mt-auto h-10 w-full bg-black rounded-lg flex items-center justify-center text-[11px] font-bold text-white tracking-tight">
                  Simpan Project
                </div>
              </div>

              {/* Document Preview (Realistic SPK) */}
              <div className="flex-1 bg-slate-50 p-4 md:p-10 flex justify-center items-start overflow-hidden relative">
                <div className="absolute inset-0 bg-linear-to-b from-white via-transparent to-transparent opacity-50"></div>

                <div className="w-full max-w-md bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)] border border-slate-200 p-8 md:p-10 flex flex-col scale-90 md:scale-100 origin-top animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {/* Header */}
                  <div className="text-center mb-6 border-b border-slate-100 pb-6">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-900 mb-1">Surat Perjanjian Kerja Sama</h4>
                    <p className="text-[8px] font-bold text-slate-400 tracking-widest">NO: 2024/SPK/WEB-001</p>
                  </div>

                  {/* Parties */}
                  <div className="space-y-4 mb-6">
                    <div className="space-y-1">
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Pihak Pertama (Client)</p>
                      <p className="text-[10px] font-bold text-slate-900">PT. Teknologi Maju Utama</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-widest">Pihak Kedua (Freelancer)</p>
                      <p className="text-[10px] font-bold text-slate-900">Nama Anda</p>
                    </div>
                  </div>

                  {/* Pasal-Pasal */}
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-bold text-slate-900 uppercase">Pasal 1 - Lingkup Pekerjaan</p>
                      <p className="text-[8px] text-slate-500 leading-relaxed italic">"Pengembangan Website Company Profile dengan fitur dashboard admin dan integrasi payment gateway..."</p>
                    </div>
                    <div className="space-y-1.5">
                      <p className="text-[8px] font-bold text-slate-900 uppercase">Pasal 2 - Nilai Pekerjaan</p>
                      <p className="text-[12px] font-black text-black">Rp 12.500.000,00</p>
                    </div>
                  </div>

                  {/* Signatures */}
                  <div className="mt-auto pt-10 flex justify-between">
                    <div className="text-center">
                      <div className="h-px w-20 bg-slate-200 mb-2"></div>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Pihak Pertama</p>
                    </div>
                    <div className="text-center">
                      <div className="h-px w-20 bg-slate-200 mb-2"></div>
                      <p className="text-[7px] font-bold text-slate-400 uppercase tracking-tighter">Pihak Kedua</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="w-full bg-white border-t border-slate-200 py-24 md:py-32">
        <div className="max-w-6xl mx-auto px-6">
          <div className="mb-20 text-center md:text-left">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight mb-4">Cetak SPK dan Invoice dengan mudah.</h2>
            <p className="text-slate-500 max-w-xl text-base md:text-lg">
              Tools sederhana yang bantu freelancer untuk mempermudah dan mempercepat hambatan administratif.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-16 md:gap-12">
            <div className="flex flex-col group">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:-translate-y-1">
                <PenTool size={20} />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">Manajemen Agreement</h3>
              <p className="text-slate-500 leading-relaxed text-sm md:text-base">
                Tidak ada lagi kontrak yang berceceran. Simpan semua draf SPK, termin pembayaran, dan detail client di satu tempat yang aman.
              </p>
            </div>

            <div className="flex flex-col group">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:-translate-y-1">
                <LayoutTemplate size={20} />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">Otomatisasi Dokumen</h3>
              <p className="text-slate-500 leading-relaxed text-sm md:text-base">
                Isi form di sebelah kiri, dan lihat dokumen kontrak kerja profesional terbentuk seketika di sebelah kanan. Tanpa *copy-paste* manual.
              </p>
            </div>

            <div className="flex flex-col group">
              <div className="w-12 h-12 bg-black text-white rounded-xl flex items-center justify-center mb-6 transition-transform group-hover:-translate-y-1">
                <Printer size={20} />
              </div>
              <h3 className="text-xl font-bold mb-3 tracking-tight">Langsung Cetak</h3>
              <p className="text-slate-500 leading-relaxed text-sm md:text-base">
                Layout cetak telah disesuaikan dengan standar surat resmi. Bersih, tanpa elemen antarmuka yang ikut tercetak.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="w-full py-24 md:py-32 px-6">
        <div className="max-w-4xl mx-auto bg-black rounded-4xl p-8 md:p-16 text-center text-white relative overflow-hidden">
          <div className="relative z-10">
            <h2 className="text-3xl md:text-5xl font-bold tracking-tight mb-6">Siap untuk naik level?</h2>
            <p className="text-slate-400 text-base md:text-lg max-w-xl mx-auto mb-10">
              Bergabung dengan ratusan freelancer profesional lainnya yang sudah menggunakan Dicatat untuk mempermudah pekerjaan mereka.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 bg-white text-black px-8 py-4 rounded-full font-bold text-base hover:bg-slate-100 transition-all shadow-xl hover:scale-105"
            >
              Mulai Sekarang Gratis
              <ArrowRight size={18} />
            </Link>
          </div>
          {/* Subtle decoration */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl"></div>
        </div>
      </section>

      {/* Footer */}
      <footer className="w-full bg-[#FBFBFB] border-t border-slate-200 py-12 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded">
                  <span className="font-bold text-sm tracking-tighter">D.</span>
                </div>
                <span className="text-xl font-bold tracking-tight">Dicatat</span>
              </div>
              <p className="text-slate-500 text-sm max-w-xs leading-relaxed">
                Smart Agreement Builder untuk freelancer. Bantu kamu bikin kontrak dan SPK profesional cuma dalam hitungan menit.
              </p>
            </div>
            <div className="flex gap-12">
              <div className="flex flex-col gap-4 text-sm">
                <span className="font-bold uppercase tracking-widest text-[10px] text-slate-400">Product</span>
                <Link href="/dashboard" className="text-slate-600 hover:text-black transition-colors">Dashboard</Link>
                <Link href="#" className="text-slate-600 hover:text-black transition-colors">Features</Link>
                <Link href="#" className="text-slate-600 hover:text-black transition-colors">Pricing</Link>
              </div>
              <div className="flex flex-col gap-4 text-sm">
                <span className="font-bold uppercase tracking-widest text-[10px] text-slate-400">Legal</span>
                <Link href="#" className="text-slate-600 hover:text-black transition-colors">Privacy</Link>
                <Link href="#" className="text-slate-600 hover:text-black transition-colors">Terms</Link>
              </div>
            </div>
          </div>
          <div className="mt-20 pt-8 border-t border-slate-100 flex flex-col md:flex-row justify-between gap-4 text-slate-400 text-[10px] md:text-xs font-medium">
            <p>&copy; {new Date().getFullYear()} DICATAT. ALL RIGHTS RESERVED.</p>
            <div className="flex gap-6">
              <p>DIBUAT DENGAN SEMANGAT OLEH FREELANCER</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
