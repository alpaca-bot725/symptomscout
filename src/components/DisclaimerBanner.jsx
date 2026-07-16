/** Persistent disclaimer — required on every screen. */
export default function DisclaimerBanner() {
  return (
    <p className="rounded-xl border border-sky-200 bg-sky-100/70 px-4 py-3 text-center text-xs leading-relaxed text-sky-900 dark:border-sky-900/60 dark:bg-sky-500/10 dark:text-sky-200">
      This tool is for education only and does not provide medical diagnoses.
      Always consult a healthcare professional.
    </p>
  )
}
