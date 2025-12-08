import { Request } from 'express';
import { Session } from './express-session'; // or the type you're using for session
declare global {
  namespace Express {
    interface Request {
      session?: Session; // Add your specific session type here
    }
  }
}

export { Session };

