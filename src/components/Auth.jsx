// src/components/Auth.jsx
import React, { useState } from 'react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../firebaseConfig';
import './Auth.css'; // Import your custom CSS file for Auth component

function Auth({ showNotification }) { // Accept showNotification prop
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('vendor'); // Default role
  const [isRegistering, setIsRegistering] = useState(true); // Toggle between register/login
  const [loading, setLoading] = useState(false); // New loading state

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true); // Start loading

    try {
      if (isRegistering) {
        // Register
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Save user role to Firestore
        await setDoc(doc(db, "users", user.uid), {
          email: user.email,
          role: role,
          createdAt: new Date(),
        });
        showNotification('Registration successful! Please login.', 'success'); // Use notification
        setEmail('');
        setPassword('');
        setIsRegistering(false); // Switch to login after successful registration

      } else {
        // Login
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Login successful! Redirecting to dashboard...', 'success'); // Use notification
        // App.jsx will handle redirection because of onAuthStateChanged listener
      }
    } catch (err) {
      console.error("Auth error:", err.message);
      let errorMessage = "Authentication failed. Please try again.";
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = 'Email already in use. Try logging in.';
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password should be at least 6 characters.';
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errorMessage = 'Invalid email or password.';
      }
      showNotification(errorMessage, 'error'); // Use notification
    } finally {
      setLoading(false); // End loading
    }
  };

  return (
    <div className="auth-container">
      <h2 className="auth-title">
        {isRegistering ? 'Register' : 'Login'}
      </h2>
      <form onSubmit={handleAuth} className="auth-form">
        <div className="form-group">
          <label htmlFor="email">Email:</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="form-input"
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="form-input"
          />
        </div>
        {isRegistering && (
          <div className="form-group">
            <label htmlFor="role">Role:</label>
            <select
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="form-select"
            >
              <option value="vendor">Vendor</option>
              <option value="supplier">Supplier</option>
            </select>
          </div>
        )}
        <button
          type="submit"
          className="auth-button"
          disabled={loading}
        >
          {loading ? (isRegistering ? 'Registering...' : 'Logging In...') : (isRegistering ? 'Register' : 'Login')}
        </button>
      </form>
      <p className="auth-toggle-text">
        {isRegistering ? (
          <>
            Already have an account?{' '}
            <button
              onClick={() => { setIsRegistering(false); }}
              className="auth-toggle-button"
            >
              Login
            </button>
          </>
        ) : (
          <>
            Don't have an account?{' '}
            <button
              onClick={() => { setIsRegistering(true); }}
              className="auth-toggle-button"
            >
              Register
            </button>
          </>
        )}
      </p>
    </div>
  );
}

export default Auth;
