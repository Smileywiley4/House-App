import { Link } from 'react-router-dom'

export default function About() {
  return (
    <main className="pt-16 md:pt-20">
      {/* Hero image */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1524253482453-3fed8d2fe12b?w=1920&h=1080&fit=crop"
          alt="On set"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/30 to-transparent" />
        <div className="absolute bottom-0 left-0 px-5 md:px-10 pb-12">
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight">About</h1>
        </div>
      </div>

      {/* Mission */}
      <section className="px-5 md:px-10 py-20 md:py-28">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20">
          <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight leading-[1.1]">
            You bring the idea. We bring it to life.
          </h2>
          <div className="space-y-6 text-neutral-400 leading-relaxed">
            <p>
              Gasworks exists so you never have to worry about the how. Whether you're a
              brand with a campaign idea, an agency responding to an RFP, or a creator with
              a story to tell — you come to us with the vision, and we take care of every
              production detail from start to finish.
            </p>
            <p>
              Creative development, crew, equipment, locations, post-production — we manage
              the entire process so you can focus on what matters: your message. No need to
              source vendors, coordinate timelines, or manage deliverables. That's our job.
            </p>
            <p>
              Whether it's a brand spot, a campaign film, a product launch, or a full
              advertising package — you get a single production partner who owns it all
              and delivers at the highest level, on time and on brief.
            </p>
          </div>
        </div>
      </section>

      {/* Approach */}
      <section className="border-t border-white/5 px-5 md:px-10 py-20 md:py-28">
        <div className="max-w-5xl mx-auto">
          <p className="text-[11px] uppercase tracking-[0.25em] text-neutral-500 mb-8">How We Work</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16">
            {[
              {
                step: '01',
                title: 'Listen',
                text: 'We start by understanding your brand, your audience, and the story you want to tell.',
              },
              {
                step: '02',
                title: 'Build',
                text: 'We assemble the right team, develop the creative, and manage every detail of production.',
              },
              {
                step: '03',
                title: 'Deliver',
                text: 'Edit, color, sound, finish — we deliver final assets on time, on budget, and on brief.',
              },
            ].map((item) => (
              <div key={item.step}>
                <span className="text-[11px] uppercase tracking-[0.25em] text-neutral-600">{item.step}</span>
                <h3 className="font-display text-xl font-bold tracking-tight mt-2 mb-3">{item.title}</h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Worldwide strip */}
      <section className="border-t border-white/5 px-5 md:px-10 py-16 flex flex-col md:flex-row items-center justify-between gap-6">
        <p className="text-neutral-500 text-sm">Available for projects worldwide.</p>
        <a
          href="mailto:new@gasworksproduction.com"
          className="text-sm text-white hover:text-neutral-400 transition-colors border-b border-white/30 pb-0.5"
        >
          new@gasworksproduction.com
        </a>
      </section>

      {/* CTA */}
      <section className="border-t border-white/5 py-20 md:py-28 px-5 md:px-10 text-center">
        <h2 className="font-display text-3xl md:text-5xl font-bold tracking-tight mb-6">
          Ready to start?
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
