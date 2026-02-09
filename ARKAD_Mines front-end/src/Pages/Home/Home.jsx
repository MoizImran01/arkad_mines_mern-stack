import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './Home.css';
import heroImage from '../../assets/factory.jpg';
import featureImage from '../../assets/light-counter.jpg';
import mineralsImage from '../../assets/black-counter.jpg';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

const Home = () => {
  const mainRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const pre = document.querySelector('.preloader');
      if (pre) pre.style.display = 'none';
      document.body.style.overflow = '';
    }

    const ctx = gsap.context(() => {
      const navEntry = performance.getEntriesByType('navigation')[0];
      const isPageRefresh = navEntry?.type === 'reload' || 
                          (typeof performance.navigation !== 'undefined' && performance.navigation.type === 1);
      
      const referrer = document.referrer;
      const currentUrl = window.location.href;
      const referrerPath = referrer ? new URL(referrer).pathname : '';
      const currentPath = new URL(currentUrl).pathname;
      
      const isClientNavigation = referrer && 
                                referrer.includes(window.location.origin) &&
                                referrerPath !== currentPath &&
                                referrerPath !== '/';
      
      if (isPageRefresh || (!isClientNavigation && !sessionStorage.getItem('arkad_preloader_shown'))) {
        document.body.style.overflow = 'hidden';
        sessionStorage.setItem('arkad_preloader_shown', 'true');

        const preTl = gsap.timeline({ onComplete: initPage });
        preTl
          .from('.preloader-letter', {
            yPercent: 120,
            duration: 0.75,
            ease: 'power4.out',
            stagger: 0.035,
          })
          .from(
            '.preloader-rule',
            { scaleX: 0, duration: 0.55, ease: 'power2.inOut' },
            '-=0.25'
          )
          .from(
            '.preloader-sub',
            { yPercent: 100, duration: 0.45, ease: 'power3.out' },
            '-=0.15'
          )
          .to({}, { duration: 0.5 })
          .to('.preloader-content', { opacity: 0, duration: 0.3 })
          .to(
            '.preloader',
            { yPercent: -100, duration: 0.85, ease: 'power3.inOut' },
            '-=0.1'
          )
          .set('.preloader', { display: 'none' });
      } else {
        const pre = document.querySelector('.preloader');
        if (pre) pre.style.display = 'none';
        document.body.style.overflow = '';
        initPage();
      }

      function initPage() {
        document.body.style.overflow = '';

        const preloaderShown = document.querySelector('.preloader')?.style.display !== 'none';
        if (!preloaderShown) {
          gsap.from('.navbar-container', {
            y: -50,
            opacity: 0,
            duration: 0.65,
            ease: 'power3.out',
          });
        }

        const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });
        heroTl
          .from('.hero-eyebrow-inner', { yPercent: 110, duration: 0.55 })
          .from(
            '.hero-word',
            { yPercent: 115, duration: 0.8, stagger: 0.03 },
            '-=0.2'
          )
          .from(
            '.hero-rule',
            { scaleX: 0, duration: 0.65, ease: 'power2.inOut' },
            '-=0.4'
          )
          .from(
            '.hero-lede-line',
            { yPercent: 110, opacity: 0, duration: 0.5, stagger: 0.06 },
            '-=0.3'
          )
          .from('.hero-actions', { y: 18, opacity: 0, duration: 0.45 }, '-=0.2')
          .from(
            '.hero-meta > div',
            { y: 12, opacity: 0, stagger: 0.08, duration: 0.35 },
            '-=0.25'
          );

        gsap.fromTo(
          '.media-card',
          { clipPath: 'inset(100% 0 0 0)' },
          {
            clipPath: 'inset(0% 0 0 0)',
            duration: 1.2,
            ease: 'power3.inOut',
            delay: 0.2,
          }
        );
        gsap.fromTo(
          '.media-accent',
          { clipPath: 'inset(0 100% 0 0)' },
          {
            clipPath: 'inset(0 0% 0 0)',
            duration: 1,
            ease: 'power3.inOut',
            delay: 0.6,
          }
        );

        gsap.to('.media-accent', {
          y: -12,
          duration: 3.2,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
        gsap.to('.hero-orb-one', {
          y: -30,
          x: 12,
          duration: 5.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });
        gsap.to('.hero-orb-two', {
          y: 20,
          x: -12,
          duration: 6.5,
          repeat: -1,
          yoyo: true,
          ease: 'sine.inOut',
        });

        document.querySelectorAll('.scroll-words').forEach((el) => {
          const words = el.querySelectorAll('.sw');
          gsap.from(words, {
            yPercent: 110,
            duration: 0.65,
            stagger: 0.025,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 82%' },
          });
        });

        document.querySelectorAll('.rule-anim').forEach((el) => {
          gsap.from(el, {
            scaleX: 0,
            duration: 0.75,
            ease: 'power2.inOut',
            scrollTrigger: { trigger: el, start: 'top 88%' },
          });
        });

        document.querySelectorAll('.clip-up').forEach((el) => {
          gsap.fromTo(
            el,
            { clipPath: 'inset(100% 0 0 0)' },
            {
              clipPath: 'inset(0% 0 0 0)',
              duration: 1.1,
              ease: 'power3.inOut',
              scrollTrigger: { trigger: el, start: 'top 78%' },
            }
          );
        });

        document.querySelectorAll('.fade-up').forEach((el) => {
          gsap.from(el, {
            y: 35,
            opacity: 0,
            duration: 0.75,
            ease: 'power2.out',
            scrollTrigger: { trigger: el, start: 'top 83%' },
          });
        });

        document.querySelectorAll('.stagger-up').forEach((group) => {
          const items = group.querySelectorAll('.su-item');
          gsap.from(items, {
            y: 50,
            opacity: 0,
            rotateX: 5,
            transformPerspective: 800,
            duration: 0.7,
            stagger: 0.1,
            ease: 'power3.out',
            scrollTrigger: { trigger: group, start: 'top 80%' },
          });
        });

        document.querySelectorAll('.parallax-img').forEach((img) => {
          const wrapper =
            img.closest('.media-card') ||
            img.closest('.media-accent') ||
            img.closest('.highlight-media');
          if (!wrapper) return;
          gsap.to(img, {
            yPercent: -10,
            ease: 'none',
            scrollTrigger: {
              trigger: wrapper,
              start: 'top bottom',
              end: 'bottom top',
              scrub: true,
            },
          });
        });
      }
    }, mainRef);

    return () => {
      document.body.style.overflow = '';
      ctx.revert();
    };
  }, []);

  const hw = (text) =>
    text.split(' ').map((w, i) => (
      <span className="wm" key={i}>
        <span className="hero-word">{w}</span>{' '}
      </span>
    ));

  const scrollW = (text) =>
    text.split(' ').map((w, i) => (
      <span className="swm" key={i}>
        <span className="sw">{w}</span>{' '}
      </span>
    ));

  return (
    <main className="home" ref={mainRef}>
      <div className="preloader">
        <div className="preloader-content">
          <div className="preloader-text">
            {'ARKAD'.split('').map((c, i) => (
              <span className="pl-mask" key={`a${i}`}>
                <span className="preloader-letter">{c}</span>
              </span>
            ))}
            <span className="pl-space" />
            {'MINES'.split('').map((c, i) => (
              <span className="pl-mask" key={`m${i}`}>
                <span className="preloader-letter">{c}</span>
              </span>
            ))}
          </div>
          <div className="preloader-rule" />
          <div className="pl-sub-mask">
            <p className="preloader-sub">Engineered Mineral Solutions</p>
          </div>
        </div>
      </div>

      <section className="landing-hero">
        <div className="landing-container hero-grid">
          <div className="hero-copy">
            <div className="hero-eyebrow-mask">
            
            </div>

            <h1 className="hero-title">
              {hw(
                'Premium Stone & Minerals. Tracked from Quarry to Port.'
              )}
            </h1>

            <div className="hero-rule" />

            <div className="hero-lede">
              <div className="lede-mask">
                <span className="hero-lede-line">
                A unified digital platform for inventory, sales, and operational intelligence.
                </span>
              </div>
              <div className="lede-mask">
                <span className="hero-lede-line">
                Browse real-time inventory, and get instant B2B quotes.
                </span>
              </div>
              <div className="lede-mask">
                <span className="hero-lede-line">
                  Quality standards paired with responsive, dependable service.
                </span>
              </div>
            </div>

            <div className="hero-actions">
              <Link className="btn-primary" to="/request-quote">
                Get started
              </Link>
              <Link className="btn-secondary" to="/industries">
                Explore industries
              </Link>
            </div>

            <div className="hero-meta">
              <div>
                <strong>10+ years</strong>
                <span>of combined mining expertise</span>
              </div>
              <div>
                <strong>120k+ tons</strong>
                <span>delivered annually</span>
              </div>
              <div>
                <strong>ISO-aligned</strong>
                <span>quality &amp; compliance</span>
              </div>
            </div>
          </div>

          <div className="hero-media">
            <div className="media-card">
              <img
                src={heroImage}
                alt="Arkad Mines processing facility"
                className="parallax-img"
              />
              <div className="media-overlay">
                <p>Engineered materials with dependable traceability.</p>
                <Link to="/about">Learn about Arkad Mines</Link>
              </div>
            </div>
            <div className="media-accent">
              <img
                src={featureImage}
                alt="Refined stone surface samples"
                className="parallax-img"
              />
              <div className="media-caption">
                <span>Precision finishing</span>
                <strong>Custom cuts &amp; blends</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="hero-gradient" aria-hidden="true" />
        <div className="hero-orb hero-orb-one" aria-hidden="true" />
        <div className="hero-orb hero-orb-two" aria-hidden="true" />
      </section>

      <section className="landing-intro">
        <div className="landing-container intro-grid">
          <div className="intro-card">
            <h2 className="scroll-words st">
              {scrollW("Pakistan's First Tech-Enabled Mineral Marketplace")}
            </h2>
            <div className="rule-anim section-rule" />
            <p className="fade-up">
            Streamlining procurement with a unified digital platform. Access real-time stock levels 
    from our quarries, generate instant quotes, and track your orders from dispatch to 
    delivery with total transparency
            </p>
          </div>
          <div className="intro-stats stagger-up">
            <div className="stat su-item">
              <h3>97%</h3>
              <p>On-time fulfillment across multi-site programs.</p>
            </div>
            <div className="stat su-item">
              <h3>31 days</h3>
              <p>Average turnaround from spec to shipment.</p>
            </div>
            <div className="stat su-item">
              <h3>4+ regions</h3>
              <p>Operations across Pakistan.</p>
            </div>
            <div className="stat su-item">
              <h3>24/7 Support</h3>
              <p>For authorized users</p>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-offers">
        <div className="landing-container">
          <div className="section-header">
            <span className="eyebrow fade-up">Ways we support your growth</span>
            <h2 className="scroll-words st">
              {scrollW(
                'Materials and services built for ambitious operations.'
              )}
            </h2>
            <div className="rule-anim section-rule" />
          </div>
          <div className="offer-grid stagger-up">
            <article className="offer-card su-item">
              <h3>Your next supply program</h3>
              <p>
                Secure multi-year contracts with traceability and price
                stability, designed for large-scale infrastructure builds.
              </p>
              <Link to="/request-quote">Request a supply plan &rarr;</Link>
            </article>
            <article className="offer-card su-item">
              <h3>Custom processing</h3>
              <p>
                Precision cutting, grading, and blending for stone, aggregate,
                and specialty mineral applications.
              </p>
              <Link to="/products">Browse catalog &rarr;</Link>
            </article>
            <article className="offer-card su-item">
              <h3>Logistics &amp; compliance</h3>
              <p>
                Dedicated coordination for port-to-site delivery, with
                regulatory documentation and ESG reporting.
              </p>
              <Link to="/contact">Talk with logistics &rarr;</Link>
            </article>
            <article className="offer-card su-item">
              <h3>Strategic partnerships</h3>
              <p>
                Collaborate on new materials, alternative sourcing, and product
                innovation with our technical advisory team.
              </p>
              <Link to="/about">Meet our team &rarr;</Link>
            </article>
          </div>
        </div>
      </section>

      <section className="landing-highlight">
        <div className="landing-container highlight-grid">
          <div className="highlight-media clip-up">
            <img
              src={mineralsImage}
              alt="Polished minerals and stone samples"
              className="parallax-img"
            />
          </div>
          <div className="highlight-copy">
            <span className="eyebrow fade-up">Industry insights</span>
            <h2 className="scroll-words st">
              {scrollW(
                "Unearthing what's next in mining, construction, and energy."
              )}
            </h2>
            <div className="rule-anim section-rule" />
            <p className="fade-up">
              From quarry innovation to advanced material science, we track the
              macro trends shaping procurement and sustainability. Our teams
              translate those signals into measurable improvements for your
              business.
            </p>
            <div className="highlight-links fade-up">
              <Link to="/about">Read our story &rarr;</Link>
              <Link to="/contact">Book a consultation &rarr;</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="landing-tech">
  <div className="landing-container">
    <div className="section-header">
      <span className="eyebrow fade-up">Powered by Intelligence</span>
      <h2 className="scroll-words st">
        {scrollW('A modern stack for a traditional industry.')}
      </h2>
      {/* Added the separator line for consistency */}
      <div className="rule-anim section-rule" />
    </div>

    <div className="offer-grid stagger-up"> 
      <article className="offer-card su-item">
        <h3>AI Forecasting</h3>
        <p>Our predictive models optimize stock levels to ensure we always have what you need.</p>
      </article>

      <article className="offer-card su-item">
        <h3>Instant B2B Quotes</h3>
        <p>Get instant quotes for your projects in real-time.</p>
      </article>

      <article className="offer-card su-item">
        <h3>Live Dashboards</h3>
        <p>Real-time financial reporting and order status tracking for total transparency.</p>
      </article>
    </div>
  </div>
</section>

      <section className="landing-contact">
        <div className="landing-container contact-grid">
          <div className="contact-copy">
            <span className="eyebrow fade-up">Let&apos;s talk</span>
            <h2 className="scroll-words st">
              {scrollW("Tell us what you're building next.")}
            </h2>
            <div className="rule-anim section-rule" />
            <p className="fade-up">
              We&apos;ll match you with a materials specialist to scope your
              requirements, recommend options, and map a delivery plan.
            </p>
            <div className="contact-details fade-up">
              <div>
                <strong>Head Office</strong>
                <span>DHA Phase 6, Lahore, Pakistan</span>
              </div>
              <div>
                <strong>Operations</strong>
                <span>Jebel Ali Port &bull; Karachi &bull; Islamabad</span>
              </div>
              <div>
                <strong>Email</strong>
                <span>arkadmines@gmail.com</span>
              </div>
            </div>
          </div>
          <form className="contact-form fade-up">
            <label>
              First name
              <input type="text" placeholder="Your first name" />
            </label>
            <label>
              Surname
              <input type="text" placeholder="Your last name" />
            </label>
            <label>
              Company name
              <input type="text" placeholder="Your company name" />
            </label>
            <label>
              Email address
              <input type="email" placeholder="Your email address" />
            </label>
            <label>
              How can we help?
              <textarea rows="4" placeholder="Tell us about your project." />
            </label>
            <button className="btn-primary" type="button">
              Submit
            </button>
          </form>
        </div>
      </section>

      <section className="landing-footer">
        <div className="landing-container footer-grid">
          <div>
            <h3>Arkad Mines</h3>
            <p>
              Engineered mineral solutions for construction, energy, and
              manufacturing partners worldwide.
            </p>
          </div>
          <div className="footer-links">
            <Link to="/products">Products</Link>
            <Link to="/industries">Industries</Link>
            <Link to="/about">Company</Link>
            <Link to="/contact">Contact</Link>
          </div>
        </div>
      </section>
    </main>
  );
};

export default Home;
