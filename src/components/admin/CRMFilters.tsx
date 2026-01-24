import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, Copy, FlaskConical } from 'lucide-react';
import { toast } from 'sonner';
import type { PotentialMember } from '@/hooks/usePotentialMembers';

interface CRMFiltersProps {
  status: 'all' | 'pending' | 'member' | 'declined';
  subscribed: 'all' | boolean;
  onStatusChange: (status: 'all' | 'pending' | 'member' | 'declined') => void;
  onSubscribedChange: (subscribed: 'all' | boolean) => void;
  onRefresh: () => void;
  members: PotentialMember[];
  isRefreshing?: boolean;
  onSimulate?: () => void;
  isSimulating?: boolean;
}

export const CRMFilters = ({
  status,
  subscribed,
  onStatusChange,
  onSubscribedChange,
  onRefresh,
  members,
  isRefreshing,
  onSimulate,
  isSimulating,
}: CRMFiltersProps) => {
  const handleCopyEmails = () => {
    const emails = members
      .filter(m => m.subscribed)
      .map(m => m.email)
      .join(', ');
    
    if (emails) {
      navigator.clipboard.writeText(emails);
      toast.success(`已複製 ${members.filter(m => m.subscribed).length} 個 Email`);
    } else {
      toast.info('沒有可複製的 Email');
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
      <div className="flex flex-wrap gap-2">
        <Select value={status} onValueChange={(v) => onStatusChange(v as typeof status)}>
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="狀態" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部狀態</SelectItem>
            <SelectItem value="pending">待跟進</SelectItem>
            <SelectItem value="member">會員</SelectItem>
            <SelectItem value="declined">已婉拒</SelectItem>
          </SelectContent>
        </Select>

        <Select 
          value={subscribed === 'all' ? 'all' : subscribed ? 'true' : 'false'} 
          onValueChange={(v) => onSubscribedChange(v === 'all' ? 'all' : v === 'true')}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="訂閱" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="true">已訂閱</SelectItem>
            <SelectItem value="false">未訂閱</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-2">
        {onSimulate && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onSimulate}
            disabled={isSimulating}
          >
            <FlaskConical className="h-4 w-4 mr-2" />
            模擬 Check-in
          </Button>
        )}
        <Button variant="outline" size="sm" onClick={handleCopyEmails}>
          <Copy className="h-4 w-4 mr-2" />
          複製 Email
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>
    </div>
  );
};
