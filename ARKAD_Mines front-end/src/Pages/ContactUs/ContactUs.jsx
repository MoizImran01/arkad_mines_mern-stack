"use client"

import { useState, useEffect, useContext } from "react"
import PropTypes from "prop-types"
import { useNavigate } from "react-router-dom"
import { Phone, Mail, MapPin, Clock, Copy, Check, Send, MessageSquare, Building, Users } from "lucide-react"
import { StoreContext } from "../../context/StoreContext"
import "./ContactUs.css"

function ContactUs({ setShowLogin }) {
  const [isVisible, setIsVisible] = useState({});
  const [copied, setCopied] = useState(false);
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [phoneRotation, setPhoneRotation] = useState({ x: 0, y: 0 });
  const navigate = useNavigate();
  const { token } = useContext(StoreContext);
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: ''
  });

  const phoneNumber = "+92 300 1234567";

  useEffect(() => {
    const handleMouseMove = (e) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 20;
      const y = (e.clientY / window.innerHeight - 0.5) * 20;
      setPhoneRotation({ x: -y, y: x });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

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
      icon: <MapPin size={24} />,
      title: "Visit Us",
      content: "Industrial Area, Peshawar, KPK, Pakistan",
      subtext: "Factory & Showroom"
    },
    {
      icon: <Phone size={24} />,
      title: "Call Us",
      content: phoneNumber,
      subtext: "Mon-Sat, 9AM-6PM"
    },
    {
      icon: <Mail size={24} />,
      title: "Email Us",
      content: "info@arkadmines.com",
      subtext: "24hr Response Time"
    },
    {
      icon: <Clock size={24} />,
      title: "Business Hours",
      content: "Mon - Sat: 9AM - 6PM",
      subtext: "Sunday Closed"
    },
  ];

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(phoneNumber.replaceAll(' ', ''));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQuoteClick = () => {
    if (token) {
      navigate('/request-quote');
    } else {
      setShowLoginPrompt(true);
    }
  };

  const handleLoginClick = () => {
    setShowLoginPrompt(false);
    if (setShowLogin) {
      setShowLogin(true);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!token) {
      setShowLoginPrompt(true);
      return;
    }
    console.log(formData);
  };

  const AnimatedWave = ({ fill = "#f9fafb", className = "" }) => (
    <svg className={className} viewBox="0 0 2880 120" preserveAspectRatio="none">
      <path 
        fill={fill} 
        d="M0,64 C320,128 640,0 960,64 C1280,128 1600,0 1920,64 C2240,128 2560,0 2880,64 L2880,120 L0,120 Z"
      >
        <animate
          attributeName="d"
          dur="8s"
          repeatCount="indefinite"
          values="
            M0,64 C320,128 640,0 960,64 C1280,128 1600,0 1920,64 C2240,128 2560,0 2880,64 L2880,120 L0,120 Z;
            M0,96 C320,32 640,128 960,64 C1280,0 1600,128 1920,64 C2240,0 2560,128 2880,64 L2880,120 L0,120 Z;
            M0,64 C320,128 640,0 960,64 C1280,128 1600,0 1920,64 C2240,128 2560,0 2880,64 L2880,120 L0,120 Z
          "
        />
      </path>
    </svg>
  );

  AnimatedWave.propTypes = {
    fill: PropTypes.string,
    className: PropTypes.string,
  };

  return (
    <div className="contact-page-pro">
      <section className="contact-hero-pro">
        <div className="hero-container-pro">
          <div className="hero-content-pro">
            <span className="hero-label">Contact Us</span>
            <h1 className="hero-title-pro">
              Let's Start a <span className="highlight">Conversation</span>
            </h1>
            <p className="hero-description-pro">
              Have questions about our granite products or need a custom quote? 
              Our team of experts is ready to assist you with all your stone requirements.
            </p>
            
            <div className="hero-stats-pro">
              <div className="stat-item-pro">
                <span className="stat-number-pro">24/7</span>
                <span className="stat-label-pro">Support Available</span>
              </div>
              <div className="stat-divider-pro"></div>
              <div className="stat-item-pro">
                <span className="stat-number-pro">&lt;2hr</span>
                <span className="stat-label-pro">Response Time</span>
              </div>
              <div className="stat-divider-pro"></div>
              <div className="stat-item-pro">
                <span className="stat-number-pro">100%</span>
                <span className="stat-label-pro">Satisfaction</span>
              </div>
            </div>
          </div>

          <div className="hero-visual-pro">
            <div 
              className="phone-3d-container"
              style={{
                transform: `perspective(1000px) rotateX(${phoneRotation.x}deg) rotateY(${phoneRotation.y}deg)`
              }}
            >
              <div className="phone-3d">
                <div className="phone-screen">
                  <div className="phone-notch"></div>
                  <div className="phone-content">
                    <Phone size={40} className="phone-icon-animated" />
                    <span className="phone-text">Call Now</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        <div className="hero-wave-animated">
          <AnimatedWave fill="#f9fafb" />
        </div>
      </section>

      <section className="contact-info-pro animate-section" id="info">
        <div className="animated-wave-top">
          <AnimatedWave fill="#ffffff" />
        </div>
        
        <div className={`section-container ${isVisible["info"] ? "visible" : ""}`}>
          <div className="section-header-pro">
            <h2>Get In Touch</h2>
            <p>Choose your preferred method of contact</p>
          </div>
          
          <div className="contact-grid-pro">
            {contactInfo.map((info) => (
              <div 
                key={info.title} 
                className="contact-card-pro"
              >
                <div className="card-icon-pro">
                  {info.icon}
                </div>
                <div className="card-content-pro">
                  <h3>{info.title}</h3>
                  <p className="card-main-text">{info.content}</p>
                  <span className="card-subtext">{info.subtext}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div className="animated-wave-bottom">
          <AnimatedWave fill="#ffffff" />
        </div>
      </section>

      <section className="contact-form-pro animate-section" id="form">
        <div className={`form-section-container ${isVisible["form"] ? "visible" : ""}`}>
          <div className="form-info-side">
            <h2>Send Us a Message</h2>
            <p>
              Fill out the form and our team will get back to you within 24 hours. 
              We're committed to providing you with the best service possible.
            </p>
            
            <div className="form-features">
              <div className="feature-item">
                <MessageSquare size={20} />
                <div>
                  <h4>Quick Response</h4>
                  <p>We respond to all inquiries within 24 hours</p>
                </div>
              </div>
              <div className="feature-item">
                <Users size={20} />
                <div>
                  <h4>Expert Team</h4>
                  <p>Our specialists will address your specific needs</p>
                </div>
              </div>
              <div className="feature-item">
                <Building size={20} />
                <div>
                  <h4>Factory Direct</h4>
                  <p>Get the best prices directly from the source</p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="form-card-pro">
            <form onSubmit={handleSubmit}>
              <div className="form-row-pro">
                <div className="form-group-pro">
                  <label htmlFor="name">Full Name</label>
                  <input 
                    type="text" 
                    id="name" 
                    placeholder="Enter your name"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    required
                  />
                </div>
                <div className="form-group-pro">
                  <label htmlFor="email">Email Address</label>
                  <input 
                    type="email" 
                    id="email" 
                    placeholder="Enter your email"
                    value={formData.email}
                    onChange={(e) => setFormData({...formData, email: e.target.value})}
                    required
                  />
                </div>
              </div>
              
              <div className="form-row-pro">
                <div className="form-group-pro">
                  <label htmlFor="phone">Phone Number</label>
                  <input 
                    type="tel" 
                    id="phone" 
                    placeholder="+92 XXX XXXXXXX"
                    value={formData.phone}
                    onChange={(e) => setFormData({...formData, phone: e.target.value})}
                  />
                </div>
                <div className="form-group-pro">
                  <label htmlFor="subject">Subject</label>
                  <input 
                    type="text" 
                    id="subject" 
                    placeholder="How can we help?"
                    value={formData.subject}
                    onChange={(e) => setFormData({...formData, subject: e.target.value})}
                  />
                </div>
              </div>
              
              <div className="form-group-pro">
                <label htmlFor="message">Your Message</label>
                <textarea 
                  id="message" 
                  rows="5" 
                  placeholder="Tell us about your granite requirements..."
                  value={formData.message}
                  onChange={(e) => setFormData({...formData, message: e.target.value})}
                  required
                ></textarea>
              </div>
              
              <button type="submit" className="submit-btn-pro">
                <Send size={18} />
                Send Message
              </button>
            </form>
          </div>
        </div>
      </section>

      <section className="faq-section-pro animate-section" id="faq">
        <div className="animated-wave-top">
          <AnimatedWave fill="#ffffff" />
        </div>
        
        <div className={`section-container ${isVisible["faq"] ? "visible" : ""}`}>
          <div className="section-header-pro">
            <h2>Frequently Asked Questions</h2>
            <p>Find quick answers to common questions</p>
          </div>
          
          <div className="faq-grid-pro">
            <div className="faq-item-pro">
              <h3>What types of granite do you offer?</h3>
              <p>We offer 12+ premium varieties including Chatral, White Fantasy, Golden Tiger, Kashmir White, and more. All stones are sourced from premium quarries.</p>
            </div>
            <div className="faq-item-pro">
              <h3>Do you provide nationwide delivery?</h3>
              <p>Yes, we deliver across Pakistan with careful packaging to ensure safe transit. Delivery times vary based on location and order size.</p>
            </div>
            <div className="faq-item-pro">
              <h3>How can I get a custom quote?</h3>
              <p>You can request a quote through our online form, call us directly, or visit our showroom. We provide detailed quotes within 24 hours.</p>
            </div>
            <div className="faq-item-pro">
              <h3>Do you offer custom cutting services?</h3>
              <p>Yes, we provide precision cutting to your exact specifications using state-of-the-art European machinery for perfect edges every time.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section-pro">
        <div className="animated-wave-top">
          <AnimatedWave fill="#f9fafb" />
        </div>
        
        <div className="cta-container-pro">
          <div className="cta-content-pro">
            <h2>Ready to Start Your Project?</h2>
            <p>Get premium quality granite at competitive prices. Our team is ready to help you find the perfect stone for your needs.</p>
            <div className="cta-buttons-pro">
              <button className="cta-primary-pro" onClick={handleQuoteClick}>
                Request a Quote
              </button>
              <button className="cta-secondary-pro" onClick={handleCopyNumber}>
                {copied ? <Check size={18} /> : <Phone size={18} />}
                {copied ? "Copied!" : "Call Now"}
              </button>
            </div>
          </div>
        </div>
      </section>

      {showLoginPrompt && (
        <div 
          className="login-prompt-overlay-pro" 
          onClick={() => setShowLoginPrompt(false)}
          onKeyDown={(e) => e.key === 'Escape' && setShowLoginPrompt(false)}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
        >
          <div 
            className="login-prompt-modal-pro" 
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            role="document"
          >
            <button className="close-prompt-pro" onClick={() => setShowLoginPrompt(false)}>
              <span>×</span>
            </button>
            <div className="prompt-header-pro">
              <div className="prompt-icon-pro">
                <Users size={32} />
              </div>
              <h3>Login Required</h3>
              <p>To request a quote, please log in or create an account first.</p>
            </div>
            <div className="prompt-buttons-pro">
              <button className="prompt-login-btn-pro" onClick={handleLoginClick}>
                Login / Register
              </button>
              <button className="prompt-cancel-btn-pro" onClick={() => setShowLoginPrompt(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

ContactUs.propTypes = {
  setShowLogin: PropTypes.func.isRequired,
}

export default ContactUs
