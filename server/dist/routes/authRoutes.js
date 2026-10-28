import { Router } from 'express';
import { register, login, getMe, } from '../controllers/authController.js';
import { authenticateToken } from '../middleware/auth.js';
const router = Router();
// Public routes
router.post('/register', register);
router.post('/login', login);
// Protected routes
router.get('/me', authenticateToken, getMe);
export default router;
//# sourceMappingURL=authRoutes.js.map