import React, { useEffect, useState, useMemo } from 'react';
import { useSession } from '@/contexts/SessionContext';
import { Button } from '@/components/ui/button';
import { ArrowRight, MapPin } from 'lucide-react';

interface GroupRevealProps {
  onContinue: () => void;
}

export const GroupReveal: React.FC<GroupRevealProps> = ({ onContinue }) => {
  const { currentUser, currentSession, users } = useSession();
  const [showNumber, setShowNumber] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    // Reveal animation sequence
    const timer1 = setTimeout(() => setShowNumber(true), 500);
    const timer2 = setTimeout(() => setShowDetails(true), 1500);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  const globalGroupNumber = currentUser?.groupNumber || 1;
  const userLocation = currentUser?.location || 'On-site';

  // Calculate local group number within the user's location
  const localGroupInfo = useMemo(() => {
    if (!currentSession?.groups || !currentUser?.groupNumber) {
      return { localNumber: globalGroupNumber, totalGroupsInLocation: 1 };
    }

    // Get all groups in the user's location
    const locationGroups = currentSession.groups
      .filter(g => {
        const groupLocation = g.members[0]?.location || 'On-site';
        return groupLocation === userLocation;
      })
      .sort((a, b) => a.number - b.number);

    // Find the local index of the user's group within their location
    const localIndex = locationGroups.findIndex(g => g.number === globalGroupNumber);
    const localNumber = localIndex >= 0 ? localIndex + 1 : 1;

    return {
      localNumber,
      totalGroupsInLocation: locationGroups.length,
    };
  }, [currentSession?.groups, currentUser?.groupNumber, globalGroupNumber, userLocation]);

  const { localNumber } = localGroupInfo;
  const isRemote = userLocation !== 'On-site';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
      <div className="text-center">
        {!showNumber && (
          <div className="animate-pulse">
            <p className="text-muted-foreground text-lg">正在分組中...</p>
            <p className="text-muted-foreground text-sm mt-2">Assigning groups...</p>
          </div>
        )}
        
        {showNumber && (
          <div className="animate-scale-in">
            {/* Show location if remote */}
            {isRemote && (
              <div className="flex items-center justify-center gap-2 mb-4 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>{userLocation}</span>
              </div>
            )}
            
            <p className="text-muted-foreground text-lg mb-4">您的小組</p>
            
            <div className="relative inline-block">
              <div className="absolute inset-0 bg-secondary/40 rounded-full blur-3xl animate-pulse-soft" />
              <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full gradient-gold flex items-center justify-center glow-gold">
                <span className="font-serif text-8xl md:text-9xl font-bold text-secondary-foreground">
                  {localNumber}
                </span>
              </div>
            </div>
            
            <p className="mt-6 font-serif text-3xl md:text-4xl font-bold text-foreground">
              第 {localNumber} 組
            </p>
            <p className="text-muted-foreground mt-2">
              {isRemote ? `${userLocation} - Group #${localNumber}` : `Group #${localNumber}`}
            </p>
          </div>
        )}
        
        {showDetails && (
          <div className="mt-12 animate-fade-in space-y-4">
            <p className="text-lg text-muted-foreground">
              {isRemote ? '請與您的線上小組成員會合' : '請移動至您的小組座位區'}
            </p>
            <p className="text-muted-foreground">
              {isRemote ? 'Please join your online group members' : 'Please move to your group seating area'}
            </p>
            
            <Button
              variant="gold"
              size="xl"
              onClick={onContinue}
              className="mt-8"
            >
              開始查經 Start Study
              <ArrowRight className="w-5 h-5" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};
