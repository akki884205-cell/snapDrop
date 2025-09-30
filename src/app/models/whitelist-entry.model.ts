export type WhitelistEntryType = 'IPv4' | 'IPv6' | 'CIDR';

export interface WhitelistEntry {
  id: string;
  value: string;
  type: WhitelistEntryType;
  description?: string;
  createdAt: string;
  updatedAt: string;
}
