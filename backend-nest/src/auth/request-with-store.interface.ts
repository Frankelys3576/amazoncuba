import { Request } from 'express';
import { User } from '@supabase/supabase-js';
import { Store } from '@prisma/client';

export interface RequestWithStore extends Request {
  user: User;
  store: Store;
}
