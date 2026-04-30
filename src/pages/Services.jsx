import { Link } from 'react-router-dom'
import { ArrowRight, Film, Megaphone, Target, Tv } from 'lucide-react'

const services = [
  {
    icon: Film,
    title: 'Commercial Production',
    description:
      'High-end commercials and brand films for global brands. From concept through delivery, we produce spots that move audiences and drive measurable ROI.',
    capabilities: ['Brand Spots', 'Product Films', 'Campaign Content', 'Social Cutdowns'],
  },
  {
    icon: Megaphone,
    title: 'Marketing Content',
    description:
      'Strategic marketing content designed to build brand awareness and convert. We produce everything from hero videos to full-funnel campaign assets.',
    capabilities: ['Brand Videos', 'Launch Campaigns', 'Social Media Content', 'Explainer Films'],
  },
  {
    icon: Target,
    title: 'Advertising',
    description:
      'Performance-driven ad creative for digital, broadcast, and OTT. We craft spots that cut through the noise and deliver results across every platform.',
    capabilities: ['TV Spots', 'Digital Ads', 'Pre-Roll & OTT', 'Paid Social Creative'],
  },
  {
    icon: Tv,
    title: 'Branded Entertainment',
    description:
      'Narrative-driven brand content that tells stories with cinematic craft. For brands looking to push beyond the traditional ad format and build cultural relevance.',
    capabilities: ['Short Films', 'Branded Series', 'Episodic Content', 'Music Videos'],
  },
]

const process = [
  {
    step: '01',
    title: 'Discovery',
    description: 'We dig into your brand, audience, and objectives to understand the story that needs telling.',
  },
  {
    step: '02',
    title: 'Creative Development',
    description: 'Our creative team develops concepts, treatments, and scripts tailored to your brief and budget.',
  },
  {
    step: '03',
    title: 'Production',
    description: 'Best-in-class crews, equipment, and locations. Every frame produced to the highest standard.',
  },
  {
    step: '04',
    title: 'Post & Delivery',
    description: 'Edit, color, sound design, and VFX — delivered on time, on budget, and on brief.',
  },
]

export default function Services() {
  return (
    <main className="pt-28 pb-24">
      <div className="section-padding">
        <div className="mb-20">
          <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-4">
            What We Do
          </p>
          <h1 className="font-display text-5xl md:text-7xl font-bold tracking-tight max-w-3xl">
            <span className="text-white">PRODUCTION</span>
            <br />
            <span className="text-gradient">SERVICES</span>
          </h1>
          <p className="mt-6 text-neutral-400 text-lg leading-relaxed max-w-xl">
            From concept to final delivery, we handle every stage of production with
            precision, creativity, and an obsession with quality.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {services.map((service, i) => (
            <div
              key={service.title}
              className="group p-8 md:p-10 rounded-xl border border-white/5 hover:border-white/15 bg-white/[0.02] hover:bg-white/[0.04] transition-all duration-500"
              style={{
                animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 100}ms forwards`,
                opacity: 0,
              }}
            >
              <service.icon
                size={28}
                className="text-neutral-500 group-hover:text-white transition-colors duration-500 mb-6"
                strokeWidth={1.5}
              />
              <h3 className="font-display text-2xl font-bold tracking-tight mb-4">
                {service.title}
              </h3>
              <p className="text-neutral-400 leading-relaxed mb-6">{service.description}</p>
              <div className="flex flex-wrap gap-2">
                {service.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="px-3 py-1.5 text-[11px] tracking-[0.1em] uppercase bg-white/5 rounded-full text-neutral-500"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-32">
          <div className="mb-16">
            <p className="text-xs tracking-[0.3em] uppercase text-neutral-500 mb-4">
              How We Work
            </p>
            <h2 className="font-display text-4xl md:text-6xl font-bold tracking-tight">
              <span className="text-white">OUR</span>{' '}
              <span className="text-gradient">PROCESS</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {process.map((step, i) => (
              <div
                key={step.step}
                className="relative"
                style={{
                  animation: `fadeInUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 100}ms forwards`,
                  opacity: 0,
                }}
              >
                <div className="font-display text-6xl font-bold text-white/[0.04] mb-4">
                  {step.step}
                </div>
                <h3 className="font-display text-xl font-bold tracking-tight mb-3 -mt-6">
                  {step.title}
                </h3>
                <p className="text-neutral-500 text-sm leading-relaxed">{step.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-32 text-center">
          <p className="text-neutral-500 mb-6">Ready to start your next project?</p>
          <Link
            to="/#contact"
            className="group inline-flex items-center gap-2 px-7 py-3.5 text-sm font-medium bg-white text-neutral-950 rounded-full hover:bg-neutral-200 transition-all duration-300"
          >
            Get in Touch
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </main>
  )
}
