import { Link } from 'react-router-dom';
import "./HomePage.css"

const GITHUB_URL = "https://github.com/Monash-FIT3170/2026W1-Stowed";
const unusedTagline = "Inventory management, sorted.";

const FEATURES = [
  "Track inventory levels across every storage location",
  "Scan barcodes and QR codes to update stock on the go",
  "Build shopping lists and get low-stock alerts automatically",
  "See usage forecasts to know what to restock and when",
  "Map your floor plan so anyone can find where things are stored",
];

/**
 * Public pre-sign-in landing page.
 */
export const HomePage = () => {
  return (
    <div className="home-page">
      <header className="home-header">
        <span className="home-logo">Stowed</span>
        <nav className="home-nav">
          <Link to="/login">Log in</Link>
          <Link to="/register" className="home-nav-cta">
            Get started
          </Link>
        </nav>
      </header>

      <section className="home-hero">
          <h1>
          Inventory management, <em>sorted</em>.
        </h1>
        <p>Track and manage your inventory, all in one place.</p>
        <div className="home-hero-actions">
          <Link to="/register" className="home-btn home-btn-primary">
            Get started
          </Link>
          <Link to="/login" className="home-btn home-btn-secondary">
            Log in
          </Link>
        </div>
      </section>

      <ul className="home-features">
        {FEATURES.map((feature) => (
          <li key={feature}>{feature}</li>
        ))}
      </ul>

      <footer className="home-footer">
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          View on GitHub
        </a>
        <span>How to set up an organisation</span>
      </footer>
    </div>
  );
};
