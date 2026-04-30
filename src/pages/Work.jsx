import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

const projects = [
  {
    id: 1,
    client: 'Nike',
    title: 'In Motion',
    description: 'A kinetic exploration of movement and athletic performance.',
    image: 'https://images.unsplash.com/photo-1556906781-9a412961c28c?w=1200&h=800&fit=crop',
    wide: true,
  },
  {
    id: 2,
    client: "Levi's",
    title: 'Undone',
    description: 'Deconstructing denim heritage for a new generation.',
    image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800&h=1000&fit=crop',
  },
  {
    id: 3,
    client: 'Apple',
    title: 'City Pulse',
    description: 'Technology meets humanity in an urban landscape.',
    image: 'https://images.unsplash.com/photo-1531297484001-80022131f5a1?w=800&h=1000&fit=crop',
  },
  {
    id: 4,
    client: 'Porsche',
    title: 'Raw Edge',
    description: 'Precision engineering captured in raw cinematic form.',
    image: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?w=1200&h=800&fit=crop',
    wide: true,
  },
  {
    id: 5,
    client: 'Spotify',
    title: 'Frequency',
    description: 'A multi-platform campaign that redefined how audiences experience music brands.',
    image: 'https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=800&h=1000&fit=crop',
  },
  {
    id: 6,
    client: 'HBO',
    title: 'The Archive',
    description: 'A cinematic ad campaign for the launch of a flagship streaming series.',
    image: 'https://images.unsplash.com/photo-1485846234645-a62644f84728?w=800&h=1000&fit=crop',
  },
  {
    id: 7,
    client: 'Samsung',
    title: 'Tomorrow',
    description: 'Envisioning the next decade of connected living.',
    image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?w=1200&h=800&fit=crop',
    wide: true,
  },
  {
    id: 8,
    client: 'Adidas',
    title: 'Ground Up',
    description: 'A grassroots campaign spotlighting athletes redefining sport culture.',
    image: 'https://images.unsplash.com/photo-1461896836934-bd45ba28a6e4?w=800&h=1000&fit=crop',
  },
  {
    id: 9,
    client: 'Google',
    title: 'Signal',
    description: 'An anthemic brand film celebrating connectivity across cultures.',
    image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=800&h=1000&fit=crop',
  },
]

function useInView(threshold = 0.05) {
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

function ProjectCard({ project, index }) {
  const [ref, inView] = useInView()

  return (
    <div
      ref={ref}
      className={`group relative overflow-hidden bg-neutral-900 cursor-pointer ${
        project.wide ? 'md:col-span-2' : ''
      } ${inView ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
      style={{ transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${index * 60}ms` }}
    >
      <div className={`relative ${project.wide ? 'aspect-[16/9]' : 'aspect-[4/5]'} overflow-hidden`}>
        <img
          src={project.image}
          alt={project.title}
          className="absolute inset-0 w-full h-full object-cover transition-transform duration-[1.2s] ease-out group-hover:scale-[1.04]"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors duration-500" />
      </div>

      <div className="absolute inset-0 flex flex-col justify-end p-6 md:p-8">
        <div className="translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
          <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-300 mb-1">{project.client}</p>
          <h3 className="font-display text-xl md:text-3xl font-bold tracking-tight">{project.title}</h3>
          <p className="text-sm text-neutral-400 mt-2 max-w-md">{project.description}</p>
        </div>
      </div>
    </div>
  )
}

export default function Work() {
  return (
    <main className="pt-16 md:pt-20">
      <div className="px-5 md:px-10 py-16 md:py-24">
        <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">Work</h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-1 pb-1">
        {projects.map((project, i) => (
          <ProjectCard key={project.id} project={project} index={i} />
        ))}
      </div>

      <section className="border-t border-white/5 py-20 md:py-28 px-5 md:px-10 text-center">
        <h2 className="font-display text-2xl md:text-4xl font-bold tracking-tight mb-6">
          Want to see your brand here?
        </h2>
        <Link
          to="/contact"
          className="inline-block text-[13px] uppercase tracking-[0.15em] text-neutral-950 bg-white px-8 py-3.5 font-medium hover:bg-neutral-200 transition-colors"
        >
          Get in Touch
        </Link>
      </section>
    </main>
  )
}
