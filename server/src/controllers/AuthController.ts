import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AdminUser } from '../models/AdminUser';
import { AuthenticatedRequest } from '../middleware/auth';

export class AuthController {
  /**
   * POST /api/v1/auth/login
   */
  public static async login(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        res.status(400).json({ error: 'Username and password are required' });
        return;
      }

      const normalizedUsername = String(username).trim().toLowerCase();
      const admin = await AdminUser.findOne({ username: normalizedUsername }).select('+passwordHash');

      if (!admin) {
        // Return generic message to prevent username enumeration
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }

      const isValidPassword = await admin.comparePassword(password);
      if (!isValidPassword) {
        res.status(401).json({ error: 'Invalid username or password' });
        return;
      }

      const jwtSecret = process.env.DASHBOARD_JWT_SECRET || 'dev_fallback_secret_min_32_characters_long';
      const token = jwt.sign(
        {
          id: admin._id,
          username: admin.username,
          role: admin.role,
        },
        jwtSecret,
        { expiresIn: '24h' }
      );

      // Update last login timestamp
      admin.lastLoginAt = new Date();
      await admin.save();

      // Secure cookie
      res.cookie('admin_token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000,
      });

      res.status(200).json({
        token,
        admin: {
          id: admin._id,
          username: admin.username,
          role: admin.role,
        },
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Login failed', details: err.message });
    }
  }

  /**
   * GET /api/v1/auth/me
   */
  public static async getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
    if (!req.admin) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    res.status(200).json({
      admin: req.admin,
    });
  }

  /**
   * POST /api/v1/auth/logout
   */
  public static async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie('admin_token');
    res.status(200).json({ message: 'Successfully logged out' });
  }

  /**
   * GET /api/v1/auth/setup-status
   * Checks whether at least one administrator account exists.
   */
  public static async getSetupStatus(_req: Request, res: Response): Promise<void> {
    try {
      const adminCount = await AdminUser.countDocuments();
      res.status(200).json({
        hasAdmin: adminCount > 0,
      });
    } catch (err: any) {
      res.status(500).json({ error: 'Failed to check admin status', details: err.message });
    }
  }
}

