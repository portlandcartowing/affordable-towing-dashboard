// Override the root layout's sidebar/nav for the driver screen.
// This layout renders children directly — full-screen, no chrome.
// The root layout's <html>/<body> tags still apply (fonts, etc).

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Return a wrapper that hides the sidebar and mobile nav via CSS.
  // The root layout wraps this, so we can't remove the sidebar from the
  // DOM, but we can hide it. This is the cleanest approach without
  // restructuring into route groups.
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
        }
        body > div > div.flex-1 {
          padding-bottom: 0 !important;
        }
      `}</style>
      <div className="min-h-screen bg-slate-900 text-white">
        {children}
      </div>
    </>
  );
}
