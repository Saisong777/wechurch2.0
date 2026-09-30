import path from 'node:path';

export const uploadRoot = process.env.UPLOAD_ROOT || path.join(process.cwd(), 'uploads');
export const messageCardRoot = process.env.UPLOAD_ROOT
  ? path.join(process.env.UPLOAD_ROOT, 'message-cards')
  : path.join(process.cwd(), 'public', 'message-cards');
