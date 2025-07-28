// src/App.jsx

import React, { useState, useEffect } from 'react';
import './App.css'; // Import your custom CSS file for App component
import Auth from './components/Auth'; // Import your Auth component
import VendorDashboard from './components/VendorDashboard'; // Import Vendor Dashboard
import SupplierDashboard from './components/SupplierDashboard'; // Import Supplier Dashboard
import Home from './components/Home'; // <-- IMPORT HOME COMPONENT
import { auth, db } from './firebaseConfig'; // Import auth and db from your Firebase config
import { doc, getDoc } from 'firebase/firestore'; 
import { onAuthStateChanged } from 'firebase/auth';

function App() {
  const [user, setUser] = useState(null); // Stores Firebase user object
  const [userRole, setUserRole] = useState(null); // Stores 'vendor' or 'supplier'
  const [loading, setLoading] = useState(true); // Manages loading state during auth check
  const [notification, setNotification] = useState({ message: '', type: '' }); // New state for notifications
  const [showAuth, setShowAuth] = useState(false); // New state to toggle between Home and Auth

  // Function to show a notification
  const showNotification = (message, type = 'info') => {
    setNotification({ message, type });
    // Clear notification after a few seconds
    setTimeout(() => {
      setNotification({ message: '', type: '' });
    }, 5000); // Notification disappears after 5 seconds
  };

  // useEffect hook to listen for Firebase Authentication state changes
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        // User is logged in
        setUser(currentUser);
        setShowAuth(false); // Hide auth form if user logs in
        
        // Fetch user role from Firestore
        const userDocRef = doc(db, "users", currentUser.uid);
        try {
          const userDocSnap = await getDoc(userDocRef);
          if (userDocSnap.exists()) {
            setUserRole(userDocSnap.data().role);
          } else {
            console.warn("User document not found in Firestore for UID:", currentUser.uid);
            setUserRole(null);
          }
        } catch (error) {
          console.error("Error fetching user role from Firestore:", error);
          setUserRole(null);
        }
      } else {
        // User is logged out
        setUser(null);
        setUserRole(null);
        setShowAuth(false); // Default to showing Home page on logout
      }
      setLoading(false); // Authentication check is complete
    });

    // Cleanup subscription when the component unmounts to prevent memory leaks
    return () => unsubscribe();
  }, []);

  // Function to handle user logout
  const handleLogout = async () => {
    try {
      await auth.signOut();
      console.log("User logged out successfully.");
      showNotification('Logged out successfully!', 'info');
    } catch (error) {
      console.error("Error logging out:", error.message);
      showNotification(`Logout failed: ${error.message}`, 'error');
    }
  };

  // Show a loading spinner while checking authentication status
  if (loading) {
    return (
      <div className="app-loading">
        <div className="spinner"></div>
        <p>Loading application...</p>
      </div>
    );
  }

  return (
    <div className="app-container">
      {/* Header Section */}
      <header className="app-header">
        {/* Logo and Title */}
        <div className="header-brand">
          <img src="/logo.png" alt="Samuhik Sauda Logo" className="app-logo" /> {/* Update src with your logo file name */}
          <h1 className="app-title">Samuhik Sauda</h1>
        </div>

        {user ? ( // If user is logged in, show welcome and logout
          <div className="user-info">
            <p>
              Welcome, <span className="user-email">{user.email}</span> (<span className="user-role">{userRole}</span>)
            </p>
            <button onClick={handleLogout} className="logout-button">
              Logout
            </button>
          </div>
        ) : ( // If no user, show Login/Register buttons in header
          <div className="header-auth-buttons"> {/* New div for auth buttons in header */}
            <button onClick={() => setShowAuth(true)} className="header-login-button">Login</button>
            <button onClick={() => setShowAuth(true)} className="header-register-button">Register</button> {/* Both lead to Auth form for simplicity */}
          </div>
        )}
      </header>

      {/* Global Notification Display */}
      {notification.message && (
        <div className={`notification-bar notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Main Content Area */}
      <main className="app-main">
        {!user ? ( // If no user is logged in
          showAuth ? ( // If showAuth is true, show Auth component
            <Auth showNotification={showNotification} />
          ) : ( // Otherwise, show Home component
            <Home onLoginClick={() => setShowAuth(true)} onRegisterClick={() => setShowAuth(true)} />
          )
        ) : (
          // If a user is logged in, show the dashboard based on their role
          <div className="dashboard-panel">
            <h2 className="dashboard-title">
              {userRole === 'vendor' ? 'Vendor Dashboard' : 'Supplier Dashboard'}
            </h2>

            {userRole === 'vendor' && (
              <VendorDashboard showNotification={showNotification} />
            )}

            {userRole === 'supplier' && (
              <SupplierDashboard showNotification={showNotification} />
            )}

            {user && userRole === null && (
              <p className="error-message">
                Your role could not be determined. Please contact support or try re-logging in.
              </p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
