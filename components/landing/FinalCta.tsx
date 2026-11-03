import Link from "next/link";
import { Button } from "@/components/ui";

export function FinalCta() {
  return (
    <section aria-labelledby="cta-heading" className="mx-auto max-w-[1200px] px-4 pb-20 sm:px-6 lg:pb-24">
      <div className="flex flex-wrap items-center justify-between gap-6 rounded-3xl bg-ink px-6 py-10 text-canvas sm:px-12 sm:py-14 dark:border dark:border-accent/25 dark:bg-accent-soft dark:text-ink">
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-2.5">
          <h2
            id="cta-heading"
            className="text-balance text-[26px] font-extrabold leading-tight tracking-[-0.03em] sm:text-[34px]"
          >
            Give your secrets a proper home today.
          </h2>
          <p className="text-[17px] text-canvas/70 dark:text-ink-2">
            Free and self-hosted. Set up takes about five minutes.
          </p>
        </div>
        <Button
          asChild
          size="lg"
          className="w-full rounded-xl px-[26px] text-base font-bold focus-visible:ring-offset-ink sm:w-auto dark:focus-visible:ring-offset-accent-soft"
        >
          <Link href="/signup" data-testid="cta-create-vault">
            Create your vault
          </Link>
        </Button>
      </div>
    </section>
  );
}
