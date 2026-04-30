import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 px-5 md:px-10 py-6">
        <Link to="/" className="font-display text-sm font-bold uppercase tracking-tight">
          Gasworks
        </Link>
        <div className="flex items-center gap-6">
          {['Instagram', 'Vimeo', 'LinkedIn'].map((s) => (
            <a key={s} href="#" className="text-xs text-neutral-600 hover:text-white transition-colors">
              {s}
            </a>
          ))}
        </div>
        <p className="text-[11px] text-neutral-600">
          &copy; {new Date().getFullYear()} Gasworks
        </p>
      </div>
    </footer>
  )
}
