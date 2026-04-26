"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import {
  Printer, FileText, Briefcase, User as UserIcon, DollarSign, Calendar, Clock,
  CreditCard, AlignLeft, CheckCircle, Save, Plus, ArrowLeft, Trash2, Edit, ReceiptText, Eye, ChevronDown, Upload, TrendingUp, BarChart3, Activity
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, Cell
} from "recharts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { UploadButton } from "@/lib/uploadthing";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  query,
  where,
  serverTimestamp,
  writeBatch
} from "firebase/firestore";

type Project = {
  id: string;
  userId?: string;
  projectName: string;
  clientName: string;
  freelancerName: string;
  price: string;
  paymentMethod: string;
  paymentDetails: string;
  description: string;
  status: string;
  duration: string;
  date: string;
  paidTermins?: { num: number; proof: string }[]; // Track which installments are paid with proof
  isDPPaid?: boolean;
  dpProof?: string;
  isRemainingPaid?: boolean;
  remainingProof?: string;
  isPaid?: boolean;
  fullProof?: string;
};

const defaultForm: Omit<Project, "id"> = {
  projectName: "",
  clientName: "",
  freelancerName: "",
  price: "",
  paymentMethod: "Pembayaran Penuh (Full Payment)",
  paymentDetails: "",
  description: "",
  status: "Ongoing",
  duration: "",
  date: format(new Date(), "yyyy-MM-dd"),
};

const formatDisplayDate = (dateStr: string) => {
  try {
    if (dateStr && dateStr.includes("-")) {
      return format(new Date(dateStr), "dd MMMM yyyy");
    }
    return dateStr || format(new Date(), "dd MMMM yyyy");
  } catch (e) {
    return dateStr;
  }
};

export default function Dashboard() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [view, setView] = useState<"LIST" | "FORM" | "PREVIEW" | "INVOICE" | "SELECT_INVOICE">("LIST");
  const [activeTab, setActiveTab] = useState<"projects" | "clients" | "reports">("projects");
  const [uploadingProgress, setUploadingProgress] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState<Project | Omit<Project, "id">>(defaultForm);
  const [selectedTermin, setSelectedTermin] = useState<number | null>(null);
  const [isDPInvoice, setIsDPInvoice] = useState(false);
  const [isRemainingInvoice, setIsRemainingInvoice] = useState(false);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);
  const [dashboardTab, setDashboardTab] = useState<"PROJECT" | "GRAPHIC">("PROJECT");
  const [isMounted, setIsMounted] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  // Authentication & Real-time Data
  useEffect(() => {
    setIsMounted(true);

    const unsubAuth = onAuthStateChanged(auth, (currentUser) => {
      setAuthLoading(false);
      if (!currentUser) {
        router.push("/login");
      } else {
        setUser(currentUser);
      }
    });

    const handleClickOutside = () => setOpenDropdownId(null);
    window.addEventListener("click", handleClickOutside);

    return () => {
      unsubAuth();
      window.removeEventListener("click", handleClickOutside);
    };
  }, [router]);

  // Firestore Sync & Local Migration
  useEffect(() => {
    if (!user) return;

    // 1. Sync from Firestore
    const q = query(collection(db, "projects"), where("userId", "==", user.uid));
    const unsubFirestore = onSnapshot(q, (snapshot) => {
      const projs = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Project));
      setProjects(projs);

      // 2. Local Migration (If first time login and local data exists)
      const stored = localStorage.getItem("dicatat_projects");
      if (stored && projs.length === 0) {
        try {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const batch = writeBatch(db);
            parsed.forEach((p) => {
              const { id, ...cleanData } = p;
              const newRef = doc(collection(db, "projects"));
              batch.set(newRef, {
                ...cleanData,
                userId: user.uid,
                createdAt: serverTimestamp()
              });
            });
            batch.commit().then(() => {
              localStorage.removeItem("dicatat_projects");
            });
          }
        } catch (e) {
          console.error("Migration failed", e);
        }
      }
    });

    return () => unsubFirestore();
  }, [user]);

  const handlePrint = () => {
    window.print();
  };

  const parsePrice = (priceStr: string) => {
    return parseFloat(priceStr.replace(/\./g, "").replace(/,/g, ".")) || 0;
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("id-ID").format(Math.round(price));
  };

  const getPaymentBreakdown = () => {
    const total = parsePrice(formData.price || "0");
    const details = formData.paymentDetails || "";

    // Base object with defaults to satisfy TypeScript
    const result = {
      type: "FULL",
      total,
      dp: 0,
      remaining: 0,
      percent: "0%",
      count: 1,
      perTermin: total,
      isTerminInvoice: false,
      currentTermin: 0,
      isDPInvoice: isDPInvoice,
      isRemainingInvoice: isRemainingInvoice
    };

    if (formData.paymentMethod === "Pembayaran Sebagian (Down Payment)") {
      let dpAmount = 0;
      let percentStr = "";
      if (details.includes("%")) {
        const p = parseFloat(details.replace("%", "")) || 0;
        dpAmount = total * (p / 100);
        percentStr = `${p}%`;
      } else {
        dpAmount = parsePrice(details);
        percentStr = total > 0 ? `${Math.round((dpAmount / total) * 100)}%` : "0%";
      }
      return { ...result, type: "DP", dp: dpAmount, remaining: total - dpAmount, percent: percentStr };
    }

    if (formData.paymentMethod === "Pembayaran Bertahap (Termin)") {
      const terminMatch = details.match(/(\d+)/);
      const c = terminMatch ? parseInt(terminMatch[0]) : 1;
      return {
        ...result,
        type: "TERMIN",
        count: c,
        perTermin: total / (c || 1),
        isTerminInvoice: !!selectedTermin,
        currentTermin: selectedTermin || 0
      };
    }

    return result;
  };

  const getPaymentBreakdownForProject = (p: Project) => {
    const total = parsePrice(p.price || "0");
    const details = p.paymentDetails || "";

    const base = {
      type: "FULL",
      total,
      count: 1,
      perTermin: total,
      dp: 0,
      remaining: 0
    };

    if (p.paymentMethod === "Pembayaran Sebagian (Down Payment)") {
      let dpAmount = 0;
      if (details.includes("%")) {
        const pVal = parseFloat(details.replace("%", "")) || 0;
        dpAmount = total * (pVal / 100);
      } else {
        dpAmount = parsePrice(details);
      }
      return { ...base, type: "DP", dp: dpAmount, remaining: total - dpAmount };
    }

    if (p.paymentMethod === "Pembayaran Bertahap (Termin)") {
      const terminMatch = details.match(/(\d+)/);
      const c = terminMatch ? parseInt(terminMatch[0]) : 1;
      return { ...base, type: "TERMIN", count: c, perTermin: total / (c || 1) };
    }

    return base;
  };

  const calculateEarnedAmount = (p: Project) => {
    const b = getPaymentBreakdownForProject(p);
    if (b.type === "FULL") {
      return (p.isPaid || p.status === "Done") ? b.total : 0;
    }
    if (b.type === "DP") {
      let earned = 0;
      if (p.isDPPaid) earned += b.dp;
      if (p.isRemainingPaid) earned += b.remaining;
      return earned;
    }
    if (b.type === "TERMIN") {
      return (p.paidTermins?.length || 0) * b.perTermin;
    }
    return 0;
  };

  const toggleTerminPaid = async (projectId: string, terminNum: number, proof?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const currentPaid = project.paidTermins || [];
    const isPaid = currentPaid.some(item => item.num === terminNum);

    let newPaidTermins = isPaid
      ? currentPaid.filter(item => item.num !== terminNum)
      : [...currentPaid, { num: terminNum, proof: proof || "file_terlampir.pdf" }];

    const b = getPaymentBreakdownForProject(project);
    const isAllPaid = newPaidTermins.length === b.count;

    await updateDoc(doc(db, "projects", projectId), {
      paidTermins: newPaidTermins,
      status: isAllPaid ? "Done" : (project.status === "Done" ? "Ongoing" : project.status)
    });
  };

  const handleFullPaid = async (projectId: string, proof?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newPaid = !project.isPaid;
    await updateDoc(doc(db, "projects", projectId), {
      isPaid: newPaid,
      fullProof: newPaid ? (proof || "bukti_full.pdf") : undefined,
      status: newPaid ? "Done" : (project.status === "Done" ? "Ongoing" : project.status)
    });
  };

  const handleDPPaid = async (projectId: string, proof?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newDPPaid = !project.isDPPaid;
    const isAllPaid = newDPPaid && project.isRemainingPaid;
    await updateDoc(doc(db, "projects", projectId), {
      isDPPaid: newDPPaid,
      dpProof: newDPPaid ? (proof || "bukti_dp.pdf") : undefined,
      status: isAllPaid ? "Done" : (project.status === "Done" ? "Ongoing" : project.status)
    });
  };

  const handleRemainingPaid = async (projectId: string, proof?: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newRemPaid = !project.isRemainingPaid;
    const isAllPaid = newRemPaid && project.isDPPaid;
    await updateDoc(doc(db, "projects", projectId), {
      isRemainingPaid: newRemPaid,
      remainingProof: newRemPaid ? (proof || "bukti_pelunasan.pdf") : undefined,
      status: isAllPaid ? "Done" : (project.status === "Done" ? "Ongoing" : project.status)
    });
  };

  const handlePrintTermin = (project: Project, terminNum: number) => {
    setFormData(project);
    setSelectedTermin(terminNum);
    setIsDPInvoice(false);
    setIsRemainingInvoice(false);
    setView("INVOICE");
  };

  const handlePrintDP = (project: Project, type: "DP" | "REMAINING") => {
    setFormData(project);
    setSelectedTermin(null);
    setIsDPInvoice(type === "DP");
    setIsRemainingInvoice(type === "REMAINING");
    setView("INVOICE");
  };

  const handleInvoice = (project: Project) => {
    setFormData(project);
    setSelectedTermin(null);
    setIsDPInvoice(false);
    setIsRemainingInvoice(false);
    setView("SELECT_INVOICE");
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;

    if (name === "price") {
      const numericValue = value.replace(/\D/g, "");
      const formattedValue = numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
      setFormData((prev) => ({ ...prev, [name]: formattedValue }));
      return;
    }

    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e?: React.FormEvent | React.MouseEvent) => {
    if (e) e.preventDefault();
    if (!user) return;

    try {
      if ("id" in formData) {
        // Edit existing
        const { id, ...updateData } = formData;
        await updateDoc(doc(db, "projects", id), updateData);
      } else {
        // Add new
        await addDoc(collection(db, "projects"), {
          ...formData,
          userId: user.uid,
          createdAt: serverTimestamp()
        });
      }
      setFormData(defaultForm);
      setView("LIST");
    } catch (e) {
      console.error("Error saving project", e);
      alert("Gagal menyimpan data ke cloud.");
    }
  };


  const handleCreateNew = () => {
    setFormData({ ...defaultForm, date: format(new Date(), "yyyy-MM-dd") });
    setView("FORM");
  };

  const handleEdit = (project: Project) => {
    setFormData(project);
    setView("FORM");
  };

  const handlePreview = (project: Project) => {
    setFormData(project);
    setView("PREVIEW");
  };


  const handleDelete = async (id: string) => {
    if (confirm("Apakah kamu yakin ingin menghapus project ini secara permanen?")) {
      try {
        await deleteDoc(doc(db, "projects", id));
        // State projects akan terupdate otomatis lewat onSnapshot di useEffect
      } catch (e) {
        console.error("Error deleting", e);
        alert("Gagal menghapus project.");
      }
    }
  };

  const updateProjectStatus = async (id: string, newStatus: string) => {
    try {
      await updateDoc(doc(db, "projects", id), { status: newStatus });
    } catch (e) {
      console.error("Error updating status", e);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Done": return "bg-emerald-50 text-emerald-700 border border-emerald-100";
      case "Ongoing": return "bg-amber-50 text-amber-700 border border-amber-100";
      case "Not Started": return "bg-slate-50 text-slate-500 border border-slate-100";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  const getChartData = () => {
    // Get last 6 months
    const last6Months = Array.from({ length: 6 }).map((_, i) => {
      const d = new Date();
      d.setMonth(d.getMonth() - (5 - i));
      return {
        month: format(d, "MMM"),
        fullName: format(d, "MMMM yyyy"),
        projects: 0,
        revenue: 0,
        completed: 0,
        onGoing: 0
      };
    });

    projects.forEach(p => {
      try {
        const pDate = new Date(p.date);
        const m = format(pDate, "MMM");
        const f = format(pDate, "MMMM yyyy");
        const dataPoint = last6Months.find(d => d.month === m && d.fullName === f) ||
          last6Months.find(d => d.month === m);

        if (dataPoint) {
          dataPoint.projects += 1;
          const priceVal = parsePrice(p.price);
          dataPoint.revenue += priceVal;
          if (p.status === "Done") {
            dataPoint.completed += 1;
          } else if (p.status === "Ongoing") {
            dataPoint.onGoing += 1;
          }
        }
      } catch (e) {
        // ignore invalid dates
      }
    });

    return last6Months;
  };

  const stats = {
    total: projects.length,
    done: projects.filter(p => p.status === "Done").length,
    onGoing: projects.filter(p => p.status === "Ongoing").length,
    totalRevenue: projects.reduce((acc, p) => acc + parsePrice(p.price), 0),
    earnedRevenue: projects.reduce((acc, p) => acc + calculateEarnedAmount(p), 0),
  };

  if (!isMounted) return null;

  // Reusable Document Preview component
  const InvoicePaper = () => (
    <div className="max-w-[210mm] mx-auto bg-white shadow-xl print-paper text-slate-900 text-[15px] leading-relaxed print:shadow-none print:max-w-none font-sans print:font-sans overflow-hidden">
      <div className="p-10 md:p-16 print:p-16 flex flex-col min-h-[inherit]">
        <div className="flex justify-between items-start mb-10">
          <div>
            <h1 className="text-4xl font-bold tracking-tighter mb-2 uppercase">Invoice</h1>
            <p className="text-slate-500 font-bold text-sm tracking-widest">
              #{("id" in formData ? formData.id : "").slice(-6) || "000000"}
              {(() => {
                const b = getPaymentBreakdown();
                if (b.isTerminInvoice) return ` / T${b.currentTermin}`;
                if (b.isDPInvoice) return ` / DP`;
                if (b.isRemainingInvoice) return ` / LUNAS`;
                return "";
              })()}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-1">Tanggal Tagihan</p>
            <p className="text-black font-bold text-base tracking-tight">{formatDisplayDate(new Date().toISOString())}</p>
          </div>
        </div>

        {/* Bill To */}
        <div className="mb-10">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-2">Ditujukan Kepada:</p>
          <h3 className="font-bold text-xl tracking-tight mb-1">{formData.clientName || "[Nama Client]"}</h3>
          <p className="text-slate-500 text-sm font-medium">Project: {formData.projectName || "[Nama Project]"}</p>
        </div>

        {/* Invoice Table */}
        <div className="mb-16">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-black">
                <th className="py-4 text-xs font-bold uppercase tracking-[0.2em]">Rincian Pekerjaan / Layanan</th>
              </tr>
            </thead>
            <tbody>
              {formData.description ? (
                formData.description.split("\n").filter(l => l.trim() !== "").map((line, idx) => (
                  <tr key={idx} className="border-b border-slate-100">
                    <td className="py-3.5 text-slate-700 font-medium">{line}</td>
                  </tr>
                ))
              ) : (
                <tr className="border-b border-slate-100">
                  <td className="py-5 text-slate-400 italic">Pekerjaan: {formData.projectName}</td>
                </tr>
              )}
            </tbody>
          </table>
          <div className="mt-8 text-right space-y-4">
            {/* Payment breakdown logic */}
            {(() => {
              const b = getPaymentBreakdown();
              if (b.type === "DP") {
                if (b.isDPInvoice) {
                  return (
                    <div className="space-y-1 pb-2 border-b border-slate-100">
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        {/* <span className="text-[10px] font-bold uppercase tracking-widest">Keterangan</span> */}
                        <span className="font-bold text-sm text-black">Tagihan Uang Muka (DP {b.percent})</span>
                      </div>
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Total Project</span>
                        <span className="font-bold text-sm text-slate-400">Rp {formData.price}</span>
                      </div>
                    </div>
                  );
                }
                if (b.isRemainingInvoice) {
                  return (
                    <div className="space-y-1 pb-2 border-b border-slate-100">
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Keterangan</span>
                        <span className="font-bold text-sm text-black">Tagihan Pelunasan Project</span>
                      </div>
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Sudah Dibayar (DP)</span>
                        <span className="font-bold text-sm text-slate-400">Rp {formatPrice(b.dp)}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1">
                    <div className="flex justify-end items-center gap-4 text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Uang Muka (DP {b.percent})</span>
                      <span className="font-bold text-sm">Rp {formatPrice(b.dp)}</span>
                    </div>
                    <div className="flex justify-end items-center gap-4 text-slate-500 pb-2 border-b border-slate-100">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Sisa Pelunasan</span>
                      <span className="font-bold text-sm">Rp {formatPrice(b.remaining)}</span>
                    </div>
                  </div>
                );
              }
              if (b.type === "TERMIN") {
                if (b.isTerminInvoice) {
                  return (
                    <div className="space-y-1 pb-2 border-b border-slate-100">
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        {/* <span className="text-[10px] font-bold uppercase tracking-widest">Keterangan</span> */}
                        <span className="font-bold text-sm">Pembayaran ke-{b.currentTermin} dari {b.count}</span>
                      </div>
                      <div className="flex justify-end items-center gap-4 text-slate-500">
                        <span className="text-[10px] font-bold uppercase tracking-widest">Total Pembayaran</span>
                        <span className="font-bold text-sm text-slate-400">Rp {formData.price}</span>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="space-y-1 pb-2 border-b border-slate-100">
                    <div className="flex justify-end items-center gap-4 text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Jumlah Termin</span>
                      <span className="font-bold text-sm">{b.count}x</span>
                    </div>
                    <div className="flex justify-end items-center gap-4 text-slate-500">
                      <span className="text-[10px] font-bold uppercase tracking-widest">Per Termin</span>
                      <span className="font-bold text-sm">Rp {formatPrice(b.perTermin)}</span>
                    </div>
                  </div>
                );
              }
              return null;
            })()}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-slate-400 mb-1">
                {(() => {
                  const b = getPaymentBreakdown();
                  if (b.isTerminInvoice) return `Tagihan Termin ${b.currentTermin}`;
                  if (b.isDPInvoice) return `Tagihan Uang Muka`;
                  if (b.isRemainingInvoice) return `Tagihan Pelunasan`;
                  return "Total Tagihan";
                })()}
              </p>
              <p className="text-3xl font-bold tracking-tighter text-black">
                Rp {(() => {
                  const b = getPaymentBreakdown();
                  if (b.isTerminInvoice) return formatPrice(b.perTermin);
                  if (b.isDPInvoice) return formatPrice(b.dp);
                  if (b.isRemainingInvoice) return formatPrice(b.remaining);
                  return (formData.price || "0");
                })()}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto pt-8 border-t-2 border-black flex justify-between items-end">
          <div className="space-y-4 text-left">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Metode Pembayaran</p>
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-black uppercase tracking-tight">Bank BCA</p>
              <p className="text-2xl font-bold tracking-tighter text-black">5475 5175 87</p>
              <p className="text-xs font-medium text-slate-500">a/n Faiz Dawami</p>
            </div>
          </div>

          <div className="text-center min-w-[200px]">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em] mb-16">Hormat Kami</p>
            <div className="border-t border-black pt-3">
              <p className="font-semibold text-black tracking-tight">{formData.freelancerName || "[Nama Freelancer]"}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const DocumentPaper = () => (
    <div className="max-w-[210mm] mx-auto bg-white shadow-xl print-paper text-slate-900 text-[14px] leading-relaxed print:shadow-none print:max-w-none font-sans print:font-sans overflow-hidden">
      <div className="p-8 md:p-12 print:p-12 flex flex-col min-h-[inherit]">
        {/* Header */}
        <div className="text-center mb-6">
          <h2 className="text-base md:text-lg font-bold uppercase tracking-wide mb-1 text-black">Surat Perjanjian Kerja Sama</h2>
          <div className="w-16 h-0.5 bg-slate-900 mx-auto"></div>
        </div>

        {/* Content */}
        <div className="mb-6 space-y-3">
          <p>
            Pada <strong>{formatDisplayDate(formData.date)}</strong>, telah disepakati perjanjian kerja sama antara:
          </p>

          <table className="w-full mt-4 mb-2">
            <tbody>
              <tr>
                <td className="w-8 font-medium align-top">I.</td>
                <td className="w-40 font-medium align-top">Client</td>
                <td className="w-4 align-top">:</td>
                <td className="align-top font-semibold">{formData.clientName || "[Nama Client]"}</td>
              </tr>
              <tr>
                <td></td>
                <td className="align-top text-slate-700" colSpan={3}>Selanjutnya dalam perjanjian ini disebut sebagai <strong>PIHAK PERTAMA</strong>.</td>
              </tr>
            </tbody>
          </table>

          <table className="w-full mb-6">
            <tbody>
              <tr>
                <td className="w-8 font-medium align-top">II.</td>
                <td className="w-40 font-medium align-top">Freelancer</td>
                <td className="w-4 align-top">:</td>
                <td className="align-top font-semibold">{formData.freelancerName || "[Nama Freelancer]"}</td>
              </tr>
              <tr>
                <td></td>
                <td className="align-top text-slate-700" colSpan={3}>Selanjutnya dalam perjanjian ini disebut sebagai <strong>PIHAK KEDUA</strong>.</td>
              </tr>
            </tbody>
          </table>

          <p className="mt-4">
            Kedua belah pihak sepakat untuk mengikatkan diri dalam Perjanjian Kerja Sama Freelance dengan ketentuan dan syarat-syarat yang diatur dalam pasal-pasal berikut:
          </p>
        </div>

        <div className="space-y-4 text-justify">
          <section>
            <h3 className="font-bold mb-2 text-black">PASAL 1 - RUANG LINGKUP PEKERJAAN</h3>
            <p>
              <b>PIHAK PERTAMA</b> memberikan tugas kepada <b>PIHAK KEDUA</b>, dan <b>PIHAK KEDUA</b> menyatakan bersedia menerima tugas tersebut untuk melaksanakan pekerjaan berupa <strong>{formData.projectName || "[Nama Project]"}</strong>. Detail rincian deskripsi pekerjaan yang akan diselesaikan adalah sebagai berikut:
            </p>
            {formData.description ? (
              <ul className="list-disc pl-6 mt-3 mb-2 space-y-1.5 text-slate-900">
                {formData.description.split("\n").filter((line) => line.trim() !== "").map((line, idx) => (
                  <li key={idx} className="pl-1">{line}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-slate-400 mt-3 mb-2 block">Belum ada deskripsi pekerjaan.</span>
            )}
          </section>

          <section>
            <h3 className="font-bold mb-2 text-black">PASAL 2 - JANGKA WAKTU & STATUS PEKERJAAN</h3>
            <p>
              Pekerjaan ini disepakati untuk dikerjakan dalam jangka waktu <strong>{formData.duration || "[Lama Pekerjaan]"}</strong> sejak dimulainya proyek. Saat dokumen ini dicetak, dan proyek sedang dalam status <strong>{formData.status}</strong>.
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2 text-black uppercase text-xs tracking-wider">PASAL 3 - NILAI PEKERJAAN & PEMBAYARAN</h3>
            <p>
              Kedua belah pihak sepakat bahwa nilai total imbalan atas pekerjaan ini adalah sebesar <strong>Rp {formData.price || "[Harga Pekerjaan]"}</strong>. Pembayaran akan dilakukan
              {(() => {
                const b = getPaymentBreakdown();
                if (b.type === "DP") {
                  return (
                    <span> dengan sistem <strong>Down Payment (DP)</strong> sebesar <strong>{b.percent} (Rp {formatPrice(b.dp)})</strong> sebagai tanda jadi, dan sisa pelunasan sebesar <strong>Rp {formatPrice(b.remaining)}</strong> akan dibayarkan setelah seluruh pekerjaan dinyatakan selesai.</span>
                  );
                }
                if (b.type === "TERMIN") {
                  return (
                    <span> dengan sistem <strong>Pembayaran Bertahap (Termin)</strong> sebanyak <strong>{b.count} kali</strong> pembayaran, dengan nilai per termin sebesar <strong>Rp {formatPrice(b.perTermin)}</strong> yang dibayarkan sesuai jadwal yang disepakati.</span>
                  );
                }
                return (
                  <span> <strong>secara penuh (Full Payment)</strong> sebelum pekerjaan dimulai atau sesuai dengan kesepakatan tertulis yang telah disetujui bersama.</span>
                );
              })()}
            </p>
          </section>

          <section>
            <h3 className="font-bold mb-2 text-black">PASAL 4 - PENUTUP</h3>
            <p>
              Demikian Surat Perjanjian Kerja Sama ini dibuat dalam keadaan sadar, tanpa ada paksaan dari pihak manapun, dan disepakati bersama oleh kedua belah pihak. Perjanjian ini berlaku sejak tanggal ditandatangani.
            </p>
          </section>
        </div>

        <div className="mt-auto pt-8 flex flex-row justify-between items-end gap-2 px-0 md:px-4">
          <div className="text-center w-1/2 min-w-0">
            <p className="mb-10 md:mb-14 font-semibold text-black uppercase text-[9px] md:text-[10px] tracking-widest">Pihak Pertama</p>
            <div className="border-b-2 border-black w-full max-w-[160px] mx-auto mb-2"></div>
            <p className="font-semibold text-black tracking-tight text-xs md:text-sm truncate px-1">{formData.clientName || "[Nama Client]"}</p>
          </div>
          <div className="text-center w-1/2 min-w-0">
            <p className="mb-10 md:mb-14 font-semibold text-black uppercase text-[9px] md:text-[10px] tracking-widest">Pihak Kedua</p>
            <div className="border-b-2 border-black w-full max-w-[160px] mx-auto mb-2"></div>
            <p className="font-semibold text-black tracking-tight text-xs md:text-sm truncate px-1">{formData.freelancerName || "[Nama Freelancer]"}</p>
          </div>
        </div>
      </div>
    </div>
  );

  // ================= VIEW: LIST (DASHBOARD) =================
  if (view === "LIST") {
    return (
      <div className="min-h-screen bg-[#FBFBFB] font-sans selection:bg-black selection:text-white">
        {/* Dashboard Header */}
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="max-w-6xl mx-auto px-6 h-16 md:h-20 flex justify-between items-center">
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-8 h-8 bg-black text-white flex items-center justify-center rounded transition-transform group-hover:rotate-3">
                <span className="font-bold text-sm tracking-tighter">D.</span>
              </div>
              <span className="text-xl font-bold tracking-tight">Dicatat</span>
            </Link>
            <div className="flex items-center gap-2 md:gap-3">
              <button
                onClick={() => setView("SELECT_INVOICE")}
                className="bg-white hover:bg-slate-50 text-slate-900 px-4 md:px-5 py-2 md:py-2.5 rounded text-sm font-bold border border-slate-200 transition-all flex items-center gap-2"
              >
                <ReceiptText size={18} />
                <span className="hidden md:inline">Cetak Invoice</span>
              </button>
              <button
                onClick={handleCreateNew}
                className="bg-black hover:bg-slate-800 text-white px-4 md:px-5 py-2 md:py-2.5 rounded text-sm font-bold transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                <span className="hidden md:inline">Tambah Project</span>
                <span className="md:hidden">Tambah</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-6xl mx-auto px-6 py-10 md:py-16">
          <div className="mb-10">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-2">Project Saya</h1>
            <p className="text-slate-500 text-sm md:text-base">Kelola dan atur project dan Invoice pekerjaanmu dalam satu tempat.</p>
          </div>

          {/* Tab Switcher */}
          <div className="flex gap-8 border-b border-slate-200 mb-8 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setDashboardTab("PROJECT")}
              className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${dashboardTab === "PROJECT" ? "text-black" : "text-slate-400 hover:text-slate-600"}`}
            >
              Daftar Project
              {dashboardTab === "PROJECT" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black animate-in fade-in slide-in-from-left-2" />}
            </button>
            <button
              onClick={() => setDashboardTab("GRAPHIC")}
              className={`pb-4 text-sm font-bold transition-all relative whitespace-nowrap ${dashboardTab === "GRAPHIC" ? "text-black" : "text-slate-400 hover:text-slate-600"}`}
            >
              Statistik & Grafik
              {dashboardTab === "GRAPHIC" && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-black animate-in fade-in slide-in-from-right-2" />}
            </button>
          </div>

          {dashboardTab === "GRAPHIC" && (
            <>
              {/* Stats Overview */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400">
                      <Briefcase size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Total Project</span>
                  </div>
                  <p className="text-2xl font-bold text-black">{stats.total}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-500">
                      <CheckCircle size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Selesai</span>
                  </div>
                  <p className="text-2xl font-bold text-black">{stats.done}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center text-amber-500">
                      <Activity size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ongoing</span>
                  </div>
                  <p className="text-2xl font-bold text-black">{stats.onGoing}</p>
                </div>

                <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center text-white">
                      <DollarSign size={16} />
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Estimasi Pendapatan</span>
                  </div>
                  <p className="text-2xl font-bold text-black">Rp {formatPrice(stats.totalRevenue)}</p>
                </div>
              </div>

              {/* Chart Section */}
              {projects.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
                  <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-slate-900 tracking-tight">Aktivitas Project</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">6 Bulan Terakhir</p>
                      </div>
                      <TrendingUp size={20} className="text-slate-300" />
                    </div>
                    <div className="h-[240px] w-full min-w-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={getChartData()}>
                          <defs>
                            <linearGradient id="colorProjects" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#000" stopOpacity={0.1} />
                              <stop offset="95%" stopColor="#000" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis
                            dataKey="month"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                            dy={10}
                          />
                          <YAxis
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }}
                          />
                          <Tooltip
                            contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '12px' }}
                            cursor={{ stroke: '#000', strokeWidth: 1 }}
                          />
                          <Area
                            type="monotone"
                            dataKey="completed"
                            stroke="#10b981"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="transparent"
                            name="Selesai"
                          />
                          <Area
                            type="monotone"
                            dataKey="onGoing"
                            stroke="#f59e0b"
                            strokeWidth={2}
                            strokeDasharray="5 5"
                            fillOpacity={1}
                            fill="transparent"
                            name="Ongoing"
                          />
                          <Area
                            type="monotone"
                            dataKey="projects"
                            stroke="#000"
                            strokeWidth={2}
                            fillOpacity={1}
                            fill="url(#colorProjects)"
                            name="Total"
                          />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex flex-col">
                    <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="font-bold text-slate-900 tracking-tight">Ringkasan Pendapatan</h3>
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Total Diterima</p>
                      </div>
                      <BarChart3 size={20} className="text-slate-300" />
                    </div>
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="py-6 border-b border-slate-50">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pendapatan Diterima</p>
                        <p className="text-3xl font-bold text-black tracking-tighter">Rp {formatPrice(stats.earnedRevenue)}</p>
                        <p className="text-[10px] text-slate-400 font-medium mt-2">Dari project yang selesai</p>
                      </div>
                      <div className="mt-6 space-y-5">
                        <div>
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                            <span className="text-emerald-600">Selesai ({stats.done})</span>
                            <span>{Math.round((stats.done / (stats.total || 1)) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(stats.done / (stats.total || 1)) * 100}%` }}></div>
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-[10px] font-bold uppercase tracking-widest mb-2">
                            <span className="text-amber-600">Ongoing ({stats.onGoing})</span>
                            <span>{Math.round((stats.onGoing / (stats.total || 1)) * 100)}%</span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-50 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${(stats.onGoing / (stats.total || 1)) * 100}%` }}></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {dashboardTab === "PROJECT" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {projects.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-2xl p-12 md:p-20 text-center shadow-sm">
                  <div className="w-16 h-16 border border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Briefcase size={28} className="text-slate-300" />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-3 tracking-tight">Belum ada project</h3>
                  <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm md:text-base leading-relaxed">
                    Kamu belum membuat draf project apapun. Mulai buat SPK pertamamu sekarang.
                  </p>
                  <button
                    onClick={handleCreateNew}
                    className="bg-black hover:bg-slate-800 text-white px-6 py-3 rounded font-medium transition-colors inline-flex items-center gap-2"
                  >
                    <Plus size={18} />
                    Buat Project Baru
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {projects.map((project) => (
                    <div key={project.id} className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-md transition-all flex flex-col group relative">
                      <div className="flex justify-between items-start mb-6">
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setOpenDropdownId(openDropdownId === project.id ? null : project.id);
                            }}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-wider transition-all border ${getStatusColor(project.status)}`}
                          >
                            {project.status}
                            <ChevronDown size={12} className={`transition-transform duration-200 ${openDropdownId === project.id ? "rotate-180" : ""}`} />
                          </button>

                          {openDropdownId === project.id && (
                            <div className="absolute top-full left-0 mt-2 w-40 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                              {["Not Started", "Ongoing", "Done"].map((status) => (
                                <button
                                  key={status}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    updateProjectStatus(project.id, status);
                                    setOpenDropdownId(null);
                                  }}
                                  className={`w-full text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider transition-colors hover:bg-slate-50 ${project.status === status ? "text-black" : "text-slate-400"}`}
                                >
                                  {status}
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleEdit(project)} className="text-slate-400 hover:text-black transition-colors p-1.5" title="Edit">
                            <Edit size={16} />
                          </button>
                          <button onClick={() => handleDelete(project.id)} className="text-slate-400 hover:text-red-600 transition-colors p-1.5" title="Hapus">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      <h3 className="text-lg font-bold text-slate-900 line-clamp-1 mb-1 tracking-tight">{project.projectName || "Tanpa Nama"}</h3>
                      <p className="text-slate-500 text-sm mb-6 flex items-center gap-2">
                        <UserIcon size={14} className="text-slate-300" />
                        {project.clientName || "Client tidak diketahui"}
                      </p>

                      <div className="mt-auto pt-6 border-t border-slate-100 flex justify-between items-end">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Nilai Project</p>
                          <p className="font-bold text-slate-900 tracking-tight">Rp {project.price || "0"}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          {project.status === "Done" && (
                            <button
                              onClick={() => handleInvoice(project)}
                              className="text-emerald-600 hover:text-emerald-700 text-sm font-bold flex items-center gap-1 transition-colors"
                              title="Invoice"
                            >
                              <ReceiptText size={14} />
                              Invoice
                            </button>
                          )}
                          <button
                            onClick={() => handlePreview(project)}
                            className="text-slate-400 hover:text-black transition-colors p-1.5"
                            title="Preview"
                          >
                            <Eye size={18} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ================= VIEW: SELECT_INVOICE =================
  if (view === "SELECT_INVOICE") {
    // Show projects that are "Done" OR "On Going" (if they have DP/Termin to collect early payment)
    const availableProjects = projects;

    return (
      <div className="min-h-screen bg-[#FBFBFB] font-sans selection:bg-black selection:text-white">
        <header className="border-b border-slate-200 bg-white sticky top-0 z-30">
          <div className="max-w-4xl mx-auto px-6 h-16 md:h-20 flex items-center justify-between">
            <button
              onClick={() => setView("LIST")}
              className="flex items-center gap-2 text-slate-500 hover:text-black transition-colors text-sm font-medium"
            >
              <ArrowLeft size={18} />
              Kembali
            </button>
            <h2 className="font-bold text-lg tracking-tight">Cetak Invoice</h2>
            <div className="w-10" />
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-6 py-10 md:py-16">
          <div className="mb-10 text-center">
            <h1 className="text-2xl md:text-3xl font-black tracking-tighter mb-2 uppercase">Pilih Project</h1>
            <p className="text-slate-500 text-sm">Kelola Invoice dan Bukti Pembayaran dari Client</p>
          </div>

          {availableProjects.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-3xl p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6 text-slate-300">
                <ReceiptText size={32} />
              </div>
              <p className="text-slate-500 mb-8 max-w-sm mx-auto text-sm leading-relaxed">
                Belum ada project yang bisa ditagih. Pastikan status sudah <b>Done</b> atau project memiliki metode <b>DP/Termin</b> untuk tagihan awal.
              </p>
              <button
                onClick={() => setView("LIST")}
                className="text-black font-bold border-b-2 border-black pb-1 hover:text-slate-600 transition-colors"
              >
                Kembali ke Dashboard
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {availableProjects.map((project) => {
                const b = getPaymentBreakdownForProject(project);
                const isTermin = b.type === "TERMIN";
                const isDP = b.type === "DP" || project.paymentMethod === "Pembayaran Sebagian (Down Payment)";
                const isExpanded = expandedProjectId === project.id;

                return (
                  <div key={project.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden transition-all">
                    {/* Project Row (Header) */}
                    <button
                      onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                      className="w-full flex justify-between items-center p-6 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${isExpanded ? "bg-black text-white" : "bg-slate-100 text-slate-400"}`}>
                          <ReceiptText size={20} />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 tracking-tight">{project.projectName}</h3>
                          <p className="text-xs text-slate-500 font-medium normal tracking-widest">{project.clientName} • Rp {project.price}</p>
                        </div>
                      </div>
                      <ChevronDown size={20} className={`text-slate-300 transition-transform duration-300 ${isExpanded ? "rotate-180 text-black" : ""}`} />
                    </button>

                    {/* Expandable Details */}
                    {isExpanded && (
                      <div className="px-6 pb-6 pt-2 bg-white border-t border-slate-50 animate-in slide-in-from-top-2 duration-300">
                        <div className="bg-slate-50 rounded-2xl p-4 md:p-6 space-y-4">

                          {/* Case: Down Payment (Split into 2 parts: DP & Remaining) */}
                          {isDP && (
                            <div className="space-y-3">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tahapan Pembayaran DP</p>

                              {/* 1. Down Payment Row */}
                              <div className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl relative overflow-hidden">
                                 <div className="flex flex-row md:items-center justify-between gap-4">
                                   <div>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tahap 1: Uang Muka</p>
                                     <p className="text-sm font-bold text-slate-800">DP {project.paymentDetails || "___"}</p>
                                   </div>
                                   <div className="flex items-center gap-3">
                                     {project.isDPPaid ? (
                                       <div className="flex items-center gap-2">
                                         <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                           <CheckCircle size={14} />
                                           <span className="text-xs font-bold uppercase tracking-wider">Paid</span>
                                         </div>
                                         <button
                                           onClick={() => window.open(project.dpProof, "_blank")}
                                           className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
                                           title="Lihat Bukti"
                                         >
                                           <Eye size={18} />
                                         </button>
                                       </div>
                                     ) : (
                                       <div className="flex flex-wrap items-center gap-2">
                                         <button
                                           onClick={() => handlePrintDP(project, "DP")}
                                           className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                                           title="Cetak Invoice DP"
                                         >
                                           <Printer size={16} />
                                         </button>
                                         <UploadButton
                                           endpoint="proofUploader"
                                           onUploadProgress={(p) => setUploadingProgress(prev => ({ ...prev, [`${project.id}-dp`]: p }))}
                                           onClientUploadComplete={(res: any[]) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-dp`];
                                               return next;
                                             });
                                             if (res?.[0]) handleDPPaid(project.id, res[0].url);
                                           }}
                                           onUploadError={(err: Error) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-dp`];
                                               return next;
                                             });
                                             alert(err.message);
                                           }}
                                           content={{ button: <Upload size={16} />, allowedContent: null }}
                                           appearance={{
                                             button: "p-0 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors after:hidden focus-within:ring-0 w-10 h-10 flex items-center justify-center text-[0px]",
                                             allowedContent: "hidden",
                                             container: "w-10 h-10"
                                           }}
                                         />
                                       </div>
                                     )}
                                   </div>
                                 </div>
                                 {uploadingProgress[`${project.id}-dp`] !== undefined && (
                                   <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" style={{ width: `${uploadingProgress[`${project.id}-dp`]}%` }} />
                                 )}
                               </div>

                              {/* 2. Remaining Payment Row */}
                              <div className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl relative overflow-hidden">
                                 <div className="flex flex-row md:items-center justify-between gap-4">
                                   <div>
                                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Tahap 2: Pelunasan</p>
                                     <p className="text-sm font-bold text-slate-800">Sisa Pembayaran (Full)</p>
                                   </div>
                                   <div className="flex items-center gap-3">
                                     {project.isRemainingPaid ? (
                                       <div className="flex items-center gap-2">
                                         <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                           <CheckCircle size={14} />
                                           <span className="text-xs font-bold uppercase tracking-wider">Paid</span>
                                         </div>
                                         <button
                                           onClick={() => window.open(project.remainingProof, "_blank")}
                                           className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
                                           title="Lihat Bukti"
                                         >
                                           <Eye size={18} />
                                         </button>
                                       </div>
                                     ) : (
                                       <div className="flex flex-wrap items-center gap-2">
                                         <button
                                           onClick={() => handlePrintDP(project, "REMAINING")}
                                           className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                                           title="Cetak Pelunasan"
                                         >
                                           <Printer size={16} />
                                         </button>
                                         <UploadButton
                                           endpoint="proofUploader"
                                           onUploadProgress={(p) => setUploadingProgress(prev => ({ ...prev, [`${project.id}-rem`]: p }))}
                                           onClientUploadComplete={(res: any[]) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-rem`];
                                               return next;
                                             });
                                             if (res?.[0]) handleRemainingPaid(project.id, res[0].url);
                                           }}
                                           onUploadError={(err: Error) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-rem`];
                                               return next;
                                             });
                                             alert(err.message);
                                           }}
                                           content={{ button: <Upload size={16} />, allowedContent: null }}
                                           appearance={{
                                             button: "p-0 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors after:hidden focus-within:ring-0 w-10 h-10 flex items-center justify-center text-[0px]",
                                             allowedContent: "hidden",
                                             container: "w-10 h-10"
                                           }}
                                         />
                                       </div>
                                     )}
                                   </div>
                                 </div>
                                 {uploadingProgress[`${project.id}-rem`] !== undefined && (
                                   <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" style={{ width: `${uploadingProgress[`${project.id}-rem`]}%` }} />
                                 )}
                               </div>
                            </div>
                          )}

                          {/* Case: Termin List */}
                          {isTermin && (
                            <div className="space-y-2">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Daftar Termin</p>
                              {Array.from({ length: b.count }).map((_, i) => {
                                const num = i + 1;
                                const terminItem = (project.paidTermins || []).find(t => t.num === num);
                                const isPaid = !!terminItem;

                                return (
                                   <div key={num} className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl relative overflow-hidden">
                                     <div className="flex flex-row md:items-center justify-between gap-4">
                                       <div className="flex items-center gap-3">
                                         <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black ${isPaid ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                                           {num}
                                         </div>
                                         <div>
                                           <p className="text-sm font-bold text-slate-800">Termin {num}</p>
                                           <p className="text-[10px] text-slate-400 font-bold uppercase">Rp {formatPrice(b.perTermin)}</p>
                                         </div>
                                       </div>
 
                                       <div className="flex items-center gap-3">
                                         {isPaid ? (
                                           <div className="flex items-center gap-2">
                                             <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100">
                                               <CheckCircle size={14} />
                                               <span className="text-xs font-bold uppercase tracking-wider">Paid</span>
                                             </div>
                                             <button
                                               onClick={() => window.open(terminItem.proof, "_blank")}
                                               className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
                                               title="Lihat Bukti"
                                             >
                                               <Eye size={18} />
                                             </button>
                                           </div>
                                         ) : (
                                           <div className="flex items-center gap-2">
                                             <button
                                               onClick={() => handlePrintTermin(project, num)}
                                               className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                                               title="Cetak Invoice"
                                             >
                                               <Printer size={16} />
                                             </button>
                                             <UploadButton
                                               endpoint="proofUploader"
                                               onUploadProgress={(p) => setUploadingProgress(prev => ({ ...prev, [`${project.id}-t-${num}`]: p }))}
                                               onClientUploadComplete={(res: any[]) => {
                                                 setUploadingProgress(prev => {
                                                   const next = { ...prev };
                                                   delete next[`${project.id}-t-${num}`];
                                                   return next;
                                                 });
                                                 if (res?.[0]) toggleTerminPaid(project.id, num, res[0].url);
                                               }}
                                               onUploadError={(err: Error) => {
                                                 setUploadingProgress(prev => {
                                                   const next = { ...prev };
                                                   delete next[`${project.id}-t-${num}`];
                                                   return next;
                                                 });
                                                 alert(err.message);
                                               }}
                                               content={{ button: <Upload size={16} />, allowedContent: null }}
                                               appearance={{
                                                 button: "p-0 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors after:hidden focus-within:ring-0 w-10 h-10 flex items-center justify-center text-[0px]",
                                                 allowedContent: "hidden",
                                                 container: "w-10 h-10"
                                               }}
                                             />
                                           </div>
                                         )}
                                       </div>
                                     </div>
                                     {uploadingProgress[`${project.id}-t-${num}`] !== undefined && (
                                       <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" style={{ width: `${uploadingProgress[`${project.id}-t-${num}`]}%` }} />
                                     )}
                                   </div>
                                );
                              })}
                            </div>
                          )}
                          
                          {/* Case: Full Payment */}
                          {!isTermin && !isDP && (
                             <div className="flex flex-col p-4 bg-white border border-slate-100 rounded-xl relative overflow-hidden">
                               <div className="flex flex-row md:items-center justify-between gap-4">
                                 <div>
                                   <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Pembayaran Penuh</p>
                                   <p className="text-sm font-bold text-slate-800">Total Rp {project.price}</p>
                                 </div>
                                 <div className="flex items-center gap-3">
                                     {project.isPaid ? (
                                       <div className="flex items-center gap-2">
                                         <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 h-10">
                                           <CheckCircle size={14} />
                                           <span className="text-xs font-bold uppercase tracking-wider">Paid</span>
                                         </div>
                                         <button
                                           onClick={() => window.open(project.fullProof, "_blank")}
                                           className="w-10 h-10 flex items-center justify-center text-slate-400 hover:text-black transition-colors"
                                           title="Lihat Bukti"
                                         >
                                           <Eye size={18} />
                                         </button>
                                       </div>
                                     ) : (
                                       <div className="flex flex-wrap items-center gap-2">
                                         <button
                                           onClick={() => {
                                             setFormData(project);
                                             setSelectedTermin(null);
                                             setView("INVOICE");
                                           }}
                                           className="w-10 h-10 flex items-center justify-center bg-black text-white rounded-lg hover:bg-slate-800 transition-colors"
                                           title="Cetak Invoice Full"
                                         >
                                           <Printer size={16} />
                                         </button>
                                         <UploadButton
                                           endpoint="proofUploader"
                                           onUploadProgress={(p) => setUploadingProgress(prev => ({ ...prev, [`${project.id}-full`]: p }))}
                                           onClientUploadComplete={(res: any[]) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-full`];
                                               return next;
                                             });
                                             if (res?.[0]) handleFullPaid(project.id, res[0].url);
                                           }}
                                           onUploadError={(err: Error) => {
                                             setUploadingProgress(prev => {
                                               const next = { ...prev };
                                               delete next[`${project.id}-full`];
                                               return next;
                                             });
                                             alert(err.message);
                                           }}
                                           content={{ button: <Upload size={16} />, allowedContent: null }}
                                           appearance={{ 
                                             button: "p-0 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors after:hidden focus-within:ring-0 w-10 h-10 flex items-center justify-center text-[0px]",
                                             allowedContent: "hidden",
                                             container: "w-10 h-10"
                                           }}
                                         />
                                       </div>
                                     )}
                                 </div>
                               </div>
                               {uploadingProgress[`${project.id}-full`] !== undefined && (
                                 <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-300" style={{ width: `${uploadingProgress[`${project.id}-full`]}%` }} />
                               )}
                             </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  // ================= VIEW: INVOICE =================
  if (view === "INVOICE") {
    return (
      <div className="min-h-screen bg-[#FBFBFB] py-10 px-4 flex flex-col items-center print-container font-sans">
        <div className="w-full max-w-[210mm] flex justify-between items-center mb-8 no-print">
          <button
            onClick={() => setView("SELECT_INVOICE")}
            className="flex items-center gap-2 text-slate-500 hover:text-black font-medium transition-colors text-sm"
          >
            <ArrowLeft size={18} />
            Kembali
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded font-medium transition-colors shadow-sm text-sm"
          >
            <Printer size={18} />
            Cetak Invoice
          </button>
        </div>

        <InvoicePaper />

        <style jsx global>{`
          @media print {
            @page {
              margin: 0;
              size: A4;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            .print-paper {
              box-shadow: none !important;
              border: none !important;
              max-width: 100% !important;
              width: 210mm !important;
              min-height: 297mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
            }
            body {
              background: white !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ================= VIEW: PREVIEW =================
  if (view === "PREVIEW") {
    return (
      <div className="min-h-screen bg-[#FBFBFB] py-10 px-4 flex flex-col items-center print-container font-sans">
        <div className="w-full max-w-[210mm] flex justify-between items-center mb-8 no-print">
          <button
            onClick={() => setView("LIST")}
            className="flex items-center gap-2 text-slate-500 hover:text-black font-medium transition-colors text-sm"
          >
            <ArrowLeft size={18} />
            Dashboard
          </button>

          <button
            onClick={handlePrint}
            className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white px-5 py-2.5 rounded font-medium transition-colors shadow-sm text-sm"
          >
            <Printer size={18} />
            Cetak Project
          </button>
        </div>

        <DocumentPaper />

        <style jsx global>{`
          @media print {
            @page {
              margin: 0;
              size: A4;
            }
            .no-print {
              display: none !important;
            }
            .print-container {
              padding: 0 !important;
              height: auto !important;
              overflow: visible !important;
              background: white !important;
            }
            .print-paper {
              box-shadow: none !important;
              border: none !important;
              max-width: 100% !important;
              width: 210mm !important;
              min-height: 297mm !important;
              padding: 0 !important;
              margin: 0 auto !important;
            }
            body {
              background: white !important;
            }
          }
        `}</style>
      </div>
    );
  }

  // ================= VIEW: FORM =================
  return (
    <div className="min-h-screen bg-[#FBFBFB] flex flex-col md:flex-row font-sans text-slate-900">
      {/* Left Pane - Form */}
      <div className="w-full md:w-1/3 lg:w-[450px] bg-white border-r border-slate-200 flex flex-col h-screen overflow-y-auto z-10 no-print">
        <div className="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-6 py-6 border-b border-slate-100 flex items-center justify-between">
          <button
            onClick={() => setView("LIST")}
            className="flex items-center gap-2 text-slate-500 hover:text-black transition-colors text-sm font-medium"
          >
            <ArrowLeft size={16} />
            Kembali
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 bg-black hover:bg-slate-800 text-white px-4 py-2 rounded text-sm font-bold transition-colors"
          >
            <Save size={16} />
            Simpan Project
          </button>
        </div>

        <div className="p-6 md:p-8">
          <div className="mb-10">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight mb-2">
              {"id" in formData ? "Edit Project" : "Project Baru"}
            </h2>
            <p className="text-slate-500 text-sm leading-relaxed">
              Isi detail project di bawah ini.
            </p>
          </div>

          <div className="space-y-6 pb-20">
            {/* Project Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Briefcase size={14} />
                Project <span className="text-black ml-1">*</span>
              </label>
              <input
                type="text"
                name="projectName"
                value={formData.projectName}
                onChange={handleChange}
                placeholder="Misal: Website Redesign"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            {/* Client Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={14} />
                Nama Client <span className="text-black ml-1">*</span>
              </label>
              <input
                type="text"
                name="clientName"
                value={formData.clientName}
                onChange={handleChange}
                placeholder="Misal: PT Maju Bersama"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            {/* Freelancer Name */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <UserIcon size={14} />
                Freelancer <span className="text-black ml-1">*</span>
              </label>
              <input
                type="text"
                name="freelancerName"
                value={formData.freelancerName}
                onChange={handleChange}
                placeholder="Nama lengkap kamu"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            {/* Tanggal Project */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Calendar size={14} />
                Tanggal Mulai
              </label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB] font-sans"
              />
            </div>

            {/* Price */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <DollarSign size={14} />
                Harga (Rp)
              </label>
              <input
                type="text"
                name="price"
                value={formData.price}
                onChange={handleChange}
                placeholder="Misal: 5.000.000"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-4 bg-[#FBFBFB] p-5 rounded-xl border border-slate-200">
              <div className="space-y-2">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                  <CreditCard size={14} />
                  Cara Pembayaran
                </label>
                <select
                  name="paymentMethod"
                  value={formData.paymentMethod}
                  onChange={handleChange}
                  className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-bold bg-white"
                >
                  <option value="Pembayaran Penuh (Full Payment)">Full Payment</option>
                  <option value="Pembayaran Sebagian (Down Payment)">Down Payment</option>
                  <option value="Pembayaran Bertahap (Termin)">Termin</option>
                </select>
              </div>

              {formData.paymentMethod === "Pembayaran Sebagian (Down Payment)" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Besaran DP & Ketentuan
                  </label>
                  <input
                    type="text"
                    name="paymentDetails"
                    value={formData.paymentDetails}
                    onChange={handleChange}
                    placeholder="Contoh: 30% di awal"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-white"
                  />
                </div>
              )}

              {formData.paymentMethod === "Pembayaran Bertahap (Termin)" && (
                <div className="space-y-2">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    Rincian Termin
                  </label>
                  <input
                    type="text"
                    name="paymentDetails"
                    value={formData.paymentDetails}
                    onChange={handleChange}
                    placeholder="Contoh: 3x Pembayaran"
                    className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-white"
                  />
                </div>
              )}
            </div>

            {/* Duration */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <Clock size={14} />
                Durasi/Kontrak
              </label>
              <input
                type="text"
                name="duration"
                value={formData.duration}
                onChange={handleChange}
                placeholder="Misal: 2 Minggu"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB]"
              />
            </div>

            {/* Status */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <CheckCircle size={14} />
                Status Pekerjaan
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-bold bg-[#FBFBFB]"
              >
                <option value="Not Started">Not Started</option>
                <option value="Ongoing">Ongoing</option>
                <option value="Done">Done</option>
              </select>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                <AlignLeft size={14} />
                Deskripsi Pekerjaan
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleChange}
                rows={5}
                placeholder="Apa saja yang akan dikerjakan?"
                className="w-full px-4 py-3 border border-slate-200 rounded-lg focus:border-black outline-none transition-all text-sm font-medium bg-[#FBFBFB] resize-none"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Right Pane - Preview */}
      <div className="flex-1 bg-slate-100 p-6 md:p-12 overflow-y-auto h-screen no-print">
        <DocumentPaper />
      </div>

      <style jsx global>{`
        @media print {
          @page {
            margin: 0;
            size: A4;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            padding: 0 !important;
            height: auto !important;
            overflow: visible !important;
            background: white !important;
          }
          .print-paper {
            box-shadow: none !important;
            border: none !important;
            max-width: 100% !important;
            width: 210mm !important;
            min-height: 297mm !important;
            padding: 20mm !important;
          }
          body {
            background: white !important;
          }
        }
      `}</style>
    </div>
  );
}
