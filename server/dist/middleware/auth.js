import jwt from 'jsonwebtoken';
import { User } from '../models/User.js';
export const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    if (!token) {
        res.status(401).json({ message: 'Access denied: No token provided' });
        return;
    }
    try {
        const secret = process.env.JWT_SECRET;
        const decoded = jwt.verify(token, secret);
        const user = await User.findById(decoded.userId).select('-password');
        if (!user) {
            res.status(401).json({ message: 'User not found for this token' });
            return;
        }
        const derivedRole = user.rollNumber.startsWith('23')
            ? 'seller'
            : user.rollNumber.startsWith('24')
                ? 'buyer'
                : null;
        if (!derivedRole || user.role !== derivedRole || decoded.role !== derivedRole || decoded.rollNumber !== user.rollNumber) {
            res.status(403).json({ message: 'Access denied: account role verification failed.' });
            return;
        }
        req.user = user;
        next();
    }
    catch (err) {
        res.status(403).json({ message: 'Invalid or expired token', error: err });
    }
};
//# sourceMappingURL=auth.js.map