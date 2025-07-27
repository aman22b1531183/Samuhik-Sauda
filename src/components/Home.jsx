// src/components/Home.jsx
import React from 'react';
import './Home.css'; // Import custom CSS for this component

// --- IMPORT YOUR IMAGES FROM src/assets HERE ---
// Example: Assuming you have images in src/assets/
import heroImage from '../assets/food.jpeg'; // Update with your actual image path and name
import vendorCollabImage from '../assets/vendor.jpeg'; // Update with your actual image path and name
import trustedSuppliersImage from '../assets/trust.jpeg'; // Update with your actual image path and name
import bulkDiscountsImage from '../assets/offer.jpeg'; // Update with your actual image path and name
// --- END IMAGE IMPORTS ---


function Home({ onLoginClick, onRegisterClick, user }) { // Accept user prop here
  // Conditional rendering for login/register buttons on Home page
  const renderAuthButtons = !user; // Only show auth buttons if user is NOT logged in

  return (
    <div className="home-container">
      <section className="hero-section">
        <div className="hero-content">
          <h2 className="hero-title">Connecting Street Food Vendors with Trusted Supplies</h2>
          <p className="hero-subtitle">
            Samuhik Sauda empowers Indian street food vendors by facilitating collective bargaining for raw materials,
            ensuring quality, affordability, and trust.
          </p>
        </div>
        <div className="hero-image">
          <img src={heroImage} alt="Vibrant Indian Street Food" /> {/* Use imported image */}
        </div>
      </section>

      <section className="about-section">
        <h3 className="section-heading">Our Mission</h3>
        <p className="section-description">
          In India's bustling street food scene, vendors often struggle with sourcing raw materials.
          We provide a digital platform where vendors can pool their demands to get bulk discounts
          from trusted suppliers, overcoming issues of quality, pricing, and availability.
        </p>
        <div className="about-features">
          <div className="feature-card">
            <img src={vendorCollabImage} alt="Vendor Collaboration" /> {/* Use imported image */}
            <h4>Vendor Collaboration</h4>
            <p>Join forces with other vendors in your area to unlock better prices.</p>
          </div>
          <div className="feature-card">
            <img src={trustedSuppliersImage} alt="Trusted Suppliers" /> {/* Use imported image */}
            <h4>Trusted Suppliers</h4>
            <p>Access a network of verified suppliers offering quality raw materials.</p>
          </div>
          <div className="feature-card">
            <img src={bulkDiscountsImage} alt="Bulk Discounts" /> {/* Use imported image */}
            <h4>Bulk Discounts</h4>
            <p>Benefit from aggregated demand to secure competitive pricing.</p>
          </div>
        </div>
      </section>

      <section className="how-it-works-section">
        <h3 className="section-heading">How It Works</h3>
        <div className="steps-grid">
          <div className="step-card">
            <span className="step-number">1</span>
            <h4>Create or Join a Deal</h4>
            <p>Vendors initiate new group buy requests or join existing ones for specific items.</p>
          </div>
          <div className="step-card">
            <span className="step-number">2</span>
            <h4>Suppliers Offer</h4>
            <p>Once a deal meets its target, suppliers submit competitive offers.</p>
          </div>
          <div className="step-card">
            <span className="step-number">3</span>
            <h4>Vendor Accepts</h4>
            <p>The deal creator reviews offers and accepts the best one, closing the deal.</p>
          </div>
          <div className="step-card">
            <span className="step-number">4</span>
            <h4>Connect & Transact</h4>
            <p>Contact information is shared for seamless offline delivery and payment.</p>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <h3 className="section-heading">Ready to Transform Your Sourcing?</h3>
        <p>Join Samuhik Sauda today and experience the power of collective buying!</p>
        {renderAuthButtons && ( // Conditionally render CTA buttons
          <div className="cta-buttons">
            <button onClick={onRegisterClick} className="cta-register-button">Register Now</button>
            <button onClick={onLoginClick} className="cta-login-button">Login</button>
          </div>
        )}
        {!renderAuthButtons && ( // Show a message if logged in
            <p className="cta-logged-in-message">You are logged in. Explore your dashboard!</p>
        )}
      </section>
    </div>
  );
}

export default Home;
