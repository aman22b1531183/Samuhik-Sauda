// src/components/SupplierDashboard.jsx
import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig'; // Import db and auth
import { collection, query, where, onSnapshot, doc, updateDoc, addDoc, serverTimestamp, getDoc } from 'firebase/firestore'; // Ensure getDoc is imported
import './SupplierDashboard.css'; // Import custom CSS for this component

function SupplierDashboard({ showNotification }) { // Accept showNotification prop
  const [dealsReadyForOffer, setDealsReadyForOffer] = useState([]);
  const [makingOfferDealId, setMakingOfferDealId] = useState(null);
  const [offerPricePerUnit, setOfferPricePerUnit] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [loading, setLoading] = useState(false);

  const [mySubmittedOffers, setMySubmittedOffers] = useState([]);
  const [myAcceptedOffers, setMyAcceptedOffers] = useState([]);
  const [allDealsForOffers, setAllDealsForOffers] = useState({});

  const [searchTerm, setSearchTerm] = useState('');
  const [userEmailsMap, setUserEmailsMap] = useState({}); // New state to store UID -> Email map

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    // Listener for deals ready for supplier offers
    let qReadyDeals = query(
      collection(db, "deals"),
      where("status", "==", "ready_for_supplier_offer")
    );

    const unsubscribeReadyDeals = onSnapshot(qReadyDeals, (snapshot) => {
      let dealsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      dealsData.sort((a, b) => a.createdAt?.toDate() - b.createdAt?.toDate());

      // Apply search filter client-side
      if (searchTerm) {
        dealsData = dealsData.filter(deal =>
          deal.itemName.toLowerCase().includes(searchTerm.toLowerCase())
        );
      }
      setDealsReadyForOffer(dealsData);
    }, (err) => {
      console.error("Error fetching deals ready for offer:", err);
      showNotification("Failed to load deals ready for offers.", 'error'); // Use notification
    });

    const qAllDeals = query(collection(db, "deals"));
    const unsubscribeAllDeals = onSnapshot(qAllDeals, async (snapshot) => { // Made async to allow email fetching
        const dealsMap = {};
        const uidsToFetch = new Set(); // Collect UIDs for email fetching
        snapshot.docs.forEach(doc => {
            const dealData = { id: doc.id, ...doc.data() };
            dealsMap[doc.id] = dealData;
            if (dealData.requestedBy) uidsToFetch.add(dealData.requestedBy); // Collect vendor UID
        });
        setAllDealsForOffers(dealsMap);

        // Fetch emails for collected UIDs
        if (uidsToFetch.size > 0) {
            const newUserEmailsMap = { ...userEmailsMap };
            for (const uid of uidsToFetch) {
                if (!newUserEmailsMap[uid]) { // Fetch only if not already fetched
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

    }, (err) => {
        console.error("Error fetching all deals for offer mapping:", err);
    });


    const qMyOffers = query(
      collection(db, "offers"),
      where("supplierId", "==", user.uid)
    );

    const unsubscribeMyOffers = onSnapshot(qMyOffers, (snapshot) => {
      const offersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      offersData.sort((a, b) => b.createdAt?.toDate() - a.createdAt?.toDate());
      setMySubmittedOffers(offersData);

      const accepted = offersData.filter(offer => {
        const deal = allDealsForOffers[offer.dealId];
        return deal && deal.status === 'closed_accepted' && deal.acceptedOfferId === offer.id;
      });
      setMyAcceptedOffers(accepted);

    }, (err) => {
      console.error("Error fetching my submitted offers:", err);
      showNotification("Failed to load your submitted offers.", 'error'); // Use notification
    });

    return () => {
      unsubscribeReadyDeals();
      unsubscribeAllDeals();
      unsubscribeMyOffers();
    };
  }, [allDealsForOffers, searchTerm]); // Depend on allDealsForOffers and searchTerm

  const handleMakeOffer = async (dealId, targetQuantity) => {
    if (isNaN(offerPricePerUnit) || parseFloat(offerPricePerUnit) <= 0) {
      showNotification('Offer price must be a positive number.', 'error'); // Use notification
      return;
    }

    setLoading(true);

    const user = auth.currentUser;
    if (!user) {
      showNotification('You must be logged in to make an offer.', 'error'); // Use notification
      setLoading(false);
      return;
    }

    try {
      await addDoc(collection(db, "offers"), {
        dealId: dealId,
        supplierId: user.uid,
        offerPricePerUnit: parseFloat(offerPricePerUnit),
        totalOfferPrice: parseFloat(offerPricePerUnit) * targetQuantity,
        offerNotes: offerNotes.trim(),
        status: 'pending',
        createdAt: serverTimestamp(),
      });

      showNotification('Your offer has been submitted successfully!', 'success'); // Use notification
      setMakingOfferDealId(null);
      setOfferPricePerUnit('');
      setOfferNotes('');

    } catch (err) {
      console.error("Error making offer:", err);
      showNotification('Failed to submit offer: ' + err.message, 'error'); // Use notification
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="supplier-dashboard">
      <div className="dashboard-section offers-section">
        <h3 className="section-title">Deals Ready for Your Offers</h3>
        <div className="deal-controls"> {/* Re-using deal-controls class from VendorDashboard.css */}
            <input
                type="text"
                placeholder="Search by item name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
            />
        </div>
        {dealsReadyForOffer.length === 0 ? (
          <p className="no-deals-message">No deals currently ready for offers. Check back later!</p>
        ) : (
          <div className="deals-grid">
            {dealsReadyForOffer.map((deal) => (
              <div key={deal.id} className="deal-card">
                <h4 className="deal-item-name">{deal.itemName}</h4>
                <p>Target Quantity: <span className="deal-quantity">{deal.targetQuantity} {deal.unit}</span></p>
                <p>Collected Quantity: <span className="deal-quantity-collected">{deal.currentQuantity} {deal.unit}</span></p>
                <p>Deadline: {new Date(deal.deadline.seconds * 1000).toLocaleDateString()}</p>
                <p className="deal-status">Status: <span className={`status-${deal.status}`}>{deal.status.replace(/_/g, ' ')}</span></p>

                {/* Conditionally render Make an Offer UI */}
                {(deal.status === 'open' || deal.status === 'ready_for_supplier_offer') && (
                    makingOfferDealId === deal.id ? (
                      <div className="offer-input-area">
                        <div className="form-group">
                          <label htmlFor={`price-${deal.id}`}>Offer Price per {deal.unit}:</label>
                          <input
                            type="number"
                            id={`price-${deal.id}`}
                            value={offerPricePerUnit}
                            onChange={(e) => setOfferPricePerUnit(e.target.value)}
                            placeholder="e.g., 25.50"
                            min="0.01"
                            step="0.01"
                            required
                            className="form-input"
                          />
                        </div>
                        <div className="form-group">
                          <label htmlFor={`notes-${deal.id}`}>Notes (Optional):</label>
                          <textarea
                            id={`notes-${deal.id}`}
                            value={offerNotes}
                            onChange={(e) => setOfferNotes(e.target.value)}
                            placeholder="e.g., Organic, delivery by 5 PM"
                            rows="2"
                            className="form-input"
                          ></textarea>
                        </div>
                        <div className="offer-buttons">
                          <button
                            onClick={() => handleMakeOffer(deal.id, deal.targetQuantity)}
                            className="submit-offer-button"
                            disabled={loading}
                          >
                            {loading ? 'Submitting...' : 'Submit Offer'}
                          </button>
                          <button
                            onClick={() => { setMakingOfferDealId(null); setOfferPricePerUnit(''); setOfferNotes(''); }}
                            className="cancel-offer-button"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setMakingOfferDealId(deal.id); }}
                        className="make-offer-button"
                        disabled={loading}
                      >
                        Make an Offer
                      </button>
                    )
                )}
                {/* Display messages if deal is closed */}
                {deal.status === 'closed_accepted' && (
                    <p className="deal-closed-message">Deal Closed: Offer Accepted!</p>
                )}
                {deal.status === 'closed_expired' && (
                    <p className="deal-closed-message">Deal Closed: Expired.</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dashboard-section my-offers-section">
        <h3 className="section-title">My Submitted Offers</h3>
        {mySubmittedOffers.length === 0 ? (
          <p className="no-offers-message">You haven't submitted any offers yet.</p>
        ) : (
          <div className="offers-list-grid">
            {mySubmittedOffers.map((offer) => {
              const associatedDeal = allDealsForOffers[offer.dealId];
              if (!associatedDeal) return null;

              return (
                <div key={offer.id} className="submitted-offer-card">
                  <h4 className="offer-item-name">Offer for: {associatedDeal.itemName}</h4>
                  <p>Your Price: ₹{offer.offerPricePerUnit.toFixed(2)} per {associatedDeal.unit}</p>
                  <p>Total Offer: ₹{offer.totalOfferPrice.toFixed(2)}</p>
                  <p className="offer-notes">Notes: {offer.offerNotes || 'N/A'}</p>
                  <p className="offer-status">
                    Deal Status: <span className={`status-${associatedDeal.status}`}>{associatedDeal.status.replace(/_/g, ' ')}</span>
                  </p>
                  {associatedDeal.status === 'closed_accepted' && associatedDeal.acceptedOfferId === offer.id && (
                      <p className="offer-accepted-message">This offer was Accepted!</p>
                  )}
                  {associatedDeal.status === 'closed_accepted' && associatedDeal.acceptedOfferId !== offer.id && (
                      <p className="offer-rejected-message">Offer Rejected (Another offer was accepted)</p>
                  )}
                  {associatedDeal.status === 'ready_for_supplier_offer' && (
                      <p className="offer-pending-message">Offer Pending (Deal still open for offers)</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="dashboard-section accepted-offers-section">
        <h3 className="section-title">My Accepted Offers</h3>
        {myAcceptedOffers.length === 0 ? (
          <p className="no-accepted-offers-message">No offers have been accepted yet.</p>
        ) : (
          <div className="offers-list-grid">
            {myAcceptedOffers.map((offer) => {
              const associatedDeal = allDealsForOffers[offer.dealId];
              if (!associatedDeal) return null;

              return (
                <div key={offer.id} className="accepted-offer-card">
                  <h4 className="offer-item-name">Accepted for: {associatedDeal.itemName}</h4>
                  <p>Your Price: ₹{offer.offerPricePerUnit.toFixed(2)} per {associatedDeal.unit}</p>
                  <p>Total Accepted: ₹{offer.totalOfferPrice.toFixed(2)}</p>
                  <p className="offer-notes">Notes: {offer.offerNotes || 'N/A'}</p>
                  <p className="accepted-deal-status">Deal Status: <span className={`status-${associatedDeal.status}`}>{associatedDeal.status.replace(/_/g, ' ')}</span></p>
                  <p className="accepted-deal-closed-date">Closed On: {associatedDeal.closedAt ? new Date(associatedDeal.closedAt.seconds * 1000).toLocaleDateString() : 'N/A'}</p>
                  {associatedDeal.requestedBy && userEmailsMap[associatedDeal.requestedBy] && (
                      <p className="contact-info">Contact Vendor: <a href={`mailto:${userEmailsMap[associatedDeal.requestedBy]}`}>{userEmailsMap[associatedDeal.requestedBy]}</a></p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default SupplierDashboard;
