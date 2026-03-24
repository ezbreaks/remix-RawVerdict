import { CardDetails, CardAnalysis } from './services/gemini';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  created_at: string;
  last_login_at?: string;
}

export interface Card extends CardDetails {
  id: number;
  user_id: number;
  quantity: number;
  market_price?: string;
  market_updated_at?: string;
  front_image?: string;
  back_image?: string;
  slab_image?: string;
  notes?: string;
  analysis?: CardAnalysis;
  created_at: string;
}
