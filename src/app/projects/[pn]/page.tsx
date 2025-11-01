'use client';

import Image from 'next/image';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter, usePathname, useParams } from 'next/navigation';
import { useSupabaseDb } from '../../../hooks/useSupabaseDb';
import { getPublicImageUrl, supabase } from '../../../lib/supabaseClient';
import { scrollToSection } from '../../layout/header';

/**
 * Detailed page for each project.
 *
 * @returns Main content for project page.
 */
export default function ProjectPage() {
  // Dynamic route parameter.
  const { pn } = useParams<{ pn: string }>() ?? { pn: undefined };
  // List of projects using custom hook to Supabase.
  const { projects } = useSupabaseDb();
  const router = useRouter();
  const pathname = usePathname();

  /** Delay during loading and loaded states. */
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(t);
  }, []);

  /** Find and match a project. */
  const project = useMemo(() => {
    if (!pn || projects.length === 0) return undefined;
    return (
      projects.find(
        (p: { name: string }) => (p.name ?? '').toLowerCase().trim().replace(/\s+/g, '_') === pn,
      ) ?? null
    );
  }, [pn, projects]);

  const [slides, setSlides] = useState<{ src: string; caption: string }[] | null>(null);

  /** Fetch the preview column for selected project from Supabase. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!project) return;

      const { data } = await supabase
        .from('projects')
        .select('preview,image,features')
        .eq('id', project.id)
        .maybeSingle();

      // Normalize data with toSlides function.
      const next = toSlides(data?.preview ?? null, project.image);
      if (!cancelled) setSlides(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [project]);

  /** Create image public URLs */
  const urls = useMemo(
    () => (slides ?? []).map((s) => getPublicImageUrl(s.src, 'project-images')).filter(Boolean),
    [slides],
  );
  const captions = useMemo(() => (slides ?? []).map((s) => s.caption ?? ''), [slides]);

  /** Screen Rendering */
  const isLoading = !pn || project === undefined || !ready;
  if (isLoading) {
    return (
      <main className="min-h-[clamp(540px,91.75vh,900px)] supports-[height:100svh]:min-h-[clamp(540px,91.75svh,900px)] supports-[height:100dvh]:min-h-[clamp(540px,91.75dvh,900px)] flex items-center justify-center">
        <p className="text-gray-700 text-xl">Loading project…</p>
      </main>
    );
  }
  if (project === null) {
    return (
      <main className="min-h-[clamp(540px,91.75vh,900px)] supports-[height:100svh]:min-h-[clamp(540px,91.75svh,900px)] supports-[height:100dvh]:min-h-[clamp(540px,91.75dvh,900px)] flex items-center justify-center">
        <h1 className="text-gray-700 text-xl">Project doesn&apos;t exist.</h1>
      </main>
    );
  }
  if (slides === null) {
    return (
      <main className="min-h-[clamp(540px,91.75vh,900px)] supports-[height:100svh]:min-h-[clamp(540px,91.75svh,900px)] supports-[height:100dvh]:min-h-[clamp(540px,91.75dvh,900px)] flex items-center justify-center">
        <p className="text-gray-700 text-xl">Loading images…</p>
      </main>
    );
  }

  return (
    <main className="min-h-[clamp(540px,91.75vh,900px)] supports-[height:100svh]:min-h-[clamp(540px,91.75svh,900px)] supports-[height:100dvh]:min-h-[clamp(540px,91.75dvh,900px)] flex flex-col justify-center mx-auto max-w-screen-xl py-32">
      <div className="w-[90%] md:w-[60%] mx-auto space-y-8">
        <div className="flex flex-col md:flex-row md:justify-between items-start md:items-center gap-4">
          <h1 className="order-2 md:order-1 text-2xl md:text-3xl font-bold">{project.name}</h1>
          <button
            onClick={() => scrollToSection('projects', pathname, router)}
            className="order-1 md:order-2 py-3 hover:underline text-blue-600"
          >
            ← Back to projects
          </button>
        </div>

        {urls.length === 0 ? (
          <div className="w-full aspect-[16/9] grid place-items-center rounded-xl ring-1 ring-gray-200 text-gray-500">
            No Images Available
          </div>
        ) : (
          <ImageCarousel
            slides={urls.map((u, i) => ({ src: u, caption: captions[i] ?? '' }))}
            alt={project.name}
          />
        )}

        {project.overview && (
          <section aria-labelledby="desc-heading" className="space-y-2">
            <h2 id="desc-heading" className="text-xl font-semibold">
              Overview
            </h2>
            <p className="text-gray-700 text-md">{project.overview}</p>
          </section>
        )}
        {Array.isArray(project?.features) && (
          <section aria-labelledby="features-heading" className="space-y-4">
            <h2 id="features-heading" className="text-xl font-semibold">
              Key Features
            </h2>

            {project.features.map((f, i) => (
              <div key={i}>
                <h3 className="text-lg font-medium">{f.category}</h3>
                <ul className="list-disc list-decimal list-inside text-gray-700">
                  {f.bullets.map((b, j) => (
                    <li key={j}>{b}</li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * Converts the raw data from the preview column into a standardized array of image objects.
 *
 * @param preview The raw jsonb from Supabase {desc: string, file: string}.
 * @param cover Project card cover key when no preview is available.
 * @returns An array of objects for renderin in the image carousel.
 */
function toSlides(preview: unknown, cover?: string | null): { src: string; caption: string }[] {
  // Flatten if column is nested.
  const flat =
    Array.isArray(preview) && Array.isArray(preview[0]) ? (preview as unknown[]).flat(1) : preview;

  const slides: { src: string; caption: string }[] = [];

  // Ensure valid strings to pass.
  const pushIf = (src?: string, caption = '') => {
    if (typeof src === 'string' && src.trim()) slides.push({ src, caption });
  };

  // Handle different formats of the data.
  if (typeof flat === 'string') pushIf(flat);
  else if (Array.isArray(flat)) {
    for (const it of flat) {
      if (typeof it === 'string') {
        pushIf(it);
      } else if (it && typeof it === 'object') {
        const obj = it as { file?: unknown; desc?: unknown; url?: unknown; caption?: unknown };
        // Image source
        const f =
          typeof obj.file === 'string'
            ? obj.file
            : typeof obj.url === 'string'
              ? obj.url
              : undefined;

        // Image description (caption)
        const d =
          typeof obj.desc === 'string'
            ? obj.desc
            : typeof obj.caption === 'string'
              ? obj.caption
              : '';
        pushIf(f, d);
      }
    }
  }

  // Use cover image from the project card when no preview is available.
  if (slides.length === 0 && typeof cover === 'string' && cover.trim()) {
    slides.push({ src: cover, caption: '' });
  }
  return slides;
}

/**
 * Renders a image carousel.
 *
 * @param props Component props.
 * @param props.slides A slide contains src (file) and description (caption).
 * @param props.alt Base alt text.
 * @param props.interval Time in milliseconds before switching slides.
 * @returns A image carousel element.
 */
function ImageCarousel({
  slides,
  alt,
  interval = 7500,
}: {
  slides: { src: string; caption: string }[];
  alt: string;
  interval?: number;
}) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const startX = useRef<number | null>(null);

  // Reset index when current index goes out of range.
  useEffect(() => {
    if (idx >= slides.length) setIdx(0);
  }, [slides.length, idx]);

  // Change to different slides after the set interval.
  useEffect(() => {
    // Proceed if theres more than one image and is not paused.
    if (slides.length <= 1 || paused) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [slides.length, interval, paused]);

  const prev = () => setIdx((i) => (i - 1 + slides.length) % slides.length);
  const next = () => setIdx((i) => (i + 1) % slides.length);

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (Math.abs(dx) > 40) (dx < 0 ? next : prev)();
    startX.current = null;
  };

  return (
    <div className="w-full">
      <div
        className="relative w-full overflow-hidden rounded-xl ring-1 ring-gray-200 aspect-[16/9]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {slides.map((s, j) => (
          <div
            key={`${s.src}-${j}`}
            className={`absolute inset-0 transition-opacity duration-500 ${j === idx ? 'opacity-100' : 'opacity-0'}`}
          >
            <Image
              src={s.src}
              alt={s.caption || `${alt} ${j + 1}/${slides.length}`}
              fill
              className="contain"
              sizes="100vw"
              priority={j === 0}
            />
            {s.caption && (
              <p className="absolute bottom-0 left-0 bg-black/90 text-white text-sm px-3 py-2 rounded-tr-lg">
                {s.caption}
              </p>
            )}
          </div>
        ))}

        {slides.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Previous"
              className="absolute flex justify-center text-center items-center left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 w-10 h-10 text-gray-800 shadow hover:bg-white"
            >
              ←
            </button>
            <button
              onClick={next}
              aria-label="Next"
              className="absolute flex justify-center text-center items-center right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/70 w-10 h-10 text-gray-800 shadow hover:bg-white"
            >
              →
            </button>
          </>
        )}
      </div>

      {slides.length > 1 && (
        <div className="mt-2 flex items-center justify-start gap-2 overflow-x-auto snap-x snap-mandatory">
          {slides.map((s, j) => (
            <button
              key={`thumb-${s.src}-${j}`}
              onClick={() => setIdx(j)}
              className={`relative w-20 h-14 md:w-24 md:h-16 shrink-0 rounded overflow-hidden border-2 transition snap-start ${
                j === idx ? 'border-blue-500' : 'border-transparent hover:border-gray-300'
              }`}
              aria-label={`Go to slide ${j + 1}`}
            >
              <Image
                src={s.src}
                alt={s.caption || `${alt} thumbnail ${j + 1}`}
                fill
                className="object-cover"
                sizes="100vw"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
