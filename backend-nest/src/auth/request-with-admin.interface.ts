import { Request } from 'express';
import { User } from '@supabase/supabase-js';

export interface RequestWithAdmin extends Request {
  admin?: User;
}
