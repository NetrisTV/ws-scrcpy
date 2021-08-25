import { Message } from './Message';
import { FileStats } from './FileStats';

export interface ReplyFileListing extends Message {
    success: boolean;
    error?: string;
    list?: FileStats[];
}
