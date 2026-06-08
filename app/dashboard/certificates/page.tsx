"use client";

import { motion } from "framer-motion";
import { Award, Download, CheckCircle2 } from "lucide-react";
import PageTransition from "@/app/components/PageTransition";

type Certificate = {
  id: string;
  challengeType: string;
  accountSize: number;
  datePassed: string;
  certificateNumber: string;
};

const DEMO_CERTIFICATES: Certificate[] = [
  {
    id: "cert-001",
    challengeType: "Phase 1 Challenge",
    accountSize: 50000,
    datePassed: "2024-11-15",
    certificateNumber: "APX-2024-00847",
  },
  {
    id: "cert-002",
    challengeType: "Phase 2 Verification",
    accountSize: 50000,
    datePassed: "2024-12-03",
    certificateNumber: "APX-2024-01293",
  },
  {
    id: "cert-003",
    challengeType: "Instant Funding",
    accountSize: 25000,
    datePassed: "2025-01-08",
    certificateNumber: "APX-2025-00156",
  },
];

export default function CertificatesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden pb-24">
      <div className="glow-blob -left-24 top-12 h-[420px] w-[420px] bg-gold-radial" />
      <div className="glow-blob -right-24 top-1/3 h-[420px] w-[420px] bg-royal-radial" />

      <div className="relative mx-auto w-full max-w-6xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="h-display text-4xl sm:text-5xl">
            Your <span className="gradient-text">Certificates</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">Proof of your trading achievements and passed challenges</p>
        </div>

        <PageTransition>
          {/* Stats summary */}
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Award className="mx-auto h-5 w-5 text-gold" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Total Certificates</div>
              <div className="mt-1 font-display text-xl font-bold text-white">{DEMO_CERTIFICATES.length}</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <CheckCircle2 className="mx-auto h-5 w-5 text-emerald2-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Challenges Passed</div>
              <div className="mt-1 font-display text-xl font-bold text-emerald2-400">3</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-bg-soft/50 p-4 text-center backdrop-blur-xl">
              <Award className="mx-auto h-5 w-5 text-royal-400" />
              <div className="mt-2 text-[10px] uppercase tracking-wider text-slate-500">Funded Accounts</div>
              <div className="mt-1 font-display text-xl font-bold text-white">2</div>
            </div>
          </div>

          {/* Certificate cards */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {DEMO_CERTIFICATES.map((cert, i) => (
              <motion.div
                key={cert.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.12, duration: 0.5 }}
                className="relative overflow-hidden rounded-3xl border-2 border-gold/30 bg-bg-soft/50 backdrop-blur-xl"
              >
                {/* Gold top accent bar */}
                <div className="h-1.5 w-full bg-gradient-to-r from-gold-glow via-gold to-amber-600" />

                <div className="p-6">
                  {/* Certificate header */}
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Award className="h-5 w-5 text-gold" />
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-gold">Certificate of Achievement</span>
                      </div>
                      <h3 className="mt-2 font-display text-xl font-bold text-white">{cert.challengeType}</h3>
                    </div>
                    <div className="rounded-full bg-emerald2/10 px-2.5 py-0.5 text-[10px] font-bold text-emerald2-400">
                      PASSED
                    </div>
                  </div>

                  {/* Certificate body */}
                  <div className="mt-4 rounded-2xl border border-white/5 bg-bg-deep/50 p-4">
                    <div className="text-center">
                      <div className="font-display text-sm text-slate-400">This certifies that the holder has successfully completed</div>
                      <div className="mt-1 font-display text-lg font-bold text-white">{cert.challengeType}</div>
                      <div className="mt-1 text-sm text-gold">Account Size: ${cert.accountSize.toLocaleString()}</div>
                      <div className="mx-auto mt-3 h-px w-32 bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                      <div className="mt-3 font-display text-2xl font-bold tracking-tight">
                        Apex<span className="gradient-text">Funded</span>
                      </div>
                    </div>
                  </div>

                  {/* Certificate footer */}
                  <div className="mt-4 flex items-center justify-between">
                    <div className="space-y-1">
                      <div className="text-[10px] uppercase tracking-wider text-slate-500">Date Passed</div>
                      <div className="text-sm font-semibold text-white">
                        {new Date(cert.datePassed).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                      </div>
                      <div className="text-[10px] text-slate-500">#{cert.certificateNumber}</div>
                    </div>
                    <button className="flex items-center gap-2 rounded-xl border border-gold/30 bg-gold/10 px-4 py-2 text-sm font-semibold text-gold transition-colors hover:bg-gold/20">
                      <Download className="h-4 w-4" />
                      Download
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </PageTransition>
      </div>
    </div>
  );
}
