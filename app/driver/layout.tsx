import type { Viewport } from "next";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#0f172a",
};

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <style>{`
        /* Hide CRM chrome on the driver screen */
        aside, nav[aria-label="Primary"] {
          display: none !important;
        }
        body {
          background: #0f172a !important;
          padding-bottom: 0 !important;
          overflow: hidden !important;
          position: fixed !important;
          width: 100% !important;
          height: 100% !important;
          -webkit-overflow-scrolling: touch;
        }
        body > div > div.flex-1 {
          padding-bottom: 0 !important;
        }
        /* Prevent pull-to-refresh and bounce scroll */
        html, body {
          overscroll-behavior: none;
          touch-action: manipulation;
        }
      `}</style>
      <div className="fixed inset-0 bg-slate-900 text-white overflow-y-auto overscroll-none">
        {children}
      </div>
    </>
  );
}
