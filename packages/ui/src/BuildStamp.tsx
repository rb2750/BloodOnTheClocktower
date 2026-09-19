/** Which build this phone is on. Faint, at the very bottom, always there. */
export function BuildStamp({ build }: { build: string }) {
  return (
    <p className="caps px-5 pb-6 pt-8 text-center text-[10px] text-(--text-faint)">
      Build {build}
    </p>
  )
}
