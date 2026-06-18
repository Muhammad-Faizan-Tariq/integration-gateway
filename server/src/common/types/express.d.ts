import { Partner } from '@prisma/client';

declare global {
  namespace Express {
    interface Request {
      partner?: Partner;
    }
  }
}
