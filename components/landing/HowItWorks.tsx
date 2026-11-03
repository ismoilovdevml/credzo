import { CopyButton } from "@/components/ui";

const DEPLOY_COMMAND = "docker compose up -d";

const STEPS = [
  {
    title: "Deploy",
    body: "Start the container on your own server. Your data never leaves your infrastructure.",
  },
  {
    title: "Create a project",
    body: "Pick a service type — PostgreSQL, SSH, AWS — and Credzo shows exactly the fields it needs.",
  },
  {
    title: "Invite your team",
    body: "Add teammates, give each one a role, and watch activity in the audit log.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" aria-labelledby="how-heading" className="scroll-mt-20 border-y border-line bg-surface">
      <div className="mx-auto flex max-w-[1200px] flex-col gap-10 px-4 py-20 sm:px-6 lg:py-[88px]">
        <h2 id="how-heading" className="text-[28px] font-extrabold tracking-[-0.03em] sm:text-[36px]">
          Up and running in three steps
        </h2>
        <ol className="grid gap-10 md:grid-cols-3 md:gap-8">
          {STEPS.map((step, index) => (
            <li key={step.title} className="flex min-w-0 flex-col gap-2.5">
              <span className="font-mono text-sm font-medium text-accent-ink" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="text-xl font-bold">{step.title}</h3>
              <p className="text-[15.5px] leading-relaxed text-muted">{step.body}</p>
              {index === 0 && (
                <div className="flex items-center gap-2 rounded-lg bg-ink py-1.5 pl-3.5 pr-1.5 dark:border dark:border-line dark:bg-track">
                  <code className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-accent-soft dark:text-accent-ink" data-testid="docker-command">
                    {DEPLOY_COMMAND}
                  </code>
                  <CopyButton
                    value={DEPLOY_COMMAND}
                    label="Copy command"
                    size="sm"
                    className="text-canvas/70 hover:bg-canvas/10 hover:text-canvas focus-visible:ring-offset-ink dark:text-muted dark:hover:bg-ink/[0.06] dark:hover:text-ink dark:focus-visible:ring-offset-track"
                  />
                </div>
              )}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
