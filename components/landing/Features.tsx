import { Activity, ArrowDownToLine, FolderOpen, Link2, RefreshCw, Users, type LucideIcon } from "lucide-react";

const FEATURES: { title: string; body: string; icon: LucideIcon; tone: string }[] = [
  {
    title: "Projects & environments",
    body: "Group credentials by project, then split them into production, staging and development so nobody grabs the wrong key.",
    icon: FolderOpen,
    tone: "bg-accent-soft text-accent-ink",
  },
  {
    title: "Owner, Admin, Member, Viewer",
    body: "Roles at organisation and project level. Viewers can use a credential without ever being able to edit or delete it.",
    icon: Users,
    tone: "bg-info-soft text-info",
  },
  {
    title: "Full audit trail",
    body: "Every create, edit, reveal, invite and role change is logged with who did it, when, and from which IP.",
    icon: Activity,
    tone: "bg-warn-soft text-warn",
  },
  {
    title: "Rotation reminders",
    body: "Set a rotation period per credential and see at a glance which secrets are due for a new value.",
    icon: RefreshCw,
    tone: "bg-violet-soft text-violet",
  },
  {
    title: "One-time secure links",
    body: "Share a secret with a contractor through an encrypted link that expires after a set number of views or a set time.",
    icon: Link2,
    tone: "bg-accent-soft text-accent-ink",
  },
  {
    title: "Import & export",
    body: "Bring everything in from JSON in one step and take an encrypted backup whenever you need it.",
    icon: ArrowDownToLine,
    tone: "bg-info-soft text-info",
  },
];

export function Features() {
  return (
    <section
      id="features"
      aria-labelledby="features-heading"
      className="mx-auto flex max-w-[1200px] scroll-mt-20 flex-col gap-10 px-4 py-20 sm:px-6 lg:gap-12 lg:py-24"
    >
      <div className="flex max-w-[640px] flex-col gap-3">
        <h2
          id="features-heading"
          className="text-balance text-[30px] font-extrabold leading-[1.15] tracking-[-0.03em] sm:text-[40px]"
        >
          Built for the people who keep the servers running
        </h2>
        <p className="text-[17px] leading-relaxed text-muted sm:text-lg">
          No more passwords in chat threads or spreadsheets. Credzo gives each secret a home, an owner and a history.
        </p>
      </div>
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" data-testid="landing-features">
        {FEATURES.map((feature) => (
          <li key={feature.title} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-6 sm:p-7">
            <span className={`flex h-11 w-11 items-center justify-center rounded-xl ${feature.tone}`}>
              <feature.icon className="h-[22px] w-[22px]" strokeWidth={1.8} aria-hidden="true" />
            </span>
            <h3 className="text-[19px] font-bold">{feature.title}</h3>
            <p className="text-[15.5px] leading-relaxed text-muted">{feature.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
