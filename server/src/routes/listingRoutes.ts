import { Router } from 'express';
import {
  getListings,
  getListingById,
  createListing,
  updateListing,
  cancelListing,
  placeBid,
  setProxyBid,
  cancelProxyBid,
  getWantedAlerts,
  createWantedAlert,
  deleteWantedAlert,
  askListingQuestion,
  answerListingQuestion,
  getSellerListings,
  getBuyerBids,
  confirmBuyerHandover,
  manageSellerListing,
  seedListings,
} from '../controllers/listingController.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();

// Public listing browsing & details
router.get('/wanted-alerts/mine', authenticateToken, getWantedAlerts);
router.post('/wanted-alerts', authenticateToken, createWantedAlert);
router.delete('/wanted-alerts/:id', authenticateToken, deleteWantedAlert);
router.get('/', getListings);
router.get('/mine', authenticateToken, getSellerListings);
router.get('/mine/bids', authenticateToken, getBuyerBids);
router.get('/:id', getListingById);
router.post('/seed', seedListings);

// Protected Seller routes (Batch 23 only)
router.post('/', authenticateToken, createListing);
router.put('/:id', authenticateToken, updateListing);
router.patch('/:id/cancel', authenticateToken, cancelListing);
router.patch('/:id/management', authenticateToken, manageSellerListing);

// Protected Buyer routes (Batch 24 only)
router.post('/:id/bid', authenticateToken, placeBid);
router.post('/:id/proxy-bid', authenticateToken, setProxyBid);
router.delete('/:id/proxy-bid', authenticateToken, cancelProxyBid);
router.patch('/:id/confirm-handover', authenticateToken, confirmBuyerHandover);
router.post('/:id/questions', authenticateToken, askListingQuestion);
router.post('/:id/questions/:questionId/answer', authenticateToken, answerListingQuestion);

export default router;
