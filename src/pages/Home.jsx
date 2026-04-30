import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const featured = [
  {
    id: 1,
    client: 'Nike',
    title: 'In Motion',
    image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1600&h=900&fit=crop',
    wide: true,
  },
  {
    id: 2,
    client: "Levi's",
    title: 'Undone',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=1000&fit=crop',
  },
  {
    id: 3,
    client: 'Apple',
    title: 'City Pulse',
    image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=1000&fit=crop',
  },
  {
    id: 4,
    client: 'Porsche',
    title: 'Raw Edge',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1600&h=900&fit=crop',
    wide: true,
  },
  {
    id: 5,
    client: 'Spotify',
    title: 'Frequency',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=1000&fit=crop',
  },
  {
    id: 6,
    client: 'HBO',
    title: 'The Archive',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=1000&fit=crop',
  },
]

const clients = [
  'Nike', 'Apple', 'Google', 'Porsche', "Levi's", 'Spotify',
  'Adidas', 'Amazon', 'Samsung', 'Gucci', 'HBO', 'Netflix',
  'Microsoft', 'BMW', 'Chanel', 'Louis Vuitton',
]

function useInView(threshold = 0.1) {
  const ref = useRef(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const obs = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) setInView(true) },
      { threshold }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [threshold])
  return [ref, inView]
}

function ProjectTile({ project, index }) {
  const [ref, inView] = useInView(0.05)

  return (
    <Link
      ref={ref}
      to="/work"
      className={`group relative block overflow-hidden bg-neutral-900 ${
        project.wide ? 'md:col-span-2' : ''
      } ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 80}ms` }}
    >
      <div className={`relative ${project.wide ? 'aspect-[16/9]' : 'aspect-[4/5]'} overflow-hidden`}>
        <img
          src={project.image}
          alt={project.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors duration-500" />
      </div>

      <div className="absolute inset-0 flex items-end p-6 md:p-8">
        <div className="translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-300 mb-1">{project.client}</p>
          <h3 className="font-display text-xl md:text-3xl font-bold tracking-tight">{project.title}</h3>
        </div>
      </div>
    </Link>
  )
}

function LogoTicker() {
  const doubled = [...clients, ...clients]
  return (
    <section className="py-10 overflow-hidden border-t border-white/5">
      <div className="flex animate-marquee" style={{ width: 'max-content' }}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex items-center gap-12 md:gap-16 px-6 md:px-8">
            {doubled.map((name, i) => (
              <span
                key={`${copy}-${i}`}
                className="text-[11px] md:text-xs font-semibold uppercase tracking-[0.2em] text-neutral-600 whitespace-nowrap"
              >
                {name}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

export default function Home() {
  const [loaded, setLoaded] = useState(false)
  useEffect(() => { setLoaded(true) }, [])

  return (
    <main>
      {/* Hero — full viewport, minimal */}
      <section className="relative h-screen flex items-end overflow-hidden">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1485846234645-a62644f84728?w=1920&h=1080&fit=crop"
            alt="Gasworks Production"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/40 to-neutral-950/20" />
        </div>

        <div className="relative px-5 md:px-10 pb-16 md:pb-20 w-full">
          <h1
            className={`font-display text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight leading-[0.95] max-w-4xl opacity-0 ${
              loaded ? 'animate-fade-in-up' : ''
            }`}
            style={{ animationDelay: '300ms', animationFillMode: 'forwards' }}
          >
            You bring the vision.<br />We make it real.
          </h1>
          <p
            className={`mt-5 text-neutral-400 text-base md:text-lg max-w-lg opacity-0 ${
              loaded ? 'animate-fade-in-up' : ''
            }`}
            style={{ animationDelay: '600ms', animationFillMode: 'forwards' }}
          >
            Gasworks is a full-service production company for brands, agencies, and creators worldwide.
          </p>
        </div>
      </section>

      {/* Featured Work — visual grid */}
      <section className="pt-1 pb-1">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
          {featured.map((project, i) => (
            <ProjectTile key={project.id} project={project} index={i} />
          ))}
        </div>
      </section>

      <LogoTicker />

      {/* Minimal about strip */}
      <section className="py-20 md:py-28 px-5 md:px-10">
        <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-12 md:gap-20">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.1] md:w-1/2 shrink-0">
            You bring the idea.<br />We bring it to life.
          </h2>
          <div className="md:w-1/2 space-y-5">
            <p className="text-neutral-400 leading-relaxed">
              Gasworks exists so you never have to worry about the how. Whether you're a brand
              with a campaign idea, an agency responding to an RFP, or a creator with a story to
              tell — you come to us with the vision, and we handle every detail from start to finish.
            </p>
            <Link
              to="/about"
              className="inline-block text-[13px] uppercase tracking-[0.15em] text-white hover:text-neutral-400 transition-colors border-b border-white/30 pb-0.5"
            >
              Learn More
            </Link>
          </div>
        </div>
      </section>

      {/* CTA strip */}
      <section className="border-t border-white/5 py-20 md:py-28 px-5 md:px-10 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Have a project in mind?
        </h2>
        <Link
          to="/contact"
          className="inline-block text-[13px] uppercase tracking-[0.15em] text-neutral-950 bg-white px-8 py-3.5 font-medium hover:bg-neutral-200 transition-colors"
        >
          Start a Project
        </Link>
      </section>
    </main>
  )
}
