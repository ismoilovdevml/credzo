const POINTS = [
  { title: "Encryption at rest", body: "Secret fields are encrypted with AES-256-GCM using a server-held key." },
  { title: "Two-factor sign-in", body: "TOTP apps, with one-time backup codes." },
  { title: "Masked until revealed", body: "Secrets stay hidden on screen, and every reveal is logged." },
  { title: "Session control", body: "Sessions live on the server, so they can be listed and signed out." },
];

export function SecuritySection() {
  return (
    <section
      id="security"
      aria-labelledby="security-heading"
      className="mx-auto grid max-w-[1200px] scroll-mt-20 items-start gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-12 lg:py-24"
    >
      <div className="flex min-w-0 flex-col gap-3.5">
        <h2
          id="security-heading"
          className="text-balance text-[28px] font-extrabold leading-[1.15] tracking-[-0.03em] sm:text-[36px]"
        >
          Security you can explain to your auditor
        </h2>
        <p className="text-[17px] leading-relaxed text-muted">
          Secrets are encrypted before they reach the database. Sessions are server-side, and every reveal leaves a
          trace in the audit log.
        </p>
      </div>
      <ul className="grid min-w-0 gap-3.5 sm:grid-cols-2">
        {POINTS.map((point) => (
          <li key={point.title} className="flex flex-col gap-1.5 rounded-[14px] border border-line bg-surface p-5">
            <h3 className="text-[15.5px] font-bold">{point.title}</h3>
            <p className="text-[14.5px] leading-normal text-muted">{point.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
