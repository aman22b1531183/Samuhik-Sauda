// src/components/VendorDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig'; // Import db and auth
import { collection, addDoc, query, where, onSnapshot, orderBy, serverTimestamp, doc, updateDoc, getDoc } from 'firebase/firestore';
import './VendorDashboard.css'; // Import custom CSS for this component

function VendorDashboard({ showNotification }) {
  const [itemName, setItemName] = useState('');
  const [targetQuantity, setTargetQuantity] = useState('');
  const [unit, setUnit] = useState('kg');
  const [deadline, setDeadline] = useState('');
  const [loading, setLoading] = useState(false);

  const [activeDeals, setActiveDeals] = useState([]);
  const [orderHistoryDeals, setOrderHistoryDeals] = useState([]);
  const [contributingDealId, setContributingDealId] = useState(null);
  const [contributionQuantity, setContributionQuantity] = useState('');

  const [myDealsOffers, setMyDealsOffers] = useState({});
  const [dealContributions, setDealContributions] = useState({}); // New state for individual contributions

  const [dealViewMode, setDealViewMode] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const [userEmailsMap, setUserEmailsMap] = useState({}); // State to store UID -> Email map

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      return;
    }

    // Listener for ALL relevant deals
    const qAllDeals = query(collection(db, "deals"));

    const unsubscribeAllDeals = onSnapshot(qAllDeals, async (snapshot) => {
      let allDealsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      allDealsData.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());

      const active = [];
      const history = [];
      const currentVendorDeals = [];
      const uidsToFetch = new Set(); // Collect UIDs for email fetching

      const now = new Date();

      for (const deal of allDealsData) {
        if ((deal.status === 'open' || deal.status === 'ready_for_supplier_offer') && deal.deadline && deal.deadline.toDate() < now) {
          const dealRef = doc(db, "deals", deal.id);
          try {
            await updateDoc(dealRef, { status: 'closed_expired' });
            showNotification(`Deal "${deal.itemName}" has expired.`, 'info');
            history.push({ ...deal, status: 'closed_expired' });
            continue;
          } catch (err) {
            console.error("Error updating expired deal status:", err);
            showNotification(`Failed to update status for expired deal "${deal.itemName}".`, 'error');
          }
        }

        if (deal.status === 'open' || deal.status === 'ready_for_supplier_offer') {
          active.push(deal);
        } else if (deal.status === 'closed_accepted' || deal.status === 'closed_expired') {
          history.push(deal);
          if (deal.acceptedSupplierId) uidsToFetch.add(deal.acceptedSupplierId);
        }

        if (deal.requestedBy === user.uid) {
            currentVendorDeals.push(deal);
        }
      }

      // Fetch emails for collected UIDs
      if (uidsToFetch.size > 0) {
        const newUserEmailsMap = { ...userEmailsMap };
        for (const uid of uidsToFetch) {
          if (!newUserEmailsMap[uid]) {
            try {
              const userDocSnap = await getDoc(doc(db, "users", uid));
              if (userDocSnap.exists()) {
                newUserEmailsMap[uid] = userDocSnap.data().email;
              }
            } catch (err) {
              console.error(`Error fetching email for UID ${uid}:`, err);
            }
          }
        }
        setUserEmailsMap(newUserEmailsMap);
      }

      // Apply view mode filter for active deals
      let filteredActiveDeals = active;
      if (dealViewMode === 'my') {
        filteredActiveDeals = active.filter(deal => deal.requestedBy === user.uid);
      }

      // Apply search filter client-side for active deals
      if (searchTerm) {
        filteredActiveDeals = filteredActiveDeals.filter(deal =>
          deal.itemName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setActiveDeals(filteredActiveDeals);
      setOrderHistoryDeals(history);

      // --- Listener for Offers (for deals created by current vendor) ---
      const qOffers = query(collection(db, "offers"));
      const unsubscribeOffers = onSnapshot(qOffers, (offersSnapshot) => {
          const offersData = offersSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          }));

          const newMyDealsOffers = {};
          offersData.forEach(offer => {
              // CORRECTED LINE: Access requestedBy directly from 'deal' object, not 'd.data()'
              const deal = currentVendorDeals.find(d => d.id === offer.dealId && d.requestedBy === user.uid); // FIXED HERE
              if (deal && (deal.status === 'ready_for_supplier_offer' || deal.status === 'closed_accepted')) {
                  if (!newMyDealsOffers[offer.dealId]) {
                      newMyDealsOffers[offer.dealId] = [];
                  }
                  newMyDealsOffers[offer.dealId].push(offer);
              }
          });
          setMyDealsOffers(newMyDealsOffers);
      }, (err) => {
          console.error("Error fetching offers:", err);
          showNotification("Failed to load offers.", 'error');
      });

      // --- Listener for Contributions (for all active deals) ---
      const qContributions = query(collection(db, "contributions"));
      const unsubscribeContributions = onSnapshot(qContributions, (contributionsSnapshot) => {
          const contributionsData = contributionsSnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
          }));

          const newDealContributions = {};
          const contributorUidsToFetch = new Set();
          contributionsData.forEach(contribution => {
              if (!newDealContributions[contribution.dealId]) {
                  newDealContributions[contribution.dealId] = [];
              }
              newDealContributions[contribution.dealId].push(contribution);
              contributorUidsToFetch.add(contribution.contributorId);
          });
          setDealContributions(newDealContributions);

          // Fetch emails for contributors
          if (contributorUidsToFetch.size > 0) {
            const newUserEmailsMap = { ...userEmailsMap };
            for (const uid of contributorUidsToFetch) {
              if (!newUserEmailsMap[uid]) {
                try {
                  getDoc(doc(db, "users", uid)).then(userDocSnap => {
                    if (userDocSnap.exists()) {
                      newUserEmailsMap[uid] = userDocSnap.data().email;
                      setUserEmailsMap(newUserEmailsMap);
                    }
                  });
                } catch (err) {
                  console.error(`Error fetching email for contributor UID ${uid}:`, err);
                }
              }
            }
          }
      }, (err) => {
          console.error("Error fetching contributions:", err);
          showNotification("Failed to load contributions.", 'error');
      });


      return () => {
        unsubscribeOffers();
        unsubscribeContributions();
      };

    }, (err) => {
      console.error("Error fetching deals:", err);
      showNotification("Failed to load deals.", 'error');
    });

    return () => {
      unsubscribeAllDeals();
    };
  }, [auth.currentUser, dealViewMode, searchTerm]);

  const handleCreateDeal = async (e) => {
    e.preventDefault();
    setLoading(true);

    if (!itemName || !targetQuantity || !unit || !deadline) {
      showNotification('Please fill in all fields.', 'error');
      setLoading(false);
      return;
    }
    if (isNaN(targetQuantity) || parseFloat(targetQuantity) <= 0) {
      showNotification('Target quantity must be a positive number.', 'error');
      setLoading(false);
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      showNotification('You must be logged in to create a deal.', 'error');
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, "deals"), {
        itemName: itemName.trim(),
        targetQuantity: parseFloat(targetQuantity),
        currentQuantity: 0,
        unit: unit,
        deadline: new Date(deadline),
        requestedBy: user.uid,
        status: 'open',
        createdAt: serverTimestamp(),
      });
      showNotification('New group buy deal created successfully!', 'success');
      setItemName('');
      setTargetQuantity('');
      setUnit('kg');
      setDeadline('');
    } catch (err) {
      console.error("Error creating deal:", err);
      showNotification('Failed to create deal: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleContributeToDeal = async (dealId) => {
    if (isNaN(contributionQuantity) || parseFloat(contributionQuantity) <= 0) {
      showNotification('Contribution quantity must be a positive number.', 'error');
      return;
    }

    setLoading(true);

    try {
      const dealRef = doc(db, "deals", dealId);
      const dealSnap = await getDoc(dealRef);
      const user = auth.currentUser;

      if (!dealSnap.exists()) {
        showNotification('Deal not found.', 'error');
        setLoading(false);
        return;
      }
      if (!user) {
        showNotification('You must be logged in to contribute.', 'error');
        setLoading(false);
        return;
      }

      const currentDeal = dealSnap.data();
      const newCurrentQuantity = currentDeal.currentQuantity + parseFloat(contributionQuantity);

      if (newCurrentQuantity > currentDeal.targetQuantity) {
        showNotification(`Your contribution exceeds the remaining quantity for this deal (${(currentDeal.targetQuantity - currentDeal.currentQuantity).toFixed(2)} ${currentDeal.unit} left).`, 'error');
        setLoading(false);
        return;
      }

      let newStatus = currentDeal.status;
      if (newCurrentQuantity >= currentDeal.targetQuantity) {
        newStatus = 'ready_for_supplier_offer';
        showNotification('Deal target met! Waiting for supplier offers.', 'success');
      } else {
        showNotification('Your contribution has been added!', 'success');
      }

      await updateDoc(dealRef, {
        currentQuantity: newCurrentQuantity,
        status: newStatus,
      });

      await addDoc(collection(db, "contributions"), {
        dealId: dealId,
        contributorId: user.uid,
        quantity: parseFloat(contributionQuantity),
        unit: currentDeal.unit,
        createdAt: serverTimestamp(),
      });

      setContributingDealId(null);
      setContributionQuantity('');
    } catch (err) {
      console.error("Error contributing to deal:", err);
      showNotification('Failed to contribute: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptOffer = async (dealId, offerId, offerPricePerUnit, supplierId) => {
    setLoading(true);

    try {
      const dealRef = doc(db, "deals", dealId);
      await updateDoc(dealRef, {
        status: 'closed_accepted',
        acceptedOfferId: offerId,
        acceptedPricePerUnit: offerPricePerUnit,
        acceptedByVendorId: auth.currentUser.uid,
        acceptedSupplierId: supplierId,
        closedAt: serverTimestamp(),
      });

      showNotification('Offer accepted! Deal is now closed.', 'success');
    } catch (err) {
      console.error("Error accepting offer:", err);
      showNotification('Failed to accept offer: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="vendor-dashboard">
      <div className="dashboard-section create-deal-section">
        <h3 className="section-title">Create New Group Buy Deal</h3>
        <form onSubmit={handleCreateDeal} className="deal-form">
          <div className="form-group">
            <label htmlFor="itemName">Item Name:</label>
            <input
              type="text"
              id="itemName"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g., Potatoes, Onions"
              required
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="targetQuantity">Target Quantity:</label>
            <input
              type="number"
              id="targetQuantity"
              value={targetQuantity}
              onChange={(e) => setTargetQuantity(e.target.value)}
              placeholder="e.g., 50"
              required
              min="1"
              className="form-input"
            />
          </div>
          <div className="form-group">
            <label htmlFor="unit">Unit:</label>
            <select id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} className="form-select">
              <option value="kg">kg</option>
              <option value="dozen">dozen</option>
              <option value="piece">piece</option>
              <option value="liter">liter</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="deadline">Deadline:</label>
            <input
              type="date"
              id="deadline"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
              className="form-input"
            />
          </div>
          <button type="submit" className="submit-button" disabled={loading}>
            {loading ? 'Creating...' : 'Create Deal'}
          </button>
        </form>
      </div>

      <div className="dashboard-section active-deals-section">
        <h3 className="section-title">Active Group Buy Deals</h3>
        <div className="deal-controls">
            <input
                type="text"
                placeholder="Search by item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
            />
            <div className="view-toggle">
                <button
                    onClick={() => setDealViewMode('all')}
                    className={`toggle-button ${dealViewMode === 'all' ? 'active' : ''}`}
                >
                    All Deals
                </button>
                <button
                    onClick={() => setDealViewMode('my')}
                    className={`toggle-button ${dealViewMode === 'my' ? 'active' : ''}`}
                >
                    My Deals
                </button>
            </div>
        </div>
        {activeDeals.length === 0 ? (
          <p className="no-deals-message">No active deals available. Be the first to create one!</p>
        ) : (
          <div className="deals-grid">
            {activeDeals.map((deal) => (
              <div key={deal.id} className="deal-card">
                <h4 className="deal-item-name">{deal.itemName}</h4>
                <p>Target: <span className="deal-quantity">{deal.targetQuantity} {deal.unit}</span></p>
                <p>Collected: <span className="deal-quantity-collected">{deal.currentQuantity} {deal.unit}</span></p>
                <p>Remaining: <span className="deal-quantity-remaining">{(deal.targetQuantity - deal.currentQuantity).toFixed(2)} {deal.unit}</span></p>
                <p>Deadline: {new Date(deal.deadline.seconds * 1000).toLocaleDateString()}</p>
                <p className="deal-status">Status: <span className={`status-${deal.status}`}>{deal.status.replace(/_/g, ' ')}</span></p>

                {deal.requestedBy === auth.currentUser.uid && (
                  <p className="deal-owner-tag">(Your Deal)</p>
                )}

                {/* Display individual contributions */}
                {dealContributions[deal.id] && dealContributions[deal.id].length > 0 && (
                    <div className="contributions-list">
                        <h5 className="contributions-list-title">Contributions:</h5>
                        {dealContributions[deal.id].map(contribution => (
                            <p key={contribution.id} className="contribution-item">
                                <span className="contributor-email">{userEmailsMap[contribution.contributorId] || 'Unknown User'}</span>: {contribution.quantity} {contribution.unit}
                            </p>
                        ))}
                    </div>
                )}


                {/* Conditional rendering for action buttons based on deal status */}
                {deal.status === 'open' && deal.currentQuantity < deal.targetQuantity && (
                  <div className="contribution-area">
                    {contributingDealId === deal.id ? (
                      <>
                        <input
                          type="number"
                          value={contributionQuantity}
                          onChange={(e) => setContributionQuantity(e.target.value)}
                          placeholder="Qty to add"
                          min="0.01"
                          step="0.01"
                          className="contribution-input"
                        />
                        <button
                          onClick={() => handleContributeToDeal(deal.id)}
                          className="contribute-button"
                          disabled={loading}
                        >
                          {loading ? 'Adding...' : 'Add Contribution'}
                        </button>
                        <button
                          onClick={() => { setContributingDealId(null); setContributionQuantity(''); }}
                          className="cancel-button"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button
                        onClick={() => { setContributingDealId(deal.id); }}
                        className="join-deal-button"
                        disabled={loading}
                      >
                        Join This Deal
                      </button>
                    )}
                  </div>
                )}
                {deal.status === 'ready_for_supplier_offer' && (
                  <div className="deal-ready-message">
                    <p>Target met! Waiting for supplier offers.</p>
                    {/* Display Offers for this deal if current user is the requester */}
                    {deal.requestedBy === auth.currentUser.uid && myDealsOffers[deal.id] && myDealsOffers[deal.id].length > 0 && (
                      <div className="offers-list">
                        <h5 className="offers-list-title">Offers Received:</h5>
                        {myDealsOffers[deal.id].map(offer => (
                          <div key={offer.id} className="offer-item">
                            <p>Price: ₹{offer.offerPricePerUnit.toFixed(2)} per {deal.unit}</p>
                            <p>Total: ₹{offer.totalOfferPrice.toFixed(2)}</p>
                            <p className="offer-notes">Notes: {offer.offerNotes || 'N/A'}</p>
                            <button
                              onClick={() => handleAcceptOffer(deal.id, offer.id, offer.offerPricePerUnit, offer.supplierId)}
                              className="accept-offer-button"
                              disabled={loading}
                            >
                              {loading ? 'Accepting...' : 'Accept Offer'}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    {deal.requestedBy === auth.currentUser.uid && (!myDealsOffers[deal.id] || myDealsOffers[deal.id].length === 0) && (
                      <p className="no-offers-yet">No offers received yet for your deal.</p>
                    )}
                  </div>
                )}
                {/* Display messages if deal is closed */}
                {deal.status === 'closed_accepted' && (
                  <div className="deal-closed-message">
                    <p>Deal Closed: Offer Accepted!</p>
                    {deal.acceptedPricePerUnit && (
                      <p>Accepted Price: ₹{deal.acceptedPricePerUnit.toFixed(2)} per {deal.unit}</p>
                    )}
                  </div>
                )}
                {deal.status === 'closed_expired' && (
                  <div className="deal-closed-message">
                    <p>Deal Closed: Expired.</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-section order-history-section">
        <h3 className="section-title">Order History (Your Deals)</h3>
        {orderHistoryDeals.length === 0 ? (
          <p className="no-history-message">No past deals in your history yet.</p>
        ) : (
          <div className="deals-grid">
            {orderHistoryDeals.map((deal) => (
              <div key={deal.id} className="deal-card history-card">
                <h4 className="deal-item-name">{deal.itemName}</h4>
                <p>Target: <span className="deal-quantity">{deal.targetQuantity} {deal.unit}</span></p>
                <p>Collected: <span className="deal-quantity-collected">{deal.currentQuantity} {deal.unit}</span></p>
                <p>Closed On: {deal.closedAt ? new Date(deal.closedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                <p className="deal-status">Final Status: <span className={`status-${deal.status}`}>{deal.status.replace(/_/g, ' ')}</span></p>
                {deal.status === 'closed_accepted' && deal.acceptedPricePerUnit && (
                  <p className="history-accepted-price">Accepted Price: ₹{deal.acceptedPricePerUnit.toFixed(2)} per {deal.unit}</p>
                )}
                {deal.status === 'closed_expired' && (
                  <p className="history-expired-message">Deal did not meet target or expired.</p>
                )}
                {deal.status === 'closed_accepted' && deal.acceptedSupplierId && userEmailsMap[deal.acceptedSupplierId] && (
                    <p className="contact-info">Contact Supplier: <a href={`mailto:${userEmailsMap[deal.acceptedSupplierId]}`}>{userEmailsMap[deal.acceptedSupplierId]}</a></p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default VendorDashboard;
