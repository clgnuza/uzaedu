const BAKIM_CSS = `
.bakim-root {
  position: fixed;
  inset: 0;
  z-index: 2147483000;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  overflow-y: auto;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  font-size: 16px;
  line-height: 1.5;
  color: #fafafa;
  background: #09090b;
  -webkit-font-smoothing: antialiased;
  box-sizing: border-box;
}
.bakim-root *, .bakim-root *::before, .bakim-root *::after { box-sizing: border-box; }
.bakim-root__glow {
  pointer-events: none;
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 70% 55% at 50% 38%, rgba(13, 148, 136, 0.14), transparent 62%),
    radial-gradient(ellipse 100% 40% at 50% 100%, rgba(0, 0, 0, 0.45), transparent);
}
.bakim-root__inner {
  position: relative;
  z-index: 1;
  display: flex;
  flex: 1;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem 1.25rem 2.5rem;
}
.bakim-card {
  width: 100%;
  max-width: 26rem;
  padding: 2rem 1.75rem;
  text-align: center;
  background: rgba(24, 24, 27, 0.92);
  border: 1px solid rgba(63, 63, 70, 0.85);
  border-radius: 1rem;
  box-shadow: 0 24px 48px rgba(0, 0, 0, 0.35);
}
.bakim-spinner {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 3rem;
  height: 3rem;
  margin: 0 auto 1.25rem;
  border-radius: 9999px;
  border: 2px solid rgba(63, 63, 70, 0.9);
  border-top-color: #14b8a6;
  animation: bakim-spin 0.9s linear infinite;
}
@keyframes bakim-spin { to { transform: rotate(360deg); } }
.bakim-eyebrow {
  margin: 0;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #71717a;
}
.bakim-title {
  margin: 0.5rem 0 0;
  font-size: 1.375rem;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: #fafafa;
}
.bakim-lead {
  margin: 0.625rem 0 0;
  font-size: 0.9375rem;
  color: #a1a1aa;
}
.bakim-msg {
  margin-top: 1.25rem;
  padding-top: 1.25rem;
  border-top: 1px solid rgba(63, 63, 70, 0.75);
  font-size: 0.875rem;
  line-height: 1.6;
  color: #d4d4d8;
  text-align: left;
}
.bakim-msg p { margin: 0; }
.bakim-msg p + p { margin-top: 0.5rem; }
.bakim-msg a { color: #2dd4bf; text-decoration: underline; text-underline-offset: 2px; }
.bakim-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.625rem;
  justify-content: center;
  margin-top: 1.5rem;
}
.bakim-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 2.5rem;
  padding: 0 1.125rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: #e4e4e7;
  text-decoration: none;
  background: transparent;
  border: 1px solid rgba(82, 82, 91, 0.95);
  border-radius: 9999px;
  cursor: pointer;
}
.bakim-btn:hover { color: #fafafa; border-color: #71717a; }
.bakim-brand {
  position: relative;
  z-index: 1;
  padding: 0.875rem 1.25rem 0;
  font-size: 0.6875rem;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #52525b;
  text-align: center;
}
@media (prefers-reduced-motion: reduce) {
  .bakim-spinner { animation: none; border-top-color: #14b8a6; }
}
`;

export default function BakimLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: BAKIM_CSS }} />
      <div className="bakim-root" data-bakim-shell lang="tr">
        <div className="bakim-root__glow" aria-hidden />
        <p className="bakim-brand">Uzaedu Öğretmen</p>
        <div className="bakim-root__inner">{children}</div>
      </div>
    </>
  );
}
