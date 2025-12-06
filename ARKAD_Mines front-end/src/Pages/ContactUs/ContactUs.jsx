"use client"

import { useState, useEffect } from "react"
import { Link } from "react-router-dom"
import "./ContactUs.css"

export default function ContactUs() {
  const [isVisible, setIsVisible] = useState({});
  const [hoveredCard, setHoveredCard] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  });

  // Intersection Observer for animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible((prev) => ({ ...prev, [entry.target.id]: true }));
          }
        });
      },
      { threshold: 0.2 }
    );

    document.querySelectorAll(".animate-section").forEach((el) => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, []);

  const contactInfo = [
    {
      icon: "📍",
      title: "Visit Us",
      content: "Industrial Area, Peshawar, KPK, Pakistan",
      color: "#ef4444"
    },
    {
      icon: "📞",
      title: "Call Us",
      content: "+92 300 1234567",
      color: "#3b82f6"
    },
    {
      icon: "✉️",
      title: "Email Us",
      content: "info@arkadmines.com",
      color: "#10b981"
    },
    {
      icon: "⏰",
      title: "Business Hours",
      content: "Mon - Sat: 9AM - 6PM",
      color: "#f59e0b"
    },
  ]

  const socialLinks = [
    { icon: "📘", name: "Facebook", url: "#" },
    { icon: "📸", name: "Instagram", url: "#" },
    { icon: "🐦", name: "Twitter", url: "#" },
    { icon: "💼", name: "LinkedIn", url: "#" },
  ];

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle form submission
    console.log(formData);
  };

  return (
    <div className="contact-page">
      {/* Floating Elements */}
      <div className="floating-elements">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className="floating-particle" 
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 5}s`,
              animationDuration: `${4 + Math.random() * 4}s`
            }}
          />
        ))}
      </div>

      {/* Hero Section */}
      <section className="contact-hero">
        <div className="hero-bg-animation">
          <div className="wave wave-1"></div>
          <div className="wave wave-2"></div>
          <div className="wave wave-3"></div>
        </div>
        
        <div className="hero-shapes">
          <div className="shape shape-1"></div>
          <div className="shape shape-2"></div>
          <div className="shape shape-3"></div>
          <div className="shape shape-4"></div>
        </div>

        <div className="contact-hero-content">
          <div className="hero-badge">
            <span className="pulse-dot"></span>
            <span>We're here to help</span>
          </div>
          <h1 className="contact-hero-title">
            <span className="title-line">Get In</span>
            <span className="title-line highlight">Touch</span>
          </h1>
          <p className="contact-hero-subtitle">
            Have questions about our granite products? Need a custom quote? 
            Our team is ready to assist you with all your stone needs.
          </p>
          
          <div className="hero-stats">
            <div className="hero-stat">
              <span className="stat-value">24/7</span>
              <span className="stat-text">Support</span>
            </div>
            <div className="stat-divider"></div>
            <div className="hero-stat">
              <span className="stat-value">&lt;2hr</span>
              <span className="stat-text">Response</span>
            </div>
            <div className="stat-divider"></div>
            <div className="hero-stat">
              <span className="stat-value">100%</span>
              <span className="stat-text">Satisfaction</span>
            </div>
          </div>
        </div>

        {/* 3D Phone/Contact Element */}
        <div className="hero-3d-element">
          <div className="phone-3d">
            <div className="phone-body">
              <div className="phone-screen">
                <div className="screen-content">
                  <span className="screen-icon">📞</span>
                  <span className="screen-text">Call Now</span>
                </div>
              </div>
              <div className="phone-notch"></div>
            </div>
            <div className="phone-glow"></div>
          </div>
        </div>
      </section>

      {/* Contact Information Cards */}
      <section className="contact-info-section animate-section" id="info">
        <div className={`contact-info-container ${isVisible["info"] ? "visible" : ""}`}>
          <h2 className="section-title">
            <span className="title-icon">📬</span>
            Contact Information
          </h2>
          <p className="section-subtitle">Choose your preferred way to reach us</p>
          
          <div className="contact-info-grid">
            {contactInfo.map((info, index) => (
              <div 
                key={index} 
                className={`contact-info-card ${hoveredCard === index ? 'active' : ''}`}
                style={{ 
                  animationDelay: `${index * 0.15}s`,
                  '--card-color': info.color
                }}
                onMouseEnter={() => setHoveredCard(index)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div className="card-bg-effect"></div>
                <div className="info-icon-wrapper">
                  <span className="info-icon">{info.icon}</span>
                  <div className="icon-ripple"></div>
                  <div className="icon-ripple ripple-2"></div>
                </div>
                <h3 className="info-title">{info.title}</h3>
                <p className="info-content">{info.content}</p>
                <div className="card-shine"></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Form & Map Section */}
      <section className="contact-form-section animate-section" id="form">
        <div className={`form-container ${isVisible["form"] ? "visible" : ""}`}>
          <div className="form-wrapper">
            <div className="form-header">
              <span className="form-badge">✨ Quick Response Guaranteed</span>
              <h2>Send Us a Message</h2>
              <p>Fill out the form and our team will get back to you within 24 hours.</p>
            </div>
            
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="name">
                    <span className="label-icon">👤</span>
                    Your Name
                  </label>
                  <input 
                    type="text" 
                    id="name" 
                    placeholder="John Doe"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                  <div className="input-highlight"></div>
                </div>
                <div className="form-group">
                  <label htmlFor="email">
                    <span className="label-icon">✉️</span>
                    Email Address
                  </label>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="john@example.com"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                  <div className="input-highlight"></div>
                </div>
              </div>
              
              <div className="form-group">
                <label htmlFor="phone">
                  <span className="label-icon">📱</span>
                  Phone Number
                </label>
                <input 
                  type="tel" 
                  id="phone" 
                  placeholder="+92 300 1234567"
                  value={formData.phone}
                  onChange={(e) => setFormData({...formData, phone: e.target.value})}
                />
                <div className="input-highlight"></div>
              </div>
              
              <div className="form-group">
                <label htmlFor="message">
                  <span className="label-icon">💬</span>
                  Your Message
                </label>
                <textarea 
                  id="message" 
                  rows="5" 
                  placeholder="Tell us about your granite requirements..."
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                ></textarea>
                <div className="input-highlight"></div>
              </div>
              
              <button type="submit" className="submit-btn">
                <span className="btn-text">Send Message</span>
                <span className="btn-icon">🚀</span>
                <div className="btn-shine"></div>
              </button>
            </form>
          </div>
          
          <div className="map-wrapper">
            <div className="map-header">
              <h3>Find Us Here</h3>
              <p>Visit our factory in Peshawar</p>
            </div>
            <div className="map-container">
              <div className="map-placeholder">
                <div className="map-pin">
                  <span className="pin-icon">📍</span>
                  <div className="pin-pulse"></div>
                </div>
                <div className="map-grid">
                  {[...Array(25)].map((_, i) => (
                    <div key={i} className="grid-cell"></div>
                  ))}
                </div>
                <div className="map-label">ARKAD Mines Factory</div>
              </div>
            </div>
            
            {/* Social Links */}
            <div className="social-section">
              <h4>Follow Us</h4>
              <div className="social-links">
                {socialLinks.map((social, index) => (
                  <a 
                    key={index} 
                    href={social.url} 
                    className="social-link"
                    title={social.name}
                  >
                    <span className="social-icon">{social.icon}</span>
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="faq-section animate-section" id="faq">
        <div className={`faq-container ${isVisible["faq"] ? "visible" : ""}`}>
          <h2 className="section-title">
            <span className="title-icon">❓</span>
            Frequently Asked Questions
          </h2>
          
          <div className="faq-grid">
            <div className="faq-item">
              <div className="faq-icon">🪨</div>
              <h3>What types of granite do you offer?</h3>
              <p>We offer 12+ premium varieties including Chatral, White Fantasy, Golden Tiger, and more.</p>
            </div>
            <div className="faq-item">
              <div className="faq-icon">🚚</div>
              <h3>Do you provide delivery?</h3>
              <p>Yes, we deliver across Pakistan with careful packaging to ensure safe transit.</p>
            </div>
            <div className="faq-item">
              <div className="faq-icon">💰</div>
              <h3>How can I get a quote?</h3>
              <p>Fill out our contact form or call us directly for a customized quote.</p>
            </div>
            <div className="faq-item">
              <div className="faq-icon">🔧</div>
              <h3>Do you offer custom cutting?</h3>
              <p>Yes, we provide precision cutting to your exact specifications.</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="contact-cta">
        <div className="cta-content">
          <h2>Ready to Start Your Project?</h2>
          <p>Get premium quality granite at competitive prices</p>
          <div className="cta-buttons">
            <Link to="/request-quote" className="cta-primary">
              <span>Request Quote</span>
              <span className="cta-sparkle">✨</span>
            </Link>
            <a href="tel:+923001234567" className="cta-secondary">
              <span className="phone-icon">📞</span>
              <span>Call Now</span>
            </a>
          </div>
        </div>
        <div className="cta-decoration">
          <div className="deco-circle"></div>
          <div className="deco-circle"></div>
          <div className="deco-circle"></div>
        </div>
      </section>
    </div>
  )
}
