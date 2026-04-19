import { Link } from 'react-router-dom';
import './Footer.css';

/** Site-wide footer with links and company blurb. */
const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="site-footer-container">
        <div>
          <h3>Arkad Mines</h3>
          <p>
            Engineered mineral solutions for construction, energy, and
            manufacturing partners worldwide.
          </p>
        </div>
        <div className="site-footer-links">
          <Link to="/products">Products</Link>
          <Link to="/industries">Industries</Link>
          <Link to="/about">Company</Link>
          <Link to="/contact">Contact</Link>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
