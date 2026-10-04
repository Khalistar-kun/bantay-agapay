import Link from "next/link"
import { ArrowRight, ClipboardList, MapPin, ShieldCheck, User, School } from "lucide-react"

export default function Home() {
  return (
    <main className="min-h-screen bg-[#faf8f5]">
      <header className="border-b border-primary-100 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
          <Link href="/" className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-800 text-white"><ShieldCheck aria-hidden="true" /></span><span><span className="block text-lg font-bold tracking-tight">Bantay-Agapay</span><span className="block text-xs text-gray-500">AFGBMTS · Marilao, Bulacan</span></span></Link>
          <Link href="/login" className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold hover:border-primary-700 hover:text-primary-800">Staff login</Link>
        </div>
      </header>
      <div className="mx-auto max-w-6xl px-5 py-12 sm:py-20">
        <div className="grid items-center gap-12 lg:grid-cols-[1.15fr_1fr]">
          <section>
            <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary-200 bg-primary-50 px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-primary-800"><School className="h-4 w-4" aria-hidden="true" /> Welcome to AFGBMTS</p>
            <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-6xl">A warm welcome.<br /><span className="text-primary-800">A safer campus.</span></h1>
            <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600">Your visit starts here. Register, get your entry approved, and find your way around Assemblywoman Felicita G. Bernardino Memorial Trade School.</p>
            <p className="mt-8 flex items-center gap-3 text-sm text-gray-500"><MapPin className="h-5 w-5 text-primary-700" aria-hidden="true" /> Lias, Marilao, Bulacan</p>
            <p className="mt-10 border-l-4 border-gold-500 pl-4 text-sm leading-relaxed text-gray-600">Visiting the school today?<br />Please register at the security desk before entering.</p>
          </section>
          <section aria-labelledby="entry-title" className="overflow-hidden rounded-3xl border border-primary-100 bg-white shadow-xl shadow-primary-900/5">
            <div className="bg-primary-900 px-7 py-8 text-white sm:px-9"><ShieldCheck className="mb-5 h-9 w-9 text-gold-300" aria-hidden="true" /><h2 id="entry-title" className="text-2xl font-bold">Let’s get you checked in</h2><p className="mt-2 text-sm text-primary-100">Choose an option to begin your visit.</p></div>
            <div className="space-y-4 p-7 sm:p-9">
              <Link href="/visit" className="flex items-center gap-4 rounded-xl bg-primary-800 p-5 text-white transition hover:bg-primary-900"><ClipboardList className="h-6 w-6 shrink-0" aria-hidden="true" /><span className="flex-1"><span className="block font-semibold">First time visiting?</span><span className="mt-1 block text-sm text-primary-100">Register as a new visitor</span></span><ArrowRight className="h-5 w-5" aria-hidden="true" /></Link>
              <Link href="/visit/returning" className="flex items-center gap-4 rounded-xl border border-primary-200 p-5 transition hover:bg-primary-50"><User className="h-6 w-6 shrink-0 text-primary-800" aria-hidden="true" /><span className="flex-1"><span className="block font-semibold">Welcome back</span><span className="mt-1 block text-sm text-gray-500">Quick entry for returning visitors</span></span><ArrowRight className="h-5 w-5 text-primary-800" aria-hidden="true" /></Link>
              <p className="pt-2 text-center text-xs leading-relaxed text-gray-500">Have your phone ready. Camera and location access are needed during registration.</p>
            </div>
          </section>
        </div>
        <section aria-label="How your visit works" className="mt-16 grid gap-6 border-t border-gray-200 pt-8 sm:grid-cols-3">
          {[
            { icon: ClipboardList, title: "01 · Register your visit", text: "Share your details and the office you’re visiting." },
            { icon: ShieldCheck, title: "02 · Get entry approval", text: "Security reviews your registration before you enter." },
            { icon: MapPin, title: "03 · Find your destination", text: "Follow campus directions, then check out when you leave." },
          ].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-4"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary-800"><Icon className="h-5 w-5" aria-hidden="true" /></span><div><h3 className="text-sm font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-gray-500">{text}</p></div></div>)}
        </section>
      </div>
      <footer className="border-t border-gray-200 px-5 py-6 text-center text-xs text-gray-500">Bantay-Agapay · AFGBMTS Visitor Monitoring & Campus Wayfinding</footer>
    </main>
  )
}
